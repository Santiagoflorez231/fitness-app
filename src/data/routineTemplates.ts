/**
 * Plantillas de rutina de arranque (CARGA).
 * Ver docs/design-carga.md — feature aprobada "Plantillas de rutina".
 *
 * Los nombres de `exerciseName` son EXACTOS al dataset (src/data/exercises.json,
 * campo `name`, en minúsculas) y se resuelven en runtime contra el dataset real
 * vía `instantiateTemplate` (nunca se referencia un `exerciseId` fijo aquí: el
 * id numérico del dataset no es estable entre builds).
 */

import type { Exercise } from '../types/exercise';
import type { Routine, RoutineExercise } from '../types/routine';
import { normalize } from '../utils/text';

export interface RoutineTemplateExercise {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  /** Una línea, tono CARGA: imperativo breve, sin exclamaciones. */
  description: string;
  exercises: RoutineTemplateExercise[];
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'template-full-body',
    name: 'Full Body',
    description: 'Todo el cuerpo, tres días por semana. Empieza aquí.',
    exercises: [
      { exerciseName: 'barbell full squat', targetSets: 3, targetReps: 6, restSeconds: 150 },
      { exerciseName: 'barbell bench press', targetSets: 3, targetReps: 6, restSeconds: 150 },
      { exerciseName: 'barbell bent over row', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'dumbbell standing overhead press', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'lever lying leg curl', targetSets: 3, targetReps: 12, restSeconds: 90 },
      { exerciseName: 'hanging leg raise', targetSets: 3, targetReps: 12, restSeconds: 90 },
    ],
  },
  {
    id: 'template-empuje',
    name: 'Empuje',
    description: 'Pecho, hombro y tríceps. Empuja fuerte.',
    exercises: [
      { exerciseName: 'barbell bench press', targetSets: 4, targetReps: 6, restSeconds: 180 },
      { exerciseName: 'barbell incline bench press', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'dumbbell standing overhead press', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'chest dip', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseName: 'dumbbell lateral raise', targetSets: 3, targetReps: 12, restSeconds: 90 },
      { exerciseName: 'cable pushdown', targetSets: 3, targetReps: 12, restSeconds: 90 },
    ],
  },
  {
    id: 'template-tiron',
    name: 'Tirón',
    description: 'Espalda y bíceps. Tira con control.',
    exercises: [
      { exerciseName: 'barbell deadlift', targetSets: 4, targetReps: 5, restSeconds: 180 },
      { exerciseName: 'pull-up', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'barbell bent over row', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'cable lat pulldown full range of motion', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseName: 'cable seated row', targetSets: 3, targetReps: 12, restSeconds: 90 },
      { exerciseName: 'barbell curl', targetSets: 3, targetReps: 12, restSeconds: 90 },
    ],
  },
  {
    id: 'template-pierna',
    name: 'Pierna',
    description: 'Cuádriceps, isquios y glúteo. No te la saltes.',
    exercises: [
      { exerciseName: 'barbell full squat', targetSets: 4, targetReps: 6, restSeconds: 180 },
      { exerciseName: 'barbell romanian deadlift', targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseName: 'barbell lunge', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseName: 'lever leg extension', targetSets: 3, targetReps: 12, restSeconds: 90 },
      { exerciseName: 'lever lying leg curl', targetSets: 3, targetReps: 12, restSeconds: 90 },
      { exerciseName: 'barbell standing calf raise', targetSets: 3, targetReps: 12, restSeconds: 90 },
    ],
  },
];

/**
 * Duración estimada de una sesión: Σ series × (45 s + descanso), redondeada
 * a los 5 minutos más cercanos. Sirve tanto para rutinas guardadas como para
 * plantillas (ambas comparten la forma { targetSets, restSeconds }).
 */
export function estimateSessionMinutes(
  exercises: { targetSets: number; restSeconds: number }[],
): number {
  const totalSeconds = exercises.reduce(
    (sum, exercise) => sum + exercise.targetSets * (45 + exercise.restSeconds),
    0,
  );
  return Math.max(5, Math.round(totalSeconds / 60 / 5) * 5);
}

/**
 * Resuelve una plantilla contra el dataset real de ejercicios (comparación
 * case-insensitive, sin diacríticos) y genera una Routine lista para
 * persistir. La `position` se deja en 0: quien llame debe recalcularla según
 * las rutinas existentes antes de guardar (igual que hace el editor manual).
 *
 * Si algún nombre de ejercicio no aparece en el dataset se omite (y se avisa
 * por console.warn); si faltan más de 2, se cancela la instanciación
 * completa devolviendo null.
 */
export function instantiateTemplate(
  template: RoutineTemplate,
  exercises: Exercise[],
): Routine | null {
  const byNormalizedName = new Map(exercises.map((exercise) => [normalize(exercise.name), exercise]));

  const resolved: RoutineExercise[] = [];
  let missingCount = 0;

  template.exercises.forEach((templateExercise) => {
    const match = byNormalizedName.get(normalize(templateExercise.exerciseName));
    if (!match) {
      missingCount += 1;
      console.warn(
        `[routineTemplates] "${template.name}": no se encontró "${templateExercise.exerciseName}" en el dataset, se omite.`,
      );
      return;
    }
    resolved.push({
      id: crypto.randomUUID(),
      exerciseId: match.id,
      exerciseName: match.name,
      position: resolved.length,
      targetSets: templateExercise.targetSets,
      targetReps: templateExercise.targetReps,
      restSeconds: templateExercise.restSeconds,
    });
  });

  if (missingCount > 2 || resolved.length === 0) {
    console.warn(
      `[routineTemplates] "${template.name}": demasiados ejercicios no encontrados (${missingCount}), se cancela la instanciación.`,
    );
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: template.name,
    position: 0,
    archived: false,
    createdAt: Date.now(),
    exercises: resolved,
  };
}
