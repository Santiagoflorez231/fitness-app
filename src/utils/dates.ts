/**
 * Helpers de fechas para agregados por semana ISO (lunes-domingo).
 *
 * Regla de docs/persistence-schema.md: los límites de semana se calculan en
 * la zona horaria LOCAL en el momento de la consulta, no al guardar (los
 * timestamps en `session_sets` son epoch ms UTC). Sin librerías externas.
 */

const MONTHS_ES_ABBR = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Lunes 00:00 hora local de la semana ISO (lunes-domingo) a la que pertenece `ts`. */
export function startOfIsoWeekLocal(ts: number): number {
  const date = new Date(ts);
  const day = date.getDay(); // 0 = domingo .. 6 = sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Suma (o resta) días en hora local. Usa los setters de `Date` en vez de
 * aritmética directa en milisegundos para no desplazarse en los cambios de
 * horario de verano/invierno.
 */
export function addDaysLocal(ts: number, days: number): number {
  const date = new Date(ts);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** "dd MMM" en es-ES (ej. "03 jul") de una fecha cualquiera, hora local. */
export function formatDayMonthEs(ts: number): string {
  const date = new Date(ts);
  const day = date.getDate().toString().padStart(2, '0');
  const month = MONTHS_ES_ABBR[date.getMonth()];
  return `${day} ${month}`;
}

/** Etiqueta de semana: "dd MMM" del lunes de la semana ISO local a la que pertenece `ts`. */
export function formatWeekLabel(ts: number): string {
  return formatDayMonthEs(startOfIsoWeekLocal(ts));
}

/** "dd/MM" hora local (ej. "04/07"), usado en ejes de gráficos por sesión/fecha exacta. */
export function formatShortDateEs(ts: number): string {
  const date = new Date(ts);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

/** 00:00 hora local del día calendario al que pertenece `ts` (para agregados diarios, ej. el heatmap de Progreso). */
export function startOfDayLocal(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
