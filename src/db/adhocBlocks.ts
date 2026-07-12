/**
 * Persistencia de "bloques ad-hoc": ejercicios añadidos a una sesión de
 * entrenamiento sin venir de una rutina (botón COMENZAR en Detalle, o el
 * picker "+ Ejercicio" en caliente dentro de Entrenar). Se guardan en
 * localStorage, NO en la base de datos SQLite -- no requieren migración de
 * esquema y su ciclo de vida es exactamente el de la sesión a la que
 * pertenecen (se borran al terminarla o descartarla).
 *
 * Ver src/pages/Entrenar/Entrenar.tsx -- buildPlan() los integra como
 * bloques reales del plan (isOrphan: false), igual que los bloques que sí
 * vienen de una rutina.
 */

import type { Exercise } from '../types/exercise';

export interface AdhocBlock {
  key: string;
  exerciseId: string;
  exerciseName: string;
  target: string;
  category: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
}

const ADHOC_TARGET_SETS = 3;
const ADHOC_TARGET_REPS = 10;
const ADHOC_REST_SECONDS = 90;

function storageKey(sessionId: string): string {
  return `carga.adhocBlocks.${sessionId}`;
}

function isAdhocBlock(value: unknown): value is AdhocBlock {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const block = value as Partial<AdhocBlock>;
  return (
    typeof block.key === 'string' &&
    typeof block.exerciseId === 'string' &&
    typeof block.exerciseName === 'string' &&
    typeof block.target === 'string' &&
    typeof block.category === 'string' &&
    typeof block.targetSets === 'number' &&
    typeof block.targetReps === 'number' &&
    typeof block.restSeconds === 'number'
  );
}

/** Bloques ad-hoc de una sesión, en el orden en que se añadieron. */
export function listAdhocBlocks(sessionId: string): AdhocBlock[] {
  const raw = localStorage.getItem(storageKey(sessionId));
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isAdhocBlock);
  } catch {
    return [];
  }
}

/** Añade `exercise` como bloque ad-hoc al final de la lista de la sesión y persiste. */
export function addAdhocBlock(sessionId: string, exercise: Exercise): AdhocBlock {
  const block: AdhocBlock = {
    key: `adhoc-${crypto.randomUUID()}`,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    target: exercise.target,
    category: exercise.category,
    targetSets: ADHOC_TARGET_SETS,
    targetReps: ADHOC_TARGET_REPS,
    restSeconds: ADHOC_REST_SECONDS,
  };
  const next = [...listAdhocBlocks(sessionId), block];
  localStorage.setItem(storageKey(sessionId), JSON.stringify(next));
  return block;
}

/** Borra todos los bloques ad-hoc de una sesión (al terminarla o descartarla). */
export function clearAdhocBlocks(sessionId: string): void {
  localStorage.removeItem(storageKey(sessionId));
}
