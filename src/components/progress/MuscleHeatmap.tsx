import { useMemo } from 'react';
import type { SessionSet } from '../../types/routine';
import type { Exercise } from '../../types/exercise';
import MuscleMap from '../muscle-map/MuscleMap';
import { buildMuscleCatalog, weeklyMuscleHeat } from './muscleHeat';
import './MuscleHeatmap.css';

interface MuscleHeatmapProps {
  /** Series de la semana ISO actual (useProgressData().currentWeekSets). */
  currentWeekSets: SessionSet[];
  /** Catálogo completo del dataset (useExercises().exercises). */
  exercises: Exercise[];
}

/**
 * Mapa de calor muscular semanal — complemento por MÚSCULO del balance por
 * FAMILIA de MuscleBalance. Referencia: docs/design-carga.md (Progreso,
 * "cuaderno de resultados"). Criterio de agregación/normalización: ver
 * muscleHeat.ts.
 */
const MuscleHeatmap: React.FC<MuscleHeatmapProps> = ({ currentWeekSets, exercises }) => {
  const catalog = useMemo(() => buildMuscleCatalog(exercises), [exercises]);
  const intensityByRegion = useMemo(
    () => weeklyMuscleHeat(currentWeekSets, catalog),
    [currentWeekSets, catalog],
  );
  const hasData = Object.keys(intensityByRegion).length > 0;

  return (
    <div className="carga-card progreso-heatmap">
      <span className="carga-overline">Mapa de calor · esta semana</span>
      {hasData ? (
        <MuscleMap mode="heat" intensityByRegion={intensityByRegion} />
      ) : (
        <p className="progreso-heatmap-empty">Sin series esta semana. Entrena y aquí se enciende.</p>
      )}
    </div>
  );
};

export default MuscleHeatmap;
