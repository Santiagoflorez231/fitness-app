import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
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

export interface E1rmPoint {
  date: number;
  label: string;
  e1rm: number;
}

interface E1rmChartProps {
  data: E1rmPoint[];
  /** Nombre del ejercicio seleccionado, para el aria-label descriptivo del gráfico. */
  exerciseName?: string;
}

function E1rmTooltip(props: Partial<TooltipContentProps>) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload as E1rmPoint;
  return (
    <div style={chartTooltipStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{point.label}</div>
      <div>{formatKg(point.e1rm)} · 1RM est.</div>
    </div>
  );
}

/** Evolución del 1RM estimado (Epley) por sesión. Una sola serie, sin leyenda. */
const E1rmChart: React.FC<E1rmChartProps> = ({ data, exerciseName }) => {
  const lastPoint = data[data.length - 1];
  const exerciseLabel = exerciseName ?? 'ejercicio seleccionado';
  const ariaLabel =
    lastPoint !== undefined
      ? `Evolución del 1RM estimado de ${exerciseLabel}: último valor ${formatKg(lastPoint.e1rm)}`
      : `Evolución del 1RM estimado de ${exerciseLabel}: sin datos`;

  return (
    <div role="img" aria-label={ariaLabel}>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              domain={['auto', 'auto']}
            />
            <Tooltip content={E1rmTooltip} cursor={{ stroke: 'rgba(var(--ion-color-medium-rgb), 0.3)' }} />
            <Line
              type="monotone"
              dataKey="e1rm"
              stroke={CHART_DATA_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: CHART_DATA_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default E1rmChart;
