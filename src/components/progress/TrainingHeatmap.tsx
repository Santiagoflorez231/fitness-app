import { useMemo, useState } from 'react';
import type { DayVolume } from '../../hooks/useProgressData';
import { formatDayMonthEs } from '../../utils/dates';
import { formatKg } from '../charts/chartTheme';
import './TrainingHeatmap.css';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface TrainingHeatmapProps {
  /** Un día por celda, ascendente, alineado a semanas ISO (lunes primero). */
  days: DayVolume[];
  sessionsInWindow: number;
}

/** Nivel de intensidad 0-4 (estilo GitHub-contributions) relativo al día de más volumen de la ventana. */
function levelFor(volumeKg: number, maxVolumeKg: number): 0 | 1 | 2 | 3 | 4 {
  if (volumeKg <= 0) {
    return 0;
  }
  if (maxVolumeKg <= 0) {
    return 1;
  }
  const ratio = volumeKg / maxVolumeKg;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/** Calendario tipo GitHub-contributions de las últimas semanas: intensidad = volumen del día. */
const TrainingHeatmap: React.FC<TrainingHeatmapProps> = ({ days, sessionsInWindow }) => {
  const [selected, setSelected] = useState<DayVolume | null>(null);

  const maxVolumeKg = useMemo(() => days.reduce((max, day) => Math.max(max, day.volumeKg), 0), [days]);

  // Columnas = semanas: el array ya viene alineado lunes->domingo, se agrupa de 7 en 7.
  const weeks = useMemo(() => {
    const result: DayVolume[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const selectedLabel =
    selected === null
      ? ' '
      : selected.setCount > 0
        ? `${formatDayMonthEs(selected.dayStart)} · ${formatKg(selected.volumeKg)} · ${selected.setCount} ${selected.setCount === 1 ? 'serie' : 'series'}`
        : `${formatDayMonthEs(selected.dayStart)} · descanso`;

  return (
    <div className="carga-card progreso-heatmap">
      <span className="carga-overline">Calendario</span>
      <div className="progreso-heatmap-body">
        <div className="progreso-heatmap-day-labels" aria-hidden="true">
          {DAY_LABELS.map((label, index) => (
            <span key={label + index}>{index % 2 === 1 ? label : ''}</span>
          ))}
        </div>
        <div className="progreso-heatmap-grid">
          {weeks.map((week, weekIndex) => (
            <div className="progreso-heatmap-week" key={week[0]?.dayStart ?? weekIndex}>
              {week.map((day) => (
                <button
                  type="button"
                  key={day.dayStart}
                  className="progreso-heatmap-cell"
                  data-level={levelFor(day.volumeKg, maxVolumeKg)}
                  data-selected={selected?.dayStart === day.dayStart ? 'true' : undefined}
                  title={`${formatDayMonthEs(day.dayStart)} · ${formatKg(day.volumeKg)}`}
                  aria-label={`${formatDayMonthEs(day.dayStart)}: ${day.setCount} series, ${formatKg(day.volumeKg)}`}
                  onClick={() => setSelected(day)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="progreso-heatmap-selected">{selectedLabel}</p>
      <p className="progreso-heatmap-remark">
        {sessionsInWindow} {sessionsInWindow === 1 ? 'sesión este ciclo' : 'sesiones este ciclo'}.
      </p>
    </div>
  );
};

export default TrainingHeatmap;
