/**
 * Petición "empieza este ejercicio ahora" -- puente entre Detalle (botón
 * COMENZAR) y Entrenar (que la consume al entrar). Vive en localStorage
 * porque cruza una navegación completa entre pantallas/tabs; una sola
 * petición pendiente a la vez (la última gana).
 */

const STORAGE_KEY = 'carga.startExercise';

export interface StartExerciseRequest {
  exerciseId: string;
}

/** Escribe la petición pendiente (Detalle, botón COMENZAR). */
export function writeStartExerciseRequest(exerciseId: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ exerciseId }));
}

function isStartExerciseRequest(value: unknown): value is StartExerciseRequest {
  return (
    typeof value === 'object' && value !== null && typeof (value as StartExerciseRequest).exerciseId === 'string'
  );
}

/**
 * Lee y borra SIEMPRE la petición pendiente, si existe -- aunque el JSON
 * esté corrupto o el `exerciseId` ya no resuelva a un ejercicio real; quien
 * llama decide qué hacer con el resultado. Entrenar.tsx es el único
 * consumidor (ver ahí la lógica de en qué fases se invoca).
 */
export function consumeStartExerciseRequest(): StartExerciseRequest | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  localStorage.removeItem(STORAGE_KEY);
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStartExerciseRequest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
