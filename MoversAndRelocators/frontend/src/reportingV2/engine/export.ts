/* eslint-disable @typescript-eslint/no-explicit-any */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ReportExpressionService } from './expression';
import { mm } from './models';
import { ReportRenderService, SYSTEM_FOOTER } from './render';
import { ReportStateService } from './state';

export interface SheetHTML { html: string; w: number; h: number; }

/**
 * Export service — HTML download, print, and PDF (html2canvas + jsPDF in the browser).
 * The designer passes a hidden staging container (setRoots) used for offscreen PDF rendering.
 */
export class ReportExportService {

  private printStyleInjected = false;
  private exportRoot?: HTMLElement;

  constructor(private state: ReportStateService, private render: ReportRenderService, private expr: ReportExpressionService) { }

  /** Called once by the shell after its view inits, supplying the hidden PDF staging container. */
  setRoots(exportRoot: HTMLElement): void { this.exportRoot = exportRoot; }
  private progress(msg: string): void { this.state.toast(msg); }

  fileName = '';
  reportName(): string { if (this.fileName) { return this.fileName; } const d = this.state.previewRecord(); return (d && (d.DocumentNo || (d.Invoice && d.Invoice.InvoiceNo))) || (this.state.doc.mode === 'flow' ? 'statement' : 'report'); }

  /* ---------- page HTML builders ---------- */
  private recordPageHTML(record: any, pageObj: any): string {
    const saved = this.expr.bind; this.expr.bind = record || {};
    const html = (pageObj.elements || []).map((e: any) => this.render.renderElementHTML(e, true, 0, 0)).join('');
    this.expr.bind = saved;
    return html;
  }

  /** CSS that lets an Auto-height detail table wrap. The exported document and the PDF print root both
   *  force `white-space:nowrap` + ellipsis on every report table, which would override the inline style
   *  buildTable writes — so the wrap variant has to be un-set by a rule of equal-or-higher specificity
   *  wherever that base rule appears. Keep this in step with buildTable's `rev2-rpt-wrap` class. */
  static readonly WRAP_CSS =
    'table.rev2-rpt.rev2-rpt-wrap td,table.rev2-rpt.rev2-rpt-wrap th' +
    '{white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;overflow-wrap:anywhere}';

  /** Table options for the flow DETAIL band. `wrap` turns on cell wrapping and `rowMinH` keeps rowH as
   *  a MINIMUM height, so Auto height never makes rows thinner than the design intends. */
  private detailTableOpts(b: any): any {
    // Column-header typography is configured on the columnHeader band; fall back to the detail band's
    // header colours so existing templates render unchanged. bold defaults ON in the renderer.
    const ch = b.columnHeader || {};
    return {
      fontFamily: b.detail.fontFamily, fontSize: b.detail.fontSize, color: b.detail.color,
      headerBg: ch.headerBg || ch.bg || b.detail.headerBg,
      headerColor: ch.headerColor || ch.color || b.detail.headerColor,
      gridColor: b.detail.gridColor,
      zebra: b.detail.zebra, showHeader: b.columnHeader.on,
      // Header font controls (undefined => renderer keeps the default bold look).
      headerFontFamily: ch.fontFamily,
      headerFontSize: ch.fontSize,
      headerBold: ch.bold,
      headerItalic: ch.italic,
      headerUnderline: ch.underline,
      wrap: !!b.detail.autoHeight,
      rowMinH: b.detail.autoHeight ? (b.detail.rowH || 0) : 0
    };
  }

  /**
   * Measure the real rendered height of every detail row, off-screen, using the SAME markup and CSS the
   * page will use — so pagination packs by fact rather than by the `rowH` guess.
   *
   * Returns [] when there is no DOM (then paginateFlow falls back to rowH), so this stays safe in any
   * non-browser context.
   */
  private measureRowHeights(b: any, rows: any[], innerW: number): number[] {
    if (typeof document === 'undefined' || !rows.length) { return []; }
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;width:' + innerW + 'px';
    // The base nowrap rule lives in the exported document's stylesheet, so replicate BOTH it and the
    // wrap override here — otherwise the measurement would wrap while the real sheet clips, or vice versa.
    host.innerHTML =
      '<style>table.rev2-rpt{border-collapse:collapse;width:100%;table-layout:fixed}' +
      'table.rev2-rpt td,table.rev2-rpt th{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      ReportExportService.WRAP_CSS + '</style>' +
      this.render.buildTable(b.detail.columns || [], this.detailTableOpts(b), rows, true);
    document.body.appendChild(host);
    const out: number[] = [];
    try {
      const trs = host.querySelectorAll('tbody tr');
      for (let i = 0; i < trs.length; i++) {
        out.push(Math.ceil((trs[i] as HTMLElement).getBoundingClientRect().height));
      }
    } finally {
      document.body.removeChild(host);
    }
    return out;
  }

