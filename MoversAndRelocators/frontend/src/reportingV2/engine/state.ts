/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subject } from './subject';
import { ReportExpressionService } from './expression';
import { defaultBands, makeEl, makeSummaryBand, newPageObj, nid } from './factory';
import {
  Bands, bandOrder, Datasets, defaultWatermark, FlowPage, isFreeBand, isSummaryBand,
  MAX_SUMMARY_BANDS, PAGE_SIZES,
  ReportDoc, ReportElement, ReportMode, ReportPage, TabName, ToolName, ViewMode, WatermarkConfig
} from './models';
import { SAMPLE_DATA } from './sample-data';
import { ReportTemplatesService, SampleDef } from './samples';

/**
 * Central editor state — the Angular store for Report Engine V2.
 * Ported 1:1 from the original report-designer global state (doc / DATASETS /
 * selId / history …). Methods mutate state and emit `changes$` / `toast$` so the
 * shell and child components stay in sync. Default change detection picks up
 * binding updates because every mutation originates from an Angular event.
 */
export class ReportStateService {

  doc: ReportDoc = {
    mode: 'fixed', pages: [newPageObj('A4')], activePage: 0,
    page: null, elements: null, flowPage: { size: 'A4', w: 794, h: 1123, margin: 38 }, bands: defaultBands(),
    watermark: defaultWatermark(), repeatPath: '', summaryOrder: []
  };
  datasets: Datasets = { fixed: {}, batch: [], flow: {} };

  selId: string | null = null;
  selBand: string | null = null;
  tool: ToolName = 'select';
  viewMode: ViewMode = 'design';
  zoom = 1;
  grid = false;
  activeTab: TabName = 'props';

  /** Editor context (set by the toolbar from the route). reportTypeGuid keys the watermark suggestions. */
  reportType = '';
  reportTypeGuid = '';

  readonly samples: SampleDef[];

  changes$ = new Subject<void>();
  toast$ = new Subject<string>();

  private hist: string[] = [];
  private hpos = -1;

  constructor(private expr: ReportExpressionService, private templates: ReportTemplatesService) {
    this.samples = this.templates.buildSamples();
  }

  /* ---------- boot ---------- */
  init(): void {
    this.datasets = JSON.parse(JSON.stringify(SAMPLE_DATA));
    // pre-build the flow (statement) bands so switching to flow is instant
    this.doc.mode = 'flow'; this.syncActive();
    this.doc.bands = this.templates.buildStatementBands(this.doc.flowPage.margin, this.doc.flowPage.w);
    this.selId = null; this.selBand = null;
    // active template = 2-page A4 invoice
    this.doc.mode = 'fixed'; this.doc.pages = [this.templates.pgInvoice(1, 2), this.templates.pgTerms()]; this.doc.activePage = 0;
    this.syncActive();
    this.pushHistory(); this.emit();
  }

  emit(): void { this.changes$.next(); }
  toast(msg: string): void { this.toast$.next(msg); }

  /* ---------- page model ---------- */
  P(): ReportPage { return this.doc.pages[this.doc.activePage]; }

  syncActive(): void {
    if (this.doc.activePage >= this.doc.pages.length) { this.doc.activePage = Math.max(0, this.doc.pages.length - 1); }
    if (this.doc.mode === 'flow') { this.doc.page = this.doc.flowPage; this.doc.elements = []; }
    else { this.doc.page = this.doc.pages[this.doc.activePage]; this.doc.elements = this.doc.pages[this.doc.activePage].elements; }
  }

  get page(): any { return this.doc.page; }
  get elements(): ReportElement[] { return (this.doc.elements || []) as ReportElement[]; }

