import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const frontendDist = path.join(frontendDir, 'dist');
const rootDist = path.join(rootDir, 'dist');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[prepare_dist] Verifying build outputs for Vercel...');

// 1. Ensure frontend/dist exists
if (!fs.existsSync(frontendDist) || !fs.existsSync(path.join(frontendDist, 'index.html'))) {
  console.error('[prepare_dist] frontend/dist/index.html does not exist! Running fallback...');
  fs.mkdirSync(frontendDist, { recursive: true });
}

// 2. Ensure _redirects in frontend/dist
const redirectsContent = '/*    /index.html   200\n';
fs.writeFileSync(path.join(frontendDist, '_redirects'), redirectsContent);

// 3. Ensure root dist exists and mirrors frontend/dist
if (fs.existsSync(rootDist)) {
  fs.rmSync(rootDist, { recursive: true, force: true });
}
copyFolderSync(frontendDist, rootDist);
fs.writeFileSync(path.join(rootDist, '_redirects'), redirectsContent);

// 4. Verify outputs
const rootIndex = path.join(rootDist, 'index.html');
const frontendIndex = path.join(frontendDist, 'index.html');

if (fs.existsSync(rootIndex) && fs.existsSync(frontendIndex)) {
  console.log('[prepare_dist] SUCCESS: Output directory "dist" verified at both root and frontend:');
  console.log(`  - Root dist: ${rootDist} (index.html: ${fs.statSync(rootIndex).size} bytes)`);
  console.log(`  - Frontend dist: ${frontendDist} (index.html: ${fs.statSync(frontendIndex).size} bytes)`);
} else {
  console.error('[prepare_dist] ERROR: index.html could not be verified!');
  process.exit(1);
}
