/* eslint-disable @typescript-eslint/no-explicit-any */
import { defaultBands, makeEl, nid } from './factory';
import { Bands, LABEL_MARGIN, PAGE_SIZES, ReportElement, ReportPage } from './models';
import { SAMPLE_DATA, SHIPMENT } from './sample-data';

export interface SampleDef {
  key: string;
  group: string;
  name: string;
  desc: string;
  mode: 'fixed' | 'batch' | 'flow';
  size?: string;
  buildPages?: () => ReportPage[];
  buildBands?: (flowPage: { margin: number; w: number }) => Bands;
  data: () => any;
}

/**
 * Sample templates — ported 1:1 from the original report-designer.
 * Builders are PURE: they return ReportPage[] (fixed/batch) or a Bands object
 * (flow), so the state service can orchestrate mutation without a circular
 * dependency. Geometry, colours and bound expressions are unchanged.
 */
export class ReportTemplatesService {

  readonly SHIPMENT = SHIPMENT;

  private buildPage(size: string, fn: (add: (o: any) => void, W: number, H: number, M: number) => void): ReportPage {
    const d = PAGE_SIZES[size];
    const margin = (LABEL_MARGIN[size] != null ? LABEL_MARGIN[size] : 38);
    const pg: ReportPage = { id: nid(), size, w: d[0], h: d[1], margin, elements: [] };
    const add = (o: any) => { const e = makeEl(o.type, o.x || 0, o.y || 0); Object.assign(e, o); pg.elements.push(e); };
    fn(add, d[0], d[1], margin);
    return pg;
  }

