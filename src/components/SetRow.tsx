import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonInput, IonItem, IonSelect, IonSelectOption } from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import type { SessionSet } from '../types/routine';

/** Valores de RPE permitidos, en pasos de 0.5. */
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Sentinela para "sin RPE" en el IonSelect (que trabaja mejor con valores homogéneos). */
const RPE_NONE = '';

interface SetRowProps {
  setNumber: number;
  /** Serie ya registrada para este número, si existe: la fila queda bloqueada. */
  completed: SessionSet | null;
  /** Prefill inicial de peso (string tal cual se muestra en el input). */
  defaultWeightKg: string;
  /** Prefill inicial de reps (string tal cual se muestra en el input). */
  defaultReps: string;
  onComplete: (weightKg: number, reps: number, rpe: number | undefined) => void | Promise<void>;
}

/** Fila de una serie objetivo: peso, reps, RPE opcional y botón de check.
 * Una vez completada (prop `completed`) queda bloqueada permanentemente. */
const SetRow: React.FC<SetRowProps> = ({ setNumber, completed, defaultWeightKg, defaultReps, onComplete }) => {
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

  return (
    <IonItem lines="none">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          paddingBlock: '0.25rem',
        }}
      >
        <span style={{ minWidth: '1.25rem', color: 'var(--ion-color-medium)' }}>{setNumber}</span>
        <IonInput
          fill="outline"
          inputmode="decimal"
          type="number"
          step="0.5"
          min="0"
          placeholder="kg"
          aria-label={`Peso serie ${setNumber}`}
          value={displayWeight}
          disabled={isDisabled}
          style={{ flex: '1 1 0', minWidth: '4rem' }}
          onIonInput={(event) => {
            weightDirty.current = true;
            setWeight(event.detail.value ?? '');
          }}
        />
        <IonInput
          fill="outline"
          inputmode="numeric"
          type="number"
          step="1"
          min="0"
          placeholder="reps"
          aria-label={`Repeticiones serie ${setNumber}`}
          value={displayReps}
          disabled={isDisabled}
          style={{ flex: '1 1 0', minWidth: '3.5rem' }}
          onIonInput={(event) => {
            repsDirty.current = true;
            setReps(event.detail.value ?? '');
          }}
        />
        <IonSelect
          interface="popover"
          aria-label={`RPE serie ${setNumber}`}
          value={displayRpe}
          disabled={isDisabled}
          style={{ flex: '0 0 3.75rem', minWidth: '3.75rem' }}
          onIonChange={(event) => setRpe((event.detail.value as string) ?? RPE_NONE)}
        >
          <IonSelectOption value={RPE_NONE}>—</IonSelectOption>
          {RPE_OPTIONS.map((value) => (
            <IonSelectOption key={value} value={value.toString()}>
              {value}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonButton
          fill={isCompleted ? 'solid' : 'outline'}
          color={isCompleted ? 'success' : 'medium'}
          disabled={isDisabled}
          onClick={() => void handleCheck()}
          style={{ margin: 0 }}
          aria-label={`Completar serie ${setNumber}`}
        >
          <IonIcon icon={checkmarkCircle} slot="icon-only" />
        </IonButton>
      </div>
    </IonItem>
  );
};

export default SetRow;
