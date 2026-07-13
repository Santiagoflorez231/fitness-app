# CARGA — Plan v2: cierre de renovación y siguiente horizonte

Fecha: 2026-07-12 (máximo esfuerzo, re-planeación pedida por el usuario antes
del cierre). Sustituye/extiende `renovacion-plan.md` (v1, ejecutado).

## 1. Estado VERIFICADO de lo construido (no autoreporte: evidencia)

| Área | Estado | Evidencia |
|---|---|---|
| Rediseño CARGA R0–R5 | ✔ | commits hasta 328497a; auditoría opus R5 |
| Coach (A1/A2/A3) + UI | ✔ | 30 tests; chip/veredicto/balance cableados |
| Mapa muscular anatómico | ✔ | verificación visual real (bucle Edge, 3 iteraciones) |
| Bloque B (COMENZAR/libre/+Ejercicio) | ✔ | auditoría opus dedicada + fixes + 19 tests deuda |
| Medios: GIF+thumb 1.318/1.318 · fotos 344 | ✔ | M1 reporte 0 faltantes; licencias escritas |
| Explorar biblioteca visual | ✔ | captura real (cards familia, carriles, thumbs) |
| Hoy / Ajustes / skeletons / narrador / generador | ✔ | build+suite en cada tanda |
| Suite de tests | **116/116** | 10 archivos (incl. lógica endurecida) |
| Android scaffold | ✔ (APK pendiente de Android Studio del usuario) | docs/android.md |
| Auditoría final opus M→R9 | EN CURSO | sus hallazgos se aplican al cerrar R10 |

## 2. Huecos REALES verificados (auditoría de producto propia)

1. **No hay historial de sesiones.** `listFinished()` solo lo consumen
   agregadores (Progreso/Hoy/mostUsed) y el respaldo. No existe pantalla para
   revisar entrenos pasados sesión a sesión con sus series. Es el corazón del
   loop de Hevy/Strong («¿qué hice el martes?») y nos falta.
2. **No se puede corregir una serie registrada.** repos.ts no tiene
   updateSet/deleteSet. Un dedazo (1000 kg) es permanente y envenena PRs,
   volumen y coach. Gap de integridad de datos de cara al uso real.
3. **Identidad instalable pendiente.** manifest.json usa los iconos del
   template de Ionic; no hay icono CARGA ni splash. Importa para el APK.
4. **Nombres de ejercicios solo en inglés.** El usuario buscará «press banca /
   sentadilla / dominadas»; la búsqueda actual no los encuentra. steps.es
   existe, el nombre no.
5. **Peso de arranque.** Bundle principal ~1,8 MB (aviso de Vite); páginas sin
   code-split por ruta. En móvil (APK/WebView) merece dieta.
6. **Superseries/circuitos** (resto del Bloque B original) siguen sin existir.
7. **Puente LLM sin cablear** (por diseño): contratos listos; falta la
   implementación opcional con Claude API como elección explícita del usuario
   (rompería offline-first SOLO si se activa).

## 3. Investigación (delta sobre la v1)

- La v1 sigue vigente: medios resueltos con el dataset (Gymvisual con
  permiso); MuscleWiki API descartada (cuotas/online); wger sin valor añadido
  ya. **Vídeo real**: cualquier fuente de vídeo (MuscleWiki/YouTube) exige red
  o cientos de MB — el GIF 180×180 ya cubre la demostración de movimiento
  offline; vídeo queda descartado salvo decisión futura consciente.
- Hevy/Strong: su loop diario = registrar → **revisar historial** → repetir
  rutina. Refuerza que el hueco nº1 es el historial, no más features de
  registro.
- APIs: ninguna nueva recomendable que respete offline-first. La única
  integración de red con sentido es la **opt-in de Claude API** para el Coach
  (contratos ya preparados).

## 4. Tandas nuevas (N1–N7, en orden recomendado)

### N1 · Historial de sesiones (alto valor, bajo riesgo — PRIMERO)
- Sección «Historial» en Progreso (o página `/tabs/historial` enlazada desde
  Hoy y Progreso): lista cronológica de sesiones terminadas — fecha, nombre,
  duración (finishedAt−startedAt), nº series, volumen, y la narrativa del
  SessionNarrator (sessions.notes) como subtítulo con voz propia.
- Detalle de sesión (sheet o página): series agrupadas por ejercicio con
  thumb, peso×reps×RPE, PRs marcados.
- Solo lectura en esta tanda. Reutiliza getSets/listFinished; cero cambios db.

### N2 · Corrección de datos (alto valor, riesgo controlado — pase opus)
- Repos: métodos ADITIVOS `updateSet(set)` y `deleteSet(id)` (+ SQLite impl).
- UI: en Entrenar, botón de edición en fila completada (sheet: peso/reps/RPE,
  o borrar con confirmación); en el detalle de sesión (N1), lo mismo para
  sesiones pasadas.
- Invariantes: no tocar la lógica de resolución; el borrado puede dejar
  huecos de setNumber (aceptado y documentado: rowCount ya usa max).
- Auditoría opus OBLIGATORIA tras implementar.

### N3 · Identidad instalable (para el APK)
- Icono CARGA (diseño propio: barra/disco + tipografía, dibujado como SVG y
  verificado con el bucle visual) → favicon, icon 512, maskable, mipmaps
  Android, splash sencillo (fondo bg + logotipo).
- manifest.json: theme/background por tema, name/short_name ya OK.