  pgInvoice(pageNo = 1, pages = 1): ReportPage {
    return this.buildPage('A4', (add, W, H, M) => {
      add({ type: 'rect', x: 0, y: 0, w: W, h: 96, bg: '#f4f6fa' });
      add({ type: 'text', x: M, y: 24, w: 330, h: 26, text: '{{Company.Name}}', fontSize: 20, bold: true, color: '#1b2230' });
      add({ type: 'text', x: M, y: 52, w: 340, h: 34, text: '{{Company.AddressLine1}}, {{Company.City}}\n{{Company.Email}} · {{Company.TaxId}}', fontSize: 10, color: '#5b6577' });
      add({ type: 'text', x: W - M - 220, y: 22, w: 220, h: 30, text: 'TAX INVOICE', fontSize: 24, bold: true, color: '#2f5fe0', align: 'right' });
      add({ type: 'text', x: W - M - 220, y: 56, w: 220, h: 16, text: '{{Invoice.InvoiceNo}}', fontSize: 12, bold: true, align: 'right' });
      add({ type: 'text', x: M, y: 118, w: 200, h: 14, text: 'BILL TO', fontSize: 10, bold: true, color: '#8893a4' });
      add({ type: 'text', x: M, y: 134, w: 300, h: 62, text: '{{Customer.Name}}\n{{Customer.AddressLine1}}, {{Customer.AddressLine2}}\n{{Customer.Country}}\nTRN: {{Customer.TaxId}}', fontSize: 11 });
      add({ type: 'rect', x: W - M - 250, y: 114, w: 250, h: 84, bg: '#ffffff', borderW: 1, borderColor: '#e2e7f0', radius: 8 });
      add({ type: 'text', x: W - M - 238, y: 124, w: 120, h: 16, text: 'Invoice date', fontSize: 10, color: '#8893a4' });
      add({ type: 'text', x: W - M - 128, y: 124, w: 118, h: 16, text: '{{DATE(Invoice.InvoiceDate)}}', fontSize: 11, bold: true, align: 'right' });
      add({ type: 'text', x: W - M - 238, y: 144, w: 120, h: 16, text: 'Due date', fontSize: 10, color: '#8893a4' });
      add({ type: 'text', x: W - M - 128, y: 144, w: 118, h: 16, text: '{{DATE(Invoice.DueDate)}}', fontSize: 11, bold: true, align: 'right' });
      add({ type: 'text', x: W - M - 238, y: 164, w: 120, h: 16, text: 'Status', fontSize: 10, color: '#8893a4' });
      add({ type: 'text', x: W - M - 128, y: 164, w: 118, h: 16, text: '{{Invoice.Status}}', fontSize: 11, bold: true, align: 'right' });
      add({ type: 'line', x: M, y: 212, w: W - 2 * M, h: 1, bg: '#e2e7f0', lineDir: 'h' });
      add({ type: 'table', x: M, y: 224, w: W - 2 * M, h: 140, dataPath: 'Items', fontSize: 11, headerBg: '#1b2230', headerColor: '#ffffff', gridColor: '#e2e7f0', zebra: true, showHeader: true,
        columns: [{ header: '#', expr: '{{Sl}}', width: 36, align: 'center' }, { header: 'Description', expr: '{{Description}}', width: 300, align: 'left' }, { header: 'Qty', expr: '{{Qty}}', width: 60, align: 'right' }, { header: 'Rate', expr: '{{MONEY(UnitPrice)}}', width: 90, align: 'right' }, { header: 'Amount', expr: '{{MONEY(Amount)}}', width: 100, align: 'right' }] });
      const tx = W - M - 240, tw = 240;
      add({ type: 'text', x: tx, y: 400, w: 140, h: 16, text: 'Sub Total', fontSize: 11, color: '#5b6577', align: 'right' });
      add({ type: 'text', x: tx + 140, y: 400, w: 100, h: 16, text: '{{MONEY(SUM(Items.Amount))}}', fontSize: 11, align: 'right' });
      add({ type: 'text', x: tx, y: 420, w: 140, h: 16, text: 'VAT (5%)', fontSize: 11, color: '#5b6577', align: 'right' });
      add({ type: 'text', x: tx + 140, y: 420, w: 100, h: 16, text: '{{MONEY(Totals.TaxTotal)}}', fontSize: 11, align: 'right' });
      add({ type: 'line', x: tx, y: 442, w: tw, h: 1, bg: '#cdd5e1', lineDir: 'h' });
      add({ type: 'rect', x: tx, y: 450, w: tw, h: 34, bg: '#2f5fe0', radius: 6 });
      add({ type: 'text', x: tx + 12, y: 450, w: 120, h: 34, text: 'TOTAL DUE', fontSize: 12, bold: true, color: '#ffffff' });
      add({ type: 'text', x: tx + 120, y: 450, w: 108, h: 34, text: '{{Invoice.Currency}} {{MONEY(Totals.GrandTotal)}}', fontSize: 13, bold: true, color: '#ffffff', align: 'right' });
      add({ type: 'text', x: M, y: 452, w: 300, h: 30, text: 'In words: {{Totals.AmountInWords}}', fontSize: 10, italic: true, color: '#5b6577' });
      add({ type: 'line', x: M, y: 1050, w: W - 2 * M, h: 1, bg: '#e2e7f0', lineDir: 'h' });
      add({ type: 'text', x: M, y: 1060, w: W - 2 * M, h: 16, text: '{{Company.Name}} · {{Company.Website}} · Page ' + pageNo + ' of ' + pages, fontSize: 9.5, color: '#8893a4', align: 'center' });
    });
  }

  pgTerms(): ReportPage {
    return this.buildPage('A4', (add, W, H, M) => {
      add({ type: 'text', x: M, y: 40, w: W - 2 * M, h: 26, text: 'Terms & Conditions', fontSize: 20, bold: true, color: '#1b2230' });
      add({ type: 'line', x: M, y: 74, w: W - 2 * M, h: 2, bg: '#2f5fe0', lineDir: 'h' });
      add({ type: 'text', x: M, y: 92, w: W - 2 * M, h: 560, fontSize: 10.5, color: '#33414f', text:
        '1. Payment is due within 30 days of the invoice date unless otherwise agreed in writing.\n\n2. Late payments are subject to a service charge of 2% per month on the outstanding balance.\n\n3. All goods remain the property of {{Company.Name}} until payment is received in full.\n\n4. Liability for loss or damage is limited to the declared value of the consignment and subject to the carrier standard trading conditions.\n\n5. Claims must be submitted in writing within 7 days of delivery.\n\n6. Storage charges apply to cargo not collected within the free period stated on the arrival notice.\n\n7. These terms are governed by the laws of the United Arab Emirates.' });
      add({ type: 'text', x: M, y: 700, w: 220, h: 16, text: 'For {{Company.Name}}', fontSize: 10, color: '#5b6577' });
      add({ type: 'line', x: M, y: 760, w: 200, h: 1, bg: '#1f2733', lineDir: 'h' });
      add({ type: 'text', x: M, y: 766, w: 200, h: 14, text: 'Authorized Signatory', fontSize: 9, color: '#8893a4' });
      add({ type: 'line', x: M, y: 1050, w: W - 2 * M, h: 1, bg: '#e2e7f0', lineDir: 'h' });
      add({ type: 'text', x: M, y: 1060, w: W - 2 * M, h: 16, text: '{{Company.Name}} · {{Company.Website}} · Page 2 of 2', fontSize: 9.5, color: '#8893a4', align: 'center' });
    });
  }

