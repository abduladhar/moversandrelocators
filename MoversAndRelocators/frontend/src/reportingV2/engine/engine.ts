/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReportExportService, type SheetHTML } from './export';
import { ReportExpressionService } from './expression';
import { ReportRenderService } from './render';
import { ReportTemplatesService } from './samples';
import { ReportStateService } from './state';

/** One self-contained Report Engine V2 instance (the Angular module's services, wired by hand). */
export type Engine = { expr: ReportExpressionService; render: ReportRenderService; state: ReportStateService; exporter: ReportExportService };

export function createEngine(): Engine {
  const expr = new ReportExpressionService();
  const render = new ReportRenderService(expr);
  const state = new ReportStateService(expr, new ReportTemplatesService());
  const exporter = new ReportExportService(state, render, expr);
  // The state starts without an active page; resolve it now so the UI can render before a layout is loaded.
  state.syncActive();
  return { expr, render, state, exporter };
}

/** Give a layout its data: batch layouts bind to a record list, the other modes to a single record. */
export function bindData(e: Engine, data: any): void {
  const mode = e.state.doc.mode;
  e.state.datasets[mode] = mode === 'batch' ? (Array.isArray(data) ? data : [data]) : (Array.isArray(data) ? (data[0] || {}) : data);
}

/** Render a layout JSON string against a record into print-ready sheets plus the standalone document HTML. */
export function renderDocument(layout: string | object, data: any): { engine: Engine; sheets: SheetHTML[]; html: string } {
  const engine = createEngine();
  engine.state.importLayout(typeof layout === 'string' ? JSON.parse(layout) : layout);
  bindData(engine, data);
  const sheets = engine.exporter.exportSheets();
  return { engine, sheets, html: engine.exporter.buildDocumentHTML(sheets) };
}
