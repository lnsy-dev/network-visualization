import DataroomElement from 'dataroom-js';
import SceneManager from './scene-manager.js';
import GraphBuilder from './graph-builder.js';
import GroupWireframeManager from './group-wireframe-manager.js';
import MetadataDisplay from './metadata-display.js';
import InteractionHandler from './interaction-handler.js';
import { parseInset } from './scene-logic.js';
import { parseScaleAttribute } from './graph-builder-logic.js';

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
 * <network-visualization scale="1.0" labels-zoom-level="1.1" minimum-node-size="1.5">
 *   <network-node id="node1" name="Node 1">Content</network-node>
 *   <network-edge source="node1" target="node2" name="Edge">Edge content</network-edge>
 * </network-visualization>
 * 
 * @attribute {number} minimum-node-size - Minimum size multiplier for nodes (default: 1.0)
 * @attribute {number} scale - Scale factor for all nodes (default: 1.0). Applied on
 *   first load and on attribute changes.
 * @attribute {number} labels-zoom-level - Zoom level at which labels become visible
 * @attribute {boolean} no-hud - Suppress the built-in metadata sidebar and rely on the metadata-shown event
 * @attribute {boolean} zoom-to-fit - Deprecated no-op; the camera now always fits on load
 */
class NetworkVisualization extends DataroomElement {
  /**
   * Initializes the network visualization component
   * Sets up the Three.js scene, camera, renderer, and event listeners
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    let width = this.clientWidth;
    let height = this.clientHeight;

    // CodeMirror widgets and other layout-driven hosts may attach the element
    // before it has a computed size. Defer the initial camera fit until the
    // ResizeObserver reports a real size.
    this._initialSizeZero = width === 0 || height === 0;
    if (this._initialSizeZero) {
      width = Math.max(width, 1);
      height = Math.max(height, 1);
    }
    this._hasFitted = false;

    const computedStyle = window.getComputedStyle(this);
    this.foregroundColor = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;
    const minimumNodeSize = parseFloat(this.getAttribute('minimum-node-size')) || 1.0;
    this.noHud = this.hasAttribute('no-hud');

    // The scale attribute must be read at init time: NODE-CHANGED events only
    // fire for later mutations, not for attributes set before connecting.
    this.nodeScale = parseScaleAttribute(this.getAttribute('scale'));

    this.sceneManager = new SceneManager(this, width, height, backgroundColor);
    this.graphBuilder = new GraphBuilder(
      this.sceneManager.graphGroup,
      this.foregroundColor,
      backgroundColor,
      minimumNodeSize
    );
    this.graphBuilder.nodeScale = this.nodeScale;

    // Once the user interacts with the camera (drag, Shift+zoom) automatic
    // refitting stops, so their viewpoint is never overridden.
    this._userInteracted = false;
    this.sceneManager.controls.addEventListener('start', () => {
      this._userInteracted = true;
    });
    this.wireframeManager = new GroupWireframeManager(this.sceneManager.graphGroup);
    this.metadataDisplay = new MetadataDisplay(this, this.create.bind(this), this.noHud);
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
    this.setupWindowResize();
    this.setupShiftZoom();

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
    this.applyNodeScale(this.nodeScale);

    // Fit the camera so every node is visible, respecting overlay insets. The
    // first real fit flies in from a top-down intro position so the camera
    // tilts and zooms to reveal the graph; later fits snap immediately.
    const insets = this.getFitInsets();
    if (this._hasFitted || this._initialSizeZero) {
      // Zero-size hosts snap now and run the intro once a real size arrives.
      this.sceneManager.fitCameraToSceneWithInsets(insets);
    } else {
      this._hasFitted = true;
      this.sceneManager.animateCameraToSceneWithInsets(insets);
    }
  }

  /**
   * Applies the node scale multiplier to every node's Three.js group.
   *
   * @param {number} scale - Positive scale multiplier
   * @returns {void}
   */
  applyNodeScale(scale) {
    this.nodes.forEach((node) => {
      if (node.group) {
        node.group.scale.set(scale, scale, scale);
      }
    });
  }

