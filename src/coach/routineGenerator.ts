/**
 * `TemplateRoutineGenerator` — implementación local (reglas, sin red/IA) del
 * puente "RoutineGenerator" (docs/roadmap-avanzado.md, Bloque C;
 * docs/renovacion-plan.md, R9). Contrato intercambiable: hoy compone rutinas
 * por reglas a partir de listas de ejercicios verificadas contra el dataset
 * (mismo patrón nombre→id de `src/data/routineTemplates.ts`); el día que
 * exista una versión respaldada por LLM, implementará el mismo
 * `RoutineGenerator.generatePlan` sin tocar el wizard de Rutinas.
 *
 * Nota de alcance: el roadmap documenta `generate(intent, catalog): Routine
 * | null` (una sola rutina). Esta tarea (R9) pide en su lugar
 * `generatePlan(intent, catalog): Routine[]` -- las N rutinas del split, una
 * por día -- porque es lo que el wizard necesita para crear el plan
 * completo de una sola vez. Se documenta aquí como decisión explícita de la
 * tarea, no como desviación silenciosa del roadmap.
 */
import type { Exercise } from '../types/exercise';
import type { Routine, RoutineExercise } from '../types/routine';
import { normalize } from '../utils/text';

export type EquipmentTier = 'gym' | 'basico' | 'casa';
export type RoutineSplit = 'fullbody' | 'ppl' | 'torso-pierna';
export type DaysPerWeek = 2 | 3 | 4 | 5;

export interface RoutineIntent {
  daysPerWeek: DaysPerWeek;
  split: RoutineSplit;
  equipment: EquipmentTier;
}

/** Contrato intercambiable: ver nota de alcance arriba. */
export interface RoutineGenerator {
  /**
   * Genera las N rutinas (una por día) del plan según la intención,
   * resolviendo nombre→id contra el catálogo real. `null` si el catálogo no
   * alcanza para completar ni un solo día (no debería ocurrir con el
   * dataset real, es un fallback defensivo).
   */
  generatePlan(intent: RoutineIntent, catalog: Exercise[]): Routine[] | null;
}

// ---------------------------------------------------------------------------
// Listas de ejercicios por patrón de movimiento. Nombres EXACTOS al dataset
// (src/data/exercises.json, campo `name`), verificados uno a uno contra el
// dataset real (mismo patrón que routineTemplates.ts: se resuelven en
// runtime, nunca se referencia un exerciseId fijo aquí). `compound` decide
// sets/reps/descanso (ver `toRoutineExercise`).
// ---------------------------------------------------------------------------

interface PoolExercise {
  exerciseName: string;
  compound: boolean;
}

const PUSH_POOL: PoolExercise[] = [
  { exerciseName: 'barbell bench press', compound: true },
  { exerciseName: 'dumbbell bench press', compound: true },
  { exerciseName: 'push-up', compound: true },
  { exerciseName: 'barbell incline bench press', compound: true },
  { exerciseName: 'dumbbell standing overhead press', compound: true },
  { exerciseName: 'chest dip', compound: true },
  { exerciseName: 'dumbbell lateral raise', compound: false },
  { exerciseName: 'dumbbell fly', compound: false },
  { exerciseName: 'cable pushdown', compound: false },
  { exerciseName: 'triceps dip', compound: false },
];

const PULL_POOL: PoolExercise[] = [
  { exerciseName: 'barbell deadlift', compound: true },
  { exerciseName: 'barbell bent over row', compound: true },
  { exerciseName: 'pull-up', compound: true },
  { exerciseName: 'dumbbell bent over row', compound: true },
  { exerciseName: 'cable lat pulldown full range of motion', compound: true },
  { exerciseName: 'cable seated row', compound: true },
  { exerciseName: 'inverted row', compound: true },
  { exerciseName: 'barbell curl', compound: false },
  { exerciseName: 'dumbbell hammer curl', compound: false },
  { exerciseName: 'dumbbell biceps curl', compound: false },
];

