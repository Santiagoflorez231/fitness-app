# CARGA — Identidad y sistema de diseño

Fuente: dirección de arte "Identidad CARGA" (Claude Design, 2026-07-04).
Este documento es **la referencia obligatoria** para todo trabajo visual.

## Identidad

- **Nombre**: CARGA (el peso en la barra y el acto de cargarlo).
- **Personalidad**: contundente, honesta, cómplice. Hierro y tiza, no neón
  y plástico. Una app que entrena contigo, no que te vende nada.
- **Idea central**: estética de **pizarra de gimnasio** — fondos cálidos
  casi-negro / blanco tiza, un solo naranja de señalización para la acción,
  cifras enormes tabulares como protagonista. Sin fotos: la tipografía ES
  la imagen.
- **Tono de textos**: imperativo breve, segunda persona, cero exclamaciones
  gratuitas. «Última serie. Aprieta.» · «90 s de descanso. Respira.» ·
  «PR en peso muerto: 142,5 kg.»

## Tipografía (local, woff2, sin red)

| Rol | Familia | Peso | Tamaño |
|---|---|---|---|
| Título de página | Archivo | 900 | 28–34 px, tracking −2% |
| Título de card/ejercicio | Archivo | 700 | 17–19 px |
| Cuerpo | IBM Plex Sans | 400/500 | 15–16 px, lh 1.55 |
| Cifras de datos | Archivo | 800 | 48–72 px, `tabular-nums`, unidad al 40% |
| Etiquetas/overlines | Archivo | 800 | 11–13 px, MAYÚSCULAS, tracking +12% |

Máximo 4 niveles por pantalla. Números siempre `font-variant-numeric: tabular-nums`.
Instalación: paquetes `@fontsource/archivo` (500–900) y
`@fontsource/ibm-plex-sans` (400–600 + italic 400).

## Paleta (tokens)

El naranja quemado es el **único** color de acción. El azul acero
(`--app-data`) queda reservado a gráficos/datos: 4,4:1 sobre fondo claro,
6,9:1 sobre fondo oscuro. Éxito/aviso/peligro comparten croma y luminosidad
oklch. Tema claro por defecto; oscuro vía `@media (prefers-color-scheme: dark)`.

El bloque CSS completo y canónico vive en `src/theme/variables.css`
(tokens `--app-*` + overrides `--ion-*`). Resumen:

| Token | Claro | Oscuro |
|---|---|---|
| --app-bg | #F7F4EF | #151210 |
| --app-surface | #FCFBF8 | #1E1A17 |
| --app-surface-elevated | #FFFFFF | #272220 |
| --ion-color-primary | #D9480F | #FF6B2C |
| on-primary | #FFFFFF | #2B1305 |
| --app-accent | #2E5E73 | #7FB5CC |
| --app-text-primary | #201B16 | #F2EDE6 |
| --app-text-secondary | #6B635A | #A79C90 |
| --ion-color-success | #2F7D46 | #58C97A |
| --ion-color-warning | #B87A00 | #F0B23E |
| --ion-color-danger | #C03221 | #F26D5B |
| --app-data (gráficos) | #3676A6 | #6FB1E3 |
| --app-border | #E5DFD5 | #352E29 |

## Forma

- Radios: 8 px (chips, inputs) · 14 px (cards, items) · 20 px (sheets,
  modales) · píldora (botones, avatares, barra de descanso).
- Retícula base 4 px; padding de card 16; gutter de pantalla 16; gap 12.
- **Elevación por tono, no por sombra**: bg → surface → surface-elevated,
  siempre con borde 1 px `--app-border`. Sombras solo en arrastre
  (`--app-shadow-float`) y barra de descanso fija. En oscuro, sin sombra
  de card.
- **Avatares de iniciales, duotono plano**: fondo e iniciales del mismo
  matiz oklch (oscuro: fondo L 0.28 / texto L 0.78; claro invertido). El
  matiz se deriva del grupo muscular: empuje = cálido/naranja, tirón =
  frío/azul, pierna = verde, core = magenta, hombro/otros = ámbar. Así los
  1.318 ejercicios se escanean por color. Iniciales Archivo 800, 2 letras.

## Movimiento (CSS puro, solo transform/opacity)

- `--app-dur-fast: 120ms` (presses, toggles, chips)
- `--app-dur-base: 200ms` (entradas, expansiones, filtros)
- `--app-dur-slow: 320ms` (sheets, barra de descanso, PR)
- `--app-ease: cubic-bezier(.2,0,0,1)` · `--app-ease-pop: cubic-bezier(.34,1.56,.64,1)`
- Lo funcional es rápido y seco; **solo los logros celebran**. El PR es el
  único rebote (`pr-pop`: escala .6→1.08→1, 320 ms).
- Micro-interacciones por pantalla: ver sección siguiente.

## Dirección por pantalla

- **Explorar** («fichero de biblioteca»): filas 64 px, avatar duotono,
  filtros chips-píldora persistentes bajo el buscador. Resultados entran
  con fade + translateY(4px) escalonado 20 ms (máx. 8 filas). Chip activo:
  scale .97→1 en 120 ms; contador de resultados con cross-fade. Cero
  iconos decorativos.
- **Detalle** («ficha de taller»): avatar 72 px + nombre enorme; chips de
  equipo/categoría radius-s; músculo primario en primary, secundarios en
  outline. Instrucciones = pieza central: numeración Archivo 800 primary
  colgada en el margen, cuerpo 16 px. Pasos en cascada 30 ms al abrir.
- **Rutinas** («ordenar la pizarra»): cards de surface con asa de arrastre
  explícita; steppers de 44 px con cifra tabular al centro (sin teclado).
  La cifra saliente sube y la entrante entra desde abajo (120 ms). Total
  estimado de sesión (volumen + duración) fijo abajo, en vivo. Arrastre:
  scale 1.02 + shadow-float 120 ms.
- **Entrenar** (⭐ «modo esfuerzo»): la pantalla se oscurece un punto
  (surface pasa a bg) y todo crece: ejercicio actual en el tercio superior,
  cifra objetivo a 64 px. Filas de series de 56 px con peso/reps/RPE
  precargados en text-secondary (solo confirmas o corriges). Marcar ✓:
  trazo del check dibujado (stroke-dashoffset 200 ms) + pulso success al
  8% + peso×reps a tachado suave. Descanso: barra-píldora fija abajo,
  naranja, relleno decrece con `transform: scaleX`; últimos 5 s parpadeo
  de opacidad 1→.6/s. Cronómetro discreto en toolbar, sin animación.
  PR nuevo: cinta «PR» con pr-pop — el único confeti permitido.
- **Progreso** («cuaderno de resultados»): tiles de cifra grande Archivo
  800 tabular con variación en success/danger. Barras 12 semanas y línea
  1RM en `--app-data`; el naranja solo marca la semana actual y los puntos
  de PR. Barras crecen con scaleY escalonado 25 ms solo la primera vez;
  línea con stroke-dashoffset 600 ms; cifras con count-up 400 ms (rAF).
  Textos que rematan: «Mejor semana del ciclo».

## Features nuevas aprobadas para el rediseño

1. **Calculadora de discos**: peso objetivo + barra → discos por lado.
2. **Series de aproximación**: generador de calentamiento (% del top set).
3. **Historial del ejercicio en Entrenar**: sheet con últimas marcas al
   tocar el nombre del ejercicio.
4. **Calendario de entrenamientos** (heatmap) en Progreso.
5. **Plantillas de rutina** de arranque (PPL, Full Body, Torso/Pierna).
6. **Exportar/importar respaldo** (JSON) en un tab/página de ajustes.