### N4 · Dieta de arranque (rendimiento)
- React.lazy + Suspense por página (las 7 páginas) con CargaSkeleton de
  fallback; manualChunks para recharts.
- Meta: main chunk < 900 KB. Verificar con `vite build` antes/después.
- exercises.json ya es chunk async (verificado: chunk exercises-*.js).

### N5 · Búsqueda en español
- `src/data/aliasEs.json`: diccionario curado es→id para los ~120 ejercicios
  más relevantes («press banca», «sentadilla», «peso muerto», «dominadas»,
  «remo con barra», «curl femoral», «zancadas»…). Generado por data-prep con
  revisión mía (nombres exactos verificados contra el dataset).
- Explorar: la búsqueda normaliza y consulta también el alias. Mostrar el
  alias es como subtítulo cuando matchea.

### N6 · Superseries / circuitos (Bloque B restante — pase opus)
- Modelo: grupo de bloques con descanso compartido (localStorage-side como
  los ad-hoc, o columna aditiva superset_group en routine_exercises — decidir
  en spec propia). UI: unir bloques en el editor y en caliente; RestTimer
  dispara solo al cerrar la ronda.
- Es la tanda más invasiva sobre Entrenar: spec dedicada + opus.

### N7 · Coach LLM opcional (Claude API, opt-in)
- Ajuste «Coach con IA (requiere internet y API key)»: off por defecto.
- `LlmCoachAdvisor implements CoachAdvisor` + `LlmNarrator`: mismos contratos,
  claude-sonnet-5 con structured outputs; fallback automático al local sin
  red. Documento de diseño primero; implementación cuando el usuario tenga key.

## 4b. ADDENDUM máximo esfuerzo (2026-07-12, segunda pasada)

Autocrítica: las tandas N1–N7 cubren producto/técnica pero infra-sirven la
dimensión EXPERIENCIAL que el usuario ha pedido tres veces («que no se sienta
estándar», «app nueva»). Esta pasada añade el Track E (experiencia) y el
Track T-Android (hallazgos técnicos verificados).

### Hallazgos nuevos verificados
- **CRÍTICO para el APK — el respaldo no funcionará en Android**:
  BackupPanel exporta con `Blob + <a download>` (verificado en código), que
  falla silencioso en el WebView de Capacitor. Fix: rama por plataforma —
  `@capacitor/filesystem` (escribir a Documentos) + `@capacitor/share` en
  nativo; anchor solo en web. Entra en T1.
- **Descanso en segundo plano**: el RestTimer solo vibra con la app abierta.
  En gimnasio real el móvil está bloqueado → `@capacitor/local-notifications`
  para avisar al terminar el descanso (nativo, aditivo). T1.
- **Pantalla encendida durante el entreno**: `@capacitor-community/keep-awake`
  durante la fase workout. Detalle pequeño, calidad de vida enorme. T1.

### Track E — Experiencia (lo que hace «app nueva»)
- **E1 · Workout Player** (la apuesta grande): modo enfoque en Entrenar —
  el ejercicio actual ocupa la pantalla (GIF animado GRANDE en vivo, cifra
  hero, filas de series), swipe lateral entre ejercicios, dots de progreso.
  Capa PRESENTACIONAL sobre la misma máquina de estados endurecida (toggle
  lista/enfoque; la lista actual se conserva). Pase opus posterior.
- **E2 · Resumen-celebración post-sesión**: el summary pasa de overlay simple
  a pantalla de cierre: duración, volumen con count-up, PRs listados con
  pr-pop, narrativa del coach, botón «Compartir» (texto vía @capacitor/share).
- **E3 · Transiciones compartidas**: thumb de Explorar → héroe del Detalle
  con View Transitions API (same-document; WebView 111+); spike con fallback
  honesto si choca con el router de Ionic.
- **E4 · Records por ejercicio en Detalle**: mejor peso / mejor e1RM / mejor
  volumen-sesión / máx reps, + mini-gráfico e1RM embebido (hoy solo existe en
  Progreso). El Detalle se vuelve la ficha definitiva.
- **E5 · Onboarding primera ejecución**: 3 pantallas CARGA (identidad → coach
  → empieza), solo la primera vez (flag localStorage).
- **E6 · Rutinas ricas**: cards con distribución por familia (mini-barra
  duotono) + «Hace N días» de último uso.

### Orden de ejecución FUSIONADO (recomendación final)
1. R10 cierre (hallazgos opus en curso). 
2. **N1 + E2** (historial + resumen-celebración: el loop diario completo).
3. **N2** edición/borrado de series (+ opus).
4. **E1** Workout Player (+ opus).
5. **T1 Android-pack**: respaldo nativo (Filesystem/Share), notificación de
   descanso, keep-awake, **N3** icono/splash — deja el APK de primera.
6. **N4 + E3 + E5**: dieta de bundle, transiciones, onboarding.
7. **N5 + E4 + E6**: búsqueda ES, records en Detalle, rutinas ricas.
8. **N6** superseries (+ opus). 9. **N7** LLM opt-in (diseño).

## 5. Reglas de ejecución (invariables)
Offline-first (N7 solo como opt-in explícito), motion CSS puro, lógica
endurecida intocable (N2/N6 con auditoría opus), cada tanda = verificación
mía (build+suite+captura donde aplique) + commit + push.

## 6. Cierre pendiente de R10
Aplicar hallazgos de la auditoría final de opus (en curso) + verificación
visual final de pantallas clave en claro/oscuro.
