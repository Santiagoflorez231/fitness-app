import { useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
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
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { add, archiveOutline, list } from 'ionicons/icons';
import { routinesRepo } from '../../db';
import type { Routine } from '../../types/routine';

/** Total de series objetivo de una rutina (suma de targetSets de sus ejercicios). */
function totalTargetSets(routine: Routine): number {
  return routine.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
}

const Rutinas: React.FC = () => {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLIonListElement>(null);

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

  const loading = routines === null;
  const pendingRoutine = routines?.find((routine) => routine.id === pendingArchiveId) ?? null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Rutinas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Rutinas</IonTitle>
          </IonToolbar>
        </IonHeader>

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
        ) : routines.length === 0 ? (
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
            <IonIcon icon={list} style={{ fontSize: '4rem' }} color="medium" />
            <p>Aún no tienes rutinas</p>
            <IonButton routerLink="/tabs/rutinas/nueva">Crear la primera</IonButton>
          </div>
        ) : (
          <IonList ref={listRef}>
            {routines.map((routine) => {
              const exerciseCount = routine.exercises.length;
              const setCount = totalTargetSets(routine);
              return (
                <IonItemSliding key={routine.id}>
                  <IonItem routerLink={`/tabs/rutinas/editar/${routine.id}`} detail>
                    <IonLabel>
                      <h2>{routine.name}</h2>
                      <p>
                        {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ~
                        {setCount} {setCount === 1 ? 'serie' : 'series'}
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
          <IonFabButton routerLink="/tabs/rutinas/nueva">
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
      </IonContent>
    </IonPage>
  );
};

export default Rutinas;
