/**
 * Normalización del vocabulario muscular del dataset a un conjunto CANÓNICO
 * de regiones de la silueta (mapa muscular SVG).
 *
 * El dataset trae tres campos con vocabularios solapados e inconsistentes:
 *   - `target`: 19 valores limpios (músculo primario). Fuente principal.
 *   - `secondary_muscles`: 40 valores con sinónimos (shoulders/deltoids/rear
 *     deltoids, traps/trapezius, quads/quadriceps, lats/latissimus dorsi…).
 *   - `muscle_group`: aún más ruidoso; no se usa aquí.
 *
 * Este módulo colapsa TODOS esos términos (auditados sobre los 1.318
 * ejercicios, 2026-07-12) a ~17 regiones dibujables + el sentinel `cardio`
 * (ejercicios cardiovasculares, sin región anatómica). El componente MuscleMap
 * define un <path> por `RegionId` (algunas regiones aparecen en la vista
 * frontal, otras en la dorsal, y unas pocas en ambas — ver `REGION_VIEW`).
 *
 * Regla de mapeo: se normaliza en minúsculas y sin espacios sobrantes; un
 * término desconocido devuelve null (se ignora, no rompe el render).
 */

export type RegionId =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'upperback'
  | 'lats'
  | 'lowerback'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

/** Sentinel para ejercicios cardiovasculares (sin región muscular dibujable). */
export const CARDIO = 'cardio' as const;
export type NormalizedMuscle = RegionId | typeof CARDIO;

/** Vista de la silueta donde vive cada región (para el SVG de dos paneles). */
export const REGION_VIEW: Record<RegionId, 'front' | 'back' | 'both'> = {
  neck: 'both',
  shoulders: 'both',
  chest: 'front',
  biceps: 'front',
  triceps: 'back',
  forearms: 'both',
  abs: 'front',
  obliques: 'front',
  traps: 'back',
  upperback: 'back',
  lats: 'back',
  lowerback: 'back',
  glutes: 'back',
  quads: 'front',
  hamstrings: 'back',
  adductors: 'front',
  calves: 'both',
};

/** Etiqueta en español para tooltips/leyendas. */
export const REGION_LABEL: Record<RegionId, string> = {
  neck: 'Cuello',
  shoulders: 'Hombros',
  chest: 'Pecho',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  abs: 'Abdomen',
  obliques: 'Oblicuos',
  traps: 'Trapecio',
  upperback: 'Espalda alta',
  lats: 'Dorsales',
  lowerback: 'Espalda baja',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Femoral',
  adductors: 'Aductores',
  calves: 'Gemelos',
};

/**
 * Término crudo (en minúsculas) -> región canónica. Cubre todos los valores
 * observados en `target` y `secondary_muscles`. Los términos triviales o no
 * musculares (feet, hands, wrists, grip…) se colapsan a la región mayor más
 * cercana (p. ej. antebrazos) para no perder la señal.
 */
const TERM_TO_REGION: Record<string, NormalizedMuscle> = {
  // Cuello
  'levator scapulae': 'neck',
  'sternocleidomastoid': 'neck',
  // Hombros (incluye deltoides posteriores y manguito rotador)
  'delts': 'shoulders',
  'deltoids': 'shoulders',
  'shoulders': 'shoulders',
  'rear deltoids': 'shoulders',
  'rotator cuff': 'shoulders',
  // Pecho
  'pectorals': 'chest',
  'chest': 'chest',
  'upper chest': 'chest',
  'serratus anterior': 'chest',
  // Bíceps
  'biceps': 'biceps',
  'brachialis': 'biceps',
  // Tríceps
  'triceps': 'triceps',
  // Antebrazos (y todo lo distal del brazo)
  'forearms': 'forearms',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  'wrists': 'forearms',
  'grip muscles': 'forearms',
  'hands': 'forearms',
  // Abdomen
  'abs': 'abs',
  'abdominals': 'abs',
  'lower abs': 'abs',
  'core': 'abs',
  // Oblicuos
  'obliques': 'obliques',
  // Trapecio
  'traps': 'traps',
  'trapezius': 'traps',
  // Espalda alta (romboides, redondos, dorsal general)
  'upper back': 'upperback',
  'rhomboids': 'upperback',
  'back': 'upperback',
  // Dorsales
  'lats': 'lats',
  'latissimus dorsi': 'lats',
  // Espalda baja / erectores
  'lower back': 'lowerback',
  'spine': 'lowerback',
  // Glúteos (incluye abductores de cadera)
  'glutes': 'glutes',
  'abductors': 'glutes',
  // Cuádriceps (incluye flexores de cadera, front del muslo)
  'quads': 'quads',
  'quadriceps': 'quads',
  'hip flexors': 'quads',
  // Femoral
  'hamstrings': 'hamstrings',
  // Aductores / cara interna del muslo
  'adductors': 'adductors',
  'inner thighs': 'adductors',
  'groin': 'adductors',
  // Gemelos / parte baja de la pierna
  'calves': 'calves',
  'soleus': 'calves',
  'shins': 'calves',
  'ankles': 'calves',
  'ankle stabilizers': 'calves',
  'feet': 'calves',
  // Cardiovascular (sin región)
  'cardiovascular system': CARDIO,
};

/** Normaliza un término del dataset a región canónica (o null si no mapea). */
export function normalizeMuscle(term: string): NormalizedMuscle | null {
  return TERM_TO_REGION[term.trim().toLowerCase()] ?? null;
}

export interface ExerciseMuscles {
  target: string;
  secondary_muscles?: string[];
}

export interface MappedMuscles {
  /** Región(es) del músculo primario (`target`). */
  primary: RegionId[];
  /** Regiones secundarias, sin solaparse con las primarias. */
  secondary: RegionId[];
  /** true si el ejercicio es puramente cardiovascular (target => cardio). */
  isCardio: boolean;
}

/**
 * Resuelve las regiones a resaltar para un ejercicio: primario desde `target`,
 * secundarias desde `secondary_muscles` (sin duplicar las primarias). Si el
 * target es cardiovascular, `isCardio` = true y las regiones quedan vacías.
 */
export function musclesForExercise(exercise: ExerciseMuscles): MappedMuscles {
  const targetRegion = normalizeMuscle(exercise.target);
  const isCardio = targetRegion === CARDIO;

  const primary: RegionId[] = targetRegion && targetRegion !== CARDIO ? [targetRegion] : [];
  const primarySet = new Set<RegionId>(primary);

  const secondary: RegionId[] = [];
  const seen = new Set<RegionId>(primarySet);
  (exercise.secondary_muscles ?? []).forEach((raw) => {
    const region = normalizeMuscle(raw);
    if (region && region !== CARDIO && !seen.has(region)) {
      seen.add(region);
      secondary.push(region);
    }
  });

  return { primary, secondary, isCardio };
}
