import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEDIA_MATCH_FILE = path.join(__dirname, 'media-match.json');
const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const OUTPUT_DIR = path.join(__dirname, '../public/assets/exercise-media');
const MEDIA_LOCAL_FILE = path.join(__dirname, '../src/data/mediaLocal.json');
const LICENSE_FILE = path.join(__dirname, '../public/assets/exercise-media/LICENSE.txt');

// Read media-match.json
const mediaMatch = JSON.parse(fs.readFileSync(MEDIA_MATCH_FILE, 'utf-8'));

console.log(`Starting media download for ${mediaMatch.length} exercises...`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Output directory: ${OUTPUT_DIR}\n`);

let downloaded = 0;
let skipped = 0;
let failed = 0;
const failedItems = [];
const mediaLocal = {};

async function downloadImage(url, filePath) {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check if file already exists and has content
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      return { success: true, skipped: true };
    }
  }

  // Try to download with 1 retry
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return { success: true, size: buffer.byteLength };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  return { success: false, error: lastError.message };
}

async function processExercises() {
  for (let i = 0; i < mediaMatch.length; i++) {
    const exercise = mediaMatch[i];
    const exerciseDir = path.join(OUTPUT_DIR, exercise.id);
    let allImagesDownloaded = true;
    const exerciseImages = [];

    // Download all images for this exercise
    for (let imgIdx = 0; imgIdx < exercise.images.length; imgIdx++) {
      const imagePath = exercise.images[imgIdx];
      const imageUrl = `${BASE_URL}/${imagePath}`;
      const localFilePath = path.join(exerciseDir, `${imgIdx}.jpg`);
      const relativePath = `assets/exercise-media/${exercise.id}/${imgIdx}.jpg`;

      const result = await downloadImage(imageUrl, localFilePath);

      if (result.skipped) {
        skipped++;
        exerciseImages.push(relativePath);
      } else if (result.success) {
        downloaded++;
        exerciseImages.push(relativePath);
      } else {
        failed++;
        allImagesDownloaded = false;
        failedItems.push({
          id: exercise.id,
          name: exercise.name,
          imageIndex: imgIdx,
          url: imageUrl,
          error: result.error
        });
      }

      // Small pause between downloads
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Only add to mediaLocal if ALL images downloaded successfully
    if (allImagesDownloaded && exerciseImages.length === exercise.images.length) {
      mediaLocal[exercise.id] = exerciseImages;
    }

    // Progress indicator
    if ((i + 1) % 50 === 0) {
      console.log(`Processed ${i + 1}/${mediaMatch.length} exercises...`);
    }
  }
}

// Main execution
try {
  await processExercises();

  // Write mediaLocal.json
  fs.mkdirSync(path.dirname(MEDIA_LOCAL_FILE), { recursive: true });
  fs.writeFileSync(MEDIA_LOCAL_FILE, JSON.stringify(mediaLocal));

  // Write LICENSE file
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const licenseContent = `Source: free-exercise-db by yuhonas (https://github.com/yuhonas/free-exercise-db)
License: Public Domain (Unlicense)`;
  fs.writeFileSync(LICENSE_FILE, licenseContent);

  // Report results
  console.log('\n=== DOWNLOAD COMPLETE ===');
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (already existed): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Exercises with complete media: ${Object.keys(mediaLocal).length} / ${mediaMatch.length}`);

  // Calculate directory size
  const getSize = (dir) => {
    let size = 0;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getSize(filePath);
      } else {
        size += stat.size;
      }
    });
    return size;
  };

  const totalSize = getSize(OUTPUT_DIR) / (1024 * 1024);
  console.log(`Total disk size: ${totalSize.toFixed(2)} MB`);

  if (failedItems.length > 0) {
    console.log(`\nFailed downloads (${failedItems.length}):`);
    failedItems.slice(0, 10).forEach(item => {
      console.log(`  - ID: ${item.id} (${item.name}), image ${item.imageIndex}: ${item.error}`);
    });
    if (failedItems.length > 10) {
      console.log(`  ... and ${failedItems.length - 10} more`);
    }
  }

  console.log(`\nmediaLocal.json written to: ${MEDIA_LOCAL_FILE}`);
  console.log(`LICENSE written to: ${LICENSE_FILE}`);

} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}
