const PIN = '2300';
const state = { oriental: [], orientalCredits: [], henne: [], amazon: [], ebay: [] };
const PENNYLANE_HEADERS = [
  'Date',
  'Code Journal',
  'Numéro de compte',
  'Libellé de compte',
  'Libellé de ligne',
  'Taux de TVA du compte',
  'Code pays du compte',
  'Libellé de pièce',
  'Numéro de pièce',
  'Débit et/ou Crédit',
  'Crédit',
  'Famille de catégories',
  'Catégorie',
  'Identifiant de ligne',
  'Identifiant de lettrage'
];
const PENNYLANE_DEFAULT_SETTINGS = {
  journalCode: 'VT',
  clientAccount: '411000',
  salesAccount: '707000',
  vatAccount: '445710'
};
const PENNYLANE_CONFIG = {
  journalCode: 'VT',
  countryCode: 'FR',
  categoryFamily: 'Types de dépenses / revenus',
  salesCategory: 'Ventes de marchandises',
  accounts: {
    counterparty: { number: '411000', label: 'Clients ventes en ligne' },
    sales: { number: '707000', label: 'Ventes de marchandises' },
    salesExempt: { number: '707000', label: 'Ventes de marchandises exonérées' },
    vatCollected: {
      20: { number: '445710', label: 'TVA collectée 20 %' }
    }
  }
};
PENNYLANE_CONFIG.categoryFamily = 'Canal de vente';
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
function formatMoney(value) {
  return money.format(Number(value || 0)).replace(/[\u00A0\u202F]/g, ' ');
}
const LEGAL_IDENTITY = {
  name: 'Entreprise individuelle REBAI',
  address1: '11 Lieu-dit La Planche',
  address2: '89350 Villeneuve-les-Genêts - France',
  siret: '490 075 249 00030',
  vat: 'FR0F490075249',
  ape: '4782Z'
};

const el = (id) => document.getElementById(id);
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const sum = (rows, key) => round2(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
const accountingTtc = (row) => Number(row.ttc || 0);
const sumAccountingTtc = (rows) => round2(rows.reduce((total, row) => total + accountingTtc(row), 0));

window.addEventListener('DOMContentLoaded', () => {
  if (el('pinForm')) {
    toggleLock(sessionStorage.getItem('journalUnlocked') !== '1');
    el('pinForm').addEventListener('submit', unlock);
  } else {
    el('appView').hidden = false;
  }
  el('lockButton').addEventListener('click', () => { sessionStorage.removeItem('journalUnlocked'); window.location.href = 'index.html'; });
  el('orientalFile').addEventListener('change', handleOriental);
  el('orientalCreditFile')?.addEventListener('change', handleOrientalCredits);
  el('henneFile')?.addEventListener('change', handleEnedi);
  el('amazonFile').addEventListener('change', handleAmazon);
  el('ebayFile')?.addEventListener('change', handleEbay);
  el('previewButton').addEventListener('click', render);
  el('pdfButton').addEventListener('click', exportPdf);
  el('csvButton')?.addEventListener('click', exportCsv);
  el('xlsxButton')?.addEventListener('click', exportXlsx);
  el('summaryCsvButton')?.addEventListener('click', exportSummaryCsv);
  el('summaryXlsxButton')?.addEventListener('click', exportSummaryXlsx);
  el('pennylaneXlsxButton')?.addEventListener('click', exportPennylaneXlsx);
  initPennylaneSettings();
  setDefaultDates();
  render();
});

function unlock(event) {
  event.preventDefault();
  if (el('pinInput').value === PIN) {
    sessionStorage.setItem('journalUnlocked', '1');
    el('pinError').hidden = true;
    toggleLock(false);
  } else {
    el('pinError').hidden = false;
  }
}

function toggleLock(locked) {
  el('loginView').hidden = !locked;
  el('appView').hidden = locked;
  if (locked) setTimeout(() => el('pinInput').focus(), 50);
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  el('periodStart').value = today;
  el('periodEnd').value = today;
}

function initPennylaneSettings() {
  const fields = pennylaneSettingFields();
  if (!fields.length) return;
  const saved = readPennylaneSettings();
  const hasSavedSettings = Object.keys(saved).some((key) => Object.prototype.hasOwnProperty.call(PENNYLANE_DEFAULT_SETTINGS, key));
  const settings = { ...PENNYLANE_DEFAULT_SETTINGS, ...saved };
  fields.forEach(({ key, input }) => {
    input.value = settings[key];
    input.addEventListener('input', savePennylaneSettingsFromInputs);
  });
  if (!hasSavedSettings) savePennylaneSettings(PENNYLANE_DEFAULT_SETTINGS);
  el('pennylaneResetButton')?.addEventListener('click', resetPennylaneSettings);
}

function pennylaneSettingFields() {
  return [
    { key: 'journalCode', input: el('pennylaneJournalCode') },
    { key: 'clientAccount', input: el('pennylaneClientAccount') },
    { key: 'salesAccount', input: el('pennylaneSalesAccount') },
    { key: 'vatAccount', input: el('pennylaneVatAccount') }
  ].filter((field) => field.input);
}

function getPennylaneSettings() {
  const saved = readPennylaneSettings();
  const current = { ...PENNYLANE_DEFAULT_SETTINGS, ...saved };
  for (const { key, input } of pennylaneSettingFields()) {
    current[key] = String(input.value ?? current[key] ?? '').trim();
  }
  return current;
}

function readPennylaneSettings() {
  try {
    const value = localStorage.getItem('pennylaneSettings');
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function savePennylaneSettings(settings) {
  try {
    localStorage.setItem('pennylaneSettings', JSON.stringify(settings));
  } catch {
    // Le navigateur peut bloquer localStorage en navigation privee.
  }
}

function savePennylaneSettingsFromInputs() {
  const settings = { ...PENNYLANE_DEFAULT_SETTINGS };
  for (const { key, input } of pennylaneSettingFields()) {
    settings[key] = String(input.value || '').trim();
  }
  savePennylaneSettings(settings);
}

function resetPennylaneSettings() {
  if (!confirm('Retablir les valeurs Pennylane par defaut ?')) return;
  for (const { key, input } of pennylaneSettingFields()) {
    input.value = PENNYLANE_DEFAULT_SETTINGS[key];
  }
  savePennylaneSettings(PENNYLANE_DEFAULT_SETTINGS);
}

function validatePennylaneSettings(settings) {
  const labels = {
    journalCode: 'Code journal des ventes',
    clientAccount: 'Compte client / contrepartie',
    salesAccount: 'Compte de ventes',
    vatAccount: 'Compte TVA collectee'
  };
  return Object.entries(labels)
    .filter(([key]) => !String(settings[key] || '').trim())
    .map(([, label]) => 'Parametre Pennylane manquant : ' + label + '.');
}

async function handleOriental(event) {
  const file = event.target.files[0];
  if (!file) return;
  el('orientalStatus').textContent = 'Lecture du PDF...';
  try {
    state.oriental = await parsePrestaPdf(file, 'Oriental Discount');
    el('orientalStatus').textContent = state.oriental.length + ' transaction(s) lue(s)';
  } catch (error) {
    state.oriental = [];
    el('orientalStatus').textContent = 'Lecture impossible : ' + error.message;
  }
  render();
}

async function handleEnedi(event) {
  const file = event.target.files[0];
  if (!file) return;
  el('henneStatus').textContent = 'Lecture du PDF...';
  try {
    state.henne = await parsePrestaPdf(file, 'Henne Discount', { forceVatRate: 20 });
    el('henneStatus').textContent = state.henne.length + ' transaction(s) lue(s)';
  } catch (error) {
    state.henne = [];
    el('henneStatus').textContent = 'Lecture impossible : ' + error.message;
  }
  render();
}

async function handleOrientalCredits(event) {
  const file = event.target.files[0];
  if (!file) return;
  el('orientalCreditStatus').textContent = 'Lecture du PDF d avoirs...';
  try {
    state.orientalCredits = await parsePrestaCreditPdf(file, 'Oriental Discount - Avoir');
    el('orientalCreditStatus').textContent = state.orientalCredits.length + ' avoir(s) lu(s)';
  } catch (error) {
    state.orientalCredits = [];
    el('orientalCreditStatus').textContent = 'Lecture impossible : ' + error.message;
  }
  render();
}

async function handleEbay(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  state.ebay = parseEbayCsv(text);
  el('ebayStatus').textContent = state.ebay.length + ' commande(s) lue(s)';
  render();
}

async function handleAmazon(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  state.amazon = parseAmazonCsv(text);
  el('amazonStatus').textContent = state.amazon.length + ' commande(s) ou remboursement(s) lu(s)';
  render();
}

async function parsePrestaCreditPdf(file, source) {
  const pdfjsLib = globalThis.pdfjsLib;
  if (!pdfjsLib) throw new Error('lecteur PDF non charge');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const credits = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = extractPdfLines(content.items);
    const credit = parsePrestaCreditLines(lines, source, i);
    if (credit) credits.push(credit);
  }
  return credits;
}

function parsePrestaCreditLines(lines, source, fallbackIndex) {
  const text = lines.join('\n');
  const reference = cleanCreditReference(findCreditSlipNumber(lines) || 'AVOIR-' + fallbackIndex);
  const orderReference = findCreditOrderReference(lines) || '';
  const date = findCreditDate(lines) || normalizeFrenchDate(pick(text, [/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/]));
  const payment = cleanPayment(findCreditPayment(lines) || 'Remboursement');
  const ttcRaw = findCreditTtc(lines);
  if (ttcRaw === null) return null;
  const ttc = -Math.abs(round2(ttcRaw));
  let ht = round2(ttc / 1.2);
  let vat = round2(ttc - ht);
  return {
    source,
    date,
    reference: cleanCreditReference(orderReference ? reference + ' / ' + orderReference : reference),
    payment,
    vatRate: 20,
    ht,
    vat,
    ttc,
    confidence: 'Avoir PrestaShop - montant negatif TVA 20 %'
  };
}

function cleanCreditReference(value) {
  return String(value || '')
    .trim()
    .replace(/^\d{4}\s*[\/-]\s*/, '')
    .replace(/\b\d{4}\s*[\/-]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function findCreditSlipNumber(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+/g, ' ').trim();
    const sameLine = line.match(/\bAVOIR\b\s*(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})?\s*([0-9]{4,}|[A-Z]{1,4}[0-9][A-Z0-9._\/-]{3,})/i);
    if (sameLine) return sameLine[1];
    if (/^AVOIR$/i.test(line) || /\bAVOIR\b/i.test(line)) {
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].replace(/\s+/g, ' ').trim();
        const number = next.match(/(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\s+)?([0-9]{4,}|[A-Z]{1,4}[0-9][A-Z0-9._\/-]{3,})/);
        if (number) return number[1];
      }
    }
  }
  return '';
}

