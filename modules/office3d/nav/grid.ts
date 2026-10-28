// Walkable grid of the office floor + A* (IMPLEMENTATION.md §6.6). Pure: obstacles come in as rectangles
// (the client rasterises the shell and layout items into them), so paths can be tested without three.js.

export type Point = { x: number; z: number };
/** Axis-aligned rectangle on the floor: [minX, minZ, maxX, maxZ] */
export type Rect = [number, number, number, number];
export type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number };

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** Min-heap of cell indexes ordered by f, then h, then index, so equal-cost paths always come out the same. */
class Heap {
  private items: number[] = [];
  constructor(private f: Float64Array, private h: Float64Array) {}
  get size() {
    return this.items.length;
  }
  private less(a: number, b: number) {
    const { f, h } = this;
    return f[a] !== f[b] ? f[a] < f[b] : h[a] !== h[b] ? h[a] < h[b] : a < b;
  }
  push(i: number) {
    const it = this.items;
    it.push(i);
    let c = it.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!this.less(it[c], it[p])) break;
      [it[c], it[p]] = [it[p], it[c]];
      c = p;
    }
  }
  pop() {
    const it = this.items;
    const top = it[0];
    const last = it.pop()!;
    if (it.length) {
      it[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < it.length && this.less(it[l], it[m])) m = l;
        if (r < it.length && this.less(it[r], it[m])) m = r;
        if (m === p) break;
        [it[p], it[m]] = [it[m], it[p]];
        p = m;
      }
    }
    return top;
  }
}

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(
    readonly bounds: Bounds,
    readonly cell = 0.25,
  ) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  private col(x: number) {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.bounds.minX) / this.cell)));
  }
  private row(z: number) {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.bounds.minZ) / this.cell)));
  }
  private index(p: Point) {
    return this.row(p.z) * this.cols + this.col(p.x);
  }
  private center(i: number): Point {
    return { x: this.bounds.minX + ((i % this.cols) + 0.5) * this.cell, z: this.bounds.minZ + (Math.floor(i / this.cols) + 0.5) * this.cell };
  }

  /** Mark every cell the rectangle touches as blocked. */
  block([x0, z0, x1, z1]: Rect) {
    if (x1 < this.bounds.minX || z1 < this.bounds.minZ || x0 > this.bounds.maxX || z0 > this.bounds.maxZ) return;
    for (let r = this.row(z0); r <= this.row(z1); r++) for (let c = this.col(x0); c <= this.col(x1); c++) this.blocked[r * this.cols + c] = 1;
  }

  isFree(p: Point) {
    const inside = p.x >= this.bounds.minX && p.x < this.bounds.maxX && p.z >= this.bounds.minZ && p.z < this.bounds.maxZ;
    return inside && !this.blocked[this.index(p)];
  }

  /** Nearest free cell (ring by ring), for start/goal points that sit inside furniture (chairs, anchors at a desk). */
  private nearestFree(i: number) {
    if (!this.blocked[i]) return i;
    const c0 = i % this.cols;
    const r0 = Math.floor(i / this.cols);
    for (let ring = 1; ring < Math.max(this.cols, this.rows); ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let r = r0 - ring; r <= r0 + ring; r++) {
        for (let c = c0 - ring; c <= c0 + ring; c++) {
          if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) continue;
          if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== ring) continue;
          const j = r * this.cols + c;
          const d = (r - r0) ** 2 + (c - c0) ** 2;
          if (!this.blocked[j] && d < bestD) [best, bestD] = [j, d];
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Straight line stays on free cells (sampled at quarter-cell steps). */
  lineOfSight(a: Point, b: Point) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell / 4));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      if (!this.isFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false;
    }
    return true;
  }

  /**
   * Path from → to as floor points (first = from, last = to), or null when there is no way through.
   * 8-way A* without cutting corners, then string-pulled to the fewest straight segments.
   */
  findPath(from: Point, to: Point): Point[] | null {
    const start = this.nearestFree(this.index(from));
    const goal = this.nearestFree(this.index(to));
    if (start < 0 || goal < 0) return null;

    const n = this.cols * this.rows;
    const g = new Float64Array(n).fill(Infinity);
    const f = new Float64Array(n);
    const h = new Float64Array(n);
    const parent = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const gc = goal % this.cols;
    const gr = Math.floor(goal / this.cols);
    const heuristic = (i: number) => {
      const dx = Math.abs((i % this.cols) - gc);
      const dz = Math.abs(Math.floor(i / this.cols) - gr);
      return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
    };
    const open = new Heap(f, h);
    g[start] = 0;
    h[start] = heuristic(start);
    f[start] = h[start];
    open.push(start);

    while (open.size) {
      const cur = open.pop();
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      const c = cur % this.cols;
      const r = Math.floor(cur / this.cols);
      for (const [dc, dr, cost] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const next = nr * this.cols + nc;
        if (this.blocked[next] || closed[next]) continue;
        // No squeezing diagonally between two blocked cells
        if (dc && dr && (this.blocked[r * this.cols + nc] || this.blocked[nr * this.cols + c])) continue;
        const ng = g[cur] + cost;
        if (ng >= g[next]) continue;
        g[next] = ng;
        parent[next] = cur;
        h[next] = heuristic(next);
        f[next] = ng + h[next];
        open.push(next);
      }
    }
    if (start !== goal && parent[goal] < 0) return null;

    const cells: number[] = [];
    for (let i = goal; i >= 0; i = i === start ? -1 : parent[i]) cells.push(i);
    const raw = [from, ...cells.reverse().map((i) => this.center(i)), to];

    // String pulling: from each kept point jump to the farthest point still in sight
    const out = [raw[0]];
    let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.lineOfSight(raw[i], raw[j])) j--;
      out.push(raw[j]);
      i = j;
    }
    return out;
  }
}
