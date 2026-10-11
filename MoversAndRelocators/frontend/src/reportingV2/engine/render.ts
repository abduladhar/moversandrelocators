/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReportExpressionService } from './expression';
import { ColumnDef, FixedCell, ReportElement, WatermarkConfig } from './models';
import { qrMatrix } from './qr-encoder';
import { code128Modules } from './barcode-encoder';

/** Note stamped inside the bottom margin of every rendered page. Set to '' to turn it off. */
export const SYSTEM_FOOTER = 'THIS IS A SYSTEM GENERATED DOCUMENT, NO SIGNATURE IS REQUIRED';

/**
 * Render helpers — ported 1:1 from the original report-designer.
 * Produces:
 *  - style objects for Angular [ngStyle] (fontStyle/boxStyle) for the interactive surface
 *  - HTML fragments (buildTable / elInnerHtml / barcodeSVG) for element content via [innerHTML]
 *  - full element / page HTML strings for export, print and HTML download (renderElementHTML…)
 *
 * The original built DOM nodes imperatively; here the same markup is produced
 * declaratively (templates) for the editor and as strings for export, so the
 * visual output is identical.
 */
export class ReportRenderService {

  constructor(private expr: ReportExpressionService) { }

  /* ---------- style objects (for [ngStyle]) ---------- */
  fontCss(e: ReportElement): any {
    return {
      fontFamily: e.fontFamily, fontSize: e.fontSize + 'px', fontWeight: e.bold ? '700' : '400',
      fontStyle: e.italic ? 'italic' : 'normal', textDecoration: e.underline ? 'underline' : 'none',
      color: e.color, textAlign: e.align,
      justifyContent: e.align === 'center' ? 'center' : (e.align === 'right' ? 'flex-end' : 'flex-start'),
      alignItems: e.valign === 'top' ? 'flex-start' : (e.valign === 'bottom' ? 'flex-end' : 'center')
    };
  }

  boxCss(e: ReportElement): any {
    return {
      width: e.w + 'px', height: e.h + 'px', background: e.bg, padding: (e.padding || 0) + 'px',
      border: (e.borderW || 0) > 0 ? (e.borderW + 'px ' + e.borderStyle + ' ' + e.borderColor) : 'none',
      borderRadius: (e.radius || 0) + 'px'
    };
  }