  /**
   * Computes the viewport insets used for camera fitting.
   * Reads the --network-fit-inset CSS custom property. The built-in HUD sits
   * entirely outside the element's bounds, so it reserves no inset.
   *
   * @returns {{top: number, right: number, bottom: number, left: number}} Viewport insets in pixels
   */
  getFitInsets() {
    const computedStyle = window.getComputedStyle(this);
    const insetValue = computedStyle.getPropertyValue('--network-fit-inset').trim() || '0';
    return parseInset(insetValue);
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
        this.nodeScale = parseScaleAttribute(detail.newValue);
        this.applyNodeScale(this.nodeScale);
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
        this.handleResize(width, height);
      }
    });
    this.resizeObserver.observe(this);
  }

  /**
   * Resizes the Three.js view to match the given dimensions.
   *
   * Requests are coalesced with requestAnimationFrame so rapid resize events
   * (window drag, observer notifications) result in a single update.
   *
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   * @returns {void}
   */
  handleResize(width, height) {
    if (!width || !height || !this.sceneManager) return;

    const canvas = this.sceneManager.renderer.domElement;
    if (
      Math.round(canvas.clientWidth) === Math.round(width) &&
      Math.round(canvas.clientHeight) === Math.round(height)
    ) {
      return;
    }

    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = requestAnimationFrame(() => {
      if (!this.sceneManager) return;
      this.sceneManager.resize(width, height);

      if (this._initialSizeZero) {
        this._initialSizeZero = false;
        const insets = this.getFitInsets();
        // First fit with a real size: run the animated intro.
        if (!this._hasFitted) {
          this._hasFitted = true;
          this.sceneManager.animateCameraToSceneWithInsets(insets);
        } else {
          this.sceneManager.fitCameraToSceneWithInsets(insets);
        }
      } else if (!this._userInteracted) {
        // Layout settled after load (fonts, async content): the initial fit
        // is stale. Refit so the graph keeps filling the element until the
        // user takes control of the camera.
        this.sceneManager.cameraAnimation = null;
        this.sceneManager.fitCameraToSceneWithInsets(this.getFitInsets());
      }
    });
  }

  /**
   * Sets up a window resize listener so the view updates even when the
   * element's own dimensions do not change (for example, CSS inset changes
   * or orientation shifts that only affect the camera projection).
   *
   * @returns {void}
   */
  setupWindowResize() {
    this._onWindowResize = () => {
      this.handleResize(this.clientWidth, this.clientHeight);
    };
    window.addEventListener('resize', this._onWindowResize);
  }

  /**
   * Removes the window resize listener added by setupWindowResize.
   *
   * @returns {void}
   */
  cleanupWindowResize() {
    if (this._onWindowResize) {
      window.removeEventListener('resize', this._onWindowResize);
    }
  }

  /**
   * Sets up Shift+wheel zoom so regular scrolling scrolls the page.
   *
   * @returns {void}
   */
  setupShiftZoom() {
    if (!this.sceneManager || !this.sceneManager.controls) return;

    // Zoom is disabled by default; it is enabled only while Shift is held.
    this.sceneManager.controls.enableZoom = false;

    this._onShiftDown = (event) => {
      if (event.key === 'Shift') {
        this.sceneManager.controls.enableZoom = true;
      }
    };

    this._onShiftUp = (event) => {
      if (event.key === 'Shift') {
        this.sceneManager.controls.enableZoom = false;
      }
    };

    this._onWindowBlur = () => {
      this.sceneManager.controls.enableZoom = false;
    };

    window.addEventListener('keydown', this._onShiftDown);
    window.addEventListener('keyup', this._onShiftUp);
    window.addEventListener('blur', this._onWindowBlur);
  }

  /**
   * Removes the Shift+wheel listeners added by setupShiftZoom.
   *
   * @returns {void}
   */
  cleanupShiftZoom() {
    if (this._onShiftDown) {
      window.removeEventListener('keydown', this._onShiftDown);
    }
    if (this._onShiftUp) {
      window.removeEventListener('keyup', this._onShiftUp);
    }
    if (this._onWindowBlur) {
      window.removeEventListener('blur', this._onWindowBlur);
    }
  }

  /**
   * Cleanup function called when the element is removed from the DOM
   * 
   * @returns {void}
   */
  disconnect() {
    this.cleanupShiftZoom();
    this.cleanupWindowResize();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.sceneManager.dispose();
    this.wireframeManager.removeAll();
  }
}

if (!customElements.get('network-visualization')) {
  customElements.define('network-visualization', NetworkVisualization);
}
