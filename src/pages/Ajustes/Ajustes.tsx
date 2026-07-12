/**
 * Ajustes — página de configuración (R8, docs/renovacion-plan.md).
 * No es una sexta tab: se llega desde el icono de engranaje y el acceso
 * rápido de Hoy (ruta /tabs/ajustes). Compone hooks de ajustes ya existentes
 * (useWeeklyGoal) y dos nuevos (useCoachSettings, usePlateSettings), más el
 * panel de respaldo que se muda aquí desde Progreso.
 */
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { addOutline, removeOutline } from 'ionicons/icons';
import { useWeeklyGoal } from '../../hooks/useWeeklyGoal';
import { useCoachSettings, ROUNDING_OPTIONS_KG } from '../../hooks/useCoachSettings';
import { usePlateSettings, DEFAULT_BAR_OPTIONS_KG } from '../../hooks/usePlateSettings';
import BackupPanel from '../../components/progress/BackupPanel';
import './Ajustes.css';

const MIN_WEEKLY_GOAL = 1;
const MAX_WEEKLY_GOAL = 14;

function formatKgEs(value: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
}

const Ajustes: React.FC = () => {
  const { weeklyGoal, setWeeklyGoal } = useWeeklyGoal();
  const { roundingIncrementKg, setRoundingIncrementKg } = useCoachSettings();
  const { defaultBarKg, setDefaultBarKg } = usePlateSettings();

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/hoy" />
          </IonButtons>
          <IonTitle size="small">Ajustes</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ajustes-content">
        <div className="ajustes-stack">
          <section className="carga-card ajustes-card">
            <span className="carga-overline">Objetivo semanal</span>
            <p className="ajustes-card-text">Sesiones por semana para mantener tu racha.</p>
            <div className="ajustes-stepper">
              <button
                type="button"
                className="ajustes-stepper-btn"
                aria-label="Bajar objetivo semanal"
                disabled={weeklyGoal <= MIN_WEEKLY_GOAL}
                onClick={() => setWeeklyGoal(weeklyGoal - 1)}
              >
                <IonIcon icon={removeOutline} />
              </button>
              <span className="carga-num ajustes-stepper-value">{weeklyGoal}</span>
              <button
                type="button"
                className="ajustes-stepper-btn"
                aria-label="Subir objetivo semanal"
                disabled={weeklyGoal >= MAX_WEEKLY_GOAL}
                onClick={() => setWeeklyGoal(weeklyGoal + 1)}
              >
                <IonIcon icon={addOutline} />
              </button>
            </div>
          </section>

          <section className="carga-card ajustes-card">
            <span className="carga-overline">Redondeo del coach</span>
            <p className="ajustes-card-text">
              Incremento de carga que usa el Coach al sugerir tu próxima serie.
            </p>
            <div className="ajustes-pill-row">
              {ROUNDING_OPTIONS_KG.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ajustes-pill-btn${roundingIncrementKg === option ? ' ajustes-pill-btn-active' : ''}`}
                  onClick={() => setRoundingIncrementKg(option)}
                >
                  {formatKgEs(option)} kg
                </button>
              ))}
            </div>
          </section>

          <section className="carga-card ajustes-card">
            <span className="carga-overline">Barra por defecto</span>
            <p className="ajustes-card-text">Peso de la barra al abrir la calculadora de discos.</p>
            <div className="ajustes-pill-row">
              {DEFAULT_BAR_OPTIONS_KG.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ajustes-pill-btn${defaultBarKg === option ? ' ajustes-pill-btn-active' : ''}`}
                  onClick={() => setDefaultBarKg(option)}
                >
                  {formatKgEs(option)} kg
                </button>
              ))}
            </div>
          </section>

          <BackupPanel />

          <section className="carga-card ajustes-card ajustes-about">
            <span className="carga-overline">Acerca de</span>
            <p className="ajustes-about-text">
              GIFs y miniaturas de ejercicios © Gym Visual, redistribuidos con permiso vía el
              dataset hasaneyldrm/exercises-dataset (180×180, uso personal no comercial). Fotos de
              ejecución de free-exercise-db, dominio público. Datos del catálogo bajo licencia MIT.
            </p>
            <p className="ajustes-about-tagline">App personal, sin red en runtime.</p>
          </section>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Ajustes;
