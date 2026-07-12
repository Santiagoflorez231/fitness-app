# CARGA — Roadmap avanzado (Fase Avanzada)

Fuente: dirección técnica, 2026-07-07. Se implementa **después** de cerrar los
lotes de rediseño R3 (Entrenar) y R4 (Progreso). Todo sigue **offline-first**:
cero red en runtime. Ver identidad en [`design-carga.md`](./design-carga.md) y
esquema en [`persistence-schema.md`](./persistence-schema.md).

## Principio rector: la IA como capa intercambiable

No se construye "una feature de IA". Se definen **contratos** que hoy se llenan
con heurísticas locales y mañana con un LLM (on-device u opcional por red), sin
tocar UI ni datos. La app funciona 100 % sin IA; la IA solo mejora la calidad de
las sugerencias detrás de la misma superficie.

Tres contratos (viven en `src/coach/`):

```ts
// src/coach/types.ts
export interface CoachAdvisor {
  /** Sugerencia de carga para la próxima serie a partir del RPE reportado. */
  suggestNextLoad(input: SetContext): LoadSuggestion | null;
  /** Diagnóstico de progreso por ejercicio (estancamiento / deload). */
  assessProgress(exerciseId: string, history: ExerciseHistory): ProgressVerdict;
  /** Balance de volumen semanal por familia muscular vs. landmarks. */
  volumeBalance(weekSets: FamilySetCount[]): VolumeBalance;
}

export interface RoutineGenerator {
  generate(intent: RoutineIntent, catalog: Exercise[]): Routine | null;
}

export interface SessionNarrator {
  summarize(session: WorkoutSession, prior: SessionContext): string;
}
```

Regla de oro: `RoutineGenerator` devuelve el **mismo** tipo `Routine` que ya usa
la app, y `CoachAdvisor` consume solo datos ya persistidos. Así la versión LLM es
un `implements` distinto, no una migración.

Implementaciones:
- **hoy** → `LocalCoachAdvisor` (fórmulas), `TemplateRoutineGenerator` (reglas),
  `TemplateNarrator` (plantillas de texto).
- **mañana** → `LlmCoachAdvisor`, etc. Se inyectan por un único
  `CoachProvider` (context de React) para poder cambiar la implementación en un
  solo punto.

### Registro estructurado para el futuro LLM
Para que el día de mañana el LLM tenga contexto, ya se captura estructurado:
RPE/RIR por serie (ya existe la columna conceptual), y **nota de sesión** libre
+ **flag de molestia/dolor** opcional por ejercicio. Esto no se usa aún salvo
para mostrarlo; es el corpus futuro. Requiere migración v3 (abajo).

---

## Bloque A (PRIMERO): CoachAdvisor local + RPE + volumen

Elegido por el usuario el 2026-07-07. Máximo valor, reutiliza datos ya
guardados, y es exactamente la personalidad "coach honesto" de CARGA.

### A1 — Sugerencia de carga por RPE/RIR
Al confirmar una serie con RPE, sugerir el peso de la siguiente.

1. **e1RM** de la serie hecha (Epley): `e1RM = peso × (1 + reps/30)`.
2. **%1RM objetivo** desde RPE+reps por tabla RIR→%1RM (RIR = 10 − RPE):

   | reps \ RIR | 0 | 1 | 2 | 3 | 4 |
   |---|---|---|---|---|---|
   | 1 | 100 | 96 | 92 | 89 | 86 |
   | 3 | 93  | 90 | 87 | 84 | 81 |
   | 5 | 87  | 85 | 82 | 79 | 76 |
   | 8 | 79  | 77 | 75 | 72 | 69 |
   | 10| 74  | 72 | 70 | 68 | 65 |
   | 12| 70  | 68 | 66 | 64 | 61 |

   (interpolar linealmente; valores tipo Helms/RTS, **heurísticos y ajustables**).
3. Peso sugerido = `e1RM × %objetivo(reps_objetivo, RIR_objetivo)`, redondeado al
   incremento del equipo (barra 2,5 kg / mancuerna 2 kg — configurable en ajustes).
4. UI: chip discreto bajo la fila — «Sugerido: 82,5 kg». Tocarlo copia al input
   (mismo gesto que los valores fantasma de R3). Nunca impone; sugiere.

`LoadSuggestion = { weightKg: number; basis: 'rpe'|'e1rm-history'; note: string }`.
Si no hay RPE, cae a la media móvil del historial (`basis: 'e1rm-history'`).

