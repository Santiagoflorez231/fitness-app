import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { barbell, chevronDown, chevronUp } from 'ionicons/icons';
import { routinesRepo, sessionsRepo } from '../../db';
import { addAdhocBlock, listAdhocBlocks, clearAdhocBlocks, type AdhocBlock } from '../../db/adhocBlocks';
import { consumeStartExerciseRequest } from '../../db/startExerciseRequest';
import { useExercises } from '../../hooks/useExercises';
import { estimateSessionMinutes } from '../../data/routineTemplates';
import ExerciseAvatar from '../../components/ExerciseAvatar';
import SetRow from '../../components/SetRow';
import RestTimer, { type RestTimerTrigger } from '../../components/RestTimer';
import PlateCalculator, { type PlateCalculatorMode } from '../../components/PlateCalculator';
import ExerciseHistorySheet from '../../components/ExerciseHistorySheet';
import ExercisePickerSheet from '../../components/ExercisePickerSheet';
import { localCoachAdvisor } from '../../coach/localCoach';
import { hapticPr, hapticSetDone } from '../../utils/haptics';
import type { Exercise } from '../../types/exercise';
import type { Routine, SessionSet, WorkoutSession } from '../../types/routine';
import './Entrenar.css';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const REST_TIMER_STORAGE_KEY = 'fitness.restTimer';
/** RPE objetivo por defecto de una serie de trabajo (no hay RPE objetivo por
 * rutina en el modelo de datos); alimenta la sugerencia de carga del Coach. */
const COACH_TARGET_RPE = 8;

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

function formatEsNum(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(value);
}

/** Estimación de 1RM de Epley: weight x (1 + reps/30). */
function epleyE1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
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

/** Convierte un bloque ad-hoc persistido (src/db/adhocBlocks.ts) en el
 * PlanExercise real equivalente: misma forma que un bloque de rutina, con
 * `key` = `block.key` (así setsForPlanExercise lo resuelve sin ningún caso
 * especial, vía `routineExerciseId === pe.key` en las series que genere). */
function planExerciseFromAdhocBlock(block: AdhocBlock): PlanExercise {
  return {
    key: block.key,
    exerciseId: block.exerciseId,
    exerciseName: block.exerciseName,
    target: block.target,
    category: block.category,
    targetSets: block.targetSets,
    targetReps: block.targetReps,
    restSeconds: block.restSeconds,
    isOrphan: false,
  };
}

/** Construye el plan de trabajo de una sesión: ejercicios de la rutina (si
 * todavía existe), luego los bloques ad-hoc (ejercicios añadidos en caliente,
 * ver src/db/adhocBlocks.ts) y, al final, los ejercicios "huérfanos" que
 * tienen series registradas en esta sesión pero no resuelven a ningún bloque
 * real vigente (ni de rutina ni ad-hoc) — nunca se pierden datos registrados. */
