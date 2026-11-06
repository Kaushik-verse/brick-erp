// Renders the launcher icon PNGs for every Android density with headless Chrome.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defs, art, background } from './art.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RES = path.resolve(here, '../../android/app/src/newdesign/res');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DENS = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Legacy icons: rounded-square / circle plate with the art scaled into it.
const legacy = (round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${defs}
  <clipPath id="c">${round ? '<circle cx="54" cy="54" r="50"/>' : '<rect x="4" y="4" width="100" height="100" rx="22"/>'}</clipPath>
  <g clip-path="url(#c)">${background}</g>
  <g transform="translate(54 54) scale(1.2) translate(-54 -52)">${art}</g></svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${defs}${art}</svg>`;
const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${defs}${background}</svg>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fbicon-'));
function png(svg, px, out) {
  const html = path.join(tmp, 'i.html');
  fs.writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${svg}`);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(tmp, 'p')}`, '--hide-scrollbars',
    '--default-background-color=00000000', `--window-size=${px},${px}`, `--screenshot=${out}`, `file://${html}`], { stdio: 'ignore' });
}
for (const [d, s] of Object.entries(DENS)) {
  const dir = path.join(RES, `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  png(fg, Math.round(108 * s), path.join(dir, 'ic_launcher_foreground.png'));
  png(bg, Math.round(108 * s), path.join(dir, 'ic_launcher_background.png'));
  png(legacy(false), Math.round(48 * s), path.join(dir, 'ic_launcher.png'));
  png(legacy(true), Math.round(48 * s), path.join(dir, 'ic_launcher_round.png'));
}
// Adaptive icon definitions (Android 8+): full-bleed layers, no inset.
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpi, { recursive: true });
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), xml);
fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), xml);
// Also a large preview + source SVGs for reference.
fs.writeFileSync(path.join(here, 'factory-book-icon.svg'), legacy(false));
png(legacy(false), 512, path.join(here, 'factory-book-icon-512.png'));
png(legacy(true), 512, path.join(here, 'factory-book-icon-round-512.png'));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('icons written to', RES);
