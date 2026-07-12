import { useEffect, useState } from 'react';
import { IonModal } from '@ionic/react';
import './PlateCalculator.css';

/** Set estándar de discos disponibles, en kg. */
export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
/** Barras seleccionables, en kg (20 kg por defecto). */
export const BAR_OPTIONS_KG = [20, 15, 10, 7.5] as const;

export interface PlateBreakdown {
  /** Discos por lado, de mayor a menor (algoritmo greedy). */
  platesPerSide: number[];
  /** Peso total realmente alcanzable con esos discos + la barra. */
  achievedTotalKg: number;
  /** 0 si el peso objetivo es exacto; si no, la diferencia (siempre positiva). */
  shortfallKg: number;
}

/** Reparto greedy de discos por lado para alcanzar (o acercarse a) `targetKg`. */
export function calculatePlateBreakdown(targetKg: number, barKg: number): PlateBreakdown {
  const perSideTarget = Math.max(0, (targetKg - barKg) / 2);
  let remaining = perSideTarget;
  const platesPerSide: number[] = [];
  for (const plate of STANDARD_PLATES_KG) {
    while (remaining + 1e-6 >= plate) {
      platesPerSide.push(plate);
      remaining -= plate;
    }
  }
  const achievedPerSide = perSideTarget - remaining;
  const achievedTotalKg = Math.round((barKg + achievedPerSide * 2) * 100) / 100;
  const shortfallKg = Math.max(0, Math.round((targetKg - achievedTotalKg) * 100) / 100);
  return { platesPerSide, achievedTotalKg, shortfallKg };
}

export interface WarmupStep {
  label: string;
  weightKg: number;
  reps: number;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Series de aproximación: barra vacía x10 -> 40% x5 -> 60% x3 -> 80% x1, redondeo a 2,5 kg. */
export function calculateWarmup(targetKg: number, barKg: number): WarmupStep[] {
  return [
    { label: 'Barra vacía', weightKg: barKg, reps: 10 },
    { label: '40 %', weightKg: roundToStep(targetKg * 0.4, 2.5), reps: 5 },
    { label: '60 %', weightKg: roundToStep(targetKg * 0.6, 2.5), reps: 3 },
    { label: '80 %', weightKg: roundToStep(targetKg * 0.8, 2.5), reps: 1 },
  ];
}

function formatKgEs(value: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
}

const PLATE_HEIGHT_PX: Record<number, number> = {
  25: 64,
  20: 56,
  15: 48,
  10: 40,
  5: 32,
  2.5: 28,
  1.25: 24,
};

/** Color duotono por disco: reutiliza las familias de ExerciseAvatar (ver docs/design-carga.md). */
function plateStyle(plate: number): { background: string; color: string } {
  switch (plate) {
    case 25:
      return { background: 'var(--carga-avatar-empuje-bg)', color: 'var(--carga-avatar-empuje-text)' };
    case 20:
      return { background: 'var(--carga-avatar-tiron-bg)', color: 'var(--carga-avatar-tiron-text)' };
    case 15:
      return { background: 'var(--carga-avatar-brazos-bg)', color: 'var(--carga-avatar-brazos-text)' };
    case 10:
      return { background: 'var(--carga-avatar-pierna-bg)', color: 'var(--carga-avatar-pierna-text)' };
    default:
      return { background: 'var(--app-surface-elevated)', color: 'var(--app-text-primary)' };
  }
}

export type PlateCalculatorMode = 'plates' | 'warmup';

interface PlateCalculatorProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** Prefill del peso objetivo (peso del draft actual del ejercicio), si se conoce. */
  initialWeightKg: number | null;
  initialMode?: PlateCalculatorMode;
  /** Barra inicial al abrir el sheet (kg); por defecto 20. Ajustable en
   * Ajustes > Barra por defecto (ver src/hooks/usePlateSettings.ts). */
  defaultBarKg?: number;
}

/**
 * Sheet CARGA: calculadora de discos por lado y generador de series de
 * aproximación, como dos pestañas de un mismo segmento (para no multiplicar
 * modales). Acabado propio -- IonModal se usa solo como contenedor del sheet;
 * ningún control interno es chrome estándar de Ionic.
 * Referencia obligatoria: docs/design-carga.md
 */
