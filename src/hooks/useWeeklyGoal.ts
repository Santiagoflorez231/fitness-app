/**
 * Objetivo semanal de sesiones (Progreso: panel de racha/objetivo).
 *
 * repos.ts no expone todavía un SettingsRepo (la tabla `settings` existe en
 * el esquema de docs/persistence-schema.md, pero ningún contrato la usa
 * hoy), así que este ajuste vive en localStorage bajo `carga.weeklyGoal`
 * tal y como permite explícitamente la especificación de esta tarea. Si el
 * día de mañana se añade un SettingsRepo, este hook es el único punto a
 * migrar.
 */
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'carga.weeklyGoal';
const DEFAULT_GOAL = 3;
const MIN_GOAL = 1;
const MAX_GOAL = 14;

function clampGoal(value: number): number {
  return Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(value)));
}

function readGoal(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_GOAL;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_GOAL;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_GOAL;
  }
  return clampGoal(parsed);
}

interface UseWeeklyGoalResult {
  weeklyGoal: number;
  setWeeklyGoal: (value: number) => void;
}

export function useWeeklyGoal(): UseWeeklyGoalResult {
  const [weeklyGoal, setWeeklyGoalState] = useState<number>(readGoal);

  const setWeeklyGoal = useCallback((value: number) => {
    const clamped = clampGoal(value);
    setWeeklyGoalState(clamped);
    window.localStorage.setItem(STORAGE_KEY, String(clamped));
  }, []);

  return { weeklyGoal, setWeeklyGoal };
}
