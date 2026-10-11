/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sandboxed evaluator for template {{ }} expressions.
 *
 * Templates are authored by one user and rendered in the browser of everyone who prints them, so
 * expressions must not be able to run arbitrary code (the original engine used `new Function`).
 * This interpreter understands a small JavaScript subset: literals, field paths (a.b, a[0]),
 * arithmetic, comparison, logical and ternary operators, calls to the report helpers (SUM, MONEY…)
 * and a whitelist of string/number/array methods. Property access is limited to own data properties,
 * so prototypes, constructors and globals are unreachable.
 */

type Node =
  | { k: 'lit'; v: any }
  | { k: 'id'; name: string }
  | { k: 'mem'; obj: Node; prop: Node; computed: boolean }
  | { k: 'call'; callee: Node; args: Node[] }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'tern'; c: Node; a: Node; b: Node };

const BLOCKED = new Set(['__proto__', 'prototype', 'constructor', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
const METHODS = new Set(['toFixed', 'toUpperCase', 'toLowerCase', 'trim', 'slice', 'substring', 'substr', 'padStart', 'padEnd', 'split', 'join', 'includes', 'indexOf', 'startsWith', 'endsWith', 'charAt', 'toString', 'toLocaleString', 'replace', 'replaceAll', 'concat', 'at']);
const OPS = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '??', '<', '>', '+', '-', '*', '/', '%', '!', '?', ':', '.', ',', '(', ')', '[', ']'];

type Tok = { t: 'num' | 'str' | 'id' | 'op'; v: any };

function tokenize(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!; out.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\' && j + 1 < src.length) { j++; s += ({ n: '\n', t: '\t' } as any)[src[j]] ?? src[j]; } else { s += src[j]; } j++; }
      if (j >= src.length) { throw new Error('Unterminated string'); }
      out.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))!; out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    const op = OPS.find(o => src.startsWith(o, i));
    if (!op) { throw new Error('Unexpected ' + c); }
    out.push({ t: 'op', v: op }); i += op.length;
  }
  return out;
}

function parse(src: string): Node {
  const toks = tokenize(src); let p = 0;
  const peek = (v?: string) => { const t = toks[p]; return t && t.t === 'op' && (v === undefined || t.v === v) ? t : null; };
  const eat = (v: string) => { if (!peek(v)) { throw new Error('Expected ' + v); } p++; };
  const binary = (next: () => Node, ops: string[]) => (): Node => {
    let a = next();
    while (toks[p] && toks[p].t === 'op' && ops.includes(toks[p].v)) { const op = toks[p++].v; a = { k: 'bin', op, a, b: next() }; }
    return a;
  };
  const primary = (): Node => {
    const t = toks[p++];
    if (!t) { throw new Error('Unexpected end'); }
    if (t.t === 'num' || t.t === 'str') { return { k: 'lit', v: t.v }; }
    if (t.t === 'id') {
      if (t.v === 'true') { return { k: 'lit', v: true }; }
      if (t.v === 'false') { return { k: 'lit', v: false }; }
      if (t.v === 'null') { return { k: 'lit', v: null }; }
      if (t.v === 'undefined') { return { k: 'lit', v: undefined }; }
      return { k: 'id', name: t.v };
    }
    if (t.v === '(') { const e = expr(); eat(')'); return e; }
    throw new Error('Unexpected ' + t.v);
  };
  const postfix = (): Node => {
    let n = primary();
    for (;;) {
      if (peek('.')) { p++; const t = toks[p++]; if (!t || t.t !== 'id') { throw new Error('Expected property'); } n = { k: 'mem', obj: n, prop: { k: 'lit', v: t.v }, computed: false }; }
      else if (peek('[')) { p++; const prop = expr(); eat(']'); n = { k: 'mem', obj: n, prop, computed: true }; }
      else if (peek('(')) { p++; const args: Node[] = []; if (!peek(')')) { do { args.push(expr()); } while (peek(',') && ++p); } eat(')'); n = { k: 'call', callee: n, args }; }
      else { return n; }
    }
  };
  const unary = (): Node => { if (peek('-') || peek('+') || peek('!')) { const op = toks[p++].v; return { k: 'un', op, a: unary() }; } return postfix(); };
  const mul = binary(unary, ['*', '/', '%']);
  const add = binary(mul, ['+', '-']);
  const rel = binary(add, ['<', '<=', '>', '>=']);
  const eq = binary(rel, ['==', '!=', '===', '!==']);
  const and = binary(eq, ['&&']);
  const or = binary(and, ['||', '??']);
  const expr = (): Node => {
    const c = or();
    if (peek('?')) { p++; const a = expr(); eat(':'); const b = expr(); return { k: 'tern', c, a, b }; }
    return c;
  };
  const n = expr();
  if (p < toks.length) { throw new Error('Unexpected ' + toks[p].v); }
  return n;
}

