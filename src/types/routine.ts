/**
 * Tipos de dominio para rutinas y sesiones de entrenamiento.
 * Alineados con docs/persistence-schema.md (fuente de verdad del modelo).
 * Pesos siempre en kg; timestamps en epoch ms UTC.
 */

export interface RoutineExercise {
  id: string; // uuid
  exerciseId: string; // id del dataset estático (ej. "0001")
  exerciseName: string; // snapshot: sobrevive a cambios del dataset
  position: number;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
  notes?: string;
}

export interface Routine {
  id: string; // uuid
  name: string;
  position: number;
  archived: boolean; // soft-delete: conserva el historial asociado
  createdAt: number;
  exercises: RoutineExercise[];
}

export interface WorkoutSession {
  id: string; // uuid
  routineId: string | null; // null si la rutina origen fue borrada
  routineName: string; // snapshot
  startedAt: number;
  finishedAt: number | null; // null = en curso (o abandonada)
  notes?: string;
}

export interface SessionSet {
  id: string; // uuid
  sessionId: string;
  exerciseId: string;
  exerciseName: string; // snapshot
  setNumber: number; // 1-based dentro del ejercicio en esa sesión
  weightKg: number; // 0 = peso corporal
  reps: number;
  rpe?: number; // 1..10 en pasos de 0.5
  completedAt: number;
  /** Referencia a RoutineExercise.id: identifica a qué bloque de la rutina
   * pertenece esta serie, para no colisionar cuando la rutina repite el
   * mismo ejercicio en dos bloques distintos. Ausente en filas legacy
   * (anteriores a la migración v2) y en series huérfanas. */
  routineExerciseId?: string;
}
