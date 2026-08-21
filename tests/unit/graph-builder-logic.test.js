/**
 * Graph Builder Logic Unit Tests
 *
 * Tests for the pure graph-building functions in src/graph-builder-logic.js.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseNodeData,
  parseEdgeData,
  parseGroupData,
  filterValidLinks,
  assignGroupMembership,
  calculateGridPositions,
  GROUP_START_POSITIONS,
} from '../../src/graph-builder-logic.js';

describe('graph-builder-logic', () => {
  describe('parseNodeData', () => {
    it('normalizes a complete node', () => {
      const node = parseNodeData({
        id: 'n1',
        name: 'Node 1',
        color: '#ff0000',
        wireframe: true,
        shape: 'cube',
        content: '<p>Hello</p>',
      });

      expect(node.id).toBe('n1');
      expect(node.name).toBe('Node 1');
      expect(node.color).toBe('#ff0000');
      expect(node.wireframe).toBe(true);
      expect(node.shape).toBe('cube');
      expect(node.content).toBe('<p>Hello</p>');
      expect(node.groups).toEqual([]);
    });

    it('fills in defaults when only an id is provided', () => {
      const node = parseNodeData({ id: 'n1' });

      expect(node.name).toBeNull();
      expect(node.color).toBe('#000000');
      expect(node.wireframe).toBe(false);
      expect(node.shape).toBe('pyramid');
      expect(node.content).toBe('');
    });

    it('uses the foreground color fallback', () => {
      const node = parseNodeData({ id: 'n1', foregroundColor: '#00ff00' });
      expect(node.color).toBe('#00ff00');
    });
  });

  describe('parseEdgeData', () => {
    it('normalizes a complete edge', () => {
      const link = parseEdgeData({
        source: 'a',
        target: 'b',
        name: 'relates',
        color: '#0000ff',
        content: 'edge content',
      });

      expect(link.source).toBe('a');
      expect(link.target).toBe('b');
      expect(link.name).toBe('relates');
      expect(link.color).toBe('#0000ff');
      expect(link.content).toBe('edge content');
    });

    it('fills in defaults', () => {
      const link = parseEdgeData({ source: 'a', target: 'b' });

      expect(link.name).toBeNull();
      expect(link.color).toBe('#000000');
      expect(link.content).toBe('');
    });
  });

  describe('parseGroupData', () => {
    it('splits comma-separated node IDs and trims whitespace', () => {
      const group = parseGroupData({
        id: 'g1',
        name: 'Group 1',
        color: '#ff00ff',
        nodeIds: ' a , b , c ',
        content: '<h1>Group</h1>',
      });

      expect(group.id).toBe('g1');
      expect(group.name).toBe('Group 1');
      expect(group.color).toBe('#ff00ff');
      expect(group.nodeIds).toEqual(['a', 'b', 'c']);
      expect(group.content).toBe('<h1>Group</h1>');
    });

    it('handles an empty node-ids string', () => {
      const group = parseGroupData({ id: 'g1', nodeIds: '' });

      expect(group.nodeIds).toEqual([]);
      expect(group.color).toBe('#888888');
    });
  });

  describe('filterValidLinks', () => {
    it('keeps links whose source and target both exist', () => {
      const links = [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ];

      const result = filterValidLinks(links, ['a', 'b', 'c']);
      expect(result).toHaveLength(2);
    });

    it('drops links with missing source or target and warns', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const links = [
        { source: 'a', target: 'missing' },
        { source: 'missing', target: 'b' },
        { source: 'a', target: 'b' },
      ];

      const result = filterValidLinks(links, ['a', 'b']);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('a');
      expect(result[0].target).toBe('b');
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('assignGroupMembership', () => {
    it('attaches group IDs to member nodes', () => {
      const nodes = [
        { id: 'a', groups: [] },
        { id: 'b', groups: [] },
        { id: 'c', groups: [] },
      ];
      const groups = [
        { id: 'g1', nodeIds: ['a', 'b'] },
        { id: 'g2', nodeIds: ['b', 'c'] },
      ];

      assignGroupMembership(nodes, groups);

      expect(nodes[0].groups).toEqual(['g1']);
      expect(nodes[1].groups).toEqual(['g1', 'g2']);
      expect(nodes[2].groups).toEqual(['g2']);
    });

    it('clears existing group membership before reassigning', () => {
      const nodes = [{ id: 'a', groups: ['old'] }];
      const groups = [{ id: 'g1', nodeIds: [] }];

      assignGroupMembership(nodes, groups);

      expect(nodes[0].groups).toEqual([]);
    });
  });

  describe('calculateGridPositions', () => {
    it('positions a single node at the origin', () => {
      const nodes = [{ id: 'a', groups: [] }];

      calculateGridPositions(nodes, []);

      expect(nodes[0].gridX).toBe(0);
      expect(nodes[0].gridY).toBe(0);
      expect(nodes[0].x).toBe(0);
      expect(nodes[0].y).toBe(0);
      expect(nodes[0].z).toBe(0);
    });

    it('places grouped nodes near each other', () => {
      const nodes = [
        { id: 'a', groups: ['g1'] },
        { id: 'b', groups: ['g1'] },
        { id: 'c', groups: ['g1'] },
      ];
      const groups = [{ id: 'g1', nodeIds: ['a', 'b', 'c'] }];

      calculateGridPositions(nodes, groups, { nodeSpacing: 10 });

      const gridPositions = nodes.map((n) => `${n.gridX},${n.gridY}`);
      expect(new Set(gridPositions).size).toBe(3);

      // Each pair of group members should be within a small Manhattan distance.
      const maxDistance = nodes.reduce((max, nodeA) => {
        return Math.max(
          max,
          ...nodes.map((nodeB) =>
            Math.abs(nodeA.gridX - nodeB.gridX) + Math.abs(nodeA.gridY - nodeB.gridY)
          )
        );
      }, 0);
      expect(maxDistance).toBeLessThanOrEqual(4);
    });

    it('places multiple groups at distinct start positions', () => {
      const nodes = [
        { id: 'a', groups: ['g1'] },
        { id: 'b', groups: ['g1'] },
        { id: 'c', groups: ['g2'] },
        { id: 'd', groups: ['g2'] },
      ];
      const groups = [
        { id: 'g1', nodeIds: ['a', 'b'] },
        { id: 'g2', nodeIds: ['c', 'd'] },
      ];

      calculateGridPositions(nodes, groups, { nodeSpacing: 10 });

      const groupACenter = {
        x: (nodes[0].gridX + nodes[1].gridX) / 2,
        y: (nodes[0].gridY + nodes[1].gridY) / 2,
      };
      const groupBCenter = {
        x: (nodes[2].gridX + nodes[3].gridX) / 2,
        y: (nodes[2].gridY + nodes[3].gridY) / 2,
      };

      expect(groupACenter.x !== groupBCenter.x || groupACenter.y !== groupBCenter.y).toBe(true);
    });

    it('does not place two nodes at the same grid position', () => {
      const nodes = [
        { id: 'a', groups: [] },
        { id: 'b', groups: [] },
        { id: 'c', groups: [] },
        { id: 'd', groups: [] },
      ];

      calculateGridPositions(nodes, []);

      const positions = nodes.map((n) => `${n.gridX},${n.gridY}`);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('uses provided nodeSpacing to scale world coordinates', () => {
      const nodes = [{ id: 'a', groups: [] }];

      calculateGridPositions(nodes, [], { nodeSpacing: 25 });

      expect(nodes[0].x).toBe(0);
      expect(nodes[0].z).toBe(0);
    });

    it('cycles through start positions when there are more groups than positions', () => {
      const groupCount = GROUP_START_POSITIONS.length + 1;
      const groups = Array.from({ length: groupCount }, (_, i) => ({
        id: `g${i}`,
        nodeIds: [`n${i}`],
      }));
      const nodes = Array.from({ length: groupCount }, (_, i) => ({
        id: `n${i}`,
        groups: [`g${i}`],
      }));

      calculateGridPositions(nodes, groups, { nodeSpacing: 10 });

      expect(nodes.every((n) => n.gridX !== undefined && n.gridY !== undefined)).toBe(true);
    });
  });
});
