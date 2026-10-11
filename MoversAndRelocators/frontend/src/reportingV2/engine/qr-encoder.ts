/* Self-contained QR Code encoder — NO npm dependency.
 * Byte-mode (UTF-8) encoding, automatic version selection (1..40), Reed-Solomon
 * error correction, automatic mask selection. Produces a genuinely scannable
 * QR module matrix. Adapted from Project Nayuki's QR Code generator (MIT License).
 *
 * Public API:  qrMatrix(text, ecl?) -> boolean[][]   (row-major; true = dark module)
 * Verified: decodes correctly via OpenCV QRCodeDetector for ASCII, UTF-8, URLs and
 * long strings up to version 40.
 */

type Ecl = 'L' | 'M' | 'Q' | 'H';

// Error-correction codewords per block, indexed by [ecl ordinal L=0..H=3][version]
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
const ECC_FORMAT_BITS = [1, 0, 3, 2]; // L,M,Q,H
const ECL_ORD: Record<string, number> = { L: 0, M: 1, Q: 2, H: 3 };
const MIN_VERSION = 1, MAX_VERSION = 40;

function getBit(x: number, i: number): boolean { return ((x >>> i) & 1) !== 0; }

function toUtf8(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
      const c2 = str.charCodeAt(i + 1);
      const cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
  }
  return out;
}

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) { result -= 36; }
  }
  return result;
}
function getNumDataCodewords(ver: number, eclOrd: number): number {
  return Math.floor(getNumRawDataModules(ver) / 8)
    - ECC_CODEWORDS_PER_BLOCK[eclOrd][ver] * NUM_ERROR_CORRECTION_BLOCKS[eclOrd][ver];
}

// ---- Reed-Solomon over GF(256), primitive polynomial 0x11D ----
function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}
function rsComputeDivisor(degree: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < degree - 1; i++) { result.push(0); }
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) { result[j] ^= result[j + 1]; }
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}
function rsComputeRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  data.forEach((b) => {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= rsMultiply(coef, factor); });
  });
  return result;
}

function getAlignmentPatternPositions(ver: number): number[] {
  if (ver === 1) { return []; }
  const numAlign = Math.floor(ver / 7) + 2;
  const step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) { result.splice(1, 0, pos); }
  return result;
}

function addEccAndInterleave(data: number[], version: number, eclOrd: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[eclOrd][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[eclOrd][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: { dat: number[]; ecc: number[]; isShort: boolean }[] = [];
  const rsDiv = rsComputeDivisor(blockEccLen);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const isShort = i < numShortBlocks;
    const datLen = shortBlockLen - blockEccLen + (isShort ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = rsComputeRemainder(dat, rsDiv);
    if (isShort) { dat.push(0); } // padding column placeholder
    blocks.push({ dat, ecc, isShort });
  }

  const result: number[] = [];
  const lastDataCol = shortBlockLen - blockEccLen; // padding column index for short blocks
  for (let col = 0; col <= lastDataCol; col++) {
    for (let b = 0; b < blocks.length; b++) {
      if (!(col === lastDataCol && blocks[b].isShort)) { result.push(blocks[b].dat[col]); }
    }
  }
  for (let col = 0; col < blockEccLen; col++) {
    for (let b = 0; b < blocks.length; b++) { result.push(blocks[b].ecc[col]); }
  }
  return result;
}

class QrMatrixBuilder {
  size: number;
  eclOrd: number;
  version: number;
  modules: boolean[][] = [];
  isFunction: boolean[][] = [];

  constructor(version: number, eclOrd: number) {
    this.version = version; this.eclOrd = eclOrd; this.size = version * 4 + 17;
    for (let r = 0; r < this.size; r++) {
      this.modules.push(new Array(this.size).fill(false));
      this.isFunction.push(new Array(this.size).fill(false));
    }
  }
  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark; this.isFunction[y][x] = true;
  }
  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }
  private drawAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  drawFunctionPatterns(alignPos: number[]): void {
    const size = this.size;
    for (let i = 0; i < size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(size - 4, 3);
    this.drawFinderPattern(3, size - 4);
    const n = alignPos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) {
          this.drawAlignmentPattern(alignPos[i], alignPos[j]);
        }
      }
    }
    this.drawFormatBits(0);
    this.drawVersion();
  }
  drawFormatBits(mask: number): void {
    const data = (ECC_FORMAT_BITS[this.eclOrd] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) { rem = (rem << 1) ^ ((rem >>> 9) * 0x537); }
    const bits = ((data << 10) | rem) ^ 0x5412;
    const size = this.size;
    for (let i = 0; i <= 5; i++) { this.setFunctionModule(8, i, getBit(bits, i)); }
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) { this.setFunctionModule(14 - i, 8, getBit(bits, i)); }
    for (let i = 0; i < 8; i++) { this.setFunctionModule(size - 1 - i, 8, getBit(bits, i)); }
    for (let i = 8; i < 15; i++) { this.setFunctionModule(8, size - 15 + i, getBit(bits, i)); }
    this.setFunctionModule(8, size - 8, true);
  }
  private drawVersion(): void {
    if (this.version < 7) { return; }
    let rem = this.version;
    for (let i = 0; i < 12; i++) { rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); }
    const bits = (this.version << 12) | rem;
    const size = this.size;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      this.setFunctionModule(a, b, bit);
      this.setFunctionModule(b, a, bit);
    }
  }
  drawCodewords(data: number[]): void {
    const size = this.size; let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) { right = 5; }
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }
  applyMask(mask: number): void {
    const size = this.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (this.isFunction[y][x]) { continue; }
        let invert = false;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
        }
        if (invert) { this.modules[y][x] = !this.modules[y][x]; }
      }
    }
  }
  getPenaltyScore(): number {
    const size = this.size, mod = this.modules; let score = 0;
    for (let y = 0; y < size; y++) {
      let runColor = false, run = 0;
      for (let x = 0; x < size; x++) {
        if (mod[y][x] === runColor) { run++; if (run === 5) { score += 3; } else if (run > 5) { score++; } }
        else { runColor = mod[y][x]; run = 1; }
      }
    }
    for (let x = 0; x < size; x++) {
      let runColor = false, run = 0;
      for (let y = 0; y < size; y++) {
        if (mod[y][x] === runColor) { run++; if (run === 5) { score += 3; } else if (run > 5) { score++; } }
        else { runColor = mod[y][x]; run = 1; }
      }
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) { score += 3; }
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++) { for (let x = 0; x < size; x++) { if (mod[y][x]) { dark++; } } }
    const total = size * size;
    const kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    score += kk * 10;
    return score;
  }
}

