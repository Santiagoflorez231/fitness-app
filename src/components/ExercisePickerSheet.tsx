import { useEffect, useMemo, useState } from 'react';
import { IonModal } from '@ionic/react';
import { useExercises } from '../hooks/useExercises';
import ExerciseAvatar, { capitalize } from './ExerciseAvatar';
import { normalize } from '../utils/text';
import type { Exercise } from '../types/exercise';
import './ExercisePickerSheet.css';

const MAX_RESULTS = 30;

interface ExercisePickerSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** El picker no decide qué hacer con el ejercicio elegido -- solo lo reporta.
   * El padre (Entrenar) persiste el bloque ad-hoc, actualiza el plan y cierra. */
  onPick: (exercise: Exercise) => void;
}

/**
 * Sheet CARGA para añadir un ejercicio "en caliente" a la sesión en curso
 * (bloque ad-hoc), estilo Symmetric/Strong/Hevy. Acabado propio -- IonModal
 * se usa solo como contenedor del sheet; buscador nativo (sin IonSearchbar).
 * Referencia obligatoria: docs/design-carga.md
 */
const ExercisePickerSheet: React.FC<ExercisePickerSheetProps> = ({ isOpen, onDismiss, onPick }) => {
  const { exercises } = useExercises();
  const [query, setQuery] = useState('');

  // Reinicia la búsqueda cada vez que el sheet se abre.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const normalizedQuery = normalize(query);
  const results = useMemo(() => {
    const source = normalizedQuery
      ? exercises.filter((exercise) => normalize(exercise.name).includes(normalizedQuery))
      : exercises;
    return source.slice(0, MAX_RESULTS);
  }, [exercises, normalizedQuery]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.75}
      breakpoints={[0, 0.5, 0.75, 0.95]}
      className="carga-sheet exercise-picker-sheet"
    >
      <div className="carga-sheet-header">
        <p className="carga-overline">Añadir ejercicio</p>
        <button type="button" className="carga-sheet-close" onClick={onDismiss} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="exercise-picker-body">
        <input
          type="text"
          inputMode="search"
          className="exercise-picker-search"
          placeholder="Buscar ejercicio"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        {results.length === 0 ? (
          <p className="exercise-picker-empty">Sin resultados.</p>
        ) : (
          <ul className="exercise-picker-list">
            {results.map((exercise) => (
              <li key={exercise.id}>
                <button type="button" className="exercise-picker-row" onClick={() => onPick(exercise)}>
                  <ExerciseAvatar target={exercise.target} category={exercise.category} size={40} />
                  <span className="exercise-picker-row-info">
                    <span className="exercise-picker-row-name">{exercise.name}</span>
                    <span className="exercise-picker-row-meta">{capitalize(exercise.category)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </IonModal>
  );
};

export default ExercisePickerSheet;
