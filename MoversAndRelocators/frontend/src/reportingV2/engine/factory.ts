/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pure model factories (nid / baseEl / makeEl / newPageObj / defaultBands), kept as plain functions so the
 * state and sample-template modules can share them without a circular dependency.
 */
import { Bands, BandDef, PAGE_SIZES, ReportElement, ReportPage } from './models';

/** Random element ids, so elements added after loading a saved template never collide with its ids. */
export function nid(): string { return 'e' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function newPageObj(size?: string): ReportPage {
  const d = PAGE_SIZES[size || 'A4'];
  return { id: nid(), size: size || 'A4', w: d[0], h: d[1], margin: 38, elements: [] };
}

export function baseEl(type: string, x: number, y: number): ReportElement {
  return {
    id: nid(), type, x: Math.round(x), y: Math.round(y), w: 180, h: 24,
    text: '', fontFamily: 'Arial, sans-serif', fontSize: 12, bold: false, italic: false, underline: false,
    color: '#1f2733', bg: 'transparent', align: 'left', valign: 'center',
    borderW: 0, borderColor: '#1f2733', borderStyle: 'solid', radius: 0, padding: 2, band: null
  };
}

export function makeEl(type: string, x: number, y: number): ReportElement {
  const e = baseEl(type, x, y);
  if (type === 'text') { e.text = 'Label text'; }
  if (type === 'field') { e.text = '{{Invoice.InvoiceNo}}'; }
  if (type === 'line') { e.h = 2; e.w = 200; e.bg = '#1f2733'; e.lineDir = 'h'; }
  if (type === 'rect') { e.w = 200; e.h = 80; e.bg = 'transparent'; e.borderW = 1; }
  if (type === 'image') { e.w = 120; e.h = 60; e.src = ''; }
  if (type === 'barcode') { e.w = 240; e.h = 58; e.text = '{{Shipment.TrackingNo}}'; e.color = '#111111'; e.showText = true; e.symbology = 'code128'; e.padding = 0; }
  if (type === 'qrcode') { e.w = 110; e.h = 110; e.text = '{{Shipment.ShipmentNo}}'; e.color = '#111111'; e.symbology = 'qr'; e.padding = 0; }
  if (type === 'table') {
    e.w = 520; e.h = 120; e.dataPath = 'Items'; e.rowH = 22; e.showHeader = true; e.showFooter = true; e.autoHeight = true;
    e.headerBg = '#1b2230'; e.headerColor = '#ffffff'; e.gridColor = '#cdd5e1'; e.zebra = true; e.fontSize = 11;
    e.tableMode = 'loop';   // 'fixed' = single-record grid (set from the panel's Loop/Fixed toggle)
    e.columns = [
      { header: 'Description', expr: '{{Description}}', width: 240, align: 'left', footer: 'Total' },
      { header: 'Qty', expr: '{{Qty}}', width: 60, align: 'right', footer: '{{SUM($rows.Qty)}}' },
      { header: 'Rate', expr: '{{MONEY(UnitPrice)}}', width: 90, align: 'right' },
      { header: 'Amount', expr: '{{MONEY(Amount)}}', width: 110, align: 'right', footer: '{{MONEY(SUM($rows.Amount))}}' }
    ];
  }
  return e;
}

/** A new, empty SUMMARY band — free elements, optional (so it can be toggled off), sized like the
 *  report footer it usually replaces. Prints once, in flow, right after the last detail row. */
export function makeSummaryBand(h = 120): BandDef {
  return { h, on: true, optional: true, elements: [] };
}

export function defaultBands(): Bands {
  return {
    pageHeader: { h: 58, on: true, optional: false, elements: [] },
    reportHeader: { h: 120, on: true, optional: true, elements: [] },
    columnHeader: { h: 26, on: true, optional: false },
    detail: {
      rowH: 22, dataPath: 'Rows', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#1f2733',
      headerBg: '#1b2230', headerColor: '#ffffff', gridColor: '#dde3ec', zebra: true,
      columns: [{ header: 'Column', expr: '{{ }}', width: 120, align: 'left' }]
    },
    reportFooter: { h: 86, on: true, optional: true, elements: [] },
    pageFooter: { h: 28, on: true, optional: false, elements: [] }
  };
}
