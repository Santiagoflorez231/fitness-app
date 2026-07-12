import { IonIcon } from '@ionic/react';
import { addOutline, removeOutline } from 'ionicons/icons';
import CountUpNumber from '../CountUpNumber';
import './StreakGoal.css';

const MIN_GOAL = 1;
const MAX_GOAL = 14;

interface StreakGoalProps {
  weekStreak: number;
  sessionsThisWeek: number;
  weeklyGoal: number;
  onChangeGoal: (value: number) => void;
}

/**
 * Racha de semanas consecutivas con >=1 sesión + objetivo semanal de
 * sesiones (anillo de progreso CSS puro, conic-gradient). Al cumplir el
 * objetivo se reutiliza `.pr-pop` (el único rebote de la app, ver
 * carga.css): alcanzar el objetivo es un logro, celebra igual que un PR.
 */
const StreakGoal: React.FC<StreakGoalProps> = ({ weekStreak, sessionsThisWeek, weeklyGoal, onChangeGoal }) => {
  const progress = weeklyGoal > 0 ? Math.min(1, sessionsThisWeek / weeklyGoal) : 0;
  const goalMet = sessionsThisWeek >= weeklyGoal;
  const remaining = Math.max(0, weeklyGoal - sessionsThisWeek);

  const remark = goalMet
    ? 'Objetivo cumplido esta semana.'
    : `${sessionsThisWeek} de ${weeklyGoal} · ${remaining === 1 ? 'una más' : `${remaining} más`}.`;

  const streakText =
    weekStreak === 0
      ? 'Sin racha activa todavía.'
      : `${weekStreak} ${weekStreak === 1 ? 'semana seguida' : 'semanas seguidas'}.`;

  return (
    <div className="carga-card progreso-streak">
      <span className="carga-overline">Racha y objetivo</span>
      <div className="progreso-streak-body">
        <div
          className={`progreso-streak-ring${goalMet ? ' pr-pop' : ''}`}
          style={{ '--progress': progress } as React.CSSProperties}
        >
          <div className="progreso-streak-ring-inner">
            <span className="carga-num progreso-streak-ring-value">
              <CountUpNumber value={sessionsThisWeek} />
              <span className="progreso-streak-ring-goal">/{weeklyGoal}</span>
            </span>
          </div>
        </div>
        <div className="progreso-streak-info">
          <p className="progreso-streak-remark">{remark}</p>
          <p className="progreso-streak-streak">{streakText}</p>
          <div className="progreso-streak-stepper">
            <span className="progreso-streak-stepper-label">Objetivo semanal</span>
            <div className="progreso-streak-stepper-controls">
              <button
                type="button"
                className="progreso-streak-stepper-btn"
                aria-label="Bajar objetivo semanal"
                disabled={weeklyGoal <= MIN_GOAL}
                onClick={() => onChangeGoal(weeklyGoal - 1)}
              >
                <IonIcon icon={removeOutline} />
              </button>
              <span className="carga-num progreso-streak-stepper-value">{weeklyGoal}</span>
              <button
                type="button"
                className="progreso-streak-stepper-btn"
                aria-label="Subir objetivo semanal"
                disabled={weeklyGoal >= MAX_GOAL}
                onClick={() => onChangeGoal(weeklyGoal + 1)}
              >
                <IonIcon icon={addOutline} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakGoal;