const LEGS_POOL: PoolExercise[] = [
  { exerciseName: 'barbell full squat', compound: true },
  { exerciseName: 'barbell romanian deadlift', compound: true },
  { exerciseName: 'barbell lunge', compound: true },
  { exerciseName: 'dumbbell romanian deadlift', compound: true },
  { exerciseName: 'dumbbell lunge', compound: true },
  { exerciseName: 'dumbbell goblet squat', compound: true },
  { exerciseName: 'walking lunge', compound: true },
  { exerciseName: 'jump squat', compound: true },
  { exerciseName: 'lever leg extension', compound: false },
  { exerciseName: 'lever lying leg curl', compound: false },
  { exerciseName: 'barbell standing calf raise', compound: false },
  { exerciseName: 'bodyweight standing calf raise', compound: false },
  { exerciseName: 'dumbbell seated calf raise', compound: false },
];

/** Núcleo (waist): todo peso corporal, así que siempre disponible en
 * cualquier nivel de equipo. Todas etiquetadas como aislamiento (descanso
 * corto): ninguna es un básico compuesto multiarticular. */
const CORE_POOL: PoolExercise[] = [
  { exerciseName: 'hanging leg raise', compound: false },
  { exerciseName: 'crunch floor', compound: false },
  { exerciseName: 'russian twist', compound: false },
  { exerciseName: 'front plank with twist', compound: false },
  { exerciseName: 'reverse crunch', compound: false },
  { exerciseName: 'cross body crunch', compound: false },
];

/** Accesorio de brazos/trapecio: solo se usa como el +1 extra de fullbody
 * cuando `equipment === 'gym'` (ver docs/roadmap-avanzado.md, Bloque C). */
const ACCESSORY_POOL: PoolExercise[] = [
  { exerciseName: 'dumbbell hammer curl', compound: false },
  { exerciseName: 'dumbbell biceps curl', compound: false },
  { exerciseName: 'barbell curl', compound: false },
  { exerciseName: 'cable pushdown', compound: false },
  { exerciseName: 'triceps dip', compound: false },
  { exerciseName: 'dumbbell lateral raise', compound: false },
  { exerciseName: 'dumbbell shrug', compound: false },
  { exerciseName: 'barbell shrug', compound: false },
];

// ---------------------------------------------------------------------------
// Filtro por equipo disponible ("gym" = todo, "basico" = barra/mancuernas/
// peso corporal, "casa" = solo peso corporal y mancuernas).
// ---------------------------------------------------------------------------

const BASICO_EQUIPMENT = new Set(['barbell', 'olympic barbell', 'ez barbell', 'dumbbell', 'body weight']);
const CASA_EQUIPMENT = new Set(['dumbbell', 'body weight']);

function equipmentAllowed(equipment: string, tier: EquipmentTier): boolean {
  if (tier === 'gym') {
    return true;
  }
  if (tier === 'basico') {
    return BASICO_EQUIPMENT.has(equipment);
  }
  return CASA_EQUIPMENT.has(equipment);
}

// ---------------------------------------------------------------------------
// Resolución nombre→ejercicio real, filtrado por equipo.
// ---------------------------------------------------------------------------

interface ResolvedItem {
  exercise: Exercise;
  compound: boolean;
}

interface ResolvedFamily {
  compounds: ResolvedItem[];
  isolations: ResolvedItem[];
}

function resolveFamily(
  pool: PoolExercise[],
  byNormalizedName: Map<string, Exercise>,
  tier: EquipmentTier,
  familyLabel: string,
): ResolvedFamily {
  const compounds: ResolvedItem[] = [];
  const isolations: ResolvedItem[] = [];

  pool.forEach((item) => {
    const exercise = byNormalizedName.get(normalize(item.exerciseName));
    if (!exercise) {
      console.warn(
        `[routineGenerator] "${familyLabel}": no se encontró "${item.exerciseName}" en el dataset, se omite.`,
      );
      return;
    }
    if (!equipmentAllowed(exercise.equipment, tier)) {
      return;
    }
    (item.compound ? compounds : isolations).push({ exercise, compound: item.compound });
  });

  return { compounds, isolations };
}

