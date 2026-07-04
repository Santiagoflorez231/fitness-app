/**
 * Constantes de estilo compartidas por los gráficos de Progreso (Recharts).
 * Un único color de dato en toda la vista: azul primario de Ionic (#3880ff),
 * validado por contraste sobre fondo claro y oscuro (`--ion-background-color`).
 */
import type { CSSProperties } from 'react';

/** Color de la serie de datos (barras y línea). */
export const CHART_DATA_COLOR = '#3880ff';

/** Grid recesivo: solo líneas horizontales, opacidad baja. */
export const CHART_GRID_STROKE = 'var(--ion-color-medium)';
export const CHART_GRID_OPACITY = 0.2;

/** Color de los ticks de los ejes (texto secundario). */
export const CHART_TICK_FILL = 'var(--ion-color-medium)';
export const CHART_TICK_FONT_SIZE = 12;

/** Estilo del recuadro del tooltip: fondo y texto en tokens de tema, borde sutil. */
export const chartTooltipStyle: CSSProperties = {
  background: 'var(--ion-background-color)',
  color: 'var(--ion-text-color)',
  border: '1px solid rgba(var(--ion-color-medium-rgb), 0.35)',
  borderRadius: 8,
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
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
