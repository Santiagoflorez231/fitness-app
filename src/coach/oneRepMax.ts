/**
 * Cálculo de 1RM estimado (e1RM) y tabla RIR -> %1RM objetivo.
 * Fuente única para el resto de `src/coach/`. `Progreso.tsx` y
 * `ExerciseHistorySheet.tsx` mantienen sus propias copias locales del Epley
 * (no se tocan en esta tarea); podrían migrarse a este módulo más adelante
 * sin cambiar el resultado, ya que usan la misma fórmula y el mismo
 * redondeo a 1 decimal.
 *
 * docs/roadmap-avanzado.md, Bloque A, sección A1.
 */

/**
 * 1RM estimado con la fórmula de Epley, redondeado a 1 decimal (kg).
 * `estimateE1rm(100, 5) === 116.7`.
 */
export function estimateE1rm(weightKg: number, reps: number): number {
  const value = weightKg * (1 + reps / 30);
  return Math.round(value * 10) / 10;
}

/**
 * Tabla RIR -> %1RM (docs/roadmap-avanzado.md, A1). Valores heurísticos
 * tipo Helms/RTS, pensados para ajustarse con el tiempo; NO son una
 * verdad fisiológica exacta. Filas = repeticiones objetivo, columnas =
 * RIR objetivo (Reps In Reserve = 10 - RPE).
 */
const REPS_BREAKPOINTS = [1, 3, 5, 8, 10, 12] as const;
const RIR_BREAKPOINTS = [0, 1, 2, 3, 4] as const;

// PERCENT_1RM_TABLE[i][j] = %1RM para REPS_BREAKPOINTS[i] reps a RIR_BREAKPOINTS[j].
const PERCENT_1RM_TABLE: readonly (readonly number[])[] = [
  [100, 96, 92, 89, 86], // 1 rep
  [93, 90, 87, 84, 81], // 3 reps
  [87, 85, 82, 79, 76], // 5 reps
  [79, 77, 75, 72, 69], // 8 reps
  [74, 72, 70, 68, 65], // 10 reps
  [70, 68, 66, 64, 61], // 12 reps
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Posición de `value` entre dos puntos consecutivos de `breakpoints` (ya ordenados ascendente). */
function bracket(breakpoints: readonly number[], value: number): { loIndex: number; hiIndex: number; t: number } {
  const clamped = clamp(value, breakpoints[0], breakpoints[breakpoints.length - 1]);
  for (let i = 0; i < breakpoints.length - 1; i += 1) {
    const lo = breakpoints[i];
    const hi = breakpoints[i + 1];
    if (clamped >= lo && clamped <= hi) {
      const t = hi === lo ? 0 : (clamped - lo) / (hi - lo);
      return { loIndex: i, hiIndex: i + 1, t };
    }
  }
  // Inalcanzable dado el clamp previo, pero TS necesita un retorno exhaustivo.
  const lastIndex = breakpoints.length - 1;
  return { loIndex: lastIndex, hiIndex: lastIndex, t: 0 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * RIR (Reps In Reserve) a partir del RPE reportado (1..10, pasos de 0.5).
 * RIR = 10 - RPE. No se clampa aquí; lo hace `percent1RmForRepsAndRir`.
 */
export function rirFromRpe(rpe: number): number {
  return 10 - rpe;
}

/**
 * %1RM objetivo (0-100) para unas repeticiones y un RIR dados, interpolando
 * linealmente en ambos ejes de la tabla RIR -> %1RM. Reps y RIR fuera del
 * rango de la tabla (1-12 reps, 0-4 RIR) se clampan a los extremos.
 */
export function percent1RmForRepsAndRir(reps: number, rir: number): number {
  const repsBracket = bracket(REPS_BREAKPOINTS, reps);
  const rirBracket = bracket(RIR_BREAKPOINTS, rir);

  const rowLo = PERCENT_1RM_TABLE[repsBracket.loIndex];
  const rowHi = PERCENT_1RM_TABLE[repsBracket.hiIndex];

  const valueAtLoReps = lerp(rowLo[rirBracket.loIndex], rowLo[rirBracket.hiIndex], rirBracket.t);
  const valueAtHiReps = lerp(rowHi[rirBracket.loIndex], rowHi[rirBracket.hiIndex], rirBracket.t);

  return lerp(valueAtLoReps, valueAtHiReps, repsBracket.t);
}

/**
 * %1RM objetivo (0-100) a partir de repeticiones y RPE (en vez de RIR).
 * Azúcar sobre `percent1RmForRepsAndRir(reps, rirFromRpe(rpe))`.
 */
export function percent1RmForRepsAndRpe(reps: number, rpe: number): number {
  return percent1RmForRepsAndRir(reps, rirFromRpe(rpe));
}
