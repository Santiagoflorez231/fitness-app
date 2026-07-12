import { describe, it, expect } from 'vitest';
import { estimateE1rm, percent1RmForRepsAndRir, percent1RmForRepsAndRpe, rirFromRpe } from './oneRepMax';

describe('estimateE1rm (Epley)', () => {
  it('100 kg x 5 -> 116.7 kg (caso conocido)', () => {
    expect(estimateE1rm(100, 5)).toBe(116.7);
  });

  it('peso x 1 rep -> el propio peso', () => {
    expect(estimateE1rm(80, 1)).toBeCloseTo(82.7, 5);
  });

  it('redondea a 1 decimal', () => {
    expect(estimateE1rm(92.5, 5)).toBe(107.9);
  });
});

describe('rirFromRpe', () => {
  it('RIR = 10 - RPE', () => {
    expect(rirFromRpe(8)).toBe(2);
    expect(rirFromRpe(10)).toBe(0);
    expect(rirFromRpe(6)).toBe(4);
  });
});

describe('percent1RmForRepsAndRir — puntos exactos de la tabla', () => {
  it('5 reps a RIR 2 -> 82 %', () => {
    expect(percent1RmForRepsAndRir(5, 2)).toBe(82);
  });

  it('1 reps a RIR 0 -> 100 % (esquina superior)', () => {
    expect(percent1RmForRepsAndRir(1, 0)).toBe(100);
  });

  it('12 reps a RIR 4 -> 61 % (esquina inferior)', () => {
    expect(percent1RmForRepsAndRir(12, 4)).toBe(61);
  });

  it('8 reps a RIR 3 -> 72 %', () => {
    expect(percent1RmForRepsAndRir(8, 3)).toBe(72);
  });
});

describe('percent1RmForRepsAndRir — interpolación lineal', () => {
  it('interpola en el eje RIR (5 reps, RIR 1.5 -> media de 85 y 82)', () => {
    expect(percent1RmForRepsAndRir(5, 1.5)).toBeCloseTo(83.5, 5);
  });

  it('interpola en el eje reps (4 reps, RIR 0 -> media de fila 3 y fila 5)', () => {
    expect(percent1RmForRepsAndRir(4, 0)).toBeCloseTo(90, 5);
  });

  it('interpola en ambos ejes a la vez', () => {
    // fila 3 reps @ RIR 0-1: 93,90 -> a RIR 0.5: 91.5
    // fila 5 reps @ RIR 0-1: 87,85 -> a RIR 0.5: 86
    // reps 4 (t=0.5) entre 91.5 y 86 -> 88.75
    expect(percent1RmForRepsAndRir(4, 0.5)).toBeCloseTo(88.75, 5);
  });
});

describe('percent1RmForRepsAndRir — clamping fuera de rango', () => {
  it('RIR negativo (RPE > 10) se clampa a RIR 0', () => {
    expect(percent1RmForRepsAndRir(5, -3)).toBe(percent1RmForRepsAndRir(5, 0));
  });

  it('RIR > 4 (RPE < 6) se clampa a RIR 4', () => {
    expect(percent1RmForRepsAndRir(5, 9)).toBe(percent1RmForRepsAndRir(5, 4));
  });

  it('reps fuera de la tabla (0 o 20) se clampan a 1 y 12', () => {
    expect(percent1RmForRepsAndRir(0, 0)).toBe(percent1RmForRepsAndRir(1, 0));
    expect(percent1RmForRepsAndRir(20, 4)).toBe(percent1RmForRepsAndRir(12, 4));
  });
});

describe('percent1RmForRepsAndRpe', () => {
  it('RPE fuera de rango (RPE = 2, fuera de 6-10) se clampa igual que el RIR equivalente', () => {
    // RPE 2 -> RIR 8, fuera de tabla (max 4) -> clamp a RIR 4
    expect(percent1RmForRepsAndRpe(5, 2)).toBe(percent1RmForRepsAndRir(5, 4));
  });

  it('RPE 8 y reps 5 coincide con RIR 2 (82 %)', () => {
    expect(percent1RmForRepsAndRpe(5, 8)).toBe(82);
  });
});
