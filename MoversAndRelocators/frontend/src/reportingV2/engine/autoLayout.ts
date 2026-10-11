/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Professional default layouts. Every document gets the tenant letterhead (logo top-left; company name,
 * address and contacts top-right; an accent rule), a title with a meta block, the party block, a styled
 * line-item table that flows across pages, totals with the amount in words, notes and signatures, and a
 * page footer. Field paths per document type live in SPECS; anything else (accounting reports, unknown
 * types) is laid out from the record itself.
 *
 * Letterhead values come from {{company.*}}, which the server fills from the tenant's letterhead settings,
 * so changing the logo or address there updates every report without editing templates.
 */
import { defaultBands, makeEl, newPageObj } from './factory';
import { defaultWatermark, PAGE_SIZES, type FixedCell, type ReportElement } from './models';

export const ACCENT = '#176b52';
const INK = '#1f2733', MUTED = '#6b7686', RULE = '#dde3ec', SOFT = '#f3f6f5';
const FONT = 'Arial, sans-serif';

type Col = [header: string, expr: string, weight?: number, align?: 'left' | 'right' | 'center'];
type Spec = {
  title: string;
  landscape?: boolean;
  status?: string;                                      // expression shown in red under the title (e.g. VOID)
  party?: { label: string; name: string; lines: string[] };
  meta: [string, string][];
  list?: { path: string; cols: Col[] };
  fixedLines?: { cols: Col[] };                         // single-row "line" table for documents without a list
  totals?: [string, string][];
  words?: string;
  notes?: [string, string][];
  signatures?: string[];
  signatureImages?: (string | null)[];                // optional image expression per signature (a captured signature), drawn above its line
};

