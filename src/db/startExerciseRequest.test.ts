/** Tests del handoff COMENZAR (deuda QA Bloque B). */
import { describe, it, expect, beforeEach } from 'vitest';
import { writeStartExerciseRequest, consumeStartExerciseRequest } from './startExerciseRequest';

const KEY = 'carga.startExercise';

describe('startExerciseRequest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('write → consume devuelve la petición y la borra', () => {
    writeStartExerciseRequest('ex1');
    expect(consumeStartExerciseRequest()).toEqual({ exerciseId: 'ex1' });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('un segundo consume devuelve null (una sola vez)', () => {
    writeStartExerciseRequest('ex1');
    consumeStartExerciseRequest();
    expect(consumeStartExerciseRequest()).toBeNull();
  });

  it('la última petición gana', () => {
    writeStartExerciseRequest('ex1');
    writeStartExerciseRequest('ex2');
    expect(consumeStartExerciseRequest()).toEqual({ exerciseId: 'ex2' });
  });

  it('JSON corrupto: devuelve null pero BORRA igualmente (consume siempre)', () => {
    localStorage.setItem(KEY, '{roto');
    expect(consumeStartExerciseRequest()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('shape inválido: null y borrado', () => {
    localStorage.setItem(KEY, JSON.stringify({ otra: 'cosa' }));
    expect(consumeStartExerciseRequest()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('sin petición pendiente: null', () => {
    expect(consumeStartExerciseRequest()).toBeNull();
  });
});