  pgLabel(size: string, dark: boolean): ReportPage {
    return this.buildPage(size, (add, W, H, M) => {
      const iw = W - 2 * M, ink = dark ? '#000000' : '#1b2230';
      const big = H >= 480, med = H >= 300 && !big, tiny = H < 200;
      const hh = Math.max(20, Math.min(54, Math.round(H * 0.14)));
      add({ type: 'rect', x: 0, y: 0, w: W, h: hh, bg: ink });
      add({ type: 'text', x: M, y: Math.round(hh * 0.12), w: iw, h: Math.round(hh * 0.6), text: '{{UPPER(Carrier.Name)}}', fontSize: Math.max(10, Math.min(16, Math.round(W * 0.042))), bold: true, color: '#ffffff' });
      if (hh >= 40) { add({ type: 'text', x: M, y: Math.round(hh * 0.62), w: iw, h: 13, text: '{{Carrier.Service}}', fontSize: 9, color: '#ffffff' }); }
      let y = hh + 8;
      if (big) {
        add({ type: 'text', x: M, y, w: iw, h: 10, text: 'FROM', fontSize: 8, bold: true, color: '#8893a4' }); y += 11;
        add({ type: 'text', x: M, y, w: iw, h: 28, text: '{{From.Name}} — {{From.City}}, {{From.Country}}', fontSize: 8.5, color: '#33414f' }); y += 32;
        add({ type: 'line', x: M, y, w: iw, h: 1, bg: '#cbd3df', lineDir: 'h' }); y += 8;
        add({ type: 'text', x: M, y, w: iw, h: 11, text: 'SHIP TO', fontSize: 9, bold: true, color: ink }); y += 13;
        add({ type: 'text', x: M, y, w: iw, h: 74, text: '{{To.Name}}\n{{To.AddressLine1}}\n{{To.City}} {{To.Postcode}}\n{{To.Country}}', fontSize: 13, bold: true, color: ink }); y += 78;
        add({ type: 'text', x: M, y, w: iw, h: 12, text: 'Tel: {{To.Phone}}', fontSize: 9, color: '#33414f' }); y += 18;
        add({ type: 'line', x: M, y, w: iw, h: 1, bg: '#cbd3df', lineDir: 'h' }); y += 8;
        add({ type: 'text', x: M, y, w: 90, h: 9, text: 'WEIGHT', fontSize: 7.5, bold: true, color: '#8893a4' });
        add({ type: 'text', x: M + 100, y, w: 80, h: 9, text: 'PIECES', fontSize: 7.5, bold: true, color: '#8893a4' });
        add({ type: 'text', x: M + 190, y, w: 120, h: 9, text: 'DATE', fontSize: 7.5, bold: true, color: '#8893a4' }); y += 10;
        add({ type: 'text', x: M, y, w: 90, h: 16, text: '{{Shipment.WeightKg}} kg', fontSize: 13, bold: true, color: ink });
        add({ type: 'text', x: M + 100, y, w: 80, h: 16, text: '{{Shipment.Pieces}}', fontSize: 13, bold: true, color: ink });
        add({ type: 'text', x: M + 190, y, w: 140, h: 16, text: '{{DATE(Shipment.Date)}}', fontSize: 12, bold: true, color: ink }); y += 24;
        add({ type: 'rect', x: M, y, w: iw, h: 40, bg: dark ? '#000000' : '#eef2fb', radius: 6 });
        add({ type: 'text', x: M, y, w: iw, h: 40, text: '{{Shipment.RouteCode}}', fontSize: 22, bold: true, color: dark ? '#ffffff' : '#2f5fe0', align: 'center' }); y += 48;
      } else if (med) {
        add({ type: 'text', x: M, y, w: iw, h: 11, text: 'SHIP TO', fontSize: 9, bold: true, color: ink }); y += 13;
        add({ type: 'text', x: M, y, w: iw, h: 52, text: '{{To.Name}}\n{{To.AddressLine1}}, {{To.City}}\n{{To.Country}}', fontSize: 12, bold: true, color: ink }); y += 58;
        add({ type: 'text', x: M, y, w: iw, h: 14, text: '{{Shipment.WeightKg}} kg · {{Shipment.Pieces}} pcs · {{Shipment.RouteCode}}', fontSize: 10, color: ink }); y += 22;
      } else {
        add({ type: 'text', x: M, y, w: iw, h: 14, text: '{{To.Name}} · {{To.City}}', fontSize: tiny ? 9 : 11, bold: true, color: ink }); y += tiny ? 16 : 20;
      }
      const footH = tiny ? 0 : 14;
      add({ type: 'text', x: M, y, w: iw, h: 9, text: 'TRACKING', fontSize: 7.5, bold: true, color: '#8893a4' }); y += 10;
      add({ type: 'barcode', x: M, y, w: iw, h: Math.max(34, H - M - y - footH - 2), text: '{{Shipment.TrackingNo}}', color: ink, showText: true });
      if (!tiny) { add({ type: 'text', x: M, y: H - M - 12, w: iw, h: 12, text: 'AWB {{Shipment.AwbNo}} · {{Shipment.Ref}}', fontSize: 8, color: '#33414f', align: 'center' }); }
    });
  }

