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
// Canon anatómico estilizado sobre viewBox 0 0 100 212 (alto de figura 202):
// cabeza ≈ 1/8 del alto (y 4→28), hombros a y≈41 (ancho biacromial ≈ 2
// cabezas), codos a la altura de la cintura (y≈82), muñecas a la altura de
// la entrepierna (y≈105, mitad de la figura), rodillas a y≈152.
const HEAD_TOP: Pt = [50, 4];

const RIGHT_SIDE: Pt[] = [
  [56, 7], // sien derecha
  [58.5, 16], // lateral de la cabeza
  [55, 25], // mandíbula
  [53, 29], // lateral del cuello
  [54, 34], // base del cuello
  [64, 38], // pendiente del trapecio
  [73, 41], // punta del hombro (acromion)
  [78, 47], // deltoides, borde exterior
  [78, 60], // brazo superior, exterior
  [79, 81], // codo, exterior
  [77, 95], // antebrazo, exterior
  [74, 106], // muñeca, exterior
  [76, 113], // mano, exterior
  [72, 122], // punta de los dedos
  [69, 113], // mano, interior
  [68, 104], // muñeca, interior
  [69, 92], // antebrazo, interior
  [70, 81], // codo, interior
  [69, 62], // brazo superior, interior
  [66, 52], // axila (curva cóncava)
  [66, 57], // costado del pecho
  [61, 76], // cintura
  [66, 90], // cadera, exterior
  [65, 102], // cadera baja / muslo alto
  [63, 120], // muslo, bulto exterior
  [59, 152], // rodilla, exterior
  [62, 168], // gemelo, bulto exterior
  [56, 194], // tobillo, exterior
  [59, 201], // talón
  [55, 206], // punta del pie
  [51.5, 204], // pie, interior
  [52, 193], // tobillo, interior
  [53, 172], // gemelo, interior
  [54.5, 152], // rodilla, interior
  [53, 124], // muslo, interior
  [51, 105], // entrepierna
];

const LEFT_SIDE: Pt[] = [...RIGHT_SIDE].reverse().map(mirrorPt);

/** Contorno completo del cuerpo (coronilla → lado derecho → entrepierna → lado izquierdo → cierra). */
const BODY_OUTLINE: Pt[] = [HEAD_TOP, ...RIGHT_SIDE, ...LEFT_SIDE];
const BODY_OUTLINE_D = smoothClosedPath(BODY_OUTLINE);

// Líneas decorativas sutiles (línea alba / columna) — puramente estéticas,
// no son regiones interactivas.
const FRONT_DECOR_LINE_D = 'M 50 42 Q 49.3 68 50 92';
const BACK_DECOR_LINE_D = 'M 50 34 Q 49.3 64 50 94';

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
  [46, 29],
  [54, 29],
  [55, 37],
  [50, 39],
  [45, 37],
];

// Deltoides: casquete redondeado sobre el hombro, DENTRO del contorno y con
// un pelo de separación respecto al pectoral para que no se fundan al
// resaltarse ambos.
const SHOULDER_R_PTS: Pt[] = [
  [66.5, 41],
  [72, 41],
  [76.5, 45.5],
  [76, 52],
  [71.5, 55],
  [67.5, 47.5],
];
// Pectoral derecho: gota que nace en el esternón y cae hacia la axila.
const CHEST_R_PTS: Pt[] = [
  [51, 42.5],
  [61.5, 43.5],
  [64.5, 50],
  [63, 57],
  [55.5, 60],
  [51, 57],
];
const ABS_PTS: Pt[] = [
  [44, 62],
  [56, 62],
  [58, 74],
  [56, 88],
  [50, 93],
  [44, 88],
  [42, 74],
];
const OBLIQUE_R_PTS: Pt[] = [
  [58, 63],
  [64, 60],
  [64, 76],
  [60, 87],
  [57, 76],
];
// Brazo: bíceps entre hombro (y≈52) y codo (y≈81); antebrazo hasta la muñeca.
const BICEP_R_PTS: Pt[] = ovalPts(73.5, 67, 4.5, 10, 12);
const FOREARM_R_PTS: Pt[] = [
  [70, 84],
  [75, 86],
  [74, 96],
  [71.5, 104],
  [69.5, 96],
  [69, 87],
];
// Cuádriceps: huso frontal del muslo, cadera→rodilla.
const QUAD_R_PTS: Pt[] = [
  [55, 108],
  [62, 104],
  [64, 122],
  [61, 146],
  [56, 147],
  [53, 126],
];
// Aductores: franja interna alta entre ambos muslos.
const ADDUCTOR_PTS: Pt[] = [
  [46, 105],
  [54, 105],
  [55, 122],
  [50, 130],
  [45, 122],
];
// Frontal: tibial/gemelo visto de frente.
const CALF_R_PTS: Pt[] = [
  [56, 155],
  [61, 158],
  [61.5, 172],
  [57, 190],
  [54.5, 176],
  [55, 161],
];

// Trapecio: cometa desde la nuca entre las escápulas.
const TRAPS_PTS: Pt[] = [
  [50, 31],
  [61, 38],
  [54, 56],
  [50, 62],
  [46, 56],
  [39, 38],
];
const UPPERBACK_PTS: Pt[] = [
  [40, 45],
  [60, 45],
  [63, 56],
  [58, 63],
  [42, 63],
  [37, 56],
];
// Dorsal: ala que cae de la axila a la cintura.
const LATS_R_PTS: Pt[] = [
  [63, 55],
  [66, 60],
  [63, 74],
  [55, 82],
  [53, 68],
  [57, 57],
];
const LOWERBACK_PTS: Pt[] = [
  [45, 77],
  [55, 77],
  [57, 86],
  [50, 92],
  [43, 86],
];
// Glúteo derecho: redondeado, de la cadera al pliegue.
const GLUTE_R_PTS: Pt[] = [
  [52, 94],
  [62, 92],
  [65, 100],
  [61, 110],
  [53, 111],
  [50, 102],
];
const TRICEP_R_PTS: Pt[] = ovalPts(73.5, 67, 4.5, 10, 12);
// Femoral: huso posterior del muslo.
const HAMSTRING_R_PTS: Pt[] = [
  [55, 108],
  [62, 106],
  [64, 126],
  [60, 148],
  [56, 148],
  [53, 128],
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
  // upperback antes que traps para que la cometa del trapecio quede encima.
  centerRegion('upperback', UPPERBACK_PTS),
  pairedRegion('lats', LATS_R_PTS),
  centerRegion('traps', TRAPS_PTS),
  centerRegion('lowerback', LOWERBACK_PTS),
  pairedRegion('glutes', GLUTE_R_PTS),
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
