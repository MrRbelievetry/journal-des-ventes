const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync('app.js', 'utf8') + `
globalThis.__testApi = {
  PENNYLANE_HEADERS,
  normalizeAmazonDateRobust,
  parseAmazonCsv,
  buildPennylaneEntriesForTransaction,
  validateSourceRowsForPennylane,
  validatePennylaneEntries,
  centsFromPennylane
};`;

const elements = {
  periodStart: { value: '2026-07-01' },
  periodEnd: { value: '2026-07-31' }
};

const context = {
  console,
  Intl,
  Math,
  Number,
  String,
  RegExp,
  Array,
  Map,
  Set,
  Date,
  globalThis: null,
  window: { addEventListener() {} },
  document: { getElementById(id) { return elements[id] || { value: '', addEventListener() {}, hidden: false, textContent: '', innerHTML: '' }; } },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  alert(message) { throw new Error(message); }
};
context.globalThis = context;

vm.runInNewContext(code, context, { filename: 'app.js' });
const api = context.__testApi;

assert.strictEqual(api.normalizeAmazonDateRobust('2 juillet 2026 13:22:36 UTC'), '2026-07-02');
assert.strictEqual(api.normalizeAmazonDateRobust('Jul 2, 2026 13:22:36 UTC'), '2026-07-02');
assert.strictEqual(api.normalizeAmazonDateRobust('02/07/2026'), '2026-07-02');
assert.strictEqual(api.normalizeAmazonDateRobust('2026-07-02T13:22:36Z'), '2026-07-02');

const sampleRows = [
  { source: 'Amazon', date: '2026-07-02', reference: '407-1', payment: 'Amazon', vatRate: 20, ht: 100, vat: 20, ttc: 120 },
  { source: 'Amazon - Remboursement', date: '2026-07-03', reference: '407-2', payment: 'Remboursement Amazon', vatRate: 20, ht: -10, vat: -2, ttc: -12 },
  { source: 'Oriental Discount - Avoir', date: '2026-07-04', reference: 'AV0001', payment: 'PayPal', vatRate: 20, ht: -30, vat: -6, ttc: -36 },
  { source: 'Oriental Discount', date: '2026-07-05', reference: 'FA0001', payment: 'PayPal', vatRate: 0, ht: 44.02, vat: 0, ttc: 44.02 }
];

assert.strictEqual(api.validateSourceRowsForPennylane(sampleRows).length, 0);

const issues = [];
const entries = sampleRows.flatMap((row, index) => api.buildPennylaneEntriesForTransaction(row, index + 1, false, issues));
assert.strictEqual(issues.length, 0);
assert.strictEqual(api.validatePennylaneEntries(entries).length, 0);
assert.strictEqual(entries.length, 11);

const byPiece = new Map();
for (const entry of entries) {
  const piece = entry[api.PENNYLANE_HEADERS[7]];
  const current = byPiece.get(piece) || { debit: 0, credit: 0 };
  current.debit += api.centsFromPennylane(entry[api.PENNYLANE_HEADERS[9]]);
  current.credit += api.centsFromPennylane(entry[api.PENNYLANE_HEADERS[10]]);
  byPiece.set(piece, current);
}
for (const [piece, totals] of byPiece) {
  assert.strictEqual(totals.debit, totals.credit, piece);
}

const invalid = [{ source: 'Amazon', date: '', reference: '407-3', payment: 'Amazon', vatRate: 20, ht: 10, vat: 2, ttc: 12 }];
assert(api.validateSourceRowsForPennylane(invalid).some((issue) => issue.includes('date')));

console.log('Pennylane smoke tests OK');
