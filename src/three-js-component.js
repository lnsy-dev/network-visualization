import * as THREE from 'three';
import DataroomElement from 'dataroom-js';

/**
 * A 3D component that renders a rotating wireframe cube.
 *
 * @class ThreeJSComponent
 * @extends DataroomElement
 */
class ThreeJSComponent extends DataroomElement {


  /**
   * Creates the geometry and adds it to the scene.
   * @returns {void}
   */
  buildScene() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: this.foregroundColor, wireframe: true });
    const cube = new THREE.Mesh(geometry, material);
    this.objectGroup.add(cube);
  }
  

  /**
   * Initializes the component, sets up the scene, camera, renderer, and cube.
   * @returns {void}
   */
  async initialize() {
    const width = this.clientWidth;
    const height = this.clientHeight;

    this.isDragging = false;

    // Create camera and scene
    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    this.camera.position.z = 1.5;
    this.scene = new THREE.Scene();

    // Create a group to hold the cube
    this.objectGroup = new THREE.Group();
    this.scene.add(this.objectGroup);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setAnimationLoop(this.animate.bind(this));

    const computedStyle = window.getComputedStyle(this);
    this.foregroundColor = computedStyle.color;
    this.backgroundColor = new THREE.Color(computedStyle.backgroundColor);
    this.renderer.setClearColor(this.backgroundColor);

    this.appendChild(this.renderer.domElement);

    this.buildScene();

    // Add interaction
    this.addInteraction();

    const initialScale = parseFloat(this.getAttribute('scale')) || 1.0;
    this.objectGroup.scale.set(initialScale, initialScale, initialScale);

    this.on('NODE-CHANGED', (detail) => {
      if (detail.attribute === 'scale') {
        const newScale = parseFloat(detail.newValue) || 1.0;
        this.objectGroup.scale.set(newScale, newScale, newScale);
      }
    });

    // Handle resizing
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }
    });
    this.resizeObserver.observe(this);
  }



  /**
   * The animation loop for the component. Handles rotation.
   * @returns {void}
   */
  animate() {
    if (!this.isDragging) {
      this.objectGroup.rotation.y += 0.001;
      this.objectGroup.rotation.x += 0.001;
    }
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Adds interaction handlers for the cube.
   * @returns {void}
   */
  addInteraction() {
    let previousMousePosition = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const deltaMove = {
          x: e.clientX - previousMousePosition.x,
          y: e.clientY - previousMousePosition.y
        };

        const rotationSpeed = 0.005;
        this.objectGroup.rotation.y += deltaMove.x * rotationSpeed;
        this.objectGroup.rotation.x += deltaMove.y * rotationSpeed;

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    this.renderer.domElement.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.renderer.domElement.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });
  }

  /**
   * Cleans up the component when it is removed from the DOM.
   * @returns {void}
   */
  disconnect() {
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
  }
}

customElements.define('three-js-component', ThreeJSComponent);