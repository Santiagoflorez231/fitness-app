import { describe, it, expect } from 'vitest';
import { LocalCoachAdvisor } from './localCoach';
import { buildCategoryCatalog } from './volume';
import type { ExerciseHistory, SetContext } from './types';

const coach = new LocalCoachAdvisor();

describe('LocalCoachAdvisor.suggestNextLoad (A1)', () => {
  it('con RPE: calcula e1RM de la última serie y aplica el %objetivo, redondeado a 2.5 kg', () => {
    const input: SetContext = {
      lastSet: { weightKg: 100, reps: 5, rpe: 8 },
      targetReps: 5,
      targetRpe: 8, // RIR 2 -> 82 % (punto exacto de la tabla)
    };
    const suggestion = coach.suggestNextLoad(input);
    // e1RM(100,5) = 116.7 ; 116.7 * 0.82 = 95.694 -> redondeado a 2.5 -> 95
    expect(suggestion).not.toBeNull();
    expect(suggestion?.weightKg).toBe(95);
    expect(suggestion?.basis).toBe('rpe');
    expect(suggestion?.note).toMatch(/última serie/);
  });

  it('sin RPE en la última serie: cae a la media de e1RM del historial reciente', () => {
    const input: SetContext = {
      lastSet: { weightKg: 95, reps: 5 }, // sin rpe
      targetReps: 5,
      targetRpe: 8,
      recentSets: [
        { weightKg: 90, reps: 5 }, // e1RM 105
        { weightKg: 92.5, reps: 5 }, // e1RM 107.9
      ],
    };
    const suggestion = coach.suggestNextLoad(input);
    // media e1RM = (105 + 107.9) / 2 = 106.45 ; * 0.82 = 87.289 -> redondeado a 2.5 -> 87.5
    expect(suggestion).not.toBeNull();
    expect(suggestion?.weightKg).toBe(87.5);
    expect(suggestion?.basis).toBe('e1rm-history');
    expect(suggestion?.note).toMatch(/media/);
  });

  it('lastSet null: también cae al historial si hay series recientes', () => {
    const input: SetContext = {
      lastSet: null,
      targetReps: 5,
      targetRpe: 8,
      recentSets: [{ weightKg: 90, reps: 5 }],
    };
    const suggestion = coach.suggestNextLoad(input);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.basis).toBe('e1rm-history');
  });

  it('redondea al incremento configurado (mancuerna 2 kg)', () => {
    const input: SetContext = {
      lastSet: { weightKg: 100, reps: 5, rpe: 8 },
      targetReps: 5,
      targetRpe: 8,
      roundingIncrementKg: 2,
    };
    const suggestion = coach.suggestNextLoad(input);
    // 116.7 * 0.82 = 95.694 -> /2 = 47.847 -> round 48 -> 96
    expect(suggestion?.weightKg).toBe(96);
  });

  it('redondea al incremento configurado (1.25 kg)', () => {
    const input: SetContext = {
      lastSet: { weightKg: 100, reps: 5, rpe: 8 },
      targetReps: 5,
      targetRpe: 8,
      roundingIncrementKg: 1.25,
    };
    const suggestion = coach.suggestNextLoad(input);
    // 95.694 / 1.25 = 76.5552 -> round 77 -> 96.25
    expect(suggestion?.weightKg).toBe(96.25);
  });

  it('devuelve null si no hay RPE ni historial reciente (datos insuficientes)', () => {
    const input: SetContext = {
      lastSet: { weightKg: 100, reps: 5 }, // sin rpe
      targetReps: 5,
      targetRpe: 8,
    };
    expect(coach.suggestNextLoad(input)).toBeNull();
  });

  it('devuelve null si no hay ninguna serie previa ni historial', () => {
    const input: SetContext = {
      lastSet: null,
      targetReps: 5,
      targetRpe: 8,
    };
    expect(coach.suggestNextLoad(input)).toBeNull();
  });
});

/** Construye un historial de una serie por sesión con reps fijas (el peso ordena el e1RM). */
function historyFromWeights(weights: number[], reps = 5): ExerciseHistory {
  const baseTimestamp = 1_700_000_000_000;
  const dayMs = 24 * 60 * 60 * 1000;
  return weights.map((weightKg, index) => ({
    sessionId: `s${index + 1}`,
    weightKg,
    reps,
    completedAt: baseTimestamp + index * dayMs,
  }));
}

describe('LocalCoachAdvisor.assessProgress (A2)', () => {
  it('progresando: e1RM al alza en >=2 de las últimas 3 sesiones', () => {
    const history = historyFromWeights([100, 102, 105, 110, 115]);
    const verdict = coach.assessProgress('ex1', history);
    expect(verdict.state).toBe('progress');
  });

  it('estancado: 3 sesiones sin superar el mejor e1RM histórico', () => {
    const history = historyFromWeights([100, 120, 110, 115, 118]);
    const verdict = coach.assessProgress('ex1', history);
    expect(verdict.state).toBe('plateau');
    expect(verdict.message).toMatch(/PR/);
  });

  it('retrocediendo: e1RM a la baja 2 sesiones seguidas', () => {
    const history = historyFromWeights([100, 105, 110, 108, 104]);
    const verdict = coach.assessProgress('ex1', history);
    expect(verdict.state).toBe('regress');
    expect(verdict.message).toMatch(/descarga|deload/i);
  });

  it('agrupa por sesión y usa el mejor e1RM de cada una (varias series por sesión)', () => {
    const history: ExerciseHistory = [
      // sesión 1: mejor set 100kg
      { sessionId: 's1', weightKg: 80, reps: 5, completedAt: 1 },
      { sessionId: 's1', weightKg: 100, reps: 5, completedAt: 2 },
      // sesión 2: supera la sesión 1
      { sessionId: 's2', weightKg: 105, reps: 5, completedAt: 3 },
      // sesión 3: decoy bajo + set bueno que marca nuevo PR
      { sessionId: 's3', weightKg: 90, reps: 5, completedAt: 4 },
      { sessionId: 's3', weightKg: 112, reps: 5, completedAt: 5 },
    ];
    const verdict = coach.assessProgress('ex1', history);
    expect(verdict.state).toBe('progress');
  });

  it('caso borde: una sola sesión -> datos insuficientes, no alarma', () => {
    const history = historyFromWeights([100]);
    const verdict = coach.assessProgress('ex1', history);
    expect(verdict.state).toBe('progress');
    expect(verdict.message).toMatch(/histórico suficiente/);
  });

  it('caso borde: historial vacío -> datos insuficientes', () => {
    const verdict = coach.assessProgress('ex1', []);
    expect(verdict.state).toBe('progress');
    expect(verdict.message).toMatch(/histórico suficiente/);
  });
});

describe('LocalCoachAdvisor.volumeBalance (A3, envoltorio de ./volume)', () => {
  it('delega en weeklyVolumeBalance sin reimplementar el cálculo', () => {
    const catalog = buildCategoryCatalog([
      { id: 'ex1', category: 'chest' },
      { id: 'ex2', category: 'back' },
    ]);
    const setsThisWeek = [{ exerciseId: 'ex1' }, { exerciseId: 'ex1' }, { exerciseId: 'ex2' }];
    const balance = coach.volumeBalance(setsThisWeek, catalog);
    const empuje = balance.find((entry) => entry.family === 'empuje');
    const tiron = balance.find((entry) => entry.family === 'tiron');
    expect(empuje?.sets).toBe(2);
    expect(tiron?.sets).toBe(1);
  });
});