  /* ---------- HTML fragment builders ---------- */
  /** `opts.wrap` (detail band "Auto height") lets cells WRAP instead of being clipped to one line with
   *  an ellipsis. The nowrap default is also enforced by CSS in the exported document and the PDF print
   *  root, so the table carries the `rev2-rpt-wrap` modifier class that those stylesheets override on —
   *  see ReportExportService.WRAP_CSS. Inline styles alone would be undone by that CSS. */
  buildTable(cols: ColumnDef[], opts: any, rows: any[] | null, preview: boolean): string {
    const total = cols.reduce((s, c) => s + (c.width || 60), 0) || 1;
    const wrap = !!opts.wrap;
    const cellFlow = wrap
      ? 'white-space:normal;word-break:break-word;overflow-wrap:anywhere;'
      : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    let h = '<table class="rev2-rpt' + (wrap ? ' rev2-rpt-wrap' : '') + '" style="font-family:' + opts.fontFamily + ';font-size:' + opts.fontSize + 'px;color:' + opts.color + '">';
    h += '<colgroup>' + cols.map(c => '<col style="width:' + ((c.width / total) * 100) + '%">').join('') + '</colgroup>';
    const cell = (t: string, al: string, ex?: string) => '<td style="border:1px solid ' + opts.gridColor + ';padding:3px 6px;text-align:' + al + ';' + cellFlow + (opts.rowMinH ? 'height:' + opts.rowMinH + 'px;' : '') + (ex || '') + '">' + t + '</td>';
    if (opts.showHeader) {
      // Column-header typography comes from the columnHeader band (see detailTableOpts). Bold defaults ON
      // (headerBold === false turns it off); font-size / italic / underline / font-family apply when set.
      const hWeight = (opts.headerBold === false) ? '400' : '700';
      const hStyle =
        (opts.headerFontFamily ? 'font-family:' + opts.headerFontFamily + ';' : '')
        + (opts.headerFontSize ? 'font-size:' + opts.headerFontSize + 'px;' : '')
        + 'font-weight:' + hWeight + ';'
        + (opts.headerItalic ? 'font-style:italic;' : '')
        + (opts.headerUnderline ? 'text-decoration:underline;' : '');
      h += '<thead><tr>' + cols.map(c => '<th style="border:1px solid ' + opts.gridColor + ';padding:3px 6px;text-align:' + c.align + ';background:' + opts.headerBg + ';color:' + opts.headerColor + ';' + hStyle + (wrap ? 'white-space:normal;' : 'white-space:nowrap') + '">' + this.expr.escapeHtml(c.header) + '</th>').join('') + '</tr></thead>';
    }
    h += '<tbody>';
    if (preview) {
      (rows || []).forEach((row, i) => {
        const z = (opts.zebra && i % 2 === 1) ? 'background:#f4f6fa;' : '';
        const rx = this.rowStyleCss(row); const bg = rx.bg || z;
        // _full: a single label spanning the whole row (section-title bar).
        if (row && row._full) {
          const al = row._align || 'left';
          h += '<tr>' + this.spanCell(this.expr.escapeHtml(String(row._label ?? '')), al, cols.length, opts, cellFlow, bg + rx.css) + '</tr>';
          return;
        }
        // _labelspan: a label merged across the first N columns (right-aligned subtotal), then the remaining
        // columns render their own values — so opening / current / net / outstanding lines sit beside the amounts.
        const span = Number(row && row._labelspan);
        if (span > 0 && span < cols.length) {
          const al = row._align || 'right';
          let cells = this.spanCell(this.expr.escapeHtml(String(row._label ?? '')), al, span, opts, cellFlow, bg + rx.css);
          for (let ci = span; ci < cols.length; ci++) { const c = cols[ci]; cells += cell(this.expr.escapeHtml(this.expr.interpolate(c.expr, row)), c.align, bg + rx.css); }
          h += '<tr>' + cells + '</tr>';
          return;
        }
        h += '<tr>' + cols.map(c => cell(this.expr.escapeHtml(this.expr.interpolate(c.expr, row)), c.align, bg + rx.css)).join('') + '</tr>';
      });
      if (!rows || !rows.length) { h += '<tr>' + cols.map((c, i) => cell(i === 0 ? '<i style="color:#9aa4b2">(no rows)</i>' : '', c.align)).join('') + '</tr>'; }
    } else {
      for (let i = 0; i < (opts.designRows || 2); i++) { const z = (opts.zebra && i % 2 === 1) ? 'background:#f4f6fa;' : ''; h += '<tr>' + cols.map(c => cell('<span style="color:#2f5fe0;font-family:ui-monospace,monospace;font-size:' + (opts.fontSize - 1) + 'px">' + this.expr.escapeHtml(c.expr) + '</span>', c.align, z)).join('') + '</tr>'; }
    }
    h += '</tbody>';

    // Totals / footer row: each column's `footer` expression is evaluated with `$rows` = the bound
    // array, so {{MONEY(SUM($rows.Amount))}} produces a column total.
    if (opts.showFooter && cols.some(c => c.footer)) {
      const fcell = (t: string, al: string) => '<td style="border:1px solid ' + opts.gridColor + ';padding:3px 6px;text-align:' + al + ';font-weight:700;white-space:nowrap">' + t + '</td>';
      h += '<tfoot><tr>';
      if (preview) {
        h += cols.map(c => fcell(c.footer ? this.expr.escapeHtml(this.expr.interpolate(c.footer, { $rows: rows || [] })) : '', c.align)).join('');
      } else {
        h += cols.map(c => fcell(c.footer ? '<span style="color:#2f5fe0;font-family:ui-monospace,monospace;font-size:' + (opts.fontSize - 1) + 'px">' + this.expr.escapeHtml(c.footer) + '</span>' : '', c.align)).join('');
      }
      h += '</tr></tfoot>';
    }

    return h + '</table>';
  }

