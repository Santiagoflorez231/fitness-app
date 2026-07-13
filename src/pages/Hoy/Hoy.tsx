/**
 * Hoy — pantalla de entrada de la app (R7, docs/renovacion-plan.md).
 * Compone datos ya agregados por hooks/repos existentes: nada de lógica de
 * persistencia ni agregación nueva aquí, solo lectura y presentación.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { barbellOutline, chevronForward, compassOutline, settingsOutline, timeOutline } from 'ionicons/icons';
import { routinesRepo, sessionsRepo } from '../../db';
import { useProgressData } from '../../hooks/useProgressData';
import { useWeeklyGoal } from '../../hooks/useWeeklyGoal';
import { useExercises } from '../../hooks/useExercises';
import { buildCategoryCatalog, sortByDeficit, weeklyVolumeBalance, type FamilyVolume } from '../../coach/volume';
import { estimateSessionMinutes } from '../../data/routineTemplates';
import StreakGoal from '../../components/progress/StreakGoal';
import TrainingHeatmap from '../../components/progress/TrainingHeatmap';
import ExerciseAvatar from '../../components/ExerciseAvatar';
import CargaSkeleton from '../../components/CargaSkeleton';
import type { Routine, SessionSet } from '../../types/routine';
import './Hoy.css';

/** Celdas del mini-heatmap: últimas 4 semanas ISO (28 días, alineado a lunes). */
const MINI_HEATMAP_DAYS = 28;

const WEIGHT_FORMATTER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// Mismo mapeo de etiquetas que src/components/progress/MuscleBalance.tsx
// (no se exporta desde coach/volume.ts: cada consumidor de FamilyVolume
// mantiene su propia copia, igual que hace MuscleBalance).
const FAMILY_LABEL: Record<FamilyVolume['family'], string> = {
  empuje: 'Empuje',
  tiron: 'Tirón',
  pierna: 'Pierna',
  core: 'Core',
  brazos: 'Brazos',
  cardio: 'Cardio',
};

function greetingForHour(hour: number): string {
  if (hour < 12) {
    return 'Buenos días.';
  }
  if (hour < 20) {
    return 'Buenas tardes.';
  }
  return 'Buenas noches.';
}

