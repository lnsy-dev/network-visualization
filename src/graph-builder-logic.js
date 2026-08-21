/**
 * Graph Builder Logic
 *
 * Pure functions for building and laying out graph data.
 * These functions have no DOM or Three.js dependencies so they can be
 * unit tested in isolation.
 *
 * @module graph-builder-logic
 */

/**
 * Default options for grid layout.
 *
 * @constant {Object}
 */
export const DEFAULT_GRID_OPTIONS = {
  nodeSpacing: 80,
  groupSpacing: 3,
  maxSearchRadius: 50,
};

/**
 * Starting positions for placing groups on the grid.
 *
 * @constant {Array<[number, number]>}
 */
export const GROUP_START_POSITIONS = [
  [0, 0],
  [5, 0],
  [-5, 0],
  [0, 5],
  [0, -5],
  [5, 5],
  [-5, 5],
  [5, -5],
  [-5, -5],
];

/**
 * Adjacent offsets used when packing group members together.
 *
 * @constant {Array<[number, number]>}
 */
export const ADJACENT_OFFSETS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

/**
 * Normalize raw node data into a graph node object.
 *
 * @param {Object} data - Raw node data
 * @param {string} data.id - Unique node identifier
 * @param {string} [data.name] - Display name
 * @param {string} [data.color] - Node color
 * @param {boolean} [data.wireframe] - Whether to render as wireframe
 * @param {string} [data.shape] - Geometry shape
 * @param {string} [data.content] - Inner HTML content
 * @param {string} [data.foregroundColor] - Fallback color when none is provided
 * @returns {Object} Normalized node object
 */
export function parseNodeData(data) {
  return {
    id: data.id,
    name: data.name || null,
    color: data.color || data.foregroundColor || '#000000',
    wireframe: Boolean(data.wireframe),
    shape: data.shape || 'pyramid',
    content: data.content || '',
    groups: [],
    el: data.el || null,
  };
}

/**
 * Normalize raw edge data into a graph link object.
 *
 * @param {Object} data - Raw edge data
 * @param {string} data.source - Source node ID
 * @param {string} data.target - Target node ID
 * @param {string} [data.name] - Edge label
 * @param {string} [data.color] - Edge color
 * @param {string} [data.content] - Inner HTML content
 * @param {string} [data.foregroundColor] - Fallback color when none is provided
 * @returns {Object} Normalized link object
 */
export function parseEdgeData(data) {
  return {
    source: data.source,
    target: data.target,
    name: data.name || null,
    color: data.color || data.foregroundColor || '#000000',
    content: data.content || '',
    el: data.el || null,
  };
}

/**
 * Normalize raw group data into a graph group object.
 *
 * @param {Object} data - Raw group data
 * @param {string} data.id - Unique group identifier
 * @param {string} [data.name] - Display name
 * @param {string} [data.color] - Wireframe color
 * @param {string} [data.nodeIds] - Comma-separated list of member node IDs
 * @param {string} [data.content] - Inner HTML content
 * @returns {Object} Normalized group object
 */
export function parseGroupData(data) {
  const rawNodeIds = data.nodeIds || '';
  const nodeIds = rawNodeIds
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return {
    id: data.id,
    name: data.name || null,
    color: data.color || '#888888',
    nodeIds,
    content: data.content || '',
    el: data.el || null,
  };
}

/**
 * Drop links that reference missing source or target nodes.
 *
 * @param {Array<Object>} links - Normalized link objects
 * @param {Set<string>|Array<string>} nodeIds - Known node IDs
 * @returns {Array<Object>} Links with valid source and target
 */
export function filterValidLinks(links, nodeIds) {
  const ids = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);

  return links.filter((link) => {
    const hasValidSource = ids.has(link.source);
    const hasValidTarget = ids.has(link.target);

    if (!hasValidSource || !hasValidTarget) {
      console.warn(
        `Skipping invalid link: source="${link.source}" target="${link.target}" - missing node(s)`
      );
      return false;
    }

    return true;
  });
}

/**
 * Assign group membership arrays to each node based on group definitions.
 *
 * @param {Array<Object>} nodes - Normalized node objects
 * @param {Array<Object>} groups - Normalized group objects
 * @returns {Array<Object>} The same nodes array, mutated with groups populated
 */
export function assignGroupMembership(nodes, groups) {
  nodes.forEach((node) => {
    node.groups = [];
    groups.forEach((group) => {
      if (group.nodeIds.includes(node.id)) {
        node.groups.push(group.id);
      }
    });
  });

  return nodes;
}

/**
 * Calculate grid positions for nodes, keeping grouped nodes clustered.
 *
 * This is the pure-layout portion of GraphBuilder. It mutates the node
 * objects to add `x`, `y`, `z`, `gridX`, and `gridY` properties.
 *
 * @param {Array<Object>} nodes - Nodes with groups already assigned
 * @param {Array<Object>} groups - Normalized group objects
 * @param {Object} [options] - Layout options
 * @param {number} [options.nodeSpacing] - World-unit distance between grid cells
 * @param {number} [options.groupSpacing] - Extra grid cells kept clear between groups
 * @param {number} [options.maxSearchRadius] - Maximum spiral search radius
 * @returns {Array<Object>} The mutated nodes array
 */
