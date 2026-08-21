/**
 * Interaction Logic Unit Tests
 *
 * Tests for the pure interaction helpers in src/interaction-logic.js.
 */

import { describe, it, expect } from 'vitest';
import { isDrag } from '../../src/interaction-logic.js';

describe('interaction-logic', () => {
  describe('isDrag', () => {
    it('returns false for identical positions', () => {
      expect(isDrag({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false);
    });

    it('returns false when movement is within the default threshold', () => {
      expect(isDrag({ x: 0, y: 0 }, { x: 4, y: 3 })).toBe(false);
    });

    it('returns true when horizontal movement exceeds the threshold', () => {
      expect(isDrag({ x: 0, y: 0 }, { x: 6, y: 0 })).toBe(true);
    });

    it('returns true when vertical movement exceeds the threshold', () => {
      expect(isDrag({ x: 0, y: 0 }, { x: 0, y: 6 })).toBe(true);
    });

    it('uses a custom threshold when provided', () => {
      expect(isDrag({ x: 0, y: 0 }, { x: 3, y: 0 }, 5)).toBe(false);
      expect(isDrag({ x: 0, y: 0 }, { x: 6, y: 0 }, 5)).toBe(true);
    });

    it('returns false when a position is missing', () => {
      expect(isDrag(null, { x: 10, y: 10 })).toBe(false);
      expect(isDrag({ x: 10, y: 10 }, null)).toBe(false);
    });
  });
});
