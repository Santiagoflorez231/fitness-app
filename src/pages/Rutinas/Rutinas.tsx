import { useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonToast,
  useIonViewWillEnter,
} from '@ionic/react';
import { add, archiveOutline, chevronBackOutline, copyOutline, sparklesOutline } from 'ionicons/icons';
import { routinesRepo } from '../../db';
import { useExercises } from '../../hooks/useExercises';
import {
  ROUTINE_TEMPLATES,
  estimateSessionMinutes,
  instantiateTemplate,
  type RoutineTemplate,
} from '../../data/routineTemplates';
import {
  generatePlan,
  type DaysPerWeek,
  type EquipmentTier,
  type RoutineSplit,
} from '../../coach/routineGenerator';
import CargaSkeleton from '../../components/CargaSkeleton';
import type { Routine } from '../../types/routine';
import './Rutinas.css';

/** Días por semana ofrecidos en el paso 1 del wizard (RoutineIntent.daysPerWeek). */
const WIZARD_DAYS_OPTIONS: DaysPerWeek[] = [2, 3, 4, 5];

/** Splits ofrecidos en el paso 2, con la descripción a una línea (tono CARGA). */
const WIZARD_SPLIT_OPTIONS: { value: RoutineSplit; name: string; description: string }[] = [
  { value: 'fullbody', name: 'Full Body', description: 'Todo el cuerpo cada sesión. Ideal a 2-3 días.' },
  { value: 'ppl', name: 'Empuje / Tirón / Pierna', description: 'Un patrón de movimiento por día. Para 3-6 días.' },
  { value: 'torso-pierna', name: 'Torso / Pierna', description: 'Tren superior e inferior alternados.' },
];

/** Niveles de equipo ofrecidos en el paso 3 (RoutineIntent.equipment). */
const WIZARD_EQUIPMENT_OPTIONS: { value: EquipmentTier; label: string }[] = [
  { value: 'gym', label: 'Gimnasio completo' },
  { value: 'basico', label: 'Básico: barra y mancuernas' },
  { value: 'casa', label: 'Casa: peso corporal y mancuernas' },
];

/** Total de series objetivo de una rutina (suma de targetSets de sus ejercicios). */
function totalTargetSets(routine: Routine): number {
  return routine.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
}

