// FR-I18N-001..003 / FR-I18N-007: every UI string used in the code exists in English, Spanish and Arabic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../src/i18n/en.js';
import es from '../../src/i18n/es.js';
import ar from '../../src/i18n/ar.js';

const files = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : []; });
const code = files('src').filter(f => !f.includes('i18n')).map(f => readFileSync(f, 'utf8')).join('\n');
/* literal keys only: t('a.b') — dynamic keys (t('status.' + s)) are covered by the key-parity test */
const used = [...new Set([...code.matchAll(/\bt\('([a-zA-Z0-9_.-]+[a-zA-Z0-9])'\s*[,)]/g)].map(m => m[1]))];

test('all literal keys used in the code exist in English', () => {
  const missing = used.filter(k => !(k in en));
  assert.deepEqual(missing, []);
});

test('Spanish and Arabic have every English key', () => {
  for (const [name, dict] of [['es', es], ['ar', ar]]) {
    const missing = Object.keys(en).filter(k => !(k in dict));
    assert.deepEqual(missing, [], `${name} is missing keys`);
  }
});

test('placeholders match across languages', () => {
  /* compare the set of placeholders: plural forms ("one|many") may repeat or omit {n} per form */
  const vars = s => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join(',');
  const bad = [];
  for (const k of Object.keys(en)) for (const [name, dict] of [['es', es], ['ar', ar]]) {
    if (k in dict && vars(en[k]) !== vars(dict[k])) bad.push(`${name}:${k}`);
  }
  assert.deepEqual(bad, []);
});

test('CONTENT-003: no unsupported claims in English copy', () => {
  const banned = /eco[- ]friendly|healthier|well-being|engineered for purity|free check-up|one business day|guaranteed safe|\bcrypto\b/i;
  const hits = Object.entries(en).filter(([k, v]) => banned.test(v) && !k.startsWith('pay.crypto') && !k.startsWith('admin.crypto') && k !== 'pay.crypto');
  assert.deepEqual(hits.map(([k]) => k), []);
});
