/**
 * Implementación provisional de la capa de persistencia sobre localStorage.
 * Cumple los contratos de ./repos.ts. Las operaciones son síncronas por
 * dentro pero se exponen como async a propósito: en Fase 3 se sustituirán
 * por una implementación sobre SQLite sin que los componentes cambien.
 */

import type { RoutinesRepo, SessionsRepo, ActiveSession } from './repos';
import type { Routine, SessionSet, WorkoutSession } from '../types/routine';

const ROUTINES_KEY = 'fitness.routines';
const SESSIONS_KEY = 'fitness.sessions';
const SETS_KEY = 'fitness.sets';

/** Lee y parsea un array desde localStorage; ante JSON corrupto o valor que
 * no sea un array, avisa por consola y lo trata como vacío (no lanza). */
function readArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[db/local] El valor guardado en "${key}" no es un array; se trata como vacío.`);
      return [];
    }
    return parsed as T[];
  } catch (error) {
    console.warn(`[db/local] JSON corrupto en "${key}"; se trata como vacío.`, error);
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function readRoutines(): Routine[] {
  return readArray<Routine>(ROUTINES_KEY);
}

function writeRoutines(routines: Routine[]): void {
  writeArray(ROUTINES_KEY, routines);
}

function readSessions(): WorkoutSession[] {
  return readArray<WorkoutSession>(SESSIONS_KEY);
}

function writeSessions(sessions: WorkoutSession[]): void {
  writeArray(SESSIONS_KEY, sessions);
}

function readSets(): SessionSet[] {
  return readArray<SessionSet>(SETS_KEY);
}

function writeSets(sets: SessionSet[]): void {
  writeArray(SETS_KEY, sets);
}

export class LocalRoutinesRepo implements RoutinesRepo {
  async list(): Promise<Routine[]> {
    return readRoutines()
      .filter((routine) => !routine.archived)
      .sort((a, b) => a.position - b.position);
  }

  async get(id: string): Promise<Routine | null> {
    const routine = readRoutines().find((item) => item.id === id);
    return routine ?? null;
  }

  async save(routine: Routine): Promise<void> {
    const routines = readRoutines();
    const index = routines.findIndex((item) => item.id === routine.id);
    if (index >= 0) {
      routines[index] = routine;
    } else {
      routines.push(routine);
    }
    writeRoutines(routines);
  }

  async archive(id: string): Promise<void> {
    const routines = readRoutines();
    const index = routines.findIndex((item) => item.id === id);
    if (index < 0) {
      return;
    }
    routines[index] = { ...routines[index], archived: true };
    writeRoutines(routines);
  }

  /** Todas las rutinas (activas + archivadas), para respaldo/export. Implementación retirada (ver cabecera del archivo), solo por compatibilidad de tipos con RoutinesRepo. */
  async listAll(): Promise<Routine[]> {
    return readRoutines().sort((a, b) => a.position - b.position);
  }
}

export class LocalSessionsRepo implements SessionsRepo {
  async start(session: WorkoutSession): Promise<void> {
    const sessions = readSessions();
    const active = sessions.find((item) => item.finishedAt === null);
    if (active) {
      throw new Error('Ya hay una sesión activa');
    }
    sessions.push(session);
    writeSessions(sessions);
  }

  async addSet(set: SessionSet): Promise<void> {
    const sets = readSets();
    sets.push(set);
    writeSets(sets);
  }

  async finish(sessionId: string, finishedAt: number, notes?: string): Promise<void> {
    const sessions = readSessions();
    const index = sessions.findIndex((item) => item.id === sessionId);
    if (index < 0) {
      return;
    }
    sessions[index] = {
      ...sessions[index],
      finishedAt,
      notes: notes ?? sessions[index].notes,
    };
    writeSessions(sessions);
  }

  async getActive(): Promise<ActiveSession | null> {
    const session = readSessions().find((item) => item.finishedAt === null);
    if (!session) {
      return null;
    }
    const sets = readSets().filter((set) => set.sessionId === session.id);
    return { session, sets };
  }

  async listFinished(limit?: number): Promise<WorkoutSession[]> {
    const finished = readSessions()
      .filter((item) => item.finishedAt !== null)
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
    return limit !== undefined ? finished.slice(0, limit) : finished;
  }

  async getSets(sessionId: string): Promise<SessionSet[]> {
    return readSets().filter((set) => set.sessionId === sessionId);
  }

  async listSetsByExercise(exerciseId: string): Promise<SessionSet[]> {
    return readSets()
      .filter((set) => set.exerciseId === exerciseId)
      .sort((a, b) => a.completedAt - b.completedAt);
  }

  /** Insert-if-not-exists para respaldo/import. Implementación retirada (ver cabecera del archivo), solo por compatibilidad de tipos con SessionsRepo. */
  async addSessionIfNotExists(session: WorkoutSession): Promise<boolean> {
    const sessions = readSessions();
    if (sessions.some((item) => item.id === session.id)) {
      return false;
    }
    sessions.push(session);
    writeSessions(sessions);
    return true;
  }

  /** Igual que addSessionIfNotExists, para una serie. */
  async addSetIfNotExists(set: SessionSet): Promise<boolean> {
    const sets = readSets();
    if (sets.some((item) => item.id === set.id)) {
      return false;
    }
    sets.push(set);
    writeSets(sets);
    return true;
  }
}
