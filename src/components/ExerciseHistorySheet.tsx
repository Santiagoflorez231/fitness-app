import { useEffect, useState } from 'react';
import { IonModal, IonSpinner } from '@ionic/react';
import { sessionsRepo } from '../db';
import type { SessionSet } from '../types/routine';
import './ExerciseHistorySheet.css';

interface SessionGroup {
  sessionId: string;
  dateMs: number;
  sets: SessionSet[];
  bestE1rm: number;
}

function formatDateEs(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatNumberEs(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(value);
}

/** Estimación de 1RM de Epley: weight x (1 + reps/30). */
function epleyE1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** Agrupa por sesión, ordena por fecha descendente y se queda con las 10 más recientes. */
function groupBySession(sets: SessionSet[]): SessionGroup[] {
  const bySession = new Map<string, SessionSet[]>();
  sets.forEach((set) => {
    const list = bySession.get(set.sessionId) ?? [];
    list.push(set);
    bySession.set(set.sessionId, list);
  });
  const groups: SessionGroup[] = Array.from(bySession.entries()).map(([sessionId, sessionSets]) => {
    const ordered = sessionSets.slice().sort((a, b) => a.setNumber - b.setNumber);
    const dateMs = Math.min(...sessionSets.map((s) => s.completedAt));
    const bestE1rm = sessionSets.reduce((max, s) => Math.max(max, epleyE1rm(s.weightKg, s.reps)), 0);
    return { sessionId, dateMs, sets: ordered, bestE1rm };
  });
  return groups.sort((a, b) => b.dateMs - a.dateMs).slice(0, 10);
}

interface ExerciseHistorySheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  exerciseId: string | null;
  exerciseName: string;
}

/**
 * Sheet CARGA con las últimas 10 sesiones registradas de un ejercicio: fecha,
 * series (peso x reps) y mejor e1RM de esa sesión. Acabado propio -- IonModal
 * se usa solo como contenedor del sheet.
 * Referencia obligatoria: docs/design-carga.md
 */
const ExerciseHistorySheet: React.FC<ExerciseHistorySheetProps> = ({
  isOpen,
  onDismiss,
  exerciseId,
  exerciseName,
}) => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SessionGroup[]>([]);

  useEffect(() => {
    if (!isOpen || !exerciseId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    sessionsRepo.listSetsByExercise(exerciseId).then((sets) => {
      if (cancelled) {
        return;
      }
      setGroups(groupBySession(sets));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, exerciseId]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.5}
      breakpoints={[0, 0.5, 0.85]}
      className="carga-sheet history-sheet"
    >
      <div className="carga-sheet-header">
        <p className="carga-overline history-sheet-title">{exerciseName}</p>
        <button type="button" className="carga-sheet-close" onClick={onDismiss} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="history-sheet-body">
        {loading ? (
          <div className="history-sheet-loading">
            <IonSpinner name="crescent" />
          </div>
        ) : groups.length === 0 ? (
          <div className="history-sheet-empty">
            <p className="history-sheet-empty-text">Primera vez. Haz historia.</p>
          </div>
        ) : (
          <ul className="history-sheet-list">
            {groups.map((group) => (
              <li key={group.sessionId} className="history-sheet-row">
                <p className="carga-overline history-sheet-date">{formatDateEs(group.dateMs)}</p>
                <div className="history-sheet-row-main">
                  <span className="history-sheet-sets">
                    {group.sets.map((s) => `${formatNumberEs(s.weightKg)}×${s.reps}`).join(' · ')}
                  </span>
                  <span className="carga-num history-sheet-e1rm">{formatNumberEs(group.bestE1rm, 1)} kg</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </IonModal>
  );
};

export default ExerciseHistorySheet;
