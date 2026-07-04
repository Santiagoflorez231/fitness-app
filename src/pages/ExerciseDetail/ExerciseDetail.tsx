import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
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
} from '@ionic/react';
import { alertCircleOutline } from 'ionicons/icons';
import { useExercises } from '../../hooks/useExercises';
import ExerciseAvatar, { capitalize } from '../../components/ExerciseAvatar';

interface ExerciseDetailParams {
  id: string;
}

const ExerciseDetail: React.FC = () => {
  const { id } = useParams<ExerciseDetailParams>();
  const { exercises, loading } = useExercises();

  const exercise = exercises.find((item) => item.id === id);

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/tabs/explorar" />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!exercise) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/tabs/explorar" />
            </IonButtons>
            <IonTitle>Ejercicio no encontrado</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="ion-padding">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '1rem',
              textAlign: 'center',
            }}
          >
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '3rem' }} color="medium" />
            <p>Ejercicio no encontrado</p>
            <IonButton routerLink="/tabs/explorar" routerDirection="back">
              Volver
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // El músculo objetivo/secundario principal aparece duplicado dentro de
  // secondary_muscles en el dataset; se filtra para no repetir el chip.
  const secondaryMuscles = exercise.secondary_muscles.filter(
    (muscle) => muscle !== exercise.muscle_group,
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/explorar" />
          </IonButtons>
          <IonTitle>{exercise.name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
          <ExerciseAvatar target={exercise.target} category={exercise.category} size={96} />
        </div>
        <h1 style={{ textAlign: 'center', margin: '0 0 1rem' }}>{exercise.name}</h1>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <IonChip color="primary">{capitalize(exercise.category)}</IonChip>
          <IonChip color="secondary">{capitalize(exercise.equipment)}</IonChip>
          <IonChip color="tertiary">{capitalize(exercise.target)}</IonChip>
        </div>

        <h2>Músculos</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <IonChip outline color="dark">
            {capitalize(exercise.muscle_group)}
          </IonChip>
          {secondaryMuscles.map((muscle) => (
            <IonChip outline key={muscle}>
              {capitalize(muscle)}
            </IonChip>
          ))}
        </div>

        <h2>Instrucciones</h2>
        <IonList inset>
          {exercise.steps.es.map((step, index) => (
            <IonItem key={index} lines="full">
              <div
                slot="start"
                style={{ fontWeight: 600, minWidth: '1.5rem', textAlign: 'center' }}
              >
                {index + 1}
              </div>
              <IonLabel className="ion-text-wrap">{step}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ExerciseDetail;