  setActivePage(i: number): void { this.doc.activePage = Math.max(0, Math.min(i, this.doc.pages.length - 1)); this.selId = null; this.selBand = null; this.syncActive(); this.emit(); }
  addPage(size?: string): void { const np = newPageObj(size || (this.P() ? this.P().size : 'A4')); this.doc.pages.push(np); this.doc.activePage = this.doc.pages.length - 1; this.selId = null; this.syncActive(); this.pushHistory(); this.emit(); this.toast('Page ' + this.doc.pages.length + ' added'); }
  dupPage(i: number): void { const src = this.doc.pages[i]; const copy: ReportPage = JSON.parse(JSON.stringify(src)); copy.id = nid(); copy.elements.forEach(e => e.id = nid()); this.doc.pages.splice(i + 1, 0, copy); this.doc.activePage = i + 1; this.selId = null; this.syncActive(); this.pushHistory(); this.emit(); this.toast('Page duplicated'); }
  deletePage(i: number): void { if (this.doc.pages.length <= 1) { this.toast('A template needs at least one page'); return; } this.doc.pages.splice(i, 1); this.doc.activePage = Math.max(0, Math.min(this.doc.activePage, this.doc.pages.length - 1)); this.selId = null; this.syncActive(); this.pushHistory(); this.emit(); this.toast('Page deleted'); }

  /* ---------- history ---------- */
  private snap(): string { return JSON.stringify({ mode: this.doc.mode, pages: this.doc.pages, activePage: this.doc.activePage, flowPage: this.doc.flowPage, bands: this.doc.bands, watermark: this.doc.watermark, repeatPath: this.doc.repeatPath, summaryOrder: this.doc.summaryOrder }); }
  pushHistory(): void { this.hist = this.hist.slice(0, this.hpos + 1); this.hist.push(this.snap()); this.hpos = this.hist.length - 1; if (this.hist.length > 50) { this.hist.shift(); this.hpos--; } }
  private restore(s: string): void { const o = JSON.parse(s); this.doc.mode = o.mode; this.doc.pages = o.pages; this.doc.activePage = o.activePage; this.doc.flowPage = o.flowPage; this.doc.bands = o.bands; this.doc.watermark = o.watermark || defaultWatermark(); this.doc.repeatPath = o.repeatPath || ''; this.doc.summaryOrder = this.sanitizeSummaryOrder(o.summaryOrder); this.syncActive(); this.emit(); }
  undo(): void { if (this.hpos > 0) { this.hpos--; this.restore(this.hist[this.hpos]); } }
  redo(): void { if (this.hpos < this.hist.length - 1) { this.hpos++; this.restore(this.hist[this.hpos]); } }

  /* ---------- data helpers ---------- */
  currentData(): any { return this.datasets[this.doc.mode]; }
  previewRecord(): any { const d = this.currentData(); if (this.doc.mode === 'batch') { return Array.isArray(d) ? (d[0] || {}) : d; } return d || {}; }
  batchRecords(): any[] { const d = this.datasets.batch; return Array.isArray(d) ? d : (d ? [d] : []); }

  /** "Repeat page for each": one record per item of doc.repeatPath (e.g. "Shipments"), each merged with
   *  the rest of the record — so a page bound to it shows the item's fields ({{ShipmentNo}}) at the root
   *  while {{Job.*}} and other shared fields repeat on every page. Empty when off / no array. */
  /** Flow mode paginates its own detail band, so a repeatPath left over from a template that used to
   *  be fixed must NOT hijack the render back into one fixed page-set per item. */
  repeatOn(): boolean { return this.doc.mode !== 'flow' && !!(this.doc.repeatPath && this.repeatRecords().length); }
  repeatRecords(): any[] {
    const path = (this.doc.repeatPath || '').trim();
    if (!path) { return []; }
    const rec = this.previewRecord() || {};
    const arr = this.expr.getPath(path, rec);
    if (!Array.isArray(arr) || !arr.length) { return []; }
    const ctx: any = { ...rec };
    return arr.map((item: any) => (item && typeof item === 'object' ? { ...ctx, ...item } : ctx));
  }

  /* ---------- flow pagination (pure) ---------- */
  flowInnerH(): number { return (this.doc.page as FlowPage).h - 2 * (this.doc.page as FlowPage).margin; }

