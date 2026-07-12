/**
 * Contrato `CoachAdvisor` y tipos de entrada/salida (docs/roadmap-avanzado.md,
 * "Principio rector: la IA como capa intercambiable" + Bloque A). Hoy solo
 * existe `LocalCoachAdvisor` (fórmulas locales, ver `localCoach.ts`); el
 * día que haya una versión LLM implementará el mismo `CoachAdvisor` sin
 * tocar UI ni datos.
 *
 * Punto único de reexport de los tipos de volumen (A3) para que el resto de
 * la app importe todo el coach desde `src/coach`.
 */
import type { ExerciseCategoryCatalog, FamilyVolume, Familia } from './volume';

export type { ExerciseCategoryCatalog, FamilyVolume, Familia };

// ---------------------------------------------------------------------------
// A1 — Sugerencia de carga por RPE/RIR
// ---------------------------------------------------------------------------

/** Última serie realmente ejecutada, base para estimar el e1RM. */
export interface LastSetPerformed {
  weightKg: number;
  reps: number;
  /** RPE 1..10 en pasos de 0.5, si se registró (session_sets.rpe). */
  rpe?: number;
}

/** Serie histórica mínima usada como fallback cuando no hay RPE (media de e1RM). */
export interface RecentSetSample {
  weightKg: number;
  reps: number;
}

export interface SetContext {
  /** Última serie del ejercicio, o `null` si aún no hay ninguna registrada. */
  lastSet: LastSetPerformed | null;
  /** Repeticiones objetivo de la siguiente serie. */
  targetReps: number;
  /** RPE objetivo de la siguiente serie (1..10); se convierte a RIR internamente. */
  targetRpe: number;
  /**
   * Series recientes del mismo ejercicio (sin incluir `lastSet`), más
   * antigua primero, usadas solo como fallback (`basis: 'e1rm-history'`)
   * cuando `lastSet.rpe` es `undefined`.
   */
  recentSets?: RecentSetSample[];
  /** Incremento de redondeo del equipo en kg (barra 2.5 / mancuerna 2, configurable en ajustes). Por defecto 2.5. */
  roundingIncrementKg?: number;
}

export interface LoadSuggestion {
  weightKg: number;
  basis: 'rpe' | 'e1rm-history';
  note: string;
}

// ---------------------------------------------------------------------------
// A2 — Detección de estancamiento / deload
// ---------------------------------------------------------------------------

/** Una serie completada de un ejercicio, tal como sale de `session_sets`. */
export interface ExerciseHistorySample {
  sessionId: string;
  weightKg: number;
  reps: number;
  completedAt: number;
}

/** Historial de series de un ejercicio, ascendente por fecha (puede mezclar varias sesiones). */
export type ExerciseHistory = ExerciseHistorySample[];

export interface ProgressVerdict {
  state: 'progress' | 'plateau' | 'regress';
  message: string;
}

// ---------------------------------------------------------------------------
// Contrato unificado
// ---------------------------------------------------------------------------

export interface CoachAdvisor {
  /** Sugerencia de carga para la próxima serie a partir del RPE reportado (A1). */
  suggestNextLoad(input: SetContext): LoadSuggestion | null;
  /** Diagnóstico de progreso por ejercicio: estancamiento / deload (A2). */
  assessProgress(exerciseId: string, history: ExerciseHistory): ProgressVerdict;
  /**
   * Balance de volumen semanal por familia muscular (A3). Envuelve
   * `weeklyVolumeBalance` de `./volume` (no se reimplementa); la firma
   * coincide con la de esa función, que es la ya consumida por Progreso (R4).
   */
  volumeBalance(setsThisWeek: { exerciseId: string }[], catalog: ExerciseCategoryCatalog): FamilyVolume[];
}
