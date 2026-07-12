/**
 * Implementación definitiva de la capa de persistencia sobre SQLite
 * (`@capacitor-community/sqlite`), según el esquema y las reglas de
 * docs/persistence-schema.md. Cumple los contratos de ./repos.ts.
 *
 * En web (dev y PWA) el plugin se apoya en `jeep-sqlite` (sql.js +
 * IndexedDB): src/main.tsx registra el custom element, lo añade al DOM y
 * llama a `sqlite.initWebStore()` ANTES de montar <App/>. Este módulo asume
 * que, en plataforma web, ese bootstrap ya ocurrió quando `ensureReady()` se
 * invoca por primera vez (siempre después de que React empieza a renderizar).
 *
 * Migración de datos: ver `migrateFromLocalStorage()` más abajo — decisión
 * documentada en el reporte de la Fase 3, no en `schema_migrations` (esa
 * tabla es sólo para versiones de esquema/DDL).
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SQLiteDBConnection, capSQLiteSet } from '@capacitor-community/sqlite';

import type { ActiveSession, RoutinesRepo, SessionsRepo } from './repos';
import type { Routine, RoutineExercise, SessionSet, WorkoutSession } from '../types/routine';

const DB_NAME = 'fitness-db';

/** Instancia única compartida con src/main.tsx (que llama a initWebStore()). */
export const sqlite = new SQLiteConnection(CapacitorSQLite);

// ---------------------------------------------------------------------------
// Init perezoso y memoizado
// ---------------------------------------------------------------------------

let readyPromise: Promise<SQLiteDBConnection> | null = null;