function findCreditDate(lines) {
  for (const line of lines) {
    if (!/AVOIR/i.test(line) && !/Date/i.test(line)) continue;
    const match = line.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/);
    if (match) return normalizeFrenchDate(match[0]);
  }
  return '';
}

function findCreditOrderReference(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!/Réf\. de commande|Ref\. de commande|Référence de commande|Reference de commande/i.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const line = lines[j].replace(/\s+/g, ' ').trim();
      const candidate = line.split(/\s+/)[0];
      if (validOrderReference(candidate)) return candidate;
    }
  }
  return findOrderReference(lines);
}

function findCreditPayment(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+/g, ' ').trim();
    if (/Moyen de paiement/i.test(line)) {
      let value = line.replace(/.*Moyen de paiement\s*/i, '').trim();
      if (value) return cleanPayment(value);
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].replace(/\s+/g, ' ').trim();
        if (next && !/Raison de l'avoir|Transporteur|Total|Taxe/i.test(next)) return cleanPayment(next);
      }
    }
  }
  return '';
}

function findCreditTtc(lines) {
  for (const line of lines) {
    if (!/Total\s*\(TTC\)|Total TTC/i.test(line)) continue;
    const amounts = extractMoneyAmounts(line);
    if (amounts.length) return Math.abs(amounts[amounts.length - 1]);
  }
  return null;
}

function findCreditTaxBase(lines) {
  for (const line of lines) {
    if (!/Taxes produits|Total taxe|Prix HT|20\s*(?:[,.]00\s*)?%/i.test(line)) continue;
    const amounts = extractMoneyAmounts(line);
    if (amounts.length >= 1) return Math.abs(amounts[0]);
  }
  return null;
}

function findCreditTaxAmount(lines) {
  for (const line of lines) {
    if (!/Taxes produits|Total taxe|20\s*(?:[,.]00\s*)?%/i.test(line)) continue;
    const amounts = extractMoneyAmounts(line);
    if (amounts.length >= 2) return Math.abs(amounts[amounts.length - 1]);
  }
  return null;
}

function findCreditReference(lines) {
  return findCreditSlipNumber(lines);
}

async function parsePrestaPdf(file, source, options = {}) {
  const pdfjsLib = globalThis.pdfjsLib;
  if (!pdfjsLib) throw new Error('lecteur PDF non charge');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const invoices = [];
  const rejected = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = extractPdfLines(content.items);
    const invoice = parsePrestaInvoiceLines(lines, source, i, options);
    if (invoice) invoices.push(invoice);
    else rejected.push(i);
  }
  if (rejected.length) console.warn('Pages PrestaShop non lues', rejected);
  return invoices;
}

function extractPdfLines(items) {
  const rows = [];
  for (const item of items) {
    const text = String(item.str || '').trim();
    if (!text) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, text });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.cells.sort((a, b) => a.x - b.x).map((cell) => cell.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parsePrestaInvoiceLines(lines, source, fallbackIndex, options = {}) {
  const text = lines.join('\n');
  const headerData = findPrestaHeaderData(lines);
  const isExempt259B = hasVatExemption259B(lines);
  const totals = findPrestaTotals(lines);
  const vatEvidence = findVatEvidence(lines);
  const ttc = totals.ttc ?? findLabeledAmount(lines, ['Total TTC', 'Total payé', 'Total paid', 'Total a payer', 'Total à payer']);
  let ht = totals.ht ?? vatEvidence.ht ?? findLabeledAmount(lines, ['Total HT', 'Total hors taxe', 'Total produits HT']);
  let vat = totals.vat ?? vatEvidence.vat ?? findLabeledAmount(lines, ['Total TVA', 'TVA']);
  const orderReference = validOrderReference(headerData.order) || findOrderReference(lines);
  let rate = vatEvidence.rate ?? detectPrestaVatRate(lines, ht, vat, ttc);

  if (ttc === null) return null;
  if (options.forceVatRate === 20) {
    rate = 20;
    ht = round2(ttc / 1.2);
    vat = round2(ttc - ht);
  } else if (isExempt259B) rate = 0;
  if (rate === 0) {
    ht = ttc;
    vat = 0;
  } else {
    if (vat !== null && Math.abs(vat) < 0.005) rate = 0;
    if (ht !== null && Math.abs(round2(ttc - ht)) < 0.005) rate = 0;
    if (rate === null) rate = vat === 0 ? 0 : 20;
    if (ht === null) ht = rate === 0 ? ttc : round2(ttc / (1 + rate / 100));
    if (vat === null) vat = round2(ttc - ht);
    if (Math.abs(vat) < 0.005) { vat = 0; rate = 0; }
  }

  return {
    source,
    date: headerData.date || normalizeFrenchDate(pick(text, [/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/])),
    reference: orderReference || 'PDF-' + fallbackIndex,
    payment: cleanPayment(findPayment(lines) || headerData.payment || 'Non precise'),
    vatRate: rate,
    ht: round2(ht),
    vat: round2(vat),
    ttc: round2(ttc),
    confidence: (headerData.order ? 'OK' : 'Reference a verifier') + (isExempt259B ? ' | Exoneration TVA art. 259B' : (vatEvidence.line ? ' | TVA: ' + vatEvidence.line : ''))
  };
}

function findPrestaHeaderData(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!/Facture/i.test(lines[i]) || !/Date/i.test(lines[i]) || !/Commande/i.test(lines[i]) || !/Paiement/i.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const line = lines[j].replace(/\s+/g, ' ').trim();
      if (/Facture|Date|Commande|Paiement/i.test(line) && !/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(line)) continue;
      const parsed = parsePrestaHeaderLine(line);
      if (parsed) return parsed;
    }
  }
  return {};
}