  pgInvoiceAdaptive(size: string): ReportPage {
    return this.buildPage(size, (add, W, H, M) => {
      const iw = W - 2 * M;
      add({ type: 'rect', x: 0, y: 0, w: W, h: 96, bg: '#f4f6fa' });
      add({ type: 'text', x: M, y: 24, w: Math.round(W * 0.5), h: 26, text: '{{Company.Name}}', fontSize: 20, bold: true, color: '#1b2230' });
      add({ type: 'text', x: M, y: 52, w: Math.round(W * 0.55), h: 34, text: '{{Company.AddressLine1}}, {{Company.City}}\n{{Company.Email}} · {{Company.TaxId}}', fontSize: 10, color: '#5b6577' });
      add({ type: 'text', x: W - M - 220, y: 22, w: 220, h: 30, text: 'TAX INVOICE', fontSize: 24, bold: true, color: '#2f5fe0', align: 'right' });
      add({ type: 'text', x: W - M - 220, y: 56, w: 220, h: 16, text: '{{Invoice.InvoiceNo}}', fontSize: 12, bold: true, align: 'right' });
      add({ type: 'text', x: M, y: 116, w: 200, h: 14, text: 'BILL TO', fontSize: 10, bold: true, color: '#8893a4' });
      add({ type: 'text', x: M, y: 132, w: Math.min(320, Math.round(iw * 0.55)), h: 60, text: '{{Customer.Name}}\n{{Customer.AddressLine1}}, {{Customer.AddressLine2}}\n{{Customer.Country}}\nTRN: {{Customer.TaxId}}', fontSize: 11 });
      add({ type: 'text', x: W - M - 200, y: 120, w: 90, h: 14, text: 'Date', fontSize: 10, color: '#8893a4' });
      add({ type: 'text', x: W - M - 110, y: 120, w: 110, h: 14, text: '{{DATE(Invoice.InvoiceDate)}}', fontSize: 11, bold: true, align: 'right' });
      add({ type: 'text', x: W - M - 200, y: 140, w: 90, h: 14, text: 'Due', fontSize: 10, color: '#8893a4' });
      add({ type: 'text', x: W - M - 110, y: 140, w: 110, h: 14, text: '{{DATE(Invoice.DueDate)}}', fontSize: 11, bold: true, align: 'right' });
      const tableY = 210, totalsH = 120, footerY = H - 46, tableH = Math.max(80, footerY - totalsH - tableY);
      const descW = Math.max(120, iw - 30 - 60 - 90 - 100);
      add({ type: 'line', x: M, y: tableY - 8, w: iw, h: 1, bg: '#e2e7f0', lineDir: 'h' });
      add({ type: 'table', x: M, y: tableY, w: iw, h: tableH, dataPath: 'Items', fontSize: 10.5, headerBg: '#1b2230', headerColor: '#ffffff', gridColor: '#e2e7f0', zebra: true, showHeader: true,
        columns: [{ header: '#', expr: '{{Sl}}', width: 30, align: 'center' }, { header: 'Description', expr: '{{Description}}', width: descW, align: 'left' }, { header: 'Qty', expr: '{{Qty}}', width: 60, align: 'right' }, { header: 'Rate', expr: '{{MONEY(UnitPrice)}}', width: 90, align: 'right' }, { header: 'Amount', expr: '{{MONEY(Amount)}}', width: 100, align: 'right' }] });
      const ty = footerY - totalsH, tx = W - M - 240, tw = 240;
      add({ type: 'text', x: tx, y: ty, w: 140, h: 16, text: 'Sub Total', fontSize: 11, color: '#5b6577', align: 'right' });
      add({ type: 'text', x: tx + 140, y: ty, w: 100, h: 16, text: '{{MONEY(SUM(Items.Amount))}}', fontSize: 11, align: 'right' });
      add({ type: 'text', x: tx, y: ty + 22, w: 140, h: 16, text: 'VAT (5%)', fontSize: 11, color: '#5b6577', align: 'right' });
      add({ type: 'text', x: tx + 140, y: ty + 22, w: 100, h: 16, text: '{{MONEY(Totals.TaxTotal)}}', fontSize: 11, align: 'right' });
      add({ type: 'rect', x: tx, y: ty + 48, w: tw, h: 34, bg: '#2f5fe0', radius: 6 });
      add({ type: 'text', x: tx + 12, y: ty + 48, w: 120, h: 34, text: 'TOTAL DUE', fontSize: 12, bold: true, color: '#ffffff' });
      add({ type: 'text', x: tx + 120, y: ty + 48, w: 108, h: 34, text: '{{Invoice.Currency}} {{MONEY(Totals.GrandTotal)}}', fontSize: 13, bold: true, color: '#ffffff', align: 'right' });
      add({ type: 'line', x: M, y: footerY, w: iw, h: 1, bg: '#e2e7f0', lineDir: 'h' });
      add({ type: 'text', x: M, y: footerY + 8, w: iw, h: 16, text: '{{Company.Name}} · {{Company.Website}}', fontSize: 9.5, color: '#8893a4', align: 'center' });
    });
  }

