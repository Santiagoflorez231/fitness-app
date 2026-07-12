import { useEffect, useRef, useState } from 'react';

/** docs/design-carga.md — Progreso: "cifras con count-up 400ms (rAF)". */
const DURATION_MS = 400;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

interface CountUpNumberProps {
  /** Valor final a mostrar. */
  value: number;
  /** Formateador del valor a texto (ej. formatKg). Por defecto, entero redondeado. */
  format?: (value: number) => string;
  className?: string;
}

/**
 * Cifra hero con entrada "count-up" (0 -> valor) vía requestAnimationFrame,
 * 400ms — la única animación con JS permitida por REGLA DE MOVIMIENTO
 * (docs/design-carga.md: el resto del movimiento de la app es CSS puro).
 * Respeta `prefers-reduced-motion` mostrando el valor final sin animar.
 *
 * Accesibilidad: el dígito animado se marca aria-hidden (los valores
 * intermedios no deben anunciarse) y un nodo `sr-only` paralelo expone
 * siempre el valor final ya formateado.
 */
const CountUpNumber: React.FC<CountUpNumberProps> = ({ value, format, className }) => {
  const reduced = prefersReducedMotion();
  const [displayValue, setDisplayValue] = useState(reduced ? value : 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(value);
      return;
    }

    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / DURATION_MS);
      // Ease-out cúbico: arranca rápido y frena, coherente con --app-ease.
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(value * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(value);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value]);

  const formatValue = (raw: number): string => (format ? format(raw) : Math.round(raw).toString());

  return (
    <span className={`carga-num${className ? ` ${className}` : ''}`}>
      <span aria-hidden="true">{formatValue(displayValue)}</span>
      <span className="sr-only">{formatValue(value)}</span>
    </span>
  );
};

export default CountUpNumber;
