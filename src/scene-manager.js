import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { computeFitDistance, computeIntroStartPosition, parseBackgroundColor } from './scene-logic.js';

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

    // The viewport wrapper owns the clipping. Keeping overflow: hidden here
    // (instead of on the host element) lets overlays such as the metadata
    // aside extend past the element's bounds without being cut off.
    this.viewportElement = document.createElement('div');
    this.viewportElement.classList.add('network-canvas');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    const clearColor = parseBackgroundColor(backgroundColor);
    this.renderer.setClearColor(new THREE.Color(clearColor.color), clearColor.alpha);
    this.viewportElement.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.classList.add('network-labels');
    this.viewportElement.appendChild(this.labelRenderer.domElement);

    this.container.appendChild(this.viewportElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 1.2;

    this.animateCallback = null;
    this.cameraAnimation = null;

    // Default viewing direction used when focusing on a node.
    this.defaultViewDirection = new THREE.Vector3(1, 1, 1).normalize();
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
    if (this.cameraAnimation) {
      this.updateCameraAnimation();
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
    this.renderer.setSize(Math.floor(width), Math.floor(height));
    this.labelRenderer.setSize(Math.floor(width), Math.floor(height));
  }

  /**
   * Fits the camera to show all objects in the scene
   *
   * @param {number} paddingFactor - Multiplier for extra space around objects (default 1.5)
   * @returns {void}
   */
  fitCameraToScene(paddingFactor = 1.5) {
    this.fitCameraToSceneWithInsets(
      { top: 0, right: 0, bottom: 0, left: 0 },
      paddingFactor
    );
  }

  /**
   * Fits the camera to show all objects in the scene while respecting viewport insets
   * reserved for overlays and sidebars.
   *
   * Instead of using setViewOffset (which can clip CSS2D labels and is easy to misuse
   * without a matching renderer viewport), the camera is translated so the graph is
   * centered in the inset-safe rectangle and the distance is computed for that
   * rectangle's dimensions.
   *
   * @param {{top: number, right: number, bottom: number, left: number}} insets - Viewport insets in pixels
   * @param {number} paddingFactor - Multiplier for extra space around objects (default 1.5)
   * @returns {void}
   */
  fitCameraToSceneWithInsets(insets, paddingFactor = 1.7) {
    const pose = this.computeFitCameraPose(insets, paddingFactor);
    if (!pose) return;

    this.applyCameraPose(pose);
  }

  /**
   * Animates the camera from a top-down intro position to the pose that fits
   * the entire graph inside the inset-safe viewport.
   *
   * The camera is placed immediately at the intro position (nearly directly
   * above the graph, farther out than the fit distance) and then tilts and
   * zooms in to the final fit pose, so the whole graph stays visible during
   * the flight.
   *
   * @param {{top: number, right: number, bottom: number, left: number}} insets - Viewport insets in pixels
   * @param {Object} [options] - Animation options
   * @param {number} [options.paddingFactor=1.35] - Fit padding multiplier for the final pose
   * @param {number} [options.duration=900] - Animation duration in milliseconds
   * @param {number} [options.introDistanceScale=1.5] - Intro start distance as a multiple of the fit distance
   * @returns {void}
   */
  animateCameraToSceneWithInsets(insets, options = {}) {
    const {
      paddingFactor = 1.5,
      duration = 900,
      introDistanceScale = 1.5,
    } = options;

    const pose = this.computeFitCameraPose(insets, paddingFactor);
    if (!pose) return;

    const fitDistance = pose.position.distanceTo(pose.target);
    const introPosition = computeIntroStartPosition(pose.target, fitDistance, introDistanceScale);

    // Snap to the intro pose, then fly to the fit pose.
    this.camera.position.set(introPosition.x, introPosition.y, introPosition.z);
    this.controls.target.copy(pose.target);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(pose.target);

    this.cameraAnimation = {
      startCameraPos: this.camera.position.clone(),
      endCameraPos: pose.position,
      startTarget: this.controls.target.clone(),
      endTarget: pose.target,
      startTime: Date.now(),
      duration,
    };
  }

  /**
   * Computes the camera pose (position and target) that fits the whole graph
   * into the inset-safe viewport.
   *
   * Instead of using setViewOffset (which can clip CSS2D labels and is easy to misuse
   * without a matching renderer viewport), the camera is translated so the graph is
   * centered in the inset-safe rectangle and the distance is computed for that
   * rectangle's dimensions.
   *
   * @param {{top: number, right: number, bottom: number, left: number}} insets - Viewport insets in pixels
   * @param {number} paddingFactor - Multiplier for extra space around objects
   * @returns {{position: THREE.Vector3, target: THREE.Vector3}|null} The fit pose, or null when the scene is empty
   */
  computeFitCameraPose(insets, paddingFactor) {
    const box = this.computeGraphBoundingBox();

    if (box.isEmpty()) {
      console.warn('Scene is empty, cannot fit camera');
      return null;
    }
    const dbgSize = box.getSize(new THREE.Vector3());



    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Calculate the maximum dimension
    const maxDim = Math.max(size.x, size.y, size.z);

    const fullWidth = this.container.clientWidth;
    const fullHeight = this.container.clientHeight;
    const containerSize = { width: fullWidth, height: fullHeight };

    const cameraDistance = computeFitDistance(
      maxDim,
      insets,
      containerSize,
      this.camera.fov,
      paddingFactor
    );

    // Labels (CSS2DRenderer) and meshes clip beyond the far plane, so it must
    // always contain the whole fitted graph with margin to spare.
    const requiredFar = cameraDistance + maxDim * 2;
    if (requiredFar > this.camera.far) {
      this.camera.far = requiredFar;
      this.camera.updateProjectionMatrix();
    }

    // Position camera to look at the graph center from the default angle.
    const direction = this.defaultViewDirection.clone().normalize();
    const basePosition = center.clone().add(direction.multiplyScalar(cameraDistance));

    // Translate the camera (and its target) so the projection center lands on the
    // center of the inset-safe rectangle. This keeps the graph out of overlays such
    // as the HUD without clipping or off-axis projection artifacts.
    const safeWidth = Math.max(1, fullWidth - insets.left - insets.right);
    const safeHeight = Math.max(1, fullHeight - insets.top - insets.bottom);
    const safeCenterX = insets.left + safeWidth / 2;
    const safeCenterY = insets.top + safeHeight / 2;
    const pixelOffsetX = safeCenterX - fullWidth / 2;
    const pixelOffsetY = safeCenterY - fullHeight / 2;

    const vFOV = this.camera.fov * (Math.PI / 180);
    const worldHeight = 2 * cameraDistance * Math.tan(vFOV / 2);
    const pixelToWorld = worldHeight / fullHeight;

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, direction).normalize();
    const cameraUp = new THREE.Vector3().crossVectors(direction, right).normalize();

    // A positive screen offset requires a camera translation in the opposite
    // direction, so negate the pixel offsets when converting to world units.
    const lateralOffset = new THREE.Vector3()
      .addScaledVector(right, -pixelOffsetX * pixelToWorld)
      .addScaledVector(cameraUp, -pixelOffsetY * pixelToWorld);

    const target = center.clone().add(lateralOffset);

    return {
      position: basePosition.clone().add(lateralOffset),
      target,
    };
  }

  /**
   * Applies a camera pose immediately and syncs the orbit controls.
   *
   * @param {{position: THREE.Vector3, target: THREE.Vector3}} pose - Pose to apply
   * @returns {void}
   */
  applyCameraPose(pose) {
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
    this.camera.clearViewOffset();

    // Update controls target to match the shifted view center.
    this.controls.target.copy(pose.target);
    this.controls.update();
  }

  /**
   * Computes the bounding box of all graph objects, including label anchor points.
   *
   * @returns {THREE.Box3} Bounding box of the graph group
   */
  computeGraphBoundingBox() {
    const box = new THREE.Box3();

    // Before the first render no world matrices have been computed, which
    // would collapse every mesh's contribution to the origin. Force a full
    // update so the box reflects the real layout.
    this.graphGroup.updateMatrixWorld(true);

    this.graphGroup.traverse((object) => {
      if (object.isMesh || object.isLine) {
        box.expandByObject(object);
      } else if (object.isCSS2DObject) {
        // Labels are HTML overlays; include their anchor so they are not clipped.
        box.expandByPoint(
          new THREE.Vector3().setFromMatrixPosition(object.matrixWorld)
        );
      }
    });

    return box;
  }

  /**
   * Computes the camera distance required to fit the entire graph bounding box
   * into the current inset-safe viewport.
   *
   * @param {THREE.Box3} box - Bounding box to fit
   * @param {number} paddingFactor - Multiplier for extra space around objects
   * @returns {number} Required camera distance
   */
  computeGraphFitDistance(box, paddingFactor = 1.7) {
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const insets = this.insets || { top: 0, right: 0, bottom: 0, left: 0 };

    return computeFitDistance(
      maxDim,
      insets,
      { width: this.container.clientWidth, height: this.container.clientHeight },
      this.camera.fov,
      paddingFactor
    );
  }

  /**
   * Animates the camera to focus on a target position while keeping every node visible.
   *
   * The camera rotates to the default isometric direction and zooms to a distance
   * calculated from the full graph bounding box.
   *
   * @param {THREE.Vector3} targetPosition - Position to focus on
   * @param {number} duration - Animation duration in milliseconds (default 800)
   * @returns {void}
   */
  animateCameraToNode(targetPosition, duration = 800) {
    const box = this.computeGraphBoundingBox();

    if (box.isEmpty()) {
      console.warn('Scene is empty, cannot animate camera to node');
      return;
    }

    const cameraDistance = this.computeGraphFitDistance(box, 1.7);
    const direction = this.defaultViewDirection.clone();
    const endCameraPos = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y,
      targetPosition.z
    ).add(direction.multiplyScalar(cameraDistance));

    this.cameraAnimation = {
      startCameraPos: this.camera.position.clone(),
      endCameraPos,
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
      startTime: Date.now(),
      duration,
    };
  }

  /**
   * Animates the camera back to a view that shows the entire graph.
   *
   * @param {number} duration - Animation duration in milliseconds (default 800)
   * @returns {void}
   */
  animateCameraToFitScene(duration = 800) {
    const box = this.computeGraphBoundingBox();

    if (box.isEmpty()) {
      console.warn('Scene is empty, cannot animate camera to fit scene');
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const cameraDistance = this.computeGraphFitDistance(box, 1.7);
    const direction = this.defaultViewDirection.clone();
    const endCameraPos = center.clone().add(direction.multiplyScalar(cameraDistance));

    this.cameraAnimation = {
      startCameraPos: this.camera.position.clone(),
      endCameraPos,
      startTarget: this.controls.target.clone(),
      endTarget: center,
      startTime: Date.now(),
      duration,
    };
  }

  /**
   * Updates camera position and controls target animation on each frame.
   *
   * @returns {void}
   */
  updateCameraAnimation() {
    const elapsed = Date.now() - this.cameraAnimation.startTime;
    const progress = Math.min(elapsed / this.cameraAnimation.duration, 1);

    // Easing function (easeInOutCubic)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    this.camera.position.lerpVectors(
      this.cameraAnimation.startCameraPos,
      this.cameraAnimation.endCameraPos,
      eased
    );

    this.controls.target.lerpVectors(
      this.cameraAnimation.startTarget,
      this.cameraAnimation.endTarget,
      eased
    );

    if (progress >= 1) {
      this.cameraAnimation = null;
    }
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