  pgMiniDoc(size: string): ReportPage {
    return this.buildPage(size, (add, W, H, M) => {
      const iw = W - 2 * M, hh = Math.min(54, Math.round(H * 0.13));
      add({ type: 'rect', x: 0, y: 0, w: W, h: hh, bg: '#1b2230' });
      add({ type: 'text', x: M, y: Math.round(hh * 0.2), w: iw, h: Math.round(hh * 0.6), text: '{{Company.Name}}', fontSize: Math.min(15, Math.round(W * 0.05)), bold: true, color: '#ffffff' });
      add({ type: 'text', x: M, y: hh + 8, w: iw, h: 14, text: 'DELIVERY NOTE', fontSize: 11, bold: true, color: '#2f5fe0' });
      add({ type: 'text', x: M, y: hh + 24, w: iw, h: 14, text: 'Ref {{Shipment.ShipmentNo}} · {{DATE(Invoice.InvoiceDate)}}', fontSize: 9, color: '#5b6577' });
      let y = hh + 44;
      add({ type: 'text', x: M, y, w: iw, h: 10, text: 'CONSIGNEE', fontSize: 8, bold: true, color: '#8893a4' }); y += 11;
      add({ type: 'text', x: M, y, w: iw, h: 30, text: '{{Customer.Name}} — {{Customer.AddressLine2}}, {{Customer.Country}}', fontSize: 9.5 }); y += 34;
      const tableH = Math.max(56, H - y - 92);
      add({ type: 'table', x: M, y, w: iw, h: tableH, dataPath: 'Items', fontSize: 9, headerBg: '#1b2230', headerColor: '#ffffff', gridColor: '#e2e7f0', zebra: true, showHeader: true,
        columns: [{ header: 'Description', expr: '{{Description}}', width: Math.max(80, iw - 50), align: 'left' }, { header: 'Qty', expr: '{{Qty}}', width: 50, align: 'right' }] });
      add({ type: 'barcode', x: M, y: H - 78, w: iw, h: 44, text: '{{Shipment.ShipmentNo}}', color: '#111111', showText: true });
      add({ type: 'text', x: M, y: H - 26, w: iw, h: 12, text: '{{Company.Website}}', fontSize: 8, color: '#8893a4', align: 'center' });
    });
  }

