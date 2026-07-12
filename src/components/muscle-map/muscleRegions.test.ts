import { describe, it, expect } from 'vitest';
import exercises from '../../data/exercises.json';
import { normalizeMuscle, musclesForExercise, CARDIO } from './muscleRegions';

interface RawExercise {
  target: string;
  secondary_muscles?: string[];
}

const dataset = exercises as unknown as RawExercise[];

describe('muscleRegions — cobertura del vocabulario del dataset', () => {
  it('todo valor de `target` normaliza a una región (o cardio), ninguno a null', () => {
    const unmapped = new Set<string>();
    dataset.forEach((ex) => {
      if (normalizeMuscle(ex.target) === null) {
        unmapped.add(ex.target);
      }
    });
    expect([...unmapped]).toEqual([]);
  });

  it('todo valor de `secondary_muscles` normaliza a una región (o cardio), ninguno a null', () => {
    const unmapped = new Set<string>();
    dataset.forEach((ex) => {
      (ex.secondary_muscles ?? []).forEach((m) => {
        if (normalizeMuscle(m) === null) {
          unmapped.add(m);
        }
      });
    });
    expect([...unmapped]).toEqual([]);
  });
});

describe('musclesForExercise', () => {
  it('marca primario desde target y secundarios sin duplicar', () => {
    const result = musclesForExercise({
      target: 'pectorals',
      secondary_muscles: ['triceps', 'deltoids', 'chest'], // 'chest' repite el primario
    });
    expect(result.primary).toEqual(['chest']);
    expect(result.secondary).toEqual(['triceps', 'shoulders']);
    expect(result.secondary).not.toContain('chest');
    expect(result.isCardio).toBe(false);
  });

  it('colapsa sinónimos a la misma región (quadriceps/quads, traps/trapezius)', () => {
    expect(normalizeMuscle('quadriceps')).toBe('quads');
    expect(normalizeMuscle('quads')).toBe('quads');
    expect(normalizeMuscle('trapezius')).toBe('traps');
    expect(normalizeMuscle('Traps')).toBe('traps'); // case-insensitive
  });

  it('detecta cardio y no produce regiones', () => {
    const result = musclesForExercise({ target: 'cardiovascular system' });
    expect(result.isCardio).toBe(true);
    expect(result.primary).toEqual([]);
    expect(result.secondary).toEqual([]);
    expect(normalizeMuscle('cardiovascular system')).toBe(CARDIO);
  });

  it('ignora términos secundarios cardio/desconocidos sin romper', () => {
    const result = musclesForExercise({
      target: 'glutes',
      secondary_muscles: ['cardiovascular system', 'hamstrings'],
    });
    expect(result.primary).toEqual(['glutes']);
    expect(result.secondary).toEqual(['hamstrings']); // cardio no entra como región
  });
});
