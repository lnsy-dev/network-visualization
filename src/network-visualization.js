import DataroomElement from 'dataroom-js';
import SceneManager from './scene-manager.js';
import GraphBuilder from './graph-builder.js';
import GroupWireframeManager from './group-wireframe-manager.js';
import MetadataDisplay from './metadata-display.js';
import InteractionHandler from './interaction-handler.js';

/**
 * NetworkVisualization Custom Element
 *
 * A 3D network visualization component that displays nodes and edges in an interactive
 * grid-based layout using Three.js. Supports node selection, labels, and dynamic styling.
 *
 * @class NetworkVisualization
 * @extends DataroomElement
 * 
 * @example
 * <network-visualization scale="1.0" labels-zoom-level="1.1" minimum-node-size="1.5" zoom-to-fit>
 *   <network-node id="node1" name="Node 1">Content</network-node>
 *   <network-edge source="node1" target="node2" name="Edge">Edge content</network-edge>
 * </network-visualization>
 * 
 * @attribute {number} minimum-node-size - Minimum size multiplier for nodes (default: 1.0)
 * @attribute {number} scale - Scale factor for all nodes (default: 1.0)
 * @attribute {number} labels-zoom-level - Zoom level at which labels become visible
 * @attribute {boolean} zoom-to-fit - Whether to automatically zoom camera to fit all nodes (default: false)
 */
class NetworkVisualization extends DataroomElement {
  /**
   * Initializes the network visualization component
   * Sets up the Three.js scene, camera, renderer, and event listeners
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    const width = this.clientWidth;
    const height = this.clientHeight;

    const computedStyle = window.getComputedStyle(this);
    this.foregroundColor = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;
    const minimumNodeSize = parseFloat(this.getAttribute('minimum-node-size')) || 1.0;

    this.sceneManager = new SceneManager(this, width, height, backgroundColor);
    this.graphBuilder = new GraphBuilder(
      this.sceneManager.graphGroup, 
      this.foregroundColor, 
      backgroundColor,
      minimumNodeSize
    );
    this.wireframeManager = new GroupWireframeManager(this.sceneManager.graphGroup);
    this.metadataDisplay = new MetadataDisplay(this, this.create.bind(this));
    this.interactionHandler = new InteractionHandler(
      this.sceneManager.camera,
      this.sceneManager.scene,
      this.sceneManager.renderer.domElement,
      this.sceneManager.labelRenderer.domElement,
      this.sceneManager
    );

    this.buildGraph();
    this.setupInteraction();
    this.setupAttributeObserver();
    this.setupResizeObserver();

    this.sceneManager.startAnimation();
  }

  /**
   * Builds the graph from network-node and network-edge child elements
   * 
   * @returns {void}
   */
  buildGraph() {
    const { nodes, links, groups } = this.graphBuilder.buildFromElements(this);
    
    this.nodes = nodes;
    this.links = links;
    this.groups = groups;

    this.wireframeManager.createWireframes(groups);
    this.wireframeManager.update(nodes);
    
    // Zoom out to fit all elements in view if zoom-to-fit attribute is present
    if (this.hasAttribute('zoom-to-fit')) {
      this.sceneManager.fitCameraToScene();
    }
  }

  /**
   * Sets up interaction handlers
   * 
   * @returns {void}
   */
  setupInteraction() {
    this.interactionHandler.setupClickHandler(
      this.nodes,
      this.wireframeManager.getWireframes(),
      this.onSelectionChange.bind(this)
    );
  }

  /**
   * Handles selection change events
   * 
   * @param {Object|null} selection - The selected object or null
   * @returns {void}
   */
  onSelectionChange(selection) {
    if (!selection) {
      this.metadataDisplay.clear();
      return;
    }

    if (selection.mesh) {
      this.metadataDisplay.showNodeMetadata(
        selection,
        this.nodes,
        this.links,
        this.selectNodeById.bind(this)
      );
    } else if (selection.wireframe) {
      this.metadataDisplay.showGroupMetadata(
        selection,
        this.nodes,
        this.selectNodeById.bind(this)
      );
    }
  }

  /**
   * Selects a node by its ID
   * 
   * @param {string} id - The ID of the node to select
   * @returns {boolean} Returns true if node was found and selected
   */
  selectNodeById(id) {
    const node = this.nodes.find(n => n.id === id);
    
    if (node) {
      this.interactionHandler.handleSelection(
        node, 
        this.onSelectionChange.bind(this)
      );
      return true;
    }
    
    return false;
  }

  /**
   * Sets up attribute change observer for dynamic updates
   * 
   * @returns {void}
   */
  setupAttributeObserver() {
    this.on('NODE-CHANGED', (detail) => {
      if (detail.attribute === 'scale') {
        const newScale = parseFloat(detail.newValue) || 1.0;
        this.nodes.forEach(node => {
          if (node.group) {
            node.group.scale.set(newScale, newScale, newScale);
          }
        });
      }
    });
  }

  /**
   * Sets up resize observer for responsive rendering
   * 
   * @returns {void}
   */
  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!width || !height) continue;
        
        const canvas = this.sceneManager.renderer.domElement;
        if (Math.round(canvas.width) === Math.round(width) && 
            Math.round(canvas.height) === Math.round(height)) continue;
        
        if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
        this._resizeRaf = requestAnimationFrame(() => {
          this.sceneManager.resize(width, height);
        });
      }
    });
    this.resizeObserver.observe(this);
  }

  /**
   * Cleanup function called when the element is removed from the DOM
   * 
   * @returns {void}
   */
  disconnect() {
    this.resizeObserver.disconnect();
    this.sceneManager.dispose();
    this.wireframeManager.removeAll();
  }
}

customElements.define('network-visualization', NetworkVisualization);
