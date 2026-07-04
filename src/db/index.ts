/**
 * Factory de acceso a datos: los componentes importan `routinesRepo` y
 * `sessionsRepo` de aquí, nunca las implementaciones concretas.
 *
 * Fase 2: singletons sobre localStorage (./local.ts) — retirado.
 * Fase 3: singletons sobre SQLite (@capacitor-community/sqlite) según
 * docs/persistence-schema.md, con migración de los datos provisionales de
 * localStorage. Cada método de estos singletons abre/crea la conexión y
 * aplica el esquema/migraciones de forma perezosa (una sola vez) por dentro
 * de ./sqlite.ts; los componentes que consumen estos singletons no cambian.
 */

import { SQLiteRoutinesRepo, SQLiteSessionsRepo } from './sqlite';
import type { RoutinesRepo, SessionsRepo } from './repos';

export const routinesRepo: RoutinesRepo = new SQLiteRoutinesRepo();
export const sessionsRepo: SessionsRepo = new SQLiteSessionsRepo();