const money = (path: string, cur?: string) => cur ? 'MONEY(' + path + ")+' '+" + cur : 'MONEY(' + path + ')';
const SPECS: Record<string, (d: any) => Spec> = {
  INVOICE: () => billingDoc('INVOICE', 'BILL TO', 'Invoice no.'),
  BILL: () => billingDoc('BILL', 'VENDOR', 'Bill no.'),
  RECEIPT: () => voucher('RECEIPT', 'RECEIVED FROM', 'Receipt no.'),
  PAYMENT: () => voucher('PAYMENT VOUCHER', 'PAID TO', 'Voucher no.'),
  CREDIT_MEMO: () => memo('CREDIT MEMO'),
  DEBIT_MEMO: () => memo('DEBIT MEMO'),
  QUOTATION: () => ({
    title: 'QUOTATION',
    party: { label: 'PREPARED FOR', name: 'quotation.customerName', lines: ["LINE(' · ', quotation.phone, quotation.email)", "'Move: '+quotation.origin+' → '+quotation.destination"] },
    meta: [['Quotation no.', 'quotation.quotationNumber'], ['Date', 'DATE(quotation.createdAtUtc)'], ['Valid until', 'DATE(quotation.validUntil)'], ['Prepared by', 'quotation.assignedEmployeeName'], ['Currency', 'quotation.currency']],
    list: { path: 'lines', cols: [['Service', 'chargeName', 1.5], ['Description', 'description', 2.4], ['Qty', "NUM(quantity,2)+' '+unit", 0.9, 'right'], ['Rate', 'MONEY(rate)', 1, 'right'], ['Discount', 'MONEY(discountAmount)', 0.9, 'right'], ['Tax', 'MONEY(taxAmount)', 0.9, 'right'], ['Total', 'MONEY(lineTotal)', 1.1, 'right']] },
    totals: [['Subtotal', 'MONEY(quotation.subtotal)'], ['Discount', 'MONEY(quotation.discountTotal)'], ['Tax', 'MONEY(quotation.taxTotal)'], ['Grand total', money('quotation.grandTotal', 'quotation.currency')]],
    words: 'WORDS(quotation.grandTotal, quotation.currency)',
    notes: [['Terms & conditions', 'quotation.terms'], ['Notes', 'quotation.notes']],
    signatures: ['Customer acceptance', 'For {{company.name}}']
  }),
  PICKUP_RECEIPT: () => ({
    title: 'PAYMENT RECEIPT',
    party: { label: 'RECEIVED FROM', name: 'pickup.customerName', lines: ['pickup.address', "LINE(' · ', pickup.phone, pickup.email)"] },
    meta: [['Receipt no.', 'payment.transactionNumber'], ['Date', 'DATETIME(payment.createdAtUtc)'], ['Pickup no.', 'pickup.pickupNumber'], ['Quotation', 'pickup.quotationNumber'], ['Payment method', 'payment.paymentMethod']],
    fixedLines: { cols: [['Description', "payment.category+IF(payment.notes,' — '+payment.notes,'')", 3], ['Amount', money('payment.amount', 'payment.currency'), 1, 'right']] },
    totals: [['Amount received', money('payment.amount', 'payment.currency')], ['Total collected to date', money('totalCollected', 'payment.currency')]],
    words: 'WORDS(payment.amount, payment.currency)',
    signatures: ['Received by']
  }),
  PACKING_LIST: () => ({
    title: 'PACKING LIST',
    party: { label: 'CUSTOMER', name: 'pickup.customerName', lines: ['pickup.address'] },
    meta: [['Pickup no.', 'pickup.pickupNumber'], ['Date', 'DATE(generatedAt)'], ['Packages', 'packageCount']],
    list: { path: 'packages', cols: [['Box', 'trackingNumber', 1.4], ['Room', 'roomName', 1], ['Box type', "boxTypeName+IF(isFragile,' · FRAGILE','')", 1.3], ['Contents', "LIST(items,'itemName','quantity')", 3.3]] },
    notes: [['Items left behind', 'leftBehindNotes']],
    signatures: ['Packed by', 'Customer']
  }),
  WAREHOUSE_RECEIPT: () => ({
    title: 'WAREHOUSE RECEIPT',
    party: { label: 'CUSTOMER', name: 'details.customerName', lines: ['details.address', "LINE(' · ', details.customerCode, details.phone)"] },
    meta: [['Receipt no.', 'receiptNumber'], ['Received', 'DATETIME(receivedAtUtc)'], ['Warehouse', "details.warehouseName+IF(details.bay,' / '+details.bay,'')"], ['Pickup', 'details.pickupNumber'], ['Delivered by', 'details.deliveredBy'], ['Received by', 'details.receivedBy']],
    list: { path: 'details.boxes', cols: [['Tracking no.', 'trackingNumber', 1.4], ['Description', 'description', 2], ['Contents', 'contents', 2.2], ['Condition', 'condition', 1], ['Seal', 'sealNumber', 1]] },
    notes: [['Notes', 'details.notes']],
    signatures: ['Delivered by', 'Received by']
  }),
  JOB_MANIFEST: () => ({
    title: 'CARGO MANIFEST',
    landscape: true,
    party: { label: 'ROUTE', name: "details.originPort+' → '+details.destinationPort", lines: ["LINE(' → ', details.originAgentName, details.destinationAgentName)", "LINE(' · ', details.carrier, details.vesselName, details.voyageNumber, details.flightNumber, details.truckNumber)"] },
    meta: [['Job no.', 'jobNumber'], ['Mode', 'details.mode'], ['Status', 'status'], ['Departure', 'DATE(details.estimatedDeparture)'], ['Arrival', 'DATE(details.estimatedArrival)']],
    list: { path: 'activeCargo', cols: [['Tracking no.', 'details.box.trackingNumber', 1.3], ['Customer', 'details.box.customerName', 1.4], ['Contents', 'details.box.contents', 2], ['Shipper', 'details.shipping.shipper.name', 1.2], ['Consignee', 'details.shipping.consignee.name', 1.2], ['Drop address', 'details.shipping.dropAddress', 1.8]] },
    notes: [['Notes', 'details.notes']],
    signatures: ['Loaded by', 'Carrier']
  }),
  PACKING_SHEET: () => ({
    title: 'PACKING LIST',
    party: { label: 'CUSTOMER', name: 'job.customerName', lines: ['job.address', "LINE(' · ', job.phone, job.email)"] },
    meta: [['Packing job', 'job.jobNumber'], ['Date', 'DATE(job.scheduledAtUtc)'], ['Boxes', 'boxCount'], ['Items', 'itemCount'], ['Crew', "JOIN(crew,'employeeName',', ')"]],
    list: { path: 'boxes', cols: [['#', 'boxIndex', 0.4], ['Box', 'trackingNumber', 1.5], ['Room', 'roomName', 1], ['Box type', "boxTypeName+IF(isFragile,' · FRAGILE','')", 1.3], ['Contents', "LIST(items,'itemName','quantity')", 3.2]] },
    notes: [['Notes', 'job.notes']],
    signatures: ['Packed by', 'Customer']
  }),
  PACKING_RECEIPT: () => ({
    title: 'PAYMENT RECEIPT',
    party: { label: 'RECEIVED FROM', name: 'job.customerName', lines: ['job.address', "LINE(' · ', job.phone, job.email)"] },
    meta: [['Receipt no.', 'payment.transactionNumber'], ['Date', 'DATETIME(payment.createdAtUtc)'], ['Packing job', 'job.jobNumber'], ['Payment method', 'payment.paymentMethod']],
    fixedLines: { cols: [['Description', "payment.category+IF(payment.notes,' — '+payment.notes,'')", 3], ['Amount', money('payment.amount', 'payment.currency'), 1, 'right']] },
    totals: [['Amount received', money('payment.amount', 'payment.currency')], ['Total collected to date', money('totalCollected', 'payment.currency')]],
    words: 'WORDS(payment.amount, payment.currency)',
    signatures: ['Received by']
  }),
  DELIVERY_NOTE: () => ({
    title: 'DELIVERY NOTE',
    party: { label: 'DELIVER TO', name: 'note.customerName', lines: ["IF(note.contactName,'Attn: '+note.contactName,'')", 'note.address', 'note.phone'] },
    meta: [['Delivery note', 'note.noteNumber'], ['Delivery', 'delivery.deliveryNumber'], ['Date', 'DATE(delivery.scheduledAtUtc)'], ['Vehicle', 'delivery.vehicleName'], ['Driver', 'delivery.driverName'], ['Packages', 'itemCount']],
    list: { path: 'items', cols: [['#', 'index', 0.4], ['Package', 'trackingNumber', 1.5], ['Description', 'description', 1.5], ['Contents', 'contents', 2.6], ['Status', "statusLabel+IF(receivedBy,' · '+receivedBy,'')", 1.4]] },
    notes: [['Remarks', 'note.remarks'], ['Received', "IF(note.isSigned,'Signed by '+note.signerName+' on '+DATETIME(note.signedAtUtc),'')"]],
    signatures: ['Delivered by (driver)', 'Customer signature'],
    signatureImages: [null, 'note.signaturePng']
  }),
  DELIVERY_RECEIPT: () => ({
    title: 'PAYMENT RECEIPT',
    party: { label: 'RECEIVED FROM', name: 'customer.name', lines: ['customer.address', 'customer.phone'] },
    meta: [['Receipt no.', 'payment.transactionNumber'], ['Date', 'DATETIME(payment.createdAtUtc)'], ['Delivery', 'delivery.deliveryNumber'], ['Delivery note', 'customer.noteNumber'], ['Payment method', 'payment.paymentMethod']],
    fixedLines: { cols: [['Description', "payment.category+IF(payment.notes,' — '+payment.notes,'')", 3], ['Amount', money('payment.amount', 'payment.currency'), 1, 'right']] },
    totals: [['Amount received', money('payment.amount', 'payment.currency')]],
    words: 'WORDS(payment.amount, payment.currency)',
    signatures: ['Received by']
  }),
  COST_REPORT: () => ({
    title: 'OPERATIONS COST REPORT',
    landscape: true,
    meta: [['Report', 'name'], ['Basis', 'mode'], ['As of', 'DATE(date)']],
    list: { path: 'rows', cols: [['Pickup', 'pickupNumber', 1.1], ['Customer', 'customerName', 1.6], ['Currency', 'currency', 0.7], ['Income', 'MONEY(recordedIncome)', 1, 'right'], ['Labour', 'MONEY(labourCost)', 1, 'right'], ['Material', 'MONEY(materialCost)', 1, 'right'], ['Vendor', 'MONEY(vendorCost)', 1, 'right'], ['Total cost', 'MONEY(totalCost)', 1, 'right'], ['Surplus', 'MONEY(recordedSurplus)', 1, 'right']] },
    totals: [['Income', 'MONEY(SUM(rows.recordedIncome))'], ['Total cost', 'MONEY(SUM(rows.totalCost))'], ['Surplus', 'MONEY(SUM(rows.recordedSurplus))']]
  })
};

