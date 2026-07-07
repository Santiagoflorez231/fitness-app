import { useEffect, useRef, useState } from 'react';
import { IonSelect, IonSelectOption } from '@ionic/react';
import type { SessionSet } from '../types/routine';
import './SetRow.css';

/** Valores de RPE permitidos, en pasos de 0.5. */
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Sentinela para "sin RPE" en el IonSelect (que trabaja mejor con valores homogéneos). */
const RPE_NONE = '';

export interface SetRowGhost {
  weightKg: number;
  reps: number;
}

interface SetRowProps {
  setNumber: number;
  /** Serie ya registrada para este número, si existe: la fila queda bloqueada. */
  completed: SessionSet | null;
  /** Prefill inicial de peso (string tal cual se muestra en el input). */
  defaultWeightKg: string;
  /** Prefill inicial de reps (string tal cual se muestra en el input). */
  defaultReps: string;
  onComplete: (weightKg: number, reps: number, rpe: number | undefined) => void | Promise<void>;
  /** Mejor e1RM histórico del ejercicio (Epley, previo a esta sesión): habilita
   * el chip de %1RM en vivo junto al peso tecleado. Ausente si no hay historial. */
  bestE1rmKg?: number;
  /** Serie equivalente (mismo número) de la última sesión de este ejercicio:
   * "valor fantasma" tocable que copia sus valores a los inputs (patrón
   * Strong/Hevy de referencia rápida). */
  ghost?: SetRowGhost;
}

function formatEsNum(value: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
}

/** Fila de una serie objetivo: peso, reps, RPE opcional y botón de check.
 * Una vez completada (prop `completed`) queda bloqueada permanentemente. */
