# fitness-app — app personal de ejercicio (Ionic + React)

App móvil de fitness de un solo usuario, offline-first, sin backend. No se
publica en stores ni se distribuye (el dataset prohíbe uso comercial).

## Stack

- Ionic 8 + React 19 + TypeScript + Vite 5, Capacitor 8 (Android/iOS + PWA).
- Persistencia: SQLite (`@capacitor-community/sqlite`) — esquema y reglas en
  `docs/persistence-schema.md`. Todo acceso a datos pasa por `src/db/`.
- Dataset estático: `src/data/exercises.json` (1,318 ejercicios, campos id,
  name, category, equipment, target, muscle_group, secondary_muscles,
  media_id, steps {en, es}) y `src/data/filters.json` (listas únicas para
  filtros). Se regeneran con `node scripts/build-dataset.mjs` desde
  `../exercises-dataset/data/exercises.json`. No editar a mano.

## Convenciones

- UI en español. Los textos de ejercicios usan `steps.es`.
- Estructura: `src/pages/` (una carpeta por página), `src/components/`,
  `src/hooks/`, `src/data/`, `src/db/`, `src/types/`.
- Componentes funcionales + hooks, TypeScript estricto, sin `any`.
- Usar componentes Ionic antes que HTML crudo; la app debe sentirse nativa.
- Offline-first: ninguna llamada de red en runtime.
- Pesos en kg; timestamps en epoch ms UTC (ver docs/persistence-schema.md).

## Verificación

- `npm run build` debe pasar sin errores antes de dar por terminada una tarea.
- `npm run dev` levanta el servidor de desarrollo (Vite).

## Orquestación

Proyecto coordinado por una sesión principal que delega en subagentes
definidos en `../.claude/agents/`: frontend-builder (sonnet, UI),
data-prep (haiku, datos), qa-reviewer (opus, lógica crítica). Las decisiones
de arquitectura las toma la sesión principal, no los subagentes.
