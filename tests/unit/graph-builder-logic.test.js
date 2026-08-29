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
  parseScaleAttribute,
  effectiveNodeSpacing,
  relaxNodePositions,
  DEFAULT_RELAX_OPTIONS,
  GROUP_START_POSITIONS,
} from '../../src/graph-builder-logic.js';

 describe('effectiveNodeSpacing', () => {
  it('applies the breathing multiplier at scale 1', () => {
    expect(effectiveNodeSpacing(80, 1)).toBe(160);
  });

  it('grows with the square root of the scale', () => {
    expect(effectiveNodeSpacing(80, 4)).toBe(320);
    expect(effectiveNodeSpacing(80, 9)).toBe(480);
    expect(effectiveNodeSpacing(80, 5)).toBeCloseTo(80 * Math.sqrt(5) * 2);
  });

  it('falls back to scale 1 and default breathing for invalid values', () => {
    expect(effectiveNodeSpacing(80)).toBe(160);
    expect(effectiveNodeSpacing(80, 0)).toBe(160);
    expect(effectiveNodeSpacing(80, -2)).toBe(160);
    expect(effectiveNodeSpacing(80, NaN)).toBe(160);
    expect(effectiveNodeSpacing(80, 1, NaN)).toBe(160);
  });

  it('accepts a custom breathing multiplier', () => {
    expect(effectiveNodeSpacing(80, 1, 1)).toBe(80);
    expect(effectiveNodeSpacing(80, 1, 0)).toBe(160);
  });
});

 describe('parseScaleAttribute', () => {
  it('parses positive numeric values', () => {
    expect(parseScaleAttribute('2.5')).toBe(2.5);
    expect(parseScaleAttribute('1')).toBe(1);
    expect(parseScaleAttribute('0.5')).toBe(0.5);
  });

  it('falls back for missing, invalid, zero, and negative values', () => {
    const fallback = 3;
    expect(parseScaleAttribute(null, fallback)).toBe(fallback);
    expect(parseScaleAttribute(undefined, fallback)).toBe(fallback);
    expect(parseScaleAttribute('abc', fallback)).toBe(fallback);
    expect(parseScaleAttribute('0', fallback)).toBe(fallback);
    expect(parseScaleAttribute('-2', fallback)).toBe(fallback);
  });

  it('defaults the fallback to 1', () => {
    expect(parseScaleAttribute('bogus')).toBe(1);
    expect(parseScaleAttribute('2')).toBe(2);
  });
});

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
      expect(node.usesForegroundColor).toBe(false);
      expect(node.wireframe).toBe(true);
      expect(node.shape).toBe('cube');
      expect(node.content).toBe('<p>Hello</p>');
      expect(node.groups).toEqual([]);
    });

    it('fills in defaults when only an id is provided', () => {
      const node = parseNodeData({ id: 'n1' });

      expect(node.name).toBeNull();
      expect(node.color).toBe('#000000');
      expect(node.usesForegroundColor).toBe(true);
      expect(node.wireframe).toBe(false);
      expect(node.shape).toBe('pyramid');
      expect(node.content).toBe('');
    });

    it('uses the foreground color fallback', () => {
      const node = parseNodeData({ id: 'n1', foregroundColor: '#00ff00' });
      expect(node.color).toBe('#00ff00');
      expect(node.usesForegroundColor).toBe(true);
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
      expect(link.usesForegroundColor).toBe(false);
      expect(link.content).toBe('edge content');
    });

    it('fills in defaults', () => {
      const link = parseEdgeData({ source: 'a', target: 'b' });

      expect(link.name).toBeNull();
      expect(link.color).toBe('#000000');
      expect(link.usesForegroundColor).toBe(true);
      expect(link.content).toBe('');
    });

    it('uses the foreground color fallback', () => {
      const link = parseEdgeData({ source: 'a', target: 'b', foregroundColor: '#00ff00' });
      expect(link.color).toBe('#00ff00');
      expect(link.usesForegroundColor).toBe(true);
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

  describe('relaxNodePositions', () => {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

    /**
     * Build test nodes placed on a grid via the real layout function.
     *
     * @param {Array<string>} ids - Node IDs
     * @param {Array<Object>} groups - Group definitions
     * @param {number} spacing - Grid spacing
     * @returns {Array<Object>} Nodes with positions assigned
     */
    const buildNodes = (ids, groups = [], spacing = 80) => {
      const nodes = ids.map((id) => ({
        id,
        x: 0,
        y: 0,
        z: 0,
        groups: groups.filter((g) => g.nodeIds.includes(id)).map((g) => g.id),
      }));
      calculateGridPositions(nodes, groups, { nodeSpacing: spacing });
      return nodes;
    };

    it('pulls connected nodes closer to the rest length than their initial distance', () => {
      const nodes = [
        { id: 'a', x: 0, y: 0, z: 0, groups: [] },
        { id: 'b', x: 400, y: 0, z: 0, groups: [] },
        { id: 'c', x: -400, y: 0, z: 0, groups: [] },
      ];
      const links = [{ source: 'a', target: 'b' }];

      relaxNodePositions(nodes, links, [], { linkDistance: 80 });

      const final = dist(nodes[0], nodes[1]);
      expect(final).toBeLessThan(400);
      // Converges near the rest length, not just "a bit closer".
      expect(final).toBeLessThan(160);
    });

    it('keeps connected nodes near the link distance', () => {
      const nodes = buildNodes(['a', 'b', 'c']);
      const links = [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ];

      relaxNodePositions(nodes, links, [], { linkDistance: 80 });

      expect(dist(nodes[0], nodes[1])).toBeLessThan(160);
      expect(dist(nodes[1], nodes[2])).toBeLessThan(160);
      // Unconnected endpoints sit at two hops apart, not one.
      expect(dist(nodes[0], nodes[2])).toBeGreaterThan(dist(nodes[0], nodes[1]));
    });

    it('does not collapse the graph: nodes keep a minimum separation', () => {
      const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
      const nodes = buildNodes(ids);
      const links = ids.slice(1).map((id, i) => ({ source: `n${i}`, target: id }));

      relaxNodePositions(nodes, links, [], { linkDistance: 80 });

      let minDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          minDist = Math.min(minDist, dist(nodes[i], nodes[j]));
        }
      }
      expect(minDist).toBeGreaterThan(1);
    });

    it('keeps group members clustered together', () => {
      const groups = [{ id: 'g1', nodeIds: ['a', 'b', 'c'] }];
      const nodes = buildNodes(['a', 'b', 'c', 'd'], groups);
      const links = [{ source: 'a', target: 'd' }];
      const before = dist(nodes[0], nodes[1]);

      relaxNodePositions(nodes, links, groups, { linkDistance: 80 });

      // Group cohesion keeps members near their original cluster spacing.
      expect(dist(nodes[0], nodes[1])).toBeLessThan(before + 100);
      expect(dist(nodes[0], nodes[2])).toBeLessThan(before + 100);
    });

    it('leaves y coordinates untouched', () => {
      const nodes = buildNodes(['a', 'b']);
      const links = [{ source: 'a', target: 'b' }];

      relaxNodePositions(nodes, links, []);

      nodes.forEach((node) => {
        expect(node.y).toBe(0);
      });
    });

    it('is deterministic across runs', () => {
      const make = () => {
        const groups = [{ id: 'g1', nodeIds: ['a', 'b'] }];
        const nodes = buildNodes(['a', 'b', 'c', 'd', 'e'], groups);
        relaxNodePositions(nodes, [{ source: 'b', target: 'c' }], groups);
        return nodes.map((n) => `${n.x.toFixed(6)},${n.z.toFixed(6)}`);
      };

      expect(make()).toEqual(make());
    });

    it('produces finite positions for edge cases without NaN', () => {
      const cases = [
        { nodes: buildNodes(['a', 'b']), links: [{ source: 'a', target: 'b' }] },
        { nodes: buildNodes(['a', 'b']), links: [{ source: 'a', target: 'missing' }] },
        { nodes: buildNodes(['a', 'b']), links: [{ source: 'a', target: 'a' }] },
      ];

      cases.forEach(({ nodes, links }) => {
        relaxNodePositions(nodes, links, []);
        nodes.forEach((node) => {
          expect(Number.isFinite(node.x)).toBe(true);
          expect(Number.isFinite(node.z)).toBe(true);
        });
      });
    });

    it('returns the input array unchanged for fewer than two nodes', () => {
      const nodes = [{ id: 'a', x: 10, y: 0, z: 20 }];

      expect(relaxNodePositions(nodes, [])).toBe(nodes);
      expect(nodes[0].x).toBe(10);
    });

    it('exposes sensible defaults', () => {
      expect(DEFAULT_RELAX_OPTIONS.linkDistance).toBe(80);
      expect(DEFAULT_RELAX_OPTIONS.iterations).toBeGreaterThan(0);
      expect(DEFAULT_RELAX_OPTIONS.repulsion).toBe(6000);
      expect(DEFAULT_RELAX_OPTIONS.springStrength).toBeGreaterThan(0);
      expect(DEFAULT_RELAX_OPTIONS.anchorStrength).toBeGreaterThan(0);
      expect(DEFAULT_RELAX_OPTIONS.maxDisplacement).toBeGreaterThan(0);
      expect(DEFAULT_RELAX_OPTIONS.groupStrength).toBeGreaterThan(0);
    });
  });
});
