/**
 * Incremento de redondeo del Coach (kg) para las sugerencias de carga
 * (`SetContext.roundingIncrementKg`, ver src/coach/types.ts y
 * src/coach/localCoach.ts). Igual que useWeeklyGoal: no existe todavía un
 * SettingsRepo (la tabla `settings` de docs/persistence-schema.md no tiene
 * consumidores hoy), así que este ajuste vive en localStorage bajo
 * `carga.coach.roundingKg`. Si el día de mañana se añade un SettingsRepo,
 * este hook es el único punto a migrar.
 */
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'carga.coach.roundingKg';
const DEFAULT_ROUNDING_KG = 2.5;

/** Opciones de redondeo ofrecidas en Ajustes (docs/renovacion-plan.md R8). */
export const ROUNDING_OPTIONS_KG = [2.5, 2, 1.25] as const;

function isValidRounding(value: number): boolean {
  return (ROUNDING_OPTIONS_KG as readonly number[]).includes(value);
}

function readRounding(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_ROUNDING_KG;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_ROUNDING_KG;
  }
  const parsed = Number.parseFloat(raw);
  return isValidRounding(parsed) ? parsed : DEFAULT_ROUNDING_KG;
}

interface UseCoachSettingsResult {
  roundingIncrementKg: number;
  setRoundingIncrementKg: (value: number) => void;
}

export function useCoachSettings(): UseCoachSettingsResult {
  const [roundingIncrementKg, setRoundingIncrementKgState] = useState<number>(readRounding);

  const setRoundingIncrementKg = useCallback((value: number) => {
    const safe = isValidRounding(value) ? value : DEFAULT_ROUNDING_KG;
    setRoundingIncrementKgState(safe);
    window.localStorage.setItem(STORAGE_KEY, String(safe));
  }, []);

  return { roundingIncrementKg, setRoundingIncrementKg };
}
