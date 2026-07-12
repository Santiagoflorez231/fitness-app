import { useMemo } from 'react';
import type { RegionId } from './muscleRegions';
import { REGION_LABEL, REGION_VIEW } from './muscleRegions';
import './MuscleMap.css';

/**
 * Mapa muscular — silueta SVG en dos vistas (frontal / dorsal), estilo
 * "hierro y tiza" de CARGA: contorno de cuerpo continuo y orgánico (no
 * bloques geométricos), NO una silueta médicamente precisa. Cada región
 * (`RegionId`) es un <g data-region> con uno o dos <path> (pares simétricos
 * izquierda/derecha) y un <title> en español para tooltip/accesibilidad.
 *
 * Todas las formas (silueta base y regiones) se generan a partir de listas
 * de puntos de control mediante una spline de Catmull-Rom convertida a
 * curvas Bézier cúbicas (`smoothClosedPath`), lo que produce contornos
 * fluidos sin tener que escribir a mano cada comando `C`.
 *
 * Dos modos discriminados por `mode`:
 *  - 'highlight' (Detalle): primario sólido naranja, secundario tenue/
 *    contorno naranja, resto apagado. `isCardio` reemplaza el resaltado por
 *    un tratamiento propio (silueta completa + pulso de corazón) para no
 *    dejar el cuerpo vacío en ejercicios cardiovasculares.
 *  - 'heat' (Progreso): intensidad 0–1 por región, interpolada sobre
 *    `--app-data` (reservado a gráficos/datos, mantiene contraste en ambos
 *    temas) vía `color-mix`. Incluye leyenda mínima poco/mucho.
 */

interface HighlightModeProps {
  mode: 'highlight';
  primary: RegionId[];
  secondary: RegionId[];
  isCardio: boolean;
}

interface HeatModeProps {
  mode: 'heat';
  intensityByRegion: Partial<Record<RegionId, number>>;
}

export type MuscleMapProps = HighlightModeProps | HeatModeProps;

/** Punto de control 2D sobre el viewBox "0 0 100 212". */
type Pt = readonly [number, number];

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convierte una lista de puntos en un `<path>` cerrado y suave usando una
 * spline de Catmull-Rom (uniforme) transformada a segmentos Bézier cúbicos.
 * Es lo que permite que cada silueta/región se defina como una simple lista
 * de coordenadas y salga como curva orgánica continua (comandos `C`).
 */
function smoothClosedPath(points: readonly Pt[]): string {
  const n = points.length;
  if (n < 3) return '';
  const at = (i: number): Pt => points[((i % n) + n) % n];
  const [startX, startY] = points[0];
  let d = `M ${round(startX)} ${round(startY)} `;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += `C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(x2)} ${round(y2)} `;
  }
  return `${d}Z`;
}

/** Refleja un punto respecto al eje central x=50 (par izquierda/derecha). */
function mirrorPt([x, y]: Pt): Pt {
  return [100 - x, y];
}

function mirrorPts(points: readonly Pt[]): Pt[] {
  return points.map(mirrorPt);
}

