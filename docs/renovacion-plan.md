# CARGA — Plan de Renovación (investigación + tandas)

Fecha: 2026-07-12. Base: rediseño R0–R5 ✔, Coach (Bloque A) ✔, mapa muscular ✔,
Bloque B (sesión libre/COMENZAR) ✔ auditado, medios parciales (344 fotos) ✔,
scaffold Android ✔. Este plan cubre la **renovación**: subir el listón visual
de toda la app, nuevos flujos y medios completos.

## Investigación (2026-07-12)

### Hallazgo principal: nuestro dataset ahora trae GIFs para TODO
`hasaneyldrm/exercises-dataset` publicó los medios dentro del repo:
- `videos/` — **1,324 GIFs animados** 180×180 (uno por ejercicio, cobertura 100%).
- `images/` — 1,324 miniaturas JPG 180×180.
- Licencia: datos/código MIT; media «© Gym visual, redistribuido con permiso,
  180×180» → **atribución obligatoria** + condición no comercial de Gymvisual.
  Nuestra app es personal y no se distribuye: cumple. Añadir LICENSE/atribución
  junto a los assets como hicimos con free-exercise-db.
- Nuestro clon era anterior; `git pull` los trae. Patrón de archivo:
  `videos/<ID>-<MEDIA_ID>.gif`, `images/<ID>-<MEDIA_ID>.jpg` (media_id ya está
  en nuestro exercises.json).

Implicación: se acabó el problema de medios. Animación offline para el 100%
del catálogo. Las 344 parejas de fotos de free-exercise-db se mantienen en
Detalle como complemento (posición inicial/final en alta calidad donde existen).

**M0 MEDIDO (2026-07-12)**: clon actualizado (upstream reescribió historia;
resuelto con `git reset --hard origin/main`, el clon es solo lectura).
`videos/` = 1.324 GIFs, **122,8 MB**; `images/` = 1.324 thumbs, **8,5 MB**.
**Decisión: se empaqueta TODO** (~131 MB de assets; APK ~170 MB): app personal
sin store, offline-first pleno, simplicidad. Revisable a estrategia por capas
si el peso molesta en el dispositivo.

### Referentes de UI (Hevy / Strong / MuscleWiki, 2026)
- **Hevy**: librería con animación por ejercicio + «muscle group breakdowns»;
  supersets/circuitos con pistas visuales; analítica de series semanales por
  grupo muscular (ya lo tenemos vía balance/heatmap). UI mínima y limpia.
- **Strong**: variantes precisas de ejercicios y plantillas para programas
  complejos.
- **MuscleWiki**: navegación POR MÚSCULO como entrada principal (tocas el
  cuerpo → ejercicios). Su API es de pago/cuotas y online → descartada; la
  idea de navegación sí la adoptamos: **nuestro MuscleMap como navegador**.
- Patrón transversal 2026: skeletons en vez de spinners, cards con medios,
  browse por categorías visuales antes que listas planas.

### APIs/fuentes descartadas y por qué
- MuscleWiki API: cuotas (500/mes), online, términos restrictivos.
- RapidAPI/AscendAPI (ExerciseDB comercial): innecesaria ya — el dataset trae
  los mismos medios con permiso.
- wger: útil como referencia, pero CC-BY-SA y cobertura menor; no suma ya.

---

## Tandas de renovación

### M — Medios v2 (multiplicador de todo lo demás; PRIMERO)
- M0: `git pull` del dataset, medir `videos/`+`images/`, decidir empaquetado.
- M1: script `scripts/import-media.mjs`: copia miniaturas y GIFs a
  `public/assets/exercise-thumbs/` y `public/assets/exercise-gifs/` con nombre
  por NUESTRO id; regenerar índice `src/data/mediaLocal.json` v2 con
  `{ thumb, gif, photos[] }` por id. Atribución Gymvisual en LICENSE.txt.
- M2: cableado mínimo: **Detalle** muestra el GIF animado como medio principal
  (tap = pausa; `prefers-reduced-motion` = quieto); las fotos par quedan como
  sección «Ejecución» donde existan. **ExerciseAvatar** gana variante con
  miniatura (fallback al duotono donde el thumb no cargue).