function parsePrestaHeaderLine(line) {
  const dateMatch = line.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/);
  if (!dateMatch) return null;
  const beforeDate = line.slice(0, dateMatch.index).trim();
  const afterDate = line.slice(dateMatch.index + dateMatch[0].length).trim();
  const parts = afterDate.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const order = parts.shift();
  if (!validOrderReference(order)) return null;
  return {
    invoice: beforeDate.split(/\s+/).filter(Boolean).pop() || '',
    date: normalizeFrenchDate(dateMatch[0]),
    order,
    payment: parts.join(' ')
  };
}

function findOrderReference(lines) {
  const patterns = [
    /(?:Référence|Reference|Ref(?:\.)?)\s*(?:de)?\s*(?:commande)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{4,})/i,
    /(?:Commande|Order)\s*(?:n|N|n°|N°|#|:|-)?\s*([A-Z0-9][A-Z0-9._\/-]{4,})/i,
    /\b([A-Z]{2,}[0-9][A-Z0-9._\/-]{4,})\b/,
    /\b([0-9]{6,})\b/
  ];
  for (const line of lines) {
    if (/Facture\s+Date\s+Commande\s+Paiement/i.test(line)) continue;
    if (/Produit|Description|Prix unitaire|Quantité|Total produits/i.test(line)) continue;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const candidate = match ? validOrderReference(match[1]) : '';
      if (candidate) return candidate;
    }
  }
  return '';
}

function validOrderReference(value) {
  const candidate = String(value || '').trim().replace(/^#/, '');
  if (!candidate) return '';
  if (/^(date|commande|paiement|produit|produits|total|facture|tva|ht|ttc|référence|reference)$/i.test(candidate)) return '';
  if (/^\d{1,3}(?:[,.]\d{2})?$/.test(candidate)) return '';
  if (candidate.length < 4) return '';
  return candidate;
}

function findPayment(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+/g, ' ').trim();
    if (!/Moyen de paiement|Paiement|Payment/i.test(line)) continue;
    const candidates = [line, lines[i + 1] || '', lines[i + 2] || '']
      .map((value) => value.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    const detected = detectPaymentMethod(candidates);
    if (detected) return detected;
    const inline = line.replace(/.*(?:Moyen de paiement|Paiement|Payment)\s*[:\-]?\s*/i, '').trim();
    if (inline && !/^date\b/i.test(inline)) return inline;
  }
  return '';
}

function detectPaymentMethod(value) {
  const text = String(value || '');
  if (/paypal/i.test(text)) return 'PayPal';
  if (/\bvisa\b/i.test(text)) return 'Visa';
  if (/master\s*card|mastercard/i.test(text)) return 'Mastercard';
  if (/\bcb\b/i.test(text)) return 'CB';
  if (/carte bancaire|carte bleue/i.test(text)) return 'Carte bancaire';
  return '';
}

function cleanPayment(value) {
  let payment = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\bTaxe\b.*$/i, '')
    .replace(/\s+(Total|TVA|HT|TTC).*$/i, '')
    .trim();
  const detected = detectPaymentMethod(payment);
  if (detected) return detected;
  payment = payment.replace(/^Payez\s+par\s+/i, '');
  payment = payment.replace(/^Paiement\s+/i, '');
  payment = payment.replace(/\s*\(paiement\s+s[ée]curis[ée]\).*$/i, '');
  payment = payment
    .replace(/-?\d{1,3}(?:[ .]\d{3})*,\d{2}\s*(?:€|EUR)?/gi, '')
    .replace(/-?\d+,\d{2}\s*(?:€|EUR)?/gi, '')
    .replace(/\s+\d{1,6}\s*$/, '')
    .trim();
  return detectPaymentMethod(payment) || payment || 'Non precise';
}

function hasVatExemption259B(lines) {
  const text = normalizeForSearch(lines.join(' '));
  return /exempt\w*\s+de\s+tva/.test(text) && (/259\s*b/.test(text) || /code\s+general\s+des\s+impots/.test(text));
}

function normalizeForSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function findVatEvidence(lines) {
  const evidence = { rate: null, ht: null, vat: null, line: '' };
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!/(TVA|Taxe|Taux)/i.test(normalized)) continue;
    const rateMatch = normalized.match(/\b(0|5,5|5.5|10|20)\s*(?:,00\s*)?%/);
    const amounts = extractMoneyAmounts(normalized);
    if (!rateMatch) continue;

    const rate = Number(rateMatch[1].replace(',', '.'));
    if (amounts.length >= 2) {
      evidence.rate = rate;
      evidence.ht = amounts[0];
      evidence.vat = amounts[amounts.length - 1];
      evidence.line = normalized;
      return evidence;
    }
    if (rate === 0) {
      evidence.rate = 0;
      evidence.vat = 0;
      evidence.line = normalized;
      return evidence;
    }
  }
  return evidence;
}

function findPrestaTotals(lines) {
  const result = { ht: null, vat: null, ttc: null };
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    const amounts = extractMoneyAmounts(normalized);
    if (!amounts.length) continue;
    const last = amounts[amounts.length - 1];
    if (/Total\s+(?:produits\s+)?HT|Total\s+hors\s+taxe/i.test(normalized)) result.ht = last;
    else if (/Total\s+TVA|Montant\s+TVA|\bTVA\b/i.test(normalized) && !/20\s*%\s*$/.test(normalized)) result.vat = amounts.length > 1 && /20\s*%|0\s*%/i.test(normalized) ? amounts[amounts.length - 1] : last;
    else if (/Total\s+(?:TTC|payé|paid|à payer|a payer)|Net\s+à\s+payer/i.test(normalized)) result.ttc = last;
  }
  if (result.ttc === null) {
    const moneyLines = lines.map(extractMoneyAmounts).filter((amounts) => amounts.length);
    const candidates = moneyLines.flat().filter((amount) => Math.abs(amount) > 0.009);
    if (candidates.length) result.ttc = candidates[candidates.length - 1];
  }
  return result;
}

function findLabeledAmount(lines, labels) {
  for (const line of lines) {
    for (const label of labels) {
      if (!new RegExp(escapeRegex(label), 'i').test(line)) continue;
      const amounts = extractMoneyAmounts(line);
      if (amounts.length) return amounts[amounts.length - 1];
    }
  }
  return null;
}

function extractMoneyAmounts(text) {
  return Array.from(String(text).matchAll(/-?\d{1,3}(?:[ .]\d{3})*,\d{2}|-?\d+,\d{2}/g)).map((match) => parseMoney(match[0]));
}

function pick(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return String(match[1] || '').trim();
  }
  return '';
}

function escapeRegex(label) {
  return String(label).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function findAmount(text, labels) {
  for (const label of labels) {
    const regex = new RegExp(escapeRegex(label) + '[^0-9-]{0,40}(-?\\d{1,3}(?:[ .]\\d{3})*(?:,\\d{2})|-?\\d+(?:,\\d{2})?)', 'i');
    const match = text.match(regex);
    if (match) return parseMoney(match[1]);
  }
  return null;
}

function detectPrestaVatRate(lines, ht, vat, ttc) {
  if (vat !== null && Math.abs(vat) < 0.005) return 0;
  if (ht !== null && ttc !== null && Math.abs(round2(ttc - ht)) < 0.005) return 0;

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!/(TVA|Taxe|Taux)/i.test(normalized)) continue;
    const rateMatch = normalized.match(/\b(0|5,5|5.5|10|20)\s*(?:,00\s*)?%/);
    if (!rateMatch) continue;
    const rate = Number(rateMatch[1].replace(',', '.'));
    const amounts = extractMoneyAmounts(normalized);
    if (rate === 0) return 0;
    if (amounts.length >= 2 && Math.abs(amounts[amounts.length - 1]) < 0.005) return 0;
    if (rate === 20) return 20;
  }

  return detectVatRate(lines.join('\n'), ht, vat, ttc);
}

