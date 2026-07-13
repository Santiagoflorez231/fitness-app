import { useMemo } from 'react';
import { IonModal } from '@ionic/react';
import { useExercises } from '../hooks/useExercises';
import { formatDurationMinEs } from '../utils/dates';
import ExerciseAvatar from './ExerciseAvatar';
import type { SessionSet, WorkoutSession } from '../types/routine';
import './SessionDetailSheet.css';

const NUM_FORMATTER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

function formatFullDateEs(ts: number): string {
  const formatted = new Date(ts).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** finishedAt - startedAt; finishedAt siempre está presente en sesiones
 * terminadas (listFinished() ya filtra finished_at IS NOT NULL), el
 * fallback es solo para que TypeScript acepte el tipo `number | null`. */
function sessionDurationMs(session: WorkoutSession): number {
  return (session.finishedAt ?? session.startedAt) - session.startedAt;
}

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: SessionSet[];
}

/** Agrupa por ejercicio preservando el orden de PRIMERA aparición entre
 * grupos, y el orden de registro (completedAt asc, ya viene así de
 * getSets()) dentro de cada grupo. */
function groupSetsByExercise(sets: SessionSet[]): ExerciseGroup[] {
  const order: string[] = [];
  const byExercise = new Map<string, SessionSet[]>();
  sets.forEach((set) => {
    let group = byExercise.get(set.exerciseId);
    if (!group) {
      group = [];
      byExercise.set(set.exerciseId, group);
      order.push(set.exerciseId);
    }
    group.push(set);
  });
  return order.map((exerciseId) => {
    const group = byExercise.get(exerciseId) as SessionSet[];
    return { exerciseId, exerciseName: group[0].exerciseName, sets: group };
  });
}

interface SessionDetailSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  session: WorkoutSession | null;
  /** Series ya cargadas por el llamador (Historial ya las tiene en memoria
   * para pintar la card): este sheet es puramente presentacional, no vuelve
   * a leer la base de datos. */
  sets: SessionSet[];
}

/**
 * Sheet CARGA de solo lectura con el detalle de una sesión terminada
 * (Historial, N1): series agrupadas por ejercicio, en orden de registro.
 * Acabado propio -- IonModal se usa solo como contenedor del sheet.
 * Referencia obligatoria: docs/design-carga.md
 */
const SessionDetailSheet: React.FC<SessionDetailSheetProps> = ({ isOpen, onDismiss, session, sets }) => {
  const { exercises } = useExercises();
  const groups = useMemo(() => groupSetsByExercise(sets), [sets]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6, 0.9]}
      className="carga-sheet session-detail-sheet"
    >
      <div className="carga-sheet-header">
        <p className="carga-overline session-detail-title">{session?.routineName ?? 'Sesión'}</p>
        <button type="button" className="carga-sheet-close" onClick={onDismiss} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="session-detail-body">
        {session && (
          <p className="session-detail-date">
            {formatFullDateEs(session.startedAt)} · {formatDurationMinEs(sessionDurationMs(session))}
          </p>
        )}

        {session?.notes && <p className="session-detail-narrative">{session.notes}</p>}

        {groups.length === 0 ? (
          <p className="session-detail-empty">Sin series registradas.</p>
        ) : (
          <div className="session-detail-groups">
            {groups.map((group) => {
              const exercise = exercises.find((item) => item.id === group.exerciseId);
              return (
                <div key={group.exerciseId} className="session-detail-group">
                  <div className="session-detail-group-head">
                    <ExerciseAvatar
                      target={exercise?.target ?? group.exerciseName}
                      category={exercise?.category ?? ''}
                      exerciseId={group.exerciseId}
                      size={40}
                    />
                    <span className="carga-title-card session-detail-group-name">{group.exerciseName}</span>
                  </div>
                  <ul className="session-detail-set-list">
                    {group.sets.map((set, index) => (
                      <li key={set.id} className="session-detail-set-row">
                        <span className="session-detail-set-index">{index + 1}</span>
                        <span className="carga-num session-detail-set-value">
                          {NUM_FORMATTER.format(set.weightKg)} kg × {set.reps}
                          {set.rpe !== undefined ? ` · RPE ${NUM_FORMATTER.format(set.rpe)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </IonModal>
  );
};

export default SessionDetailSheet;