const own = (o: any, k: any): boolean => o != null && (typeof o === 'object' || typeof o === 'string') && Object.prototype.hasOwnProperty.call(Object(o), k);

function get(o: any, k: any): any {
  if (o == null) { return undefined; }
  const key = typeof k === 'number' ? k : String(k);
  if (typeof key === 'string' && BLOCKED.has(key)) { throw new Error('Blocked property'); }
  if (key === 'length' && (typeof o === 'string' || Array.isArray(o))) { return o.length; }
  return own(o, key) ? o[key] : undefined;
}

function run(n: Node, ctx: any, helpers: Set<any>): any {
  switch (n.k) {
    case 'lit': return n.v;
    case 'id': if (BLOCKED.has(n.name)) { throw new Error('Blocked'); } return own(ctx, n.name) ? ctx[n.name] : undefined;
    case 'mem': return get(run(n.obj, ctx, helpers), run(n.prop, ctx, helpers));
    case 'call': {
      const args = () => n.args.map(a => run(a, ctx, helpers));
      if (n.callee.k === 'mem') {
        const target = run(n.callee.obj, ctx, helpers), name = run(n.callee.prop, ctx, helpers);
        const ok = METHODS.has(name) && (typeof target === 'string' || typeof target === 'number' || Array.isArray(target));
        if (!ok) { throw new Error('Method not allowed: ' + name); }
        const a = args();
        if (a.some(x => typeof x === 'function')) { throw new Error('Function arguments are not allowed'); }
        return (target as any)[name](...a);
      }
      const fn = run(n.callee, ctx, helpers);
      if (!helpers.has(fn)) { throw new Error('Not a report function'); }
      return fn(...args());
    }
    case 'un': { const a = run(n.a, ctx, helpers); return n.op === '-' ? -a : n.op === '+' ? +a : !a; }
    case 'tern': return run(n.c, ctx, helpers) ? run(n.a, ctx, helpers) : run(n.b, ctx, helpers);
    case 'bin': {
      if (n.op === '&&') { const a = run(n.a, ctx, helpers); return a ? run(n.b, ctx, helpers) : a; }
      if (n.op === '||') { const a = run(n.a, ctx, helpers); return a ? a : run(n.b, ctx, helpers); }
      if (n.op === '??') { const a = run(n.a, ctx, helpers); return a ?? run(n.b, ctx, helpers); }
      const a = run(n.a, ctx, helpers), b = run(n.b, ctx, helpers);
      switch (n.op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': return a % b;
        case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b;
        // eslint-disable-next-line eqeqeq
        case '==': return a == b; case '!=': return a != b; // eslint-disable-line eqeqeq
        case '===': return a === b; case '!==': return a !== b;
      }
    }
  }
  throw new Error('Unsupported expression');
}

const cache = new Map<string, Node>();
/** Evaluate `src` against `ctx`. Only functions contained in `helpers` may be called. Throws on invalid or disallowed input. */
export function safeEval(src: string, ctx: any, helpers: Set<any>): any {
  let ast = cache.get(src);
  if (!ast) { ast = parse(src); if (cache.size > 2000) { cache.clear(); } cache.set(src, ast); }
  return run(ast, ctx, helpers);
}
