/**
 * Scene Logic Unit Tests
 *
 * Tests for pure viewport/camera helpers in src/scene-logic.js.
 */

import { describe, it, expect } from 'vitest';
import { parseInset, computeFitDistance } from '../../src/scene-logic.js';

describe('parseInset', () => {
  it('returns all zeros for null, undefined, and empty values', () => {
    const expected = { top: 0, right: 0, bottom: 0, left: 0 };

    expect(parseInset(null)).toEqual(expected);
    expect(parseInset(undefined)).toEqual(expected);
    expect(parseInset('')).toEqual(expected);
    expect(parseInset('   ')).toEqual(expected);
  });

  it('applies a single value to all sides', () => {
    expect(parseInset('10px')).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(parseInset('12.5')).toEqual({ top: 12.5, right: 12.5, bottom: 12.5, left: 12.5 });
  });

  it('splits two values as vertical/horizontal', () => {
    expect(parseInset('10px 20px')).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
  });

  it('splits three values as top/horizontal/bottom', () => {
    expect(parseInset('10px 20px 30px')).toEqual({ top: 10, right: 20, bottom: 30, left: 20 });
  });

  it('splits four values as top/right/bottom/left', () => {
    expect(parseInset('10px 20px 30px 40px')).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    });
  });

  it('treats invalid tokens as zero', () => {
    expect(parseInset('10px abc 30px')).toEqual({ top: 10, right: 0, bottom: 30, left: 0 });
    expect(parseInset('foo bar baz qux')).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('ignores extra whitespace', () => {
    expect(parseInset('  10px   20px  ')).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
  });
});

describe('computeFitDistance', () => {
  it('returns a positive distance for a square viewport and no insets', () => {
    const distance = computeFitDistance(
      100,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { width: 800, height: 800 },
      75,
      1.0
    );

    expect(distance).toBeGreaterThan(0);
  });

  it('increases distance when insets shrink the limiting viewport dimension', () => {
    // Tall viewport where width is the limiting dimension.
    const noInsets = computeFitDistance(
      100,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { width: 400, height: 1600 },
      75,
      1.0
    );
    const withInsets = computeFitDistance(
      100,
      { top: 0, right: 100, bottom: 0, left: 100 },
      { width: 400, height: 1600 },
      75,
      1.0
    );

    expect(withInsets).toBeGreaterThan(noInsets);
  });

  it('scales linearly with padding factor', () => {
    const distance1x = computeFitDistance(
      100,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { width: 800, height: 800 },
      75,
      1.0
    );
    const distance2x = computeFitDistance(
      100,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { width: 800, height: 800 },
      75,
      2.0
    );

    expect(distance2x).toBeCloseTo(distance1x * 2, 5);
  });

  it('returns 0 when the bounding box has no size', () => {
    const distance = computeFitDistance(
      0,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { width: 800, height: 800 },
      75,
      1.0
    );

    expect(distance).toBe(0);
  });
});
