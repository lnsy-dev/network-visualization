import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { computeGroupCenter, expandNodesToHullPoints } from './group-hull-logic.js';

/**
 * GroupWireframeManager
 *
 * Manages a single convex hull wireframe for each group of nodes.
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
   * Initializes the internal list of group wireframes.
   *
   * Actual geometry is created on the first call to update().
   *
   * @param {Array} groups - Array of group objects
   * @returns {void}
   */
  createWireframes(groups) {
    this.removeAll();

    this.groupWireframes = groups.map((group) => ({
      mesh: null,
      group,
    }));
  }

  /**
   * Updates group hulls based on current node positions.
   *
   * Each group is rendered as a single convex hull wireframe that encloses
   * all of its nodes with a small padding.
   *
   * @param {Array} nodes - Array of node objects with position data
   * @returns {void}
   */
  update(nodes) {
    const padding = 20;

    this.groupWireframes.forEach((entry) => {
      const groupNodes = nodes.filter((n) => entry.group.nodeIds.includes(n.id));

      if (groupNodes.length === 0) return;

      // Remove the previous hull, if any.
      if (entry.mesh) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        entry.mesh.material.dispose();
      }

      // Build a convex hull around padded cubes centered on each node.
      const hullPoints = expandNodesToHullPoints(groupNodes, padding).map(
        (p) => new THREE.Vector3(p.x, p.y, p.z)
      );

      const convexGeometry = new ConvexGeometry(hullPoints);
      const edgesGeometry = new THREE.EdgesGeometry(convexGeometry);

      const material = new THREE.LineBasicMaterial({
        color: entry.group.color || 0x888888,
        linewidth: 1,
        transparent: true,
        opacity: 0.5,
      });

      const wireframe = new THREE.LineSegments(edgesGeometry, material);
      this.scene.add(wireframe);

      entry.mesh = wireframe;
      entry.group.center = computeGroupCenter(groupNodes);
    });
  }

  /**
   * Removes all wireframes from the scene
   *
   * @returns {void}
   */
  removeAll() {
    this.groupWireframes.forEach((wireframe) => {
      if (wireframe.mesh) {
        this.scene.remove(wireframe.mesh);
        wireframe.mesh.geometry.dispose();
        wireframe.mesh.material.dispose();
      }
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
