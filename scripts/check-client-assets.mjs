import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const forbidden = [
  'CLIENT_SENTINEL_NOT_SECRET',
  'LICENCE_SENTINEL_NOT_SECRET',
  '987654321',
  'CITYPAY_LICENCE_KEY',
  'CITYPAY_CLIENT_ID',
  'localhost:3005',
];
let scanned = 0;
async function scan(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name);
    if (file.isDirectory()) await scan(path);
    else if (/\.(js|html|json|txt)$/.test(path)) {
      scanned++;
      const content = await readFile(path, 'utf8');
      for (const marker of forbidden)
        if (content.includes(marker))
          throw new Error(`Forbidden server marker or backend URL in ${path}: ${marker}`);
    }
  }
}
await scan('.next/static');
for (const file of ['.next/server/app/index.html', '.next/server/app/index.rsc']) {
  const content = await readFile(file, 'utf8').catch(() => '');
  for (const marker of forbidden)
    if (content.includes(marker))
      throw new Error(`Forbidden marker in prerendered page: ${marker}`);
}
console.log(
  `PASS: ${scanned} browser asset files contain no server credential markers or legacy backend URL.`,
);
