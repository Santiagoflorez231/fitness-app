/**
 * Respaldo local (export/import) — Progreso, feature 4.
 * Referencia: docs/design-carga.md ("Exportar/importar respaldo (JSON)").
 *
 * `exportBackup()` es de SOLO LECTURA: usa exclusivamente los métodos ya
 * expuestos por routinesRepo/sessionsRepo, nunca SQL directo.
 *
 * `importBackup()` es ADITIVO por diseño (docs/persistence-schema.md no
 * contempla borrado desde la UI) y NUNCA borra datos existentes:
 *   - Rutinas: `routinesRepo.save()`, que ya es upsert por id — este es el
 *     comportamiento preexistente de save(), no se ha tocado su semántica.
 *     Una rutina importada con el mismo id que una ya guardada localmente
 *     actualiza sus campos (last-write-wins), igual que si se editara desde
 *     la app.
 *   - Sesiones y series: SOLO se insertan si su id no existe ya
 *     (`addSessionIfNotExists` / `addSetIfNotExists`, métodos NUEVOS y
 *     ADITIVOS en SessionsRepo — ver src/db/repos.ts y src/db/sqlite.ts,
 *     usan `INSERT OR IGNORE`). Así, reimportar el mismo archivo dos veces
 *     es idempotente y nunca pisa un entrenamiento que ya se guardó
 *     localmente.
 *
 * Validación: se comprueba el shape completo de rutinas/sesiones/series
 * ANTES de escribir nada. Si una sola fila no encaja, se aborta sin tocar
 * la base de datos y se devuelve un error legible.
 */
import { routinesRepo, sessionsRepo } from '.';
import type { Routine, RoutineExercise, SessionSet, WorkoutSession } from '../types/routine';

export const BACKUP_APP_ID = 'CARGA';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  routines: Routine[];
  sessions: WorkoutSession[];
  sets: SessionSet[];
}

/** Solo lectura: reúne rutinas (incluidas archivadas), sesiones terminadas y todas sus series. */
export async function exportBackup(): Promise<BackupFile> {
  const routines = await routinesRepo.listAll();
  const sessions = await sessionsRepo.listFinished();
  const setsBySession = await Promise.all(sessions.map((session) => sessionsRepo.getSets(session.id)));
  const sets = setsBySession.flat();

  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    routines,
    sessions,
    sets,
  };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  routinesImported?: number;
  sessionsImported?: number;
  setsImported?: number;
}

// --- Validación de shape (defensiva: el JSON viene de un archivo del usuario) ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRoutineExerciseShape(value: unknown): value is RoutineExercise {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.exerciseId === 'string' &&
    typeof value.exerciseName === 'string' &&
    typeof value.position === 'number' &&
    typeof value.targetSets === 'number' &&
    typeof value.targetReps === 'number' &&
    typeof value.restSeconds === 'number' &&
    (value.notes === undefined || typeof value.notes === 'string')
  );
}

function isRoutineShape(value: unknown): value is Routine {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.position === 'number' &&
    typeof value.archived === 'boolean' &&
    typeof value.createdAt === 'number' &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isRoutineExerciseShape)
  );
}

function isWorkoutSessionShape(value: unknown): value is WorkoutSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.routineId === null || typeof value.routineId === 'string') &&
    typeof value.routineName === 'string' &&
    typeof value.startedAt === 'number' &&
    (value.finishedAt === null || typeof value.finishedAt === 'number') &&
    (value.notes === undefined || typeof value.notes === 'string')
  );
}

function isSessionSetShape(value: unknown): value is SessionSet {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.exerciseId === 'string' &&
    typeof value.exerciseName === 'string' &&
    typeof value.setNumber === 'number' &&
    typeof value.weightKg === 'number' &&
    typeof value.reps === 'number' &&
    (value.rpe === undefined || typeof value.rpe === 'number') &&
    typeof value.completedAt === 'number' &&
    (value.routineExerciseId === undefined || typeof value.routineExerciseId === 'string')
  );
}

interface BackupContainerShape {
  app: unknown;
  version: unknown;
  routines: unknown[];
  sessions: unknown[];
  sets: unknown[];
}

function isBackupContainerShape(value: unknown): value is BackupContainerShape {
  if (!isRecord(value)) return false;
  return (
    'app' in value &&
    'version' in value &&
    Array.isArray(value.routines) &&
    Array.isArray(value.sessions) &&
    Array.isArray(value.sets)
  );
}

/**
 * Valida y aplica un respaldo. ADITIVO/merge: nunca borra datos
 * existentes. Si el shape, la app o la versión no son válidos, o si
 * cualquier fila individual no encaja, no escribe nada y devuelve un
 * error legible.
 */
export async function importBackup(json: unknown): Promise<ImportResult> {
  if (!isBackupContainerShape(json)) {
    return { ok: false, error: 'El archivo no tiene el formato de respaldo de CARGA.' };
  }
  if (json.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Este archivo no es un respaldo de CARGA.' };
  }
  if (json.version !== BACKUP_VERSION) {
    return { ok: false, error: `Versión de respaldo no soportada (${String(json.version)}).` };
  }

  const routines = json.routines.filter(isRoutineShape);
  const sessions = json.sessions.filter(isWorkoutSessionShape);
  const sets = json.sets.filter(isSessionSetShape);

  if (
    routines.length !== json.routines.length ||
    sessions.length !== json.sessions.length ||
    sets.length !== json.sets.length
  ) {
    return { ok: false, error: 'El respaldo contiene filas con formato inesperado; no se ha importado nada.' };
  }

  // Rutinas: save() ya es upsert por id (comportamiento preexistente, sin cambios).
  for (const routine of routines) {
    await routinesRepo.save(routine);
  }

  // Sesiones y series: solo se insertan si el id no existe ya (idempotente, no destructivo).
  let sessionsImported = 0;
  for (const session of sessions) {
    const inserted = await sessionsRepo.addSessionIfNotExists(session);
    if (inserted) {
      sessionsImported += 1;
    }
  }

  let setsImported = 0;
  for (const set of sets) {
    const inserted = await sessionsRepo.addSetIfNotExists(set);
    if (inserted) {
      setsImported += 1;
    }
  }

  return { ok: true, routinesImported: routines.length, sessionsImported, setsImported };
}
