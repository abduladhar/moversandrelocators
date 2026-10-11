/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Report Engine V2 — core models & constants.
 * Ported 1:1 from the original report-designer state model so behaviour is identical.
 */

export type ReportMode = 'fixed' | 'batch' | 'flow';
export type ViewMode = 'design' | 'preview';
export type ToolName = 'select' | 'text' | 'field' | 'table' | 'line' | 'rect' | 'image' | 'barcode' | 'qrcode';
export type TabName = 'props' | 'data';

export interface ColumnDef {
  header: string;
  expr: string;
  width: number;
  align: 'left' | 'center' | 'right';
  /** Optional totals-row expression. `$rows` is the bound array, so e.g.
   *  {{MONEY(SUM($rows.Amount))}} sums the Amount column. Rendered in the table footer. */
  footer?: string;
}

/** How a table element renders its cells:
 *  - 'loop'  : repeats one row per item of the `dataPath` array (columns[]). Default.
 *  - 'fixed' : a set grid of cells bound to the SINGLE record (no looping) — for invoice-header /
 *              bank-details style blocks. Uses gridCols (widths) + gridRows (FixedCell[][]). */
export type TableMode = 'loop' | 'fixed';

/** One cell of a fixed (non-looping) table. `expr` is static text (e.g. "Invoice No") or a field
 *  token (e.g. {{No}}) resolved against the single record. */
export interface FixedCell {
  expr: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  color?: string;
  bg?: string;
  size?: number;
}

/** A single design element. Loosely typed (index signature) to mirror the original's dynamic props. */
export interface ReportElement {
  id: string;
  type: ToolName | string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'center' | 'bottom';
  borderW?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  radius?: number;
  padding?: number;
  band?: string | null;
  lineDir?: 'h' | 'v';
  src?: string;
  showText?: boolean;
  symbology?: string;
  dataPath?: string;
  rowH?: number;
  showHeader?: boolean;
  showFooter?: boolean;
  autoHeight?: boolean;   // table: grow to fit all rows instead of clipping to a fixed height
  headerBg?: string;
  headerColor?: string;
  gridColor?: string;
  zebra?: boolean;
  columns?: ColumnDef[];
  /** Table only: 'loop' (default) or 'fixed' (single-record grid). */
  tableMode?: TableMode;
  /** Fixed-table column widths (px, relative). Length = column count. */
  gridCols?: number[];
  /** Fixed-table cells: gridRows[rowIndex][colIndex]. */
  gridRows?: FixedCell[][];
  [key: string]: any;
}

export interface ReportPage {
  id: string;
  size: string;
  w: number;
  h: number;
  margin: number;
  elements: ReportElement[];
}

export interface BandDef {
  h?: number;
  on?: boolean;
  optional?: boolean;
  elements?: ReportElement[];
  rowH?: number;
  /** DETAIL band only — "Auto height (fit page)".
   *
   *  OFF (default, legacy): every row is assumed to be exactly `rowH` tall, so rows-per-page is
   *  floor(space / rowH). Because table cells render on ONE line (nowrap + ellipsis), a rowH larger
   *  than a real row wastes that difference on every row — a 48px rowH over an 18px row leaves a third
   *  of the page blank above the footer; a rowH smaller than a real row overflows past it.
   *
   *  ON: cells WRAP instead of being clipped with an ellipsis, each row's true height is measured
   *  before paginating, and rows are packed until the space above the footer is actually used. Nothing
   *  is truncated, nothing overflows, and every page fills to the footer. `rowH` becomes the minimum
   *  row height. */
  autoHeight?: boolean;
  dataPath?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  headerBg?: string;
  headerColor?: string;
  gridColor?: string;
  zebra?: boolean;
  columns?: ColumnDef[];
  [key: string]: any;
}

export interface Bands {
  pageHeader: BandDef;
  reportHeader: BandDef;
  columnHeader: BandDef;
  detail: BandDef;
  reportFooter: BandDef;
  pageFooter: BandDef;
  [key: string]: BandDef;
}

export interface FlowPage {
  size: string;
  w: number;
  h: number;
  margin: number;
}

/** Document-level diagonal watermark (e.g. DRAFT / PROFORMA / FINAL). Rendered on
 *  every page in design, preview, print, PDF and the standalone HTML export.
 *  The available `text` values are suggested per report type (see report-watermarks.ts),
 *  but any custom text is allowed. Saved with the template layout. */
export interface WatermarkConfig {
  on: boolean;       // draw the watermark
  text: string;      // watermark text (a picked name or custom text)
  color: string;     // CSS colour, e.g. #9aa4b2
  opacity: number;   // 0..1
  fontSize: number;  // px
  angle: number;     // rotation in degrees, e.g. -32
  bold: boolean;
}

export function defaultWatermark(): WatermarkConfig {
  return { on: false, text: '', color: '#9aa4b2', opacity: 0.2, fontSize: 110, angle: -32, bold: true };
}