  private flowPagesHTML(): SheetHTML[] {
    const b = this.state.doc.bands; const data = this.state.datasets.flow || {};
    const saved = this.expr.bind; this.expr.bind = data;
    const page: any = this.state.doc.page;
    const rowsV = this.expr.getPath(b.detail.dataPath as string, data);
    const rows = Array.isArray(rowsV) ? rowsV : [];
    const M = page.margin, innerW = page.w - 2 * M;
    // Auto height: measure what each row REALLY is before deciding what fits, instead of trusting rowH.
    const autoH = !!b.detail.autoHeight;
    const heights = autoH ? this.measureRowHeights(b, rows, innerW) : undefined;
    const pages = this.state.paginateFlow(rows, heights);
    const N = pages.length;
    const out: SheetHTML[] = [];
    pages.forEach((p: any, k: number) => {
      let inner = '';
      const extra = { PAGE: k + 1, PAGES: N };
      let y = M;
      const place = (bandId: string, ox: number, oy: number) => {
        (b[bandId].elements || []).forEach((e: any) => { inner += this.render.renderElementHTML(e, true, ox, oy, extra); });
      };
      if (b.pageHeader.on) { place('pageHeader', M, y); y += (b.pageHeader.h || 0); }
      if (!(b.reportHeader.optional && !b.reportHeader.on) && p.first) { place('reportHeader', M, y); y += (b.reportHeader.h || 0); }
      if (!p.footerOnly && !p.summaryOnly) {
        const opts = this.detailTableOpts(b);
        inner += '<div style="position:absolute;left:' + M + 'px;top:' + y + 'px;width:' + innerW + 'px">' + this.render.buildTable(b.detail.columns || [], opts, p.rows, true) + '</div>';
        // Advance PAST the table so whatever follows starts where the rows actually ended.
        // The column header is the table's own <thead>, and paginateFlow reserves it in `top` while
        // `usedH` counts rows only — so the drawn height is chH + usedH.
        y += (b.columnHeader.on ? (b.columnHeader.h || 0) : 0) + (p.usedH || 0);
      }
      // SUMMARY bands — normal flowing content, in order, straight after the detail loop. Unlike the
      // report footer below they are NOT pinned to the page bottom, which is what removes the blank
      // band between the end of the rows and the block.
      (p.summaries || []).forEach((sid: string) => {
        place(sid, M, y);
        y += (b[sid] && b[sid].h) || 0;
      });
      if (p.footer) { const rfTop = page.h - M - (b.pageFooter.on ? (b.pageFooter.h || 0) : 0) - (b.reportFooter.h || 0); place('reportFooter', M, rfTop); }
      if (b.pageFooter.on) { const pfTop = page.h - M - (b.pageFooter.h || 0); place('pageFooter', M, pfTop); }
      out.push({ html: inner, w: page.w, h: page.h });
    });
    this.expr.bind = saved;
    return out;
  }

  exportSheets(): SheetHTML[] {
    const sheets = this.rawExportSheets();
    // Stamp the document watermark onto every page so it appears in the HTML export, print and PDF
    // exactly as it does on the design/preview surface.
    const wm = this.render.watermarkHTML(this.state.doc.watermark);
    // The tenant letterhead footer note replaces the default "system generated" line when set.
    const rec = this.state.previewRecord();
    const note = (rec && rec.company && rec.company.footerNote) || SYSTEM_FOOTER;
    // The optional watermark AND the mandatory system footer are stamped onto every page here — so they
    // appear in the HTML export, print, PDF and on-page viewer for EVERY report and cannot be removed
    // from a template (the footer is not a template element; it is injected at render time).
    return sheets.map(s => {
      const footer = this.render.mandatoryFooterHTML(s.w, s.h, this.marginFor(s.w, s.h), note);
      return { ...s, html: s.html + (wm || '') + footer };
    });
  }

