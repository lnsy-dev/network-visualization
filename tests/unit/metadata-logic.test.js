/**
 * Metadata Logic Unit Tests
 *
 * Tests for the pure metadata helpers in src/metadata-logic.js.
 */

import { describe, it, expect } from 'vitest';
import {
  getConnectedNodeIds,
  getConnectedNodeNames,
  getGroupMemberNames,
} from '../../src/metadata-logic.js';

describe('metadata-logic', () => {
  describe('getConnectedNodeIds', () => {
    it('returns IDs of nodes linked as source', () => {
      const links = [{ source: 'a', target: 'b' }];
      expect(getConnectedNodeIds('a', links)).toEqual(['b']);
    });

    it('returns IDs of nodes linked as target', () => {
      const links = [{ source: 'a', target: 'b' }];
      expect(getConnectedNodeIds('b', links)).toEqual(['a']);
    });

    it('collects multiple connected IDs and removes duplicates', () => {
      const links = [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
        { source: 'b', target: 'a' },
      ];
      expect(getConnectedNodeIds('a', links)).toEqual(['b', 'c']);
    });

    it('returns an empty array when there are no links', () => {
      expect(getConnectedNodeIds('a', [])).toEqual([]);
    });
  });

  describe('getConnectedNodeNames', () => {
    it('returns display names for connected nodes', () => {
      const nodes = [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ];
      const links = [{ source: 'a', target: 'b' }];

      expect(getConnectedNodeNames('a', links, nodes)).toEqual(['Bob']);
    });

    it('falls back to the node ID when name is missing', () => {
      const nodes = [{ id: 'a', name: 'Alice' }, { id: 'b', name: null }];
      const links = [{ source: 'a', target: 'b' }];

      expect(getConnectedNodeNames('a', links, nodes)).toEqual(['b']);
    });

    it('returns an empty array when the node has no connections', () => {
      expect(getConnectedNodeNames('a', [], [])).toEqual([]);
    });
  });

  describe('getGroupMemberNames', () => {
    it('returns names for all group members', () => {
      const group = { nodeIds: ['a', 'b'] };
      const nodes = [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ];

      expect(getGroupMemberNames(group, nodes)).toEqual(['Alice', 'Bob']);
    });

    it('falls back to IDs when names are missing', () => {
      const group = { nodeIds: ['a', 'b'] };
      const nodes = [
        { id: 'a', name: null },
        { id: 'b', name: '' },
      ];

      expect(getGroupMemberNames(group, nodes)).toEqual(['a', 'b']);
    });

    it('returns an empty array for an empty group', () => {
      expect(getGroupMemberNames({ nodeIds: [] }, [])).toEqual([]);
    });

    it('preserves unknown IDs when a node is missing', () => {
      const group = { nodeIds: ['a', 'missing'] };
      const nodes = [{ id: 'a', name: 'Alice' }];

      expect(getGroupMemberNames(group, nodes)).toEqual(['Alice', 'missing']);
    });
  });
});
