import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BarShapeProps, TooltipContentProps } from 'recharts';
import type { WeekVolume } from '../../hooks/useProgressData';
import { addDaysLocal, formatDayMonthEs } from '../../utils/dates';
import {
  CHART_DATA_COLOR,
  CHART_GRID_OPACITY,
  CHART_GRID_STROKE,
  CHART_TICK_FILL,
  CHART_TICK_FONT_SIZE,
  chartTooltipStyle,
  formatKg,
  formatKgAxis,
} from './chartTheme';
import './WeeklyVolumeChart.css';

const STAGGER_STEP_MS = 25;

interface WeeklyVolumeChartProps {
  data: WeekVolume[];
  /** weekStart de la semana ISO actual: su barra se pinta en naranja — único uso del color de acción en el gráfico (docs/design-carga.md). */
  currentWeekStart: number;
  /**
   * Anima la entrada (scaleY escalonada 25ms, CSS puro) solo cuando es
   * true. El padre (Progreso.tsx) lo controla con un flag de "ya animado
   * una vez" para no repetir la entrada en cada refetch/reentrada a la vista.
   */
  animateEntrance: boolean;
}

function WeekTooltip(props: Partial<TooltipContentProps>) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload as WeekVolume;
  const rangeEnd = addDaysLocal(point.weekStart, 6);
  return (
    <div style={chartTooltipStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {formatDayMonthEs(point.weekStart)} – {formatDayMonthEs(rangeEnd)}
      </div>
      <div>{formatKg(point.volumeKg)}</div>
    </div>
  );
}

/**
 * Barra custom: entrada scaleY con transform-origin abajo (CSS puro vía
 * clase + animation-delay), y color de acción solo en la semana actual.
 * Sustituye a la animación JS por defecto de Recharts (isAnimationActive
 * en el <Bar>), que no cumpliría la regla de movimiento CSS-only.
 */
function renderBar(currentWeekStart: number, animateEntrance: boolean) {
  return (props: BarShapeProps) => {
    const { x, y, width, height, index, payload } = props;
    const week = payload as WeekVolume | undefined;
    const isCurrentWeek = week?.weekStart === currentWeekStart;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 0)}
        rx={4}
        ry={4}
        fill={isCurrentWeek ? 'var(--ion-color-primary)' : CHART_DATA_COLOR}
        className={animateEntrance ? 'chart-bar-enter' : undefined}
        style={
          animateEntrance
            ? ({
                animationDelay: `${index * STAGGER_STEP_MS}ms`,
                transformBox: 'fill-box',
                transformOrigin: 'bottom',
              } as React.CSSProperties)
            : undefined
        }
      />
    );
  };
}

/** Barras de volumen semanal (últimas 12 semanas ISO locales). Una sola serie, sin leyenda. */
const WeeklyVolumeChart: React.FC<WeeklyVolumeChartProps> = ({ data, currentWeekStart, animateEntrance }) => {
  const lastWeek = data[data.length - 1];
  const ariaLabel =
    lastWeek !== undefined
      ? `Gráfico de volumen semanal: última semana ${formatKg(lastWeek.volumeKg)}`
      : 'Gráfico de volumen semanal: sin datos';

  return (
    <div role="img" aria-label={ariaLabel}>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barCategoryGap="20%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke={CHART_GRID_STROKE}
              strokeOpacity={CHART_GRID_OPACITY}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONT_SIZE }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONT_SIZE }}
              tickFormatter={formatKgAxis}
              width={40}
            />
            <Tooltip content={WeekTooltip} cursor={{ fill: 'rgba(var(--ion-color-medium-rgb), 0.1)' }} />
            <Bar dataKey="volumeKg" isAnimationActive={false} shape={renderBar(currentWeekStart, animateEntrance)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyVolumeChart;