interface ResolvedPools {
  push: ResolvedFamily;
  pull: ResolvedFamily;
  legs: ResolvedFamily;
  core: ResolvedFamily;
  accessory: ResolvedFamily;
}

// ---------------------------------------------------------------------------
// Selección con rotación por ocurrencia: da variedad cuando un mismo tipo de
// día se repite en la semana (p. ej. PPL a 5 días repite Empuje y Tirón) sin
// perder determinismo (mismos inputs -> mismo plan).
// ---------------------------------------------------------------------------

function rotateTake<T>(pool: T[], count: number, occurrence: number): T[] {
  if (pool.length === 0 || count <= 0) {
    return [];
  }
  const take = Math.min(count, pool.length);
  const start = ((occurrence * take) % pool.length + pool.length) % pool.length;
  const result: T[] = [];
  for (let i = 0; i < take; i += 1) {
    result.push(pool[(start + i) % pool.length]);
  }
  return result;
}

/** Slot único (fullbody: "1 empuje", "1 tirón", "1 pierna", "1 core"):
 * prioriza un compuesto si la familia tiene alguno disponible tras el
 * filtro de equipo; si no, cae a un aislamiento (así el núcleo, que no
 * tiene compuestos, siempre resuelve). */
function pickCompoundOrFallback(family: ResolvedFamily, occurrence: number): ResolvedItem | null {
  if (family.compounds.length > 0) {
    return rotateTake(family.compounds, 1, occurrence)[0] ?? null;
  }
  if (family.isolations.length > 0) {
    return rotateTake(family.isolations, 1, occurrence)[0] ?? null;
  }
  return null;
}

/** Slot múltiple (PPL/torso-pierna: 2-4 ejercicios por familia): compuestos
 * primero, aislamientos después, con rotación conjunta por ocurrencia. */
function pickMixed(family: ResolvedFamily, count: number, occurrence: number): ResolvedItem[] {
  const combined = [...family.compounds, ...family.isolations];
  return rotateTake(combined, count, occurrence);
}

function dedupeByName(items: ResolvedItem[]): ResolvedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.exercise.name)) {
      return false;
    }
    seen.add(item.exercise.name);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Composición por tipo de día (docs/roadmap-avanzado.md, Bloque C):
// - fullbody = 1 empuje + 1 tirón + 1 pierna + 1 core (+1 accesorio si gym).
// - ppl = push (3-4), pull (3-4), legs (3-4).
// - torso-pierna (análogo a ppl): torso = 2 empuje + 2 tirón; pierna =
//   3 pierna + 1 core.
// ---------------------------------------------------------------------------

type DayType = 'fullbody' | 'push' | 'pull' | 'legs' | 'torso' | 'pierna';

const DAY_TYPE_LABEL: Record<DayType, string> = {
  fullbody: 'Full Body',
  push: 'Empuje',
  pull: 'Tirón',
  legs: 'Pierna',
  torso: 'Torso',
  pierna: 'Pierna',
};

const PPL_EXERCISES_PER_DAY = 4;
const TORSO_PUSH_PULL_PER_SIDE = 2;
const PIERNA_LEGS_COUNT = 3;

function buildDay(type: DayType, occurrence: number, pools: ResolvedPools, includeAccessory: boolean): ResolvedItem[] {
  switch (type) {
    case 'fullbody': {
      const items = [
        pickCompoundOrFallback(pools.push, occurrence),
        pickCompoundOrFallback(pools.pull, occurrence),
        pickCompoundOrFallback(pools.legs, occurrence),
        pickCompoundOrFallback(pools.core, occurrence),
        includeAccessory ? pickCompoundOrFallback(pools.accessory, occurrence) : null,
      ];
      return items.filter((item): item is ResolvedItem => item !== null);
    }
    case 'push':
      return pickMixed(pools.push, PPL_EXERCISES_PER_DAY, occurrence);
    case 'pull':
      return pickMixed(pools.pull, PPL_EXERCISES_PER_DAY, occurrence);
    case 'legs':
      return pickMixed(pools.legs, PPL_EXERCISES_PER_DAY, occurrence);
    case 'torso':
      return [
        ...pickMixed(pools.push, TORSO_PUSH_PULL_PER_SIDE, occurrence),
        ...pickMixed(pools.pull, TORSO_PUSH_PULL_PER_SIDE, occurrence),
      ];
    case 'pierna': {
      const legs = pickMixed(pools.legs, PIERNA_LEGS_COUNT, occurrence);
      const core = pickCompoundOrFallback(pools.core, occurrence);
      return core ? [...legs, core] : legs;
    }
    default:
      return [];
  }
}

