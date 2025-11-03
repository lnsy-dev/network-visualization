import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * SceneManager
 * 
 * Manages the Three.js scene, camera, renderers, and animation loop
 * 
 * @class SceneManager
 */
export default class SceneManager {
  /**
   * Creates a new SceneManager instance
   * 
   * @param {HTMLElement} container - The container element for the renderers
   * @param {number} width - Width of the viewport
   * @param {number} height - Height of the viewport
   * @param {string} backgroundColor - Background color for the scene
   */
  constructor(container, width, height, backgroundColor) {
    this.container = container;
    this.scene = new THREE.Scene();
    
    // Create a parent group for all graph elements
    this.graphGroup = new THREE.Group();
    this.scene.add(this.graphGroup);
    
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(100, 100, 100); // View x-z plane from above
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(new THREE.Color(backgroundColor));
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 1.2;

    this.animateCallback = null;
    this.offsetAnimation = null;
  }

  /**
   * Starts the animation loop
   * 
   * @param {Function} callback - Optional callback to run on each frame
   * @returns {void}
   */
  startAnimation(callback) {
    this.animateCallback = callback;
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  /**
   * Animation loop function
   * 
   * @returns {void}
   */
  animate() {
    if (this.offsetAnimation) {
      this.updateOffsetAnimation();
    }
    
    this.controls.update();
    
    if (this.animateCallback) {
      this.animateCallback();
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  /**
   * Handles viewport resize
   * 
   * @param {number} width - New width
   * @param {number} height - New height
   * @returns {void}
   */
  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.floor(width), Math.floor(height), false);
    this.labelRenderer.setSize(Math.floor(width), Math.floor(height));
  }

  /**
   * Fits the camera to show all objects in the scene
   * 
   * @param {number} paddingFactor - Multiplier for extra space around objects (default 1.5)
   * @returns {void}
   */
  fitCameraToScene(paddingFactor = 1.5) {
    const box = new THREE.Box3();
    
    // Calculate bounding box of all visible objects in graph group
    this.graphGroup.traverse((object) => {
      if (object.isMesh || object.isLine) {
        box.expandByObject(object);
      }
    });
    
    if (box.isEmpty()) {
      console.warn('Scene is empty, cannot fit camera');
      return;
    }
    
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Calculate the maximum dimension
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calculate distance based on field of view and aspect ratio
    const fov = this.camera.fov * (Math.PI / 180);
    const aspect = this.camera.aspect;
    
    // Calculate distance needed to fit the scene
    // We need to account for both vertical and horizontal FOV
    const vFOV = fov;
    const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);
    
    // Use the smaller FOV to ensure everything fits
    const effectiveFOV = Math.min(vFOV, hFOV);
    let cameraDistance = (maxDim / 2) / Math.tan(effectiveFOV / 2);
    
    // Apply padding
    cameraDistance *= paddingFactor;
    
    // Position camera to look at center from above and at an angle
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));
    this.camera.lookAt(center);
    
    // Update controls target to center
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * Animates graph group to center a target position at origin
   * 
   * @param {THREE.Vector3} targetPosition - Position to center
   * @param {number} duration - Animation duration in milliseconds (default 800)
   * @returns {void}
   */
  animateToNode(targetPosition, duration = 800) {
    
    // Calculate the offset needed to move target to origin
    const startPos = this.graphGroup.position.clone();
    const endPos = new THREE.Vector3(
      -targetPosition.x,
      -targetPosition.y,
      -targetPosition.z
    );
    
    this.offsetAnimation = {
      startPos,
      endPos,
      startTime: Date.now(),
      duration
    };
  }

  /**
   * Updates graph group position animation on each frame
   * 
   * @returns {void}
   */
  updateOffsetAnimation() {
    const elapsed = Date.now() - this.offsetAnimation.startTime;
    const progress = Math.min(elapsed / this.offsetAnimation.duration, 1);
    
    // Easing function (easeInOutCubic)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // Interpolate graph group position
    this.graphGroup.position.lerpVectors(
      this.offsetAnimation.startPos,
      this.offsetAnimation.endPos,
      eased
    );
    
    if (progress >= 1) {
      this.offsetAnimation = null;
    }
  }

  /**
   * Resets graph group to original centered position
   * 
   * @param {number} duration - Animation duration in milliseconds (default 800)
   * @returns {void}
   */
  resetScenePosition(duration = 800) {
    this.offsetAnimation = {
      startPos: this.graphGroup.position.clone(),
      endPos: new THREE.Vector3(0, 0, 0),
      startTime: Date.now(),
      duration
    };
  }

  /**
   * Cleans up resources
   * 
   * @returns {void}
   */
  dispose() {
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    if (this.labelRenderer.domElement.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
    }
  }
}
