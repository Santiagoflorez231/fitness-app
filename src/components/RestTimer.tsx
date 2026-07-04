import { useEffect, useRef, useState } from 'react';
import { IonButton, IonFooter, IonProgressBar, IonToolbar } from '@ionic/react';

const STORAGE_KEY = 'fitness.restTimer';
const EXTEND_MS = 30_000;

interface StoredTimer {
  endsAt: number;
  totalMs: number;
}

/** Señal para (re)arrancar el temporizador: cambiar `nonce` fuerza un reinicio
 * aunque `seconds` sea el mismo valor que la última vez. */
export interface RestTimerTrigger {
  seconds: number;
  nonce: number;
}

interface RestTimerProps {
  trigger: RestTimerTrigger | null;
}

function readStoredTimer(): StoredTimer | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StoredTimer).endsAt !== 'number' ||
      typeof (parsed as StoredTimer).totalMs !== 'number'
    ) {
      return null;
    }
    const timer = parsed as StoredTimer;
    if (timer.endsAt <= Date.now()) {
      return null;
    }
    return timer;
  } catch {
    return null;
  }
}

function writeStoredTimer(timer: StoredTimer | null): void {
  if (timer) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Vibración corta al terminar el descanso. Import dinámico: en web el plugin
 * puede no estar disponible y no debe romper la app. */
async function vibrateShort(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Sin soporte (web u otra plataforma): no-op silencioso.
  }
}

/**
 * Barra de descanso fija sobre el tab bar. Deriva el tiempo restante contra
 * un timestamp objetivo (Date.now() vs endsAt) en vez de decrementar un
 * contador, para sobrevivir re-renders y la app en segundo plano.
 */
const RestTimer: React.FC<RestTimerProps> = ({ trigger }) => {
  const [timer, setTimer] = useState<StoredTimer | null>(() => readStoredTimer());
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const initial = readStoredTimer();
    return initial ? initial.endsAt - Date.now() : 0;
  });
  const lastNonce = useRef<number | null>(null);
  const finishedRef = useRef(false);

  // Arranca/reinicia el temporizador cuando el padre emite un nuevo trigger.
  useEffect(() => {
    if (!trigger || trigger.nonce === lastNonce.current) {
      return;
    }
    lastNonce.current = trigger.nonce;
    const totalMs = trigger.seconds * 1000;
    const next: StoredTimer = { endsAt: Date.now() + totalMs, totalMs };
    finishedRef.current = false;
    setTimer(next);
    writeStoredTimer(next);
  }, [trigger]);

  // Deriva el restante cada 500ms contra Date.now(), nunca decrementando un contador.
  // Intencional: este intervalo sigue corriendo (y puede vibrar) aunque la
  // pestaña de Entrenar quede oculta, para avisar al usuario del fin del
  // descanso aunque esté mirando otra tab.
  useEffect(() => {
    if (!timer) {
      return;
    }
    const interval = window.setInterval(() => {
      const remaining = timer.endsAt - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        setTimer(null);
        writeStoredTimer(null);
        void vibrateShort();
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [timer]);

  if (!timer || remainingMs <= 0) {
    return null;
  }

  const progress = Math.min(1, Math.max(0, 1 - remainingMs / timer.totalMs));

  const handleSkip = () => {
    finishedRef.current = true;
    setTimer(null);
    writeStoredTimer(null);
  };

  const handleAdd30 = () => {
    setTimer((previous) => {
      if (!previous) {
        return previous;
      }
      const next: StoredTimer = {
        endsAt: previous.endsAt + EXTEND_MS,
        totalMs: previous.totalMs + EXTEND_MS,
      };
      writeStoredTimer(next);
      return next;
    });
  };

  return (
    <IonFooter>
      <IonProgressBar value={progress} color="tertiary" />
      <IonToolbar>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums', paddingInlineStart: '1rem' }}>
            Descanso: {formatMmSs(remainingMs)}
          </span>
          <div>
            <IonButton fill="clear" size="small" onClick={handleAdd30}>
              +30 s
            </IonButton>
            <IonButton fill="clear" size="small" color="medium" onClick={handleSkip}>
              Saltar
            </IonButton>
          </div>
        </div>
      </IonToolbar>
    </IonFooter>
  );
};

export default RestTimer;
