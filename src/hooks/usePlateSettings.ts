/**
 * Barra por defecto (kg) de la calculadora de discos (PlateCalculator).
 * Igual que useWeeklyGoal/useCoachSettings: sin SettingsRepo todavía, vive
 * en localStorage bajo `carga.plate.barKg`.
 */
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'carga.plate.barKg';
const DEFAULT_BAR_KG = 20;

/** Opciones ofrecidas en Ajustes (docs/renovacion-plan.md R8). Subconjunto de
 * PlateCalculator.BAR_OPTIONS_KG (que además ofrece 7.5 kg dentro del sheet). */
export const DEFAULT_BAR_OPTIONS_KG = [20, 15, 10] as const;

function isValidBar(value: number): boolean {
  return (DEFAULT_BAR_OPTIONS_KG as readonly number[]).includes(value);
}

function readBar(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_BAR_KG;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_BAR_KG;
  }
  const parsed = Number.parseFloat(raw);
  return isValidBar(parsed) ? parsed : DEFAULT_BAR_KG;
}

interface UsePlateSettingsResult {
  defaultBarKg: number;
  setDefaultBarKg: (value: number) => void;
}

export function usePlateSettings(): UsePlateSettingsResult {
  const [defaultBarKg, setDefaultBarKgState] = useState<number>(readBar);

  const setDefaultBarKg = useCallback((value: number) => {
    const safe = isValidBar(value) ? value : DEFAULT_BAR_KG;
    setDefaultBarKgState(safe);
    window.localStorage.setItem(STORAGE_KEY, String(safe));
  }, []);

  return { defaultBarKg, setDefaultBarKg };
}
