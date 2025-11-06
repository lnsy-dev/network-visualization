import * as THREE from 'three';

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
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mouseDownPos = new THREE.Vector2();
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
    // Track mouse down for drag detection
    this.rendererElement.addEventListener('mousedown', (event) => {
      this.mouseDownPos.x = event.clientX;
      this.mouseDownPos.y = event.clientY;
      this.isDragging = false;
    });
    
    this.rendererElement.addEventListener('mousemove', (event) => {
      if (this.mouseDownPos.x !== undefined) {
        const dx = event.clientX - this.mouseDownPos.x;
        const dy = event.clientY - this.mouseDownPos.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this.isDragging = true;
        }
      }
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
   * Handles selection changes and visual highlighting
   * 
   * @param {Object|null} newSelection - The newly selected object or null
   * @param {Function} onSelectionChange - Callback when selection changes
   * @returns {void}
   */
  handleSelection(newSelection, onSelectionChange) {
    if (this.selectedObject && this.selectedObject !== newSelection) {
      if (this.selectedObject.mesh) {
        this.selectedObject.mesh.material.color.set(this.selectedObject.originalColor);
        this.selectedObject.mesh.material.needsUpdate = true;
        // Remove .selected class from label
        const label = this.labelRendererElement.querySelector(`[data-node-id="${this.selectedObject.id}"]`);
        if (label) {
          label.classList.remove('selected');
        }
      } else if (this.selectedObject.wireframe) {
        this.selectedObject.wireframe.material.color.set(this.selectedObject.originalColor || 0x888888);
        this.selectedObject.wireframe.material.opacity = 0.5;
        this.selectedObject.wireframe.material.needsUpdate = true;
      }
    }

    this.selectedObject = newSelection;

    if (newSelection) {
      if (newSelection.mesh) {
        newSelection.mesh.material.color.set(0xff0000);
        newSelection.mesh.material.needsUpdate = true;
        // Add .selected class to label
        const label = this.labelRendererElement.querySelector(`[data-node-id="${newSelection.id}"]`);
        if (label) {
          label.classList.add('selected');
        }
        
        // Animate scene to center selected node at origin
        if (this.sceneManager && newSelection.x !== undefined) {
          const targetPosition = new THREE.Vector3(newSelection.x, newSelection.y, newSelection.z);
          this.sceneManager.animateToNode(targetPosition);
        } else {
          console.log('Cannot center node:', { hasSceneManager: !!this.sceneManager, hasX: newSelection.x !== undefined });
        }
      } else if (newSelection.wireframe) {
        newSelection.wireframe.material.color.set(0x00ff00);
        newSelection.wireframe.material.opacity = 0.8;
        newSelection.wireframe.material.needsUpdate = true;
      }
    } else {
      // When deselecting, reset scene to original position
      if (this.sceneManager) {
        this.sceneManager.resetScenePosition();
      }
    }

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    }
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
