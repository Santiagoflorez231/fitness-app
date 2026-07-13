import { describe, it, expect } from 'vitest';
import exercisesData from '../data/exercises.json';
import { generatePlan, type DaysPerWeek, type EquipmentTier, type RoutineSplit } from './routineGenerator';
import type { Exercise } from '../types/exercise';

const catalog = exercisesData as Exercise[];
const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

const DAYS: DaysPerWeek[] = [2, 3, 4, 5];
const SPLITS: RoutineSplit[] = ['fullbody', 'ppl', 'torso-pierna'];
const EQUIPMENT: EquipmentTier[] = ['gym', 'basico', 'casa'];

describe('generatePlan — combinaciones split x equipo x días (dataset real)', () => {
  SPLITS.forEach((split) => {
    EQUIPMENT.forEach((equipment) => {
      DAYS.forEach((daysPerWeek) => {
        it(`${split} / ${equipment} / ${daysPerWeek} días: genera un plan válido`, () => {
          const plan = generatePlan({ daysPerWeek, split, equipment }, catalog);

          expect(plan).not.toBeNull();
          const routines = plan!;
          expect(routines.length).toBe(daysPerWeek);

          const names = new Set<string>();
          routines.forEach((routine) => {
            expect(routine.exercises.length).toBeGreaterThan(0);
            expect(routine.name.trim().length).toBeGreaterThan(0);
            // Nombres de rutina únicos dentro del plan.
            expect(names.has(routine.name)).toBe(false);
            names.add(routine.name);

            // Ejercicios únicos dentro de una misma rutina/día.
            const exerciseNamesInDay = new Set<string>();
            routine.exercises.forEach((re, index) => {
              expect(exerciseNamesInDay.has(re.exerciseName)).toBe(false);
              exerciseNamesInDay.add(re.exerciseName);

              // El ejercicio existe de verdad en el dataset (id + nombre coinciden).
              const real = byId.get(re.exerciseId);
              expect(real).toBeDefined();
              expect(real?.name).toBe(re.exerciseName);

              // targetSets/Reps/rest sanos.
              expect(re.targetSets).toBe(3);
              expect(re.targetReps).toBeGreaterThanOrEqual(8);
              expect(re.targetReps).toBeLessThanOrEqual(10);
              expect(re.restSeconds).toBeGreaterThanOrEqual(60);
              expect(re.restSeconds).toBeLessThanOrEqual(120);

              // position consecutiva dentro de la rutina.
              expect(re.position).toBe(index);
            });

            expect(routine.archived).toBe(false);
          });
        });
      });
    });
  });
});

describe('generatePlan — composición por split', () => {
  it('fullbody sin gym: 4 ejercicios por día (sin accesorio)', () => {
    const plan = generatePlan({ daysPerWeek: 3, split: 'fullbody', equipment: 'basico' }, catalog);
    plan!.forEach((routine) => expect(routine.exercises.length).toBe(4));
  });

  it('fullbody con gym: 5 ejercicios por día (con accesorio)', () => {
    const plan = generatePlan({ daysPerWeek: 3, split: 'fullbody', equipment: 'gym' }, catalog);
    plan!.forEach((routine) => expect(routine.exercises.length).toBe(5));
  });

  it('ppl a 3 días: un día de cada tipo, Día 1 cada uno', () => {
    const plan = generatePlan({ daysPerWeek: 3, split: 'ppl', equipment: 'gym' }, catalog);
    expect(plan!.map((r) => r.name)).toEqual(['Empuje · Día 1', 'Tirón · Día 1', 'Pierna · Día 1']);
    plan!.forEach((routine) => expect(routine.exercises.length).toBe(4));
  });

  it('ppl a 5 días: repite empuje y tirón como "Día 2"', () => {
    const plan = generatePlan({ daysPerWeek: 5, split: 'ppl', equipment: 'gym' }, catalog);
    expect(plan!.map((r) => r.name)).toEqual([
      'Empuje · Día 1',
      'Tirón · Día 1',
      'Pierna · Día 1',
      'Empuje · Día 2',
      'Tirón · Día 2',
    ]);
  });

  it('torso-pierna a 4 días: alterna Torso/Pierna, Día 1 y Día 2', () => {
    const plan = generatePlan({ daysPerWeek: 4, split: 'torso-pierna', equipment: 'gym' }, catalog);
    expect(plan!.map((r) => r.name)).toEqual(['Torso · Día 1', 'Pierna · Día 1', 'Torso · Día 2', 'Pierna · Día 2']);
    plan!.forEach((routine) => expect(routine.exercises.length).toBe(4));
  });

  it('es determinista: misma intención produce la misma composición de ejercicios', () => {
    const intent = { daysPerWeek: 4 as DaysPerWeek, split: 'ppl' as RoutineSplit, equipment: 'casa' as EquipmentTier };
    const planA = generatePlan(intent, catalog);
    const planB = generatePlan(intent, catalog);
    const namesA = planA!.map((r) => r.exercises.map((e) => e.exerciseName));
    const namesB = planB!.map((r) => r.exercises.map((e) => e.exerciseName));
    expect(namesA).toEqual(namesB);
  });

  it('casa: nunca elige ejercicios de barra, cable o máquina', () => {
    const plan = generatePlan({ daysPerWeek: 5, split: 'ppl', equipment: 'casa' }, catalog);
    const disallowed = new Set(['barbell', 'olympic barbell', 'ez barbell', 'cable', 'leverage machine']);
    plan!.forEach((routine) => {
      routine.exercises.forEach((re) => {
        const real = byId.get(re.exerciseId)!;
        expect(disallowed.has(real.equipment)).toBe(false);
      });
    });
  });
});

describe('generatePlan — catálogo insuficiente', () => {
  it('devuelve null si el catálogo está vacío', () => {
    const plan = generatePlan({ daysPerWeek: 3, split: 'fullbody', equipment: 'gym' }, []);
    expect(plan).toBeNull();
  });
});
