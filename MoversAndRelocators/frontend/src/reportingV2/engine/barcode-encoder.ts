/* Self-contained Code 128 barcode encoder — NO npm dependency.
 * Automatic code-set selection (B/C) for compact, scannable output.
 * Public API:  code128Modules(text) -> number[]   (bar/space module widths, starting with a bar)
 * Verified: decodes correctly via zxing-cpp for alphanumeric, numeric and mixed values.
 */

// Pattern table: index 0..106, each is 6 module widths (bar,space,bar,space,bar,space);
// 106 (Stop) has 7. Values 103/104/105 are Start A/B/C.
const C128: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];
const START_B = 104, START_C = 105, CODE_B = 100, CODE_C = 99, STOP = 106;

function digitsAhead(s: string, pos: number): number {
  let n = 0;
  while (pos + n < s.length && s[pos + n] >= '0' && s[pos + n] <= '9') { n++; }
  return n;
}

/** Encode text into the list of Code128 symbol values (incl. start, checksum, stop). Throws on out-of-range chars. */
function encodeValues(text: string): number[] {
  const s = String(text == null ? '' : text);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c > 126) { throw new Error('Code128: character out of range'); }
  }
  const codes: number[] = [];
  let i = 0, mode: 'B' | 'C';
  const d0 = digitsAhead(s, 0);
  if (d0 >= 2 && (d0 === s.length || d0 >= 4)) { codes.push(START_C); mode = 'C'; }
  else { codes.push(START_B); mode = 'B'; }
  while (i < s.length) {
    if (mode === 'C') {
      if (digitsAhead(s, i) >= 2) {
        codes.push(parseInt(s.substr(i, 2), 10)); i += 2;
        if (i < s.length && digitsAhead(s, i) < 2) { codes.push(CODE_B); mode = 'B'; }
      } else { codes.push(CODE_B); mode = 'B'; }
    } else { // Code B
      const d = digitsAhead(s, i);
      if (d >= 4) {
        if (d % 2 === 1) { codes.push(s.charCodeAt(i) - 32); i++; }
        codes.push(CODE_C); mode = 'C';
      } else { codes.push(s.charCodeAt(i) - 32); i++; }
    }
  }
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) { sum += codes[k] * k; }
  codes.push(sum % 103);
  codes.push(STOP);
  return codes;
}

/** Encode text into an array of module widths (bar, space, bar, … starting & ending with a bar). */
export function code128Modules(text: string): number[] {
  const values = encodeValues(text);
  const widths: number[] = [];
  for (const v of values) {
    const p = C128[v];
    for (let k = 0; k < p.length; k++) { widths.push(+p[k]); }
  }
  return widths;
}
