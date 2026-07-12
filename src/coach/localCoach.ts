/**
 * `LocalCoachAdvisor` — implementación local (heurísticas, sin red) del
 * contrato `CoachAdvisor` (docs/roadmap-avanzado.md, Bloque A). Funciones
 * puras: no leen la base de datos ni el dataset directamente, reciben los
 * datos ya resueltos por el llamador (mismo patrón que `./volume.ts`).
 */
import { estimateE1rm, percent1RmForRepsAndRir, rirFromRpe } from './oneRepMax';
import { weeklyVolumeBalance } from './volume';
import type {
  CoachAdvisor,
  ExerciseCategoryCatalog,
  ExerciseHistory,
  FamilyVolume,
  LoadSuggestion,
  ProgressVerdict,
  SetContext,
} from './types';

/** Incremento de redondeo por defecto: barra olímpica estándar (kg). */
const DEFAULT_ROUNDING_INCREMENT_KG = 2.5;

/** Ventana de sesiones recientes que mira `assessProgress` (docs/roadmap-avanzado.md, A2). */
const RECENT_SESSIONS_WINDOW = 5;

const PLATEAU_MESSAGE = '3 sesiones sin PR. Prueba semana ligera o sube 2 reps.';
const REGRESS_MESSAGE = '2 sesiones seguidas a la baja. Prueba una semana de descarga.';
const PROGRESS_MESSAGE = 'El 1RM estimado sube. Sigue así.';
const INSUFFICIENT_DATA_MESSAGE = 'Aún no hay histórico suficiente para valorar el progreso.';
const NEUTRAL_MESSAGE = 'Rendimiento estable. Sigue registrando series para afinar el diagnóstico.';

/** Redondea al múltiplo de `incrementKg` más cercano (evita arrastre de floats). */
function roundToIncrement(weightKg: number, incrementKg: number): number {
  if (incrementKg <= 0) {
    return Math.round(weightKg * 100) / 100;
  }
  const rounded = Math.round(weightKg / incrementKg) * incrementKg;
  return Math.round(rounded * 100) / 100;
}

// ---------------------------------------------------------------------------
// A2 — helpers de agrupación por sesión
// ---------------------------------------------------------------------------

interface SessionBestE1rm {
  sessionId: string;
  e1rm: number;
}

/**
 * Mejor e1RM por sesión, en orden cronológico ascendente (por la primera
 * serie vista de cada sesión tras ordenar todo el historial por fecha).
 */
function bestE1rmBySession(history: ExerciseHistory): SessionBestE1rm[] {
  const sorted = [...history].sort((a, b) => a.completedAt - b.completedAt);
  const bySession = new Map<string, number>();
  sorted.forEach((set) => {
    const e1rm = estimateE1rm(set.weightKg, set.reps);
    const current = bySession.get(set.sessionId);
    if (current === undefined || e1rm > current) {
      bySession.set(set.sessionId, e1rm);
    }
  });
  return Array.from(bySession.entries()).map(([sessionId, e1rm]) => ({ sessionId, e1rm }));
}

export class LocalCoachAdvisor implements CoachAdvisor {
  // -------------------------------------------------------------------------
  // A1
  // -------------------------------------------------------------------------
  suggestNextLoad(input: SetContext): LoadSuggestion | null {
    const { lastSet, targetReps, targetRpe, recentSets, roundingIncrementKg } = input;
    const increment = roundingIncrementKg ?? DEFAULT_ROUNDING_INCREMENT_KG;
    const targetRir = rirFromRpe(targetRpe);
    const targetPercent = percent1RmForRepsAndRir(targetReps, targetRir) / 100;

    let baseE1rm: number;
    let basis: LoadSuggestion['basis'];
    let note: string;

    if (lastSet !== null && lastSet.rpe !== undefined) {
      baseE1rm = estimateE1rm(lastSet.weightKg, lastSet.reps);
      basis = 'rpe';
      note = `Basado en tu última serie (${lastSet.weightKg} kg x ${lastSet.reps}, RPE ${lastSet.rpe}).`;
    } else {
      const history = recentSets ?? [];
      if (history.length === 0) {
        return null;
      }
      const e1rms = history.map((set) => estimateE1rm(set.weightKg, set.reps));
      baseE1rm = e1rms.reduce((sum, value) => sum + value, 0) / e1rms.length;
      basis = 'e1rm-history';
      note = `Sin RPE reciente: media de tus últimas ${history.length} series.`;
    }

    if (!Number.isFinite(baseE1rm) || baseE1rm <= 0) {
      return null;
    }

    const weightKg = roundToIncrement(baseE1rm * targetPercent, increment);
    return { weightKg, basis, note };
  }

  // -------------------------------------------------------------------------
  // A2
  // -------------------------------------------------------------------------
  assessProgress(_exerciseId: string, history: ExerciseHistory): ProgressVerdict {
    const allSessions = bestE1rmBySession(history);

    if (allSessions.length < 2) {
      return { state: 'progress', message: INSUFFICIENT_DATA_MESSAGE };
    }

    const historicalBest = allSessions.reduce((max, session) => Math.max(max, session.e1rm), -Infinity);
    const recent = allSessions.slice(-RECENT_SESSIONS_WINDOW);

    if (recent.length >= 3) {
      const [prevPrev, prev, last] = recent.slice(-3).map((session) => session.e1rm);
      if (last < prev && prev < prevPrev) {
        return { state: 'regress', message: REGRESS_MESSAGE };
      }

      const lastThree = recent.slice(-3);
      const noPrInLastThree = lastThree.every((session) => session.e1rm < historicalBest);
      if (noPrInLastThree) {
        return { state: 'plateau', message: PLATEAU_MESSAGE };
      }
    }

    const window = recent.slice(-4);
    let increases = 0;
    for (let i = 1; i < window.length; i += 1) {
      if (window[i].e1rm > window[i - 1].e1rm) {
        increases += 1;
      }
    }
    if (increases >= 2) {
      return { state: 'progress', message: PROGRESS_MESSAGE };
    }

    return { state: 'progress', message: NEUTRAL_MESSAGE };
  }

  // -------------------------------------------------------------------------
  // A3 — envoltorio de ./volume, no se reimplementa
  // -------------------------------------------------------------------------
  volumeBalance(setsThisWeek: { exerciseId: string }[], catalog: ExerciseCategoryCatalog): FamilyVolume[] {
    return weeklyVolumeBalance(setsThisWeek, catalog);
  }
}

export const localCoachAdvisor = new LocalCoachAdvisor();
