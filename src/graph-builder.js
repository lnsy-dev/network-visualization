import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * GraphBuilder
 * 
 * Builds the graph from network-node and network-edge elements
 * Creates 3D objects and positions them on a grid
 * 
 * @class GraphBuilder
 */
export default class GraphBuilder {
  /**
   * Creates a new GraphBuilder instance
   * 
   * @param {THREE.Group} graphGroup - The Three.js group to add objects to
   * @param {string} foregroundColor - Default color for nodes and edges
   * @param {THREE.Color} backgroundColor - Background color for labels
   * @param {number} minimumNodeSize - Minimum size for node geometries
   */
  constructor(graphGroup, foregroundColor, backgroundColor, minimumNodeSize = 1.0) {
    this.graphGroup = graphGroup;
    this.foregroundColor = foregroundColor;
    this.backgroundColor = backgroundColor;
    this.minimumNodeSize = minimumNodeSize;
    this.nodes = [];
    this.links = [];
    this.groups = [];
    this.nodeSpacing = 80;
  }

  /**
   * Builds the graph from HTML elements
   * 
   * @param {HTMLElement} container - Container element with network-node and network-edge children
   * @returns {Object} Object containing nodes, links, and groups arrays
   */
  buildFromElements(container) {
    const nodeElements = Array.from(container.querySelectorAll('network-node'));
    const edgeElements = Array.from(container.querySelectorAll('network-edge'));
    const groupElements = Array.from(container.querySelectorAll('network-group'));

    this.nodes = nodeElements.map(el => {
      return {
        id: el.getAttribute('id'),
        name: el.getAttribute('name'),
        color: el.getAttribute('color') || this.foregroundColor,
        wireframe: el.hasAttribute('wireframe'),
        shape: el.getAttribute('shape') || 'pyramid',
        content: el.innerHTML,
        el: el,
        groups: [],
      };
    });

    const nodeIds = new Set(this.nodes.map(n => n.id));
    
    this.links = edgeElements
      .map(el => {
        return {
          source: el.getAttribute('source'),
          target: el.getAttribute('target'),
          name: el.getAttribute('name'),
          color: el.getAttribute('color') || this.foregroundColor,
          content: el.innerHTML,
          el: el,
        };
      })
      .filter(link => {
        const hasValidSource = nodeIds.has(link.source);
        const hasValidTarget = nodeIds.has(link.target);
        
        if (!hasValidSource || !hasValidTarget) {
          console.warn(`Skipping invalid link: source="${link.source}" target="${link.target}" - missing node(s)`);
          return false;
        }
        
        return true;
      });

    this.groups = groupElements.map(el => {
      const nodesAttr = el.getAttribute('node-ids') || '';
      const nodeIds = nodesAttr.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      return {
        id: el.getAttribute('id'),
        name: el.getAttribute('name'),
        nodeIds: nodeIds,
        content: el.innerHTML,
        el: el,
      };
    });

    // Assign group membership to nodes
    this.nodes.forEach(node => {
      this.groups.forEach(group => {
        if (group.nodeIds.includes(node.id)) {
          node.groups.push(group.id);
        }
      });
    });

    this.calculateGridPositions();
    this.createNodeMeshes();
    this.createLinks();

    return {
      nodes: this.nodes,
      links: this.links,
      groups: this.groups
    };
  }

