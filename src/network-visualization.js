import * as THREE from 'three';
import DataroomElement from 'dataroom-js';
import ThreeForceGraph from 'three-forcegraph';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * NetworkVisualization Custom Element
 *
 * A 3D network visualization component that displays nodes and edges in an interactive
 * force-directed graph using Three.js. Supports node selection, labels, and dynamic styling.
 *
 * @class NetworkVisualization
 * @extends DataroomElement
 * 
 * @example
 * <network-visualization scale="1.0" labels-zoom-level="1.1">
 *   <network-node id="node1" name="Node 1">Content</network-node>
 *   <network-edge source="node1" target="node2" name="Edge">Edge content</network-edge>
 * </network-visualization>
 */
class NetworkVisualization extends DataroomElement {
  /**
   * Initializes the network visualization component
   * Sets up the Three.js scene, camera, renderer, graph, and event listeners
   * @returns {Promise<void>}
   */
  async initialize() {
    const width = this.clientWidth;
    const height = this.clientHeight;

    this.selectedObject = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 150;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setAnimationLoop(this.animate.bind(this));
    this.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.appendChild(this.labelRenderer.domElement);

    const computedStyle = window.getComputedStyle(this);
    this.foregroundColor = computedStyle.color;
    this.backgroundColor = new THREE.Color(computedStyle.backgroundColor);
    this.renderer.setClearColor(this.backgroundColor);

    this.graph = new ThreeForceGraph()
      .graphData({ nodes: [], links: [] })
      .nodeRelSize(4)
      .linkWidth(1)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleSpeed(0.006);

    this.scene.add(this.graph);
    
    this.buildGraph();
    this.addInteraction();

    this.on('NODE-CHANGED', (detail) => {
      if (detail.attribute === 'scale') {
        const newScale = parseFloat(detail.newValue) || 1.0;
        this.graph.scale.set(newScale, newScale, newScale);
      }
    });

    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
      }
    });
    this.resizeObserver.observe(this);
  }

  /**
   * Builds the graph from network-node and network-edge child elements
   * Creates labels for nodes and edges, and configures the force-directed graph
   * @returns {void}
   */
  buildGraph() {
    const nodeElements = Array.from(this.querySelectorAll('network-node'));
    const edgeElements = Array.from(this.querySelectorAll('network-edge'));

    const nodes = nodeElements.map(el => {
      return {
        id: el.getAttribute('id'),
        name: el.getAttribute('name'),
        content: el.innerHTML,
        el: el,
      };
    });

    const links = edgeElements.map(el => {
      return {
        source: el.getAttribute('source'),
        target: el.getAttribute('target'),
        name: el.getAttribute('name'),
        content: el.innerHTML,
        el: el,
      };
    });

    this.graph.graphData({ nodes, links });

    this.graph.nodeThreeObject(node => {
      const group = new THREE.Group();
      
      // Create the node mesh
      const geometry = new THREE.ConeGeometry(5, 10, 4);
      const material = new THREE.MeshBasicMaterial({ color: this.foregroundColor, wireframe: true });
      const mesh = new THREE.Mesh(geometry, material);
      node.mesh = mesh;
      group.add(mesh);
      
      // Add HTML label if node has a name
      if (node.name) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'node-label';
        labelDiv.textContent = node.name;
        labelDiv.style.color = this.foregroundColor;
        labelDiv.style.fontSize = '12px';
        labelDiv.style.fontFamily = 'sans-serif';
        labelDiv.style.padding = '2px 5px';
        labelDiv.style.background = 'rgba(0, 0, 0, 0.6)';
        labelDiv.style.borderRadius = '3px';
        
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 10, 0);
        group.add(label);
      }
      
      return group;
    });
  }

  /**
   * Animation loop function that updates the graph, controls, and renders the scene
   * @returns {void}
   */
  animate() {
    this.graph.tickFrame();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  /**
   * Handles selection of nodes and edges in the visualization
   * Expands the selected object and highlights it
   * @param {Object|null} newSelection - The selected node or link object, or null to deselect
   * @returns {void}
   */
  handleSelection(newSelection) {
    if (this.selectedObject && this.selectedObject !== newSelection) {
      if (this.selectedObject.mesh) { // is node
        this.selectedObject.mesh.material.color.set(this.foregroundColor);
      }
    }

    this.selectedObject = newSelection;

    if (newSelection) {
      if (newSelection.mesh) { // is node
        newSelection.mesh.material.color.set(0xff0000); // Highlight
      }
      // TODO: Show content in a separate panel
      console.log('Selected:', newSelection);
    }
  }

  /**
   * Adds interaction controls and click handlers to the visualization
   * @returns {void}
   */
  addInteraction() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 1.2;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const intersects = raycaster.intersectObjects(this.scene.children, true);

      if (intersects.length > 0) {
        const { nodes } = this.graph.graphData();
        const clickedNode = nodes.find(node => node.__threeObj === intersects[0].object || node.mesh === intersects[0].object);
        
        if (clickedNode) {
          if (this.selectedObject === clickedNode) {
            this.handleSelection(null);
          } else {
            this.handleSelection(clickedNode);
          }
        } else {
          this.handleSelection(null);
        }
      } else {
        this.handleSelection(null);
      }
    });
  }

  /**
   * Cleanup function called when the element is removed from the DOM
   * Disposes of Three.js resources and observers
   * @returns {void}
   */
  disconnect() {
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    if (this.labelRenderer.domElement.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
    }
  }
}


customElements.define('network-visualization', NetworkVisualization);