  /**
   * Split the detail rows across pages.
   *
   * `rowHeights` — the MEASURED height of each row, supplied by the export service when the detail
   * band has Auto height on. Without it every row counts as `rowH`, which reproduces the old
   * floor(space / rowH) behaviour exactly, so existing templates paginate unchanged.
   *
   * With real heights, rows are PACKED: keep adding rows while they still fit above the footer. That
   * is what makes a page fill all the way down instead of stopping early — a fixed rowH that is larger
   * than the real row silently wastes that difference on every single row.
   *
   * At least one row is always placed on a page, so a row taller than the page can never loop forever.
   */
  paginateFlow(rows: any[], rowHeights?: number[]): any[] {
    const b = this.doc.bands; const innerH = this.flowInnerH();
    const phH = b.pageHeader.on ? (b.pageHeader.h || 0) : 0, pfH = b.pageFooter.on ? (b.pageFooter.h || 0) : 0, chH = b.columnHeader.on ? (b.columnHeader.h || 0) : 0;
    const rhH = (b.reportHeader.optional && !b.reportHeader.on) ? 0 : (b.reportHeader.h || 0);
    const rowH = b.detail.rowH || 22;
    const heightOf = (idx: number): number => {
      const m = rowHeights && rowHeights[idx];
      return (typeof m === 'number' && m > 0) ? m : rowH;
    };
    const pages: any[] = []; let i = 0; let pageNo = 0;
    while (i < rows.length) {
      pageNo++;
      const top = phH + chH + (pageNo === 1 ? rhH : 0);
      const avail = innerH - top - pfH;
      let used = 0, n = 0;
      while (i + n < rows.length) {
        const h = heightOf(i + n);
        if (n > 0 && used + h > avail) { break; }   // n > 0: never emit an empty page
        used += h; n++;
      }
      const chunk = rows.slice(i, i + n);
      pages.push({ rows: chunk, first: pageNo === 1, footer: false, usedH: used, summaries: [] });
      i += chunk.length;
    }
    if (!pages.length) { pages.push({ rows: [], first: true, footer: false, usedH: 0, summaries: [] }); }

    // ---- SUMMARY bands: normal flowing content straight after the last detail row ----
    //
    // This is the whole point of the band. `reportFooter` below is pinned to the bottom of its page, so
    // a block placed there floats away from the end of the rows (and, when it does not fit, gets a page
    // of its own where it is again pinned to the bottom). A summary band instead starts at the cursor
    // where the rows actually finished and only moves to the next page when it genuinely does not fit.
    //
    // Nothing here touches the row loop above, so a template with no summary bands paginates exactly as
    // it always did.
    const lastRowTop = phH + chH + (pages.length === 1 ? rhH : 0);
    const lastRowPage = pages[pages.length - 1];
    let cursor = lastRowTop + (lastRowPage.usedH != null ? lastRowPage.usedH : lastRowPage.rows.length * rowH);

    let target = lastRowPage;
    for (const id of this.activeSummaryIds()) {
      const h = b[id].h || 0;
      const avail = innerH - pfH;
      // Never push a section onto a brand-new page that is already empty — otherwise a section taller
      // than a whole page would loop forever, exactly like the row guard above.
      const pageHasContent = target.rows.length > 0 || target.summaries.length > 0;
      if (pageHasContent && cursor + h > avail) {
        target = { rows: [], first: false, footer: false, usedH: 0, summaries: [], summaryOnly: true };
        pages.push(target);
        cursor = phH;
      }
      target.summaries.push(id);
      cursor += h;
    }

    // The report footer decision now runs against where the FLOWED content ended, not against the rows
    // alone — so a summary band that filled the page correctly pushes the footer to a page of its own.
    // An EMPTY report footer must not reserve a page. Before summary bands existed this never mattered
    // (the block lived in the footer, so the band always had elements). Once its content moves to a
    // summary section the band is left on but empty, and reserving its height would manufacture a blank
    // trailing page — worse than what it replaced. The footer height is not part of the per-page row
    // budget (only pageFooter is), so skipping an empty one can only REMOVE a blank page; it can never
    // reflow rows or change a template whose footer actually has content.
    const rfEmpty = !((b.reportFooter.elements || []).length);
    if ((b.reportFooter.optional && !b.reportFooter.on) || rfEmpty) { /* off / nothing to draw */ }
    else {
      const room = innerH - pfH - cursor;
      if (room >= (b.reportFooter.h || 0)) { pages[pages.length - 1].footer = true; }
      else { pages.push({ rows: [], first: false, footer: true, footerOnly: true, usedH: 0, summaries: [] }); }
    }
    return pages;
  }

