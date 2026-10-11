/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client mirror of the server's layout check (ReportLayoutV2Validation). Style properties are written into
 * style attributes, so they are limited to a CSS-value alphabet; text properties are escaped by the renderer.
 * Returns the first problem found, or '' when the layout is acceptable.
 */
const FREE_TEXT = new Set(['text', 'expr', 'header', 'footer', 'dataPath', 'repeatPath', 'id', 'size', '_label']);
const CSS_VALUE = /^[#\w\s.,%()'+\-/]*$/;
const IMAGE_SRC = /^(data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\r\n]+|https:\/\/[^\s"'<>]+|\{\{[^<>"]*\}\})?$/;

export function layoutProblem(layout: any): string {
  if (!layout || typeof layout !== 'object' || !['fixed', 'batch', 'flow'].includes(layout.mode)) { return 'The layout must declare a fixed, batch or flow mode.'; }
  if (!Array.isArray(layout.pages) || layout.pages.length < 1 || layout.pages.length > 50) { return 'A layout needs between 1 and 50 pages.'; }
  let problem = '';
  const walk = (v: any, key: string | null, depth: number) => {
    if (problem) { return; }
    if (depth > 32) { problem = 'The layout is nested too deeply.'; return; }
    if (Array.isArray(v)) { v.forEach(x => walk(x, key, depth + 1)); return; }
    if (v && typeof v === 'object') { Object.keys(v).forEach(k => walk(v[k], k, depth + 1)); return; }
    if (typeof v !== 'string') { return; }
    if (key === 'src') { if (!IMAGE_SRC.test(v)) { problem = 'Images must be uploaded PNG/JPEG/GIF/WebP data, an https URL or a {{field}}.'; } return; }
    if (v.length > 20000) { problem = 'A layout value is too long.'; return; }
    if ((key === null || !FREE_TEXT.has(key)) && !CSS_VALUE.test(v)) { problem = 'Invalid value for "' + key + '": ' + v.slice(0, 40); }
  };
  walk(layout, null, 0);
  return problem;
}
