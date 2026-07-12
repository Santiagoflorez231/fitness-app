/**
 * Contratos de la capa de persistencia. Los componentes SOLO consumen estas
 * interfaces (vía los factories de src/db/index.ts), nunca el storage directo.
 *
 * Fase 2: implementación provisional sobre localStorage (src/db/local.ts).
 * Fase 3: implementación definitiva sobre SQLite (@capacitor-community/sqlite)
 * según docs/persistence-schema.md, con migración de los datos provisionales.
 */

import type { Routine, SessionSet, WorkoutSession } from '../types/routine';

export interface RoutinesRepo {
  /** Rutinas no archivadas, ordenadas por position ascendente. */
  list(): Promise<Routine[]>;
  get(id: string): Promise<Routine | null>;
  /** Upsert completo (rutina + sus ejercicios). */
  save(routine: Routine): Promise<void>;
  /** Soft-delete: marca archived=true; el historial de sesiones se conserva. */
  archive(id: string): Promise<void>;
  /**
   * Todas las rutinas, incluidas las archivadas (para respaldo/export,
   * src/db/backup.ts). Método ADITIVO: no reemplaza a list(), que sigue
   * devolviendo solo las activas.
   */
  listAll(): Promise<Routine[]>;
}

export interface ActiveSession {
  session: WorkoutSession;
  sets: SessionSet[];
}

export interface SessionsRepo {
  /** Crea la sesión con finishedAt=null. Falla si ya hay una sesión activa. */
  start(session: WorkoutSession): Promise<void>;
  /**
   * Persiste una serie individual en el momento de marcarla (nunca acumular
   * en memoria hasta el final: si la app muere no se pierde lo ya hecho).
   */
  addSet(set: SessionSet): Promise<void>;
  finish(sessionId: string, finishedAt: number, notes?: string): Promise<void>;
  /** Sesión con finishedAt=null junto a sus series, si existe. */
  getActive(): Promise<ActiveSession | null>;
  /** Sesiones terminadas, más recientes primero. */
  listFinished(limit?: number): Promise<WorkoutSession[]>;
  getSets(sessionId: string): Promise<SessionSet[]>;
  /** Historial de series de un ejercicio (para PRs/progreso), ascendente por fecha. */
  listSetsByExercise(exerciseId: string): Promise<SessionSet[]>;
  /**
   * Inserta la sesión SOLO si su id no existe ya (idempotente, `INSERT OR
   * IGNORE`). Para importar respaldos sin pisar datos existentes
   * (src/db/backup.ts) — método ADITIVO, no reemplaza a `start()`, que
   * sigue siendo el único punto de entrada para arrancar un entrenamiento
   * real (valida "una sola sesión activa"). Devuelve true si insertó una
   * fila nueva, false si el id ya existía.
   */
  addSessionIfNotExists(session: WorkoutSession): Promise<boolean>;
  /** Igual que addSessionIfNotExists, pero para una serie (session_sets). */
  addSetIfNotExists(set: SessionSet): Promise<boolean>;
}
