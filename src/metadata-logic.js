/**
 * Metadata Logic
 *
 * Pure functions for computing connected nodes and group members from graph
 * data. These helpers support the MetadataDisplay component and are easy to
 * unit test without a browser or Three.js.
 *
 * @module metadata-logic
 */

/**
 * Find the IDs of all nodes connected to the given node by an edge.
 *
 * @param {string} nodeId - ID of the node to inspect
 * @param {Array<Object>} links - Normalized link objects with source and target
 * @returns {Array<string>} IDs of connected nodes
 */
export function getConnectedNodeIds(nodeId, links) {
  const connectedNodeIds = new Set();

  links.forEach((link) => {
    if (link.source === nodeId) {
      connectedNodeIds.add(link.target);
    } else if (link.target === nodeId) {
      connectedNodeIds.add(link.source);
    }
  });

  return Array.from(connectedNodeIds);
}

/**
 * Find the display names of all nodes connected to the given node.
 *
 * @param {string} nodeId - ID of the node to inspect
 * @param {Array<Object>} links - Normalized link objects
 * @param {Array<Object>} nodes - Normalized node objects
 * @returns {Array<string>} Display names, falling back to IDs
 */
export function getConnectedNodeNames(nodeId, links, nodes) {
  const connectedIds = getConnectedNodeIds(nodeId, links);

  return connectedIds.map((id) => {
    const connectedNode = nodes.find((n) => n.id === id);
    return connectedNode ? connectedNode.name || connectedNode.id : id;
  });
}

/**
 * Find the display names of all members of a group.
 *
 * @param {Object} group - Normalized group object with nodeIds array
 * @param {Array<Object>} nodes - Normalized node objects
 * @returns {Array<string>} Member display names, falling back to IDs
 */
export function getGroupMemberNames(group, nodes) {
  if (!group.nodeIds || group.nodeIds.length === 0) return [];

  return group.nodeIds.map((nodeId) => {
    const memberNode = nodes.find((n) => n.id === nodeId);
    return memberNode ? memberNode.name || memberNode.id : nodeId;
  });
}
