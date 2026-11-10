import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import * as elements from '@citypay/elements-react';
const require = createRequire(import.meta.url);
console.log('Node import without window/document: PASS');
console.log(
  'Provider SSR:',
  renderToString(
    createElement(
      elements.CityPayProvider,
      { pubKey: 'probe' },
      createElement('span', null, 'SSR works'),
    ),
  ),
);
console.log('GooglepayElement exported:', 'GooglepayElement' in elements);
const source = await readFile(require.resolve('@citypay/elements-react'), 'utf8');
const helper = source.match(/function addApiListeners\(api, listeners\) \{[\s\S]*?\n\}/)?.[0];
if (!helper) throw new Error('Published source changed; inspect the package again.');
console.log('CardFields passes props directly:', /addApiListeners\(api2, props\)/.test(source));
try {
  // Reproduce the exact published listener helper contract, without editing or
  // loading a patched package into the demo.
  runInNewContext(`${helper}; addApiListeners({}, {onChange() {}});`);
  console.log('CardFields listener probe: no error (recheck the workaround)');
} catch (error) {
  console.log('CardFields listener probe:', error.name + ': ' + error.message);
}