function dayTypeSequence(split: RoutineSplit, daysPerWeek: DaysPerWeek): DayType[] {
  if (split === 'fullbody') {
    return Array.from({ length: daysPerWeek }, () => 'fullbody');
  }
  const cycle: DayType[] = split === 'ppl' ? ['push', 'pull', 'legs'] : ['torso', 'pierna'];
  return Array.from({ length: daysPerWeek }, (_, i) => cycle[i % cycle.length]);
}

const COMPOUND_TARGET_SETS = 3;
const COMPOUND_TARGET_REPS = 8;
const COMPOUND_REST_SECONDS = 105;
const ISOLATION_TARGET_SETS = 3;
const ISOLATION_TARGET_REPS = 10;
const ISOLATION_REST_SECONDS = 75;

function toRoutineExercise(item: ResolvedItem, position: number): RoutineExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId: item.exercise.id,
    exerciseName: item.exercise.name,
    position,
    targetSets: item.compound ? COMPOUND_TARGET_SETS : ISOLATION_TARGET_SETS,
    targetReps: item.compound ? COMPOUND_TARGET_REPS : ISOLATION_TARGET_REPS,
    restSeconds: item.compound ? COMPOUND_REST_SECONDS : ISOLATION_REST_SECONDS,
  };
}

/**
 * Genera las N rutinas (una por día) del plan según la intención del
 * usuario, resolviendo nombres contra el catálogo real de ejercicios.
 * `null` si ningún día pudo completarse (el catálogo no alcanza).
 */
export function generatePlan(intent: RoutineIntent, catalog: Exercise[]): Routine[] | null {
  const byNormalizedName = new Map(catalog.map((exercise) => [normalize(exercise.name), exercise]));

  const pools: ResolvedPools = {
    push: resolveFamily(PUSH_POOL, byNormalizedName, intent.equipment, 'Empuje'),
    pull: resolveFamily(PULL_POOL, byNormalizedName, intent.equipment, 'Tirón'),
    legs: resolveFamily(LEGS_POOL, byNormalizedName, intent.equipment, 'Pierna'),
    core: resolveFamily(CORE_POOL, byNormalizedName, intent.equipment, 'Core'),
    accessory: resolveFamily(ACCESSORY_POOL, byNormalizedName, intent.equipment, 'Accesorio'),
  };

  const sequence = dayTypeSequence(intent.split, intent.daysPerWeek);
  const occurrenceByType = new Map<DayType, number>();
  const routines: Routine[] = [];

  sequence.forEach((type) => {
    const occurrence = occurrenceByType.get(type) ?? 0;
    occurrenceByType.set(type, occurrence + 1);

    const items = dedupeByName(buildDay(type, occurrence, pools, intent.equipment === 'gym'));
    if (items.length === 0) {
      return;
    }

    routines.push({
      id: crypto.randomUUID(),
      name: `${DAY_TYPE_LABEL[type]} · Día ${occurrence + 1}`,
      position: 0,
      archived: false,
      createdAt: Date.now(),
      exercises: items.map((item, index) => toRoutineExercise(item, index)),
    });
  });

  return routines.length > 0 ? routines : null;
}

export class TemplateRoutineGenerator implements RoutineGenerator {
  generatePlan(intent: RoutineIntent, catalog: Exercise[]): Routine[] | null {
    return generatePlan(intent, catalog);
  }
}

export const templateRoutineGenerator = new TemplateRoutineGenerator();
