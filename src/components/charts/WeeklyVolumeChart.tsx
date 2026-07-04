import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
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

interface WeeklyVolumeChartProps {
  data: WeekVolume[];
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

/** Barras de volumen semanal (últimas 12 semanas ISO locales). Una sola serie, sin leyenda. */
const WeeklyVolumeChart: React.FC<WeeklyVolumeChartProps> = ({ data }) => {
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
            <Bar dataKey="volumeKg" fill={CHART_DATA_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyVolumeChart;