function appendBits(val: number, len: number, bb: number[]): void {
  for (let i = len - 1; i >= 0; i--) { bb.push((val >>> i) & 1); }
}

/** Encode `text` into a QR module matrix (row-major boolean[][]; true = dark). */
export function qrMatrix(text: string, ecl: Ecl = 'M'): boolean[][] {
  const eclOrd = ECL_ORD[ecl] != null ? ECL_ORD[ecl] : 1;
  const data = toUtf8(String(text == null ? '' : text));

  let version = -1, dataCapacityBits = 0;
  for (let v = MIN_VERSION; v <= MAX_VERSION; v++) {
    const capBits = getNumDataCodewords(v, eclOrd) * 8;
    const ccBits = (v <= 9) ? 8 : 16;
    const need = 4 + ccBits + data.length * 8;
    if (need <= capBits) { version = v; dataCapacityBits = capBits; break; }
  }
  if (version < 0) { throw new Error('QR: data too long'); }

  const bb: number[] = [];
  appendBits(0x4, 4, bb);
  appendBits(data.length, (version <= 9) ? 8 : 16, bb);
  for (let i = 0; i < data.length; i++) { appendBits(data[i], 8, bb); }
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - bb.length % 8) % 8, bb);
  for (let padByte = 0xEC; bb.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11) { appendBits(padByte, 8, bb); }

  const dataCodewords: number[] = [];
  for (let i = 0; i < bb.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) { b = (b << 1) | bb[i + j]; }
    dataCodewords.push(b);
  }

  const allCodewords = addEccAndInterleave(dataCodewords, version, eclOrd);

  const qr = new QrMatrixBuilder(version, eclOrd);
  qr.drawFunctionPatterns(getAlignmentPatternPositions(version));
  qr.drawCodewords(allCodewords);

  let minPenalty = Infinity, bestMask = 0;
  for (let mask = 0; mask < 8; mask++) {
    qr.applyMask(mask);
    qr.drawFormatBits(mask);
    const penalty = qr.getPenaltyScore();
    if (penalty < minPenalty) { minPenalty = penalty; bestMask = mask; }
    qr.applyMask(mask); // undo
  }
  qr.applyMask(bestMask);
  qr.drawFormatBits(bestMask);

  return qr.modules;
}