  pgDeliveryA5(): ReportPage {
    return this.buildPage('A5', (add, W, H, M) => {
      add({ type: 'rect', x: 0, y: 0, w: W, h: 70, bg: '#1b2230' });
      add({ type: 'text', x: M, y: 14, w: 300, h: 22, text: '{{Company.Name}}', fontSize: 16, bold: true, color: '#ffffff' });
      add({ type: 'text', x: M, y: 40, w: 300, h: 14, text: '{{Company.AddressLine1}}, {{Company.City}}', fontSize: 9, color: '#c9d2e0' });
      add({ type: 'text', x: W - M - 180, y: 16, w: 180, h: 20, text: 'DELIVERY ORDER', fontSize: 15, bold: true, color: '#ffffff', align: 'right' });
      add({ type: 'text', x: W - M - 180, y: 42, w: 180, h: 14, text: '{{Shipment.ShipmentNo}}', fontSize: 10, color: '#c9d2e0', align: 'right' });
      add({ type: 'text', x: M, y: 88, w: 120, h: 12, text: 'CONSIGNEE', fontSize: 9, bold: true, color: '#8893a4' });
      add({ type: 'text', x: M, y: 102, w: W - 2 * M, h: 54, text: '{{Customer.Name}}\n{{Customer.AddressLine1}}, {{Customer.AddressLine2}}\n{{Customer.Country}}', fontSize: 11 });
      add({ type: 'rect', x: W - M - 150, y: 88, w: 150, h: 60, bg: '#f6f8fc', borderW: 1, borderColor: '#e2e7f0', radius: 6 });
      add({ type: 'text', x: W - M - 140, y: 96, w: 130, h: 14, text: 'Date: {{DATE(Invoice.InvoiceDate)}}', fontSize: 9 });
      add({ type: 'text', x: W - M - 140, y: 114, w: 130, h: 14, text: 'B/L: {{Shipment.BlNo}}', fontSize: 9 });
      add({ type: 'text', x: W - M - 140, y: 132, w: 130, h: 14, text: 'Vessel: {{Shipment.Vessel}}', fontSize: 9 });
      add({ type: 'line', x: M, y: 166, w: W - 2 * M, h: 1, bg: '#e2e7f0', lineDir: 'h' });
      add({ type: 'table', x: M, y: 176, w: W - 2 * M, h: 120, dataPath: 'Items', fontSize: 10, headerBg: '#1b2230', headerColor: '#ffffff', gridColor: '#e2e7f0', zebra: true, showHeader: true,
        columns: [{ header: '#', expr: '{{Sl}}', width: 30, align: 'center' }, { header: 'Description', expr: '{{Description}}', width: 240, align: 'left' }, { header: 'Qty', expr: '{{Qty}}', width: 60, align: 'right' }, { header: 'Unit', expr: '{{Unit}}', width: 80, align: 'left' }] });
      add({ type: 'text', x: M, y: H - 120, w: 200, h: 14, text: 'Received the above goods in good order:', fontSize: 9.5, color: '#33414f' });
      add({ type: 'line', x: M, y: H - 70, w: 180, h: 1, bg: '#1f2733', lineDir: 'h' });
      add({ type: 'text', x: M, y: H - 64, w: 180, h: 14, text: 'Receiver signature & date', fontSize: 8.5, color: '#8893a4' });
      add({ type: 'line', x: W - M - 180, y: H - 70, w: 180, h: 1, bg: '#1f2733', lineDir: 'h' });
      add({ type: 'text', x: W - M - 180, y: H - 64, w: 180, h: 14, text: 'For {{Company.Name}}', fontSize: 8.5, color: '#8893a4', align: 'right' });
    });
  }

