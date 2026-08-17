const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync('app.js', 'utf8') + `
globalThis.__testApi = {
  PENNYLANE_HEADERS,
  normalizeAmazonDateRobust,
  parseAmazonCsv,
  buildPennylaneEntriesForTransaction,
  buildPennylanePieceNumber,
  getPennylaneSettings,
  resetPennylaneSettings,
  validatePennylaneSettings,
  validateSourceRowsForPennylane,
  validatePennylaneEntries,
  centsFromPennylane
};`;

const elements = {
  periodStart: { value: '2026-07-01' },
  periodEnd: { value: '2026-07-31' },
  pennylaneJournalCode: { value: 'VT', addEventListener() {} },
  pennylaneClientAccount: { value: '411000', addEventListener() {} },
  pennylaneSalesAccount: { value: '707000', addEventListener() {} },
  pennylaneVatAccount: { value: '445710', addEventListener() {} },
  pennylaneResetButton: { addEventListener() {} }
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
  localStorage: { store: {}, getItem(key) { return this.store[key] || null; }, setItem(key, value) { this.store[key] = String(value); } },
  confirm() { return true; },
  alert(message) { throw new Error(message); }
};
context.globalThis = context;

vm.runInNewContext(code, context, { filename: 'app.js' });
const api = context.__testApi;

assert.strictEqual(api.normalizeAmazonDateRobust('2 juillet 2026 13:22:36 UTC'), '2026-07-02');
assert.strictEqual(api.normalizeAmazonDateRobust('1 juil. 2026 08:31:35 UTC'), '2026-07-01');
assert.strictEqual(api.normalizeAmazonDateRobust('5 janv. 2026 08:31:35 UTC'), '2026-01-05');
assert.strictEqual(api.normalizeAmazonDateRobust('Jul 2, 2026 13:22:36 UTC'), '2026-07-02');
assert.strictEqual(api.normalizeAmazonDateRobust('02/07/2026'), '2026-07-02');
assert.strictEqual(api.normalizeAmazonDateRobust('2026-07-02T13:22:36Z'), '2026-07-02');

const amazonCsvFixture = [
  '"date/heure","numéro de versement","type","numéro de la commande","sku","description","quantité","Marketplace","traitement","ville d\'où provient la commande","Région d\'où provient la commande","code postal de la commande","Modèle de perception des taxes","ventes de produits","Taxes sur la vente des produits","crédits d\'expédition","taxe sur les crédits d’expédition","crédits sur l\'emballage cadeau","Taxes sur les crédits cadeaux","Rabais promotionnels","Taxes sur les remises promotionnelles","Taxes retenues sur le site de vente","frais de vente","Frais Expédié par Amazon","autres frais de transaction","autre","total","Statut de la transaction","Date de sortie de la transaction"',
  '"1 juil. 2026 08:31:35 UTC","27486555222","Commande","171-9706558-5939530","SKU","Produit test","1","amazon.fr","Vendeur","Paris","","75000","","6,58","1,32","0","0","0","0","0","0","0","-0,75","0","-0,02","0","7,13","Sorti","10 juil. 2026 20:51:27 UTC"'
].join('\n');
const amazonFixtureRows = api.parseAmazonCsv(amazonCsvFixture);
assert.strictEqual(amazonFixtureRows.length, 1);
assert.strictEqual(amazonFixtureRows[0].reference, '171-9706558-5939530');
assert.strictEqual(amazonFixtureRows[0].date, '2026-07-01');

const sampleRows = [
  { source: 'Amazon', date: '2026-07-02', reference: '407-1', payment: 'Amazon', vatRate: 20, ht: 100, vat: 20, ttc: 120 },
  { source: 'Amazon - Remboursement', date: '2026-07-03', reference: '407-1', payment: 'Remboursement Amazon', vatRate: 20, ht: -10, vat: -2, ttc: -12 },
  { source: 'Oriental Discount - Avoir', date: '2026-07-04', reference: 'AV0001', payment: 'PayPal', vatRate: 20, ht: -30, vat: -6, ttc: -36 },
  { source: 'Oriental Discount', date: '2026-07-05', reference: 'FA0001', payment: 'PayPal', vatRate: 0, ht: 44.02, vat: 0, ttc: 44.02 },
  { source: 'Henne Discount', date: '2026-07-06', reference: 'FAH001', payment: 'CB', vatRate: 20, ht: 10, vat: 2, ttc: 12 },
  { source: 'eBay', date: '2026-07-07', reference: 'EB001', payment: 'eBay', vatRate: 20, ht: 20, vat: 4, ttc: 24 }
];

assert.strictEqual(api.validateSourceRowsForPennylane(sampleRows).length, 0);

const issues = [];
const customSettings = { journalCode: 'VTE', clientAccount: '411999', salesAccount: '707999', vatAccount: '445799' };
const entries = sampleRows.flatMap((row, index) => api.buildPennylaneEntriesForTransaction(row, index + 1, false, issues, customSettings));
assert.strictEqual(issues.length, 0);
assert.strictEqual(api.validatePennylaneEntries(entries).length, 0);
assert.strictEqual(entries.length, 17);
assert(entries.every((entry) => entry[api.PENNYLANE_HEADERS[1]] === 'VTE'));
assert(entries.some((entry) => entry[api.PENNYLANE_HEADERS[2]] === '707999'));
assert(entries.some((entry) => entry[api.PENNYLANE_HEADERS[2]] === '445799'));
assert(entries.every((entry) => entry[api.PENNYLANE_HEADERS[11]] === 'Canal de vente'));
assert(entries.every((entry) => entry[api.PENNYLANE_HEADERS[13]] === ''));
assert(entries.some((entry) => entry[api.PENNYLANE_HEADERS[8]] === 'RBS-407-1-20260703'));
assert(entries.some((entry) => entry[api.PENNYLANE_HEADERS[7]].includes('commande 407-1')));
assert(!entries.some((entry) => entry[api.PENNYLANE_HEADERS[8]] === '407-1' && /Remboursements/.test(entry[api.PENNYLANE_HEADERS[7]])));

const categories = new Map(entries.map((entry) => [entry[api.PENNYLANE_HEADERS[7]], entry[api.PENNYLANE_HEADERS[12]]]));
assert([...categories.values()].includes('Amazon'));
assert([...categories.values()].includes('Oriental Discount'));
assert([...categories.values()].includes('Henne Discount'));
assert([...categories.values()].includes('eBay'));
assert.strictEqual(api.buildPennylanePieceNumber(sampleRows[1], sampleRows[1].reference), 'RBS-407-1-20260703');

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

elements.pennylaneSalesAccount.value = '707123';
assert.strictEqual(api.getPennylaneSettings().salesAccount, '707123');
elements.pennylaneJournalCode.value = '';
assert(api.validatePennylaneSettings(api.getPennylaneSettings()).some((issue) => issue.includes('Code journal')));
api.resetPennylaneSettings();
assert.strictEqual(api.getPennylaneSettings().journalCode, 'VT');
assert.strictEqual(api.getPennylaneSettings().clientAccount, '411000');
assert.strictEqual(api.getPennylaneSettings().salesAccount, '707000');
assert.strictEqual(api.getPennylaneSettings().vatAccount, '445710');

console.log('Pennylane smoke tests OK');