  /** Bottom-margin height for a sheet of the given size (matches the page it was produced from), so the
   *  mandatory footer sits inside that page's bottom margin. */
  private marginFor(w: number, h: number): number {
    const pg = (this.state.doc.pages || []).find((p: any) => p.w === w && p.h === h) as any;
    if (pg && typeof pg.margin === 'number') { return pg.margin; }
    const fp: any = this.state.doc.flowPage;
    if (fp && fp.w === w && fp.h === h && typeof fp.margin === 'number') { return fp.margin; }
    const pageM = this.state.doc.page && (this.state.doc.page as any).margin;
    return typeof pageM === 'number' ? pageM : 30;
  }

  private rawExportSheets(): SheetHTML[] {
    const doc = this.state.doc;
    // "Repeat page for each": one page-set per item of doc.repeatPath (each merged with the record).
    // Ignored in flow mode: a flow document has no designed pages to repeat and paginates its detail
    // band itself, so a repeatPath carried over from a fixed template would otherwise silently render
    // the OLD fixed pages once per item - the same content on every page, with no pagination at all.
    if (doc.mode !== 'flow' && doc.repeatPath && this.state.repeatRecords().length) {
      const out: SheetHTML[] = [];
      this.state.repeatRecords().forEach(r => doc.pages.forEach(pg => out.push({ html: this.recordPageHTML(r, pg), w: pg.w, h: pg.h })));
      return out;
    }
    if (doc.mode === 'fixed') { return doc.pages.map(pg => ({ html: this.recordPageHTML(this.state.currentData(), pg), w: pg.w, h: pg.h })); }
    if (doc.mode === 'batch') {
      const out: SheetHTML[] = [];
      this.state.batchRecords().forEach(r => doc.pages.forEach(pg => out.push({ html: this.recordPageHTML(r, pg), w: pg.w, h: pg.h })));
      return out;
    }
    return this.flowPagesHTML();
  }

  buildStandaloneHTML(extraCss: string = ''): string {
    return this.buildDocumentHTML(this.exportSheets(), extraCss);
  }

