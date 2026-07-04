import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { sqlite } from './db/sqlite';

/**
 * En plataforma web, @capacitor-community/sqlite se apoya en `jeep-sqlite`
 * (sql.js + IndexedDB): hay que registrar el custom element, insertarlo en
 * el DOM, esperar a que esté definido y llamar a `initWebStore()` ANTES de
 * que cualquier código (src/db/sqlite.ts) intente abrir una conexión SQLite.
 * En Android/iOS no hace falta nada de esto: el plugin habla directo con el
 * puente nativo.
 */
async function setupWebSqliteStoreIfNeeded(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') {
    return;
  }
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);

  const jeepSqliteEl = document.createElement('jeep-sqlite');
  jeepSqliteEl.setAttribute('autoSave', 'true');
  document.body.appendChild(jeepSqliteEl);

  await customElements.whenDefined('jeep-sqlite');
  await sqlite.initWebStore();
}

async function bootstrap(): Promise<void> {
  await setupWebSqliteStoreIfNeeded();

  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();