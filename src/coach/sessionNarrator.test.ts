import { describe, it, expect } from 'vitest';
import { TemplateNarrator } from './sessionNarrator';
import type { SessionNarratorInput } from './sessionNarrator';

const narrator = new TemplateNarrator();

describe('TemplateNarrator.summarize', () => {
  it('con PRs: menciona la duración, el volumen, el PR y cierra con tono de logro', () => {
    const input: SessionNarratorInput = {
      durationMs: 42 * 60 * 1000,
      sets: [
        { exerciseName: 'press banca', weightKg: 80, reps: 8 },
        { exerciseName: 'press banca', weightKg: 82.5, reps: 6, rpe: 9 },
        { exerciseName: 'remo con barra', weightKg: 70, reps: 8 },
      ],
      prCount: 1,
      volumeKg: 3240,
    };
    const text = narrator.summarize(input);
    expect(text).toContain('42 min');
    // es-ES con Intl.NumberFormat solo agrupa por miles a partir de 10.000
    // (minimumGroupingDigits del locale); 3240 se formatea sin separador.
    expect(text).toContain('3240');
    expect(text).toContain('PR en press banca');
    expect(text).toContain('Trabajo hecho.');
  });

  it('con varios PRs: cuenta el número de PRs', () => {
    const input: SessionNarratorInput = {
      durationMs: 50 * 60 * 1000,
      sets: [
        { exerciseName: 'sentadilla', weightKg: 120, reps: 5 },
        { exerciseName: 'peso muerto', weightKg: 150, reps: 3 },
      ],
      prCount: 2,
      volumeKg: 1500,
    };
    const text = narrator.summarize(input);
    expect(text).toContain('2 PR');
    expect(text).toContain('peso muerto'); // serie más pesada
    expect(text).toContain('Trabajo hecho.');
  });

  it('sin PRs con mejora de e1RM: destaca la mejora y cierra con tono de logro', () => {
    const input: SessionNarratorInput = {
      durationMs: 35 * 60 * 1000,
      sets: [
        { exerciseName: 'sentadilla', weightKg: 100, reps: 5, rpe: 8 },
        { exerciseName: 'sentadilla', weightKg: 100, reps: 5, rpe: 8 },
      ],
      prCount: 0,
      volumeKg: 1000,
      bestE1rmDelta: { exerciseName: 'sentadilla', deltaKg: 2.5 },
    };
    const text = narrator.summarize(input);
    expect(text).toContain('+2,5 kg de 1RM estimado en sentadilla');
    expect(text).toContain('Trabajo hecho.');
    expect(text).not.toMatch(/PR/);
  });

  it('sesión plana (sin PR, sin mejora): destaca constancia y cierra con tono llano', () => {
    const input: SessionNarratorInput = {
      durationMs: 40 * 60 * 1000,
      sets: [
        { exerciseName: 'curl con mancuerna', weightKg: 12, reps: 10 },
        { exerciseName: 'curl con mancuerna', weightKg: 12, reps: 10 },
        { exerciseName: 'curl con mancuerna', weightKg: 12, reps: 10 },
      ],
      prCount: 0,
      volumeKg: 360,
    };
    const text = narrator.summarize(input);
    expect(text).toContain('Constancia en curl con mancuerna');
    expect(text).toContain('A descansar.');
  });

  it('sesión corta (pocas series, sin PR): igualmente produce un resumen válido', () => {
    const input: SessionNarratorInput = {
      durationMs: 6 * 60 * 1000,
      sets: [{ exerciseName: 'plancha', weightKg: 0, reps: 1 }],
      prCount: 0,
      volumeKg: 0,
    };
    const text = narrator.summarize(input);
    expect(text).toContain('6 min');
    expect(text).toContain('1 serie,');
    expect(text.length).toBeGreaterThan(0);
  });

  it('sesión sin series registradas: no revienta y sigue cerrando en tono llano', () => {
    const input: SessionNarratorInput = {
      durationMs: 2 * 60 * 1000,
      sets: [],
      prCount: 0,
      volumeKg: 0,
    };
    const text = narrator.summarize(input);
    expect(text).toContain('2 min');
    expect(text).toContain('Sesión sin series registradas.');
    expect(text).toContain('A descansar.');
  });

  it('formatea los números en es-ES (punto de miles, coma decimal)', () => {
    const input: SessionNarratorInput = {
      durationMs: 60 * 60 * 1000,
      sets: [{ exerciseName: 'peso muerto', weightKg: 150, reps: 5 }],
      prCount: 0,
      volumeKg: 10500.5,
    };
    const text = narrator.summarize(input);
    expect(text).toContain('10.500,5');
  });
});
