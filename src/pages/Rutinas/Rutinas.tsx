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
import { add, archiveOutline, copyOutline } from 'ionicons/icons';
import { routinesRepo } from '../../db';
import { useExercises } from '../../hooks/useExercises';
import {
  ROUTINE_TEMPLATES,
  estimateSessionMinutes,
  instantiateTemplate,
  type RoutineTemplate,
} from '../../data/routineTemplates';
import CargaSkeleton from '../../components/CargaSkeleton';
import type { Routine } from '../../types/routine';
import './Rutinas.css';

/** Total de series objetivo de una rutina (suma de targetSets de sus ejercicios). */
function totalTargetSets(routine: Routine): number {
  return routine.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
}

const Rutinas: React.FC = () => {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
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

  const loading = routines === null;
  const pendingRoutine = routines?.find((routine) => routine.id === pendingArchiveId) ?? null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Rutinas</IonTitle>
          <IonButtons slot="end">
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
      </IonContent>
    </IonPage>
  );
};

export default Rutinas;