  /** Optional per-row styling for loop tables. A bound data row may carry underscore-prefixed hints so the
   *  aggregator can emphasise section-title / subtotal rows without any template change:
   *    _bold: true          -> bold row
   *    _size: <number>      -> font-size in px for the whole row
   *    _bg:   <css color>   -> row background (overrides the zebra stripe)
   *    _color:<css color>   -> text color
   *  These keys are never rendered as cells (only a column's `expr` is), so they are invisible except as style. */
  /** A <td> that spans `n` columns — used for a _full section bar or a _labelspan subtotal label. */
  private spanCell(t: string, al: string, n: number, opts: any, cellFlow: string, ex: string): string {
    return '<td colspan="' + n + '" style="border:1px solid ' + opts.gridColor + ';padding:3px 6px;text-align:' + al + ';'
      + cellFlow + (opts.rowMinH ? 'height:' + opts.rowMinH + 'px;' : '') + (ex || '') + '">' + t + '</td>';
  }

  private rowStyleCss(row: any): { css: string; bg: string } {
    if (!row || typeof row !== 'object') return { css: '', bg: '' };
    let css = '';
    if (row._bold === true || row._bold === 'true') css += 'font-weight:700;';
    const size = Number(row._size);
    if (size > 0) css += 'font-size:' + size + 'px;';
    if (row._color) css += 'color:' + row._color + ';';
    const bg = row._bg ? 'background:' + row._bg + ';' : '';
    return { css, bg };
  }

  /** Fixed (non-looping) table: a set grid of cells bound to the SINGLE record. Each cell holds static
   *  text or a {{field}} token resolved against the bound record (no per-row context). Used for
   *  invoice-header / bank-details style blocks. */
  buildFixedTable(cols: number[], grid: FixedCell[][], opts: any, preview: boolean): string {
    const widths = (cols && cols.length) ? cols : [100];
    const total = widths.reduce((s, w) => s + (w || 60), 0) || 1;
    let h = '<table class="rev2-rpt" style="font-family:' + opts.fontFamily + ';font-size:' + opts.fontSize + 'px;color:' + opts.color + '">';
    h += '<colgroup>' + widths.map(w => '<col style="width:' + (((w || 60) / total) * 100) + '%">').join('') + '</colgroup>';
    h += '<tbody>';
    const rows = grid || [];
    if (!rows.length) {
      h += '<tr>' + widths.map((w, i) => '<td style="border:1px solid ' + opts.gridColor + ';padding:3px 6px">' + (i === 0 ? '<i style="color:#9aa4b2">(empty)</i>' : '') + '</td>').join('') + '</tr>';
    }
    rows.forEach(row => {
      h += '<tr>';
      for (let j = 0; j < widths.length; j++) {
        const c: FixedCell = (row && row[j]) || { expr: '' };
        const al = c.align || 'left';
        const weight = (c.bold ? 'font-weight:700;' : '') + (c.color ? 'color:' + c.color + ';' : '') + (c.bg ? 'background:' + c.bg + ';' : '') + (c.size ? 'font-size:' + c.size + 'px;' : '');
        const content = preview
          ? this.expr.escapeHtml(this.expr.interpolate(c.expr || ''))
          : this.expr.escapeHtml(c.expr || '').replace(/\{\{[\s\S]+?\}\}/g, m => '<span style="color:#2f5fe0;font-family:ui-monospace,monospace;font-size:' + (opts.fontSize - 1) + 'px">' + m + '</span>');
        h += '<td style="border:1px solid ' + opts.gridColor + ';padding:3px 6px;text-align:' + al + ';' + weight + 'vertical-align:top;white-space:normal">' + content + '</td>';
      }
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }

  /** Real, scannable Code 128 barcode SVG for a value (auto B/C code-set) — no external
   *  dependency. Includes a quiet zone and white background so scanners read it reliably.
   *  Falls back to a non-scannable placeholder only if the value has characters Code 128
   *  can't encode (outside printable ASCII 32..126). */
  barcodeSVG(val: any, color?: string): string {
    val = String(val == null ? '' : val); color = color || '#111';
    if (!val) { return this.barcodePlaceholderSVG('', color); }
    try {
      const widths = code128Modules(val);
      const quiet = 10;                                  // quiet zone (modules) each side
      let x = quiet, bars = '';
      for (let i = 0; i < widths.length; i++) {
        const w = widths[i];
        if (i % 2 === 0) { bars += '<rect x="' + x + '" y="0" width="' + w + '" height="100" fill="' + color + '"/>'; }
        x += w;
      }
      const total = x + quiet;
      return '<svg viewBox="0 0 ' + total + ' 100" preserveAspectRatio="none" width="100%" height="100%"><rect width="' + total + '" height="100" fill="#ffffff"/>' + bars + '</svg>';
    } catch (e) {
      return this.barcodePlaceholderSVG(val, color);
    }
  }

  /** Non-scannable visual placeholder bars. Only used when the value can't be Code 128 encoded. */
  private barcodePlaceholderSVG(val: string, color: string): string {
    const seed = val.length ? val.split('').map((c: string) => c.charCodeAt(0)) : [42];
    let x = 0, bars = ''; const n = Math.max(28, val.length * 5);
    for (let i = 0; i < n; i++) { const w = ((seed[i % seed.length] >> (i % 6)) & 3) + 1; if (i % 2 === 0) { bars += '<rect x="' + x + '" y="0" width="' + w + '" height="100" fill="' + color + '"/>'; } x += w; }
    return '<svg viewBox="0 0 ' + x + ' 100" preserveAspectRatio="none" width="100%" height="100%">' + bars + '</svg>';
  }

  /** Real, scannable QR code SVG for a value. Uses the self-contained qr-encoder
   *  (byte-mode, EC level M, auto version 1..40, auto mask) — no external dependency.
   *  The value can be any text, including a URL, so a phone scan opens the link.
   *  Falls back to a visual placeholder only if the value exceeds QR capacity. */
  qrSVG(val: any, color?: string): string {
    val = String(val == null ? '' : val); color = color || '#111';
    if (!val) { return this.qrPlaceholderSVG('', color); }
    try {
      const m = qrMatrix(val, 'M');
      const n = m.length, q = 4, size = n + 2 * q;       // 4-module quiet zone (spec minimum)
      let rects = '';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (m[r][c]) { rects += '<rect x="' + (c + q) + '" y="' + (r + q) + '" width="1" height="1"/>'; }
        }
      }
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" height="100%" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><rect width="' + size + '" height="' + size + '" fill="#ffffff"/><g fill="' + color + '">' + rects + '</g></svg>';
    } catch (e) {
      // Value too long for a single QR symbol — show the non-scannable placeholder so the designer still renders.
      return this.qrPlaceholderSVG(val, color);
    }
  }