  /* ---------- summary bands (flow) ---------- */

  /** Ids of the summary bands that will actually print, in order: present in the document and not
   *  toggled off. Orphan ids (a band deleted from `bands` but left in the order array) are skipped. */
  activeSummaryIds(): string[] {
    const b = this.doc.bands;
    return (this.doc.summaryOrder || []).filter(id => {
      const band = b[id];
      return !!band && !(band.optional && !band.on);
    });
  }

  /** Drop ids that have no band behind them, de-duplicate, and cap the list — used when restoring
   *  history or importing a layout, so a hand-edited or older JSON can never desync the two. */
  private sanitizeSummaryOrder(order: any): string[] {
    if (!Array.isArray(order)) { return []; }
    const seen = new Set<string>();
    return order.filter((id: any) =>
      typeof id === 'string' && isSummaryBand(id) && !!this.doc.bands[id] && !seen.has(id) && !!seen.add(id)
    ).slice(0, MAX_SUMMARY_BANDS);
  }

  /** Add a new summary section at the end of the run (just before the report footer). */
  addSummaryBand(): void {
    const order = this.doc.summaryOrder || (this.doc.summaryOrder = []);
    if (order.length >= MAX_SUMMARY_BANDS) { this.toast('Up to ' + MAX_SUMMARY_BANDS + ' summary sections'); return; }
    let n = 1; while (this.doc.bands['summary' + n]) { n++; }
    const id = 'summary' + n;
    this.doc.bands[id] = makeSummaryBand();
    order.push(id);
    this.selBand = id; this.selId = null; this.activeTab = 'props';
    this.pushHistory(); this.emit(); this.toast('Summary ' + n + ' added');
  }

  /** Remove a summary section and everything drawn in it. */
  removeSummaryBand(id: string): void {
    const order = this.doc.summaryOrder || [];
    const i = order.indexOf(id);
    if (i < 0) { return; }
    order.splice(i, 1);
    delete (this.doc.bands as any)[id];
    if (this.selBand === id) { this.selBand = null; }
    this.selId = null;
    this.pushHistory(); this.emit(); this.toast('Summary section removed');
  }