const Rutinas: React.FC = () => {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardDays, setWizardDays] = useState<DaysPerWeek | null>(null);
  const [wizardSplit, setWizardSplit] = useState<RoutineSplit | null>(null);
  const [wizardGenerating, setWizardGenerating] = useState(false);
  const listRef = useRef<HTMLIonListElement>(null);
  const { exercises: allExercises, loading: exercisesLoading } = useExercises();
  const [presentToast] = useIonToast();

  const loadRoutines = () => {
    routinesRepo.list().then(setRoutines);
  };

  // Se recarga cada vez que se entra a la vista (incluida la vuelta desde el editor).
  useIonViewWillEnter(() => {
    loadRoutines();
  });

  const handleConfirmArchive = () => {
    if (!pendingArchiveId) {
      return;
    }
    const id = pendingArchiveId;
    setPendingArchiveId(null);
    routinesRepo.archive(id).then(() => {
      listRef.current?.closeSlidingItems();
      loadRoutines();
    });
  };

  const handleCancelArchive = () => {
    setPendingArchiveId(null);
    listRef.current?.closeSlidingItems();
  };

  const handleSelectTemplate = async (template: RoutineTemplate) => {
    if (exercisesLoading || creatingTemplateId) {
      return;
    }
    setCreatingTemplateId(template.id);
    try {
      const routine = instantiateTemplate(template, allExercises);
      if (!routine) {
        await presentToast({
          message: 'No se pudo crear la rutina desde esta plantilla.',
          duration: 2500,
          color: 'danger',
        });
        return;
      }
      const existing = await routinesRepo.list();
      const position = existing.reduce((max, item) => Math.max(max, item.position), -1) + 1;
      await routinesRepo.save({ ...routine, position });
      setShowTemplates(false);
      loadRoutines();
      await presentToast({
        message: 'Rutina creada. Ajústala a tu medida.',
        duration: 2500,
        color: 'success',
      });
    } finally {
      setCreatingTemplateId(null);
    }
  };

  /** Cierra el wizard "Crear para mí" y limpia sus 3 pasos (estado local,
   * sin rutas -- se reinicia siempre al cerrar, se haya completado o no). */
  const closeWizard = () => {
    setShowWizard(false);
    setWizardStep(1);
    setWizardDays(null);
    setWizardSplit(null);
  };

  const handleWizardPickDays = (days: DaysPerWeek) => {
    setWizardDays(days);
    setWizardStep(2);
  };

  const handleWizardPickSplit = (split: RoutineSplit) => {
    setWizardSplit(split);
    setWizardStep(3);
  };

  const handleWizardPickEquipment = async (equipment: EquipmentTier) => {
    if (wizardDays === null || wizardSplit === null || wizardGenerating || exercisesLoading) {
      return;
    }
    setWizardGenerating(true);
    try {
      const plan = generatePlan({ daysPerWeek: wizardDays, split: wizardSplit, equipment }, allExercises);
      if (!plan || plan.length === 0) {
        await presentToast({
          message: 'No se pudieron generar rutinas con esa combinación.',
          duration: 2500,
          color: 'danger',
        });
        return;
      }
      const existing = await routinesRepo.list();
      const basePosition = existing.reduce((max, item) => Math.max(max, item.position), -1) + 1;
      await Promise.all(
        plan.map((routine, index) => routinesRepo.save({ ...routine, position: basePosition + index })),
      );
      closeWizard();
      loadRoutines();
      await presentToast({
        message: `${plan.length} ${plan.length === 1 ? 'rutina creada' : 'rutinas creadas'}. Ajústalas a tu gusto.`,
        duration: 2800,
        color: 'success',
      });
    } finally {
      setWizardGenerating(false);
    }
  };

  const loading = routines === null;
  const pendingRoutine = routines?.find((routine) => routine.id === pendingArchiveId) ?? null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Rutinas</IonTitle>
          <IonButtons slot="end">
            <IonButton className="rutinas-templates-button" fill="clear" onClick={() => setShowWizard(true)}>
              <IonIcon icon={sparklesOutline} slot="start" />
              Crear para mí
            </IonButton>
            <IonButton className="rutinas-templates-button" fill="clear" onClick={() => setShowTemplates(true)}>
              <IonIcon icon={copyOutline} slot="start" />
              Plantillas
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Rutinas</IonTitle>
          </IonToolbar>
        </IonHeader>

        {loading ? (
          <div className="rutinas-skeleton-wrap">
            <CargaSkeleton variant="card" width="100%" height={76} />
            <CargaSkeleton variant="card" width="100%" height={76} />
            <CargaSkeleton variant="card" width="100%" height={76} />
          </div>
        ) : routines.length === 0 ? (
          <div className="rutinas-empty">
            <p className="carga-overline rutinas-empty-overline">Tu pizarra está vacía</p>
            <p className="rutinas-empty-text">Ninguna rutina todavía. Monta la primera.</p>
            <div className="rutinas-empty-actions">
              <IonButton expand="block" routerLink="/tabs/rutinas/nueva">
                Crear rutina
              </IonButton>
              <IonButton expand="block" fill="outline" onClick={() => setShowTemplates(true)}>
                Ver plantillas
              </IonButton>
            </div>
          </div>
        ) : (
          <IonList ref={listRef} className="rutinas-list" lines="none">
            {routines.map((routine) => {
              const exerciseCount = routine.exercises.length;
              const setCount = totalTargetSets(routine);
              const minutes = estimateSessionMinutes(routine.exercises);
              return (
                <IonItemSliding key={routine.id} className="rutinas-card">
                  <IonItem
                    className="rutinas-card-item"
                    routerLink={`/tabs/rutinas/editar/${routine.id}`}
                    detail
                  >
                    <IonLabel>
                      <h2 className="rutinas-card-name">{routine.name}</h2>
                      <p className="carga-overline rutinas-card-meta">
                        {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ~{setCount}{' '}
                        {setCount === 1 ? 'serie' : 'series'} · ~{minutes} min
                      </p>
                    </IonLabel>
                  </IonItem>
                  <IonItemOptions side="end">
                    <IonItemOption
                      color="medium"
                      onClick={() => setPendingArchiveId(routine.id)}
                    >
                      <IonIcon icon={archiveOutline} slot="start" />
                      Archivar
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}
          </IonList>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton routerLink="/tabs/rutinas/nueva" color="primary">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonAlert
          isOpen={pendingArchiveId !== null}
          header="Archivar rutina"
          message={
            pendingRoutine
              ? `¿Archivar "${pendingRoutine.name}"? Se conservará su historial de entrenamientos.`
              : ''
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel', handler: handleCancelArchive },
            { text: 'Archivar', role: 'destructive', handler: handleConfirmArchive },
          ]}
          onDidDismiss={handleCancelArchive}
        />

        <IonModal
          isOpen={showTemplates}
          onDidDismiss={() => setShowTemplates(false)}
          initialBreakpoint={0.75}
          breakpoints={[0, 0.5, 0.75]}
          className="carga-sheet templates-sheet"
        >
          <div className="carga-sheet-header">
            <p className="carga-overline">Plantillas de rutina</p>
            <button
              type="button"
              className="carga-sheet-close"
              onClick={() => setShowTemplates(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="templates-sheet-body">
            <p className="templates-sheet-intro">
              Parte de una base probada y ajústala a tu medida.
            </p>
            <div className="templates-sheet-list">
              {ROUTINE_TEMPLATES.map((template) => {
                const minutes = estimateSessionMinutes(template.exercises);
                const exerciseCount = template.exercises.length;
                const isCreating = creatingTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-card${exercisesLoading ? ' template-card-disabled' : ''}`}
                    onClick={() => handleSelectTemplate(template)}
                    disabled={exercisesLoading || creatingTemplateId !== null}
                  >
                    <h2 className="template-card-name">{template.name}</h2>
                    <p className="template-card-description">{template.description}</p>
                    <p className="carga-overline template-card-meta">
                      {isCreating
                        ? 'Creando…'
                        : `${exerciseCount} ${exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ~${minutes} min`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </IonModal>

        <IonModal
          isOpen={showWizard}
          onDidDismiss={closeWizard}
          initialBreakpoint={0.75}
          breakpoints={[0, 0.5, 0.75]}
          className="carga-sheet wizard-sheet"
        >
          <div className="carga-sheet-header">
            {wizardStep > 1 ? (
              <button
                type="button"
                className="wizard-back-btn"
                onClick={() => setWizardStep((step) => (step === 3 ? 2 : 1))}
                aria-label="Paso anterior"
              >
                <IonIcon icon={chevronBackOutline} />
              </button>
            ) : (
              <p className="carga-overline">Crear rutina para mí</p>
            )}
            <button type="button" className="carga-sheet-close" onClick={closeWizard} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div className="wizard-sheet-body">
            {wizardStep === 1 && (
              <div className="wizard-step">
                <p className="carga-overline wizard-step-overline">Paso 1 de 3</p>
                <h2 className="wizard-step-title">¿Cuántos días a la semana?</h2>
                <div className="wizard-chip-row">
                  {WIZARD_DAYS_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`wizard-chip${wizardDays === days ? ' wizard-chip-active' : ''}`}
                      onClick={() => handleWizardPickDays(days)}
                    >
                      {days} días
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="wizard-step">
                <p className="carga-overline wizard-step-overline">Paso 2 de 3</p>
                <h2 className="wizard-step-title">Elige tu split</h2>
                <div className="wizard-split-list">
                  {WIZARD_SPLIT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`template-card${wizardSplit === option.value ? ' wizard-split-active' : ''}`}
                      onClick={() => handleWizardPickSplit(option.value)}
                    >
                      <h2 className="template-card-name">{option.name}</h2>
                      <p className="template-card-description">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="wizard-step">
                <p className="carga-overline wizard-step-overline">Paso 3 de 3</p>
                <h2 className="wizard-step-title">¿Qué equipo tienes?</h2>
                <div className="wizard-chip-row wizard-chip-row-stacked">
                  {WIZARD_EQUIPMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`wizard-chip wizard-chip-wide${wizardGenerating ? ' wizard-chip-disabled' : ''}`}
                      onClick={() => void handleWizardPickEquipment(option.value)}
                      disabled={wizardGenerating || exercisesLoading}
                    >
                      {wizardGenerating ? 'Generando…' : option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Rutinas;
