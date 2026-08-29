import * as THREE from 'three';
import { isDrag } from './interaction-logic.js';

/**
 * InteractionHandler
 * 
 * Handles user interactions with the visualization including clicks and selections
 * 
 * @class InteractionHandler
 */
export default class InteractionHandler {
  /**
   * Creates a new InteractionHandler instance
   * 
   * @param {THREE.Camera} camera - The Three.js camera
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {HTMLElement} rendererElement - The renderer's DOM element
   * @param {HTMLElement} labelRendererElement - The label renderer's DOM element
   * @param {Object} sceneManager - The SceneManager instance for camera control
   */
  constructor(camera, scene, rendererElement, labelRendererElement, sceneManager) {
    this.camera = camera;
    this.scene = scene;
    this.rendererElement = rendererElement;
    this.labelRendererElement = labelRendererElement;
    this.sceneManager = sceneManager;
    this.selectedObject = null;
    this.hoveredObject = null;
    this.nodes = [];
    this.groupWireframes = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mouseDownPos = new THREE.Vector2();
    this.isMouseDown = false;
    this.isDragging = false;
    
    this.raycaster.params.Points.threshold = 30;
    this.raycaster.params.Line.threshold = 1; // Reduced from 10 to minimize edge hitbox
  }

  /**
   * Sets up click event listener
   * 
   * @param {Array} nodes - Array of node objects
   * @param {Array} groupWireframes - Array of group wireframe objects
   * @param {Function} onSelectionChange - Callback when selection changes
   * @returns {void}
   */
  setupClickHandler(nodes, groupWireframes, onSelectionChange) {
    this.nodes = nodes;
    this.groupWireframes = groupWireframes;

    // Track mouse down/up for drag detection and hover cursor
    this.rendererElement.addEventListener('mousedown', (event) => {
      this.isMouseDown = true;
      this.mouseDownPos.x = event.clientX;
      this.mouseDownPos.y = event.clientY;
      this.isDragging = false;
    });

    this.rendererElement.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    this.rendererElement.addEventListener('mousemove', (event) => {
      if (this.isMouseDown) {
        if (
          isDrag(
            { x: this.mouseDownPos.x, y: this.mouseDownPos.y },
            { x: event.clientX, y: event.clientY }
          )
        ) {
          this.isDragging = true;
        }
      }

      this.updateHoverCursor(event, nodes);
    });

    this.rendererElement.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      this.rendererElement.style.cursor = '';
      this.setHover(null);
    });
    
    // Handle label clicks on the CSS2DRenderer overlay
    this.labelRendererElement.addEventListener('click', (event) => {
      // Check if clicked on a label
      if (event.target.classList.contains('node-label')) {
        const nodeId = event.target.dataset.nodeId;
        const clickedNode = nodes.find(node => node.id === nodeId);        
        if (clickedNode) {
          if (this.selectedObject === clickedNode) {
            this.handleSelection(null, onSelectionChange);
          } else {
            this.handleSelection(clickedNode, onSelectionChange);
          }
          return;
        }
      }
    });

    // Highlight nodes and labels on label hover.
    this.labelRendererElement.addEventListener('mouseover', (event) => {
      if (event.target.classList.contains('node-label')) {
        const nodeId = event.target.dataset.nodeId;
        const hoveredNode = nodes.find((node) => node.id === nodeId);
        if (hoveredNode) {
          this.setHover(hoveredNode);
        }
      }
    });

    this.labelRendererElement.addEventListener('mouseout', (event) => {
      if (event.target.classList.contains('node-label')) {
        this.setHover(null);
      }
    });

    // Handle 3D object clicks on the canvas
    this.rendererElement.addEventListener('click', (event) => {
      // Ignore clicks that are actually drags
      if (this.isDragging) {
        this.isDragging = false;
        return;
      }
      
      // Check if clicked on a label (for fallback)
      if (event.target.classList.contains('node-label')) {
        return; // Already handled by labelRendererElement listener
      }
      
      // Handle 3D object clicks
      const rect = this.rendererElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);

      if (intersects.length > 0) {
        const clickedNode = nodes.find(node => node.mesh === intersects[0].object);
        
        if (clickedNode) {
          if (this.selectedObject === clickedNode) {
            this.handleSelection(null, onSelectionChange);
          } else {
            this.handleSelection(clickedNode, onSelectionChange);
          }
        } else {
          const clickedGroup = groupWireframes.find(gw => gw.mesh === intersects[0].object);
          
          if (clickedGroup) {
            const groupSelection = {
              ...clickedGroup.group,
              wireframe: clickedGroup.mesh,
              originalColor: clickedGroup.group.color || 0x888888
            };
            
            if (this.selectedObject && this.selectedObject.id === groupSelection.id) {
              this.handleSelection(null, onSelectionChange);
            } else {
              this.handleSelection(groupSelection, onSelectionChange);
            }
          } else {
            this.handleSelection(null, onSelectionChange);
          }
        }
      } else {
        this.handleSelection(null, onSelectionChange);
      }
    });
  }

  /**
   * Updates the renderer cursor and hover state based on the pointer position.
   *
   * Nodes are clickable like labels, so the cursor changes to a pointer when
   * the pointer is over a node mesh, and the node/label are highlighted with the
   * secondary theme color.
   *
   * @param {MouseEvent} event - The mousemove event
   * @param {Array} nodes - Array of node objects
   * @returns {void}
   */
  updateHoverCursor(event, nodes) {
    if (this.isDragging) {
      this.rendererElement.style.cursor = '';
      this.setHover(null);
      return;
    }

    const rect = this.rendererElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    const hoveredNode = intersects.length > 0
      ? nodes.find((node) => node.mesh === intersects[0].object)
      : null;

    this.rendererElement.style.cursor = hoveredNode ? 'pointer' : '';
    this.setHover(hoveredNode);
  }

  /**
   * Handles selection changes and visual highlighting
   *
   * @param {Object|null} newSelection - The newly selected object or null
   * @param {Function} onSelectionChange - Callback when selection changes
   * @returns {void}
   */
  handleSelection(newSelection, onSelectionChange) {
    if (this.selectedObject && this.selectedObject !== newSelection) {
      if (this.selectedObject.mesh) {
        // Node reset is handled by applyHoverStyles.
      } else if (this.selectedObject.wireframe) {
        this.selectedObject.wireframe.material.color.set(this.selectedObject.originalColor || 0x888888);
        this.selectedObject.wireframe.material.opacity = 0.5;
        this.selectedObject.wireframe.material.needsUpdate = true;
      }
    }

    this.selectedObject = newSelection;

    if (newSelection) {
      if (newSelection.mesh) {
        // Animate camera to focus selected node while keeping every node visible
        if (this.sceneManager && newSelection.x !== undefined) {
          const targetPosition = new THREE.Vector3(newSelection.x, newSelection.y, newSelection.z);
          this.sceneManager.animateCameraToNode(targetPosition);
        } else {
          console.log('Cannot focus node:', { hasSceneManager: !!this.sceneManager, hasX: newSelection.x !== undefined });
        }
      } else if (newSelection.wireframe) {
        newSelection.wireframe.material.color.set(0x00ff00);
        newSelection.wireframe.material.opacity = 0.8;
        newSelection.wireframe.material.needsUpdate = true;
      }
    } else {
      // When deselecting, reset camera to show the entire scene
      if (this.sceneManager) {
        this.sceneManager.animateCameraToFitScene();
      }
    }

    this.applyHoverStyles();

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    }
  }

  /**
   * Sets the currently hovered node and updates hover/selection visuals.
   *
   * @param {Object|null} newHover - The newly hovered node or null
   * @returns {void}
   */
  setHover(newHover) {
    if (this.hoveredObject === newHover) return;

    this.hoveredObject = newHover;
    this.applyHoverStyles();
  }

  /**
   * Applies hover and selection colors/classes to nodes and labels.
   *
   * Selected nodes and labels are highlighted with the theme's accent color,
   * hovered nodes with the secondary color, and everything else reverts to its
   * original color.
   *
   * @returns {void}
   */
  applyHoverStyles() {
    const secondaryColor = this.getSecondaryColor();
    const accentColor = this.getAccentColor();

    this.nodes.forEach((node) => {
      const isSelected = this.selectedObject === node;
      const isHovered = this.hoveredObject === node && !isSelected;

      if (isSelected) {
        node.mesh.material.color.set(accentColor);
      } else if (isHovered) {
        node.mesh.material.color.set(secondaryColor);
      } else {
        node.mesh.material.color.set(node.originalColor);
      }
      node.mesh.material.needsUpdate = true;

      const label = this.labelRendererElement.querySelector(`[data-node-id="${node.id}"]`);
      if (label) {
        label.classList.toggle('selected', isSelected);
        label.classList.toggle('hover', isHovered);
      }
    });
  }

  /**
   * Reads the secondary theme color from the component's CSS variable.
   *
   * @returns {THREE.Color} The secondary color as a Three.js Color
   */
  getSecondaryColor() {
    const container = this.rendererElement.closest('network-visualization');
    const style = container ? window.getComputedStyle(container) : null;
    const secondary = style ? style.getPropertyValue('--secondary').trim() : '';
    return new THREE.Color(secondary || '#ffffff');
  }

  /**
   * Reads the accent theme color from the component's CSS variable.
   *
   * @returns {THREE.Color} The accent color as a Three.js Color
   */
  getAccentColor() {
    const container = this.rendererElement.closest('network-visualization');
    const style = container ? window.getComputedStyle(container) : null;
    const accent = style ? style.getPropertyValue('--accent').trim() : '';
    return new THREE.Color(accent || '#ffffff');
  }

  /**
   * Gets the currently selected object
   * 
   * @returns {Object|null} The selected object or null
   */
  getSelectedObject() {
    return this.selectedObject;
  }
}