export function calculateGridPositions(
  nodes,
  groups,
  options = {}
) {
  if (nodes.length === 0) return nodes;

  const { nodeSpacing, groupSpacing, maxSearchRadius } = {
    ...DEFAULT_GRID_OPTIONS,
    ...options,
  };

  const occupiedPositions = new Set();
  const groupBounds = new Map();

  /**
   * Place a node at grid coordinates.
   *
   * @param {Object} node - Node to place
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   */
  const placeNode = (node, gridX, gridY) => {
    occupiedPositions.add(`${gridX},${gridY}`);
    node.x = gridX * nodeSpacing;
    node.y = 0;
    node.z = gridY * nodeSpacing;
    node.gridX = gridX;
    node.gridY = gridY;
  };

  /**
   * Check whether a grid cell is available and outside other groups' territory.
   *
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   * @param {string|null} groupId - Group ID being placed, or null for ungrouped
   * @returns {boolean} True if the cell can be used
   */
  const canPlaceAt = (gridX, gridY, groupId) => {
    const key = `${gridX},${gridY}`;
    if (occupiedPositions.has(key)) return false;

    for (const [otherGroupId, bounds] of groupBounds.entries()) {
      if (otherGroupId === groupId) continue;

      if (
        gridX >= bounds.minX - groupSpacing &&
        gridX <= bounds.maxX + groupSpacing &&
        gridY >= bounds.minY - groupSpacing &&
        gridY <= bounds.maxY + groupSpacing
      ) {
        return false;
      }
    }

    return true;
  };

  /**
   * Update cached bounds for a group.
   *
   * @param {string} groupId - Group ID
   * @param {number} gridX - Newly occupied grid X
   * @param {number} gridY - Newly occupied grid Y
   */
  const updateBounds = (groupId, gridX, gridY) => {
    if (!groupBounds.has(groupId)) {
      groupBounds.set(groupId, {
        minX: gridX,
        maxX: gridX,
        minY: gridY,
        maxY: gridY,
      });
    } else {
      const bounds = groupBounds.get(groupId);
      bounds.minX = Math.min(bounds.minX, gridX);
      bounds.maxX = Math.max(bounds.maxX, gridX);
      bounds.minY = Math.min(bounds.minY, gridY);
      bounds.maxY = Math.max(bounds.maxY, gridY);
    }
  };

  /**
   * Find the nearest available grid cell using a square spiral search.
   *
   * @param {number} startX - Preferred grid X
   * @param {number} startY - Preferred grid Y
   * @param {string|null} groupId - Group ID being placed
   * @returns {{x: number, y: number}} Available grid coordinates
   */
  const findPosition = (startX, startY, groupId) => {
    if (canPlaceAt(startX, startY, groupId)) {
      return { x: startX, y: startY };
    }

    for (let radius = 1; radius < maxSearchRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const x = startX + dx;
            const y = startY + dy;
            if (canPlaceAt(x, y, groupId)) {
              return { x, y };
            }
          }
        }
      }
    }

    return { x: startX, y: startY };
  };

  // Organize nodes by primary group membership.
  const groupedNodes = new Map();
  const ungroupedNodes = [];

  nodes.forEach((node) => {
    if (node.groups.length > 0) {
      const groupId = node.groups[0];
      if (!groupedNodes.has(groupId)) {
        groupedNodes.set(groupId, []);
      }
      groupedNodes.get(groupId).push(node);
    } else {
      ungroupedNodes.push(node);
    }
  });

  // Place grouped nodes.
  let groupIndex = 0;
  for (const [groupId, groupNodes] of groupedNodes.entries()) {
    if (groupNodes.length === 0) continue;

    const [startX, startY] =
      GROUP_START_POSITIONS[groupIndex % GROUP_START_POSITIONS.length];
    groupIndex++;

    const pos = findPosition(startX, startY, groupId);
    placeNode(groupNodes[0], pos.x, pos.y);
    updateBounds(groupId, pos.x, pos.y);

    for (let i = 1; i < groupNodes.length; i++) {
      const node = groupNodes[i];
      let placed = false;

      for (let j = 0; j < i && !placed; j++) {
        const existingNode = groupNodes[j];

        for (const [dx, dy] of ADJACENT_OFFSETS) {
          const x = existingNode.gridX + dx;
          const y = existingNode.gridY + dy;

          if (canPlaceAt(x, y, groupId)) {
            placeNode(node, x, y);
            updateBounds(groupId, x, y);
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        const fallbackPos = findPosition(groupNodes[0].gridX, groupNodes[0].gridY, groupId);
        placeNode(node, fallbackPos.x, fallbackPos.y);
        updateBounds(groupId, fallbackPos.x, fallbackPos.y);
      }
    }
  }

  // Place ungrouped nodes.
  ungroupedNodes.forEach((node) => {
    const pos = findPosition(0, 0, null);
    placeNode(node, pos.x, pos.y);
  });

  return nodes;
}
