/**
 * Agregación pura de series por región muscular para el mapa de calor
 * semanal (MuscleHeatmap.tsx). Separado del componente para que
 * react-refresh solo exporte componentes desde el .tsx (mismo patrón que
 * src/coach/volume.ts + MuscleBalance.tsx).
 */
import type { SessionSet } from '../../types/routine';
import type { Exercise } from '../../types/exercise';
import type { RegionId } from '../muscle-map/muscleRegions';
import { musclesForExercise } from '../muscle-map/muscleRegions';

/** Catálogo exerciseId -> músculos crudos del dataset (target/secondary_muscles). */
export type ExerciseMuscleCatalog = ReadonlyMap<string, { target: string; secondary_muscles: string[] }>;

/** Construye el catálogo a partir de la lista de ejercicios del dataset (useExercises()). */
export function buildMuscleCatalog(exercises: Exercise[]): ExerciseMuscleCatalog {
  const catalog = new Map<string, { target: string; secondary_muscles: string[] }>();
  exercises.forEach((exercise) => {
    catalog.set(exercise.id, { target: exercise.target, secondary_muscles: exercise.secondary_muscles });
  });
  return catalog;
}

/**
 * Agrega series duras por región muscular (semana ISO actual) y normaliza a
 * 0–1 para pintar `MuscleMap mode="heat"`. Criterio de intensidad (propio de
 * este panel, documentado aquí porque no hay landmarks de volumen por
 * músculo individual, solo por familia en src/coach/volume.ts): cada serie
 * suma 1 al músculo primario (`target`) y 0,5 a cada secundario
 * (`secondary_muscles`) del ejercicio — el mismo peso 1/0.5 que ya separa
 * primario/secundario en el resto de la app (mini-leyenda de Detalle). El
 * total por región se normaliza dividiendo por el máximo de la semana, así
 * la región más trabajada siempre pinta a intensidad 1 y el resto en
 * proporción. Ejercicios ausentes del catálogo (dataset desactualizado) se
 * ignoran, igual que en `weeklyVolumeBalance` (src/coach/volume.ts).
 */
export function weeklyMuscleHeat(
  setsThisWeek: SessionSet[],
  catalog: ExerciseMuscleCatalog,
): Partial<Record<RegionId, number>> {
  const raw = new Map<RegionId, number>();

  setsThisWeek.forEach((set) => {
    const exercise = catalog.get(set.exerciseId);
    if (!exercise) {
      return;
    }
    const { primary, secondary } = musclesForExercise(exercise);
    primary.forEach((region) => raw.set(region, (raw.get(region) ?? 0) + 1));
    secondary.forEach((region) => raw.set(region, (raw.get(region) ?? 0) + 0.5));
  });

  const max = Math.max(0, ...raw.values());
  if (max <= 0) {
    return {};
  }

  const normalized: Partial<Record<RegionId, number>> = {};
  raw.forEach((value, region) => {
    normalized[region] = value / max;
  });
  return normalized;
}
