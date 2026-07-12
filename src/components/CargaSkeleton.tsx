import './CargaSkeleton.css';

export type CargaSkeletonVariant = 'row' | 'card' | 'block';

interface CargaSkeletonProps {
  /** Forma por defecto: 'row' (fila de lista, 64px), 'card' (carril, 120×150)
   * o 'block' (rectángulo genérico — buscador, chips, cards de familia). */
  variant?: CargaSkeletonVariant;
  /** Anchura/alto en px (number) o cualquier valor CSS válido (string).
   * Sobreescribe el tamaño por defecto del variant. */
  width?: number | string;
  height?: number | string;
  className?: string;
}

function toCssSize(value: number | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Placeholder de carga CARGA — REUTILIZABLE (R6 lo estrena en Explorar, R8
 * lo extiende al resto de páginas). Formas grises `--app-surface-elevated`
 * con shimmer sutil de opacidad, CSS puro; prefers-reduced-motion lo congela
 * (ver CargaSkeleton.css).
 */
const CargaSkeleton: React.FC<CargaSkeletonProps> = ({ variant = 'block', width, height, className }) => {
  const style: React.CSSProperties = {};
  const cssWidth = toCssSize(width);
  const cssHeight = toCssSize(height);
  if (cssWidth !== undefined) {
    style.width = cssWidth;
  }
  if (cssHeight !== undefined) {
    style.height = cssHeight;
  }

  return (
    <div
      className={`carga-skeleton carga-skeleton-${variant}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    />
  );
};

export default CargaSkeleton;