function billingDoc(title: string, party: string, numberLabel: string): Spec {
  return {
    title, status: "IF(details.voided,'VOID — '+details.voidReason,'')",
    party: { label: party, name: 'details.partyName', lines: ['details.address', "IF(details.partyCode,'Account: '+details.partyCode,'')"] },
    meta: [[numberLabel, 'number'], ['Date', 'DATE(details.date)'], ['Due date', 'DATE(details.dueDate)'], ['Reference', 'details.reference'], ['Currency', 'details.currency']],
    list: { path: 'details.lines', cols: [['Description', 'description', 3], ['Source', 'sourceLabel', 1.4], ['Qty', 'NUM(quantity,2)', 0.7, 'right'], ['Unit price', 'MONEY(unitPrice)', 1, 'right'], ['Amount', 'MONEY(amount)', 1.1, 'right']] },
    totals: [['Total', money('details.amount', 'details.currency')], ['Paid', 'MONEY(paid)'], ['Balance due', money('balance', 'details.currency')]],
    words: 'WORDS(details.amount, details.currency)',
    notes: [['Notes', 'details.notes']]
  };
}
function voucher(title: string, party: string, numberLabel: string): Spec {
  return {
    title, status: "IF(details.voided,'VOID — '+details.voidReason,'')",
    party: { label: party, name: 'details.partyName', lines: ["IF(details.partyCode,'Account: '+details.partyCode,'')"] },
    meta: [[numberLabel, 'number'], ['Date', 'DATE(details.date)'], ['Reference', 'details.reference'], ['Account', 'details.accountCode'], ['Currency', 'details.currency']],
    list: { path: 'details.allocations', cols: [['Document', 'documentNumber', 2], ['Type', 'documentType', 1.2], ['Currency', 'documentCurrency', 1], ['Allocated', 'MONEY(amount)', 1.2, 'right']] },
    totals: [['Amount', money('details.amount', 'details.currency')]],
    words: 'WORDS(details.amount, details.currency)',
    notes: [['Notes', 'details.notes']],
    signatures: ['Prepared by', 'Received by']
  };
}
function memo(title: string): Spec {
  return {
    title, status: "IF(details.voided,'VOID','')",
    party: { label: 'PARTY', name: 'details.partyName', lines: ["IF(details.partyCode,'Account: '+details.partyCode,'')"] },
    meta: [['Memo no.', 'number'], ['Date', 'DATE(details.date)'], ['Against', "details.documentNumber+' ('+details.documentType+')'"], ['Currency', 'details.currency']],
    fixedLines: { cols: [['Reason', 'details.reason', 3], ['Against', 'details.documentNumber', 1.3], ['Amount', money('details.amount', 'details.currency'), 1.2, 'right']] },
    totals: [['Total', money('details.amount', 'details.currency')], ['Base amount', 'MONEY(details.baseAmount)']],
    words: 'WORDS(details.amount, details.currency)'
  };
}

