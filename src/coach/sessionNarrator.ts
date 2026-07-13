/**
 * `TemplateNarrator` — implementación local (plantillas de texto, sin
 * red/IA) del puente "SessionNarrator" (docs/roadmap-avanzado.md, Bloque D;
 * docs/renovacion-plan.md, R9). Contrato intercambiable: hoy compone el
 * resumen con reglas de texto fijas; el día que exista una versión
 * respaldada por LLM implementará el mismo `SessionNarrator.summarize` sin
 * tocar el summary de Entrenar.
 *
 * Nota de alcance: el roadmap documenta `summarize(session, prior):
 * string`. Esta tarea (R9) pide en su lugar `summarize(input): string` con
 * un `SessionNarratorInput` plano construido a partir de datos que
 * `finishSession` (Entrenar.tsx) ya tiene en memoria en el momento de
 * terminar la sesión (sets, prKeys.size, volumeKg, duración) -- así no hace
 * falta releer la sesión de la base de datos ni definir un `SessionContext`
 * nuevo. Se documenta aquí como decisión explícita de la tarea.
 */

export interface SessionNarratorSet {
  exerciseName: string;
  weightKg: number;
  reps: number;
  rpe?: number;
}

export interface BestE1rmDelta {
  exerciseName: string;
  deltaKg: number;
}

export interface SessionNarratorInput {
  durationMs: number;
  sets: SessionNarratorSet[];
  /** Número de series marcadas como PR en vivo durante la sesión (prKeys.size en Entrenar). */
  prCount: number;
  volumeKg: number;
  /** Mejora de e1RM más destacada de la sesión frente al histórico previo, si la hay. */
  bestE1rmDelta?: BestE1rmDelta;
}

/** Contrato intercambiable: ver nota de alcance arriba. */
export interface SessionNarrator {
  summarize(input: SessionNarratorInput): string;
}

const NUMBER_FORMAT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

function formatEsNum(value: number): string {
  return NUMBER_FORMAT.format(value);
}

function formatMinutes(durationMs: number): string {
  const minutes = Math.max(0, Math.round(durationMs / 60000));
  return `${minutes} min`;
}

/** Nombre de ejercicio más repetido entre las series (para la frase de
 * constancia cuando no hay PR ni mejora de e1RM que destacar). `null` si no
 * hay series. */
function mostFrequentExerciseName(sets: SessionNarratorSet[]): string | null {
  if (sets.length === 0) {
    return null;
  }
  const counts = new Map<string, number>();
  sets.forEach((set) => {
    counts.set(set.exerciseName, (counts.get(set.exerciseName) ?? 0) + 1);
  });
  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((count, name) => {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  });
  return best;
}

/** Serie de mayor peso de la sesión (para nombrar el ejercicio de PR cuando
 * hay más de uno marcado, sin necesidad de que el llamador desambigüe). */
function heaviestSetExerciseName(sets: SessionNarratorSet[]): string | null {
  if (sets.length === 0) {
    return null;
  }
  const heaviest = sets.reduce((max, set) => (set.weightKg > max.weightKg ? set : max), sets[0]);
  return heaviest.exerciseName;
}

const CLOSING_LINES = ['Trabajo hecho.', 'A descansar.'] as const;

/** Cierre determinista pero variado: PR -> tono de logro; resto -> tono llano. */
function closingLine(hasHighlight: boolean): string {
  return hasHighlight ? CLOSING_LINES[0] : CLOSING_LINES[1];
}

export class TemplateNarrator implements SessionNarrator {
  summarize(input: SessionNarratorInput): string {
    const { durationMs, sets, prCount, volumeKg, bestE1rmDelta } = input;

    const openingLine =
      sets.length > 0
        ? `${formatMinutes(durationMs)}. ${sets.length} ${sets.length === 1 ? 'serie' : 'series'}, ${formatEsNum(volumeKg)} kg movidos.`
        : `${formatMinutes(durationMs)}. Sesión sin series registradas.`;

    let highlightLine: string | null = null;
    if (prCount > 0) {
      const exerciseName = heaviestSetExerciseName(sets);
      highlightLine =
        prCount === 1
          ? `PR${exerciseName ? ` en ${exerciseName}` : ''}.`
          : `${prCount} PR${exerciseName ? `, el mejor en ${exerciseName}` : ''}.`;
    } else if (bestE1rmDelta && bestE1rmDelta.deltaKg > 0) {
      highlightLine = `+${formatEsNum(bestE1rmDelta.deltaKg)} kg de 1RM estimado en ${bestE1rmDelta.exerciseName}.`;
    } else if (sets.length > 0) {
      const frequent = mostFrequentExerciseName(sets);
      highlightLine = frequent ? `Constancia en ${frequent}. Sigue así.` : 'Constancia. Sigue así.';
    }

    const lines = [openingLine];
    if (highlightLine) {
      lines.push(highlightLine);
    }
    lines.push(closingLine(prCount > 0 || Boolean(bestE1rmDelta && bestE1rmDelta.deltaKg > 0)));

    return lines.join(' ');
  }
}

export const templateNarrator = new TemplateNarrator();