  /** Wrap READY-MADE sheets in the standalone report document. Split out of buildStandaloneHTML so a
   *  caller can concatenate the sheets produced by SEVERAL templates — e.g. the booking pages and the
   *  master pages of one multi-select print — into a single document. `pageOverride` sets the @page
   *  paper size when the sheets did not come from this instance's own document. */
  buildDocumentHTML(sheets: SheetHTML[], extraCss: string = '', pageOverride?: any): string {
    const page: any = pageOverride || this.state.doc.page;
    const inner = sheets.map(p => '<div class="rev2-psheet" style="width:' + p.w + 'px;height:' + p.h + 'px;position:relative;background:#fff;overflow:hidden">' + p.html + '</div>').join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report</title><style>@page{size:${mm(page.w)} ${mm(page.h)};margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}body{margin:0;background:#eef1f5}.rev2-psheet{margin:18px auto 18px;box-shadow:0 6px 24px rgba(0,0,0,.12)}.rev2-de{position:absolute;overflow:hidden;display:flex}.rev2-de-content{width:100%;height:100%;display:flex;overflow:hidden;line-height:1.25}table.rev2-rpt{border-collapse:collapse;width:100%;table-layout:fixed}table.rev2-rpt td,table.rev2-rpt th{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}${ReportExportService.WRAP_CSS}@media print{body{background:#fff}.rev2-psheet{box-shadow:none;margin:0;overflow:hidden;break-inside:avoid;break-after:page}.rev2-psheet:last-child{break-after:auto}}${extraCss}</style></head><body>${inner}</body></html>`;
  }

  download(name: string, content: string, type?: string): void {
    const b = new Blob([content], { type: type || 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  downloadHTML(): void { this.download(this.reportName() + '.html', this.buildStandaloneHTML(), 'text/html'); }
  downloadLayout(): void { this.download('report-layout.json', JSON.stringify(this.state.exportLayout(), null, 2), 'application/json'); }

  /* ---------- print ---------- */
  private ensurePrintStyle(): void {
    if (this.printStyleInjected) { return; }
    const s = document.createElement('style'); s.id = 'rev2-print-style';
    s.textContent = `@media print{
      @page{margin:0}
      html,body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;overflow:visible!important}
      body.rev2-printing > *:not(#rev2PrintRoot){display:none!important}
      body.rev2-printing #rev2PrintRoot{display:block!important;position:static}
      #rev2PrintRoot .rev2-psheet{margin:0!important;padding:0!important;box-shadow:none!important;outline:none!important;overflow:hidden;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}
      #rev2PrintRoot .rev2-psheet:last-child{break-after:auto;page-break-after:auto}
      #rev2PrintRoot .rev2-de{position:absolute;overflow:hidden;display:flex}
      #rev2PrintRoot .rev2-de-content{width:100%;height:100%;display:flex;overflow:hidden;line-height:1.25}
      #rev2PrintRoot table.rev2-rpt{border-collapse:collapse;width:100%;table-layout:fixed}
      #rev2PrintRoot table.rev2-rpt td,#rev2PrintRoot table.rev2-rpt th{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #rev2PrintRoot table.rev2-rpt.rev2-rpt-wrap td,#rev2PrintRoot table.rev2-rpt.rev2-rpt-wrap th{white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;overflow-wrap:anywhere}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    }
    #rev2PrintRoot{display:none}`;
    document.head.appendChild(s); this.printStyleInjected = true;
  }

  private setPageStyle(): void {
    const page: any = this.state.doc.page;
    let s = document.getElementById('rev2-dyn-page'); if (!s) { s = document.createElement('style'); s.id = 'rev2-dyn-page'; document.head.appendChild(s); }
    s.textContent = '@page{size:' + mm(page.w) + ' ' + mm(page.h) + ';margin:0}';
  }

  print(): void {
    this.ensurePrintStyle();
    // Stage into a container that is a DIRECT child of <body>, so the global
    // "hide everything except #rev2PrintRoot" print rule works (the in-overlay
    // root would be hidden along with the rest of the app tree).
    let printRoot = document.getElementById('rev2PrintRoot') as HTMLElement | null;
    if (!printRoot || printRoot.parentElement !== document.body) {
      if (printRoot) { printRoot.remove(); }
      printRoot = document.createElement('div'); printRoot.id = 'rev2PrintRoot';
      document.body.appendChild(printRoot);
    }
    printRoot.innerHTML = '';
    this.exportSheets().forEach(p => {
      const d = document.createElement('div'); d.className = 'rev2-psheet';
      d.style.width = p.w + 'px'; d.style.height = p.h + 'px'; d.style.position = 'relative'; d.style.background = '#fff'; d.style.overflow = 'hidden';
      d.style.boxShadow = 'none'; d.style.outline = 'none'; d.style.margin = '0';
      d.innerHTML = p.html; printRoot!.appendChild(d);
    });
    this.setPageStyle();
    document.body.classList.add('rev2-printing'); printRoot.style.display = 'block';
    window.print();
    setTimeout(() => { printRoot!.style.display = 'none'; printRoot!.innerHTML = ''; document.body.classList.remove('rev2-printing'); }, 500);
  }

  /* ---------- browser PDF ---------- */
  private makeSheetNode(p: SheetHTML): HTMLElement {
    const node = document.createElement('div');
    node.style.width = p.w + 'px'; node.style.height = p.h + 'px'; node.style.position = 'relative'; node.style.background = '#fff'; node.style.overflow = 'hidden';
    node.style.boxShadow = 'none'; node.style.outline = 'none'; node.style.margin = '0';
    node.innerHTML = p.html;
    return node;
  }

  /** CSS applied on top of the standalone document when it is used purely as a PDF staging surface:
   *  drop the on-screen page chrome (grey backdrop, page gap, drop shadow) so each sheet rasterises
   *  edge to edge. Everything else stays exactly as the preview renders it. */
  private static readonly PDF_STAGE_CSS =
    'html,body{background:#fff!important;margin:0!important;padding:0!important}' +
    '.rev2-psheet{margin:0!important;box-shadow:none!important;outline:none!important}';

  /** Wait for webfonts and images inside a staged document so nothing rasterises half-loaded. */
  private async waitForAssets(doc: Document): Promise<void> {
    try {
      const fonts = (doc as any).fonts;
      if (fonts && fonts.ready) { await fonts.ready; }
    } catch { /* FontFaceSet unsupported — fall through to the image wait */ }

    const images = Array.prototype.slice.call(doc.images || []) as HTMLImageElement[];
    await Promise.all(images.map(img => img.complete
      ? Promise.resolve(null)
      : new Promise(res => { img.onload = img.onerror = () => res(null); })));

    await new Promise(r => requestAnimationFrame(() => r(null)));
  }

  /** `sheetsIn` lets the caller export pages it assembled itself — e.g. the on-page viewer
   *  concatenating the pages of SEVERAL templates for one multi-select print. Omit it and this exports
   *  its own document exactly as before. */
  async exportPDF(sheetsIn?: SheetHTML[]): Promise<void> {
    const exportRoot = this.exportRoot; if (!exportRoot) { return; }
    const sheets = (sheetsIn && sheetsIn.length) ? sheetsIn : this.exportSheets(); const n = sheets.length;
    if (n > 150 && !confirm(n + ' pages will be rendered to PDF in the browser. This can take a while and the file will be large.\n\nFor runs this size the server-side (vector) route is strongly recommended. Continue anyway?')) { return; }
    const scale = n > 200 ? 1.5 : n > 60 ? 2 : 3;
    const useJpeg = n > 40;
    exportRoot.style.left = '0'; exportRoot.style.top = '0'; exportRoot.style.position = 'fixed'; exportRoot.style.opacity = '0'; exportRoot.style.zIndex = '-1'; exportRoot.style.background = '#fff';
    this.progress('Preparing PDF…');

    // Rasterise the SAME standalone document the preview iframe and Print use, staged in an offscreen
    // iframe. Rendering the bare element HTML in the host page instead loses every .rev2-* rule that
    // positions and styles the report (the host only carries the shell's own CSS), which is what made
    // the PDF look nothing like the preview. Same document in, same pixels out.
    const maxW = sheets.reduce((m, p) => Math.max(m, p.w), 0);
    const maxH = sheets.reduce((m, p) => Math.max(m, p.h), 0);

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.border = '0'; frame.style.background = '#fff';
    frame.style.width = (maxW + 2) + 'px'; frame.style.height = (maxH + 2) + 'px';
    exportRoot.innerHTML = ''; exportRoot.appendChild(frame);

    let pdf: any = null;
    try {
      const fdoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      if (!fdoc) { throw new Error('Could not stage the report for PDF export.'); }

      fdoc.open();
      fdoc.write(this.buildDocumentHTML(sheets, ReportExportService.PDF_STAGE_CSS));
      fdoc.close();

      await this.waitForAssets(fdoc);

      const nodes = Array.prototype.slice.call(fdoc.querySelectorAll('.rev2-psheet')) as HTMLElement[];
      if (!nodes.length) { throw new Error('Nothing to export.'); }

      for (let i = 0; i < nodes.length; i++) {
        const p = sheets[i] || sheets[sheets.length - 1];
        const w = p.w, h = p.h;

        const canvas = await html2canvas(nodes[i], {
          scale, useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 0,
          width: w, height: h, windowWidth: w, windowHeight: h, scrollX: 0, scrollY: 0
        });

        const img = canvas.toDataURL(useJpeg ? 'image/jpeg' : 'image/png', useJpeg ? 0.92 : 1);
        const orient = w > h ? 'landscape' : 'portrait';
        if (!pdf) { pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: orient as any, compress: true }); }
        else { pdf.addPage([w, h], orient as any); }
        pdf.addImage(img, useJpeg ? 'JPEG' : 'PNG', 0, 0, w, h);
        canvas.width = canvas.height = 0;
        this.progress('Rendering PDF… ' + (i + 1) + ' / ' + nodes.length);
        await new Promise(r => setTimeout(r, 0));
      }

      pdf.save(this.reportName() + '.pdf');
      this.progress('PDF ready · ' + nodes.length + (nodes.length === 1 ? ' page' : ' pages'));
    } catch (err: any) { console.error(err); this.progress('PDF failed: ' + ((err && err.message) || err)); }
    finally { exportRoot.innerHTML = ''; exportRoot.style.left = '-99999px'; exportRoot.style.opacity = '1'; pdf = null; }
  }

  /** Top-level PDF dispatcher: html2canvas+jsPDF, falling back to the browser print dialog. */
  async exportPdfDispatch(): Promise<void> {
    try { await this.exportPDF(); }
    catch (e) { this.print(); }
  }
}