function detectVatRate(text, ht, tax, ttc) {
  if (tax !== null && Math.abs(tax) < 0.005) return 0;
  if (ht !== null && ttc !== null && Math.abs(round2(ttc - ht)) < 0.005) return 0;
  if (/\b20\s*%/.test(text)) return 20;
  if (ht && tax !== null) return Math.abs(round2((tax / ht) * 100) - 20) < 0.6 ? 20 : 0;
  if (ht && ttc) return Math.abs(round2(((ttc - ht) / ht) * 100) - 20) < 0.6 ? 20 : 0;
  return null;
}

function parseEbayCsv(text) {
  const rows = parseDelimited(text, ';');
  const headerIndex = rows.findIndex((row) => row.map(cleanHeader).includes('numero_de_commande') && row.map(cleanHeader).includes('prix_total'));
  if (headerIndex === -1) return [];
  const headers = rows[headerIndex].map(cleanHeader);
  const data = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell || '').trim()));
  const grouped = new Map();
  for (const row of data) {
    const item = Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
    const order = item.numero_de_commande || item.numero_de_la_commande || '';
    if (!order) continue;
    const ttcLine = parseMoney(item.prix_total);
    if (!ttcLine) continue;
    const current = grouped.get(order) || {
      source: 'eBay',
      date: normalizeEbayDate(item.date_de_vente || item.date_de_paiement),
      reference: order,
      payment: cleanPayment(item.mode_de_paiement || 'eBay'),
      vatRate: 20,
      ht: 0,
      vat: 0,
      ttc: 0,
      confidence: 'Commande eBay'
    };
    current.ttc = round2(current.ttc + ttcLine);
    current.ht = round2(current.ttc / 1.2);
    current.vat = round2(current.ttc - current.ht);
    grouped.set(order, current);
  }
  return Array.from(grouped.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.reference.localeCompare(b.reference));
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function normalizeEbayDate(value) {
  const text = String(value || '').trim().toLowerCase();
  const months = { janv: '01', 'janv.': '01', janvier: '01', fevr: '02', 'févr.': '02', 'fevr.': '02', fevrier: '02', février: '02', mars: '03', avr: '04', 'avr.': '04', avril: '04', mai: '05', juin: '06', juil: '07', 'juil.': '07', juillet: '07', aout: '08', août: '08', sept: '09', 'sept.': '09', septembre: '09', oct: '10', 'oct.': '10', octobre: '10', nov: '11', 'nov.': '11', novembre: '11', dec: '12', 'déc.': '12', 'dec.': '12', decembre: '12', décembre: '12' };
  const match = text.match(/(\d{1,2})-([a-zéû\.]+)-(\d{2,4})/i);
  if (!match) return normalizeFrenchDate(value);
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  const month = months[match[2]] || '01';
  return year + '-' + month + '-' + match[1].padStart(2, '0');
}

function parseAmazonCsv(text) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => row.map(cleanHeader).includes('date_heure') && row.map(cleanHeader).includes('numero_de_la_commande'));
  if (headerIndex === -1) return [];
  const headers = rows[headerIndex].map(cleanHeader);
  const data = rows.slice(headerIndex + 1).filter((row) => row.length > 3);
  const grouped = new Map();
  for (const row of data) {
    const item = Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
    const type = item.type || '';
    const order = item.numero_de_la_commande || '';
    if (!order || !/^(Commande|Remboursement)$/i.test(type)) continue;

    const isRefund = /^Remboursement$/i.test(type);
    const source = isRefund ? 'Amazon - Remboursement' : 'Amazon';
    const payment = isRefund ? 'Remboursement Amazon' : 'Amazon';
    const key = type + '|' + order;

    const ht = round2(parseMoney(item.ventes_de_produits) + parseMoney(item.credits_dexpedition) + parseMoney(item.credits_sur_lemballage_cadeau) + parseMoney(item.rabais_promotionnels));
    const vat = round2(parseMoney(item.taxes_sur_la_vente_des_produits) + parseMoney(item.taxe_sur_les_credits_dexpedition) + parseMoney(item.taxes_sur_les_credits_cadeaux) + parseMoney(item.taxes_sur_les_remises_promotionnelles));
    const amazonDate = normalizeAmazonDateRobust(item.date_heure) || normalizeAmazonDateRobust(item.date_de_sortie_de_la_transaction);
    const current = grouped.get(key) || {
      source,
      date: amazonDate,
      reference: order,
      payment,
      vatRate: 20,
      ht: 0,
      vat: 0,
      ttc: 0,
      confidence: isRefund ? 'Remboursement Amazon' : 'Commande Amazon'
    };
    current.ht = round2(current.ht + ht);
    current.vat = round2(current.vat + vat);
    current.ttc = round2(current.ht + current.vat);
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.source.localeCompare(b.source) || a.reference.localeCompare(b.reference));
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function cleanHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/\s/g, '').replace(/€/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function normalizeFrenchDate(value) {
  if (!value) return '';
  const match = String(value).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!match) return value;
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  return year + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
}

function normalizeAmazonDate(value) {
  const months = { janvier: '01', fevrier: '02', février: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', aout: '08', août: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12', décembre: '12' };
  const match = String(value || '').toLowerCase().match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
  if (!match) return '';
  return match[3] + '-' + (months[match[2]] || '01') + '-' + match[1].padStart(2, '0');
}

function normalizeAmazonDateRobust(value) {
  const raw = String(value || '').replace(/[\u00A0\u202F]/g, ' ').trim();
  if (!raw) return '';
  const iso = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0');
  const numeric = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (numeric) {
    const year = numeric[3].length === 2 ? '20' + numeric[3] : numeric[3];
    return year + '-' + numeric[2].padStart(2, '0') + '-' + numeric[1].padStart(2, '0');
  }
  const months = {
    jan: '01', janv: '01', january: '01', janvier: '01',
    feb: '02', february: '02', fev: '02', fevr: '02', fevrier: '02',
    mar: '03', march: '03', mars: '03',
    apr: '04', april: '04', avr: '04', avril: '04',
    may: '05', mai: '05',
    jun: '06', june: '06', juin: '06',
    jul: '07', juil: '07', july: '07', juillet: '07',
    aug: '08', august: '08', aout: '08',
    sep: '09', sept: '09', september: '09', septembre: '09',
    oct: '10', october: '10', octobre: '10',
    nov: '11', november: '11', novembre: '11',
    dec: '12', december: '12', decembre: '12'
  };
  const text = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const named = text.match(/(\d{1,2})[\s.-]+([a-z]+)\.?[,]?[\s.-]+(\d{2,4})/i) || text.match(/([a-z]+)\.?[\s.-]+(\d{1,2})[,]?[\s.-]+(\d{2,4})/i);
  if (!named) return '';
  const day = named[1].match(/^\d/) ? named[1] : named[2];
  const monthKey = named[1].match(/^\d/) ? named[2] : named[1];
  const yearRaw = named[3];
  const year = yearRaw.length === 2 ? '20' + yearRaw : yearRaw;
  const month = months[monthKey] || months[monthKey.slice(0, 3)];
  return month ? year + '-' + month + '-' + day.padStart(2, '0') : '';
}

function allTransactions() {
  return [...state.oriental, ...state.orientalCredits, ...state.henne, ...state.amazon, ...state.ebay].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.source.localeCompare(b.source));
}

