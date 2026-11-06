// Copies the app's icon definitions (src/v3/icons3d/brickIcons.js, ES module) into this
// gallery workspace as a plain script, so Kubai's checker and exporter can render them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../../src/v3/icons3d/brickIcons.js'), 'utf8');
const plain = src
  .replace(/^import .*$/m, '')
  .replace(/^export const ICONS/m, 'const ICONS')
  .replace(/^export const ICON_BY_NAME.*$/m, '');
fs.writeFileSync(path.join(here, 'src/icons.js'), plain);
const names = [...plain.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
console.log(`synced ${names.length} icon definitions`);