  /**
   * Calculates grid positions for nodes on a 2D x-z plane
   * Nodes are grouped together first, then sorted by connection count
   * Groups with most connections are placed closest to center
   * 
   * @returns {void}
   */
  calculateGridPositions() {
    if (this.nodes.length === 0) return;

    const gridSpacing = this.nodeSpacing;
    const hitboxPercentage = 1.0; // Each grid cell is nodeSpacing * hitboxPercentage
    
    // Calculate connection count for each node
    const connectionMap = new Map();
    this.nodes.forEach(node => {
      connectionMap.set(node.id, 0);
    });
    
    this.links.forEach(link => {
      connectionMap.set(link.source, (connectionMap.get(link.source) || 0) + 1);
      connectionMap.set(link.target, (connectionMap.get(link.target) || 0) + 1);
    });
    
    // Group nodes by their group membership
    const groupedNodes = new Map(); // groupId -> array of nodes
    const ungroupedNodes = [];
    
    this.nodes.forEach(node => {
      if (node.groups.length > 0) {
        // Use first group for primary grouping
        const primaryGroup = node.groups[0];
        if (!groupedNodes.has(primaryGroup)) {
          groupedNodes.set(primaryGroup, []);
        }
        groupedNodes.get(primaryGroup).push(node);
      } else {
        ungroupedNodes.push(node);
      }
    });
    
    // Calculate total connections for each group
    const groupConnectionCount = new Map();
    groupedNodes.forEach((nodes, groupId) => {
      const totalConnections = nodes.reduce((sum, node) => {
        return sum + (connectionMap.get(node.id) || 0);
      }, 0);
      groupConnectionCount.set(groupId, totalConnections);
    });
    
    // Sort groups by total connection count (most to least)
    const sortedGroups = Array.from(groupedNodes.entries()).sort((a, b) => {
      return groupConnectionCount.get(b[0]) - groupConnectionCount.get(a[0]);
    });
    
    // Sort nodes within each group by connection count
    sortedGroups.forEach(([groupId, nodes]) => {
      nodes.sort((a, b) => {
        return (connectionMap.get(b.id) || 0) - (connectionMap.get(a.id) || 0);
      });
    });
    
    // Sort ungrouped nodes by connection count
    ungroupedNodes.sort((a, b) => {
      return (connectionMap.get(b.id) || 0) - (connectionMap.get(a.id) || 0);
    });
    
    // Build final sorted node list: groups first (by connection count), then ungrouped nodes
    const sortedNodes = [];
    sortedGroups.forEach(([groupId, nodes]) => {
      sortedNodes.push(...nodes);
    });
    sortedNodes.push(...ungroupedNodes);
    
    // Track occupied grid positions
    const occupiedPositions = new Set();
    
    /**
     * Converts grid coordinates to position key
     * 
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @returns {string} Position key
     */
    const getPositionKey = (gridX, gridY) => `${gridX},${gridY}`;
    
    /**
     * Checks if a grid position is available
     * 
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @returns {boolean} True if position is available
     */
    const isPositionAvailable = (gridX, gridY) => {
      return !occupiedPositions.has(getPositionKey(gridX, gridY));
    };
    
    /**
     * Marks a grid position as occupied and assigns coordinates to node
     * 
     * @param {Object} node - Node object
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate (mapped to Z axis)
     * @returns {void}
     */
    const placeNode = (node, gridX, gridY) => {
      occupiedPositions.add(getPositionKey(gridX, gridY));
      node.x = gridX * gridSpacing;
      node.y = 0; // Nodes on x-z plane
      node.z = gridY * gridSpacing;
      node.gridX = gridX;
      node.gridY = gridY;
    };
    
    /**
     * Finds the nearest available position starting from a given location
     * 
     * @param {number} startX - Starting grid X coordinate
     * @param {number} startY - Starting grid Y coordinate
     * @returns {Object} Object with x and y grid coordinates
     */
    const findNearestAvailablePosition = (startX, startY) => {
      // Check the starting position first
      if (isPositionAvailable(startX, startY)) {
        return { x: startX, y: startY };
      }
      
      // Spiral outward to find nearest available position
      for (let radius = 1; radius < 100; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            // Only check positions on the current radius ring
            if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
              const checkX = startX + dx;
              const checkY = startY + dy;
              if (isPositionAvailable(checkX, checkY)) {
                return { x: checkX, y: checkY };
              }
            }
          }
        }
      }
      
      // Fallback (should never reach here)
      return { x: startX, y: startY };
    };
    
    // Build adjacency list for quick neighbor lookup
    const adjacencyList = new Map();
    this.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });
    this.links.forEach(link => {
      adjacencyList.get(link.source).push(link.target);
      adjacencyList.get(link.target).push(link.source);
    });
    
    // Track which nodes have been placed and their group membership
    const placedNodes = new Set();
    const groupBounds = new Map(); // Track bounds for each group
    const groupSpacing = 3; // Minimum spacing between groups in grid units
    
    /**
     * Checks if a position is far enough from other groups' boundaries
     * 
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @param {string} currentGroupId - The group ID being placed
     * @returns {boolean} True if position respects group spacing
     */
    const respectsGroupSpacing = (gridX, gridY, currentGroupId) => {
      for (const [groupId, bounds] of groupBounds.entries()) {
        if (groupId === currentGroupId) continue;
        
        // Check if position is within spacing distance of this group's bounds
        if (gridX >= bounds.minX - groupSpacing && gridX <= bounds.maxX + groupSpacing &&
            gridY >= bounds.minY - groupSpacing && gridY <= bounds.maxY + groupSpacing) {
          return false;
        }
      }
      return true;
    };
    
    /**
     * Updates the bounds for a group
     * 
     * @param {string} groupId - The group ID
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @returns {void}
     */
    const updateGroupBounds = (groupId, gridX, gridY) => {
      if (!groupBounds.has(groupId)) {
        groupBounds.set(groupId, {
          minX: gridX,
          maxX: gridX,
          minY: gridY,
          maxY: gridY
        });
      } else {
        const bounds = groupBounds.get(groupId);
        bounds.minX = Math.min(bounds.minX, gridX);
        bounds.maxX = Math.max(bounds.maxX, gridX);
        bounds.minY = Math.min(bounds.minY, gridY);
        bounds.maxY = Math.max(bounds.maxY, gridY);
      }
    };
    
    // Place groups one at a time, keeping members clustered
    let isFirstGroup = true;
    
    sortedGroups.forEach(([groupId, nodes]) => {
      if (nodes.length === 0) return;
      
      // Place first node of the group
      const firstNode = nodes[0];
      
      if (isFirstGroup) {
        // First group starts at center
        placeNode(firstNode, 0, 0);
        updateGroupBounds(groupId, 0, 0);
        isFirstGroup = false;
      } else {
        // Subsequent groups: find position near center but respecting group spacing
        let foundPosition = false;
        for (let radius = groupSpacing + 1; radius < 100 && !foundPosition; radius++) {
          for (let dx = -radius; dx <= radius && !foundPosition; dx++) {
            for (let dy = -radius; dy <= radius && !foundPosition; dy++) {
              if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                const checkX = dx;
                const checkY = dy;
                if (isPositionAvailable(checkX, checkY) && respectsGroupSpacing(checkX, checkY, groupId)) {
                  placeNode(firstNode, checkX, checkY);
                  updateGroupBounds(groupId, checkX, checkY);
                  foundPosition = true;
                }
              }
            }
          }
        }
        
        if (!foundPosition) {
          // Fallback: just find any available position far from center
          const nearestPos = findNearestAvailablePosition(0, 0);
          placeNode(firstNode, nearestPos.x, nearestPos.y);
          updateGroupBounds(groupId, nearestPos.x, nearestPos.y);
        }
      }
      
      placedNodes.add(firstNode.id);
      
      // Place remaining nodes in the group close to group members
      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        let positioned = false;
        
        // Try to place near other group members first
        for (let j = 0; j < i; j++) {
          const groupMember = nodes[j];
          
          // Try positions around the group member
          const offsets = [
            { dx: 1, dy: 0 },   // right
            { dx: -1, dy: 0 },  // left
            { dx: 0, dy: 1 },   // up
            { dx: 0, dy: -1 },  // down
            { dx: 1, dy: 1 },   // diagonal
            { dx: -1, dy: 1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: -1 },
          ];
          
          for (const offset of offsets) {
            const gridX = groupMember.gridX + offset.dx;
            const gridY = groupMember.gridY + offset.dy;
            
            if (isPositionAvailable(gridX, gridY) && respectsGroupSpacing(gridX, gridY, groupId)) {
              placeNode(node, gridX, gridY);
              updateGroupBounds(groupId, gridX, gridY);
              placedNodes.add(node.id);
              positioned = true;
              break;
            }
          }
          
          if (positioned) break;
        }
        
        // If no adjacent position found, place near first group member
        if (!positioned) {
          // Search for nearest position that respects group spacing
          let foundPos = false;
          for (let radius = 1; radius < 50 && !foundPos; radius++) {
            for (let dx = -radius; dx <= radius && !foundPos; dx++) {
              for (let dy = -radius; dy <= radius && !foundPos; dy++) {
                if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                  const checkX = firstNode.gridX + dx;
                  const checkY = firstNode.gridY + dy;
                  if (isPositionAvailable(checkX, checkY) && respectsGroupSpacing(checkX, checkY, groupId)) {
                    placeNode(node, checkX, checkY);
                    updateGroupBounds(groupId, checkX, checkY);
                    foundPos = true;
                  }
                }
              }
            }
          }
          
          if (!foundPos) {
            // Absolute fallback
            const nearestPos = findNearestAvailablePosition(firstNode.gridX, firstNode.gridY);
            placeNode(node, nearestPos.x, nearestPos.y);
            updateGroupBounds(groupId, nearestPos.x, nearestPos.y);
          }
          
          placedNodes.add(node.id);
        }
      }
    });
    
    // Place ungrouped nodes (avoiding group bounds)
    ungroupedNodes.forEach(node => {
      if (placedNodes.size === 0) {
        // First node goes to center
        placeNode(node, 0, 0);
      } else {
        // Try to place near connected nodes first
        const neighbors = adjacencyList.get(node.id) || [];
        let positioned = false;
        
        for (const neighborId of neighbors) {
          if (placedNodes.has(neighborId)) {
            const neighbor = this.nodes.find(n => n.id === neighborId);
            
            // Try positions around the neighbor
            const offsets = [
              { dx: 1, dy: 0 },   // right
              { dx: -1, dy: 0 },  // left
              { dx: 0, dy: 1 },   // up
              { dx: 0, dy: -1 },  // down
              { dx: 1, dy: 1 },   // diagonal
              { dx: -1, dy: 1 },
              { dx: 1, dy: -1 },
              { dx: -1, dy: -1 },
            ];
            
            for (const offset of offsets) {
              const gridX = neighbor.gridX + offset.dx;
              const gridY = neighbor.gridY + offset.dy;
              
              // Ungrouped nodes use null as groupId to respect all group bounds
              if (isPositionAvailable(gridX, gridY) && respectsGroupSpacing(gridX, gridY, null)) {
                placeNode(node, gridX, gridY);
                positioned = true;
                break;
              }
            }
            
            if (positioned) break;
            
            // If no adjacent position available, find nearest that respects group spacing
            let foundPos = false;
            for (let radius = 1; radius < 100 && !foundPos; radius++) {
              for (let dx = -radius; dx <= radius && !foundPos; dx++) {
                for (let dy = -radius; dy <= radius && !foundPos; dy++) {
                  if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                    const checkX = neighbor.gridX + dx;
                    const checkY = neighbor.gridY + dy;
                    if (isPositionAvailable(checkX, checkY) && respectsGroupSpacing(checkX, checkY, null)) {
                      placeNode(node, checkX, checkY);
                      foundPos = true;
                    }
                  }
                }
              }
            }
            
            if (foundPos) {
              positioned = true;
            }
            break;
          }
        }
        
        // If no connections to placed nodes, place near center but respect group spacing
        if (!positioned) {
          let foundPos = false;
          for (let radius = 0; radius < 100 && !foundPos; radius++) {
            for (let dx = -radius; dx <= radius && !foundPos; dx++) {
              for (let dy = -radius; dy <= radius && !foundPos; dy++) {
                if (Math.abs(dx) === radius || Math.abs(dy) === radius || radius === 0) {
                  const checkX = dx;
                  const checkY = dy;
                  if (isPositionAvailable(checkX, checkY) && respectsGroupSpacing(checkX, checkY, null)) {
                    placeNode(node, checkX, checkY);
                    foundPos = true;
                  }
                }
              }
            }
          }
        }
      }
      
      placedNodes.add(node.id);
    });
  }

  /**
   * Creates Three.js meshes for all nodes
   * 
   * @returns {void}
   */
  createNodeMeshes() {
    this.nodes.forEach(node => {
      const group = new THREE.Group();
      
      // Apply minimum size constraint to base geometry dimensions
      const baseSize = Math.max(5, this.minimumNodeSize * 5);
      const baseHeight = Math.max(10, this.minimumNodeSize * 10);
      const baseRadius = Math.max(2, this.minimumNodeSize * 2);
      
      let geometry;
      switch(node.shape) {
        case 'cube':
        case 'box':
        case 'square':
          geometry = new THREE.BoxGeometry(baseHeight, baseHeight, baseHeight);
          break;
        case 'sphere':
          geometry = new THREE.SphereGeometry(baseSize, 4, 4);
          break;
        case 'pyramid':
          geometry = new THREE.ConeGeometry(baseSize, baseHeight, 3);
          break;
        case 'torus':
          geometry = new THREE.TorusGeometry(baseSize, baseRadius, 4, 4);
          break;
        default:
          geometry = new THREE.ConeGeometry(baseSize, baseHeight, 3);
      }
      
      const material = new THREE.MeshBasicMaterial({ 
        color: node.color, 
        wireframe: node.wireframe 
      });
      const mesh = new THREE.Mesh(geometry, material);
      node.mesh = mesh;
      node.originalColor = node.color;
      group.add(mesh);
      
      if (node.name) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'node-label';
        labelDiv.textContent = node.name;
        labelDiv.style.pointerEvents = 'auto'; // Make label clickable
        labelDiv.style.cursor = 'pointer';
        
        const label = new CSS2DObject(labelDiv);
        // Position label above the node based on geometry height
        label.position.set(0, -5, 0);
        label.element.dataset.nodeId = node.id; // Store node ID for lookup
        group.add(label);
      }
      
      group.position.set(node.x, node.y, node.z);
      node.group = group;
      this.graphGroup.add(group);
    });
  }

  /**
   * Creates arc line objects for edges between nodes that extend to the Y axis
   * 
   * @returns {void}
   */
  createLinks() {
    this.links.forEach(link => {
      const sourceNode = this.nodes.find(n => n.id === link.source);
      const targetNode = this.nodes.find(n => n.id === link.target);
      
      if (!sourceNode || !targetNode) return;
      
      const start = new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z);
      const end = new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z);
      
      // Calculate midpoint
      const midpoint = new THREE.Vector3(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        (start.z + end.z) / 2
      );
      
      // Calculate distance between nodes to determine arc height
      const distance = start.distanceTo(end);
      const arcHeight = distance * 0.3; // Arc height is 30% of distance
      
      // Create control point extending along Y axis
      const controlPoint = new THREE.Vector3(
        midpoint.x,
        midpoint.y + arcHeight,
        midpoint.z
      );
      
      // Create quadratic bezier curve
      const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
      const points = curve.getPoints(50); // 50 segments for smooth curve
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: link.color || this.foregroundColor,
        opacity: 0.6,
        transparent: true
      });
      
      const line = new THREE.Line(geometry, material);
      link.line = line;
      this.graphGroup.add(line);
    });
  }
}
