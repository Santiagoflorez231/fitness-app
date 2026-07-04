/** Utilidades de texto compartidas (búsqueda, normalización). */

// Rango Unicode de los signos diacríticos combinables (U+0300 a U+036F),
// construido con charCodeAt para evitar ambigüedades de escape en el código fuente.
const DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

/** Quita diacríticos y pasa a minúsculas para permitir búsqueda insensible a acentos. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .toLowerCase();
}
