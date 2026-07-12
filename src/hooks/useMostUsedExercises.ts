/**
 * Top ejercicios por número de series en sesiones terminadas, para el
 * carril «Más usados por ti» de Explorar (R6). Reutiliza el agregado
 * `buildExerciseHistory` de useProgressData (mismo criterio: setCount desc)
 * sin duplicar la lógica ni cargar las series derivadas (semanas, heatmap)
 * que Explorar no necesita.
 */
import { useEffect, useState } from 'react';
import { sessionsRepo } from '../db';
import type { SessionSet } from '../types/routine';
import { buildExerciseHistory, type ExerciseHistoryEntry } from './useProgressData';

const TOP_N = 10;

interface UseMostUsedExercisesResult {
  entries: ExerciseHistoryEntry[];
  loading: boolean;
}

export function useMostUsedExercises(): UseMostUsedExercisesResult {
  const [entries, setEntries] = useState<ExerciseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessions = await sessionsRepo.listFinished();
        const setsBySession = await Promise.all(sessions.map((session) => sessionsRepo.getSets(session.id)));
        const allSets: SessionSet[] = setsBySession.flat();
        if (cancelled) {
          return;
        }
        setEntries(buildExerciseHistory(allSets).slice(0, TOP_N));
      } catch {
        // El carril "Más usados por ti" es puramente informativo: si la
        // lectura falla (p. ej. SQLite todavía no disponible), Explorar
        // sigue funcionando con el carril oculto (ExplorarRail no renderiza
        // nada con entries=[]) en vez de propagar el error.
        if (!cancelled) {
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, loading };
}