export interface ReportDoc {
  mode: ReportMode;
  pages: ReportPage[];
  activePage: number;
  page: ReportPage | FlowPage | null;
  elements: ReportElement[] | null;
  flowPage: FlowPage;
  bands: Bands;
  /** Optional document-level watermark. Undefined on old templates → treated as "off". */
  watermark?: WatermarkConfig;
  /** Optional array path (e.g. "Shipments"). When set, the report renders ONE PAGE PER ITEM of that
   *  array — each page carries the item's fields at the root plus the rest of the record. Empty = off. */
  repeatPath?: string;
  /** FLOW mode — the SUMMARY bands, in print order (e.g. ['summary1','summary2']).
   *
   *  A summary band prints ONCE, immediately after the last detail row, as part of the normal document
   *  flow: it starts where the rows actually ended and spills onto the next page only when it does not
   *  fit. That is what distinguishes it from `reportFooter`, which is pinned to the bottom of its page
   *  and therefore leaves a gap between the end of the rows and the block (the reason the ageing strip
   *  used to float away from the table).
   *
   *  The array is the source of truth for ORDER, so reordering is a splice and deleting one section
   *  never renumbers the others. Absent on templates saved before the feature -> treated as []. */
  summaryOrder?: string[];
}

export interface Datasets {
  fixed: any;
  batch: any;
  flow: any;
  [key: string]: any;
}

/** width,height in CSS px (96dpi) — identical to the original. */
export const PAGE_SIZES: { [k: string]: [number, number] } = {
  A4: [794, 1123], 'A4-L': [1123, 794], A5: [559, 794], 'A5-L': [794, 559],
  A6: [397, 559], A7: [280, 397], Letter: [816, 1056], Legal: [816, 1344],
  '4x6': [384, 576], '6x4': [576, 384], '4x4': [384, 384], '4x3': [384, 288],
  '3x2': [288, 192], '2x1': [192, 96],
  '100x150': [378, 567], '150x100': [567, 378], '100x100': [378, 378],
  '100x50': [378, 189], '105x148': [397, 559]
};

export const PAGE_GROUPS: { label: string; items: [string, string][] }[] = [
  {
    label: 'Documents', items: [
      ['A4', 'A4 — 210×297 mm'], ['A4-L', 'A4 Landscape — 297×210 mm'],
      ['A5', 'A5 — 148×210 mm'], ['A5-L', 'A5 Landscape — 210×148 mm'],
      ['A6', 'A6 — 105×148 mm'], ['A7', 'A7 — 74×105 mm'],
      ['Letter', 'Letter — 8.5×11 in'], ['Legal', 'Legal — 8.5×14 in']
    ]
  },
  {
    label: 'Cargo / shipping labels', items: [
      ['4x6', '4×6 in — 102×152 mm (shipping)'], ['6x4', '6×4 in — 152×102 mm (landscape)'],
      ['4x4', '4×4 in — 102×102 mm'], ['4x3', '4×3 in — 102×76 mm'],
      ['3x2', '3×2 in — 76×51 mm'], ['2x1', '2×1 in — 51×25 mm (small)']
    ]
  },
  {
    label: 'Thermal / GS1 labels', items: [
      ['100x150', '100×150 mm (thermal 4×6)'], ['150x100', '150×100 mm (landscape)'],
      ['100x100', '100×100 mm'], ['100x50', '100×50 mm (carton)'],
      ['105x148', 'A6 label — 105×148 mm (parcel)']
    ]
  }
];

export const FREE_BANDS = ['pageHeader', 'reportHeader', 'reportFooter', 'pageFooter'];
export const BAND_ORDER = ['pageHeader', 'reportHeader', 'columnHeader', 'detail', 'reportFooter', 'pageFooter'];
export const BAND_LABEL: { [k: string]: string } = {
  pageHeader: 'Page Header', reportHeader: 'Report Header', columnHeader: 'Column Header',
  detail: 'Detail (loops)', reportFooter: 'Report Footer', pageFooter: 'Page Footer'
};

/** How many summary bands a flow template may carry. Generous, but bounded so the band list stays usable. */
export const MAX_SUMMARY_BANDS = 8;

/** Summary band ids are 'summary1', 'summary2', … */
export function isSummaryBand(id: string): boolean { return /^summary\d+$/.test(id || ''); }

/** A band whose content is FREE elements the user positions by hand (as opposed to the detail /
 *  columnHeader bands, which are built from the column definitions). Summary bands behave exactly like
 *  reportFooter in this respect, so every element placement / drag / delete path keys off this. */
export function isFreeBand(id: string): boolean { return FREE_BANDS.includes(id) || isSummaryBand(id); }

/** The band order for a document: the fixed skeleton with this document's summary bands spliced in
 *  between the detail loop and the report footer. Use this instead of BAND_ORDER anywhere a flow
 *  document is being walked; BAND_ORDER stays as the static skeleton. */
export function bandOrder(doc: ReportDoc): string[] {
  const sum = (doc && doc.summaryOrder) || [];
  return ['pageHeader', 'reportHeader', 'columnHeader', 'detail', ...sum, 'reportFooter', 'pageFooter'];
}

/** Display label for any band id, including the dynamic summary ones. */
export function bandLabelFor(id: string): string {
  if (BAND_LABEL[id]) { return BAND_LABEL[id]; }
  if (isSummaryBand(id)) { return 'Summary ' + id.substring('summary'.length); }
  return id;
}

export const LABEL_MARGIN: { [k: string]: number } = {
  '4x6': 12, '6x4': 12, '4x4': 10, '4x3': 10, '3x2': 8, '2x1': 6,
  '100x150': 12, '150x100': 12, '100x100': 10, '100x50': 8, '105x148': 12, A6: 14, A7: 10
};

export const FONT_FAMILIES = [
  'Arial, sans-serif', 'Helvetica, sans-serif', 'Georgia, serif', 'Times New Roman, serif',
  'Courier New, monospace', 'Tahoma, sans-serif', 'Verdana, sans-serif', 'Trebuchet MS, sans-serif'
];

export function mm(px: number): string { return (px * 25.4 / 96).toFixed(2) + 'mm'; }