function buildPlan(
  routine: Routine | null,
  existingSets: SessionSet[],
  allExercises: Exercise[],
  adhocBlocks: AdhocBlock[] = [],
): PlanExercise[] {
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

  // Bloques ad-hoc: se appendean como bloques reales, en el orden en que se
  // añadieron. A partir de aquí `plan` (rutina + ad-hoc) es la base contra la
  // que se calcula qué series son huérfanas más abajo.
  adhocBlocks.forEach((block) => {
    plan.push(planExerciseFromAdhocBlock(block));
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

/** Historial pre-cargado (antes de esta sesión) de un ejercicio del plan. */
interface HistoryEntry {
  /** Último set registrado (cualquier setNumber) antes de esta sesión: usado
   * para el prefill de la serie 1 -- computeDraft, comportamiento sin cambios. */
  last: SessionSet | undefined;
  /** Máximo peso histórico antes de esta sesión (PR en vivo). */
  maxWeightKg: number;
  /** Mejor e1RM histórico antes de esta sesión, Epley (chip %1RM y hero). */
  bestE1rm: number;
  /** Series de la sesión anterior más reciente de este ejercicio, indexadas
   * por setNumber ("valor fantasma" tocable en cada fila). */
  previousSessionBySetNumber: Record<number, SessionSet>;
}

type HistoryMap = Record<string, HistoryEntry>;

/** Historial (antes de esta sesión) de un único ejercicio. Extraído de
 * fetchHistoryMap para poder recalcular la entrada de UN ejercicio cuando se
 * añade un bloque ad-hoc a una sesión ya en curso, sin recalcular el resto. */
async function fetchHistoryEntry(exerciseId: string): Promise<HistoryEntry> {
  const history = await sessionsRepo.listSetsByExercise(exerciseId);
  const last = history[history.length - 1];
  const maxWeightKg = history.reduce((max, s) => Math.max(max, s.weightKg), 0);
  const bestE1rm = history.reduce((max, s) => Math.max(max, epleyE1rm(s.weightKg, s.reps)), 0);
  const previousSessionBySetNumber: Record<number, SessionSet> = {};
  if (last) {
    history
      .filter((s) => s.sessionId === last.sessionId)
      .forEach((s) => {
        previousSessionBySetNumber[s.setNumber] = s;
      });
  }
  return { last, maxWeightKg, bestE1rm, previousSessionBySetNumber };
}

/** Historial de cada ejercicio real del plan (se ignoran los huérfanos: no
 * tienen filas nuevas). Se calcula una única vez al iniciar/retomar la
 * sesión, así que "antes de esta sesión" es literal para todo su contenido.
 * Cubre también los bloques ad-hoc: son bloques reales (isOrphan: false) del
 * plan igual que los de rutina, así que su historial se carga aquí gratis. */
async function fetchHistoryMap(plan: PlanExercise[]): Promise<HistoryMap> {
  const entries = await Promise.all(
    plan
      .filter((pe) => !pe.isOrphan)
      .map(async (pe): Promise<[string, HistoryEntry]> => [pe.exerciseId, await fetchHistoryEntry(pe.exerciseId)]),
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

/** Series objetivo (de un ejercicio real) que faltan por completar. */
function pendingCountForExercise(plan: PlanExercise[], pe: PlanExercise, currentSets: SessionSet[]): number {
  const done = setsForPlanExercise(plan, pe, currentSets).filter((s) => s.setNumber <= pe.targetSets).length;
  return Math.max(0, pe.targetSets - done);
}

/** Series objetivo (de ejercicios reales, no huérfanos) que faltan por completar. */
function countRemaining(plan: PlanExercise[], currentSets: SessionSet[]): number {
  return plan.filter((pe) => !pe.isOrphan).reduce((sum, pe) => sum + pendingCountForExercise(plan, pe, currentSets), 0);
}

/** Primer setNumber (1..rowCount) sin serie registrada, o null si están todas. */
function nextPendingSetNumber(setsForExercise: SessionSet[], rowCount: number): number | null {
  for (let n = 1; n <= rowCount; n += 1) {
    if (!setsForExercise.some((s) => s.setNumber === n)) {
      return n;
    }
  }
  return null;
}

function parseWeightOrNull(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const Entrenar: React.FC = () => {
  const { exercises, loading: exercisesLoading } = useExercises();

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [history, setHistory] = useState<HistoryMap>({});

  const [pendingRoutine, setPendingRoutine] = useState<Routine | null>(null);
  const [restTrigger, setRestTrigger] = useState<RestTimerTrigger | null>(null);
  const [pendingFinishRemaining, setPendingFinishRemaining] = useState<number | null>(null);
  const [summary, setSummary] = useState<{ completedSets: number; volumeKg: number } | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Estado visual/aditivo (no afecta a la persistencia ni a la resolución de
  // series): tarjetas expandidas, filas extra por bloque, PR en vivo y las
  // dos herramientas nuevas.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [extraRows, setExtraRows] = useState<Record<string, number>>({});
  const [prKeys, setPrKeys] = useState<Set<string>>(new Set());
  const [plateCalc, setPlateCalc] = useState<{ open: boolean; weightKg: number | null; mode: PlateCalculatorMode }>({
    open: false,
    weightKg: null,
    mode: 'plates',
  });
  const [historySheet, setHistorySheet] = useState<{ open: boolean; exerciseId: string | null; exerciseName: string }>({
    open: false,
    exerciseId: null,
    exerciseName: '',
  });
  // Picker "+ Ejercicio": añadir un bloque ad-hoc a la sesión en curso.
  const [pickerOpen, setPickerOpen] = useState(false);

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

  // Ejercicio "actual": el primero (no huérfano) con series pendientes. Se
  // recalcula cada render a partir de `phase`/`sets`; no es un hook, así que
  // puede vivir junto al resto de hooks sin alterar su orden entre renders.
  const currentPe: PlanExercise | null =
    phase.kind === 'workout'
      ? phase.plan.find((pe) => !pe.isOrphan && pendingCountForExercise(phase.plan, pe, sets) > 0) ?? null
      : null;

  // Expande automáticamente la card del ejercicio actual cuando cambia
  // (y contrae la anterior), sin pisar los toggles manuales del usuario en
  // el resto de cards.
  const prevCurrentKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase.kind !== 'workout') {
      return;
    }
    const key = currentPe?.key ?? null;
    if (key === prevCurrentKeyRef.current) {
      return;
    }
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      if (prevCurrentKeyRef.current) {
        next.delete(prevCurrentKeyRef.current);
      }
      if (key) {
        next.add(key);
      }
      return next;
    });
    prevCurrentKeyRef.current = key;
  }, [phase.kind, currentPe]);

  /** Construye el plan (rutina + bloques ad-hoc ya persistidos de esa
   * sesión) y entra en fase workout. Punto de entrada único para "ya sé qué
   * sesión y qué rutina toca mostrar" -- usado por bootstrap (sesión activa
   * vigente) y por handleResumeAbandoned (retomar una sesión abandonada).
   * `expandKey`, si se indica, expande esa card además de la que auto-expanda
   * el efecto de "ejercicio actual". */
  const enterWorkout = async (
    session: WorkoutSession,
    existingSets: SessionSet[],
    routine: Routine | null,
    expandKey?: string,
  ): Promise<void> => {
    const adhocBlocks = listAdhocBlocks(session.id);
    const plan = buildPlan(routine, existingSets, exercises, adhocBlocks);
    const historyMap = await fetchHistoryMap(plan);
    setHistory(historyMap);
    setSets(existingSets);
    sessionFinishedRef.current = false;
    setExtraRows({});
    setPrKeys(new Set());
    setPhase({ kind: 'workout', session, plan });
    if (expandKey) {
      setExpandedKeys((previous) => {
        const next = new Set(previous);
        next.add(expandKey);
        return next;
      });
    }
  };

  /** Si hay una petición "COMENZAR desde Detalle" pendiente (carga.startExercise,
   * ver src/db/startExerciseRequest.ts) Y resuelve a un ejercicio real, la
   * consume (leer + borrar, siempre) y persiste su bloque ad-hoc en
   * `sessionId`. Devuelve la key del bloque nuevo (para expandirlo), o
   * undefined si no había petición o no resolvió a ningún ejercicio conocido. */
  const consumePendingStartExercise = (sessionId: string): string | undefined => {
    const request = consumeStartExerciseRequest();
    const exercise = request ? exercises.find((item) => item.id === request.exerciseId) : undefined;
    return exercise ? addAdhocBlock(sessionId, exercise).key : undefined;
  };

  /** Arranca una sesión libre (routineId null, "Sesión libre") vacía o, si se
   * indica `initialExercise`, con ese ejercicio ya dentro como bloque ad-hoc
   * (COMENZAR desde Detalle sin sesión activa). */
  const startFreeSession = async (initialExercise?: Exercise): Promise<void> => {
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      routineId: null,
      routineName: 'Sesión libre',
      startedAt: Date.now(),
      finishedAt: null,
    };
    await sessionsRepo.start(session);
    const block = initialExercise ? addAdhocBlock(session.id, initialExercise) : null;
    await enterWorkout(session, [], null, block?.key);
  };

  const bootstrap = async (): Promise<void> => {
    setPhase({ kind: 'loading' });
    const active = await sessionsRepo.getActive();
    if (!active) {
      // Sin sesión activa: consumimos carga.startExercise aquí (leer +
      // borrar siempre). Si resuelve a un ejercicio real, arrancamos una
      // sesión libre con él ya dentro; si no, seguimos a elegir rutina.
      const startRequest = consumeStartExerciseRequest();
      const startExercise = startRequest ? exercises.find((item) => item.id === startRequest.exerciseId) : undefined;
      if (startExercise) {
        await startFreeSession(startExercise);
        return;
      }
      const routines = await routinesRepo.list();
      setPhase({ kind: 'choose-routine', routines });
      return;
    }
    const age = Date.now() - active.session.startedAt;
    if (age > TWELVE_HOURS_MS) {
      // Decisión: NO consumimos carga.startExercise en esta rama. Con una
      // sesión abandonada por resolver, la petición se deja intacta hasta
      // que el usuario la resuelva (retomar o cerrar) -- handleResumeAbandoned
      // la consume al retomar; handleCloseAbandoned llama a bootstrap() de
      // nuevo al cerrar, que la consumirá entonces desde la rama `!active`.
      setPhase({ kind: 'confirm-abandoned', session: active.session, sets: active.sets });
      return;
    }
    const routine = active.session.routineId ? await routinesRepo.get(active.session.routineId) : null;
    const newBlockKey = consumePendingStartExercise(active.session.id);
    await enterWorkout(active.session, active.sets, routine, newBlockKey);
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
    setExtraRows({});
    setPrKeys(new Set());
    setPhase({ kind: 'workout', session, plan });
  };

  const handleResumeAbandoned = async () => {
    if (phase.kind !== 'confirm-abandoned') {
      return;
    }
    const { session, sets: existingSets } = phase;
    const routine = session.routineId ? await routinesRepo.get(session.routineId) : null;
    // La sesión abandonada queda resuelta (retomada): si había una petición
    // "COMENZAR desde Detalle" pendiente, se consume ahora.
    const newBlockKey = consumePendingStartExercise(session.id);
    await enterWorkout(session, existingSets, routine, newBlockKey);
  };

  const handleCloseAbandoned = async () => {
    if (phase.kind !== 'confirm-abandoned') {
      return;
    }
    const { session, sets: existingSets } = phase;
    const finishedAt =
      existingSets.length > 0 ? Math.max(...existingSets.map((s) => s.completedAt)) : session.startedAt;
    await sessionsRepo.finish(session.id, finishedAt);
    clearAdhocBlocks(session.id);
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

    // PR en vivo (aditivo, no afecta a la persistencia): máximo histórico
    // previo a esta sesión (history map, cargado una vez al empezar) más el
    // máximo ya registrado de este ejercicio EN esta sesión, antes de esta serie.
    const historicalMax = history[pe.exerciseId]?.maxWeightKg ?? 0;
    const sessionMaxSoFar = sets
      .filter((s) => s.exerciseId === pe.exerciseId)
      .reduce((max, s) => Math.max(max, s.weightKg), 0);
    const isPR = weightKg > Math.max(historicalMax, sessionMaxSoFar);

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
    // Háptico tras persistir (fire-and-forget, nunca bloquea el flujo):
    // serie normal = golpe seco; PR = notificación de éxito (celebra).
    if (isPR) {
      void hapticPr();
      const prKey = `${pe.key}#${setNumber}`;
      setPrKeys((previous) => {
        const next = new Set(previous);
        next.add(prKey);
        return next;
      });
    } else {
      void hapticSetDone();
    }

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
    clearAdhocBlocks(phase.session.id);
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

  const toggleExpanded = (key: string) => {
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /** "+ Serie" en caliente: añade una fila editable extra al bloque, por
   * encima de rowCount base. No cuenta como pendiente (countRemaining sigue
   * mirando solo targetSets) y no toca la fórmula protegida de rowCount. */
  const handleAddExtraRow = (pe: PlanExercise) => {
    setExtraRows((previous) => ({ ...previous, [pe.key]: (previous[pe.key] ?? 0) + 1 }));
  };

  /** Card "Entrenamiento libre" en choose-routine: sesión sin rutina, vacía. */
  const handleStartFreeSession = () => {
    void startFreeSession();
  };

  /** "+ Ejercicio" en caliente (picker): añade `exercise` como bloque ad-hoc
   * al final del plan de la sesión en curso, lo expande y precarga su
   * historial (chip/ghost/%1RM del Coach funcionan igual que en un bloque de
   * rutina, ver fetchHistoryEntry). Puramente aditivo sobre `phase.plan`. */
  const handleAddAdhocExercise = async (exercise: Exercise) => {
    if (phase.kind !== 'workout') {
      return;
    }
    const block = addAdhocBlock(phase.session.id, exercise);
    const newPe = planExerciseFromAdhocBlock(block);
    setPhase({ kind: 'workout', session: phase.session, plan: [...phase.plan, newPe] });
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      next.add(newPe.key);
      return next;
    });
    setPickerOpen(false);
    const entry = await fetchHistoryEntry(exercise.id);
    setHistory((previous) => ({ ...previous, [exercise.id]: entry }));
  };

  const openPlates = (weightKg: number | null) => setPlateCalc({ open: true, weightKg, mode: 'plates' });
  const openWarmup = (weightKg: number | null) => setPlateCalc({ open: true, weightKg, mode: 'warmup' });
  const openHistory = (exerciseId: string, exerciseName: string) =>
    setHistorySheet({ open: true, exerciseId, exerciseName });

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
        <IonContent fullscreen className="entrenar-content">
          <p className="carga-overline entrenar-choose-overline">Elige tu carga</p>
          <div className="entrenar-choose-list">
            <button
              type="button"
              className="carga-card entrenar-choose-card entrenar-choose-free"
              onClick={handleStartFreeSession}
            >
              <h2 className="entrenar-choose-card-name">Entrenamiento libre</h2>
              <p className="entrenar-choose-free-desc">Sin guion. Añade ejercicios sobre la marcha.</p>
            </button>

            {phase.routines.length === 0 ? (
              <div className="entrenar-empty entrenar-empty-inline">
                <IonIcon icon={barbell} className="entrenar-empty-icon" />
                <p className="entrenar-empty-text">Crea una rutina para repetirla cada vez que entrenes.</p>
                <IonButton routerLink="/tabs/rutinas">Ir a rutinas</IonButton>
              </div>
            ) : (
              phase.routines.map((routine) => {
                const exerciseCount = routine.exercises.length;
                const setCount = routine.exercises.reduce((sum, e) => sum + e.targetSets, 0);
                const minutes = estimateSessionMinutes(routine.exercises);
                return (
                  <button
                    type="button"
                    key={routine.id}
                    className="carga-card entrenar-choose-card"
                    onClick={() => setPendingRoutine(routine)}
                  >
                    <h2 className="entrenar-choose-card-name">{routine.name}</h2>
                    <p className="carga-overline entrenar-choose-card-meta">
                      {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ~{setCount}{' '}
                      {setCount === 1 ? 'serie' : 'series'} · ~{minutes} min
                    </p>
                  </button>
                );
              })
            )}
          </div>

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
            <div className="entrenar-toolbar-title">
              <span className="entrenar-toolbar-routine">{phase.session.routineName}</span>
              <span className="carga-num entrenar-toolbar-clock">{formatElapsed(elapsedMs)}</span>
            </div>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton color="danger" fill="clear" onClick={handleFinishRequest}>
              Terminar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="entrenar-content">
        {phase.plan.length === 0 ? (
          <div className="entrenar-empty">
            <IonIcon icon={barbell} className="entrenar-empty-icon" />
            <p className="carga-overline">Sesión libre</p>
            <p className="entrenar-empty-text">Sin guion. Añade tu primer ejercicio.</p>
            <button
              type="button"
              className="entrenar-add-exercise entrenar-add-exercise-hero"
              onClick={() => setPickerOpen(true)}
            >
              + Ejercicio
            </button>
          </div>
        ) : (
        <div className="entrenar-list">
          {phase.plan.map((pe) => {
            const setsForExercise = setsForPlanExercise(phase.plan, pe, sets);
            // Fix 5: si targetSets se redujo mientras la sesión estaba activa,
            // no ocultes series ya registradas por encima del nuevo objetivo;
            // esas filas extra aparecen bloqueadas (ya están completadas).
            const maxRecordedSetNumber = setsForExercise.reduce((max, s) => Math.max(max, s.setNumber), 0);
            const baseRowCount = Math.max(pe.targetSets, maxRecordedSetNumber);
            // "+ Serie" en caliente: extiende el render por encima de la
            // fórmula protegida anterior, sin modificarla.
            const rowCount = baseRowCount + (extraRows[pe.key] ?? 0);

            const historyEntry = history[pe.exerciseId];
            // Sugerencia de carga del Coach (A1) desde la última serie previa a
            // esta sesión; devuelve null si esa serie no tenía RPE (sin ruido).
            // Puramente informativa: no toca la resolución de series ni la persistencia.
            const coachSuggestion = historyEntry?.last
              ? localCoachAdvisor.suggestNextLoad({
                  lastSet: {
                    weightKg: historyEntry.last.weightKg,
                    reps: historyEntry.last.reps,
                    rpe: historyEntry.last.rpe,
                  },
                  targetReps: pe.targetReps,
                  targetRpe: COACH_TARGET_RPE,
                })
              : null;
            const isExpanded = expandedKeys.has(pe.key);
            const isCurrentCard = currentPe?.key === pe.key;
            const doneCount = setsForExercise.filter((s) => s.setNumber <= pe.targetSets).length;

            const pendingSetNumber = nextPendingSetNumber(setsForExercise, rowCount);
            let repWeightKg: number | null = null;
            if (pendingSetNumber !== null) {
              const draft = computeDraft(pe, pendingSetNumber, setsForExercise, historyEntry?.last);
              repWeightKg = parseWeightOrNull(draft.weight);
            } else {
              const lastSet = setsForExercise[setsForExercise.length - 1];
              repWeightKg = lastSet ? lastSet.weightKg : null;
            }
            const warmupDraft = computeDraft(pe, 1, setsForExercise, historyEntry?.last);
            const warmupWeightKg = parseWeightOrNull(warmupDraft.weight) ?? repWeightKg;

            let heroWeightKg: number | null = null;
            let heroPct: number | null = null;
            if (isCurrentCard && pendingSetNumber !== null) {
              const heroDraft = computeDraft(pe, pendingSetNumber, setsForExercise, historyEntry?.last);
              heroWeightKg = parseWeightOrNull(heroDraft.weight);
              if (heroWeightKg !== null && historyEntry?.bestE1rm) {
                heroPct = Math.round((heroWeightKg / historyEntry.bestE1rm) * 100);
              }
            }

            return (
              <div key={pe.key} className={`carga-card entrenar-card${isCurrentCard ? ' entrenar-card-current' : ''}`}>
                <div className="entrenar-card-header">
                  <button
                    type="button"
                    className="entrenar-card-heading"
                    onClick={() => openHistory(pe.exerciseId, pe.exerciseName)}
                  >
                    <ExerciseAvatar target={pe.target} category={pe.category} size={isCurrentCard ? 40 : 32} />
                    <span className={`entrenar-card-name${isCurrentCard ? ' entrenar-card-name-current' : ''}`}>
                      {pe.exerciseName}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="entrenar-card-expand"
                    onClick={() => toggleExpanded(pe.key)}
                    aria-label={isExpanded ? 'Contraer ejercicio' : 'Expandir ejercicio'}
                  >
                    <IonIcon icon={isExpanded ? chevronUp : chevronDown} />
                  </button>
                </div>

                <div className="entrenar-card-tools">
                  <button type="button" className="entrenar-tool-btn" onClick={() => openPlates(repWeightKg)}>
                    Discos
                  </button>
                  <button type="button" className="entrenar-tool-btn" onClick={() => openWarmup(warmupWeightKg)}>
                    Aproximación
                  </button>
                </div>

                {!isExpanded && (
                  <p className="entrenar-card-progress">
                    {doneCount}/{pe.targetSets} series
                  </p>
                )}

                {isCurrentCard && isExpanded && (
                  <div className="entrenar-hero">
                    <p className="carga-overline">Próxima serie</p>
                    <div className="carga-num entrenar-hero-num">
                      {heroWeightKg !== null ? (
                        <>
                          {formatEsNum(heroWeightKg)}
                          <span className="entrenar-hero-unit">kg</span> × {pe.targetReps}
                          {heroPct !== null && <span className="entrenar-hero-pct"> · {heroPct} %</span>}
                        </>
                      ) : (
                        <>× {pe.targetReps}</>
                      )}
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="entrenar-card-rows">
                    {Array.from({ length: rowCount }, (_, i) => i + 1).map((setNumber) => {
                      const completedSet = setsForExercise.find((s) => s.setNumber === setNumber) ?? null;
                      const draft = computeDraft(pe, setNumber, setsForExercise, historyEntry?.last);
                      const ghostSet = historyEntry?.previousSessionBySetNumber[setNumber];
                      const prKey = `${pe.key}#${setNumber}`;
                      return (
                        <div key={`${phase.session.id}-${pe.key}-${setNumber}`} className="entrenar-setrow-wrap">
                          <SetRow
                            setNumber={setNumber}
                            completed={completedSet}
                            defaultWeightKg={draft.weight}
                            defaultReps={draft.reps}
                            bestE1rmKg={historyEntry?.bestE1rm}
                            ghost={ghostSet ? { weightKg: ghostSet.weightKg, reps: ghostSet.reps } : undefined}
                            suggestion={
                              coachSuggestion && setNumber === pendingSetNumber
                                ? { weightKg: coachSuggestion.weightKg }
                                : undefined
                            }
                            onComplete={(weightKg, reps, rpe) => handleCompleteSet(pe, setNumber, weightKg, reps, rpe)}
                          />
                          {prKeys.has(prKey) && <span className="pr-pop entrenar-pr-chip">PR</span>}
                        </div>
                      );
                    })}
                    {!pe.isOrphan && (
                      <button type="button" className="entrenar-add-row" onClick={() => handleAddExtraRow(pe)}>
                        + Serie
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="entrenar-add-exercise" onClick={() => setPickerOpen(true)}>
            + Ejercicio
          </button>
        </div>
        )}

        {summary && (
          <div className="entrenar-summary-backdrop" role="alertdialog" aria-modal="true">
            <div className="entrenar-summary-card">
              <p className="carga-overline">Sesión terminada</p>
              <p className="entrenar-summary-line">
                {summary.completedSets} {summary.completedSets === 1 ? 'serie completada' : 'series completadas'}
              </p>
              <div className="carga-num entrenar-summary-volume">
                {formatEsNum(summary.volumeKg)}
                <span className="entrenar-summary-unit">kg</span>
              </div>
              <p className="entrenar-summary-tagline">Trabajo hecho.</p>
              <button type="button" className="entrenar-summary-btn" onClick={handleSummaryDismiss}>
                Aceptar
              </button>
            </div>
          </div>
        )}
      </IonContent>

      <RestTimer trigger={restTrigger} />

      <PlateCalculator
        isOpen={plateCalc.open}
        onDismiss={() => setPlateCalc((previous) => ({ ...previous, open: false }))}
        initialWeightKg={plateCalc.weightKg}
        initialMode={plateCalc.mode}
      />

      <ExerciseHistorySheet
        isOpen={historySheet.open}
        onDismiss={() => setHistorySheet((previous) => ({ ...previous, open: false }))}
        exerciseId={historySheet.exerciseId}
        exerciseName={historySheet.exerciseName}
      />

      <ExercisePickerSheet
        isOpen={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onPick={(exercise) => void handleAddAdhocExercise(exercise)}
      />

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
    </IonPage>
  );
};

export default Entrenar;
