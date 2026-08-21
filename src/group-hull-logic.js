/**
 * Group Hull Logic
 *
 * Pure helpers for computing convex hull geometry for node groups.
 *
 * @module group-hull-logic
 */

/**
 * Computes the average center of a set of positioned nodes.
 *
 * @param {Array<{x: number, y: number, z: number}>} nodes - Nodes with positions
 * @returns {{x: number, y: number, z: number}} Center point
 */
export function computeGroupCenter(nodes) {
  let centerX = 0;
  let centerY = 0;
  let centerZ = 0;

  nodes.forEach((node) => {
    centerX += node.x;
    centerY += node.y;
    centerZ += node.z;
  });

  return {
    x: centerX / nodes.length,
    y: centerY / nodes.length,
    z: centerZ / nodes.length,
  };
}

/**
 * Expands each node into the eight corners of a padded cube.
 *
 * The resulting points can be fed to a convex hull generator so the hull
 * encloses every node with the given padding on all sides.
 *
 * @param {Array<{x: number, y: number, z: number}>} nodes - Nodes with positions
 * @param {number} padding - Distance from each node to the cube corners
 * @returns {Array<{x: number, y: number, z: number}>} Expanded corner points
 */
export function expandNodesToHullPoints(nodes, padding) {
  const points = [];
  const offsets = [-padding, padding];

  nodes.forEach((node) => {
    for (const dx of offsets) {
      for (const dy of offsets) {
        for (const dz of offsets) {
          points.push({
            x: node.x + dx,
            y: node.y + dy,
            z: node.z + dz,
          });
        }
      }
    }
  });

  return points;
}