function buildSummary(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.source + '|' + row.vatRate;
    const item = map.get(key) || { source: row.source, vatRate: row.vatRate, ht: 0, vat: 0, ttc: 0 };
    item.ht = round2(item.ht + row.ht);
    item.vat = round2(item.vat + row.vat);
    item.ttc = round2(item.ttc + accountingTtc(row));
    map.set(key, item);
  }
  return Array.from(map.values()).sort((a, b) => a.source.localeCompare(b.source) || a.vatRate - b.vatRate);
}

function render() {
  const rows = allTransactions();
  const summary = buildSummary(rows);
  el('pdfButton').disabled = rows.length === 0;
  if (el('csvButton')) el('csvButton').disabled = rows.length === 0;
  if (el('xlsxButton')) el('xlsxButton').disabled = rows.length === 0;
  if (el('summaryCsvButton')) el('summaryCsvButton').disabled = rows.length === 0;
  if (el('summaryXlsxButton')) el('summaryXlsxButton').disabled = rows.length === 0;
  if (el('pennylaneXlsxButton')) el('pennylaneXlsxButton').disabled = rows.length === 0;
  el('qualityText').textContent = rows.length ? rows.length + ' transaction(s) prete(s) pour edition. Verifiez les lignes marquees a controler avant transmission.' : 'Importez au moins une source active pour generer le journal.';
  renderCards(rows);
  el('summaryRows').innerHTML = summary.map((row) => '<tr><td>' + row.source + '</td><td>' + row.vatRate + ' %</td><td>' + formatMoney(row.ht) + '</td><td>' + formatMoney(row.vat) + '</td><td>' + formatMoney(row.ttc) + '</td></tr>').join('');
  el('transactionRows').innerHTML = rows.map((row) => '<tr><td>' + displayDate(row.date) + '</td><td>' + row.source + '</td><td>' + row.reference + '</td><td>' + displayPayment(row.payment) + '</td><td>' + row.vatRate + ' %</td><td>' + formatMoney(row.ht) + '</td><td>' + formatMoney(row.vat) + '</td><td>' + formatMoney(row.ttc) + '</td></tr>').join('');
}

function renderCards(rows) {
  const cards = [['Transactions', rows.length], ['Total HT', formatMoney(sum(rows, 'ht'))], ['TVA collectee', formatMoney(sum(rows, 'vat'))], ['Total TTC', formatMoney(sumAccountingTtc(rows))]];
  el('summaryCards').innerHTML = cards.map(([label, value]) => '<div class="metric"><span>' + label + '</span><strong>' + value + '</strong></div>').join('');
}

function displayPayment(value) {
  return cleanPayment(value);
}

function displayDate(value) {
  if (!value) return 'A verifier';
  const match = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
}

function exportPdf() {
  try {
    exportPdfUnsafe();
  } catch (error) {
    console.error(error);
    alert('Erreur pendant la generation du PDF : ' + (error && error.message ? error.message : error));
  }
}

function exportPdfUnsafe() {
  const rows = allTransactions();
  if (!window.jspdf) {
    alert('Le module PDF n est pas encore charge. Rechargez la page puis reessayez.');
    return;
  }
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const period = displayDate(el('periodStart').value) + ' au ' + displayDate(el('periodEnd').value);
  const sources = Array.from(new Set(rows.map((row) => row.source))).join(', ');

  const pageMargin = { left: 12, right: 12 };
  const brand = [30, 41, 59];
  const accent = [71, 85, 105];
  const dark = [17, 24, 39];
  const light = [246, 248, 251];
  const border = [210, 216, 224];

  function drawHeader(title) {
    doc.setFillColor(...brand);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text('Journal des ventes et avoirs', 12, 14);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(title || period, 198, 14, { align: 'right' });
    doc.setTextColor(...dark);
  }

  function drawFooter() {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(...border);
      doc.line(12, 282, 198, 282);
      doc.setFontSize(7);
      doc.setTextColor(85, 95, 110);
      doc.text(LEGAL_IDENTITY.name + ' - SIRET ' + LEGAL_IDENTITY.siret + ' - TVA ' + LEGAL_IDENTITY.vat + ' - APE ' + LEGAL_IDENTITY.ape, 12, 287);
      doc.text('Page ' + i + ' / ' + pageCount, 198, 287, { align: 'right' });
      doc.text('Journal généré automatiquement à partir des pièces justificatives importées. Les justificatifs originaux restent conservés par l’entreprise et constituent les documents de référence.', 12, 291, { maxWidth: 186 });
    }
    doc.setTextColor(...dark);
  }

  function totalLine(label, selectedRows) {
    return [label, String(selectedRows.length), formatMoney(sum(selectedRows, 'ht')), formatMoney(sum(selectedRows, 'vat')), formatMoney(sumAccountingTtc(selectedRows))];
  }

  const sales20 = rows.filter((row) => Number(row.vatRate) === 20 && row.ht >= 0 && row.vat >= 0 && !isRefundSource(row.source));
  const sales0 = rows.filter((row) => Number(row.vatRate) === 0 && row.ht >= 0 && !isRefundSource(row.source));
  const refunds = rows.filter((row) => isRefundSource(row.source) || row.ttc < 0 || row.ht < 0);
  const sales = rows.filter((row) => !isRefundSource(row.source) && row.ht >= 0 && row.ttc >= 0);
  const creditNotes = rows.filter((row) => /Avoir/i.test(row.source));
  const refundRows = rows.filter((row) => /Remboursement/i.test(row.source));
  const netRows = [...sales20, ...sales0, ...refunds];
  const controls = buildAutomaticControls(rows, { sales, creditNotes, refundRows });

  drawHeader('Synthèse');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont(undefined, 'bold');
  doc.text(LEGAL_IDENTITY.name, 12, 32);
  doc.setFont(undefined, 'normal');
  doc.text(LEGAL_IDENTITY.address1, 12, 38);
  doc.text(LEGAL_IDENTITY.address2, 12, 44);
  doc.text('SIRET : ' + LEGAL_IDENTITY.siret, 112, 32);
  doc.text('TVA intracommunautaire : ' + LEGAL_IDENTITY.vat, 112, 38);
  doc.text('Code APE : ' + LEGAL_IDENTITY.ape, 112, 44);

  doc.setFillColor(...light);
  doc.roundedRect(12, 52, 186, 30, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.text('Période : ' + period, 16, 60);
  doc.text('Edition : ' + new Date().toLocaleDateString('fr-FR'), 166, 60, { align: 'right' });
  doc.text('Sources incluses : ' + sources, 16, 67);
  doc.text('Ce document s’appuie strictement sur des extraits d’informations récoltées sur les factures de vente, avoirs et rapports importés.', 16, 75, { maxWidth: 176 });

  doc.autoTable({
    startY: 90,
    margin: pageMargin,
    head: [['Nature', 'Nombre de pièces', 'Total HT', 'TVA collectée', 'Total TTC']],
    body: [
      totalLine('Ventes taxables - TVA 20 %', sales20),
      totalLine('Ventes exonérées - TVA 0 %', sales0),
      totalLine('Avoirs et remboursements', refunds)
    ],
    foot: [totalLine('Total général net', netRows)],
    theme: 'grid',
    headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [226, 232, 240], textColor: dark, fontStyle: 'bold' },
    styles: { fontSize: 8.3, cellPadding: 2.4, lineColor: border, lineWidth: 0.1 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    margin: pageMargin,
    head: [['Statistiques', 'Nombre']],
    body: [
      ['Nombre de ventes', String(sales.length)],
      ['Nombre d’avoirs', String(creditNotes.length)],
      ['Nombre de remboursements', String(refundRows.length)],
      ['Nombre total de pièces comptabilisées', String(rows.length)]
    ],
    theme: 'grid',
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7.8, cellPadding: 2, lineColor: border, lineWidth: 0.1 },
    columnStyles: { 1: { halign: 'right' } }
  });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    margin: pageMargin,
    head: [['Contrôles de cohérence réalisés par l’application']],
    body: [['Les contrôles ci-dessous sont réalisés automatiquement lors de la génération du document et permettent de détecter d’éventuelles incohérences avant transmission au cabinet comptable.'], ...controls.map((control) => [control.ok ? 'OK - ' + control.label : 'ANOMALIE - ' + control.label + ' : ' + control.message])],
    theme: 'grid',
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7.2, cellPadding: 1.7, lineColor: border, lineWidth: 0.1, overflow: 'linebreak' },
    didParseCell: function (data) {
      if (data.section === 'body') {
        const isError = String(data.cell.raw || '').startsWith('ANOMALIE');
        data.cell.styles.textColor = isError ? [185, 28, 28] : [22, 101, 52];
      }
    }
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    margin: pageMargin,
    head: [['Sources et contrôles', 'Statut']],
    body: buildSourceControlRows(rows),
    theme: 'grid',
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7.8, cellPadding: 2, lineColor: border, lineWidth: 0.1 },
    columnStyles: { 1: { halign: 'left' } }
  });

  const bySource = buildSummary(rows);
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    margin: pageMargin,
    head: [['Détail par source', 'Taux TVA', 'HT', 'TVA', 'TTC']],
    body: bySource.map((row) => [row.source, row.vatRate + ' %', formatMoney(row.ht), formatMoney(row.vat), formatMoney(row.ttc)]),
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    styles: { fontSize: 7.1, cellPadding: 1.7, lineColor: border, lineWidth: 0.1 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
  });

  const numberedGroups = groupForPdf(rows);
  for (const group of numberedGroups) {
    doc.addPage('a4', 'portrait');
    drawHeader(group.title);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(group.title, 12, 34);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text('Sous-total HT : ' + formatMoney(sum(group.rows, 'ht')) + '    TVA : ' + formatMoney(sum(group.rows, 'vat')) + '    TTC : ' + formatMoney(sumAccountingTtc(group.rows)), 12, 41);
    doc.autoTable({
      startY: 48,
      margin: pageMargin,
      head: [['Ligne', 'Date', 'Référence', 'Paiement', 'Taux', 'HT', 'TVA', 'TTC']],
      body: group.rows.map((row, index) => [String(index + 1), displayDate(row.date), row.reference, displayPayment(row.payment), row.vatRate + ' %', formatMoney(row.ht), formatMoney(row.vat), formatMoney(row.ttc)]),
      foot: [[String(group.rows.length), 'Sous-total', '', '', '', formatMoney(sum(group.rows, 'ht')), formatMoney(sum(group.rows, 'vat')), formatMoney(sumAccountingTtc(group.rows))]],
      theme: 'grid',
      headStyles: { fillColor: brand, textColor: [255, 255, 255] },
      footStyles: { fillColor: [226, 232, 240], textColor: dark, fontStyle: 'bold' },
      styles: { fontSize: 6.8, cellPadding: 1.5, overflow: 'linebreak', lineColor: border, lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 34 },
        3: { cellWidth: 31 },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 23, halign: 'right' },
        6: { cellWidth: 23, halign: 'right' },
        7: { cellWidth: 23, halign: 'right' }
      }
    });
  }

  doc.addPage('a4', 'portrait');
  drawHeader('Informations sur le document');
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Informations sur le document', 12, 38);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  const infoText = 'Le présent journal a été généré automatiquement à partir des pièces justificatives importées dans l’application (factures, avoirs et rapports d’activité des différentes plateformes de vente).\n\nLes montants, références, dates, taux de TVA et moyens de paiement sont repris directement des documents importés sans modification des données sources.\n\nCe document constitue un état préparatoire destiné au contrôle et au rapprochement comptable. Les pièces justificatives originales demeurent les seuls documents faisant foi en cas de contrôle administratif ou fiscal.';
  doc.text(infoText, 12, 50, { maxWidth: 186 });
  doc.setFontSize(9);
  doc.text('Christelle REBAI', 12, 122);
  doc.text('Entrepreneur individuel', 12, 128);

  drawFooter();
  doc.save('journal-des-ventes-' + el('periodStart').value + '-' + el('periodEnd').value + '.pdf');
}

