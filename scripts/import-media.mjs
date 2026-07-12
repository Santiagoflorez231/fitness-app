import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const EXERCISES_PATH = path.join(PROJECT_ROOT, 'src/data/exercises.json');
const UPSTREAM_IMAGES = path.resolve(PROJECT_ROOT, '../exercises-dataset/images');
const UPSTREAM_VIDEOS = path.resolve(PROJECT_ROOT, '../exercises-dataset/videos');
const DEST_THUMBS = path.join(PROJECT_ROOT, 'public/assets/exercise-thumbs');
const DEST_GIFS = path.join(PROJECT_ROOT, 'public/assets/exercise-gifs');

// Ensure destination directories exist
for (const dir of [DEST_THUMBS, DEST_GIFS]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Read exercises
let exercises;
try {
  const data = fs.readFileSync(EXERCISES_PATH, 'utf8');
  exercises = JSON.parse(data);
  console.log(`Loaded ${exercises.length} exercises from exercises.json`);
} catch (err) {
  console.error('Error reading exercises.json:', err.message);
  process.exit(1);
}

let copiedThumbs = 0;
let copiedGifs = 0;
let missingThumbs = [];
let missingGifs = [];
const mediaGym = {};

// Process each exercise
for (const exercise of exercises) {
  const { id, media_id } = exercise;

  if (!id || !media_id) {
    continue;
  }

  const sourceThumb = path.join(UPSTREAM_IMAGES, `${id}-${media_id}.jpg`);
  const sourceGif = path.join(UPSTREAM_VIDEOS, `${id}-${media_id}.gif`);
  const destThumb = path.join(DEST_THUMBS, `${id}.jpg`);
  const destGif = path.join(DEST_GIFS, `${id}.gif`);

  let thumbExists = false;
  let gifExists = false;

  // Copy thumbnail if missing or empty
  if (!fs.existsSync(destThumb) || fs.statSync(destThumb).size === 0) {
    if (fs.existsSync(sourceThumb)) {
      try {
        fs.copyFileSync(sourceThumb, destThumb);
        copiedThumbs++;
        thumbExists = true;
      } catch (err) {
        missingThumbs.push({ id, media_id, error: err.message });
      }
    } else {
      missingThumbs.push({ id, media_id, error: 'source file not found' });
    }
  } else {
    thumbExists = true;
  }

  // Copy GIF if missing or empty
  if (!fs.existsSync(destGif) || fs.statSync(destGif).size === 0) {
    if (fs.existsSync(sourceGif)) {
      try {
        fs.copyFileSync(sourceGif, destGif);
        copiedGifs++;
        gifExists = true;
      } catch (err) {
        missingGifs.push({ id, media_id, error: err.message });
      }
    } else {
      missingGifs.push({ id, media_id, error: 'source file not found' });
    }
  } else {
    gifExists = true;
  }

  // Add to mediaGym only if BOTH files exist
  if (thumbExists && gifExists) {
    mediaGym[id] = {
      thumb: `assets/exercise-thumbs/${id}.jpg`,
      gif: `assets/exercise-gifs/${id}.gif`
    };
  }
}

// Write mediaGym.json
const mediaGymPath = path.join(PROJECT_ROOT, 'src/data/mediaGym.json');
fs.writeFileSync(mediaGymPath, JSON.stringify(mediaGym));

// Calculate folder sizes
function getFolderSize(folderPath) {
  let size = 0;
  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      size += stat.size;
    }
  }
  return (size / 1024 / 1024).toFixed(2);
}

const thumbsSizeMB = getFolderSize(DEST_THUMBS);
const gifsSizeMB = getFolderSize(DEST_GIFS);

// Print validation report
console.log('\n=== IMPORT MEDIA VALIDATION REPORT ===\n');
console.log(`Input records: ${exercises.length}`);
console.log(`\nThumbnails (JPG):`);
console.log(`  Copied: ${copiedThumbs}`);
console.log(`  Missing: ${missingThumbs.length}`);
console.log(`  Folder size: ${thumbsSizeMB} MB`);

console.log(`\nGIFs:`);
console.log(`  Copied: ${copiedGifs}`);
console.log(`  Missing: ${missingGifs.length}`);
console.log(`  Folder size: ${gifsSizeMB} MB`);

console.log(`\nmediaGym.json entries (both files present): ${Object.keys(mediaGym).length}`);

if (missingThumbs.length > 0 && missingThumbs.length <= 20) {
  console.log(`\nMissing thumbnails:`);
  missingThumbs.forEach(item => console.log(`  - ${item.id}-${item.media_id} (${item.error})`));
}

if (missingGifs.length > 0 && missingGifs.length <= 20) {
  console.log(`\nMissing GIFs:`);
  missingGifs.forEach(item => console.log(`  - ${item.id}-${item.media_id} (${item.error})`));
}

if (missingThumbs.length > 20) {
  console.log(`\n... and ${missingThumbs.length - 20} more missing thumbnails`);
}

if (missingGifs.length > 20) {
  console.log(`\n... and ${missingGifs.length - 20} more missing GIFs`);
}
