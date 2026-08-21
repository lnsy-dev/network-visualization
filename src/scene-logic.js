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
