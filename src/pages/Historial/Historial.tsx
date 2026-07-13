/**
 * Historial — lista cronológica de sesiones terminadas (N1,
 * docs/renovacion-plan-v2.md). Solo lectura, cero cambios de db: reutiliza
 * `sessionsRepo.listFinished()` (todas las sesiones, ligeras: sin series) y
 * `sessionsRepo.getSets()` por lotes de PAGE_SIZE para no traer el historial
 * completo de series de golpe.
 *
 * No es una tab: se llega desde el link de Progreso y el acceso rápido de
 * Hoy (ruta /tabs/historial, mismo patrón que Ajustes).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { sessionsRepo } from '../../db';
import { formatDurationMinEs, formatRelativeEs } from '../../utils/dates';
import CargaSkeleton from '../../components/CargaSkeleton';
import SessionDetailSheet from '../../components/SessionDetailSheet';
import type { SessionSet, WorkoutSession } from '../../types/routine';
import './Historial.css';

/** Tamaño de lote de "carga perezosa": primeras PAGE_SIZE sesiones con
 * Promise.all de sus series; "Cargar más" trae el siguiente lote. */
const PAGE_SIZE = 15;

const WEIGHT_FORMATTER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** finishedAt - startedAt; finishedAt siempre está presente en sesiones
 * terminadas (listFinished() ya filtra finished_at IS NOT NULL), el
 * fallback es solo para que TypeScript acepte el tipo `number | null`. */
function sessionDurationMs(session: WorkoutSession): number {
  return (session.finishedAt ?? session.startedAt) - session.startedAt;
}

function sessionVolumeKg(sets: SessionSet[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

const Historial: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [setsBySession, setSetsBySession] = useState<Record<string, SessionSet[]>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  useIonViewWillEnter(() => {
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
    setSetsBySession({});
    sessionsRepo.listFinished().then((finished) => {
      setSessions(finished);
      setLoading(false);
    });
  });

  const visibleSessions = useMemo(() => sessions.slice(0, visibleCount), [sessions, visibleCount]);

  // Lote perezoso: solo pide getSets() de las sesiones visibles que todavía
  // no tienen series cargadas (el lote inicial de PAGE_SIZE, o el nuevo
  // tramo revelado por "Cargar más").
  useEffect(() => {
    const pending = visibleSessions.filter((session) => setsBySession[session.id] === undefined);
    if (pending.length === 0) {
      return;
    }
    let cancelled = false;
    setBatchLoading(true);
    Promise.all(
      pending.map(async (session) => ({ id: session.id, sets: await sessionsRepo.getSets(session.id) })),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setSetsBySession((previous) => {
        const next = { ...previous };
        entries.forEach(({ id, sets }) => {
          next[id] = sets;
        });
        return next;
      });
      setBatchLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visibleSessions, setsBySession]);

  const detailSession = useMemo(
    () => sessions.find((session) => session.id === detailSessionId) ?? null,
    [sessions, detailSessionId],
  );
  const detailSets = detailSessionId ? setsBySession[detailSessionId] ?? [] : [];

  if (loading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/tabs/hoy" />
            </IonButtons>
            <IonTitle size="small">Historial</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="historial-content">
          <div className="historial-stack">
            <CargaSkeleton variant="card" width="100%" height={112} />
            <CargaSkeleton variant="card" width="100%" height={112} />
            <CargaSkeleton variant="card" width="100%" height={112} />
            <CargaSkeleton variant="card" width="100%" height={112} />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/hoy" />
          </IonButtons>
          <IonTitle size="small">Historial</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="historial-content">
        <div className="historial-stack">
          {sessions.length === 0 ? (
            <div className="historial-empty carga-card">
              <span className="carga-overline">Cuaderno de sesiones</span>
              <p className="historial-empty-text">
                Aún no hay historial. Termina tu primer entrenamiento y quedará constancia aquí.
              </p>
            </div>
          ) : (
            <>
              <ul className="historial-list">
                {visibleSessions.map((session) => {
                  const sets = setsBySession[session.id];
                  return (
                    <li key={session.id}>
                      {sets === undefined ? (
                        <CargaSkeleton variant="card" width="100%" height={112} />
                      ) : (
                        <button
                          type="button"
                          className="carga-card historial-card"
                          onClick={() => setDetailSessionId(session.id)}
                        >
                          <span className="carga-overline">{formatRelativeEs(session.startedAt)}</span>
                          <h2 className="historial-card-name">{session.routineName}</h2>
                          <p className="historial-card-meta">
                            {formatDurationMinEs(sessionDurationMs(session))} · {sets.length}{' '}
                            {sets.length === 1 ? 'serie' : 'series'} · {WEIGHT_FORMATTER.format(sessionVolumeKg(sets))} kg
                          </p>
                          {session.notes && <p className="historial-card-narrative">{session.notes}</p>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {visibleCount < sessions.length && (
                <button
                  type="button"
                  className="historial-load-more"
                  disabled={batchLoading}
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  {batchLoading ? 'Cargando…' : 'Cargar más'}
                </button>
              )}
            </>
          )}
        </div>
      </IonContent>

      <SessionDetailSheet
        isOpen={detailSessionId !== null}
        onDismiss={() => setDetailSessionId(null)}
        session={detailSession}
        sets={detailSets}
      />
    </IonPage>
  );
};

export default Historial;