  /** Move a summary section up (-1) or down (+1) in the print order. */
  moveSummaryBand(id: string, dir: number): void {
    const order = this.doc.summaryOrder || [];
    const i = order.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) { return; }
    order.splice(i, 1); order.splice(j, 0, id);
    this.pushHistory(); this.emit();
  }

  bandStack(): { bands: any[]; total: number } {
    const b = this.doc.bands; let top = (this.doc.page as FlowPage).margin; const out: any[] = [];
    bandOrder(this.doc).forEach(id => {
      const band = b[id]; if (!band) { return; }              // orphan id in summaryOrder — skip
      if (band.optional && !band.on) { return; }
      const h = id === 'detail' ? (band.rowH || 22) * 3 : (band.h || 0);
      out.push({ id, top, h, free: isFreeBand(id) }); top += h;
    });
    return { bands: out, total: top };
  }

  /** Every band in this document that holds hand-placed elements, in order. */
  freeBandIds(): string[] { return bandOrder(this.doc).filter(id => isFreeBand(id) && !!this.doc.bands[id]); }

  /* ---------- selection ---------- */
  sel(): ReportElement | null {
    if (this.doc.mode === 'flow' && this.selId) {
      for (const id of this.freeBandIds()) { const f = (this.doc.bands[id].elements || []).find(e => e.id === this.selId); if (f) { return f; } }
      return null;
    }
    return this.elements.find(e => e.id === this.selId) || null;
  }

  deleteSel(): void {
    if (this.doc.mode === 'flow' && this.selId) {
      for (const id of this.freeBandIds()) { const arr = this.doc.bands[id].elements || []; const i = arr.findIndex(e => e.id === this.selId); if (i >= 0) { arr.splice(i, 1); break; } }
    } else { const i = this.elements.findIndex(e => e.id === this.selId); if (i >= 0) { this.elements.splice(i, 1); } }
    this.selId = null; this.pushHistory(); this.emit();
  }

  /* ---------- tools / tabs / mode ---------- */
  setTool(t: ToolName): void { this.tool = t; }
  setViewMode(m: ViewMode): void { this.viewMode = m; if (m === 'preview') { this.selId = null; this.selBand = null; } this.emit(); }
  setActiveTab(t: TabName): void { this.activeTab = t; this.emit(); }

  /** Store the editor's report-type context (from the route / opened template) so the panel can offer
   *  the right watermark suggestions. */
  setReportContext(reportType: string, reportTypeGuid: string): void {
    this.reportType = reportType || '';
    this.reportTypeGuid = reportTypeGuid || '';
    this.emit();
  }

  /** The document watermark, lazily initialised so templates saved before the feature (no `watermark`
   *  key) still get a valid, "off" config to bind the panel to. */
  watermark(): WatermarkConfig {
    if (!this.doc.watermark) { this.doc.watermark = defaultWatermark(); }
    return this.doc.watermark;
  }

  setReportType(t: ReportMode): void {
    this.doc.mode = t; this.selId = null; this.selBand = null;
    if (this.tool === 'table' && t === 'flow') { this.setTool('select'); }
    this.syncActive(); this.pushHistory(); this.emit();
  }

  makeEl(type: string, x: number, y: number): ReportElement { return makeEl(type, x, y); }

  private snapV(v: number): number { return this.grid ? Math.round(v / 10) * 10 : Math.round(v); }

  /** Bind a variable path as a field at unscaled sheet coordinates (x,y).
      Shared by the variable-tree pointer-drag and the native drop handler. */
  dropBind(path: string, x: number, y: number): void {
    const M = (this.doc.page as any).margin;
    if (this.doc.mode === 'flow') {
      const { bands: stack } = this.bandStack();
      let band = stack.find((s: any) => s.free && y >= s.top && y < s.top + s.h);
      if (!band) { band = stack.find((s: any) => s.free); }
      if (!band) { this.toast('Drop into a header/footer band'); return; }
      const f = makeEl('field', Math.max(0, this.snapV(x - M)), Math.max(0, this.snapV(y - band.top)));
      f.text = '{{' + path + '}}'; f.w = 200; f.band = band.id;
      (this.doc.bands[band.id].elements as ReportElement[]).push(f); this.selId = f.id; this.selBand = null;
    } else {
      const f = makeEl('field', this.snapV(x), this.snapV(y)); f.text = '{{' + path + '}}'; f.w = 200; this.elements.push(f); this.selId = f.id;
    }
    this.activeTab = 'props'; this.pushHistory(); this.emit();
  }

  insertToken(path: string): void {
    const e = this.sel(); const token = '{{' + path + '}}';
    if (e && (e.type === 'text' || e.type === 'field')) {
      e.text = (e.text || '') + token;
      this.pushHistory(); this.emit(); this.toast('Inserted ' + token);
    } else {
      const M = (this.doc.page as any).margin;
      if (this.doc.mode === 'flow') {
        const f = makeEl('field', 10, 8); f.text = token; f.w = 200; f.band = 'pageHeader'; (this.doc.bands.pageHeader.elements as ReportElement[]).push(f); this.selId = f.id;
      } else {
        const f = makeEl('field', M + 10, M + 10); f.text = token; f.w = 200; this.elements.push(f); this.selId = f.id;
      }
      this.activeTab = 'props'; this.pushHistory(); this.emit(); this.toast('Created field ' + token);
    }
  }

  /* ---------- templates ---------- */
  emptyTemplate(): void {
    if (this.doc.mode === 'flow') {
      this.doc.bands = defaultBands(); this.doc.summaryOrder = []; this.doc.bands.detail.dataPath = 'Rows';
      this.doc.bands.detail.columns = [{ header: 'Column A', expr: '{{ }}', width: 160, align: 'left' }, { header: 'Column B', expr: '{{ }}', width: 120, align: 'right' }];
    } else {
      this.doc.pages = [newPageObj((this.P() && this.P().size) || 'A4')]; this.doc.activePage = 0;
    }
    this.doc.watermark = defaultWatermark();   // a brand-new template starts with no watermark
    this.selId = null; this.selBand = null; this.syncActive();
    this.pushHistory(); this.emit(); this.toast('Empty ' + this.doc.mode + ' template');
  }

  loadSample(key: string): void {
    const s = this.samples.find(x => x.key === key); if (!s) { return; }
    this.doc.mode = s.mode;
    if (s.mode === 'flow') {
      const sz = s.size || 'A4'; const d = PAGE_SIZES[sz]; this.doc.flowPage = { size: sz, w: d[0], h: d[1], margin: 38 }; this.syncActive();
      if (s.buildBands) { this.doc.bands = s.buildBands(this.doc.flowPage); this.doc.summaryOrder = []; }
    } else {
      this.doc.pages = s.buildPages ? s.buildPages() : [newPageObj('A4')]; this.doc.activePage = 0; this.syncActive();
    }
    if (s.data) { this.datasets[s.mode] = JSON.parse(JSON.stringify(s.data())); }
    this.selId = null; this.selBand = null; this.pushHistory(); this.emit(); this.toast(s.name + ' loaded');
  }

  loadSampleData(): void {
    this.datasets[this.doc.mode] = JSON.parse(JSON.stringify(SAMPLE_DATA[this.doc.mode]));
    this.emit(); this.toast('Sample ' + this.doc.mode + ' data loaded');
  }

  /* ---------- layout / data import-export ---------- */
  exportLayout(): any { return { mode: this.doc.mode, pages: this.doc.pages, activePage: this.doc.activePage, flowPage: this.doc.flowPage, bands: this.doc.bands, watermark: this.doc.watermark, repeatPath: this.doc.repeatPath, summaryOrder: this.doc.summaryOrder || [] }; }

  importLayout(j: any): void {
    this.doc.mode = j.mode || this.doc.mode;
    if (j.pages) { this.doc.pages = j.pages; this.doc.activePage = j.activePage || 0; }
    else if (j.elements) { this.doc.pages = [{ id: nid(), size: (j.page && j.page.size) || 'A4', w: (j.page && j.page.w) || 794, h: (j.page && j.page.h) || 1123, margin: (j.page && j.page.margin) || 38, elements: j.elements }]; this.doc.activePage = 0; }
    if (j.flowPage) { this.doc.flowPage = j.flowPage; }
    this.doc.bands = j.bands || defaultBands();
    this.doc.watermark = j.watermark || defaultWatermark();
    this.doc.repeatPath = j.repeatPath || '';
    // Templates saved before summary bands existed simply have none.
    this.doc.summaryOrder = this.sanitizeSummaryOrder(j.summaryOrder);
    this.syncActive();
    if (j.data) { this.datasets[this.doc.mode] = j.data; }
    this.selId = null; this.selBand = null; this.pushHistory(); this.emit(); this.toast('Layout loaded (' + this.doc.mode + ')');
  }

  importData(j: any): void { this.datasets[this.doc.mode] = j; this.emit(); this.toast('Data loaded for ' + this.doc.mode + ' — switch to Preview'); }

  /** Set design-time preview data (e.g. the schema-derived sample) quietly — no toast. */
  setSampleData(j: any): void { this.datasets[this.doc.mode] = j; this.emit(); }
}
