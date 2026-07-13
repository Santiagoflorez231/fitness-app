/**
 * Copia sql-wasm.wasm (dependencia de jeep-sqlite, usada por
 * @capacitor-community/sqlite en la plataforma web) a public/assets/.
 * jeep-sqlite lo carga en runtime vía fetch relativo a la ruta del documento
 * (por defecto "/assets/sql-wasm.wasm"), así que debe vivir en `public/`
 * para que Vite lo sirva/copie tal cual, sin pasar por el bundler.
 *
 * Se ejecuta automáticamente en "postinstall" para no depender de un paso
 * manual sin rastro; es seguro correrlo varias veces (sobrescribe).
 *
 * ⚠️ ACOPLAMIENTO DE VERSIÓN (bug real, 2026-07-12): el pegamento JS de
 * sql.js viene PRECOMPILADO dentro del dist de jeep-sqlite, así que el wasm
 * copiado debe ser de la MISMA versión de sql.js con la que se construyó
 * jeep-sqlite — no la que npm resuelva más nueva. package.json fija sql.js
 * EXACTO (1.11.0 para jeep-sqlite 2.8.0). Síntoma si se desalinea: todas
 * las páginas con BD se cuelgan en skeleton y la consola muestra
 * "WebAssembly.instantiate LinkError: function import requires a callable".
 * Si actualizas jeep-sqlite, re-alinea el pin y prueba en NAVEGADOR REAL
 * (no basta HTTP 200).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceFile = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const outputDir = path.join(__dirname, '..', 'public', 'assets');
const outputFile = path.join(outputDir, 'sql-wasm.wasm');

if (!fs.existsSync(sourceFile)) {
  console.warn(
    `[copy-sql-wasm] No se encontró "${sourceFile}". ` +
      'Si jeep-sqlite/sql.js aún no está instalado, se omite la copia.'
  );
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(sourceFile, outputFile);
console.log(`[copy-sql-wasm] Copiado a ${path.relative(path.join(__dirname, '..'), outputFile)}`);