/** "Domingo, 12 de julio" en es-ES, con la inicial en mayúscula. */
function longDateEs(now: Date): string {
  const formatted = LONG_DATE_FORMATTER.format(now);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** e1RM estimado (Epley) — mismo cálculo que src/pages/Progreso/Progreso.tsx. */
function estimateOneRepMax(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/**
 * "Último PR": simplificación documentada (R7) — el cómputo exacto (mejor
 * marca histórica real de cada ejercicio sobre las últimas ~10 sesiones)
 * es caro para una card de entrada. En su lugar: mejor serie por e1RM
 * estimado DENTRO de la última sesión terminada.
 */
function bestSetByE1rm(sets: SessionSet[]): SessionSet | null {
  if (sets.length === 0) {
    return null;
  }
  return sets.reduce((best, current) =>
    estimateOneRepMax(current.weightKg, current.reps) > estimateOneRepMax(best.weightKg, best.reps) ? current : best,
  );
}

const Hoy: React.FC = () => {
  const history = useHistory();
  const {
    loading: progressLoading,
    statsHeadline,
    weekStreak,
    sessionsThisWeek,
    heatmapDays,
    currentWeekSets,
    refetch,
  } = useProgressData();
  const { weeklyGoal, setWeeklyGoal } = useWeeklyGoal();
  const { exercises, loading: exercisesLoading } = useExercises();

  const [localLoading, setLocalLoading] = useState(true);
  const [hasAnyRoutine, setHasAnyRoutine] = useState(false);
  const [nextRoutine, setNextRoutine] = useState<Routine | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [lastSet, setLastSet] = useState<SessionSet | null>(null);

  const loadLocalData = useCallback(() => {
    setLocalLoading(true);
    (async () => {
      // Más reciente primero (contrato de listFinished()); limit=1 basta
      // para "próxima sesión" y "último PR" (ver bestSetByE1rm más arriba).
      const [finished, routines] = await Promise.all([sessionsRepo.listFinished(1), routinesRepo.list()]);

      setHasAnyRoutine(routines.length > 0);
      setHasHistory(finished.length > 0);

      const lastRoutineId = finished[0]?.routineId ?? null;
      let candidate: Routine | null = null;
      if (lastRoutineId !== null) {
        const found = await routinesRepo.get(lastRoutineId);
        // "borrada" = archivada (soft-delete, docs/persistence-schema.md):
        // get() no filtra archivadas, así que se descarta aquí explícitamente.
        if (found && !found.archived) {
          candidate = found;
        }
      }
      setNextRoutine(candidate ?? routines[0] ?? null);

      if (finished[0]) {
        const sets = await sessionsRepo.getSets(finished[0].id);
        setLastSet(bestSetByE1rm(sets));
      } else {
        setLastSet(null);
      }

      setLocalLoading(false);
    })();
  }, []);

  useIonViewWillEnter(() => {
    refetch();
    loadLocalData();
  });

  const catalog = useMemo(() => buildCategoryCatalog(exercises), [exercises]);
  const balance = useMemo(() => weeklyVolumeBalance(currentWeekSets, catalog), [currentWeekSets, catalog]);
  // Familia con menos series en zona 'low' (sortByDeficit ya ordena por
  // déficit ascendente y deja cardio al final, que nunca es 'low').
  const lowFamily = useMemo(() => sortByDeficit(balance).find((row) => row.zone === 'low'), [balance]);

  const lastSetExercise = useMemo(
    () => (lastSet ? exercises.find((exercise) => exercise.id === lastSet.exerciseId) : undefined),
    [lastSet, exercises],
  );

  const miniHeatmapDays = useMemo(() => heatmapDays.slice(-MINI_HEATMAP_DAYS), [heatmapDays]);

  const loading = progressLoading || localLoading || exercisesLoading;
  const hasAnyData = hasHistory || hasAnyRoutine;
  const now = new Date();

  if (loading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Hoy</IonTitle>
            <IonButtons slot="end">
              <IonButton routerLink="/tabs/ajustes" aria-label="Ajustes">
                <IonIcon slot="icon-only" icon={settingsOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="hoy-content">
          <div className="hoy-stack">
            <CargaSkeleton variant="block" height={64} />
            <CargaSkeleton variant="card" width="100%" height={140} />
            <CargaSkeleton variant="card" width="100%" height={110} />
            <CargaSkeleton variant="card" width="100%" height={72} />
            <CargaSkeleton variant="card" width="100%" height={170} />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border" translucent>
        <IonToolbar>
          <IonTitle>Hoy</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="hoy-content">
        <div className="hoy-stack">
          <header className="hoy-header">
            <span className="carga-overline">{longDateEs(now)}</span>
            <h1 className="hoy-title">{greetingForHour(now.getHours())}</h1>
          </header>

          {!hasAnyData ? (
            <div className="hoy-empty carga-card">
              <span className="carga-overline">Empieza hoy</span>
              <p className="hoy-empty-text">Tu primer entrenamiento te espera.</p>
              <IonButton expand="block" shape="round" routerLink="/tabs/entrenar">
                Entrenar
              </IonButton>
            </div>
          ) : (
            <>
              <StreakGoal
                weekStreak={weekStreak}
                sessionsThisWeek={sessionsThisWeek}
                weeklyGoal={weeklyGoal}
                onChangeGoal={setWeeklyGoal}
              />

              <div className="carga-card hoy-next">
                <span className="carga-overline">Tu próxima sesión</span>
                {nextRoutine ? (
                  <>
                    <h2 className="hoy-next-name">{nextRoutine.name}</h2>
                    <p className="hoy-next-meta">
                      {nextRoutine.exercises.length}{' '}
                      {nextRoutine.exercises.length === 1 ? 'ejercicio' : 'ejercicios'} · ~
                      {estimateSessionMinutes(nextRoutine.exercises)} min
                    </p>
                  </>
                ) : (
                  <p className="hoy-next-meta">Sin rutinas todavía. Entrena libre y registra sobre la marcha.</p>
                )}
                <IonButton expand="block" shape="round" routerLink="/tabs/entrenar" className="hoy-next-cta">
                  Entrenar
                </IonButton>
              </div>

              {lowFamily && (
                <button
                  type="button"
                  className="carga-card hoy-nudge"
                  onClick={() => history.push('/tabs/explorar')}
                >
                  <div className="hoy-nudge-body">
                    <span className="carga-overline">Coach</span>
                    <p className="hoy-nudge-text">
                      {FAMILY_LABEL[lowFamily.family]} {lowFamily.sets}{' '}
                      {lowFamily.sets === 1 ? 'serie' : 'series'} esta semana. Súbele.
                    </p>
                  </div>
                  <IonIcon icon={chevronForward} className="hoy-nudge-icon" aria-hidden="true" />
                </button>
              )}

              {lastSet && (
                <div className="carga-card hoy-pr">
                  <ExerciseAvatar
                    target={lastSetExercise?.target ?? lastSet.exerciseName}
                    category={lastSetExercise?.category ?? ''}
                    exerciseId={lastSet.exerciseId}
                    size={48}
                  />
                  <div className="hoy-pr-info">
                    <span className="carga-overline">Última marca</span>
                    <p className="hoy-pr-text">
                      {WEIGHT_FORMATTER.format(lastSet.weightKg)} kg × {lastSet.reps} ·{' '}
                      {lastSet.exerciseName}
                    </p>
                  </div>
                </div>
              )}

              <TrainingHeatmap days={miniHeatmapDays} sessionsInWindow={statsHeadline.sessionsLast4Weeks} />

              <div className="hoy-quick-actions">
                <IonButton fill="outline" routerLink="/tabs/entrenar">
                  <IonIcon icon={barbellOutline} slot="start" />
                  Entrenamiento libre
                </IonButton>
                <IonButton fill="outline" routerLink="/tabs/historial">
                  <IonIcon icon={timeOutline} slot="start" />
                  Historial
                </IonButton>
                <IonButton fill="outline" routerLink="/tabs/explorar">
                  <IonIcon icon={compassOutline} slot="start" />
                  Explorar
                </IonButton>
                <IonButton fill="outline" routerLink="/tabs/ajustes">
                  <IonIcon icon={settingsOutline} slot="start" />
                  Ajustes
                </IonButton>
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Hoy;