/** Devuelve la conexión lista para usar; crea/abre y migra sólo la primera vez. */
function getDb(): Promise<SQLiteDBConnection> {
  if (!readyPromise) {
    readyPromise = initDb().catch((error: unknown) => {
      // Si el init falla, no queremos memoizar una promesa rota para siempre.
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function initDb(): Promise<SQLiteDBConnection> {
  const alreadyOpenAsConnection = (await sqlite.isConnection(DB_NAME, false)).result === true;
  const db = alreadyOpenAsConnection
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

  await db.open();
  // PRAGMA fuera de transacción: aplica por conexión, no persiste en el esquema.
  await db.execute('PRAGMA foreign_keys = ON;', false);

  await applySchemaMigrations(db);
  await migrateFromLocalStorage(db);

  return db;
}

/** Tras cada escritura en web hay que persistir explícitamente a IndexedDB
 * (jeep-sqlite también tiene autoSave, pero el README recomienda esto como
 * respaldo explícito). En Android/iOS/Electron es un no-op. */
async function persistWebStore(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    await sqlite.saveToStore(DB_NAME);
  }
}

// ---------------------------------------------------------------------------
// Esquema (schema_migrations) — fuente de verdad: docs/persistence-schema.md
// ---------------------------------------------------------------------------

interface SchemaMigration {
  version: number;
  sql: string;
}

const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS routines (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        position    INTEGER NOT NULL DEFAULT 0,
        archived    INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routine_exercises (
        id                  TEXT PRIMARY KEY,
        routine_id          TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        exercise_id         TEXT NOT NULL,
        exercise_name       TEXT NOT NULL,
        position            INTEGER NOT NULL,
        target_sets         INTEGER NOT NULL,
        target_reps         INTEGER NOT NULL,
        rest_seconds        INTEGER NOT NULL DEFAULT 90,
        notes               TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id            TEXT PRIMARY KEY,
        routine_id    TEXT,
        routine_name  TEXT NOT NULL,
        started_at    INTEGER NOT NULL,
        finished_at   INTEGER,
        notes         TEXT
      );

      CREATE TABLE IF NOT EXISTS session_sets (
        id             TEXT PRIMARY KEY,
        session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        exercise_id    TEXT NOT NULL,
        exercise_name  TEXT NOT NULL,
        set_number     INTEGER NOT NULL,
        weight_kg      REAL NOT NULL DEFAULT 0,
        reps           INTEGER NOT NULL,
        rpe            REAL,
        completed_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sets_exercise ON session_sets(exercise_id, completed_at);
      CREATE INDEX IF NOT EXISTS idx_sets_session  ON session_sets(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(started_at);

      CREATE TABLE IF NOT EXISTS settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE session_sets ADD COLUMN routine_exercise_id TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active
        ON sessions(finished_at) WHERE finished_at IS NULL;
    `,
  },
];

async function applySchemaMigrations(db: SQLiteDBConnection): Promise<void> {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);', false);
  const appliedRows = await queryRows<{ version: number }>(db, 'SELECT version FROM schema_migrations;');
  const applied = new Set(appliedRows.map((row) => row.version));

  for (const migration of SCHEMA_MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }
    // execute() con transaction=true (default) aplica todo el bloque de forma
    // atómica: si algo falla, no queda una migración a medias.
    await db.execute(`${migration.sql}\nINSERT INTO schema_migrations (version) VALUES (${migration.version});`);
  }
}

// ---------------------------------------------------------------------------
// Helpers de bajo nivel: query tipada y SQL de upsert reutilizado
// ---------------------------------------------------------------------------

type SqlValue = string | number | null;

/** query() de la librería devuelve `values?: any[]`; este es el único punto
 * del módulo donde se cruza esa frontera sin tipos hacia una forma conocida. */
async function queryRows<T>(db: SQLiteDBConnection, statement: string, values: SqlValue[] = []): Promise<T[]> {
  const result = await db.query(statement, values);
  const rows = result.values as T[] | undefined;
  return rows ?? [];
}

const ROUTINE_UPSERT_SQL = `
  INSERT INTO routines (id, name, position, archived, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    position = excluded.position,
    archived = excluded.archived,
    created_at = excluded.created_at;
`;

const ROUTINE_EXERCISE_UPSERT_SQL = `
  INSERT INTO routine_exercises
    (id, routine_id, exercise_id, exercise_name, position, target_sets, target_reps, rest_seconds, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    routine_id = excluded.routine_id,
    exercise_id = excluded.exercise_id,
    exercise_name = excluded.exercise_name,
    position = excluded.position,
    target_sets = excluded.target_sets,
    target_reps = excluded.target_reps,
    rest_seconds = excluded.rest_seconds,
    notes = excluded.notes;
`;

const SESSION_UPSERT_SQL = `
  INSERT INTO sessions (id, routine_id, routine_name, started_at, finished_at, notes)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    routine_id = excluded.routine_id,
    routine_name = excluded.routine_name,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    notes = excluded.notes;
`;

const SESSION_SET_UPSERT_SQL = `
  INSERT INTO session_sets
    (id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, rpe, completed_at, routine_exercise_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    session_id = excluded.session_id,
    exercise_id = excluded.exercise_id,
    exercise_name = excluded.exercise_name,
    set_number = excluded.set_number,
    weight_kg = excluded.weight_kg,
    reps = excluded.reps,
    rpe = excluded.rpe,
    completed_at = excluded.completed_at,
    routine_exercise_id = excluded.routine_exercise_id;
`;

// --- Respaldo (src/db/backup.ts): insert-if-not-exists, ADITIVO -----------
// A diferencia de los *_UPSERT_SQL de arriba (que pisan filas existentes,
// usados por el flujo normal de la app), importar un respaldo NUNCA debe
// sobrescribir una sesión/serie que ya esté guardada localmente. `INSERT OR
// IGNORE` no toca la fila si el id (PRIMARY KEY) ya existe.
const SESSION_INSERT_IGNORE_SQL = `
  INSERT OR IGNORE INTO sessions (id, routine_id, routine_name, started_at, finished_at, notes)
  VALUES (?, ?, ?, ?, ?, ?);
`;

const SESSION_SET_INSERT_IGNORE_SQL = `
  INSERT OR IGNORE INTO session_sets
    (id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, rpe, completed_at, routine_exercise_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

// ---------------------------------------------------------------------------
// Mapeos dominio <-> fila (camelCase <-> snake_case)
// ---------------------------------------------------------------------------

interface RoutineRow {
  id: string;
  name: string;
  position: number;
  archived: number;
  created_at: number;
}

interface RoutineExerciseRow {
  id: string;
  routine_id: string;
  exercise_id: string;
  exercise_name: string;
  position: number;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
  notes: string | null;
}

interface SessionRow {
  id: string;
  routine_id: string | null;
  routine_name: string;
  started_at: number;
  finished_at: number | null;
  notes: string | null;
}

interface SessionSetRow {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  completed_at: number;
  routine_exercise_id: string | null;
}

function routineToParams(r: Routine): SqlValue[] {
  return [r.id, r.name, r.position, r.archived ? 1 : 0, r.createdAt];
}

function routineExerciseToParams(re: RoutineExercise, routineId: string): SqlValue[] {
  return [re.id, routineId, re.exerciseId, re.exerciseName, re.position, re.targetSets, re.targetReps, re.restSeconds, re.notes ?? null];
}

function sessionToParams(s: WorkoutSession): SqlValue[] {
  return [s.id, s.routineId, s.routineName, s.startedAt, s.finishedAt, s.notes ?? null];
}

function sessionSetToParams(s: SessionSet): SqlValue[] {
  return [
    s.id,
    s.sessionId,
    s.exerciseId,
    s.exerciseName,
    s.setNumber,
    s.weightKg,
    s.reps,
    s.rpe ?? null,
    s.completedAt,
    s.routineExerciseId ?? null,
  ];
}

function routineRowToDomain(row: RoutineRow, exercises: RoutineExercise[]): Routine {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    archived: row.archived === 1,
    createdAt: row.created_at,
    exercises,
  };
}

function routineExerciseRowToDomain(row: RoutineExerciseRow): RoutineExercise {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    position: row.position,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    restSeconds: row.rest_seconds,
    notes: row.notes ?? undefined,
  };
}

function sessionRowToDomain(row: SessionRow): WorkoutSession {
  return {
    id: row.id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    notes: row.notes ?? undefined,
  };
}

function sessionSetRowToDomain(row: SessionSetRow): SessionSet {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    rpe: row.rpe ?? undefined,
    completedAt: row.completed_at,
    routineExerciseId: row.routine_exercise_id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Migración de datos desde localStorage (Fase 2 -> Fase 3)
// ---------------------------------------------------------------------------

const LOCAL_ROUTINES_KEY = 'fitness.routines';
const LOCAL_SESSIONS_KEY = 'fitness.sessions';
const LOCAL_SETS_KEY = 'fitness.sets';
const MIGRATED_SUFFIX = '.migrated';

/** Lee un array crudo de localStorage sin validar el contenido de cada
 * elemento (eso lo hace cada validador de fila más abajo). Ante JSON
 * corrupto o un valor que no sea array, avisa y trata como vacío. */
function readRawArray(key: string): unknown[] {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[db/sqlite] El valor guardado en "${key}" no es un array; se omite la migración de esta clave.`);
      return [];
    }
    return parsed;
  } catch (error) {
    console.warn(`[db/sqlite] JSON corrupto en "${key}"; se omite la migración de esta clave.`, error);
    return [];
  }
}

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

/**
 * Si localStorage tiene datos de la implementación provisional (Fase 2), los
 * importa a SQLite respetando los ids existentes y renombra las claves para
 * no volver a importarlos ni perder el respaldo. Filas individuales
 * malformadas se saltan con console.warn (no abortan la migración).
 *
 * Decisión (reportada, no en schema_migrations): esto es una migración de
 * DATOS de un origen externo (localStorage), no un cambio de esquema/DDL, así
 * que se controla con el propio renombrado de claves como guarda de
 * idempotencia, no con una entrada de versión en schema_migrations.
 */
async function migrateFromLocalStorage(db: SQLiteDBConnection): Promise<void> {
  const rawRoutines = readRawArray(LOCAL_ROUTINES_KEY);
  const rawSessions = readRawArray(LOCAL_SESSIONS_KEY);
  const rawSets = readRawArray(LOCAL_SETS_KEY);

  if (rawRoutines.length === 0 && rawSessions.length === 0 && rawSets.length === 0) {
    return;
  }

  const set: capSQLiteSet[] = [];

  for (const raw of rawRoutines) {
    if (!isRoutineShape(raw)) {
      console.warn('[db/sqlite] Rutina malformada omitida durante la migración.', raw);
      continue;
    }
    set.push({ statement: ROUTINE_UPSERT_SQL, values: routineToParams(raw) });
    for (const exercise of raw.exercises) {
      set.push({ statement: ROUTINE_EXERCISE_UPSERT_SQL, values: routineExerciseToParams(exercise, raw.id) });
    }
  }

  // Ids de las sesiones que sí se van a insertar: una serie cuyo sessionId no
  // esté aquí violaría la FK de session_sets.session_id y haría rollback de
  // TODA la migración (executeSet corre en una única transacción), que se
  // reintentaría y volvería a fallar en cada arranque. Se salta con warning
  // en vez de abortar.
  const acceptedSessionIds = new Set<string>();

  for (const raw of rawSessions) {
    if (!isWorkoutSessionShape(raw)) {
      console.warn('[db/sqlite] Sesión malformada omitida durante la migración.', raw);
      continue;
    }
    set.push({ statement: SESSION_UPSERT_SQL, values: sessionToParams(raw) });
    acceptedSessionIds.add(raw.id);
  }

  for (const raw of rawSets) {
    if (!isSessionSetShape(raw)) {
      console.warn('[db/sqlite] Serie malformada omitida durante la migración.', raw);
      continue;
    }
    if (!acceptedSessionIds.has(raw.sessionId)) {
      console.warn(
        '[db/sqlite] Serie huérfana omitida durante la migración (sessionId no corresponde a ninguna sesión aceptada).',
        raw,
      );
      continue;
    }
    set.push({ statement: SESSION_SET_UPSERT_SQL, values: sessionSetToParams(raw) });
  }

  if (set.length > 0) {
    await db.executeSet(set, true);
    await persistWebStore();
  }

  renameLocalStorageKey(LOCAL_ROUTINES_KEY);
  renameLocalStorageKey(LOCAL_SESSIONS_KEY);
  renameLocalStorageKey(LOCAL_SETS_KEY);
}

function renameLocalStorageKey(key: string): void {
  const value = localStorage.getItem(key);
  if (value === null) {
    return;
  }
  localStorage.setItem(`${key}${MIGRATED_SUFFIX}`, value);
  localStorage.removeItem(key);
}

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

export class SQLiteRoutinesRepo implements RoutinesRepo {
  async list(): Promise<Routine[]> {
    const db = await getDb();
    const routineRows = await queryRows<RoutineRow>(db, 'SELECT * FROM routines WHERE archived = 0 ORDER BY position ASC;');
    return this.attachExercises(db, routineRows);
  }

  async get(id: string): Promise<Routine | null> {
    const db = await getDb();
    const rows = await queryRows<RoutineRow>(db, 'SELECT * FROM routines WHERE id = ?;', [id]);
    if (rows.length === 0) {
      return null;
    }
    const [routine] = await this.attachExercises(db, rows);
    return routine;
  }

  /** Todas las rutinas (activas + archivadas), para respaldo/export (src/db/backup.ts). */
  async listAll(): Promise<Routine[]> {
    const db = await getDb();
    const routineRows = await queryRows<RoutineRow>(db, 'SELECT * FROM routines ORDER BY position ASC;');
    return this.attachExercises(db, routineRows);
  }

  private async attachExercises(db: SQLiteDBConnection, routineRows: RoutineRow[]): Promise<Routine[]> {
    if (routineRows.length === 0) {
      return [];
    }
    const ids = routineRows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    const exerciseRows = await queryRows<RoutineExerciseRow>(
      db,
      `SELECT * FROM routine_exercises WHERE routine_id IN (${placeholders}) ORDER BY position ASC;`,
      ids
    );
    const exercisesByRoutine = new Map<string, RoutineExercise[]>();
    for (const row of exerciseRows) {
      const list = exercisesByRoutine.get(row.routine_id) ?? [];
      list.push(routineExerciseRowToDomain(row));
      exercisesByRoutine.set(row.routine_id, list);
    }
    return routineRows.map((row) => routineRowToDomain(row, exercisesByRoutine.get(row.id) ?? []));
  }

  async save(routine: Routine): Promise<void> {
    const db = await getDb();
    const set: capSQLiteSet[] = [
      { statement: ROUTINE_UPSERT_SQL, values: routineToParams(routine) },
      { statement: 'DELETE FROM routine_exercises WHERE routine_id = ?;', values: [routine.id] },
    ];
    if (routine.exercises.length > 0) {
      set.push({
        statement: ROUTINE_EXERCISE_UPSERT_SQL,
        values: routine.exercises.map((exercise) => routineExerciseToParams(exercise, routine.id)),
      });
    }
    await db.executeSet(set, true);
    await persistWebStore();
  }

  async archive(id: string): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE routines SET archived = 1 WHERE id = ?;', [id]);
    await persistWebStore();
  }
}

export class SQLiteSessionsRepo implements SessionsRepo {
  async start(session: WorkoutSession): Promise<void> {
    const db = await getDb();
    const activeRows = await queryRows<{ id: string }>(db, 'SELECT id FROM sessions WHERE finished_at IS NULL LIMIT 1;');
    if (activeRows.length > 0) {
      throw new Error('Ya hay una sesión activa');
    }
    await db.run(SESSION_UPSERT_SQL, sessionToParams(session));
    await persistWebStore();
  }

  async addSet(set: SessionSet): Promise<void> {
    const db = await getDb();
    await db.run(SESSION_SET_UPSERT_SQL, sessionSetToParams(set));
    await persistWebStore();
  }

  async finish(sessionId: string, finishedAt: number, notes?: string): Promise<void> {
    const db = await getDb();
    if (notes !== undefined) {
      await db.run('UPDATE sessions SET finished_at = ?, notes = ? WHERE id = ?;', [finishedAt, notes, sessionId]);
    } else {
      await db.run('UPDATE sessions SET finished_at = ? WHERE id = ?;', [finishedAt, sessionId]);
    }
    await persistWebStore();
  }

  async getActive(): Promise<ActiveSession | null> {
    const db = await getDb();
    const rows = await queryRows<SessionRow>(db, 'SELECT * FROM sessions WHERE finished_at IS NULL LIMIT 1;');
    if (rows.length === 0) {
      return null;
    }
    const session = sessionRowToDomain(rows[0]);
    const sets = await this.getSets(session.id);
    return { session, sets };
  }

  async listFinished(limit?: number): Promise<WorkoutSession[]> {
    const db = await getDb();
    const statement =
      limit !== undefined
        ? 'SELECT * FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?;'
        : 'SELECT * FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC;';
    const values: SqlValue[] = limit !== undefined ? [limit] : [];
    const rows = await queryRows<SessionRow>(db, statement, values);
    return rows.map(sessionRowToDomain);
  }

  async getSets(sessionId: string): Promise<SessionSet[]> {
    const db = await getDb();
    const rows = await queryRows<SessionSetRow>(
      db,
      'SELECT * FROM session_sets WHERE session_id = ? ORDER BY completed_at ASC;',
      [sessionId]
    );
    return rows.map(sessionSetRowToDomain);
  }

  async listSetsByExercise(exerciseId: string): Promise<SessionSet[]> {
    const db = await getDb();
    const rows = await queryRows<SessionSetRow>(
      db,
      'SELECT * FROM session_sets WHERE exercise_id = ? ORDER BY completed_at ASC;',
      [exerciseId]
    );
    return rows.map(sessionSetRowToDomain);
  }

  /**
   * ADITIVO — solo para src/db/backup.ts (importar respaldo). Inserta la
   * sesión únicamente si su id no existe ya; nunca pisa una fila existente
   * (a diferencia de start(), que además valida "una sola sesión activa" y
   * es el único camino para arrancar un entrenamiento real).
   */
  async addSessionIfNotExists(session: WorkoutSession): Promise<boolean> {
    const db = await getDb();
    const result = await db.run(SESSION_INSERT_IGNORE_SQL, sessionToParams(session));
    await persistWebStore();
    return (result.changes?.changes ?? 0) > 0;
  }

  /** ADITIVO — igual que addSessionIfNotExists, para una serie (session_sets). */
  async addSetIfNotExists(set: SessionSet): Promise<boolean> {
    const db = await getDb();
    const result = await db.run(SESSION_SET_INSERT_IGNORE_SQL, sessionSetToParams(set));
    await persistWebStore();
    return (result.changes?.changes ?? 0) > 0;
  }
}
