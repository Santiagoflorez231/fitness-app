import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonPage,
  IonReorder,
  IonReorderGroup,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  type ItemReorderEventDetail,
} from '@ionic/react';
import { addOutline, alertCircleOutline, removeOutline, reorderThreeOutline, trashOutline } from 'ionicons/icons';
import { useExercises } from '../../hooks/useExercises';
import ExerciseAvatar, { capitalize } from '../../components/ExerciseAvatar';
import { normalize } from '../../utils/text';
import { estimateSessionMinutes } from '../../data/routineTemplates';
import { routinesRepo } from '../../db';
import type { Exercise } from '../../types/exercise';
import type { Routine, RoutineExercise } from '../../types/routine';
import './RoutineEditor.css';

const PICKER_PAGE_SIZE = 50;

const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 10;
const DEFAULT_REST_SECONDS = 90;

/** Tiempo tras el cual el dígito saliente se desmonta (debe cubrir la animación CSS de 120ms). */
const DIGIT_TRANSITION_MS = 130;

interface RoutineEditorParams {
  id?: string;
}

interface AnimatedNumberProps {
  value: string;
}

/**
 * Cifra con transición de "odómetro": al cambiar `value`, el dígito anterior
 * sube y se desvanece mientras el nuevo entra desde abajo (CSS puro,
 * transform/opacity). Ver .editor-stepper-digit-in/out en RoutineEditor.css.
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value }) => {
  const currentRef = useRef(value);
  const [renderValue, setRenderValue] = useState(value);
  const [outgoing, setOutgoing] = useState<string | null>(null);

  useEffect(() => {
    if (currentRef.current === value) {
      return;
    }
    setOutgoing(currentRef.current);
    currentRef.current = value;
    setRenderValue(value);
    const timeoutId = window.setTimeout(() => setOutgoing(null), DIGIT_TRANSITION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return (
    <span className="editor-stepper-track carga-num">
      {outgoing !== null && (
        <span key={`out-${outgoing}`} className="editor-stepper-digit editor-stepper-digit-out">
          {outgoing}
        </span>
      )}
      <span key={`in-${renderValue}`} className="editor-stepper-digit editor-stepper-digit-in">
        {renderValue}
      </span>
    </span>
  );
};

interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

/** Stepper de 44px con cifra tabular animada al centro, pensado para móvil. */
const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}) => {
  const decrease = () => onChange(Math.max(min, value - step));
  const increase = () => onChange(Math.min(max, value + step));

  return (
    <div className="editor-stepper">
      <span className="carga-overline editor-stepper-label">{label}</span>
      <div className="editor-stepper-controls">
        <button
          type="button"
          className="editor-stepper-btn"
          disabled={value <= min}
          aria-label={`Disminuir ${label}`}
          onClick={decrease}
        >
          <IonIcon icon={removeOutline} />
        </button>
        <AnimatedNumber value={`${value}${suffix ?? ''}`} />
        <button
          type="button"
          className="editor-stepper-btn"
          disabled={value >= max}
          aria-label={`Aumentar ${label}`}
          onClick={increase}
        >
          <IonIcon icon={addOutline} />
        </button>
      </div>
    </div>
  );
};