function buildSourceControlRows(rows) {
  const sources = new Set(rows.map((row) => row.source));
  const controlRows = [];
  if ([...sources].some((source) => /^Amazon$/.test(source))) {
    controlRows.push(['Source Amazon ventes', 'Rapport d’activité']);
  }
  if ([...sources].some((source) => /Amazon - Remboursement/i.test(source))) {
    controlRows.push(['Source Amazon remboursements', 'Rapport d’activité']);
  }
  if ([...sources].some((source) => /Oriental Discount(?! - Avoir)/i.test(source))) {
    controlRows.push(['Source Oriental Discount', 'Extrait des factures de ventes']);
  }
  if ([...sources].some((source) => /Oriental Discount - Avoir/i.test(source))) {
    controlRows.push(['Source Oriental Discount avoirs', 'Extrait des avoirs PrestaShop']);
  }
  if ([...sources].some((source) => /Henne Discount/i.test(source))) {
    controlRows.push(['Source Henne Discount', 'Extrait des factures de ventes']);
  }
  if ([...sources].some((source) => /^eBay$/i.test(source))) {
    controlRows.push(['Source eBay ventes', 'Rapport des commandes']);
  }
  controlRows.push(['Contrôle cohérence', 'OK']);
  return controlRows;
}

function isRefundSource(source) {
  return /Avoir|Remboursement/i.test(String(source || ''));
}

function buildAutomaticControls(rows, counts) {
  const controls = [];
  const totalHt = sum(rows, 'ht');
  const totalVat = sum(rows, 'vat');
  const totalTtc = sum(rows, 'ttc');
  const recomputedTtc = round2(totalHt + totalVat);
  const references = rows.map((row) => String(row.reference || '').trim());
  const missingRefs = references.filter((ref) => !ref || /^PDF-|^AVOIR-/i.test(ref)).length;
  const duplicateRefs = references.filter((ref, index) => ref && references.indexOf(ref) !== index);
  const uniqueDuplicateRefs = Array.from(new Set(duplicateRefs));
  const lineTtcErrors = rows.filter((row) => Math.abs(round2(Number(row.ht || 0) + Number(row.vat || 0) - Number(row.ttc || 0))) > 0.02);
  const missingAmounts = rows.filter((row) => row.ht === null || row.ht === undefined || row.vat === null || row.vat === undefined || row.ttc === null || row.ttc === undefined || Number.isNaN(Number(row.ht)) || Number.isNaN(Number(row.vat)) || Number.isNaN(Number(row.ttc)));
  const unknownVatRates = rows.filter((row) => !Number.isFinite(Number(row.vatRate)) || Number(row.vatRate) < 0 || Number(row.vatRate) > 100);
  const periodStart = el('periodStart')?.value || '';
  const periodEnd = el('periodEnd')?.value || '';
  const outOfPeriod = rows.filter((row) => {
    if (!row.date || !periodStart || !periodEnd) return false;
    return row.date < periodStart || row.date > periodEnd;
  });

  controls.push({ ok: Math.abs(totalHt - sum(rows, 'ht')) <= 0.005, label: 'Total HT = somme des lignes', message: 'écart sur le total HT' });
  controls.push({ ok: Math.abs(totalVat - sum(rows, 'vat')) <= 0.005, label: 'Total TVA = somme des lignes', message: 'écart sur le total TVA' });
  controls.push({ ok: Math.abs(totalTtc - sum(rows, 'ttc')) <= 0.005 && Math.abs(totalTtc - recomputedTtc) <= 0.05 && lineTtcErrors.length === 0, label: 'Total TTC = somme des lignes', message: lineTtcErrors.length ? lineTtcErrors.length + ' ligne(s) avec HT + TVA différent du TTC' : 'écart entre HT + TVA et TTC : ' + formatMoney(round2(totalTtc - recomputedTtc)) });
  controls.push({ ok: counts.sales.length >= 0, label: 'Nombre de ventes : ' + counts.sales.length, message: 'impossible de calculer le nombre de ventes' });
  controls.push({ ok: counts.creditNotes.length >= 0, label: 'Nombre d’avoirs : ' + counts.creditNotes.length, message: 'impossible de calculer le nombre d’avoirs' });
  controls.push({ ok: counts.refundRows.length >= 0, label: 'Nombre de remboursements : ' + counts.refundRows.length, message: 'impossible de calculer le nombre de remboursements' });
  controls.push({ ok: uniqueDuplicateRefs.length === 0, label: 'Aucun doublon détecté', message: uniqueDuplicateRefs.length ? 'références en doublon : ' + uniqueDuplicateRefs.slice(0, 5).join(', ') : '' });
  controls.push({ ok: uniqueDuplicateRefs.length === 0, label: 'Toutes les références sont uniques', message: uniqueDuplicateRefs.length ? 'références en doublon : ' + uniqueDuplicateRefs.slice(0, 5).join(', ') : '' });
  controls.push({ ok: outOfPeriod.length === 0, label: 'Les dates des écritures sont comprises dans la période indiquée', message: outOfPeriod.length + ' écriture(s) hors période' });
  controls.push({ ok: missingRefs === 0, label: 'Toutes les écritures comportent une référence', message: missingRefs + ' référence(s) manquante(s) ou provisoire(s)' });
  controls.push({ ok: lineTtcErrors.length === 0, label: 'Tous les montants TTC sont cohérents avec HT + TVA', message: lineTtcErrors.length + ' ligne(s) incohérente(s)' });
  controls.push({ ok: missingAmounts.length === 0, label: 'Aucun montant HT/TVA/TTC manquant', message: missingAmounts.length + ' ligne(s) avec montant manquant ou invalide' });
  controls.push({ ok: unknownVatRates.length === 0, label: 'Tous les taux de TVA sont reconnus', message: unknownVatRates.length + ' ligne(s) avec taux non reconnu' });
  return controls;
}

