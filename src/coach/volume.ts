/**
 * Balance de volumen semanal por familia muscular — "lo Symmetric/RP"
 * (docs/roadmap-avanzado.md, Bloque A, sección A3). Función PURA: no lee
 * la base de datos ni el dataset directamente, recibe las series de la
 * semana ISO actual ya resueltas (docs/persistence-schema.md: los límites
 * de semana se calculan en hora local en el momento de la consulta, no al
 * guardar) y un catálogo exerciseId -> category, y devuelve el veredicto
 * por familia.
 *
 * Esta es la semilla del futuro `CoachAdvisor.volumeBalance` del roadmap:
 * hoy (R4) solo la consume el panel de balance de Progreso; el día que
 * exista un CoachAdvisor, podrá envolver esta misma función sin cambiar su
 * forma.
 *
 * La familia se deriva con el MISMO mapeo category -> familia que usan los
 * avatares duotono (src/components/ExerciseAvatar.tsx) — no se duplica.
 */
import { familyForCategory, type AvatarFamily } from '../components/ExerciseAvatar';

export type Familia = AvatarFamily;

export type VolumeZone = 'low' | 'ok' | 'high';

export interface FamilyVolume {
  family: Familia;
  sets: number;
  zone: VolumeZone;
  hint?: string;
}

/** Catálogo exerciseId -> category, tal como viene en src/data/exercises.json. */
export type ExerciseCategoryCatalog = ReadonlyMap<string, string>;

/** Construye el catálogo a partir de la lista de ejercicios del dataset (useExercises()). */
export function buildCategoryCatalog(exercises: { id: string; category: string }[]): ExerciseCategoryCatalog {
  const catalog = new Map<string, string>();
  exercises.forEach((exercise) => catalog.set(exercise.id, exercise.category));
  return catalog;
}

interface Landmarks {
  /** Por debajo de este número de series semanales -> zona 'low' (< MEV). */
  lowMax: number;
  /** Por encima de este número de series semanales -> zona 'high' (> MRV). */
  highMin: number;
}

// Series duras semanales por familia (docs/roadmap-avanzado.md, sección A3).
// "Serie dura" = serie con RPE >= 7; la columna `rpe` todavía no existe en
// session_sets (ver persistence-schema.md / migración v3 pendiente), así
// que hoy TODA serie registrada cuenta como dura (regla explícita de la
// tarea R4). Cardio no tiene landmarks definidos.
const LANDMARKS: Record<Exclude<Familia, 'cardio'>, Landmarks> = {
  empuje: { lowMax: 8, highMin: 22 },
  tiron: { lowMax: 8, highMin: 22 },
  pierna: { lowMax: 8, highMin: 22 },
  core: { lowMax: 6, highMin: 18 },
  brazos: { lowMax: 6, highMin: 20 },
};

const FAMILY_ORDER: Familia[] = ['empuje', 'tiron', 'pierna', 'core', 'brazos', 'cardio'];

const FAMILY_LABEL: Record<Familia, string> = {
  empuje: 'Empuje',
  tiron: 'Tirón',
  pierna: 'Pierna',
  core: 'Core',
  brazos: 'Brazos',
  cardio: 'Cardio',
};

function zoneFor(family: Familia, sets: number): VolumeZone {
  if (family === 'cardio') {
    return 'ok'; // sin landmarks definidos (docs/roadmap-avanzado.md): no se juzga.
  }
  const { lowMax, highMin } = LANDMARKS[family];
  if (sets < lowMax) {
    return 'low';
  }
  if (sets > highMin) {
    return 'high';
  }
  return 'ok';
}

function hintFor(family: Familia, sets: number, zone: VolumeZone): string | undefined {
  const label = FAMILY_LABEL[family];
  if (family === 'cardio') {
    return sets > 0 ? `${label} ${sets}.` : undefined;
  }
  if (zone === 'low') {
    return `${label} ${sets} · justo. Súbele.`;
  }
  if (zone === 'high') {
    return `${label} ${sets} · alto. Vigila la recuperación.`;
  }
  return `${label} ${sets} · en rango.`;
}

/**
 * Balance de volumen semanal por familia muscular.
 * `setsThisWeek` son las series (con `exerciseId`) YA filtradas a la
 * semana ISO actual por el llamador. Ejercicios ausentes del catálogo
 * (dataset desactualizado) se ignoran en el cómputo.
 */
export function weeklyVolumeBalance(
  setsThisWeek: { exerciseId: string }[],
  catalog: ExerciseCategoryCatalog,
): FamilyVolume[] {
  const counts = new Map<Familia, number>(FAMILY_ORDER.map((family) => [family, 0]));

  setsThisWeek.forEach((set) => {
    const category = catalog.get(set.exerciseId);
    if (category === undefined) {
      return;
    }
    const family = familyForCategory(category);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  });

  return FAMILY_ORDER.map((family) => {
    const sets = counts.get(family) ?? 0;
    const zone = zoneFor(family, sets);
    return { family, sets, zone, hint: hintFor(family, sets, zone) };
  });
}

/**
 * Mismo balance, ordenado por déficit (lo más bajo primero) para que salte
 * a la vista qué familia falta trabajar. Cardio (sin zona) va al final.
 */
export function sortByDeficit(balance: FamilyVolume[]): FamilyVolume[] {
  return [...balance].sort((a, b) => {
    if (a.family === 'cardio') return 1;
    if (b.family === 'cardio') return -1;
    return a.sets - b.sets;
  });
}
