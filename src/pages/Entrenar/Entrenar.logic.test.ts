/**
 * Tests de la lógica endurecida de resolución de series (deuda señalada por
 * las auditorías QA de opus): setsForPlanExercise / resolvesToRealBlock /
 * buildPlan son las funciones de máximo riesgo de la app (deciden a qué
 * bloque pertenece cada serie registrada) y hasta ahora no tenían ni una
 * aserción. Se importan directamente de Entrenar.tsx (exportadas sin cambio
 * de comportamiento).
 */
import { describe, it, expect } from 'vitest';
import { buildPlan, setsForPlanExercise, resolvesToRealBlock, type PlanExercise } from './Entrenar';
import type { AdhocBlock } from '../../db/adhocBlocks';
import type { Routine, SessionSet } from '../../types/routine';
import type { Exercise } from '../../types/exercise';

const EXERCISES: Exercise[] = [
  {
    id: 'ex1',
    name: 'barbell bench press',
    category: 'chest',
    equipment: 'barbell',
    target: 'pectorals',
    muscle_group: 'chest',
    secondary_muscles: [],
    media_id: 'm1',
    steps: { en: [], es: [] },
  },
  {
    id: 'ex2',
    name: 'pull-up',
    category: 'back',
    equipment: 'body weight',
    target: 'lats',
    muscle_group: 'lats',
    secondary_muscles: [],
    media_id: 'm2',
    steps: { en: [], es: [] },
  },
];

const ROUTINE: Routine = {
  id: 'r1',
  name: 'Torso',
  position: 0,
  archived: false,
  createdAt: 1,
  exercises: [
    {
      id: 'block-bench',
      exerciseId: 'ex1',
      exerciseName: 'barbell bench press',
      position: 0,
      targetSets: 3,
      targetReps: 8,
      restSeconds: 120,
    },
  ],
};

const ADHOC_BENCH: AdhocBlock = {
  key: 'adhoc-1',
  exerciseId: 'ex1',
  exerciseName: 'barbell bench press',
  target: 'pectorals',
  category: 'chest',
  targetSets: 3,
  targetReps: 10,
  restSeconds: 90,
};

const ADHOC_BENCH_2: AdhocBlock = { ...ADHOC_BENCH, key: 'adhoc-2' };

function makeSet(overrides: Partial<SessionSet>): SessionSet {
  return {
    id: crypto.randomUUID(),
    sessionId: 's1',
    exerciseId: 'ex1',
    exerciseName: 'barbell bench press',
    setNumber: 1,
    weightKg: 100,
    reps: 5,
    completedAt: 10,
    ...overrides,
  };
}

describe('buildPlan', () => {
  it('ordena rutina → ad-hoc → huérfanos, sin perder ninguna serie', () => {
    const orphanSet = makeSet({ exerciseId: 'ex2', exerciseName: 'pull-up', routineExerciseId: 'bloque-borrado' });
    const plan = buildPlan(ROUTINE, [orphanSet], EXERCISES, [ADHOC_BENCH]);

    expect(plan.map((pe) => pe.key)).toEqual(['block-bench', 'adhoc-1', expect.any(String)]);
    expect(plan[0].isOrphan).toBe(false);
    expect(plan[1].isOrphan).toBe(false);
    const orphan = plan[2];
    expect(orphan.isOrphan).toBe(true);
    expect(orphan.exerciseId).toBe('ex2');
    // La serie huérfana sigue siendo recuperable a través de su bloque huérfano.
    expect(setsForPlanExercise(plan, orphan, [orphanSet])).toHaveLength(1);
  });

  it('sesión libre (sin rutina): plan = solo bloques ad-hoc', () => {
    const plan = buildPlan(null, [], EXERCISES, [ADHOC_BENCH]);
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('adhoc-1');
    expect(plan[0].isOrphan).toBe(false);
  });
});

describe('setsForPlanExercise — bloques mixtos del MISMO ejercicio', () => {
  it('rutina + ad-hoc del mismo ejercicio: cada serie va a su bloque por routineExerciseId', () => {
    const plan = buildPlan(ROUTINE, [], EXERCISES, [ADHOC_BENCH]);
    const routineBlock = plan[0];
    const adhocBlock = plan[1];

    const routineSet = makeSet({ routineExerciseId: 'block-bench', setNumber: 1 });
    const adhocSet = makeSet({ routineExerciseId: 'adhoc-1', setNumber: 1 });
    const sets = [routineSet, adhocSet];

    expect(setsForPlanExercise(plan, routineBlock, sets)).toEqual([routineSet]);
    expect(setsForPlanExercise(plan, adhocBlock, sets)).toEqual([adhocSet]);
  });

  it('serie legacy (routineExerciseId null) va SOLO al primer bloque real del ejercicio', () => {
    const plan = buildPlan(ROUTINE, [], EXERCISES, [ADHOC_BENCH]);
    const legacySet = makeSet({ routineExerciseId: undefined });

    expect(setsForPlanExercise(plan, plan[0], [legacySet])).toEqual([legacySet]);
    expect(setsForPlanExercise(plan, plan[1], [legacySet])).toEqual([]);
  });

  it('dos bloques ad-hoc del mismo ejercicio quedan separados por key', () => {
    const plan = buildPlan(null, [], EXERCISES, [ADHOC_BENCH, ADHOC_BENCH_2]);
    const set1 = makeSet({ routineExerciseId: 'adhoc-1' });
    const set2 = makeSet({ routineExerciseId: 'adhoc-2' });

    expect(setsForPlanExercise(plan, plan[0], [set1, set2])).toEqual([set1]);
    expect(setsForPlanExercise(plan, plan[1], [set1, set2])).toEqual([set2]);
  });

  it('serie de un bloque BORRADO del mismo ejercicio cae al huérfano, no al ad-hoc', () => {
    // La rutina se editó a mitad de sesión: el bloque original desapareció,
    // pero hay un ad-hoc nuevo del mismo ejercicio. La serie vieja no debe
    // "colarse" en el bloque ad-hoc.
    const staleSet = makeSet({ routineExerciseId: 'bloque-que-ya-no-existe' });
    const plan = buildPlan(null, [staleSet], EXERCISES, [ADHOC_BENCH]);

    expect(plan).toHaveLength(2);
    const adhoc = plan[0];
    const orphan = plan[1];
    expect(orphan.isOrphan).toBe(true);

    expect(setsForPlanExercise(plan, adhoc, [staleSet])).toEqual([]);
    expect(setsForPlanExercise(plan, orphan, [staleSet])).toEqual([staleSet]);
  });
});

describe('resolvesToRealBlock', () => {
  const plan: PlanExercise[] = buildPlan(ROUTINE, [], EXERCISES, [ADHOC_BENCH]);
  const realBlocks = plan.filter((pe) => !pe.isOrphan);

  it('resuelve por key exacta cuando hay routineExerciseId', () => {
    expect(resolvesToRealBlock(realBlocks, makeSet({ routineExerciseId: 'adhoc-1' }))).toBe(true);
    expect(resolvesToRealBlock(realBlocks, makeSet({ routineExerciseId: 'otro' }))).toBe(false);
  });

  it('serie legacy resuelve por exerciseId compartido', () => {
    expect(resolvesToRealBlock(realBlocks, makeSet({ routineExerciseId: undefined }))).toBe(true);
    expect(
      resolvesToRealBlock(realBlocks, makeSet({ exerciseId: 'ex2', routineExerciseId: undefined })),
    ).toBe(false);
  });
});
