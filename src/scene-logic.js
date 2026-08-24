/**
 * Scene Logic
 *
 * Pure helpers for camera fitting and viewport calculations.
 *
 * @module scene-logic
 */

/**
 * Calculate the camera distance needed to fit a bounding box inside a viewport.
 *
 * Accounts for viewport insets and uses the smaller of the vertical and
 * horizontal fields of view so the object fits in both dimensions.
 *
 * @param {number} maxDim - Maximum dimension of the bounding box
 * @param {{top: number, right: number, bottom: number, left: number}} insets - Viewport insets in pixels
 * @param {{width: number, height: number}} containerSize - Full container dimensions
 * @param {number} fov - Vertical field of view in degrees
 * @param {number} [paddingFactor=1.7] - Multiplier for extra space around objects
 * @returns {number} Required camera distance
 */
export function computeFitDistance(maxDim, insets, containerSize, fov, paddingFactor = 1.7) {
  const effectiveWidth = Math.max(1, containerSize.width - insets.left - insets.right);
  const effectiveHeight = Math.max(1, containerSize.height - insets.top - insets.bottom);
  const effectiveAspect = effectiveWidth / effectiveHeight;

  const vFOV = fov * (Math.PI / 180);
  const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * effectiveAspect);
  const effectiveFOV = Math.min(vFOV, hFOV);

  return (maxDim / 2) / Math.tan(effectiveFOV / 2) * paddingFactor;
}

/**
 * Parse a CSS background-color value into an opaque color string plus alpha.
 *
 * The component renders on a WebGL canvas, so a transparent or semi-transparent
 * host theme must be applied as a clear color + clear alpha pair. Without this,
 * a transparent host background would collapse to opaque black.
 *
 * Supports "transparent", hex (#rgb/#rrggbb), and rgb()/rgba() strings with
 * numeric or percentage channels.
 *
 * @param {string|null|undefined} value - CSS color string (e.g. from getComputedStyle)
 * @returns {{color: string, alpha: number}} Opaque CSS color string and 0..1 alpha
 */
export function parseBackgroundColor(value) {
  if (!value || typeof value !== 'string' || value.trim() === 'transparent') {
    return { color: '#000000', alpha: 0 };
  }

  const trimmed = value.trim();

  // rgb() / rgba() with numeric or percentage channels.
  const functionalMatch = trimmed.match(/^rgba?\(([^)]*)\)$/i);
  if (functionalMatch) {
    const channels = functionalMatch[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((token) => token.trim());

    if (channels.length >= 3) {
      const toByte = (token) => {
        if (token.endsWith('%')) {
          const percent = parseFloat(token);
          return Number.isFinite(percent) ? Math.round((Math.min(100, Math.max(0, percent)) / 100) * 255) : 0;
        }
        const num = parseFloat(token);
        return Number.isFinite(num) ? Math.min(255, Math.max(0, Math.round(num))) : 0;
      };

      const r = toByte(channels[0]);
      const g = toByte(channels[1]);
      const b = toByte(channels[2]);

      let alpha = 1;
      if (channels.length >= 4) {
        if (channels[3].endsWith('%')) {
          const percent = parseFloat(channels[3]);
          alpha = Number.isFinite(percent) ? Math.min(1, Math.max(0, percent / 100)) : 1;
        } else {
          const num = parseFloat(channels[3]);
          alpha = Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : 1;
        }
      }

      return { color: `rgb(${r}, ${g}, ${b})`, alpha };
    }
  }

  // Hex and any other format THREE.Color can parse directly; fully opaque.
  return { color: trimmed, alpha: 1 };
}

/**
 * Parse a CSS inset value into top/right/bottom/left pixel numbers.
 *
 * Supports the standard CSS shorthand forms:
 *   - "10px"           → all sides
 *   - "10px 20px"      → vertical horizontal
 *   - "10px 20px 30px" → top horizontal bottom
 *   - "10px 20px 30px 40px" → top right bottom left
 *
 * Non-numeric or missing tokens are treated as 0.
 *
 * @param {string|null|undefined} value - CSS inset string
 * @returns {{top: number, right: number, bottom: number, left: number}} Parsed insets in pixels
 */
export function parseInset(value) {
  if (!value || typeof value !== 'string') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => parseFloat(token))
    .map((num) => (Number.isFinite(num) ? num : 0));

  const [a = 0, b = 0, c = 0, d = 0] = tokens;

  if (tokens.length === 1) {
    return { top: a, right: a, bottom: a, left: a };
  }

  if (tokens.length === 2) {
    return { top: a, right: b, bottom: a, left: b };
  }

  if (tokens.length === 3) {
    return { top: a, right: b, bottom: c, left: b };
  }

  return { top: a, right: b, bottom: c, left: d };
}