### A2 — Detección de estancamiento / deload
`assessProgress` mira las últimas N (=5) sesiones del ejercicio:
- **Progresando**: e1RM al alza en ≥2 de las últimas 3. → sin aviso.
- **Estancado**: 3 sesiones sin superar el mejor e1RM. → sugerir cambiar rango de
  reps o bajar volumen una semana. Texto: «3 sesiones sin PR en press banca.
  Prueba semana ligera o sube 2 reps.»
- **Retrocediendo**: e1RM a la baja 2 sesiones seguidas. → sugerir deload.
`ProgressVerdict = { state:'progress'|'plateau'|'regress'; message: string }`.
Se muestra en la ficha del ejercicio (Detalle) y como nota en Progreso. No
bloquea nada.

### A3 — Balance de volumen por familia (lo "Symmetric/RP")
Series duras semanales por familia muscular vs. **landmarks** (rangos
heurísticos, ajustables; series semanales por familia):

| Familia | Bajo (< MEV) | Óptimo (MEV–MAV) | Alto (> MRV) |
|---|---|---|---|
| Empuje  | < 8  | 8–20  | > 22 |
| Tirón   | < 8  | 8–20  | > 22 |
| Pierna  | < 8  | 8–20  | > 22 |
| Core    | < 6  | 6–16  | > 18 |
| Brazos  | < 6  | 6–18  | > 20 |
| Cardio  | —    | —     | —    |

Una "serie dura" = serie registrada con RPE ≥ 7 (o sin RPE, cuenta como dura).
La familia sale de `category` del ejercicio (mismo mapeo 1:1 que los avatares
duotono). Salida:
`VolumeBalance = { family: Familia; sets: number; zone:'low'|'ok'|'high'; hint?: string }[]`.
UI (en Progreso, R4): barras duotono por familia con la zona coloreada
(low = warning, ok = success/dato, high = danger suave) y remate honesto:
«Empuje 18 · en rango. Tirón 8 · justo. Súbele.»

### Datos que hacen falta — NINGUNA MIGRACIÓN (corrección 2026-07-12)
El esquema actual ya cubre todo lo que necesitan A1/A2/A3:
- e1RM por serie: derivable de `session_sets` (peso, reps). ✔
- RPE por serie: `session_sets.rpe REAL` **ya existe y se persiste** (SetRow
  tiene el selector; `sessionSetToParams` lo guarda). ✔
- Nota de sesión: `sessions.notes TEXT` **ya existe** (usada por `finish()`). ✔

Por tanto **el Bloque A es código puramente aditivo, sin tocar el esquema**.

### Migración v3 — DIFERIDA (solo si algún día se añade la UI de molestia)
El único campo que no existe es `session_sets.discomfort` (flag de molestia),
que era corpus futuro para el LLM, no lo consume ningún cálculo del Coach. Se
añade solo cuando se construya esa UI:
```sql
ALTER TABLE session_sets ADD COLUMN discomfort INTEGER; -- 0/1, nullable
```
Aditiva y retrocompatible (mismo patrón que v2). No bloquea el Bloque A. Actualizar
`persistence-schema.md`, `schema_migrations`, tipos `SessionSet`/`WorkoutSession`
y repos. **No** alterar la lógica QA-endurecida existente (setsForPlanExercise,
submitting, sessionFinishedRef, rowCount, addSet inmediato, RestTimer).

---

## Bloques siguientes (no ahora, orden sugerido)

- **B. Flujos que rompen el molde Ionic**: superseries/circuitos con descanso
  compartido, sesión libre sin rutina, swap de ejercicio en caliente (paleta de
  búsqueda), gestos (swipe-completar, long-press-editar, reordenar en caliente).
  ⚠️ Toca la máquina de estados de Entrenar → requiere pase QA dedicado.
- **C. RoutineGenerator por reglas**: intención (días, split, equipo) → `Routine`
  con el mismo molde. Puente IA visible.
- **D. SessionNarrator + "explícame este ejercicio"**: resúmenes post-sesión y
  variantes desde el dataset. Stubs locales listos para LLM.

## Secuencia de trabajo del Bloque A
1. Migración v3 (data/persistencia) — agente data-prep + revisión mía.
2. `src/coach/` contratos + `LocalCoachAdvisor` con A1/A2/A3 puro (sin UI),
   con tests de las fórmulas — frontend-builder.
3. Superficies UI: chip de sugerencia en Entrenar (A1), verdicto en Detalle (A2),
   panel de balance en Progreso (A3) — frontend-builder, tras R3/R4.
4. Pase qa-reviewer (opus): integridad de e1RM/volumen y que la migración v3 no
   rompa datos existentes.
