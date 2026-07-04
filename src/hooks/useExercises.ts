import { useEffect, useState } from 'react';
import type { Exercise, ExerciseFilters } from '../types/exercise';

interface ExercisesData {
  exercises: Exercise[];
  filters: ExerciseFilters;
}

const EMPTY_FILTERS: ExerciseFilters = { categories: [], equipment: [], targets: [] };

// Caché a nivel de módulo: el JSON solo se importa/parsea una vez,
// aunque el hook se monte en varias pantallas.
let cache: ExercisesData | null = null;
let pending: Promise<ExercisesData> | null = null;

function loadExercisesData(): Promise<ExercisesData> {
  if (cache) {
    return Promise.resolve(cache);
  }

  if (!pending) {
    pending = Promise.all([
      import('../data/exercises.json'),
      import('../data/filters.json'),
    ]).then(([exercisesModule, filtersModule]) => {
      const data: ExercisesData = {
        exercises: exercisesModule.default as unknown as Exercise[],
        filters: filtersModule.default as unknown as ExerciseFilters,
      };
      cache = data;
      return data;
    });
  }

  return pending;
}

interface UseExercisesResult {
  exercises: Exercise[];
  filters: ExerciseFilters;
  loading: boolean;
}

export function useExercises(): UseExercisesResult {
  const [data, setData] = useState<ExercisesData | null>(cache);

  useEffect(() => {
    if (data) {
      return;
    }

    let cancelled = false;

    loadExercisesData().then((result) => {
      if (!cancelled) {
        setData(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  return {
    exercises: data?.exercises ?? [],
    filters: data?.filters ?? EMPTY_FILTERS,
    loading: data === null,
  };
}