  /** Build the Statement-of-Account flow bands (the original statementTemplate). */
  buildStatementBands(margin: number, W: number): Bands {
    const M = margin, innerW = W - 2 * M;
    const b = defaultBands();
    const el = (type: string, x: number, y: number, w: number, h: number, extra?: any): ReportElement => {
      const e = makeEl(type, x, y); e.w = w; e.h = h; Object.assign(e, extra || {}); return e;
    };
    b.pageHeader.h = 58; b.pageHeader.elements = [
      el('text', 0, 6, 300, 22, { text: '{{Company.Name}}', fontSize: 15, bold: true, color: '#1b2230' }),
      el('text', innerW - 260, 4, 260, 22, { text: 'STATEMENT OF ACCOUNT', fontSize: 16, bold: true, color: '#2f5fe0', align: 'right' }),
      el('text', innerW - 260, 28, 260, 14, { text: 'Page {{PAGE}} of {{PAGES}} · {{Statement.Period}}', fontSize: 10, color: '#5b6577', align: 'right' }),
      el('line', 0, 52, innerW, 2, { bg: '#1b2230', lineDir: 'h' })
    ];
    b.reportHeader.h = 120; b.reportHeader.on = true; b.reportHeader.elements = [
      el('text', 0, 8, 120, 14, { text: 'ACCOUNT', fontSize: 10, bold: true, color: '#8893a4' }),
      el('text', 0, 24, 320, 60, { text: '{{Customer.Name}}  ({{Customer.AccountNo}})\n{{Customer.AddressLine1}}, {{Customer.AddressLine2}}\nTRN: {{Customer.TaxId}}', fontSize: 11, color: '#1f2733' }),
      el('rect', innerW - 240, 8, 240, 84, { bg: '#f6f8fc', borderW: 1, borderColor: '#e2e7f0', radius: 8 }),
      el('text', innerW - 228, 18, 120, 14, { text: 'Statement date', fontSize: 10, color: '#8893a4' }),
      el('text', innerW - 128, 18, 118, 14, { text: '{{DATE(Statement.AsOnDate)}}', fontSize: 11, bold: true, align: 'right' }),
      el('text', innerW - 228, 40, 120, 14, { text: 'Opening balance', fontSize: 10, color: '#8893a4' }),
      el('text', innerW - 128, 40, 118, 14, { text: '{{MONEY(Statement.OpeningBalance)}}', fontSize: 11, bold: true, align: 'right' }),
      el('text', innerW - 228, 62, 120, 14, { text: 'Currency', fontSize: 10, color: '#8893a4' }),
      el('text', innerW - 128, 62, 118, 14, { text: '{{Statement.Currency}}', fontSize: 11, bold: true, align: 'right' })
    ];
    b.columnHeader.h = 26;
    b.detail.dataPath = 'Rows'; b.detail.rowH = 22; b.detail.fontSize = 10.5; b.detail.headerBg = '#1b2230'; b.detail.headerColor = '#fff'; b.detail.gridColor = '#e2e7f0'; b.detail.zebra = true;
    b.detail.columns = [
      { header: 'Date', expr: '{{DATE(Date)}}', width: 80, align: 'left' },
      { header: 'Reference', expr: '{{RefNo}}', width: 110, align: 'left' },
      { header: 'Description', expr: '{{Description}}', width: innerW - 80 - 110 - 90 - 90 - 100, align: 'left' },
      { header: 'Debit', expr: '{{IF(Debit>0,MONEY(Debit),"")}}', width: 90, align: 'right' },
      { header: 'Credit', expr: '{{IF(Credit>0,MONEY(Credit),"")}}', width: 90, align: 'right' },
      { header: 'Balance', expr: '{{MONEY(Balance)}}', width: 100, align: 'right' }
    ];
    b.reportFooter.h = 86; b.reportFooter.on = true; b.reportFooter.elements = [
      el('line', 0, 6, innerW, 2, { bg: '#cdd5e1', lineDir: 'h' }),
      el('text', 0, 16, 200, 14, { text: 'Total Debit: {{MONEY(Totals.TotalDebit)}}', fontSize: 11, color: '#5b6577' }),
      el('text', 0, 34, 200, 14, { text: 'Total Credit: {{MONEY(Totals.TotalCredit)}}', fontSize: 11, color: '#5b6577' }),
      el('rect', innerW - 260, 18, 260, 46, { bg: '#2f5fe0', radius: 8 }),
      el('text', innerW - 248, 18, 150, 46, { text: 'CLOSING BALANCE', fontSize: 11, bold: true, color: '#fff' }),
      el('text', innerW - 248, 18, 248, 46, { text: '{{Statement.Currency}} {{MONEY(Statement.ClosingBalance)}}', fontSize: 14, bold: true, color: '#fff', align: 'right' })
    ];
    b.pageFooter.h = 28; b.pageFooter.elements = [
      el('line', 0, 2, innerW, 1, { bg: '#e2e7f0', lineDir: 'h' }),
      el('text', 0, 8, innerW, 14, { text: '{{Company.Name}} · {{Company.Website}}  —  Page {{PAGE}} of {{PAGES}}', fontSize: 9.5, color: '#8893a4', align: 'center' })
    ];
    return b;
  }

