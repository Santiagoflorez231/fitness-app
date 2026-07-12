import { useEffect, useState } from 'react';
import type { FamilyVolume } from '../../coach/volume';
import { sortByDeficit } from '../../coach/volume';
import './MuscleBalance.css';

const STAGGER_STEP_MS = 25;

const FAMILY_LABEL: Record<FamilyVolume['family'], string> = {
  empuje: 'Empuje',
  tiron: 'Tirón',
  pierna: 'Pierna',
  core: 'Core',
  brazos: 'Brazos',
  cardio: 'Cardio',
};

// Techo visual de cada barra: por encima del límite "alto" de sus
// landmarks (docs/roadmap-avanzado.md, A3), para dar margen a la zona
// 'high'. Cardio no tiene landmarks: techo puramente visual.
const VISUAL_CAP: Record<FamilyVolume['family'], number> = {
  empuje: 26,
  tiron: 26,
  pierna: 26,
  core: 22,
  brazos: 24,
  cardio: 20,
};

interface MuscleBalanceProps {
  balance: FamilyVolume[];
}

/** Balance de volumen semanal por familia muscular (docs/roadmap-avanzado.md, Bloque A3). */
const MuscleBalance: React.FC<MuscleBalanceProps> = ({ balance }) => {
  const [mounted, setMounted] = useState(false);
  const ordered = sortByDeficit(balance);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="carga-card progreso-balance">
      <span className="carga-overline">Balance muscular · esta semana</span>
      <ul className="progreso-balance-list">
        {ordered.map((row, index) => {
          const widthPct = Math.min(100, (row.sets / VISUAL_CAP[row.family]) * 100);
          const zoneAttr = row.family === 'cardio' ? 'neutral' : row.zone;
          return (
            <li key={row.family} className="progreso-balance-row">
              <span
                className="progreso-balance-badge"
                style={{
                  background: `var(--carga-avatar-${row.family}-bg)`,
                  color: `var(--carga-avatar-${row.family}-text)`,
                }}
              >
                {FAMILY_LABEL[row.family]}
              </span>
              <div className="progreso-balance-track">
                <div
                  className="progreso-balance-fill"
                  data-zone={zoneAttr}
                  style={{
                    width: `${widthPct}%`,
                    transform: mounted ? 'scaleX(1)' : 'scaleX(0)',
                    transitionDelay: `${index * STAGGER_STEP_MS}ms`,
                  }}
                />
              </div>
              <span className="progreso-balance-hint">{row.hint}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MuscleBalance;
