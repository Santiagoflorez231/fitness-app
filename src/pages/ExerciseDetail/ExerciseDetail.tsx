import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
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
import { sessionsRepo } from '../../db';
import { writeStartExerciseRequest } from '../../db/startExerciseRequest';
import { localCoachAdvisor } from '../../coach/localCoach';
import type { ProgressVerdict } from '../../coach/types';
import mediaLocal from '../../data/mediaLocal.json';
import mediaGym from '../../data/mediaGym.json';
import './ExerciseDetail.css';

/** Fotos locales (free-exercise-db, dominio público) por exerciseId: par de
 * fotogramas inicio/fin para 344 ejercicios. Descargadas en desarrollo
 * (scripts/download-media.mjs); en runtime son assets estáticos, cero red. */
const MEDIA_BY_ID = mediaLocal as Record<string, string[]>;

/** GIF animado + thumb 180×180 por exerciseId (Gymvisual vía dataset, M1):
 * cobertura 100% del catálogo, assets locales, cero red. */
const GYM_BY_ID = mediaGym as Record<string, { thumb: string; gif: string }>;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** GIF héroe del ejercicio: animado por defecto; tap alterna GIF/fotograma.
 * Con prefers-reduced-motion arranca quieto (el tap permite animarlo). */
function ExerciseGifHero({ exerciseId, name }: { exerciseId: string; name: string }) {
  const media = GYM_BY_ID[exerciseId];
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  if (!media) {
    return null;
  }
  return (
    <button
      type="button"
      className="detail-gif"
      onClick={() => setPlaying((value) => !value)}
      aria-label={playing ? `Pausar animación de ${name}` : `Reproducir animación de ${name}`}
    >
      <img src={`${import.meta.env.BASE_URL}${playing ? media.gif : media.thumb}`} alt={`Ejecución de ${name}`} />
      {!playing && <span className="detail-gif-paused carga-overline">Tocar para animar</span>}
    </button>
  );
}

interface ExerciseDetailParams {
  id: string;
}

const STEP_STAGGER_MS = 30;

const ExerciseDetail: React.FC = () => {
  const { id } = useParams<ExerciseDetailParams>();
  const routerHistory = useHistory();
  const { exercises, loading } = useExercises();
  const [coachVerdict, setCoachVerdict] = useState<ProgressVerdict | null>(null);

  // Veredicto del Coach (A2, estancamiento/deload) para ESTE ejercicio. Se
  // deriva del histórico de series; solo se muestra con >=2 sesiones (con
  // menos es ruido). Puramente informativo: no toca persistencia.
  useEffect(() => {
    let cancelled = false;
    sessionsRepo.listSetsByExercise(id).then((sets) => {
      if (cancelled) {
        return;
      }
      const distinctSessions = new Set(sets.map((s) => s.sessionId)).size;
      if (distinctSessions < 2) {
        setCoachVerdict(null);
        return;
      }
      const history = sets.map((s) => ({
        sessionId: s.sessionId,
        weightKg: s.weightKg,
        reps: s.reps,
        completedAt: s.completedAt,
      }));
      setCoachVerdict(localCoachAdvisor.assessProgress(id, history));
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  // Botón COMENZAR: deja la petición en localStorage y navega a Entrenar,
  // que la consume al entrar (ver src/db/startExerciseRequest.ts). Se
  // muestra siempre, también para ejercicios cardio -- también se registran.
  const handleStart = () => {
    writeStartExerciseRequest(exercise.id);
    routerHistory.push('/tabs/entrenar');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/explorar" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding detail-content">
        <div className="detail-header">
          <ExerciseGifHero exerciseId={exercise.id} name={exercise.name} />
          <h1 className="detail-name">{exercise.name}</h1>
          <div className="detail-tags">
            <span className="detail-tag">{capitalize(exercise.category)}</span>
            <span className="detail-tag">{capitalize(exercise.equipment)}</span>
          </div>
          <p className="detail-muscle-legend">{muscleLegend}</p>
        </div>

        <section className="detail-section">
          <p className="carga-overline">Músculos</p>
          <MuscleMap mode="highlight" primary={primary} secondary={secondary} isCardio={isCardio} />
        </section>

        {(MEDIA_BY_ID[exercise.id]?.length ?? 0) > 0 && (
          <section className="detail-section">
            <p className="carga-overline">Ejecución</p>
            <div className="detail-media">
              {MEDIA_BY_ID[exercise.id].map((path, index) => (
                <img
                  key={path}
                  className="detail-media-img"
                  src={`${import.meta.env.BASE_URL}${path}`}
                  alt={`${exercise.name}: ${index === 0 ? 'posición inicial' : 'posición final'}`}
                  loading="lazy"
                />
              ))}
            </div>
          </section>
        )}

        {coachVerdict && (
          <div className={`detail-coach detail-coach-${coachVerdict.state}`}>
            <span className="carga-overline">Coach</span>
            <p className="detail-coach-message">{coachVerdict.message}</p>
          </div>
        )}

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

      <IonFooter className="detail-start-footer ion-no-border">
        <button type="button" className="detail-start-btn" onClick={handleStart}>
          Comenzar
        </button>
      </IonFooter>
    </IonPage>
  );
};

export default ExerciseDetail;