const SetRow: React.FC<SetRowProps> = ({
  setNumber,
  completed,
  defaultWeightKg,
  defaultReps,
  onComplete,
  bestE1rmKg,
  ghost,
}) => {
  const [weight, setWeight] = useState(defaultWeightKg);
  const [reps, setReps] = useState(defaultReps);
  const [rpe, setRpe] = useState<string>(RPE_NONE);

  // El key de esta fila ya no incluye el draft (ver Entrenar.tsx), así que
  // el componente NO se remonta cuando el prefill en cascada recalcula
  // `defaultWeightKg`/`defaultReps` al completarse la serie anterior. Estos
  // flags marcan qué campo tocó el usuario, para que el efecto de abajo solo
  // actualice los campos que siguen "limpios" y nunca pise lo ya tecleado.
  const weightDirty = useRef(false);
  const repsDirty = useRef(false);

  useEffect(() => {
    if (!weightDirty.current) {
      setWeight(defaultWeightKg);
    }
  }, [defaultWeightKg]);

  useEffect(() => {
    if (!repsDirty.current) {
      setReps(defaultReps);
    }
  }, [defaultReps]);
  // Activado SÍNCRONAMENTE al entrar en handleCheck (antes de cualquier
  // await) para que el botón quede deshabilitado de inmediato y un doble
  // toque no dispare onComplete dos veces. No se desactiva en éxito (la fila
  // pasa a completed y queda bloqueada de todos modos); solo se desactiva si
  // onComplete lanza, para permitir reintentar.
  const [submitting, setSubmitting] = useState(false);

  const isCompleted = completed !== null;
  const isDisabled = isCompleted || submitting;

  const displayWeight = isCompleted ? completed.weightKg.toString() : weight;
  const displayReps = isCompleted ? completed.reps.toString() : reps;
  const displayRpe = isCompleted ? (completed.rpe !== undefined ? completed.rpe.toString() : RPE_NONE) : rpe;

  // Dispara, una sola vez por montaje, el trazo animado del check y el pulso
  // de fondo cuando la fila pasa a completada (no al cargar ya completada
  // desde una sesión recuperada).
  const wasCompletedRef = useRef(isCompleted);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (!wasCompletedRef.current && isCompleted) {
      setJustCompleted(true);
    }
    wasCompletedRef.current = isCompleted;
  }, [isCompleted]);

  const handleCheck = async () => {
    const weightValue = weight.trim() === '' ? 0 : Number(weight);
    const repsValue = Number(reps);
    if (!Number.isFinite(repsValue) || repsValue <= 0 || !Number.isInteger(repsValue)) {
      return;
    }
    if (!Number.isFinite(weightValue) || weightValue < 0) {
      return;
    }
    const rpeValue = rpe === RPE_NONE ? undefined : Number(rpe);
    setSubmitting(true);
    try {
      await onComplete(weightValue, repsValue, rpeValue);
      // Éxito: no reactivamos `submitting`; la fila quedará bloqueada por
      // `isCompleted` en cuanto el padre propague la nueva `completed`.
    } catch (error) {
      console.error('[SetRow] onComplete falló; se reactiva el botón para reintentar.', error);
      setSubmitting(false);
    }
  };

  /** Copia el valor fantasma (misma serie, última sesión) a los inputs y lo
   * marca como "tocado" para que el prefill en cascada ya no lo pise. */
  const handleUseGhost = () => {
    if (isDisabled || !ghost) {
      return;
    }
    weightDirty.current = true;
    repsDirty.current = true;
    setWeight(ghost.weightKg.toString());
    setReps(ghost.reps.toString());
  };

  const weightForPct = isCompleted ? completed.weightKg : Number(weight.replace(',', '.'));
  const pct =
    bestE1rmKg !== undefined && bestE1rmKg > 0 && Number.isFinite(weightForPct) && weightForPct > 0
      ? Math.round((weightForPct / bestE1rmKg) * 100)
      : null;

  if (isCompleted) {
    return (
      <div className="setrow">
        <div className="setrow-main">
          <span className="carga-num setrow-number">{setNumber}</span>
          <div className="setrow-completed-text">
            <span className="setrow-completed-values">
              {formatEsNum(completed.weightKg)} kg × {completed.reps}
            </span>
            {completed.rpe !== undefined && (
              <span className="setrow-completed-rpe">RPE {formatEsNum(completed.rpe)}</span>
            )}
          </div>
          {pct !== null && (
            <span className="carga-overline setrow-pct-chip setrow-pct-chip-completed">{pct} %</span>
          )}
          <span className="setrow-check setrow-check-done" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              className={`setrow-check-svg${justCompleted ? ' setrow-check-svg-animate' : ''}`}
            >
              <path
                d="M4 12.5l4.5 4.5L20 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`setrow${justCompleted ? ' setrow-pulse' : ''}`}>
      <div className="setrow-main">
        <span className="carga-num setrow-number">{setNumber}</span>

        <div className="setrow-field">
          <input
            className="setrow-input carga-num"
            inputMode="decimal"
            type="number"
            step="0.5"
            min="0"
            placeholder="kg"
            aria-label={`Peso serie ${setNumber}`}
            value={displayWeight}
            disabled={isDisabled}
            onChange={(event) => {
              weightDirty.current = true;
              setWeight(event.target.value);
            }}
          />
          {pct !== null && <span className="carga-overline setrow-pct-chip">{pct} %</span>}
        </div>

        <div className="setrow-field setrow-field-reps">
          <input
            className="setrow-input carga-num"
            inputMode="numeric"
            type="number"
            step="1"
            min="0"
            placeholder="reps"
            aria-label={`Repeticiones serie ${setNumber}`}
            value={displayReps}
            disabled={isDisabled}
            onChange={(event) => {
              repsDirty.current = true;
              setReps(event.target.value);
            }}
          />
        </div>

        <IonSelect
          interface="popover"
          aria-label={`RPE serie ${setNumber}`}
          value={displayRpe}
          disabled={isDisabled}
          className="setrow-rpe"
          onIonChange={(event) => setRpe((event.detail.value as string) ?? RPE_NONE)}
        >
          <IonSelectOption value={RPE_NONE}>—</IonSelectOption>
          {RPE_OPTIONS.map((value) => (
            <IonSelectOption key={value} value={value.toString()}>
              {value}
            </IonSelectOption>
          ))}
        </IonSelect>

        <button
          type="button"
          className="setrow-check"
          disabled={isDisabled}
          onClick={() => void handleCheck()}
          aria-label={`Completar serie ${setNumber}`}
        >
          <svg viewBox="0 0 24 24" className="setrow-check-svg">
            <path
              d="M4 12.5l4.5 4.5L20 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {ghost && (
        <button type="button" className="setrow-ghost" disabled={isDisabled} onClick={handleUseGhost}>
          Anterior: {formatEsNum(ghost.weightKg)} × {ghost.reps}
        </button>
      )}
    </div>
  );
};

export default SetRow;
