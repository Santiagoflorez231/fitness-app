/** Tests de la persistencia de bloques ad-hoc (deuda QA Bloque B). */
import { describe, it, expect, beforeEach } from 'vitest';
import { listAdhocBlocks, addAdhocBlock, clearAdhocBlocks } from './adhocBlocks';
import type { Exercise } from '../types/exercise';

const EXERCISE: Exercise = {
  id: 'ex1',
  name: 'barbell bench press',
  category: 'chest',
  equipment: 'barbell',
  target: 'pectorals',
  muscle_group: 'chest',
  secondary_muscles: [],
  media_id: 'm1',
  steps: { en: [], es: [] },
};

describe('adhocBlocks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trip add → list → clear', () => {
    expect(listAdhocBlocks('s1')).toEqual([]);
    const block = addAdhocBlock('s1', EXERCISE);
    expect(block.key.startsWith('adhoc-')).toBe(true);
    expect(block.exerciseId).toBe('ex1');
    expect(listAdhocBlocks('s1')).toEqual([block]);
    // Otra sesión no ve los bloques de s1.
    expect(listAdhocBlocks('s2')).toEqual([]);
    clearAdhocBlocks('s1');
    expect(listAdhocBlocks('s1')).toEqual([]);
  });

  it('conserva el orden de alta', () => {
    const a = addAdhocBlock('s1', EXERCISE);
    const b = addAdhocBlock('s1', { ...EXERCISE, id: 'ex2', name: 'pull-up' });
    expect(listAdhocBlocks('s1').map((x) => x.key)).toEqual([a.key, b.key]);
  });

  it('JSON corrupto devuelve [] sin lanzar', () => {
    localStorage.setItem('carga.adhocBlocks.s1', '{no es json');
    expect(listAdhocBlocks('s1')).toEqual([]);
  });

  it('filtra shapes inválidos y conserva los válidos', () => {
    const valid = addAdhocBlock('s1', EXERCISE);
    const raw = JSON.parse(localStorage.getItem('carga.adhocBlocks.s1') ?? '[]') as unknown[];
    raw.push({ key: 'adhoc-x' }); // incompleto
    raw.push(42); // no objeto
    localStorage.setItem('carga.adhocBlocks.s1', JSON.stringify(raw));
    expect(listAdhocBlocks('s1')).toEqual([valid]);
  });

  it('no-array en storage devuelve []', () => {
    localStorage.setItem('carga.adhocBlocks.s1', JSON.stringify({ foo: 1 }));
    expect(listAdhocBlocks('s1')).toEqual([]);
  });
});
