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
import { capitalize } from '../../components/ExerciseAvatar';
import MuscleMap from '../../components/muscle-map/MuscleMap';
import { musclesForExercise, REGION_LABEL } from '../../components/muscle-map/muscleRegions';
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

  const { primary, secondary, isCardio } = musclesForExercise(exercise);
  const primaryLabel = primary.map((regionId) => REGION_LABEL[regionId]).join(', ');
  const secondaryLabel = secondary.map((regionId) => REGION_LABEL[regionId]).join(', ');
  const legendParts: string[] = [];
  if (primaryLabel) {
    legendParts.push(`Primario: ${primaryLabel}`);
  }
  if (secondaryLabel) {
    legendParts.push(`Secundario: ${secondaryLabel}`);
  }
  const muscleLegend = isCardio ? 'Cardiovascular' : legendParts.join(' · ') || 'Sin músculo registrado';

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
          <MuscleMap mode="highlight" primary={primary} secondary={secondary} isCardio={isCardio} />
          <h1 className="detail-name">{exercise.name}</h1>
          <div className="detail-tags">
            <span className="detail-tag">{capitalize(exercise.category)}</span>
            <span className="detail-tag">{capitalize(exercise.equipment)}</span>
          </div>
          <p className="detail-muscle-legend">{muscleLegend}</p>
        </div>

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
