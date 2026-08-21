/**
 * Interaction Logic
 *
 * Pure helpers for deciding whether a pointer interaction should be treated
 * as a drag based on the distance between mouse-down and mouse-up positions.
 *
 * @module interaction-logic
 */

/**
 * Determine whether pointer movement should be considered a drag.
 *
 * @param {{x: number, y: number}} mouseDownPos - Position at pointer down
 * @param {{x: number, y: number}} mouseUpPos - Position at pointer up/move
 * @param {number} [threshold=5] - Pixel distance above which the interaction is a drag
 * @returns {boolean} True if the movement exceeds the drag threshold
 */
export function isDrag(mouseDownPos, mouseUpPos, threshold = 5) {
  if (!mouseDownPos || !mouseUpPos) return false;

  const dx = mouseUpPos.x - mouseDownPos.x;
  const dy = mouseUpPos.y - mouseDownPos.y;

  return Math.abs(dx) > threshold || Math.abs(dy) > threshold;
}