  /** Non-scannable visual placeholder (finder patterns + value-seeded grid). Only used as a
   *  fallback when the value can't fit a real QR symbol. */
  private qrPlaceholderSVG(val: string, color: string): string {
    const N = 25;                                   // module grid
    let seed = 0; for (let i = 0; i < val.length; i++) { seed = (seed * 131 + val.charCodeAt(i)) >>> 0; }
    if (!seed) { seed = 0x9e3779b1; }
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    const grid: number[][] = [];
    for (let r = 0; r < N; r++) { grid[r] = []; for (let c = 0; c < N; c++) { grid[r][c] = 0; } }
    const finders = [[0, 0], [0, N - 7], [N - 7, 0]];
    for (const [fr, fc] of finders) {
      for (let r = 0; r < 7; r++) { for (let c = 0; c < 7; c++) {
        const edge = (r === 0 || r === 6 || c === 0 || c === 6);
        const inner = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        grid[fr + r][fc + c] = (edge || inner) ? 1 : 0;
      } }
    }
    const near = (r: number, c: number) => finders.some(([fr, fc]) => r >= fr - 1 && r <= fr + 7 && c >= fc - 1 && c <= fc + 7);
    for (let r = 0; r < N; r++) { for (let c = 0; c < N; c++) { if (!near(r, c)) { grid[r][c] = rnd() > 0.5 ? 1 : 0; } } }
    const q = 2, size = N + 2 * q;
    let rects = '';
    for (let r = 0; r < N; r++) { for (let c = 0; c < N; c++) { if (grid[r][c]) { rects += '<rect x="' + (c + q) + '" y="' + (r + q) + '" width="1" height="1"/>'; } } }
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" height="100%" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><rect width="' + size + '" height="' + size + '" fill="#ffffff"/><g fill="' + color + '">' + rects + '</g></svg>';
  }