/** Puntos aproximando un óvalo (para músculos redondeados: hombros, brazos…). */
function ovalPts(cx: number, cy: number, rx: number, ry: number, count = 10): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Silueta base del cuerpo — un único contorno continuo (cabeza, cuello,
// hombros, brazos, torso, cadera, piernas) reutilizado en ambos paneles.
// Se define solo el lado derecho (de la coronilla a la entrepierna); el lado
// izquierdo se obtiene reflejando y reutilizando esos mismos puntos.
// ---------------------------------------------------------------------------
const HEAD_TOP: Pt = [50, 4];

const RIGHT_SIDE: Pt[] = [
  [60, 6], // cabeza, sien derecha
  [62, 14], // cabeza, lateral derecho
  [58, 22], // mandíbula derecha
  [55, 27], // base del cuello derecho
  [58, 29], // trapecio/hombro derecho (arranque)
  [79, 33], // hombro, borde exterior derecho
  [83, 40], // brazo superior, tope exterior
  [85, 63], // codo, borde exterior (bíceps/tríceps)
  [82, 87], // muñeca, borde exterior
  [85, 95], // mano, bulto exterior
  [81, 103], // punta de los dedos
  [74, 100], // mano, borde interior
  [72, 88], // muñeca, borde interior
  [75, 64], // codo, borde interior
  [65, 42], // axila (curva cóncava hacia el torso)
  [69, 52], // costado del pecho derecho
  [61, 67], // cintura derecha
  [69, 79], // cadera, borde exterior derecho
  [70, 105], // muslo, bulto exterior
  [64, 148], // rodilla, borde exterior derecho
  [67, 170], // pantorrilla, bulto exterior
  [61, 193], // tobillo, borde exterior derecho
  [68, 201], // talón/pie, borde exterior
  [58, 206], // punta del pie derecho
  [54, 199], // pie, borde interior
  [56, 191], // tobillo, borde interior
  [53, 166], // pantorrilla, borde interior
  [55, 148], // rodilla, borde interior derecho
  [57, 108], // muslo, borde interior
  [52, 88], // entrepierna derecha
];

const LEFT_SIDE: Pt[] = [...RIGHT_SIDE].reverse().map(mirrorPt);

/** Contorno completo del cuerpo (coronilla → lado derecho → entrepierna → lado izquierdo → cierra). */
const BODY_OUTLINE: Pt[] = [HEAD_TOP, ...RIGHT_SIDE, ...LEFT_SIDE];
const BODY_OUTLINE_D = smoothClosedPath(BODY_OUTLINE);

// Líneas decorativas sutiles (línea alba / columna) — puramente estéticas,
// no son regiones interactivas.
const FRONT_DECOR_LINE_D = 'M 50 37 Q 48.5 62 50 84';
const BACK_DECOR_LINE_D = 'M 50 27 Q 48.5 60 50 90';

interface RegionShapeDef {
  id: RegionId;
  shapes: string[];
}

/** Región central (sin par izquierda/derecha): una lista de puntos = un shape. */
function centerRegion(id: RegionId, points: readonly Pt[]): RegionShapeDef {
  return { id, shapes: [smoothClosedPath(points)] };
}

/** Región simétrica: el lado derecho se define una vez y se refleja para el izquierdo. */
function pairedRegion(id: RegionId, rightPoints: readonly Pt[]): RegionShapeDef {
  return { id, shapes: [smoothClosedPath(rightPoints), smoothClosedPath(mirrorPts(rightPoints))] };
}

// Coordenadas sobre viewBox "0 0 100 212", mismo sistema que la silueta.
// Cada región es una forma orgánica (path suavizado) que evoca el músculo
// y encaja dentro del contorno del cuerpo; no busca precisión médica.
const NECK_PTS: Pt[] = [
  [44, 24],
  [56, 24],
  [57, 30],
  [50, 32],
  [43, 30],
];

const SHOULDER_R_PTS: Pt[] = ovalPts(75, 35, 10, 8, 10);
const CHEST_R_PTS: Pt[] = [
  [50, 36],
  [65, 37],
  [71, 47],
  [65, 57],
  [54, 59],
  [50, 50],
];
const ABS_PTS: Pt[] = [
  [41, 58],
  [59, 58],
  [61, 70],
  [58, 85],
  [50, 88],
  [42, 85],
  [39, 70],
];
const OBLIQUE_R_PTS: Pt[] = [
  [61, 60],
  [68, 63],
  [66, 80],
  [60, 84],
  [57, 72],
  [58, 62],
];
const BICEP_R_PTS: Pt[] = ovalPts(83, 50, 7, 15, 10);
const FOREARM_R_PTS: Pt[] = ovalPts(80, 76, 6, 17, 10);
const QUAD_R_PTS: Pt[] = [
  [69, 96],
  [70, 128],
  [65, 146],
  [57, 144],
  [58, 120],
  [61, 98],
];
const ADDUCTOR_PTS: Pt[] = [
  [46, 96],
  [54, 96],
  [55, 130],
  [50, 140],
  [45, 130],
];
const CALF_R_PTS: Pt[] = [
  [63, 152],
  [67, 170],
  [63, 193],
  [55, 191],
  [56, 168],
  [58, 152],
];

const TRAPS_PTS: Pt[] = [
  [50, 24],
  [64, 33],
  [50, 50],
  [36, 33],
];
const UPPERBACK_PTS: Pt[] = [
  [38, 44],
  [62, 44],
  [64, 58],
  [60, 63],
  [40, 63],
  [36, 58],
];
const LATS_R_PTS: Pt[] = [
  [66, 44],
  [71, 54],
  [66, 68],
  [57, 64],
  [59, 50],
  [62, 44],
];
const LOWERBACK_PTS: Pt[] = [
  [39, 72],
  [61, 72],
  [62, 84],
  [50, 88],
  [38, 84],
];
const GLUTES_PTS: Pt[] = [
  [34, 88],
  [50, 83],
  [66, 88],
  [67, 100],
  [50, 105],
  [33, 100],
];
const TRICEP_R_PTS: Pt[] = ovalPts(83, 50, 7, 15, 10);
const HAMSTRING_R_PTS: Pt[] = [
  [68, 100],
  [69, 130],
  [63, 146],
  [55, 143],
  [57, 118],
  [60, 100],
];

const FRONT_REGIONS: RegionShapeDef[] = [
  centerRegion('neck', NECK_PTS),
  pairedRegion('shoulders', SHOULDER_R_PTS),
  pairedRegion('chest', CHEST_R_PTS),
  centerRegion('abs', ABS_PTS),
  pairedRegion('obliques', OBLIQUE_R_PTS),
  pairedRegion('biceps', BICEP_R_PTS),
  pairedRegion('forearms', FOREARM_R_PTS),
  pairedRegion('quads', QUAD_R_PTS),
  centerRegion('adductors', ADDUCTOR_PTS),
  pairedRegion('calves', CALF_R_PTS),
];

const BACK_REGIONS: RegionShapeDef[] = [
  centerRegion('neck', NECK_PTS),
  pairedRegion('shoulders', SHOULDER_R_PTS),
  centerRegion('traps', TRAPS_PTS),
  centerRegion('upperback', UPPERBACK_PTS),
  pairedRegion('lats', LATS_R_PTS),
  centerRegion('lowerback', LOWERBACK_PTS),
  centerRegion('glutes', GLUTES_PTS),
  pairedRegion('triceps', TRICEP_R_PTS),
  pairedRegion('forearms', FOREARM_R_PTS),
  pairedRegion('hamstrings', HAMSTRING_R_PTS),
  pairedRegion('calves', CALF_R_PTS),
];

const ALL_REGION_IDS = Object.keys(REGION_VIEW) as RegionId[];

interface RegionVisual {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

const INACTIVE_VISUAL: RegionVisual = {
  fill: 'var(--app-surface-elevated)',
  stroke: 'var(--app-border)',
  strokeWidth: 1,
};

const PRIMARY_VISUAL: RegionVisual = {
  fill: 'var(--ion-color-primary)',
  stroke: 'var(--ion-color-primary)',
  strokeWidth: 1.5,
};

const SECONDARY_VISUAL: RegionVisual = {
  fill: 'color-mix(in oklch, var(--ion-color-primary) 22%, var(--app-surface-elevated))',
  stroke: 'var(--ion-color-primary)',
  strokeWidth: 1.5,
};

/** Relleno de calor: interpolación de opacidad de --app-data (reservado a datos/gráficos). */
function heatVisual(intensity: number | undefined): RegionVisual {
  if (intensity === undefined || intensity <= 0) {
    return INACTIVE_VISUAL;
  }
  const clamped = Math.min(1, Math.max(0, intensity));
  const pct = Math.round(18 + clamped * 78);
  return {
    fill: `color-mix(in oklch, var(--app-data) ${pct}%, var(--app-surface-elevated))`,
    stroke: 'var(--app-data)',
    strokeWidth: 1,
  };
}

function buildVisuals(props: MuscleMapProps): Map<RegionId, RegionVisual> {
  const map = new Map<RegionId, RegionVisual>();

  if (props.mode === 'heat') {
    ALL_REGION_IDS.forEach((id) => map.set(id, heatVisual(props.intensityByRegion[id])));
    return map;
  }

  // Highlight (incluye cardio: sin regiones primarias/secundarias, todo
  // queda inactivo y el tratamiento propio de CardioPulse cubre la lectura).
  ALL_REGION_IDS.forEach((id) => map.set(id, INACTIVE_VISUAL));
  props.secondary.forEach((id) => map.set(id, SECONDARY_VISUAL));
  props.primary.forEach((id) => map.set(id, PRIMARY_VISUAL));
  return map;
}

/** Icono de corazón latiendo + ondas de pulso, centrado en el pecho (vista frontal). */
function CardioPulse() {
  return (
    <g className="mm-cardio-pulse" aria-hidden="true">
      <circle className="mm-cardio-ring" cx={50} cy={44} r={11} />
      <circle className="mm-cardio-ring mm-cardio-ring--delay" cx={50} cy={44} r={11} />
      <path
        className="mm-cardio-heart"
        d="M50 52 C44 46 40 42 40 38 C40 34 44 32 47 35 C48.5 36.5 50 38 50 38 C50 38 51.5 36.5 53 35 C56 32 60 34 60 38 C60 42 56 46 50 52 Z"
      />
    </g>
  );
}

interface PanelProps {
  view: 'front' | 'back';
  regions: RegionShapeDef[];
  visuals: Map<RegionId, RegionVisual>;
  isCardio: boolean;
}

function Panel({ view, regions, visuals, isCardio }: PanelProps) {
  const decorLineD = view === 'front' ? FRONT_DECOR_LINE_D : BACK_DECOR_LINE_D;
  return (
    <div className="mm-panel">
      <svg
        viewBox="0 0 100 212"
        className={`mm-svg${isCardio ? ' mm-svg--cardio' : ''}`}
        role="img"
        aria-label={view === 'front' ? 'Mapa muscular, vista frontal' : 'Mapa muscular, vista dorsal'}
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          className="mm-shape mm-body-outline"
          d={BODY_OUTLINE_D}
          style={{ fill: INACTIVE_VISUAL.fill, stroke: INACTIVE_VISUAL.stroke, strokeWidth: INACTIVE_VISUAL.strokeWidth }}
          aria-hidden="true"
        />
        <path className="mm-decor-line" d={decorLineD} aria-hidden="true" />
        {regions.map((def) => {
          const visual = visuals.get(def.id) ?? INACTIVE_VISUAL;
          return (
            <g key={def.id} data-region={def.id} className="mm-region">
              <title>{REGION_LABEL[def.id]}</title>
              {def.shapes.map((d, index) => (
                <path
                  key={index}
                  className="mm-shape"
                  d={d}
                  style={{ fill: visual.fill, stroke: visual.stroke, strokeWidth: visual.strokeWidth }}
                />
              ))}
            </g>
          );
        })}
        {isCardio && view === 'front' && <CardioPulse />}
      </svg>
      <span className="mm-caption carga-overline">{view === 'front' ? 'Frontal' : 'Dorsal'}</span>
    </div>
  );
}

function HeatLegend() {
  return (
    <div className="mm-legend" aria-hidden="true">
      <span className="mm-legend-label">Poco</span>
      <div className="mm-legend-bar" />
      <span className="mm-legend-label">Mucho</span>
    </div>
  );
}

/** Silueta anatómica estilizada de dos vistas (frontal/dorsal) para resaltar o mapear calor por región muscular. */
const MuscleMap: React.FC<MuscleMapProps> = (props) => {
  const visuals = useMemo(() => buildVisuals(props), [props]);
  const isCardio = props.mode === 'highlight' && props.isCardio;

  return (
    <div className="muscle-map">
      <div className="mm-panels">
        <Panel view="front" regions={FRONT_REGIONS} visuals={visuals} isCardio={isCardio} />
        <Panel view="back" regions={BACK_REGIONS} visuals={visuals} isCardio={isCardio} />
      </div>
      {props.mode === 'heat' && <HeatLegend />}
    </div>
  );
};

export default MuscleMap;
