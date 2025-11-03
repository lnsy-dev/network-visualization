import * as THREE from 'three';

/**
 * GroupWireframeManager
 * 
 * Manages wireframe cubes that surround groups of nodes
 * 
 * @class GroupWireframeManager
 */
export default class GroupWireframeManager {
  /**
   * Creates a new GroupWireframeManager instance
   * 
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    this.groupWireframes = [];
  }

  /**
   * Creates wireframe cubes for all groups
   * 
   * @param {Array} groups - Array of group objects
   * @returns {void}
   */
  createWireframes(groups) {
    this.removeAll();

    groups.forEach(group => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.LineBasicMaterial({ 
        color: 0x888888, 
        linewidth: 1,
        transparent: true,
        opacity: 0.5
      });
      const edges = new THREE.EdgesGeometry(geometry);
      const wireframe = new THREE.LineSegments(edges, material);
      
      material.linecap = 'round';
      material.linejoin = 'round';
      
      this.scene.add(wireframe);
      
      this.groupWireframes.push({
        mesh: wireframe,
        group: group
      });
    });
  }

  /**
   * Updates wireframe positions and sizes based on node positions
   * 
   * @param {Array} nodes - Array of node objects with position data
   * @returns {void}
   */
  update(nodes) {
    this.groupWireframes.forEach(({ mesh, group }) => {
      const groupNodes = nodes.filter(n => group.nodeIds.includes(n.id));
      
      if (groupNodes.length === 0) return;
      
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      
      groupNodes.forEach(node => {
        if (node.x !== undefined) {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
          minZ = Math.min(minZ, node.z);
          maxZ = Math.max(maxZ, node.z);
        }
      });
      
      const padding = 20;
      minX -= padding; maxX += padding;
      minY -= padding; maxY += padding;
      minZ -= padding; maxZ += padding;
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      
      mesh.position.set(centerX, centerY, centerZ);
      mesh.scale.set(
        maxX - minX,
        maxY - minY,
        maxZ - minZ
      );
      
      group.center = { x: centerX, y: centerY, z: centerZ };
    });
  }

  /**
   * Removes all wireframes from the scene
   * 
   * @returns {void}
   */
  removeAll() {
    this.groupWireframes.forEach(wireframe => {
      this.scene.remove(wireframe.mesh);
    });
    this.groupWireframes = [];
  }

  /**
   * Gets all wireframe objects
   * 
   * @returns {Array} Array of wireframe objects
   */
  getWireframes() {
    return this.groupWireframes;
  }
}
