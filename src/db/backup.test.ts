import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Routine, SessionSet, WorkoutSession } from '../types/routine';

// backup.ts importa routinesRepo/sessionsRepo desde '.' (=> ./index).
// Los mockeamos para verificar la validación de importBackup sin tocar SQLite.
vi.mock('./index', () => ({
  routinesRepo: { save: vi.fn(), listAll: vi.fn() },
  sessionsRepo: {
    addSessionIfNotExists: vi.fn(),
    addSetIfNotExists: vi.fn(),
    listFinished: vi.fn(),
    getSets: vi.fn(),
  },
}));

import { routinesRepo, sessionsRepo } from './index';
import { importBackup, BACKUP_APP_ID, BACKUP_VERSION, type BackupFile } from './backup';

const routine: Routine = {
  id: 'r1',
  name: 'Full Body',
  position: 0,
  archived: false,
  createdAt: 1_700_000_000_000,
  exercises: [
    {
      id: 're1',
      exerciseId: 'ex1',
      exerciseName: 'Sentadilla',
      position: 0,
      targetSets: 3,
      targetReps: 5,
      restSeconds: 120,
    },
  ],
};

const session: WorkoutSession = {
  id: 's1',
  routineId: 'r1',
  routineName: 'Full Body',
  startedAt: 1_700_000_100_000,
  finishedAt: 1_700_000_200_000,
};

const set: SessionSet = {
  id: 'set1',
  sessionId: 's1',
  exerciseId: 'ex1',
  exerciseName: 'Sentadilla',
  setNumber: 1,
  weightKg: 100,
  reps: 5,
  completedAt: 1_700_000_150_000,
};

function validFile(): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: 1_700_000_300_000,
    routines: [structuredClone(routine)],
    sessions: [structuredClone(session)],
    sets: [structuredClone(set)],
  };
}

/** Serializa y reparsea como haría el flujo real (archivo -> JSON.parse). */
function asFileJson(file: unknown): unknown {
  return JSON.parse(JSON.stringify(file));
}

function assertNoWrites(): void {
  expect(routinesRepo.save).not.toHaveBeenCalled();
  expect(sessionsRepo.addSessionIfNotExists).not.toHaveBeenCalled();
  expect(sessionsRepo.addSetIfNotExists).not.toHaveBeenCalled();
}

describe('importBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(routinesRepo.save).mockResolvedValue(undefined);
    vi.mocked(sessionsRepo.addSessionIfNotExists).mockResolvedValue(true);
    vi.mocked(sessionsRepo.addSetIfNotExists).mockResolvedValue(true);
  });

  it('importa un respaldo válido (round-trip) escribiendo rutinas, sesiones y series', async () => {
    const result = await importBackup(asFileJson(validFile()));
    expect(result.ok).toBe(true);
    expect(result.routinesImported).toBe(1);
    expect(result.sessionsImported).toBe(1);
    expect(result.setsImported).toBe(1);
    expect(routinesRepo.save).toHaveBeenCalledTimes(1);
    expect(sessionsRepo.addSessionIfNotExists).toHaveBeenCalledTimes(1);
    expect(sessionsRepo.addSetIfNotExists).toHaveBeenCalledTimes(1);
  });

  it('cuenta solo las series realmente insertadas (idempotencia)', async () => {
    vi.mocked(sessionsRepo.addSetIfNotExists).mockResolvedValue(false);
    vi.mocked(sessionsRepo.addSessionIfNotExists).mockResolvedValue(false);
    const result = await importBackup(asFileJson(validFile()));
    expect(result.ok).toBe(true);
    expect(result.sessionsImported).toBe(0);
    expect(result.setsImported).toBe(0);
  });

  it('rechaza reps = NaN sin escribir nada (MAYOR 1)', async () => {
    const file = validFile();
    (file.sets[0] as { reps: number }).reps = NaN;
    const result = await importBackup(asFileJson(file));
    expect(result.ok).toBe(false);
    assertNoWrites();
  });

  it('rechaza reps fraccionarias y negativas (MAYOR 1)', async () => {
    for (const bad of [2.5, -3, 0]) {
      vi.clearAllMocks();
      const file = validFile();
      (file.sets[0] as { reps: number }).reps = bad;
      const result = await importBackup(asFileJson(file));
      expect(result.ok, `reps=${bad}`).toBe(false);
      assertNoWrites();
    }
  });

  it('rechaza weightKg = Infinity y negativo (MAYOR 1)', async () => {
    for (const bad of [Infinity, -10]) {
      vi.clearAllMocks();
      const file = validFile();
      (file.sets[0] as { weightKg: number }).weightKg = bad;
      const result = await importBackup(asFileJson(file));
      expect(result.ok, `weightKg=${bad}`).toBe(false);
      assertNoWrites();
    }
  });

  it('rechaza una sesión activa (finishedAt: null) colada a mano (MAYOR 2)', async () => {
    const file = validFile();
    (file.sessions[0] as { finishedAt: number | null }).finishedAt = null;
    const result = await importBackup(asFileJson(file));
    expect(result.ok).toBe(false);
    assertNoWrites();
  });

  it('rechaza una serie huérfana (sessionId inexistente) antes de escribir (MAYOR 3)', async () => {
    const file = validFile();
    (file.sets[0] as { sessionId: string }).sessionId = 'no-existe';
    const result = await importBackup(asFileJson(file));
    expect(result.ok).toBe(false);
    assertNoWrites();
  });

  it('rechaza app o versión desconocidas', async () => {
    const wrongApp = asFileJson({ ...validFile(), app: 'OTRA' });
    expect((await importBackup(wrongApp)).ok).toBe(false);

    const wrongVersion = asFileJson({ ...validFile(), version: 999 });
    expect((await importBackup(wrongVersion)).ok).toBe(false);
    assertNoWrites();
  });

  it('rechaza un objeto que no es un respaldo', async () => {
    expect((await importBackup(null)).ok).toBe(false);
    expect((await importBackup({ foo: 'bar' })).ok).toBe(false);
    assertNoWrites();
  });
});
