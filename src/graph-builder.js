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
   */
  constructor(graphGroup, foregroundColor, backgroundColor) {
    this.graphGroup = graphGroup;
    this.foregroundColor = foregroundColor;
    this.backgroundColor = backgroundColor;
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
      const nodesAttr = el.getAttribute('nodes') || '';
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
   * Nodes are sorted by connection count and placed radially from center
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
    
    // Sort nodes by connection count (most to least)
    const sortedNodes = [...this.nodes].sort((a, b) => {
      return (connectionMap.get(b.id) || 0) - (connectionMap.get(a.id) || 0);
    });
    
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
    
    // Place the center node (most connected)
    const centerNode = sortedNodes[0];
    placeNode(centerNode, 0, 0);
    
    // Track which nodes have been placed
    const placedNodes = new Set([centerNode.id]);
    const nodesToPlace = sortedNodes.slice(1);
    
    // Build adjacency list for quick neighbor lookup
    const adjacencyList = new Map();
    this.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });
    this.links.forEach(link => {
      adjacencyList.get(link.source).push(link.target);
      adjacencyList.get(link.target).push(link.source);
    });
    
    // Place remaining nodes
    while (nodesToPlace.length > 0) {
      let placed = false;
      
      // Try to place nodes connected to already-placed nodes
      for (let i = 0; i < nodesToPlace.length; i++) {
        const node = nodesToPlace[i];
        const neighbors = adjacencyList.get(node.id) || [];
        
        // Find a placed neighbor to position near
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
            
            let positioned = false;
            for (const offset of offsets) {
              const gridX = neighbor.gridX + offset.dx;
              const gridY = neighbor.gridY + offset.dy;
              
              if (isPositionAvailable(gridX, gridY)) {
                placeNode(node, gridX, gridY);
                placedNodes.add(node.id);
                nodesToPlace.splice(i, 1);
                positioned = true;
                placed = true;
                break;
              }
            }
            
            if (positioned) break;
            
            // If no adjacent position available, find nearest
            const nearestPos = findNearestAvailablePosition(neighbor.gridX, neighbor.gridY);
            placeNode(node, nearestPos.x, nearestPos.y);
            placedNodes.add(node.id);
            nodesToPlace.splice(i, 1);
            placed = true;
            break;
          }
        }
        
        if (placed) break;
      }
      
      // If no connections to placed nodes, place in nearest available position from center
      if (!placed && nodesToPlace.length > 0) {
        const node = nodesToPlace[0];
        const nearestPos = findNearestAvailablePosition(0, 0);
        placeNode(node, nearestPos.x, nearestPos.y);
        placedNodes.add(node.id);
        nodesToPlace.shift();
      }
    }
  }

  /**
   * Creates Three.js meshes for all nodes
   * 
   * @returns {void}
   */
  createNodeMeshes() {
    this.nodes.forEach(node => {
      const group = new THREE.Group();
      
      let geometry;
      switch(node.shape) {
        case 'cube':
        case 'box':
        case 'square':
          geometry = new THREE.BoxGeometry(10, 10, 10);
          break;
        case 'sphere':
          geometry = new THREE.SphereGeometry(5, 4, 4);
          break;
        case 'pyramid':
          geometry = new THREE.ConeGeometry(5, 10, 3);
          break;
        case 'torus':
          geometry = new THREE.TorusGeometry(5, 2, 4, 4);
          break;
        default:
          geometry = new THREE.ConeGeometry(5, 10, 3);
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
        labelDiv.style.color = this.foregroundColor;
        labelDiv.style.background = this.backgroundColor;
        labelDiv.style.pointerEvents = 'auto'; // Make label clickable
        labelDiv.style.cursor = 'pointer';
        
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 10, 0);
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
