import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToolbar,
} from '@ionic/react';
import { alertCircleOutline } from 'ionicons/icons';
import { useExercises } from '../../hooks/useExercises';
import ExerciseAvatar, { capitalize } from '../../components/ExerciseAvatar';
import './ExerciseDetail.css';

interface ExerciseDetailParams {
  id: string;
}

const STEP_STAGGER_MS = 30;

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
              <IonBackButton defaultHref="/tabs/explorar" text="" />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <div className="detail-empty">
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
              <IonBackButton defaultHref="/tabs/explorar" text="" />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="ion-padding">
          <div className="detail-empty">
            <IonIcon icon={alertCircleOutline} className="detail-empty-icon" />
            <p className="detail-empty-text">Ejercicio no encontrado</p>
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
            <IonBackButton defaultHref="/tabs/explorar" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="detail-header">
          <ExerciseAvatar target={exercise.target} category={exercise.category} size={72} />
          <h1 className="detail-name">{exercise.name}</h1>
          <div className="detail-tags">
            <span className="detail-tag">{capitalize(exercise.category)}</span>
            <span className="detail-tag">{capitalize(exercise.equipment)}</span>
          </div>
        </div>

        <section className="detail-section">
          <p className="carga-overline">Músculos</p>
          <div className="detail-muscles">
            <span className="detail-muscle-primary">{capitalize(exercise.muscle_group)}</span>
            {secondaryMuscles.map((muscle) => (
              <span className="detail-muscle-secondary" key={muscle}>
                {capitalize(muscle)}
              </span>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <p className="carga-overline">Instrucciones</p>
          <ol className="detail-steps">
            {exercise.steps.es.map((step, index) => (
              <li
                className="detail-step"
                key={index}
                style={{ animationDelay: `${index * STEP_STAGGER_MS}ms` }}
              >
                <span className="detail-step-number">{index + 1}</span>
                <span className="detail-step-text">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </IonContent>
    </IonPage>
  );
};

export default ExerciseDetail;
