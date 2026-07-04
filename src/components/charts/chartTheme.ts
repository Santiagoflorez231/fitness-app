/**
 * Constantes de estilo compartidas por los gráficos de Progreso (Recharts).
 * Un único color de dato en toda la vista: `--app-data` (azul acero CARGA),
 * reservado a gráficos/datos — 4,4:1 sobre fondo claro, 6,9:1 sobre oscuro.
 */
import type { CSSProperties } from 'react';

/** Color de la serie de datos (barras y línea). */
export const CHART_DATA_COLOR = 'var(--app-data)';

/** Grid recesivo: solo líneas horizontales, opacidad baja. */
export const CHART_GRID_STROKE = 'var(--app-border)';
export const CHART_GRID_OPACITY = 0.2;

/** Color de los ticks de los ejes (texto secundario). */
export const CHART_TICK_FILL = 'var(--app-text-secondary)';
export const CHART_TICK_FONT_SIZE = 12;

/** Estilo del recuadro del tooltip: fondo y texto en tokens de tema, borde sutil. */
export const chartTooltipStyle: CSSProperties = {
  background: 'var(--app-surface-elevated)',
  color: 'var(--app-text-primary)',
  border: '1px solid var(--app-border)',
  borderRadius: 8,
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  boxShadow: 'var(--app-shadow-card)',
};

/** Formatea kg en es-ES con como máximo 1 decimal (ej. "1234,5 kg"). */
export function formatKg(value: number): string {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)} kg`;
}

/** Abreviatura para el eje Y: valores >= 1000 se muestran como "1,2 k". */
export function formatKgAxis(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value / 1000)} k`;
  }
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value);
}
