import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { barbell } from 'ionicons/icons';
import { routinesRepo, sessionsRepo } from '../../db';
import { useExercises } from '../../hooks/useExercises';
import ExerciseAvatar from '../../components/ExerciseAvatar';
import SetRow from '../../components/SetRow';
import RestTimer, { type RestTimerTrigger } from '../../components/RestTimer';
import type { Exercise } from '../../types/exercise';
import type { Routine, SessionSet, WorkoutSession } from '../../types/routine';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const REST_TIMER_STORAGE_KEY = 'fitness.restTimer';

/** Un ejercicio a mostrar en la vista de entrenamiento: viene del plan de la
 * rutina en el momento de iniciar/retomar la sesión, o -si la rutina cambió o
 * se borró mientras tanto- se reconstruye desde los sets ya registrados. */
interface PlanExercise {
  key: string;
  exerciseId: string;
  exerciseName: string;
  target: string;
  category: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
  /** true si el ejercicio ya no está en la rutina (o la rutina se borró):
   * solo mostramos sus series ya registradas, sin filas nuevas que completar. */
  isOrphan: boolean;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'choose-routine'; routines: Routine[] }
  | { kind: 'confirm-abandoned'; session: WorkoutSession; sets: SessionSet[] }
  | { kind: 'workout'; session: WorkoutSession; plan: PlanExercise[] };

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateEs(ts: number): string {
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatKg(value: number): string {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)} kg`;
}

/** true si `s` pertenece a alguno de los bloques REALES (no huérfanos) de
 * `realBlocks`: por routineExerciseId si lo tiene, o -en filas legacy sin
 * routineExerciseId- por exerciseId compartido con cualquiera de ellos. */
function resolvesToRealBlock(realBlocks: PlanExercise[], s: SessionSet): boolean {
  if (s.routineExerciseId != null) {
    return realBlocks.some((pe) => pe.key === s.routineExerciseId);
  }
  return realBlocks.some((pe) => pe.exerciseId === s.exerciseId);
}

/** Única función que decide qué series de `sets` pertenecen al bloque `pe`
 * del plan. Necesaria porque una rutina puede repetir el mismo ejercicio en
 * dos bloques distintos: (exerciseId, setNumber) ya no identifica de forma
 * única una serie dentro de la sesión.
 *
 * - Si `pe` es un bloque real: pertenece si `routineExerciseId === pe.key`,
 *   o si la serie es legacy (routineExerciseId nulo) con el mismo
 *   exerciseId Y `pe` es el PRIMER bloque real del plan con ese exerciseId
 *   (una serie legacy sólo puede pertenecer a un único bloque).
 * - Si `pe` es huérfano: agrupa las series de ese exerciseId que no
 *   resuelven a NINGÚN bloque real vigente (ver resolvesToRealBlock) —
 *   nunca series que ya pertenecen a un bloque real, aunque compartan
 *   exerciseId con el huérfano (p. ej. el bloque original de esas series se
 *   borró pero la rutina tiene hoy otro bloque distinto del mismo ejercicio). */
function setsForPlanExercise(plan: PlanExercise[], pe: PlanExercise, sets: SessionSet[]): SessionSet[] {
  const realBlocks = plan.filter((item) => !item.isOrphan);

  if (pe.isOrphan) {
    return sets.filter((s) => s.exerciseId === pe.exerciseId && !resolvesToRealBlock(realBlocks, s));
  }

  const firstRealBlockForExercise = realBlocks.find((item) => item.exerciseId === pe.exerciseId);
  const isFirstForExercise = firstRealBlockForExercise?.key === pe.key;
  return sets.filter((s) => {
    if (s.routineExerciseId != null) {
      return s.routineExerciseId === pe.key;
    }
    return s.exerciseId === pe.exerciseId && isFirstForExercise;
  });
}

/** Construye el plan de trabajo de una sesión: ejercicios de la rutina (si
 * todavía existe) más, al final, los ejercicios "huérfanos" que tienen series
 * registradas en esta sesión pero ya no están en la rutina (o la rutina se
 * borró) — nunca se pierden datos ya registrados. */
function buildPlan(routine: Routine | null, existingSets: SessionSet[], allExercises: Exercise[]): PlanExercise[] {
  const plan: PlanExercise[] = (routine?.exercises ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((re) => {
      const data = allExercises.find((item) => item.id === re.exerciseId);
      return {
        key: re.id,
        exerciseId: re.exerciseId,
        exerciseName: re.exerciseName,
        target: data?.target ?? '',
        category: data?.category ?? '',
        targetSets: re.targetSets,
        targetReps: re.targetReps,
        restSeconds: re.restSeconds,
        isOrphan: false,
      };
    });

  // Un set "resuelve" a un bloque real si su routineExerciseId apunta a uno
  // de ellos, o -en filas legacy sin routineExerciseId- si su exerciseId
  // coincide con alguno. Si no resuelve a ningún bloque real (el bloque que
  // lo tenía se borró de la rutina, o nunca hubo uno con ese exerciseId), es
  // huérfano. Misma regla que setsForPlanExercise, aplicada aquí sólo contra
  // `plan` porque en este punto todavía no contiene los propios huérfanos.
  const orphanIds = Array.from(
    new Set(existingSets.filter((s) => !resolvesToRealBlock(plan, s)).map((s) => s.exerciseId)),
  );
  orphanIds.forEach((exerciseId) => {
    const setsForExercise = existingSets.filter((s) => s.exerciseId === exerciseId && !resolvesToRealBlock(plan, s));
    const last = setsForExercise[setsForExercise.length - 1];
    const data = allExercises.find((item) => item.id === exerciseId);
    plan.push({
      key: `orphan-${exerciseId}`,
      exerciseId,
      exerciseName: last?.exerciseName ?? exerciseId,
      target: data?.target ?? '',
      category: data?.category ?? '',
      targetSets: setsForExercise.length,
      targetReps: 0,
      restSeconds: 0,
      isOrphan: true,
    });
  });

  return plan;
}

/** Última serie histórica de cada ejercicio real del plan (para el prefill
 * de la serie 1). Se ignoran los ejercicios huérfanos: no tienen filas nuevas. */
async function fetchHistoryMap(plan: PlanExercise[]): Promise<Record<string, SessionSet | undefined>> {
  const entries = await Promise.all(
    plan
      .filter((pe) => !pe.isOrphan)
      .map(async (pe): Promise<[string, SessionSet | undefined]> => {
        const history = await sessionsRepo.listSetsByExercise(pe.exerciseId);
        return [pe.exerciseId, history[history.length - 1]];
      }),
  );
  return Object.fromEntries(entries);
}

/** Prefill de peso/reps para una fila: serie 1 usa la última serie histórica
 * (o targetReps/peso vacío si no hay historial); las siguientes usan lo
 * registrado en la serie anterior de ESTA sesión (o el mismo fallback). */
function computeDraft(
  pe: PlanExercise,
  setNumber: number,
  setsForExercise: SessionSet[],
  historyLast: SessionSet | undefined,
): { weight: string; reps: string } {
  if (setNumber === 1) {
    if (historyLast) {
      return { weight: historyLast.weightKg.toString(), reps: historyLast.reps.toString() };
    }
    return { weight: '', reps: pe.targetReps.toString() };
  }
  const previous = setsForExercise.find((s) => s.setNumber === setNumber - 1);
  if (previous) {
    return { weight: previous.weightKg.toString(), reps: previous.reps.toString() };
  }
  return { weight: '', reps: pe.targetReps.toString() };
}

/** Series objetivo (de ejercicios reales, no huérfanos) que faltan por completar. */
function countRemaining(plan: PlanExercise[], currentSets: SessionSet[]): number {
  return plan
    .filter((pe) => !pe.isOrphan)
    .reduce((sum, pe) => {
      const done = setsForPlanExercise(plan, pe, currentSets).filter((s) => s.setNumber <= pe.targetSets).length;
      return sum + Math.max(0, pe.targetSets - done);
    }, 0);
}

const Entrenar: React.FC = () => {
  const { exercises, loading: exercisesLoading } = useExercises();

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [history, setHistory] = useState<Record<string, SessionSet | undefined>>({});

  const [pendingRoutine, setPendingRoutine] = useState<Routine | null>(null);
  const [restTrigger, setRestTrigger] = useState<RestTimerTrigger | null>(null);
  const [pendingFinishRemaining, setPendingFinishRemaining] = useState<number | null>(null);
  const [summary, setSummary] = useState<{ completedSets: number; volumeKg: number } | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const [enterNonce, setEnterNonce] = useState(0);
  useIonViewWillEnter(() => {
    setEnterNonce((n) => n + 1);
  });

  // Ionic no desmonta las páginas de las tabs al navegar entre ellas: sin
  // este flag, el setInterval del reloj del header seguía corriendo (y
  // re-renderizando) mientras la pestaña de Entrenar estaba oculta.
  const [isViewActive, setIsViewActive] = useState(true);
  useIonViewWillEnter(() => {
    setIsViewActive(true);
  });
  useIonViewWillLeave(() => {
    setIsViewActive(false);
  });

  /** Flag síncrono (no estado: se lee dentro del mismo tick en que
   * finishSession lo activa, sin esperar un re-render) que corta en seco
   * handleCompleteSet tras terminar la sesión. No depende de que el
   * IonAlert de resumen bloquee la UI (backdropDismiss no impide un toque
   * que ya estaba en vuelo, p. ej. un RestTimer o un doble toque previo). */
  const sessionFinishedRef = useRef(false);

  const bootstrap = async (): Promise<void> => {
    setPhase({ kind: 'loading' });
    const active = await sessionsRepo.getActive();
    if (!active) {
      const routines = await routinesRepo.list();
      setPhase({ kind: 'choose-routine', routines });
      return;
    }
    const age = Date.now() - active.session.startedAt;
    if (age > TWELVE_HOURS_MS) {
      setPhase({ kind: 'confirm-abandoned', session: active.session, sets: active.sets });
      return;
    }
    const routine = active.session.routineId ? await routinesRepo.get(active.session.routineId) : null;
    const plan = buildPlan(routine, active.sets, exercises);
    const historyMap = await fetchHistoryMap(plan);
    setHistory(historyMap);
    setSets(active.sets);
    sessionFinishedRef.current = false;
    setPhase({ kind: 'workout', session: active.session, plan });
  };

  useEffect(() => {
    if (enterNonce === 0 || exercisesLoading) {
      return;
    }
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterNonce, exercisesLoading]);

  // Reloj del encabezado: solo corre mientras hay una sesión en curso Y la
  // pestaña está visible (Ionic no desmonta las páginas al cambiar de tab).
  // Al volver a entrar, `isViewActive` pasa a true y el reloj se recalcula
  // solo porque `elapsedMs` deriva de `startedAt` contra Date.now(), no de un
  // contador acumulado.
  useEffect(() => {
    if (phase.kind !== 'workout' || !isViewActive) {
      return;
    }
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [phase.kind, isViewActive]);

  const handleConfirmStart = async () => {
    if (!pendingRoutine) {
      return;
    }
    const routine = pendingRoutine;
    setPendingRoutine(null);
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      routineId: routine.id,
      routineName: routine.name,
      startedAt: Date.now(),
      finishedAt: null,
    };
    await sessionsRepo.start(session);
    const plan = buildPlan(routine, [], exercises);
    const historyMap = await fetchHistoryMap(plan);
    setHistory(historyMap);
    setSets([]);
    sessionFinishedRef.current = false;
    setPhase({ kind: 'workout', session, plan });
  };

  const handleResumeAbandoned = async () => {
    if (phase.kind !== 'confirm-abandoned') {
      return;
    }
    const { session, sets: existingSets } = phase;
    const routine = session.routineId ? await routinesRepo.get(session.routineId) : null;
    const plan = buildPlan(routine, existingSets, exercises);
    const historyMap = await fetchHistoryMap(plan);
    setHistory(historyMap);
    setSets(existingSets);
    sessionFinishedRef.current = false;
    setPhase({ kind: 'workout', session, plan });
  };

  const handleCloseAbandoned = async () => {
    if (phase.kind !== 'confirm-abandoned') {
      return;
    }
    const { session, sets: existingSets } = phase;
    const finishedAt =
      existingSets.length > 0 ? Math.max(...existingSets.map((s) => s.completedAt)) : session.startedAt;
    await sessionsRepo.finish(session.id, finishedAt);
    await bootstrap();
  };

  const handleCompleteSet = async (
    pe: PlanExercise,
    setNumber: number,
    weightKg: number,
    reps: number,
    rpe: number | undefined,
  ) => {
    if (phase.kind !== 'workout') {
      return;
    }
    // Fix 6: guarda post-finish explícita, no depende del IonAlert de resumen.
    if (sessionFinishedRef.current) {
      return;
    }
    // Fix 3 (refuerzo): si esta serie de este bloque ya está registrada
    // (p. ej. por un doble toque que ganó la carrera antes de que SetRow
    // deshabilitara el botón), no la dupliques.
    const alreadyRecorded = setsForPlanExercise(phase.plan, pe, sets).some((s) => s.setNumber === setNumber);
    if (alreadyRecorded) {
      return;
    }
    const newSet: SessionSet = {
      id: crypto.randomUUID(),
      sessionId: phase.session.id,
      exerciseId: pe.exerciseId,
      exerciseName: pe.exerciseName,
      // Fix 1: referencia al bloque para no colisionar con otro bloque del
      // mismo ejercicio; los huérfanos no tienen un bloque real al que apuntar.
      routineExerciseId: pe.isOrphan ? undefined : pe.key,
      setNumber,
      weightKg,
      reps,
      rpe,
      completedAt: Date.now(),
    };
    await sessionsRepo.addSet(newSet);
    setSets((previous) => [...previous, newSet]);

    const realExercises = phase.plan.filter((item) => !item.isOrphan);
    const lastExercise = realExercises[realExercises.length - 1];
    const isLastOverall = lastExercise !== undefined && lastExercise.key === pe.key && setNumber === pe.targetSets;
    if (!isLastOverall) {
      setRestTrigger({ seconds: pe.restSeconds, nonce: Date.now() });
    }
  };

  const handleFinishRequest = () => {
    if (phase.kind !== 'workout') {
      return;
    }
    const remaining = countRemaining(phase.plan, sets);
    if (remaining > 0) {
      setPendingFinishRemaining(remaining);
    } else {
      void finishSession();
    }
  };

  const finishSession = async () => {
    if (phase.kind !== 'workout') {
      return;
    }
    // Activado síncronamente, antes de cualquier await: cierra la ventana en
    // la que handleCompleteSet podría seguir insertando series mientras el
    // finish está en curso o mientras se muestra el resumen.
    sessionFinishedRef.current = true;
    const finishedAt = Date.now();
    await sessionsRepo.finish(phase.session.id, finishedAt);
    localStorage.removeItem(REST_TIMER_STORAGE_KEY);
    setRestTrigger(null);
    const volumeKg = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
    setSummary({ completedSets: sets.length, volumeKg });
    setPendingFinishRemaining(null);
  };

  const handleSummaryDismiss = () => {
    setSummary(null);
    void bootstrap();
  };

  if (phase.kind === 'loading') {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Entrenar</IonTitle>
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

  if (phase.kind === 'choose-routine') {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Entrenar</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          {phase.routines.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '3rem 1.5rem',
                textAlign: 'center',
              }}
            >
              <IonIcon icon={barbell} style={{ fontSize: '4rem' }} color="medium" />
              <p>Aún no tienes rutinas</p>
              <IonButton routerLink="/tabs/rutinas">Ir a rutinas</IonButton>
            </div>
          ) : (
            <>
              <p className="ion-padding-horizontal" style={{ color: 'var(--ion-color-medium)' }}>
                Elige una rutina para entrenar
              </p>
              <IonList>
                {phase.routines.map((routine) => (
                  <IonItem key={routine.id} button onClick={() => setPendingRoutine(routine)}>
                    <IonLabel>
                      <h2>{routine.name}</h2>
                      <p>{routine.exercises.length} ejercicios</p>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </>
          )}

          <IonAlert
            isOpen={pendingRoutine !== null}
            header="Empezar rutina"
            message={pendingRoutine ? `¿Empezar "${pendingRoutine.name}"?` : ''}
            buttons={[
              { text: 'Cancelar', role: 'cancel', handler: () => setPendingRoutine(null) },
              { text: 'Empezar', handler: () => void handleConfirmStart() },
            ]}
            onDidDismiss={() => setPendingRoutine(null)}
          />
        </IonContent>
      </IonPage>
    );
  }

  if (phase.kind === 'confirm-abandoned') {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Entrenar</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--ion-color-medium)',
            }}
          >
            <p>Tienes una sesión sin terminar de {formatDateEs(phase.session.startedAt)}</p>
          </div>
          <IonAlert
            isOpen
            header="Sesión sin terminar"
            message={`Tienes una sesión sin terminar de ${formatDateEs(phase.session.startedAt)} (${phase.session.routineName}).`}
            buttons={[
              { text: 'Cerrar sesión', role: 'destructive', handler: () => void handleCloseAbandoned() },
              { text: 'Retomar', handler: () => void handleResumeAbandoned() },
            ]}
            backdropDismiss={false}
          />
        </IonContent>
      </IonPage>
    );
  }

  // phase.kind === 'workout'
  const elapsedMs = nowTick - phase.session.startedAt;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {phase.session.routineName}
            <div style={{ fontSize: '0.75rem', color: 'var(--ion-color-medium)', fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsed(elapsedMs)}
            </div>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleFinishRequest}>Terminar sesión</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {phase.plan.map((pe) => {
          const setsForExercise = setsForPlanExercise(phase.plan, pe, sets);
          // Fix 5: si targetSets se redujo mientras la sesión estaba activa,
          // no ocultes series ya registradas por encima del nuevo objetivo;
          // esas filas extra aparecen bloqueadas (ya están completadas).
          const maxRecordedSetNumber = setsForExercise.reduce((max, s) => Math.max(max, s.setNumber), 0);
          const rowCount = Math.max(pe.targetSets, maxRecordedSetNumber);
          return (
            <IonCard key={pe.key}>
              <IonCardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ExerciseAvatar target={pe.target} category={pe.category} size={32} />
                  <IonCardTitle style={{ fontSize: '1.05rem' }}>{pe.exerciseName}</IonCardTitle>
                </div>
              </IonCardHeader>
              <IonCardContent>
                {Array.from({ length: rowCount }, (_, i) => i + 1).map((setNumber) => {
                  const completed = setsForExercise.find((s) => s.setNumber === setNumber) ?? null;
                  const draft = computeDraft(pe, setNumber, setsForExercise, history[pe.exerciseId]);
                  return (
                    <SetRow
                      key={`${phase.session.id}-${pe.key}-${setNumber}`}
                      setNumber={setNumber}
                      completed={completed}
                      defaultWeightKg={draft.weight}
                      defaultReps={draft.reps}
                      onComplete={(weightKg, reps, rpe) => handleCompleteSet(pe, setNumber, weightKg, reps, rpe)}
                    />
                  );
                })}
              </IonCardContent>
            </IonCard>
          );
        })}
      </IonContent>

      <RestTimer trigger={restTrigger} />

      <IonAlert
        isOpen={pendingFinishRemaining !== null}
        header="Terminar sesión"
        message={`Quedan ${pendingFinishRemaining ?? 0} series sin completar. ¿Terminar de todos modos?`}
        buttons={[
          { text: 'Cancelar', role: 'cancel', handler: () => setPendingFinishRemaining(null) },
          { text: 'Terminar', role: 'destructive', handler: () => void finishSession() },
        ]}
        onDidDismiss={() => setPendingFinishRemaining(null)}
      />

      <IonAlert
        isOpen={summary !== null}
        header="Sesión terminada"
        message={summary ? `${summary.completedSets} series completadas · ${formatKg(summary.volumeKg)} de volumen total` : ''}
        buttons={[{ text: 'Aceptar', handler: handleSummaryDismiss }]}
        backdropDismiss={false}
      />
    </IonPage>
  );
};

export default Entrenar;
