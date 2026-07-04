# Esquema de persistencia local

Decisión de arquitectura (Fase 0, se implementa en Fase 3). SQLite vía
`@capacitor-community/sqlite` en Android/iOS; en web (dev y PWA) el mismo
plugin funciona sobre `jeep-sqlite` (sql.js + IndexedDB). Todo el acceso pasa
por una capa única en `src/db/` — ningún componente toca SQL directamente.

## Principios

- **El dataset de ejercicios NO vive en la DB**: es estático, se importa como
  JSON (`src/data/exercises.json`) y se referencia por `exercise_id` (string,
  ej. `"0001"`).
- **Snapshots de nombre**: las tablas de historial guardan `exercise_name`
  además del id, para que el historial sobreviva a cambios/eliminaciones del
  dataset.
- **Pesos siempre en kg** (REAL). Conversión a otras unidades, si algún día
  se quiere, es asunto de la capa de presentación.
- **Timestamps en epoch milliseconds UTC** (INTEGER). Los límites de semana
  para el gráfico de volumen se calculan en la zona horaria local en el
  momento de la consulta, no al guardar.
- **PRs y volumen semanal NO se almacenan**: se derivan con consultas sobre
  `session_sets` (hay índice para eso). Nada de datos duplicados que puedan
  desincronizarse.
- Ids propios: UUID v4 generados con `crypto.randomUUID()`.

## Tablas

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS routines (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,   -- orden manual en la lista
  archived    INTEGER NOT NULL DEFAULT 0,   -- soft-delete: conserva historial
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id                  TEXT PRIMARY KEY,
  routine_id          TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id         TEXT NOT NULL,        -- id del dataset estático
  exercise_name       TEXT NOT NULL,        -- snapshot
  position            INTEGER NOT NULL,
  target_sets         INTEGER NOT NULL,
  target_reps         INTEGER NOT NULL,
  rest_seconds        INTEGER NOT NULL DEFAULT 90,
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  routine_id    TEXT,                       -- nullable: la rutina puede borrarse
  routine_name  TEXT NOT NULL,              -- snapshot
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,                    -- NULL = sesión en curso o abandonada
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS session_sets (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id    TEXT NOT NULL,
  exercise_name  TEXT NOT NULL,             -- snapshot
  set_number     INTEGER NOT NULL,          -- 1-based dentro del bloque
  weight_kg      REAL NOT NULL DEFAULT 0,   -- 0 = peso corporal
  reps           INTEGER NOT NULL,
  rpe            REAL,                      -- opcional, 1..10 en pasos de 0.5
  completed_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sets_exercise ON session_sets(exercise_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_sets_session  ON session_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(started_at);

-- Migración v2 (auditoría QA 2026-07-03):
-- Una rutina puede contener el mismo ejercicio en dos bloques distintos;
-- (exercise_id, set_number) no identifica de forma única una serie dentro
-- de la sesión. Se añade la referencia al bloque de rutina (nullable:
-- NULL en filas legacy y en huérfanos; sin FK dura porque los bloques se
-- editan/borran con historial vivo — la resolución hace fallback a
-- exercise_id cuando es NULL).
ALTER TABLE session_sets ADD COLUMN routine_exercise_id TEXT;

-- Migración v2: garantiza a nivel de BD que hay como máximo una sesión
-- activa (finished_at IS NULL), cerrando la carrera check+insert de start().
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active
  ON sessions(finished_at) WHERE finished_at IS NULL;

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
```

## Reglas de comportamiento

- **Cada serie se persiste al marcarla** (insert individual en
  `session_sets`), no al terminar la sesión: si la app muere a mitad del
  entrenamiento no se pierde nada ya hecho.
- Una sesión con `finished_at IS NULL` y más de 12 h de antigüedad se
  considera abandonada; al abrir la app se ofrece retomarla o cerrarla
  (poniéndole `finished_at` = timestamp de su última serie).
- **PR por ejercicio** = `MAX(weight_kg)` con desempate por reps; también
  "PR estimado 1RM" con fórmula de Epley: `weight * (1 + reps/30)`.
- **Volumen semanal** = `SUM(weight_kg * reps)` agrupado por semana ISO
  (lunes a domingo) en zona horaria local.
- Migraciones: `schema_migrations` guarda la versión aplicada; `src/db/`
  expone `migrate()` que aplica en orden las migraciones pendientes dentro
  de una transacción.
