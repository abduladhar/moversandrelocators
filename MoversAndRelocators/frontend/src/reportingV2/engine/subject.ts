/** Minimal replacement for an RxJS Subject: synchronous fan-out to subscribers. */
export class Subject<T> {
  private subs = new Set<(v: T) => void>();
  next(v: T): void { this.subs.forEach(f => f(v)); }
  subscribe(f: (v: T) => void): { unsubscribe: () => void } { this.subs.add(f); return { unsubscribe: () => { this.subs.delete(f); } }; }
}
