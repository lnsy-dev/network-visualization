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
        color: el.getAttribute('color') || '#888888',
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
   * Calculates grid positions for nodes with clean group layout
   * 
   * @returns {void}
   */
  calculateGridPositions() {
    if (this.nodes.length === 0) return;

    const gridSpacing = this.nodeSpacing;
    const groupSpacing = 3; // Spacing between different groups
    const occupiedPositions = new Set();
    const groupBounds = new Map();
    
    /**
     * Place a node at grid coordinates
     */
    const placeNode = (node, gridX, gridY) => {
      occupiedPositions.add(`${gridX},${gridY}`);
      node.x = gridX * gridSpacing;
      node.y = 0;
      node.z = gridY * gridSpacing;
      node.gridX = gridX;
      node.gridY = gridY;
    };
    
    /**
     * Check if position is available and respects group bounds
     */
    const canPlaceAt = (gridX, gridY, groupId) => {
      const key = `${gridX},${gridY}`;
      if (occupiedPositions.has(key)) return false;
      
      // Check if position conflicts with other group bounds
      for (const [otherGroupId, bounds] of groupBounds.entries()) {
        if (otherGroupId === groupId) continue;
        
        // No nodes allowed in other group's territory
        if (gridX >= bounds.minX - groupSpacing && gridX <= bounds.maxX + groupSpacing &&
            gridY >= bounds.minY - groupSpacing && gridY <= bounds.maxY + groupSpacing) {
          return false;
        }
      }
      
      return true;
    };
    
    /**
     * Update group bounds
     */
    const updateBounds = (groupId, gridX, gridY) => {
      if (!groupBounds.has(groupId)) {
        groupBounds.set(groupId, { minX: gridX, maxX: gridX, minY: gridY, maxY: gridY });
      } else {
        const bounds = groupBounds.get(groupId);
        bounds.minX = Math.min(bounds.minX, gridX);
        bounds.maxX = Math.max(bounds.maxX, gridX);
        bounds.minY = Math.min(bounds.minY, gridY);
        bounds.maxY = Math.max(bounds.maxY, gridY);
      }
    };
    
    /**
     * Find nearest available position
     */
    const findPosition = (startX, startY, groupId) => {
      if (canPlaceAt(startX, startY, groupId)) return { x: startX, y: startY };
      
      for (let radius = 1; radius < 50; radius++) {
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
      return { x: startX, y: startY }; // Fallback
    };
    
    // Organize nodes by groups
    const groupedNodes = new Map();
    const ungroupedNodes = [];
    
    this.nodes.forEach(node => {
      if (node.groups.length > 0) {
        const groupId = node.groups[0]; // Use first group
        if (!groupedNodes.has(groupId)) {
          groupedNodes.set(groupId, []);
        }
        groupedNodes.get(groupId).push(node);
      } else {
        ungroupedNodes.push(node);
      }
    });
    
    // Place groups
    let groupIndex = 0;
    const groupStartPositions = [
      [0, 0],   // Center
      [5, 0],   // Right
      [-5, 0],  // Left  
      [0, 5],   // Up
      [0, -5],  // Down
      [5, 5],   // Top-right
      [-5, 5],  // Top-left
      [5, -5],  // Bottom-right
      [-5, -5]  // Bottom-left
    ];
    
    for (const [groupId, nodes] of groupedNodes.entries()) {
      if (nodes.length === 0) continue;
      
      // Get starting position for this group
      const [startX, startY] = groupStartPositions[groupIndex % groupStartPositions.length];
      groupIndex++;
      
      // Place first node of group
      const pos = findPosition(startX, startY, groupId);
      placeNode(nodes[0], pos.x, pos.y);
      updateBounds(groupId, pos.x, pos.y);
      
      // Place remaining nodes adjacent to group members
      const adjacentOffsets = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, 1], [1, -1], [-1, -1]
      ];
      
      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        let placed = false;
        
        // Try to place next to existing group members
        for (let j = 0; j < i && !placed; j++) {
          const existingNode = nodes[j];
          
          for (const [dx, dy] of adjacentOffsets) {
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
        
        // If couldn't place adjacent, find nearest position
        if (!placed) {
          const pos = findPosition(nodes[0].gridX, nodes[0].gridY, groupId);
          placeNode(node, pos.x, pos.y);
          updateBounds(groupId, pos.x, pos.y);
        }
      }
    }
    
    // Place ungrouped nodes
    ungroupedNodes.forEach(node => {
      const pos = findPosition(0, 0, null);
      placeNode(node, pos.x, pos.y);
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