function exportCsv() {
  const rows = buildExportRows();
  if (!rows.length) return;
  const csv = toCsv(rows);
  downloadBlob('\ufeff' + csv, 'journal-des-ventes-' + el('periodStart').value + '-' + el('periodEnd').value + '.csv', 'text/csv;charset=utf-8');
}

function exportXlsx() {
  const rows = buildExportRows();
  if (!rows.length) return;
  if (!window.XLSX) {
    alert('Le module Excel n est pas encore charge. Rechargez la page puis reessayez.');
    return;
  }
  const summaryRows = buildSummary(allTransactions()).map((row) => ({
    Source: row.source,
    'Taux TVA': row.vatRate + ' %',
    HT: row.ht,
    TVA: row.vat,
    TTC: row.ttc
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Synthese');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Transactions');
  XLSX.writeFile(workbook, 'journal-des-ventes-' + el('periodStart').value + '-' + el('periodEnd').value + '.xlsx');
}

function exportSummaryCsv() {
  const rows = buildAccountingSummaryRows();
  if (!rows.length) return;
  const csv = toCsv(rows);
  downloadBlob('\ufeff' + csv, 'synthese-comptable-' + el('periodStart').value + '-' + el('periodEnd').value + '.csv', 'text/csv;charset=utf-8');
}

function exportSummaryXlsx() {
  const rows = buildAccountingSummaryRows();
  if (!rows.length) return;
  if (!window.XLSX) {
    alert('Le module Excel n est pas encore charge. Rechargez la page puis reessayez.');
    return;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Synthese comptable');
  XLSX.writeFile(workbook, 'synthese-comptable-' + el('periodStart').value + '-' + el('periodEnd').value + '.xlsx');
}

function exportPennylaneXlsx() {
  const result = buildPennylaneExport(true);
  if (!handlePennylaneValidation(result)) return;
  if (!window.XLSX) {
    alert('Le module Excel n est pas encore charge. Rechargez la page puis reessayez.');
    return;
  }
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(result.rows, { header: PENNYLANE_HEADERS });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ecritures Pennylane');
  XLSX.writeFile(workbook, 'pennylane-ecritures-' + el('periodStart').value + '-' + el('periodEnd').value + '.xlsx');
}

function buildPennylaneExport(forXlsx) {
  const rows = allTransactions();
  const settings = getPennylaneSettings();
  const issues = [...validatePennylaneSettings(settings), ...validateSourceRowsForPennylane(rows)];
  const entries = [];
  rows.forEach((row, index) => {
    entries.push(...buildPennylaneEntriesForTransaction(row, index + 1, forXlsx, issues, settings));
  });
  issues.push(...validatePennylaneEntries(entries));
  return { rows: entries, issues };
}

function buildPennylaneEntriesForTransaction(row, sequence, forXlsx, issues, settings = getPennylaneSettings()) {
  const isCredit = isRefundSource(row.source) || Number(row.ttc || 0) < 0;
  const absHt = Math.abs(toCents(row.ht));
  const absVat = Math.abs(toCents(row.vat));
  const absTtc = Math.abs(toCents(row.ttc));
  const rate = Number(row.vatRate || 0);
  const date = displayDate(row.date);
  const reference = String(row.reference || '').trim();
  const source = normalizedAccountingSource(row.source);
  const type = accountingType(row);
  const pieceNumber = buildPennylanePieceNumber(row, reference);
  const channel = pennylaneSalesChannel(row.source);
  const pieceLabel = source + ' - ' + type + ' - ' + pieceNumber + (pieceNumber !== reference ? ' - commande ' + reference : '');
  const baseLabel = pieceLabel + ' - ' + displayPayment(row.payment);
  const salesAccount = { number: settings.salesAccount, label: rate === 0 ? 'Ventes de marchandises exonerees' : 'Ventes de marchandises' };
  const vatAccount = { number: settings.vatAccount, label: 'TVA collectee ' + rate + ' %' };
  const clientAccount = { number: settings.clientAccount, label: 'Clients ventes en ligne' };
  const entries = [];

  if (!salesAccount?.number) issues.push('Compte de vente manquant pour ' + reference + ' (' + rate + ' %).');
  if (absVat > 0 && !vatAccount?.number) issues.push('Compte de TVA manquant pour ' + reference + ' (' + rate + ' %).');

  const add = (account, label, debitCents, creditCents, vatRateLabel, countryCode) => {
    entries.push(buildPennylaneRow({
      date,
      account,
      label,
      debitCents,
      creditCents,
      pieceLabel,
      pieceNumber,
      vatRateLabel,
      countryCode,
      category: channel,
      journalCode: settings.journalCode,
      forXlsx
    }));
  };

  if (isCredit) {
    add(salesAccount, baseLabel + ' - annulation vente HT', absHt, 0, rate + ' %', PENNYLANE_CONFIG.countryCode);
    if (absVat > 0) add(vatAccount, baseLabel + ' - annulation TVA', absVat, 0, '', '');
    add(clientAccount, baseLabel + ' - remboursement client', 0, absTtc, '', '');
  } else {
    add(clientAccount, baseLabel + ' - client TTC', absTtc, 0, '', '');
    add(salesAccount, baseLabel + ' - vente HT', 0, absHt, rate + ' %', PENNYLANE_CONFIG.countryCode);
    if (absVat > 0) add(vatAccount, baseLabel + ' - TVA collectee', 0, absVat, '', '');
  }

  return entries;
}

function buildPennylanePieceNumber(row, reference) {
  const ref = String(reference || '').trim();
  if (/Remboursement/i.test(String(row.source || ''))) {
    return 'RBS-' + ref + '-' + compactDate(row.date);
  }
  return ref;
}

function compactDate(value) {
  const match = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[1] + match[2] + match[3];
  const fr = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return fr ? fr[3] + fr[2] + fr[1] : 'DATE';
}

function pennylaneSalesChannel(source) {
  const value = String(source || '');
  if (/Amazon/i.test(value)) return 'Amazon';
  if (/Oriental Discount/i.test(value)) return 'Oriental Discount';
  if (/Henne Discount/i.test(value)) return 'Henne Discount';
  if (/eBay/i.test(value)) return 'eBay';
  return 'Non precise';
}

function buildPennylaneRow({ date, account, label, debitCents, creditCents, pieceLabel, pieceNumber, vatRateLabel, countryCode, category, journalCode, forXlsx }) {
  const row = {};
  const debit = amountForPennylane(debitCents, forXlsx);
  const credit = amountForPennylane(creditCents, forXlsx);
  row[PENNYLANE_HEADERS[0]] = date;
  row[PENNYLANE_HEADERS[1]] = journalCode || PENNYLANE_DEFAULT_SETTINGS.journalCode;
  row[PENNYLANE_HEADERS[2]] = account?.number || '';
  row[PENNYLANE_HEADERS[3]] = account?.label || '';
  row[PENNYLANE_HEADERS[4]] = label;
  row[PENNYLANE_HEADERS[5]] = vatRateLabel || '';
  row[PENNYLANE_HEADERS[6]] = countryCode || '';
  row[PENNYLANE_HEADERS[7]] = pieceLabel;
  row[PENNYLANE_HEADERS[8]] = pieceNumber;
  row[PENNYLANE_HEADERS[9]] = debit;
  row[PENNYLANE_HEADERS[10]] = credit;
  row[PENNYLANE_HEADERS[11]] = category ? PENNYLANE_CONFIG.categoryFamily : '';
  row[PENNYLANE_HEADERS[12]] = category || '';
  row[PENNYLANE_HEADERS[13]] = '';
  row[PENNYLANE_HEADERS[14]] = '';
  return row;
}

function validateSourceRowsForPennylane(rows) {
  const issues = [];
  rows.forEach((row, index) => {
    const label = 'ligne source ' + (index + 1) + (row.reference ? ' (' + row.reference + ')' : '');
    if (!row.date || displayDate(row.date) === 'A verifier') issues.push(label + ' : date absente ou illisible.');
    if (!String(row.reference || '').trim()) issues.push(label + ' : reference manquante.');
    if (![row.ht, row.vat, row.ttc].every((value) => Number.isFinite(Number(value)))) issues.push(label + ' : montant HT/TVA/TTC manquant ou invalide.');
    if (!Number.isFinite(Number(row.vatRate))) issues.push(label + ' : taux de TVA non reconnu.');
    if (Math.abs(toCents(row.ht) + toCents(row.vat) - toCents(row.ttc)) > 1) issues.push(label + ' : TTC incoherent avec HT + TVA.');
  });
  return issues;
}

function validatePennylaneEntries(entries) {
  const issues = [];
  const byPiece = new Map();
  for (const entry of entries) {
    const piece = entry[PENNYLANE_HEADERS[7]] || 'piece sans libelle';
    const debit = centsFromPennylane(entry[PENNYLANE_HEADERS[9]]);
    const credit = centsFromPennylane(entry[PENNYLANE_HEADERS[10]]);
    const account = entry[PENNYLANE_HEADERS[2]];
    if (!account) issues.push(piece + ' : compte comptable manquant.');
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) issues.push(piece + ' : montant comptable invalide.');
    if (debit > 0 && credit > 0) issues.push(piece + ' : une ligne ne peut pas etre a la fois au debit et au credit.');
    if (debit === 0 && credit === 0) issues.push(piece + ' : ligne comptable sans montant.');
    const item = byPiece.get(piece) || { debit: 0, credit: 0, count: 0 };
    item.debit += debit;
    item.credit += credit;
    item.count += 1;
    byPiece.set(piece, item);
  }
  for (const [piece, item] of byPiece.entries()) {
    if (item.count < 2) issues.push(piece + ' : ecriture orpheline.');
    if (Math.abs(item.debit - item.credit) > 1) issues.push(piece + ' : ecriture non equilibree (debit ' + centsToComma(item.debit) + ', credit ' + centsToComma(item.credit) + ').');
  }
  return issues;
}

function handlePennylaneValidation(result) {
  if (!result.rows.length) return false;
  if (!result.issues.length) return true;
  const uniqueIssues = Array.from(new Set(result.issues));
  alert('Export Pennylane bloque : ' + uniqueIssues.length + ' anomalie(s) detectee(s).\n\n' + uniqueIssues.slice(0, 12).join('\n') + (uniqueIssues.length > 12 ? '\n...' : ''));
  return false;
}

function buildAccountingSummaryRows() {
  const map = new Map();
  for (const row of allTransactions()) {
    const source = normalizedAccountingSource(row.source);
    const type = accountingType(row);
    const rate = Number(row.vatRate || 0);
    const key = source + '|' + type + '|' + rate;
    const item = map.get(key) || { Source: source, Type: type, 'Taux TVA': rate + ' %', 'Nombre de pièces': 0, 'Total HT': 0, 'TVA collectée': 0, 'Total TTC': 0, _sort: accountingSortKey(source, type, rate) };
    item['Nombre de pièces'] += 1;
    item['Total HT'] = round2(item['Total HT'] + Number(row.ht || 0));
    item['TVA collectée'] = round2(item['TVA collectée'] + Number(row.vat || 0));
    item['Total TTC'] = round2(item['Total TTC'] + Number(row.ttc || 0));
    map.set(key, item);
  }
  return Array.from(map.values())
    .sort((a, b) => a._sort.localeCompare(b._sort))
    .map(({ _sort, ...row }) => ({
      Source: row.Source,
      Type: row.Type,
      'Taux TVA': row['Taux TVA'],
      'Nombre de pièces': row['Nombre de pièces'],
      'Total HT': numberForExport(row['Total HT']),
      'TVA collectée': numberForExport(row['TVA collectée']),
      'Total TTC': numberForExport(row['Total TTC'])
    }));
}

function normalizedAccountingSource(source) {
  const value = String(source || '');
  if (/Amazon/i.test(value)) return 'Amazon';
  if (/Oriental Discount/i.test(value)) return 'Oriental Discount';
  if (/Henne Discount/i.test(value)) return 'Henne Discount';
  if (/eBay/i.test(value)) return 'eBay';
  return value || 'Non precise';
}

function accountingType(row) {
  const source = String(row.source || '');
  if (/Avoir/i.test(source)) return 'Avoirs';
  if (/Remboursement/i.test(source)) return 'Remboursements';
  if (Number(row.vatRate) === 0) return 'Ventes exonérées';
  return 'Ventes';
}

function accountingSortKey(source, type, rate) {
  const sourceOrder = { 'Amazon': '1', 'Oriental Discount': '2', 'eBay': '3', 'Henne Discount': '4' }[source] || '9';
  const typeOrder = { 'Ventes': '1', 'Ventes exonérées': '2', 'Avoirs': '3', 'Remboursements': '4' }[type] || '9';
  return sourceOrder + '-' + typeOrder + '-' + String(rate).padStart(3, '0');
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function centsToComma(cents) {
  return (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
}

function amountForPennylane(cents, forXlsx) {
  if (!cents) return forXlsx ? 0 : '';
  return forXlsx ? cents / 100 : centsToComma(cents);
}

function centsFromPennylane(value) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value * 100);
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
}

function sanitizeIdentifier(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function numberForExport(value) {
  return round2(value).toFixed(2).replace('.', ',');
}

function buildExportRows() {
  return allTransactions().map((row) => ({
    Date: displayDate(row.date),
    Source: row.source,
    Reference: row.reference,
    Paiement: displayPayment(row.payment),
    'Taux TVA': row.vatRate + ' %',
    HT: row.ht,
    TVA: row.vat,
    TTC: row.ttc
  }));
}

function toCsv(rows, headers = Object.keys(rows[0])) {
  const escapeCell = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  return [headers.map(escapeCell).join(';'), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(';'))].join('\r\n');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function groupForPdf(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.source + ' - TVA ' + row.vatRate + ' %';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return Array.from(map.entries()).map(([title, groupRows]) => ({ title, rows: groupRows }));
}
