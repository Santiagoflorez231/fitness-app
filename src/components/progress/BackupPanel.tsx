import { useRef, useState } from 'react';
import { IonAlert, IonIcon, useIonToast } from '@ionic/react';
import { cloudDownloadOutline, cloudUploadOutline } from 'ionicons/icons';
import { exportBackup, importBackup } from '../../db/backup';
import './BackupPanel.css';

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Panel de respaldo: exporta/importa rutinas + historial completo como un
 * único archivo JSON. Sin red: todo el flujo es local (Blob + <a download>
 * para exportar, <input type="file"> + FileReader para importar). Ver
 * src/db/backup.ts para la lógica de lectura/escritura (aditiva).
 */
const BackupPanel: React.FC = () => {
  const [presentToast] = useIonToast();
  const [exporting, setExporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const backup = await exportBackup();
      downloadJson(backup, `carga-respaldo-${todayStamp()}.json`);
      await presentToast({ message: 'Respaldo descargado.', duration: 2000, color: 'success' });
    } catch (error) {
      console.error('[BackupPanel] Error al exportar', error);
      await presentToast({ message: 'No se pudo generar el respaldo.', duration: 2500, color: 'danger' });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPendingFile(file);
    event.target.value = '';
  };

  const handleConfirmImport = async () => {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) {
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const result = await importBackup(parsed);
      if (!result.ok) {
        await presentToast({ message: result.error ?? 'El respaldo no es válido.', duration: 3000, color: 'danger' });
        return;
      }
      await presentToast({
        message: `Importado: ${result.routinesImported ?? 0} rutinas, ${result.sessionsImported ?? 0} sesiones nuevas.`,
        duration: 3000,
        color: 'success',
      });
    } catch (error) {
      console.error('[BackupPanel] Error al importar', error);
      await presentToast({ message: 'El archivo no es un JSON válido.', duration: 2500, color: 'danger' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="carga-card progreso-backup">
      <span className="carga-overline">Respaldo</span>
      <p className="progreso-backup-text">
        Descarga tus rutinas y tu historial en un archivo, o restáuralos en otro dispositivo. Todo queda en tu
        teléfono: nada viaja por red.
      </p>
      <div className="progreso-backup-actions">
        <button type="button" className="progreso-backup-btn" onClick={handleExport} disabled={exporting}>
          <IonIcon icon={cloudDownloadOutline} />
          {exporting ? 'Generando…' : 'Descargar respaldo'}
        </button>
        <button
          type="button"
          className="progreso-backup-btn progreso-backup-btn-outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <IonIcon icon={cloudUploadOutline} />
          {importing ? 'Importando…' : 'Importar respaldo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="progreso-backup-file-input"
          onChange={handleFileSelected}
        />
      </div>

      <IonAlert
        isOpen={pendingFile !== null}
        header="Importar respaldo"
        message={`¿Importar "${pendingFile?.name ?? ''}"? Se añadirán las rutinas y entrenamientos que no tengas ya. No se borra nada existente.`}
        buttons={[
          { text: 'Cancelar', role: 'cancel', handler: () => setPendingFile(null) },
          { text: 'Importar', handler: handleConfirmImport },
        ]}
        onDidDismiss={() => setPendingFile(null)}
      />
    </div>
  );
};

export default BackupPanel;
