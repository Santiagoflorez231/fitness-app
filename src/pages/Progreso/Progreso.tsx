import { useEffect, useMemo, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { sessionsRepo } from '../../db';
import { useProgressData } from '../../hooks/useProgressData';
import { useWeeklyGoal } from '../../hooks/useWeeklyGoal';
import { useExercises } from '../../hooks/useExercises';
import type { SessionSet } from '../../types/routine';
import { formatDayMonthEs, formatShortDateEs } from '../../utils/dates';
import { formatKg } from '../../components/charts/chartTheme';
import WeeklyVolumeChart from '../../components/charts/WeeklyVolumeChart';
import E1rmChart, { type E1rmPoint } from '../../components/charts/E1rmChart';
import CountUpNumber from '../../components/CountUpNumber';
import TrainingHeatmap from '../../components/progress/TrainingHeatmap';
import MuscleBalance from '../../components/progress/MuscleBalance';
import MuscleHeatmap from '../../components/progress/MuscleHeatmap';
import StreakGoal from '../../components/progress/StreakGoal';
import BackupPanel from '../../components/progress/BackupPanel';
import { buildCategoryCatalog, weeklyVolumeBalance } from '../../coach/volume';
import './Progreso.css';

const WEIGHT_FORMATTER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** 1RM estimado (Epley), redondeado a 1 decimal. */
function estimateOneRepMax(weightKg: number, reps: number): number {
  const value = weightKg * (1 + reps / 30);
  return Math.round(value * 10) / 10;
}

/** PR real: mayor weightKg; desempate por más reps. */
function findPr(sets: SessionSet[]): SessionSet | null {
  if (sets.length === 0) {
    return null;
  }
  return sets.reduce((best, current) => {
    if (current.weightKg > best.weightKg) {
      return current;
    }
    if (current.weightKg === best.weightKg && current.reps > best.reps) {
      return current;
    }
    return best;
  });
}

/** Mejor e1RM por sesión (una sesión puede tener varios sets del mismo ejercicio),
 * ordenado cronológicamente ascendente para el gráfico de evolución. */
function computeE1rmBySession(sets: SessionSet[]): E1rmPoint[] {
  const bySession = new Map<string, SessionSet[]>();
  sets.forEach((set) => {
    const group = bySession.get(set.sessionId);
    if (group) {
      group.push(set);
    } else {
      bySession.set(set.sessionId, [set]);
    }
  });

  const points = Array.from(bySession.values()).map((group) => {
    const best = group.reduce((topSet, current) =>
      estimateOneRepMax(current.weightKg, current.reps) > estimateOneRepMax(topSet.weightKg, topSet.reps)
        ? current
        : topSet,
    );
    return { date: best.completedAt, e1rm: estimateOneRepMax(best.weightKg, best.reps) };
  });

  points.sort((a, b) => a.date - b.date);
  return points.map((point) => ({ ...point, label: formatShortDateEs(point.date) }));
}

const Progreso: React.FC = () => {
  const {
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
  } = useProgressData();
  const { weeklyGoal, setWeeklyGoal } = useWeeklyGoal();
  const { exercises, loading: exercisesLoading } = useExercises();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exerciseSets, setExerciseSets] = useState<SessionSet[]>([]);
  const [exerciseSetsLoading, setExerciseSetsLoading] = useState(false);
  // Se incrementa cada vez que se reentra a la página para forzar la
  // re-consulta de las series del ejercicio seleccionado (ver efecto de abajo):
  // sin esto, el panel de PR/1RM quedaba con datos viejos tras entrenar ese
  // ejercicio y volver, aunque los tiles y el volumen sí se refrescaban.
  const [reloadNonce, setReloadNonce] = useState(0);
  // El gráfico de volumen anima su entrada (scaleY escalonada) SOLO la primera
  // vez que hay datos; en refetch/reentradas a la vista no se repite.
  const [chartAnimated, setChartAnimated] = useState(false);

  useIonViewWillEnter(() => {
    refetch();
    setReloadNonce((n) => n + 1);
  });

  useEffect(() => {
    if (!loading && volumeByWeek.length > 0 && !chartAnimated) {
      setChartAnimated(true);
    }
  }, [loading, volumeByWeek, chartAnimated]);

  // Si el ejercicio elegido deja de tener historial (recarga de datos), se limpia la selección.
  useEffect(() => {
    if (selectedExerciseId && !exercisesWithHistory.some((e) => e.exerciseId === selectedExerciseId)) {
      setSelectedExerciseId(null);
    }
  }, [exercisesWithHistory, selectedExerciseId]);

  useEffect(() => {
    if (!selectedExerciseId) {
      setExerciseSets([]);
      return;
    }
    let cancelled = false;
    setExerciseSetsLoading(true);
    sessionsRepo.listSetsByExercise(selectedExerciseId).then((sets) => {
      if (!cancelled) {
        setExerciseSets(sets);
        setExerciseSetsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedExerciseId, reloadNonce]);

  // Catálogo exerciseId -> category (para el balance de volumen por familia).
  const catalog = useMemo(() => buildCategoryCatalog(exercises), [exercises]);
  const balance = useMemo(() => weeklyVolumeBalance(currentWeekSets, catalog), [currentWeekSets, catalog]);

  const pr = useMemo(() => findPr(exerciseSets), [exerciseSets]);
  const e1rmSeries = useMemo(() => computeE1rmBySession(exerciseSets), [exerciseSets]);
  const selectedExerciseName = exercisesWithHistory.find((e) => e.exerciseId === selectedExerciseId)?.exerciseName;
  const currentWeekStart = volumeByWeek[volumeByWeek.length - 1]?.weekStart ?? 0;

  if (loading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Progreso</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="progreso-content">
          <div className="progreso-center">
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const hasSessions = statsHeadline.lastWorkoutAt !== null;

  return (
    <IonPage>
      <IonHeader className="ion-no-border" translucent>
        <IonToolbar>
          <IonTitle>Progreso</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="progreso-content">
        <div className="progreso-stack">
          <h1 className="progreso-title">Progreso</h1>

          {!hasSessions ? (
            <>
              <div className="progreso-empty carga-card">
                <span className="carga-overline">Cuaderno de resultados</span>
                <p className="progreso-empty-text">
                  Aún no hay datos. Termina tu primer entrenamiento y tus cifras aparecerán aquí.
                </p>
              </div>
              {/* El respaldo también sirve para restaurar en un dispositivo nuevo,
                  antes de haber entrenado. */}
              <BackupPanel />
            </>
          ) : (
            <>
              <div className="progreso-tiles">
                <div className="progreso-tile carga-card">
                  <span className="carga-overline">Volumen · esta semana</span>
                  <CountUpNumber
                    className="progreso-tile-value"
                    value={statsHeadline.currentWeekVolumeKg}
                    format={formatKg}
                  />
                </div>
                <div className="progreso-tile carga-card">
                  <span className="carga-overline">Sesiones · 4 semanas</span>
                  <CountUpNumber className="progreso-tile-value" value={statsHeadline.sessionsLast4Weeks} />
                  <span className="progreso-tile-sub">
                    {statsHeadline.lastWorkoutAt !== null
                      ? `Último: ${formatDayMonthEs(statsHeadline.lastWorkoutAt)}`
                      : 'Sin entrenamientos'}
                  </span>
                </div>
              </div>

              <StreakGoal
                weekStreak={weekStreak}
                sessionsThisWeek={sessionsThisWeek}
                weeklyGoal={weeklyGoal}
                onChangeGoal={setWeeklyGoal}
              />

              {!exercisesLoading && <MuscleBalance balance={balance} />}

              {!exercisesLoading && (
                <MuscleHeatmap currentWeekSets={currentWeekSets} exercises={exercises} />
              )}

              <TrainingHeatmap days={heatmapDays} sessionsInWindow={sessionsInHeatmapWindow} />

              <section className="progreso-section">
                <span className="carga-overline">Volumen · 12 semanas</span>
                <WeeklyVolumeChart
                  data={volumeByWeek}
                  currentWeekStart={currentWeekStart}
                  animateEntrance={!chartAnimated}
                />
              </section>

              <section className="progreso-section">
                <span className="carga-overline">PRs por ejercicio</span>
                <IonSelect
                  className="progreso-exercise-select"
                  interface="popover"
                  placeholder="Selecciona un ejercicio"
                  value={selectedExerciseId ?? undefined}
                  onIonChange={(e) => setSelectedExerciseId(e.detail.value as string)}
                >
                  {exercisesWithHistory.map((exercise) => (
                    <IonSelectOption key={exercise.exerciseId} value={exercise.exerciseId}>
                      {exercise.exerciseName}
                    </IonSelectOption>
                  ))}
                </IonSelect>

                {!selectedExerciseId ? (
                  <p className="progreso-hint">Elige un ejercicio para ver su récord y evolución.</p>
                ) : exerciseSetsLoading ? (
                  <div className="progreso-center progreso-center-sm">
                    <IonSpinner name="crescent" />
                  </div>
                ) : (
                  <>
                    {pr && (
                      <div className="progreso-pr carga-card">
                        <span className="carga-overline">Récord</span>
                        <div className="carga-num progreso-pr-value">
                          {WEIGHT_FORMATTER.format(pr.weightKg)}
                          <span className="progreso-pr-unit"> kg</span>
                          <span className="progreso-pr-reps"> × {pr.reps}</span>
                        </div>
                        <div className="progreso-pr-meta">
                          {formatDayMonthEs(pr.completedAt)} · 1RM est. {formatKg(estimateOneRepMax(pr.weightKg, pr.reps))}
                        </div>
                      </div>
                    )}
                    <div className="progreso-chart-label carga-overline">Evolución 1RM estimado</div>
                    <E1rmChart data={e1rmSeries} exerciseName={selectedExerciseName} />
                  </>
                )}
              </section>

              <BackupPanel />
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Progreso;