const PlateCalculator: React.FC<PlateCalculatorProps> = ({
  isOpen,
  onDismiss,
  initialWeightKg,
  initialMode = 'plates',
  defaultBarKg = 20,
}) => {
  const [mode, setMode] = useState<PlateCalculatorMode>(initialMode);
  const [weightInput, setWeightInput] = useState<string>(initialWeightKg != null ? initialWeightKg.toString() : '');
  const [barKg, setBarKg] = useState<number>(defaultBarKg);

  // Re-sincroniza cada vez que el sheet se abre (puede abrirse para otro
  // ejercicio/peso sin que el componente se desmonte).
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setWeightInput(initialWeightKg != null ? initialWeightKg.toString() : '');
      setBarKg(defaultBarKg);
    }
  }, [isOpen, initialMode, initialWeightKg, defaultBarKg]);

  const weightKg = Number(weightInput.replace(',', '.'));
  const hasValidWeight = weightInput.trim() !== '' && Number.isFinite(weightKg) && weightKg >= 0;

  const breakdown = hasValidWeight ? calculatePlateBreakdown(weightKg, barKg) : null;
  const warmupSteps = hasValidWeight ? calculateWarmup(weightKg, barKg) : [];

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6, 0.9]}
      className="carga-sheet plate-calc-sheet"
    >
      <div className="carga-sheet-header">
        <p className="carga-overline">Herramienta de carga</p>
        <button type="button" className="carga-sheet-close" onClick={onDismiss} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="plate-calc-body">
        <div className="carga-segment" role="tablist" aria-label="Modo">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'plates'}
            className={`carga-segment-btn${mode === 'plates' ? ' carga-segment-btn-active' : ''}`}
            onClick={() => setMode('plates')}
          >
            Discos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'warmup'}
            className={`carga-segment-btn${mode === 'warmup' ? ' carga-segment-btn-active' : ''}`}
            onClick={() => setMode('warmup')}
          >
            Aproximación
          </button>
        </div>

        <div className="plate-calc-field">
          <label className="carga-overline" htmlFor="plate-calc-weight">
            Peso objetivo
          </label>
          <div className="plate-calc-weight-wrap">
            <input
              id="plate-calc-weight"
              className="plate-calc-weight-input carga-num"
              inputMode="decimal"
              type="number"
              step="0.5"
              min="0"
              placeholder="0"
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
            />
            <span className="plate-calc-weight-unit">kg</span>
          </div>
        </div>

        {mode === 'plates' && (
          <div className="plate-calc-field">
            <span className="carga-overline">Barra</span>
            <div className="carga-pill-row">
              {BAR_OPTIONS_KG.map((bar) => (
                <button
                  key={bar}
                  type="button"
                  className={`carga-pill-btn${barKg === bar ? ' carga-pill-btn-active' : ''}`}
                  onClick={() => setBarKg(bar)}
                >
                  {formatKgEs(bar)} kg
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasValidWeight ? (
          <p className="plate-calc-empty">Introduce un peso objetivo.</p>
        ) : mode === 'plates' ? (
          <div className="plate-calc-result">
            <p className="carga-overline">Discos por lado</p>
            {breakdown && breakdown.platesPerSide.length === 0 ? (
              <p className="plate-calc-empty">Solo la barra: {formatKgEs(barKg)} kg.</p>
            ) : (
              <div className="plate-calc-rack">
                {breakdown?.platesPerSide.map((plate, index) => (
                  <div
                    key={`${plate}-${index}`}
                    className="plate-disc"
                    style={{ height: `${PLATE_HEIGHT_PX[plate] ?? 24}px`, ...plateStyle(plate) }}
                  >
                    <span className="carga-num plate-disc-num">{formatKgEs(plate)}</span>
                  </div>
                ))}
              </div>
            )}
            {breakdown && breakdown.shortfallKg > 0 && (
              <p className="plate-calc-shortfall">
                Se queda en {formatKgEs(breakdown.achievedTotalKg)} kg (−{formatKgEs(breakdown.shortfallKg)})
              </p>
            )}
          </div>
        ) : (
          <div className="plate-calc-result">
            <p className="plate-calc-tagline">Calienta. No gastes.</p>
            <ul className="plate-calc-warmup-list">
              {warmupSteps.map((step) => (
                <li key={step.label} className="plate-calc-warmup-row">
                  <span className="plate-calc-warmup-label">{step.label}</span>
                  <span className="carga-num plate-calc-warmup-value">
                    {formatKgEs(step.weightKg)} kg × {step.reps}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </IonModal>
  );
};

export default PlateCalculator;
