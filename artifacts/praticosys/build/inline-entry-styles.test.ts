import assert from 'node:assert/strict';
import test from 'node:test';
import { inlineEntryStyles } from './inline-entry-styles';

type Asset = { type: 'asset'; fileName: string; source: string | Uint8Array };

function transform(html: string, bundle: Record<string, Asset>) {
  const hook = inlineEntryStyles().transformIndexHtml;
  assert.ok(hook && typeof hook === 'object');
  const handler = hook.handler as unknown as (
    html: string,
    context: { bundle: Record<string, Asset> },
  ) => string;
  return handler(html, { bundle });
}

const styles = {
  'assets/app.css': {
    type: 'asset' as const,
    fileName: 'assets/app.css',
    source: '.flex{display:flex}.bg-slate-900{background:#0f172a}',
  },
};

test('includes the exact entry CSS while retaining external fonts and scripts', () => {
  const html = '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">' +
    '<link rel="stylesheet" crossorigin href="/assets/app.css">' +
    '<script type="module" src="/assets/app.js"></script>';
  const result = transform(html, styles);
  assert.ok(result.includes(`<style data-praticosys-styles="assets/app.css">${styles['assets/app.css'].source}</style>`));
  assert.ok(result.includes('href="https://fonts.googleapis.com/css2?family=Inter"'));
  assert.ok(result.includes('src="/assets/app.js"'));
  assert.ok(!result.includes('href="/assets/app.css"'));
});

test('supports an artifact prefix and bytes emitted by the bundler', () => {
  const result = transform("<link href='/praticosys/assets/app.css' rel='stylesheet'>", {
    'assets/app.css': { ...styles['assets/app.css'], source: new TextEncoder().encode('.flex{display:flex}') },
  });
  assert.ok(result.includes('.flex{display:flex}'));
});

test('fails the build rather than publishing a missing stylesheet', () => {
  assert.throws(
    () => transform('<link rel="stylesheet" href="/assets/missing.css">', styles),
    /não foi encontrada/,
  );
});

test('fails the build rather than publishing an empty stylesheet', () => {
  assert.throws(
    () => transform('<link rel="stylesheet" href="/assets/app.css">', {
      'assets/app.css': { ...styles['assets/app.css'], source: ' ' },
    }),
    /está vazia/,
  );
});

test('fails when no entry stylesheet was included', () => {
  assert.throws(() => transform('<html><body></body></html>', styles), /sem incorporar/);
});

test('escapes a closing style sequence without introducing an HTML element', () => {
  const result = transform('<link rel="stylesheet" href="/assets/app.css">', {
    'assets/app.css': { ...styles['assets/app.css'], source: 'a:after{content:"</style><p>"}' },
  });
  assert.equal(result.match(/<\/style>/g)?.length, 1);
  assert.ok(result.includes('<\\/style>'));
});