  buildSamples(): SampleDef[] {
    const list: SampleDef[] = [
      { key: 'a4invoice', group: 'Featured', name: 'Tax Invoice — 2 pages', desc: 'A4 · invoice + terms', mode: 'fixed', buildPages: () => [this.pgInvoice(1, 2), this.pgTerms()], data: () => SAMPLE_DATA.fixed },
      { key: 'statement', group: 'Featured', name: 'Statement of Account', desc: 'A4 · flowing multi-page', mode: 'flow', size: 'A4', buildBands: (fp) => this.buildStatementBands(fp.margin, fp.w), data: () => SAMPLE_DATA.flow },
      { key: 'deliveryA5', group: 'Featured', name: 'Delivery Order', desc: 'A5 · single page', mode: 'fixed', buildPages: () => [this.pgDeliveryA5()], data: () => SAMPLE_DATA.fixed },
      { key: 'batchinvoice', group: 'Featured', name: 'Batch Invoices', desc: 'A4 · one page per record', mode: 'batch', buildPages: () => [this.pgInvoiceAdaptive('A4')], data: () => SAMPLE_DATA.batch },
      { key: 'shipbatch', group: 'Featured', name: 'Label run (batch)', desc: '4×6 · one label per parcel', mode: 'batch', buildPages: () => [this.pgLabel('4x6', false)], data: () => [SHIPMENT] }
    ];
    ([['A4', '210×297 mm', 'Invoice'], ['A4-L', '297×210 mm', 'Invoice (landscape)'], ['A5', '148×210 mm', 'Invoice'], ['A5-L', '210×148 mm', 'Invoice (landscape)'], ['Letter', '8.5×11 in', 'Invoice'], ['Legal', '8.5×14 in', 'Invoice'], ['A6', '105×148 mm', 'Mini delivery note'], ['A7', '74×105 mm', 'Mini delivery note']] as [string, string, string][]).forEach(([sz, dim, kind]) => {
      const mini = (sz === 'A6' || sz === 'A7');
      list.push({ key: 'doc_' + sz, group: 'Documents — one per size', name: sz + ' · ' + kind, desc: dim, mode: 'fixed', buildPages: () => [mini ? this.pgMiniDoc(sz) : this.pgInvoiceAdaptive(sz)], data: () => SAMPLE_DATA.fixed });
    });
    ([['4x6', '102×152 mm'], ['6x4', '152×102 mm'], ['4x4', '102×102 mm'], ['4x3', '102×76 mm'], ['3x2', '76×51 mm'], ['2x1', '51×25 mm']] as [string, string][]).forEach(([sz, dim]) => {
      list.push({ key: 'lbl_' + sz, group: 'Cargo / shipping labels', name: 'Shipping label ' + sz + ' in', desc: dim, mode: 'fixed', buildPages: () => [this.pgLabel(sz, false)], data: () => SHIPMENT });
    });
    ([['100x150', '100×150 mm', true], ['150x100', '150×100 mm', true], ['100x100', '100×100 mm', true], ['100x50', '100×50 mm (carton)', true], ['105x148', '105×148 mm (parcel)', false]] as [string, string, boolean][]).forEach(([sz, dim, dark]) => {
      list.push({ key: 'th_' + sz, group: 'Thermal / GS1 labels', name: 'Thermal label ' + sz, desc: dim + (dark ? ' · mono' : ''), mode: 'fixed', buildPages: () => [this.pgLabel(sz, dark)], data: () => SHIPMENT });
    });
    return list;
  }
}