const RoutineEditor: React.FC = () => {
  const { id } = useParams<RoutineEditorParams>();
  const history = useHistory();
  const isEdit = id !== undefined;

  const { exercises: allExercises } = useExercises();

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);

  // Metadatos de la rutina original que se preservan al guardar en modo edición.
  const [originalRoutine, setOriginalRoutine] = useState<Routine | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerVisibleCount, setPickerVisibleCount] = useState(PICKER_PAGE_SIZE);

  useEffect(() => {
    if (!isEdit || !id) {
      return;
    }
    let cancelled = false;
    routinesRepo.get(id).then((routine) => {
      if (cancelled) {
        return;
      }
      if (!routine) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setOriginalRoutine(routine);
      setName(routine.name);
      setExercises(routine.exercises);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  const normalizedPickerSearch = useMemo(() => normalize(pickerSearch), [pickerSearch]);

  const pickerResults = useMemo<Exercise[]>(() => {
    if (!normalizedPickerSearch) {
      return allExercises;
    }
    return allExercises.filter((exercise) => normalize(exercise.name).includes(normalizedPickerSearch));
  }, [allExercises, normalizedPickerSearch]);

  useEffect(() => {
    setPickerVisibleCount(PICKER_PAGE_SIZE);
  }, [normalizedPickerSearch, showPicker]);

  const pickerVisible = pickerResults.slice(0, pickerVisibleCount);
  const pickerHasMore = pickerVisibleCount < pickerResults.length;

  const handlePickerInfinite = (event: CustomEvent<void>) => {
    window.setTimeout(() => {
      setPickerVisibleCount((previous) => Math.min(previous + PICKER_PAGE_SIZE, pickerResults.length));
      (event.target as HTMLIonInfiniteScrollElement).complete();
    }, 150);
  };

  const handleAddExercise = (exercise: Exercise) => {
    setExercises((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        position: previous.length,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps: DEFAULT_TARGET_REPS,
        restSeconds: DEFAULT_REST_SECONDS,
      },
    ]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const updateExercise = (index: number, patch: Partial<RoutineExercise>) => {
    setExercises((previous) =>
      previous.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise)),
    );
  };

  const handleRemoveExercise = (index: number) => {
    setExercises((previous) =>
      previous.filter((_, i) => i !== index).map((exercise, i) => ({ ...exercise, position: i })),
    );
  };

  const handleReorder = (event: CustomEvent<ItemReorderEventDetail>) => {
    setExercises((previous) => {
      const reordered = event.detail.complete(previous) as RoutineExercise[];
      return reordered.map((exercise, index) => ({ ...exercise, position: index }));
    });
  };

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && exercises.length > 0;

  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
  const estimatedMinutes = estimateSessionMinutes(exercises);

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    let position = originalRoutine?.position;
    if (position === undefined) {
      const existing = await routinesRepo.list();
      position = existing.reduce((max, routine) => Math.max(max, routine.position), -1) + 1;
    }

    const routine: Routine = {
      id: originalRoutine?.id ?? crypto.randomUUID(),
      name: trimmedName,
      position,
      archived: originalRoutine?.archived ?? false,
      createdAt: originalRoutine?.createdAt ?? Date.now(),
      exercises: exercises.map((exercise, index) => ({ ...exercise, position: index })),
    };

    await routinesRepo.save(routine);
    history.push('/tabs/rutinas');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/rutinas" />
          </IonButtons>
          <IonTitle size="small">{isEdit ? 'Editar rutina' : 'Nueva rutina'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              paddingTop: '4rem',
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        ) : notFound ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '1rem',
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '3rem' }} color="medium" />
            <p>Rutina no encontrada</p>
            <IonButton routerLink="/tabs/rutinas" routerDirection="back">
              Volver
            </IonButton>
          </div>
        ) : (
          <>
            <IonItem className="routine-editor-title-item" lines="none">
              <IonInput
                className="routine-editor-title-input"
                placeholder="Nombre de la rutina"
                value={name}
                onIonInput={(event) => setName(event.detail.value ?? '')}
              />
            </IonItem>

            <IonListHeader>
              <IonLabel className="carga-overline routine-editor-section-label">Ejercicios</IonLabel>
            </IonListHeader>

            {exercises.length === 0 ? (
              <p className="routine-editor-empty">
                Añade al menos un ejercicio para poder guardar la rutina.
              </p>
            ) : (
              <IonList className="routine-editor-list" lines="none">
                <IonReorderGroup disabled={false} onIonItemReorder={handleReorder}>
                  {exercises.map((exercise, index) => {
                    const exerciseData = allExercises.find((item) => item.id === exercise.exerciseId);
                    return (
                      <IonItemSliding key={exercise.id} className="editor-exercise-card">
                        <IonItem className="editor-exercise-item" lines="none">
                          <IonReorder slot="start">
                            <div className="editor-handle" aria-label="Arrastrar para reordenar">
                              <IonIcon icon={reorderThreeOutline} />
                            </div>
                          </IonReorder>
                          <ExerciseAvatar
                            target={exerciseData?.target ?? ''}
                            category={exerciseData?.category ?? ''}
                          />
                          <IonLabel className="ion-text-wrap editor-exercise-label">
                            <h2 className="editor-exercise-name">{exercise.exerciseName}</h2>
                            <div className="editor-stepper-row">
                              <NumberStepper
                                label="Series"
                                value={exercise.targetSets}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(value) => updateExercise(index, { targetSets: value })}
                              />
                              <NumberStepper
                                label="Reps"
                                value={exercise.targetReps}
                                min={1}
                                max={50}
                                step={1}
                                onChange={(value) => updateExercise(index, { targetReps: value })}
                              />
                              <NumberStepper
                                label="Descanso"
                                value={exercise.restSeconds}
                                min={15}
                                max={600}
                                step={15}
                                suffix="s"
                                onChange={(value) => updateExercise(index, { restSeconds: value })}
                              />
                            </div>
                          </IonLabel>
                        </IonItem>
                        <IonItemOptions side="end">
                          <IonItemOption color="danger" onClick={() => handleRemoveExercise(index)}>
                            <IonIcon icon={trashOutline} slot="icon-only" />
                          </IonItemOption>
                        </IonItemOptions>
                      </IonItemSliding>
                    );
                  })}
                </IonReorderGroup>
              </IonList>
            )}

            <div className="routine-editor-add">
              <IonButton expand="block" fill="outline" onClick={() => setShowPicker(true)}>
                <IonIcon icon={addOutline} slot="start" />
                Añadir ejercicio
              </IonButton>
            </div>
          </>
        )}

        <IonModal isOpen={showPicker} onDidDismiss={() => setShowPicker(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Añadir ejercicio</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowPicker(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
            <IonToolbar>
              <IonSearchbar
                placeholder="Buscar ejercicio…"
                debounce={300}
                value={pickerSearch}
                onIonInput={(event) => setPickerSearch(event.detail.value ?? '')}
              />
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <IonList lines="none">
              {pickerVisible.map((exercise) => (
                <IonItem
                  key={exercise.id}
                  className="picker-row"
                  button
                  detail={false}
                  onClick={() => handleAddExercise(exercise)}
                >
                  <ExerciseAvatar target={exercise.target} category={exercise.category} size={44} />
                  <IonLabel className="ion-text-wrap" style={{ marginInlineStart: '12px' }}>
                    <h2 className="picker-row-name">{exercise.name}</h2>
                    <p className="picker-row-meta">
                      {capitalize(exercise.target)} · {capitalize(exercise.equipment)}
                    </p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
            <IonInfiniteScroll
              onIonInfinite={handlePickerInfinite}
              threshold="100px"
              disabled={!pickerHasMore}
            >
              <IonInfiniteScrollContent loadingText="Cargando más ejercicios…" />
            </IonInfiniteScroll>
          </IonContent>
        </IonModal>
      </IonContent>

      {!loading && !notFound && (
        <IonFooter>
          <IonToolbar className="routine-editor-footer-toolbar">
            <div className="routine-editor-footer-inner">
              <div className="routine-editor-footer-totals">
                <p>
                  <span className="carga-num">Σ {totalSets}</span> series ·{' '}
                  <span className="carga-num">~{estimatedMinutes}</span> min · volumen estimado se
                  calcula al entrenar
                </p>
              </div>
              <IonButton
                className="routine-editor-footer-save"
                shape="round"
                strong
                disabled={!canSave}
                onClick={handleSave}
              >
                Guardar
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
};

export default RoutineEditor;
