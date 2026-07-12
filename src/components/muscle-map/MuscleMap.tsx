import { useMemo } from 'react';
import type { RegionId } from './muscleRegions';
import { REGION_LABEL, REGION_VIEW } from './muscleRegions';
import './MuscleMap.css';

/**
 * Mapa muscular — silueta SVG en dos vistas (frontal / dorsal), estilo
 * "hierro y tiza" de CARGA: formas geométricas limpias y simétricas, NO una
 * silueta médicamente precisa. Cada región (`RegionId`) es un <g data-region>
 * con uno o dos rects/ellipses (pares simétricos izquierda/derecha) y un
 * <title> en español para tooltip/accesibilidad.
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

interface RectShape {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

interface EllipseShape {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

type Shape = RectShape | EllipseShape;

interface RegionShapeDef {
  id: RegionId;
  shapes: Shape[];
}

function rect(x: number, y: number, w: number, h: number, rx: number): RectShape {
  return { kind: 'rect', x, y, w, h, rx };
}

function ellipse(cx: number, cy: number, rx: number, ry: number): EllipseShape {
  return { kind: 'ellipse', cx, cy, rx, ry };
}

// Coordenadas sobre viewBox "0 0 100 212". Pares izquierda/derecha
// simétricos respecto al eje central x=50. Los pequeños solapes entre
// bloques contiguos (torso/hombros, muslo/aductores…) son intencionales:
// dan continuidad visual sin perseguir anatomía exacta.
const FRONT_REGIONS: RegionShapeDef[] = [
  { id: 'chest', shapes: [rect(32, 33, 36, 25, 7)] },
  { id: 'obliques', shapes: [rect(30, 60, 8, 26, 4), rect(62, 60, 8, 26, 4)] },
  { id: 'abs', shapes: [rect(38, 60, 24, 26, 6)] },
  { id: 'shoulders', shapes: [ellipse(25, 36, 11, 9), ellipse(75, 36, 11, 9)] },
  { id: 'biceps', shapes: [ellipse(16, 55, 7, 17), ellipse(84, 55, 7, 17)] },
  { id: 'forearms', shapes: [rect(9, 75, 13, 33, 6), rect(78, 75, 13, 33, 6)] },
  { id: 'quads', shapes: [rect(31, 90, 16, 62, 7), rect(53, 90, 16, 62, 7)] },
  { id: 'adductors', shapes: [rect(46, 98, 8, 46, 4)] },
  { id: 'calves', shapes: [rect(33, 158, 14, 40, 7), rect(53, 158, 14, 40, 7)] },
  { id: 'neck', shapes: [rect(44, 22, 12, 10, 3)] },
];

const BACK_REGIONS: RegionShapeDef[] = [
  { id: 'upperback', shapes: [rect(32, 44, 36, 18, 7)] },
  { id: 'lats', shapes: [rect(27, 46, 13, 26, 6), rect(60, 46, 13, 26, 6)] },
  { id: 'lowerback', shapes: [rect(38, 74, 24, 14, 6)] },
  { id: 'traps', shapes: [rect(38, 28, 24, 14, 6)] },
  { id: 'shoulders', shapes: [ellipse(25, 36, 11, 9), ellipse(75, 36, 11, 9)] },
  { id: 'triceps', shapes: [ellipse(16, 55, 7, 17), ellipse(84, 55, 7, 17)] },
  { id: 'forearms', shapes: [rect(9, 75, 13, 33, 6), rect(78, 75, 13, 33, 6)] },
  { id: 'glutes', shapes: [rect(34, 90, 32, 16, 9)] },
  { id: 'hamstrings', shapes: [rect(31, 108, 16, 42, 7), rect(53, 108, 16, 42, 7)] },
  { id: 'calves', shapes: [rect(33, 158, 14, 40, 7), rect(53, 158, 14, 40, 7)] },
  { id: 'neck', shapes: [rect(44, 22, 12, 10, 3)] },
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
  return (
    <div className="mm-panel">
      <svg
        viewBox="0 0 100 212"
        className={`mm-svg${isCardio ? ' mm-svg--cardio' : ''}`}
        role="img"
        aria-label={view === 'front' ? 'Mapa muscular, vista frontal' : 'Mapa muscular, vista dorsal'}
        preserveAspectRatio="xMidYMid meet"
      >
        <circle className="mm-decor" cx={50} cy={13} r={10} aria-hidden="true" />
        <rect className="mm-decor" x={35} y={196} width={10} height={8} rx={3} aria-hidden="true" />
        <rect className="mm-decor" x={55} y={196} width={10} height={8} rx={3} aria-hidden="true" />
        {regions.map((def) => {
          const visual = visuals.get(def.id) ?? INACTIVE_VISUAL;
          return (
            <g key={def.id} data-region={def.id} className="mm-region">
              <title>{REGION_LABEL[def.id]}</title>
              {def.shapes.map((shape, index) =>
                shape.kind === 'rect' ? (
                  <rect
                    key={index}
                    className="mm-shape"
                    x={shape.x}
                    y={shape.y}
                    width={shape.w}
                    height={shape.h}
                    rx={shape.rx}
                    style={{ fill: visual.fill, stroke: visual.stroke, strokeWidth: visual.strokeWidth }}
                  />
                ) : (
                  <ellipse
                    key={index}
                    className="mm-shape"
                    cx={shape.cx}
                    cy={shape.cy}
                    rx={shape.rx}
                    ry={shape.ry}
                    style={{ fill: visual.fill, stroke: visual.stroke, strokeWidth: visual.strokeWidth }}
                  />
                ),
              )}
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