  /** content HTML for an element. `extra` carries flow page vars (PAGE/PAGES). */
  elInnerHtml(e: ReportElement, preview: boolean, extra?: any): string {
    if (e.type === 'table') {
      const opts = {
        fontFamily: e.fontFamily, fontSize: e.fontSize, color: e.color, headerBg: e.headerBg,
        headerColor: e.headerColor, gridColor: e.gridColor, zebra: e.zebra, showHeader: e.showHeader, showFooter: e.showFooter, designRows: 2
      };
      // 'fixed' = single-record grid (no looping); 'loop' (default) iterates the dataPath array.
      if ((e.tableMode || 'loop') === 'fixed') {
        return this.buildFixedTable(e.gridCols || [], e.gridRows || [], opts, preview);
      }
      return this.buildTable(e.columns || [], opts, preview ? this.expr.getPath(e.dataPath as string) : null, preview);
    }
    if (e.type === 'barcode') {
      const val = preview ? this.expr.interpolate(e.text, extra) : (e.text || '');
      const show = e.showText !== false;
      return '<div style="display:flex;flex-direction:column;width:100%;height:100%;gap:2px"><div style="flex:1;min-height:0">' + this.barcodeSVG(val, e.color) + '</div>' + (show ? '<div style="text-align:center;font:700 11px/1.1 ui-monospace,monospace;letter-spacing:1.5px;color:' + (e.color || '#111') + '">' + this.expr.escapeHtml(val) + '</div>' : '') + '</div>';
    }
    if (e.type === 'qrcode') {
      const val = preview ? this.expr.interpolate(e.text, extra) : (e.text || '');
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">' + this.qrSVG(val, e.color) + '</div>';
    }
    if (e.type === 'image') {
      // Bound sources ({{company.logo}}) resolve in the designer too, so the real logo shows while designing.
      const bound = /\{\{/.test(e.src || '');
      const src = preview || bound ? this.expr.interpolate(e.src) : e.src;
      return src ? '<img src="' + this.expr.escapeAttr(src) + '" style="width:100%;height:100%;object-fit:contain;object-position:' + (e.align === 'right' ? 'right' : e.align === 'center' ? 'center' : 'left') + ' center" alt="">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9aa4b2;border:1px dashed #cbd3df;font-size:11px">' + (preview ? '' : bound ? this.expr.escapeHtml(/company\.logo/.test(e.src || '') ? 'Logo — set it in Report designs › Letterhead' : e.src) : 'Image') + '</div>';
    }
    const raw = e.text || '';
    return preview
      ? this.expr.escapeHtml(this.expr.interpolate(raw, extra)).replace(/\n/g, '<br>')
      : this.expr.escapeHtml(raw).replace(/\{\{[\s\S]+?\}\}/g, m => '<span style="color:#2f5fe0;font-family:ui-monospace,monospace">' + m + '</span>').replace(/\n/g, '<br>');
  }

  /** MANDATORY system footer — stamped onto EVERY page at render time (export / print / PDF / on-page
   *  viewer). It is NOT a template element, so it can't be selected, edited or deleted in the designer:
   *  every report, existing or new, always shows it. It sits INSIDE the bottom page margin — the
   *  "system generated" note on the left, POWERED BY + logo on the right — with NO rule/line above it.
   *  Change SYS_FOOTER_MSG / SYS_FOOTER_LOGO below to reword or rebrand it. */
  mandatoryFooterHTML(w: number, h: number, margin: number, note: string = SYSTEM_FOOTER): string {
    if (!note) { return ''; }
    const m = Math.max(0, margin || 0);
    const fh = 16;
    const left = m > 0 ? m : 24;
    const width = Math.max(120, (w || 0) - 2 * left);
    const top = m >= fh ? ((h || 0) - m + (m - fh) / 2) : ((h || 0) - fh - 2);
    return '<div class="rev2-sysfooter" style="position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + fh + 'px;'
      + 'display:flex;align-items:center;pointer-events:none;user-select:none;z-index:6;overflow:hidden;font:400 8px/1.2 Arial,Helvetica,sans-serif;color:#9aa4b2;white-space:nowrap;letter-spacing:.3px">'
      + this.expr.escapeHtml(note) + '</div>';
  }

  /** Diagonal, semi-transparent page watermark (DRAFT / PROFORMA / …) as an absolutely-positioned
   *  overlay that fills its page container (.rev2-psheet / .rev2-sheet, both position:relative).
   *  pointer-events:none so it never blocks selecting/dragging elements on the design surface.
   *  Returns '' when there is nothing to draw, so callers can safely concatenate it unconditionally.
   *  The same string is used on-screen (via [innerHTML]) and in export/print/PDF, so they match. */
  watermarkHTML(wm?: WatermarkConfig | null): string {
    if (!wm || !wm.on || !wm.text || !String(wm.text).trim()) { return ''; }
    const size = +wm.fontSize > 0 ? +wm.fontSize : 110;
    const angle = isNaN(+wm.angle) ? -32 : +wm.angle;
    const opacity = Math.max(0, Math.min(1, isNaN(+wm.opacity) ? 0.2 : +wm.opacity));
    const weight = wm.bold ? '800' : '400';
    const color = wm.color || '#9aa4b2';
    const textStyle =
      'transform:rotate(' + angle + 'deg);transform-origin:center;' +
      'font-family:Arial,Helvetica,sans-serif;font-weight:' + weight + ';font-size:' + size + 'px;line-height:1;' +
      'color:' + color + ';opacity:' + opacity + ';white-space:nowrap;text-transform:uppercase;' +
      'letter-spacing:.08em;-webkit-user-select:none;user-select:none';
    const wrapStyle =
      'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;' +
      'align-items:center;justify-content:center;overflow:hidden;pointer-events:none;z-index:5';
    return '<div class="rev2-watermark" style="' + wrapStyle + '"><div style="' + textStyle + '">' +
      this.expr.escapeHtml(String(wm.text)) + '</div></div>';
  }

  /* ---------- string builders for EXPORT / PRINT / HTML download ---------- */
  private styleStr(o: any): string {
    return Object.keys(o).map(k => this.kebab(k) + ':' + o[k]).join(';');
  }
  private kebab(k: string): string { return k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }

  /** absolute-positioned element as an HTML string (mirrors the original buildElNode). */
  renderElementHTML(e: ReportElement, preview: boolean, ox: number, oy: number, extra?: any): string {
    const box = this.boxCss(e);
    const autoH = !!e.autoHeight && (e.type === 'table' || e.type === 'text' || e.type === 'field');   // grow to fit content instead of clipping
    const overflow = e.type === 'table' ? 'visible' : 'hidden';
    let inner = '';
    let extraStyle = '';
    if (e.type === 'line') {
      extraStyle = 'border:none;background:transparent;';
      if ((e.lineDir || 'h') === 'h') {
        inner = '<div style="position:absolute;top:50%;transform:translateY(-50%);width:100%;height:' + Math.max(1, e.h) + 'px;background:' + e.bg + '"></div>';
      } else {
        inner = '<div style="position:absolute;left:50%;transform:translateX(-50%);height:100%;width:' + Math.max(1, e.w) + 'px;background:' + e.bg + '"></div>';
      }
    } else if (e.type === 'rect') {
      inner = '';
    } else if (e.type === 'barcode' || e.type === 'qrcode') {
      inner = '<div style="width:100%;height:100%">' + this.elInnerHtml(e, preview, extra) + '</div>';
    } else {
      // Auto-height table: let the content set its own height (don't clip rows to the fixed box).
      const contentExtra = autoH ? ';height:auto;overflow:visible;display:block' : '';
      inner = '<div class="rev2-de-content" style="' + this.styleStr(this.fontCss(e)) + contentExtra + '">' + this.elInnerHtml(e, preview, extra) + '</div>';
    }
    // A trailing height:auto overrides the fixed box height so the table box grows to fit all rows.
    const style = 'position:absolute;left:' + (ox + e.x) + 'px;top:' + (oy + e.y) + 'px;overflow:' + overflow + ';' + this.styleStr(box) + ';' + extraStyle + (autoH ? ';height:auto' : '');
    return '<div class="rev2-de" style="' + style + '">' + inner + '</div>';
  }
}
