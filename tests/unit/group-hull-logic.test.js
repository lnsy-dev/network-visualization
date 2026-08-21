/**
 * Group Hull Logic Unit Tests
 *
 * Tests for the pure hull helpers in src/group-hull-logic.js.
 */

import { describe, it, expect } from 'vitest';
import {
  computeGroupCenter,
  expandNodesToHullPoints,
} from '../../src/group-hull-logic.js';

describe('group-hull-logic', () => {
  describe('computeGroupCenter', () => {
    it('computes the average of a single node', () => {
      const nodes = [{ x: 10, y: 20, z: 30 }];

      expect(computeGroupCenter(nodes)).toEqual({ x: 10, y: 20, z: 30 });
    });

    it('computes the average of multiple nodes', () => {
      const nodes = [
        { x: 0, y: 0, z: 0 },
        { x: 20, y: 40, z: 60 },
      ];

      expect(computeGroupCenter(nodes)).toEqual({ x: 10, y: 20, z: 30 });
    });
  });

  describe('expandNodesToHullPoints', () => {
    it('expands a single node into eight corners', () => {
      const nodes = [{ x: 0, y: 0, z: 0 }];
      const padding = 5;

      const points = expandNodesToHullPoints(nodes, padding);

      expect(points).toHaveLength(8);
      expect(points).toContainEqual({ x: -5, y: -5, z: -5 });
      expect(points).toContainEqual({ x: 5, y: 5, z: 5 });
    });

    it('uses the node position as the cube center', () => {
      const nodes = [{ x: 10, y: 20, z: 30 }];
      const padding = 2;

      const points = expandNodesToHullPoints(nodes, padding);

      expect(points).toContainEqual({ x: 8, y: 18, z: 28 });
      expect(points).toContainEqual({ x: 12, y: 22, z: 32 });
    });

    it('produces eight points per node', () => {
      const nodes = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 10, z: 10 },
      ];

      const points = expandNodesToHullPoints(nodes, 1);

      expect(points).toHaveLength(16);
    });
  });
});
