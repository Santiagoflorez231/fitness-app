/**
 * Datos agregados para la vista de Progreso: volumen semanal, cifras hero,
 * calendario de entrenamientos (heatmap), racha semanal y lista de
 * ejercicios con historial (para el selector de PRs). Se deriva todo de
 * `sessionsRepo.listFinished()` + `getSets()` — nada se guarda en DB
 * (docs/persistence-schema.md): "PRs y volumen semanal NO se almacenan".
 */
import { useCallback, useEffect, useState } from 'react';
import { sessionsRepo } from '../db';
import type { SessionSet, WorkoutSession } from '../types/routine';
import { addDaysLocal, formatWeekLabel, startOfDayLocal, startOfIsoWeekLocal } from '../utils/dates';

const WEEKS_IN_CHART = 12;
const WEEKS_FOR_SESSION_COUNT = 4;
/** Ventana del heatmap de calendario y del cómputo de racha: ~4.5 meses (docs/design-carga.md: "últimas ~16-26 semanas"). */
const HEATMAP_WEEKS = 20;

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

export interface DayVolume {
  dayStart: number;
  volumeKg: number;
  setCount: number;
}

interface ProgressData {
  loading: boolean;
  volumeByWeek: WeekVolume[];
  statsHeadline: StatsHeadline;
  exercisesWithHistory: ExerciseHistoryEntry[];
  /** Series de la semana ISO actual (para el balance de volumen por familia, src/coach/volume.ts). */
  currentWeekSets: SessionSet[];
  /** Un día por celda, ascendente: últimas HEATMAP_WEEKS semanas ISO completas + la actual (lunes primero). */
  heatmapDays: DayVolume[];
  /** Sesiones terminadas dentro de la ventana del heatmap (remate "N sesiones este ciclo"). */
  sessionsInHeatmapWindow: number;
  /** Sesiones terminadas en la semana ISO actual (objetivo semanal). */
  sessionsThisWeek: number;
  /** Semanas ISO consecutivas con >=1 sesión, terminando en la actual (o la última completa si la actual sigue vacía). */
  weekStreak: number;
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

/** Rejilla de días vacía: HEATMAP_WEEKS semanas ISO (lunes-domingo) hasta la actual, ascendente. */
function buildEmptyDays(now: number): DayVolume[] {
  const currentWeekStart = startOfIsoWeekLocal(now);
  const firstWeekStart = addDaysLocal(currentWeekStart, -7 * (HEATMAP_WEEKS - 1));
  const days: DayVolume[] = [];
  for (let i = 0; i < HEATMAP_WEEKS * 7; i += 1) {
    const dayStart = addDaysLocal(firstWeekStart, i);
    days.push({ dayStart, volumeKg: 0, setCount: 0 });
  }
  return days;
}

/**
 * Semanas ISO consecutivas con >=1 sesión terminada, contando hacia atrás
 * desde la semana actual. Si la semana actual todavía no tiene sesión no
 * se rompe la racha (sigue en curso): se salta y se cuenta desde la
 * semana anterior.
 */
function computeWeekStreak(now: number, finishedSessions: WorkoutSession[]): number {
  const weeksWithSession = new Set<number>();
  finishedSessions.forEach((session) => {
    if (session.finishedAt !== null) {
      weeksWithSession.add(startOfIsoWeekLocal(session.finishedAt));
    }
  });

  let cursor = startOfIsoWeekLocal(now);
  if (!weeksWithSession.has(cursor)) {
    cursor = addDaysLocal(cursor, -7);
  }
  let streak = 0;
  while (weeksWithSession.has(cursor)) {
    streak += 1;
    cursor = addDaysLocal(cursor, -7);
  }
  return streak;
}

export function useProgressData(): ProgressData {
  const [loading, setLoading] = useState(true);
  const [volumeByWeek, setVolumeByWeek] = useState<WeekVolume[]>([]);
  const [statsHeadline, setStatsHeadline] = useState<StatsHeadline>(EMPTY_STATS);
  const [exercisesWithHistory, setExercisesWithHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [currentWeekSets, setCurrentWeekSets] = useState<SessionSet[]>([]);
  const [heatmapDays, setHeatmapDays] = useState<DayVolume[]>([]);
  const [sessionsInHeatmapWindow, setSessionsInHeatmapWindow] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [weekStreak, setWeekStreak] = useState(0);
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

      // Series de la semana ISO actual (balance de volumen por familia, src/coach/volume.ts).
      const currentWeekSetsList = allSets.filter((set) => startOfIsoWeekLocal(set.completedAt) === currentWeekStart);

      // Heatmap: agregado por día calendario local.
      const days = buildEmptyDays(now);
      const dayIndexByStart = new Map(days.map((day, index) => [day.dayStart, index]));
      allSets.forEach((set) => {
        const dayStart = startOfDayLocal(set.completedAt);
        const index = dayIndexByStart.get(dayStart);
        if (index !== undefined) {
          days[index] = {
            ...days[index],
            volumeKg: days[index].volumeKg + set.weightKg * set.reps,
            setCount: days[index].setCount + 1,
          };
        }
      });

      const heatmapWindowStart = days[0]?.dayStart ?? currentWeekStart;
      const sessionsInWindow = sessions.filter(
        (session) => session.finishedAt !== null && session.finishedAt >= heatmapWindowStart,
      ).length;
      const sessionsThisWeekCount = sessions.filter(
        (session) => session.finishedAt !== null && session.finishedAt >= currentWeekStart,
      ).length;
      const streak = computeWeekStreak(now, sessions);

      if (cancelled) {
        return;
      }
      setVolumeByWeek(weeks);
      setStatsHeadline({ currentWeekVolumeKg, sessionsLast4Weeks, lastWorkoutAt });
      setExercisesWithHistory(exercisesList);
      setCurrentWeekSets(currentWeekSetsList);
      setHeatmapDays(days);
      setSessionsInHeatmapWindow(sessionsInWindow);
      setSessionsThisWeek(sessionsThisWeekCount);
      setWeekStreak(streak);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    loading,
    volumeByWeek,
    statsHeadline,
    exercisesWithHistory,
    currentWeekSets,
    heatmapDays,
    sessionsInHeatmapWindow,
    sessionsThisWeek,
    weekStreak,
    refetch,
  };
}
