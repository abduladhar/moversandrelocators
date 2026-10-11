/* eslint-disable @typescript-eslint/no-explicit-any */
import { safeEval } from './safe-eval';
import { amountInWords } from './words';

/**
 * Expression engine. Evaluates {{ ... }} expressions against a binding record with the report
 * helpers (SUM, MONEY, DATE, IF, …) and the SUM(Items.Amount) pre-aggregation rewrite.
 * Expressions run in the sandboxed interpreter (safe-eval.ts), never as JavaScript.
 *
 * `bind` is the current base record. Callers set it before rendering a record/page and may pass per-row `extra`.
 */
const HELPERS = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'ROUND', 'ABS', 'IF', 'MONEY', 'NUM', 'UPPER', 'LOWER', 'CONCAT', 'DATE', 'DATETIME', 'WORDS', 'LINE', 'JOIN', 'LIST'];

export class ReportExpressionService {

  bind: any = {};

  buildCtx(extra?: any): any {
    const c = Object.assign({}, this.bind, extra || {});
    const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
    c.SUM = (a: any[], f: any) => (a || []).reduce((s: number, r: any) => s + num(f != null ? (r || {})[f] : r), 0);
    c.COUNT = (a: any[]) => (a || []).length;
    c.AVG = (a: any[], f: any) => c.COUNT(a) ? c.SUM(a, f) / c.COUNT(a) : 0;
    c.MIN = (a: any[], f: any) => (a || []).reduce((m: number, r: any) => { const v = num(f != null ? (r || {})[f] : r); return v < m ? v : m; }, Infinity);
    c.MAX = (a: any[], f: any) => (a || []).reduce((m: number, r: any) => { const v = num(f != null ? (r || {})[f] : r); return v > m ? v : m; }, -Infinity);
    c.ROUND = (n: any, d: any) => { d = d == null ? 2 : d; const p = Math.pow(10, d); return Math.round(num(n) * p) / p; };
    c.ABS = (n: any) => Math.abs(num(n));
    c.IF = (cond: any, a: any, b: any) => cond ? a : b;
    c.MONEY = (n: any, d: any) => { d = d == null ? 2 : d; return num(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
    c.NUM = (n: any, d: any) => { d = d == null ? 0 : d; return num(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
    c.UPPER = (s: any) => String(s == null ? '' : s).toUpperCase();
    c.LOWER = (s: any) => String(s == null ? '' : s).toLowerCase();
    c.CONCAT = (...a: any[]) => a.map(x => x == null ? '' : x).join('');
    c.DATE = (s: any, sep: any) => { if (!s) { return ''; } const d = new Date(s); if (isNaN(d as any)) { return s; } const p = (n: any) => String(n).padStart(2, '0'); sep = sep || '-'; return [p(d.getDate()), p(d.getMonth() + 1), d.getFullYear()].join(sep); };
    c.DATETIME = (s: any) => { if (!s) { return ''; } const d = new Date(s); if (isNaN(d as any)) { return s; } return c.DATE(s) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    // LINE(' · ', a, b, c): the non-empty values joined, so missing contact details leave no stray separators.
    c.LINE = (sep: any, ...v: any[]) => v.filter(x => x != null && String(x).trim() !== '').join(String(sep ?? ' '));
    // JOIN(list, 'field', ', ') and LIST(list, 'name', 'qty') => 'Books × 2, Plates × 4'.
    c.JOIN = (a: any[], f: any, sep: any) => (Array.isArray(a) ? a : []).map(r => (f != null && r && typeof r === 'object' ? r[f] : r)).filter(x => x != null && x !== '').join(sep == null ? ', ' : String(sep));
    c.LIST = (a: any[], name: any, qty: any) => (Array.isArray(a) ? a : []).map(r => (r && r[name]) + (qty != null && r && r[qty] != null ? ' × ' + r[qty] : '')).join(', ');
    c.WORDS = (n: any, currency: any) => amountInWords(Math.abs(num(n)), String(currency || ''));
    return c;
  }

  preAgg(expr: string): string {
    return expr.replace(/\b(SUM|AVG|MIN|MAX|COUNT)\s*\(\s*([A-Za-z_$][\w.$]*)\s*\)/g, (m, fn, path) => {
      const parts = path.split('.');
      if (parts.length >= 2) { const f = parts.pop(); return fn + '(' + parts.join('.') + ",'" + f + "')"; }
      return fn + '(' + path + ')';
    });
  }

  evalExpr(raw: string, extra?: any): any {
    try {
      const ctx = this.buildCtx(extra);
      return safeEval(this.preAgg(raw), ctx, new Set(HELPERS.map(h => ctx[h])));
    } catch (e) { return '⚠'; }
  }

  interpolate(text: any, extra?: any): string {
    if (text == null) { return ''; }
    return String(text).replace(/\{\{([\s\S]+?)\}\}/g, (m, e) => {
      const v = this.evalExpr(e.trim(), extra);
      return (v == null || v === '') ? '' : v;
    });
  }

  getPath(path: string, base?: any): any {
    try { return path.split('.').reduce((o: any, k: string) => (o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined), base || this.bind); } catch (e) { return undefined; }
  }

  escapeHtml(s: any): string { return String(s == null ? '' : s).replace(/[&<>"']/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])); }
  escapeAttr(s: any): string { return this.escapeHtml(s); }

  toHex(c: any): string {
    if (!c || c === 'transparent') { return '#ffffff'; }
    if (c[0] === '#') { if (c.length === 4) { return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; } return c.slice(0, 7); }
    const m = c.match(/\d+/g);
    if (m) { return '#' + m.slice(0, 3).map((n: any) => (+n).toString(16).padStart(2, '0')).join(''); }
    return '#000000';
  }
}