### R6 — Explorar: de lista a biblioteca visual (el pedido explícito)
- Cabecera: buscador + **browse por familia muscular** (6 cards duotono con
  mini-silueta MuscleMap resaltando la familia; tap = filtra).
- Resultados como **cards con miniatura** (thumb 180×180) en grid de 2 o filas
  ricas de 72px según densidad; nombre + chips de equipo; entrada escalonada
  existente se conserva.
- Secciones horizontales sobre el listado (scroll lateral): «Más usados por ti»
  (derivado de session_sets local), «Peso corporal», «Con barra», «Cardio».
- Filtros como chips visuales (ya) + contador cross-fade (ya).
- **Skeletons CARGA** para la carga inicial (nada de spinner genérico).
- Navegación alternativa: «Explorar por músculo» → MuscleMap tocable (cada
  región navegable → lista filtrada por ese músculo vía muscleRegions).

### R7 — Home «Hoy» (nueva tab de entrada; la app deja de abrir en una lista)
- Saludo + fecha; anillo de racha/objetivo (reusa StreakGoal).
- «Tu próxima sesión»: última rutina usada o sugerencia simple; CTA Entrenar.
- Nudge del Coach: familia con volumen bajo esta semana («Tirón 6 series ·
  súbele») → tap lleva a Explorar filtrado.
- Último PR + mini heatmap de 4 semanas.
- Accesos rápidos: Entrenamiento libre / Respaldo / Ajustes.

### R8 — Sistema UI transversal (pulido de toda la app)
- **Skeletons** en todas las páginas (patrón compartido `CargaSkeleton`).
- **Sheets unificados**: modal de plantillas de Rutinas y confirmaciones al
  mismo sistema visual de PlateCalculator/Picker (IonModal contenedor + header
  propio). IonAlert solo para confirmaciones destructivas.
- **Página Ajustes** (nueva, en tab bar o desde Hoy): objetivo semanal,
  incremento de redondeo del coach (2.5/2/1.25), barra por defecto de la
  calculadora, respaldo export/import (se muda desde Progreso), atribuciones y
  licencias, versión.
- Estados vacíos con carácter en TODAS las pantallas (auditar uno a uno).
- Transiciones: mantener las de Ionic pero revisar que Detalle→Entrenar y
  tab-switches no corten en seco; micro-interacción de entrada por página.

### R9 — Bloques C + D del roadmap IA (cierre del puente)
- **RoutineGenerator** («Crear rutina para mí»): wizard 3 pasos (días/semana,
  split PPL-FullBody-Torso/Pierna, equipo disponible) → `Routine` por reglas
  usando el catálogo; editable después. Mismo molde para futuro LLM.
- **SessionNarrator**: resumen post-sesión con texto CARGA en el summary
  («+2,5 kg en sentadilla. PR de volumen. 42 min.») persistido en
  sessions.notes; plantillas locales hoy, LLM mañana.

### R10 — Calidad y cierre
- Tests deuda opus: setsForPlanExercise/buildPlan/adhocBlocks/startExerciseRequest.
- Pase qa-reviewer final (opus) de las tandas M–R9.
- Verificación visual con mi bucle Edge headless (capturas de cada pantalla,
  claro y oscuro) antes del cierre.
- Android: `cap sync` + guía APK (requiere Android Studio del usuario).

## Orden recomendado y dependencias
**M → R6 → R7 → R8 → R9 → R10.** M primero porque multiplica R6/R7 (thumbs en
cards, GIF en Detalle). R6 es el pedido explícito de Explorar. R7 introduce
tab nueva (toca App.tsx/rutas — hacerlo antes del pulido transversal R8).
R9 es independiente (lógica pura + 2 superficies) y puede intercalarse.

## Reglas que no cambian
Offline-first (medios empaquetados, cero red runtime), motion CSS puro CARGA,
lógica QA-endurecida intocable, cada tanda = verificación mía + commit + push,
opus audita lo que toque persistencia o Entrenar.
