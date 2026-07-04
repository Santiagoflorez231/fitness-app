import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Definir rutas
const sourceFile = 'C:\\Users\\santi\\OneDrive\\Desktop\\Nueva carpeta\\exercises-dataset\\data\\exercises.json';
const outputDir = path.join(__dirname, '..', 'src', 'data');
const exercisesOutputFile = path.join(outputDir, 'exercises.json');
const filtersOutputFile = path.join(outputDir, 'filters.json');

// Pares a deduplicar (conservar id menor)
const DUPLICATES = [
  { name: 'barbell seated calf raise', ids: ['0088', '1371'] },
  { name: 'ez barbell spider curl', ids: ['0454', '1628'] },
  { name: 'lever chest press', ids: ['0577', '0576'] },
  { name: 'push-up (on stability ball)', ids: ['0655', '0656'] },
  { name: 'self assisted inverse leg curl', ids: ['0697', '1766'] },
  { name: 'smith reverse calf raises', ids: ['0763', '1394'] }
];

// Crear directorio de salida si no existe
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Leer datos de entrada
console.log('Leyendo dataset fuente...');
const rawData = fs.readFileSync(sourceFile, 'utf-8');
const exercises = JSON.parse(rawData);

console.log(`Total registros entrada: ${exercises.length}`);

// Verificar body_part vs category
let bodyPartDifferences = 0;
let bodyPartAlwaysSame = true;

for (const ex of exercises) {
  if (ex.body_part !== ex.category) {
    bodyPartDifferences++;
    bodyPartAlwaysSame = false;
  }
}

console.log(`\nVerificación body_part vs category:`);
if (bodyPartAlwaysSame) {
  console.log('✓ body_part === category en TODOS los registros. Campo descartado.');
} else {
  console.log(`⚠ body_part difiere de category en ${bodyPartDifferences} registros. Campo conservado.`);
}

// Construir mapa de IDs a descartar
const discardIds = new Set();
const discardedByReason = {};

for (const dup of DUPLICATES) {
  // Mantener el ID menor, descartar el mayor
  const ids = dup.ids.map(id => parseInt(id));
  const minId = Math.min(...ids);
  const maxId = Math.max(...ids);

  const idToDiscard = String(maxId).padStart(4, '0');
  discardIds.add(idToDiscard);
  discardedByReason[idToDiscard] = `Duplicado de "${dup.name}" (conservado id ${String(minId).padStart(4, '0')})`;
}

// Transformar registros
const transformed = [];
const stepsValidationErrors = [];

for (const ex of exercises) {
  // Saltar si es un ID a descartar
  if (discardIds.has(ex.id)) {
    continue;
  }

  // Crear registro transformado
  const transformed_ex = {
    id: ex.id,
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    target: ex.target,
    muscle_group: ex.muscle_group,
    secondary_muscles: ex.secondary_muscles,
    media_id: ex.media_id,
    steps: {
      en: ex.instruction_steps?.en || [],
      es: ex.instruction_steps?.es || []
    }
  };

  // Conservar body_part si difiere de category
  if (!bodyPartAlwaysSame) {
    transformed_ex.body_part = ex.body_part;
  }

  // Validar que steps.es y steps.en no estén vacíos
  if (!transformed_ex.steps.en || transformed_ex.steps.en.length === 0) {
    stepsValidationErrors.push(`ID ${ex.id} "${ex.name}": steps.en vacío`);
  }
  if (!transformed_ex.steps.es || transformed_ex.steps.es.length === 0) {
    stepsValidationErrors.push(`ID ${ex.id} "${ex.name}": steps.es vacío`);
  }

  transformed.push(transformed_ex);
}

// Ordenar por name ascendente
transformed.sort((a, b) => a.name.localeCompare(b.name));

// Validar conteo de salida
const expectedOutputCount = exercises.length - discardIds.size;
if (transformed.length !== expectedOutputCount) {
  console.error(`\nERROR: conteo de salida no cuadra.`);
  console.error(`Registros entrada: ${exercises.length}`);
  console.error(`IDs descartados: ${discardIds.size}`);
  console.error(`Esperado: ${expectedOutputCount}`);
  console.error(`Obtenido: ${transformed.length}`);
  process.exit(1);
}

console.log(`\nRegistros descartados: ${discardIds.size}`);
if (discardIds.size > 0) {
  console.log('IDs descartados:');
  for (const id of Array.from(discardIds).sort()) {
    console.log(`  - ${id}: ${discardedByReason[id]}`);
  }
}

console.log(`\nRegistros salida: ${transformed.length}`);

// Validación de steps
if (stepsValidationErrors.length > 0) {
  console.log('\n⚠ Validación de steps (NO descartados):');
  for (const error of stepsValidationErrors) {
    console.log(`  ${error}`);
  }
} else {
  console.log('✓ Validación de steps: todos los registros tienen steps.en y steps.es no vacíos');
}

// Generar filters.json
const categories = [...new Set(transformed.map(ex => ex.category))].sort();
const equipment = [...new Set(transformed.map(ex => ex.equipment))].sort();
const targets = [...new Set(transformed.map(ex => ex.target))].sort();

const filters = {
  categories,
  equipment,
  targets
};

// Escribir archivos de salida (sin pretty-print)
const exercisesJson = JSON.stringify(transformed);
const filtersJson = JSON.stringify(filters);

fs.writeFileSync(exercisesOutputFile, exercisesJson, 'utf-8');
fs.writeFileSync(filtersOutputFile, filtersJson, 'utf-8');

// Calcular tamaños
const exercisesSize = Buffer.byteLength(exercisesJson, 'utf-8');
const filtersSize = Buffer.byteLength(filtersJson, 'utf-8');

console.log(`\nArchivos generados:`);
console.log(`  exercises.json: ${exercisesOutputFile}`);
console.log(`    Registros: ${transformed.length}`);
console.log(`    Tamaño: ${exercisesSize.toLocaleString('es-ES')} bytes`);
console.log(`  filters.json: ${filtersOutputFile}`);
console.log(`    Categories: ${categories.length}`);
console.log(`    Equipment: ${equipment.length}`);
console.log(`    Targets: ${targets.length}`);
console.log(`    Tamaño: ${filtersSize.toLocaleString('es-ES')} bytes`);

console.log('\n✓ Transformación completada exitosamente');
