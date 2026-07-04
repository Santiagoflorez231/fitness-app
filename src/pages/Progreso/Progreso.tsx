import { useEffect, useMemo, useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { trendingUp } from 'ionicons/icons';
import { sessionsRepo } from '../../db';
import { useProgressData } from '../../hooks/useProgressData';
import type { SessionSet } from '../../types/routine';
import { formatDayMonthEs, formatShortDateEs } from '../../utils/dates';
import { formatKg } from '../../components/charts/chartTheme';
import WeeklyVolumeChart from '../../components/charts/WeeklyVolumeChart';
import E1rmChart, { type E1rmPoint } from '../../components/charts/E1rmChart';

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
  const { loading, volumeByWeek, statsHeadline, exercisesWithHistory, refetch } = useProgressData();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exerciseSets, setExerciseSets] = useState<SessionSet[]>([]);
  const [exerciseSetsLoading, setExerciseSetsLoading] = useState(false);
  // Se incrementa cada vez que se reentra a la página para forzar la
  // re-consulta de las series del ejercicio seleccionado (ver efecto de abajo):
  // sin esto, el panel de PR/1RM quedaba con datos viejos tras entrenar ese
  // ejercicio y volver, aunque los tiles y el volumen sí se refrescaban.
  const [reloadNonce, setReloadNonce] = useState(0);

  useIonViewWillEnter(() => {
    refetch();
    setReloadNonce((n) => n + 1);
  });

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

  const pr = useMemo(() => findPr(exerciseSets), [exerciseSets]);
  const e1rmSeries = useMemo(() => computeE1rmBySession(exerciseSets), [exerciseSets]);
  const selectedExerciseName = exercisesWithHistory.find((e) => e.exerciseId === selectedExerciseId)?.exerciseName;

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Progreso</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const hasSessions = statsHeadline.lastWorkoutAt !== null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Progreso</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {!hasSessions ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              padding: '2rem',
              gap: '0.5rem',
            }}
          >
            <IonIcon icon={trendingUp} style={{ fontSize: '4rem' }} color="medium" />
            <p>Aún no hay datos: termina tu primer entrenamiento</p>
          </div>
        ) : (
          <div className="ion-padding">
            <IonGrid style={{ padding: 0 }}>
              <IonRow>
                <IonCol size="6">
                  <IonCard style={{ margin: 0, height: '100%' }}>
                    <IonCardContent>
                      <IonCardSubtitle style={{ marginBottom: '0.4rem' }}>Volumen esta semana</IonCardSubtitle>
                      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
                        {formatKg(statsHeadline.currentWeekVolumeKg)}
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
                <IonCol size="6">
                  <IonCard style={{ margin: 0, height: '100%' }}>
                    <IonCardContent>
                      <IonCardSubtitle style={{ marginBottom: '0.4rem' }}>Sesiones · 4 semanas</IonCardSubtitle>
                      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{statsHeadline.sessionsLast4Weeks}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ion-color-medium)', marginTop: '0.2rem' }}>
                        {statsHeadline.lastWorkoutAt !== null
                          ? `Último: ${formatDayMonthEs(statsHeadline.lastWorkoutAt)}`
                          : 'Sin entrenamientos'}
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>

            <h2>Volumen semanal (kg)</h2>
            <WeeklyVolumeChart data={volumeByWeek} />

            <h2 style={{ marginTop: '1.5rem' }}>PRs por ejercicio</h2>
            <IonItem lines="none" style={{ '--padding-start': '0' } as React.CSSProperties}>
              <IonLabel>Ejercicio</IonLabel>
              <IonSelect
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
            </IonItem>

            {!selectedExerciseId ? (
              <p style={{ color: 'var(--ion-color-medium)', textAlign: 'center', padding: '1.5rem 0' }}>
                Elige un ejercicio para ver sus PRs
              </p>
            ) : exerciseSetsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
                <IonSpinner name="crescent" />
              </div>
            ) : (
              <>
                {pr && (
                  <IonCard>
                    <IonCardContent>
                      <IonCardTitle style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                        {WEIGHT_FORMATTER.format(pr.weightKg)} kg × {pr.reps} reps
                      </IonCardTitle>
                      <div style={{ color: 'var(--ion-color-medium)', fontSize: '0.85rem' }}>
                        {formatDayMonthEs(pr.completedAt)}
                      </div>
                      <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                        1RM estimado: {formatKg(estimateOneRepMax(pr.weightKg, pr.reps))}
                      </div>
                    </IonCardContent>
                  </IonCard>
                )}

                <h2>Evolución 1RM estimado</h2>
                <E1rmChart data={e1rmSeries} exerciseName={selectedExerciseName} />
              </>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Progreso;
