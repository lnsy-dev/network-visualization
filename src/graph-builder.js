import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  parseNodeData,
  parseEdgeData,
  parseGroupData,
  filterValidLinks,
  assignGroupMembership,
  calculateGridPositions,
} from './graph-builder-logic.js';

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

    this.nodes = nodeElements.map((el) =>
      parseNodeData({
        id: el.getAttribute('id'),
        name: el.getAttribute('name'),
        color: el.getAttribute('color'),
        foregroundColor: this.foregroundColor,
        wireframe: el.hasAttribute('wireframe'),
        shape: el.getAttribute('shape'),
        content: el.innerHTML,
        el,
      })
    );

    const nodeIds = new Set(this.nodes.map((n) => n.id));

    this.links = filterValidLinks(
      edgeElements.map((el) =>
        parseEdgeData({
          source: el.getAttribute('source'),
          target: el.getAttribute('target'),
          name: el.getAttribute('name'),
          color: el.getAttribute('color'),
          foregroundColor: this.foregroundColor,
          content: el.innerHTML,
          el,
        })
      ),
      nodeIds
    );

    this.groups = groupElements.map((el) =>
      parseGroupData({
        id: el.getAttribute('id'),
        name: el.getAttribute('name'),
        color: el.getAttribute('color'),
        nodeIds: el.getAttribute('node-ids'),
        content: el.innerHTML,
        el,
      })
    );

    assignGroupMembership(this.nodes, this.groups);
    calculateGridPositions(this.nodes, this.groups, {
      nodeSpacing: this.nodeSpacing,
    });

    this.createNodeMeshes();
    this.createLinks();

    return {
      nodes: this.nodes,
      links: this.links,
      groups: this.groups,
    };
  }

  /**
   * Creates Three.js meshes for all nodes
   *
   * @returns {void}
   */
  createNodeMeshes() {
    this.nodes.forEach((node) => {
      const group = new THREE.Group();

      // Apply minimum size constraint to base geometry dimensions
      const baseSize = Math.max(5, this.minimumNodeSize * 5);
      const baseHeight = Math.max(10, this.minimumNodeSize * 10);
      const baseRadius = Math.max(2, this.minimumNodeSize * 2);

      let geometry;
      switch (node.shape) {
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
        wireframe: node.wireframe,
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
        // Anchor the label at its top center and place it just below the mesh.
        // The anchor is the top edge so the text extends downward and does not
        // overlap the node even when the node group is scaled down.
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        const labelGap = 2;
        label.position.set(0, boundingBox.min.y - labelGap, 0);
        label.center.set(0.5, 0);
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
    this.links.forEach((link) => {
      const sourceNode = this.nodes.find((n) => n.id === link.source);
      const targetNode = this.nodes.find((n) => n.id === link.target);

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
        transparent: true,
      });

      const line = new THREE.Line(geometry, material);
      link.line = line;
      this.graphGroup.add(line);
    });
  }
}