/* ---------- element helpers ---------- */
const el = (type: string, o: Partial<ReportElement>): ReportElement => Object.assign(makeEl(type, o.x || 0, o.y || 0), { fontFamily: FONT, color: INK, padding: 0 }, o);
const txt = (text: string, o: Partial<ReportElement>) => el('field', { text, fontSize: 10, ...o });
const wrap = (e: string) => (/^\{\{/.test(e) || !/[A-Za-z_$(]/.test(e) ? e : '{{' + e + '}}');

/** Logo top-left; company name, address and contacts top-right; accent rule underneath. Height 108. */
export function letterhead(inner: number, ox = 0, oy = 0): ReportElement[] {
  const right = 330, rx = ox + inner - right;
  return [
    el('image', { x: ox, y: oy, w: 200, h: 70, src: '{{company.logo}}', align: 'left' }),
    txt("{{IF(company.logo,'',company.name)}}", { x: ox, y: oy + 14, w: inner - right - 20, h: 40, fontSize: 20, bold: true, color: ACCENT }),
    txt('{{company.name}}', { x: rx, y: oy, w: right, h: 20, fontSize: 13, bold: true, align: 'right' }),
    txt('{{company.address}}', { x: rx, y: oy + 21, w: right, h: 44, fontSize: 9.5, color: '#4a5568', align: 'right', valign: 'top' }),
    txt("{{LINE('  ·  ', company.phone, company.email, company.website)}}", { x: rx, y: oy + 66, w: right, h: 14, fontSize: 9, color: '#4a5568', align: 'right' }),
    txt("{{IF(company.taxId,'Tax ID: '+company.taxId,'')}}", { x: rx, y: oy + 81, w: right, h: 14, fontSize: 9, color: '#4a5568', align: 'right' }),
    el('line', { x: ox, y: oy + 100, w: inner, h: 2, bg: ACCENT, lineDir: 'h' })
  ];
}
export const LETTERHEAD_H = 108;

function pageFooter(inner: number): ReportElement[] {
  return [
    el('line', { x: 0, y: 0, w: inner, h: 1, bg: RULE, lineDir: 'h' }),
    txt("{{LINE('  ·  ', company.name, company.phone, company.email)}}", { x: 0, y: 6, w: inner - 120, h: 14, fontSize: 8.5, color: MUTED }),
    txt('Page {{PAGE}} of {{PAGES}}', { x: inner - 120, y: 6, w: 120, h: 14, fontSize: 8.5, color: MUTED, align: 'right' })
  ];
}

function grid(x: number, y: number, w: number, cols: number[], rows: FixedCell[][], o: Partial<ReportElement> = {}): ReportElement {
  return el('table', { x, y, w, h: rows.length * 20 + 2, tableMode: 'fixed', gridCols: cols, gridRows: rows, fontSize: 10, gridColor: 'transparent', autoHeight: true, showHeader: false, showFooter: false, ...o });
}

/** Title, status, party block (left) and meta grid (right). */
function documentHeader(spec: Spec, inner: number): { h: number; elements: ReportElement[] } {
  const metaW = 300, leftW = inner - metaW - 30;
  const els: ReportElement[] = [txt(spec.title, { x: 0, y: 8, w: leftW, h: 32, fontSize: 22, bold: true, color: ACCENT })];
  if (spec.status) { els.push(txt(wrap(spec.status), { x: 0, y: 40, w: leftW, h: 16, fontSize: 10, bold: true, color: '#c0392b' })); }
  let left = 62;
  if (spec.party) {
    els.push(txt(spec.party.label, { x: 0, y: left, w: leftW, h: 14, fontSize: 8.5, bold: true, color: MUTED, text: spec.party.label }));
    els.push(txt(wrap(spec.party.name), { x: 0, y: left + 15, w: leftW, h: 18, fontSize: 12, bold: true }));
    left += 34;
    for (const line of spec.party.lines) { els.push(txt(wrap(line), { x: 0, y: left, w: leftW, h: 30, fontSize: 9.5, color: '#4a5568', valign: 'top', autoHeight: true })); left += line.includes('address') ? 32 : 16; }
  }
  const meta = grid(inner - metaW, 8, metaW, [118, metaW - 118], spec.meta.map(([label, expr]) => [
    { expr: label, color: MUTED, size: 9.5 }, { expr: wrap(expr), align: 'right', bold: true }
  ]), { gridColor: RULE });
  els.push(meta);
  return { h: Math.max(left, 8 + spec.meta.length * 21) + 18, elements: els };
}

/** Totals (right), amount in words and notes (left), signatures — printed once, straight after the rows. */
function summary(spec: Spec, inner: number): { h: number; elements: ReportElement[] } {
  const els: ReportElement[] = []; const totW = 300, leftW = inner - totW - 30;
  let right = 10, left = 10;
  if (spec.fixedLines) {
    const cols = spec.fixedLines.cols, total = cols.reduce((s, c) => s + (c[2] || 1), 0);
    els.push(grid(0, 10, inner, cols.map(c => Math.round(inner * (c[2] || 1) / total)), [
      cols.map(c => ({ expr: c[0], bold: true, color: '#ffffff', bg: ACCENT, align: c[3] || 'left' })),
      cols.map(c => ({ expr: wrap(c[1]), align: c[3] || 'left' }))
    ], { gridColor: RULE }));
    right = left = 66;
  }
  if (spec.totals?.length) {
    const rows = spec.totals.map(([label, expr], i, a): FixedCell[] => {
      const last = i === a.length - 1 && a.length > 1;
      return [{ expr: label, color: last ? '#ffffff' : MUTED, bg: last ? ACCENT : undefined, bold: last }, { expr: wrap(expr), align: 'right', bold: true, color: last ? '#ffffff' : INK, bg: last ? ACCENT : SOFT }];
    });
    els.push(grid(inner - totW, right, totW, [140, totW - 140], rows, { gridColor: RULE, fontSize: 10.5 }));
    right += rows.length * 22 + 8;
  }
  if (spec.words) {
    els.push(txt('AMOUNT IN WORDS', { x: 0, y: left, w: leftW, h: 14, fontSize: 8.5, bold: true, color: MUTED }));
    els.push(txt(wrap(spec.words), { x: 0, y: left + 15, w: leftW, h: 30, fontSize: 10, italic: true, valign: 'top' }));
    left += 52;
  }
  for (const [label, expr] of spec.notes || []) {
    els.push(txt("{{IF(" + expr + ",'" + label.toUpperCase().replace(/'/g, '') + "','')}}", { x: 0, y: left, w: leftW, h: 14, fontSize: 8.5, bold: true, color: MUTED }));
    els.push(txt(wrap(expr), { x: 0, y: left + 15, w: leftW, h: 48, fontSize: 9.5, color: '#4a5568', valign: 'top' }));
    left += 68;
  }
  let y = Math.max(left, right) + 10;
  if (spec.signatures?.length) {
    const n = spec.signatures.length, w = Math.min(220, (inner - (n - 1) * 40) / n);
    spec.signatures.forEach((label, i) => {
      const x = n === 1 ? inner - w : i * ((inner - w) / (n - 1));
      const image = spec.signatureImages?.[i];
      if (image) els.push(el('image', { x, y: y - 2, w, h: 34, src: '{{' + image + '}}', align: n === 1 ? 'right' : 'left' }));
      els.push(el('line', { x, y: y + 34, w, h: 1, bg: INK, lineDir: 'h' }));
      els.push(txt(label, { x, y: y + 38, w, h: 14, fontSize: 9, color: MUTED, align: n === 1 ? 'right' : 'left' }));
    });
    y += 60;
  }
  return { h: y, elements: els };
}

/* ---------- generic (accounting reports and unknown types) ---------- */
const HIDDEN = /(^id$|Id$|^version$|guid|^serialNo$|^displayOrder$|^tokenHash$|^requestId$|^postedBy$|^users$)/i;
const ROOT_SKIP = new Set(['company', 'generatedAt', 'title', 'filters']);
const MONEYISH = /(amount|total|balance|debit|credit|paid|cost|price|rate|income|expense|surplus|subtotal|tax|opening|closing|current|days|due)/i;

export function humanize(key: string): string {
  const s = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function exprFor(path: string, value: any): string {
  const key = path.split('.').pop() || path;
  if (typeof value === 'number') { return MONEYISH.test(key) && !/days/i.test(key) ? 'MONEY(' + path + ')' : path; }
  if (typeof value === 'boolean') { return 'IF(' + path + ",'Yes','No')"; }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) { return 'DATETIME(' + path + ')'; }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) { return 'DATE(' + path + ')'; }
  return path;
}
function leaves(obj: any, prefix = '', depth = 0, out: { path: string; value: any }[] = []): { path: string; value: any }[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 3) { return out; }
  for (const k of Object.keys(obj)) {
    if (HIDDEN.test(k) || (depth === 0 && ROOT_SKIP.has(k))) { continue; }
    const v = obj[k], p = prefix ? prefix + '.' + k : k;
    if (Array.isArray(v)) { continue; }
    if (v && typeof v === 'object') { leaves(v, p, depth + 1, out); } else { out.push({ path: p, value: v }); }
  }
  return out;
}
function mainList(obj: any): { path: string; item: any } | null {
  let best: { path: string; item: any; n: number } | null = null;
  const walk = (o: any, prefix: string, depth: number) => {
    if (!o || typeof o !== 'object' || depth > 2) { return; }
    for (const k of Object.keys(o)) {
      if (depth === 0 && ROOT_SKIP.has(k)) { continue; }
      const v = o[k], p = prefix ? prefix + '.' + k : k;
      if (Array.isArray(v)) { if (v[0] && typeof v[0] === 'object' && !Array.isArray(v[0]) && (!best || v.length > best.n)) { best = { path: p, item: v[0], n: v.length }; } }
      else if (v && typeof v === 'object') { walk(v, p, depth + 1); }
    }
  };
  walk(obj, '', 0);
  return best;
}
function genericSpec(data: any): Spec {
  const list = mainList(data);
  const cols = list ? leaves(list.item).filter(c => c.path.split('.').length <= 2).slice(0, 9) : [];
  const facts = leaves(data).filter(f => !list || !f.path.startsWith(list.path + '.')).slice(0, 12);
  return {
    title: '{{UPPER(title)}}',
    landscape: cols.length > 6,
    meta: ([['Period', "IF(filters.from, DATE(filters.from)+' – '+DATE(filters.to), DATE(filters.date))"], ['Currency', "IF(filters.currency=='BASE','Base currency',IF(filters.currency=='DEFAULT','Default transaction currency',filters.currency))"], ['Printed', 'DATETIME(generatedAt)'],
      ...facts.map(f => [humanize(f.path.split('.').slice(-2).join(' ')), exprFor(f.path, f.value)] as [string, string])] as [string, string][]).slice(0, 14),
    list: list ? { path: list.path, cols: cols.map(c => [humanize(c.path.split('.').pop()!), exprFor(c.path, c.value), typeof c.value === 'string' && String(c.value).length > 18 ? 2 : 1, typeof c.value === 'number' ? 'right' : 'left'] as Col) } : undefined
  };
}

/* ---------- assembly ---------- */
export function professionalLayout(type: string, data: any): any {
  if (type === 'BOX_LABELS') { return labelLayout(); }
  if (type === 'PACKING_LABELS') { return labelLayout({ repeat: 'boxes', reference: 'Job {{job.jobNumber}}', customer: '{{job.customerName}}', address: '{{job.address}}' }); }
  const spec = (SPECS[type] || genericSpec)(data || {});
  const size = spec.landscape ? 'A4-L' : 'A4';
  const [w, h] = PAGE_SIZES[size], margin = 32, inner = w - 2 * margin;
  const bands: any = defaultBands();
  bands.pageHeader = { h: LETTERHEAD_H + 6, on: true, optional: false, elements: letterhead(inner) };
  const head = documentHeader(spec, inner);
  bands.reportHeader = { h: head.h, on: true, optional: true, elements: head.elements };
  const cols = spec.list?.cols || [];
  const weight = cols.reduce((s, c) => s + (c[2] || 1), 0) || 1;
  bands.columnHeader = { h: 26, on: cols.length > 0, optional: false, headerBg: ACCENT, headerColor: '#ffffff', fontSize: 9.5, bold: true };
  bands.detail = {
    ...bands.detail, rowH: 22, autoHeight: true, dataPath: spec.list?.path || 'rows', fontFamily: FONT, fontSize: 9.5, color: INK,
    headerBg: ACCENT, headerColor: '#ffffff', gridColor: RULE, zebra: true,
    columns: cols.map(c => ({ header: c[0], expr: wrap(c[1]), width: Math.round(inner * (c[2] || 1) / weight), align: c[3] || 'left' }))
  };
  const sum = summary(spec, inner);
  const order: string[] = [];
  if (sum.elements.length) { bands.summary1 = { h: sum.h, on: true, optional: true, elements: sum.elements }; order.push('summary1'); }
  bands.reportFooter = { h: 0, on: false, optional: true, elements: [] };
  bands.pageFooter = { h: 26, on: true, optional: false, elements: pageFooter(inner) };
  return { mode: 'flow', pages: [newPageObj(size)], activePage: 0, flowPage: { size, w, h, margin }, bands, watermark: defaultWatermark(), repeatPath: '', summaryOrder: order };
}
/** Kept for callers of the first version. */
export const starterLayout = professionalLayout;

/** One 4×6 in label per box: logo, box number, QR tracking code, customer and contents. Pickup labels by default;
 *  packing-job labels pass their own list and field paths. */
function labelLayout(o: { repeat: string; reference: string; customer: string; address: string } = { repeat: 'packages', reference: 'Pickup {{pickup.pickupNumber}}', customer: '{{pickup.customerName}}', address: '{{pickup.address}}' }): any {
  const page = newPageObj('4x6'); page.margin = 12;
  const W = page.w - 24;
  page.elements = [
    el('image', { x: 12, y: 10, w: 120, h: 36, src: '{{company.logo}}', align: 'left' }),
    txt("{{IF(company.logo,'',company.name)}}", { x: 12, y: 12, w: 200, h: 32, fontSize: 13, bold: true, color: ACCENT }),
    txt('{{company.phone}}', { x: 140, y: 14, w: W - 128, h: 14, fontSize: 9, color: MUTED, align: 'right' }),
    txt(o.reference, { x: 140, y: 30, w: W - 128, h: 14, fontSize: 9, color: MUTED, align: 'right' }),
    el('line', { x: 12, y: 52, w: W, h: 2, bg: ACCENT, lineDir: 'h' }),
    el('qrcode', { x: 12, y: 64, w: 168, h: 168, text: '{{trackingNumber}}' }),
    txt('BOX', { x: 196, y: 70, w: W - 184, h: 14, fontSize: 9, bold: true, color: MUTED }),
    txt('{{boxIndex}} / {{boxCount}}', { x: 196, y: 86, w: W - 184, h: 36, fontSize: 28, bold: true }),
    txt('{{boxTypeName}}', { x: 196, y: 128, w: W - 184, h: 18, fontSize: 11 }),
    txt('{{roomName}}', { x: 196, y: 148, w: W - 184, h: 18, fontSize: 11, color: '#4a5568' }),
    el('field', { x: 196, y: 176, w: W - 184, h: 28, text: "{{IF(isFragile,'FRAGILE','')}}", fontSize: 15, bold: true, color: '#c0392b', fontFamily: FONT, align: 'left' }),
    txt('{{trackingNumber}}', { x: 12, y: 238, w: W, h: 20, fontSize: 13, bold: true, fontFamily: 'Courier New, monospace' }),
    el('line', { x: 12, y: 264, w: W, h: 1, bg: RULE, lineDir: 'h' }),
    txt('SHIP TO', { x: 12, y: 272, w: W, h: 12, fontSize: 8, bold: true, color: MUTED }),
    txt(o.customer, { x: 12, y: 286, w: W, h: 18, fontSize: 12, bold: true }),
    txt(o.address, { x: 12, y: 306, w: W, h: 44, fontSize: 9.5, valign: 'top', color: '#4a5568' }),
    el('table', { x: 12, y: 358, w: W, h: 120, dataPath: 'items', showFooter: false, fontSize: 9.5, headerBg: ACCENT, headerColor: '#ffffff', gridColor: RULE, zebra: true, columns: [
      { header: 'Item', expr: '{{itemName}}', width: 270, align: 'left' }, { header: 'Qty', expr: '{{quantity}}', width: 60, align: 'right' }] })
  ];
  return { mode: 'fixed', pages: [page], activePage: 0, flowPage: { size: 'A4', w: 794, h: 1123, margin: 38 }, bands: defaultBands(), watermark: defaultWatermark(), repeatPath: o.repeat, summaryOrder: [] };
}
