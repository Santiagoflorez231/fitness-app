/**
 * Datos agregados para la vista de Progreso: volumen semanal, cifras hero y
 * lista de ejercicios con historial (para el selector de PRs). Se deriva
 * todo de `sessionsRepo.listFinished()` + `getSets()` — nada se guarda en
 * DB (docs/persistence-schema.md): "PRs y volumen semanal NO se almacenan".
 */
import { useCallback, useEffect, useState } from 'react';
import { sessionsRepo } from '../db';
import type { SessionSet } from '../types/routine';
import { addDaysLocal, formatWeekLabel, startOfIsoWeekLocal } from '../utils/dates';

const WEEKS_IN_CHART = 12;
const WEEKS_FOR_SESSION_COUNT = 4;

export interface WeekVolume {
  weekStart: number;
  label: string;
  volumeKg: number;
}

export interface StatsHeadline {
  currentWeekVolumeKg: number;
  sessionsLast4Weeks: number;
  lastWorkoutAt: number | null;
}

export interface ExerciseHistoryEntry {
  exerciseId: string;
  exerciseName: string;
  setCount: number;
}

interface ProgressData {
  loading: boolean;
  volumeByWeek: WeekVolume[];
  statsHeadline: StatsHeadline;
  exercisesWithHistory: ExerciseHistoryEntry[];
  refetch: () => void;
}

const EMPTY_STATS: StatsHeadline = {
  currentWeekVolumeKg: 0,
  sessionsLast4Weeks: 0,
  lastWorkoutAt: null,
};

/** Últimas `WEEKS_IN_CHART` semanas ISO locales, incluida la actual, en orden ascendente. */
function buildEmptyWeeks(now: number): WeekVolume[] {
  const currentWeekStart = startOfIsoWeekLocal(now);
  const weeks: WeekVolume[] = [];
  for (let i = WEEKS_IN_CHART - 1; i >= 0; i -= 1) {
    const weekStart = addDaysLocal(currentWeekStart, -7 * i);
    weeks.push({ weekStart, label: formatWeekLabel(weekStart), volumeKg: 0 });
  }
  return weeks;
}

export function useProgressData(): ProgressData {
  const [loading, setLoading] = useState(true);
  const [volumeByWeek, setVolumeByWeek] = useState<WeekVolume[]>([]);
  const [statsHeadline, setStatsHeadline] = useState<StatsHeadline>(EMPTY_STATS);
  const [exercisesWithHistory, setExercisesWithHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // nonce arranca en 0 y no dispara carga: la primera carga la dispara
    // siempre useIonViewWillEnter en Progreso.tsx (llama a refetch(), que
    // incrementa nonce a 1), evitando la doble carga que había al montar
    // (efecto en nonce=0) seguida de la de useIonViewWillEnter.
    if (nonce === 0) {
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      // Más recientes primero (contrato de listFinished()).
      const sessions = await sessionsRepo.listFinished();
      const setsBySession = await Promise.all(sessions.map((session) => sessionsRepo.getSets(session.id)));
      const allSets: SessionSet[] = setsBySession.flat();

      const now = Date.now();
      const weeks = buildEmptyWeeks(now);
      const weekIndexByStart = new Map(weeks.map((week, index) => [week.weekStart, index]));

      allSets.forEach((set) => {
        const weekStart = startOfIsoWeekLocal(set.completedAt);
        const index = weekIndexByStart.get(weekStart);
        if (index !== undefined) {
          weeks[index] = { ...weeks[index], volumeKg: weeks[index].volumeKg + set.weightKg * set.reps };
        }
      });

      const currentWeekVolumeKg = weeks[weeks.length - 1]?.volumeKg ?? 0;
      const currentWeekStart = startOfIsoWeekLocal(now);
      const sessionCountWindowStart = addDaysLocal(currentWeekStart, -7 * (WEEKS_FOR_SESSION_COUNT - 1));
      const sessionsLast4Weeks = sessions.filter(
        (session) => session.finishedAt !== null && session.finishedAt >= sessionCountWindowStart,
      ).length;
      const lastWorkoutAt = sessions[0]?.finishedAt ?? null;

      // Ejercicios únicos con >=1 serie (sesiones terminadas), setCount desc.
      // Como `sessions` viene más reciente primero, la primera aparición de
      // cada exerciseId trae el snapshot de nombre más reciente.
      const historyMap = new Map<string, ExerciseHistoryEntry>();
      allSets.forEach((set) => {
        const existing = historyMap.get(set.exerciseId);
        if (existing) {
          existing.setCount += 1;
        } else {
          historyMap.set(set.exerciseId, {
            exerciseId: set.exerciseId,
            exerciseName: set.exerciseName,
            setCount: 1,
          });
        }
      });
      const exercisesList = Array.from(historyMap.values()).sort((a, b) => b.setCount - a.setCount);

      if (cancelled) {
        return;
      }
      setVolumeByWeek(weeks);
      setStatsHeadline({ currentWeekVolumeKg, sessionsLast4Weeks, lastWorkoutAt });
      setExercisesWithHistory(exercisesList);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { loading, volumeByWeek, statsHeadline, exercisesWithHistory, refetch };
}
