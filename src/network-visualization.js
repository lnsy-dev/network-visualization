import * as THREE from 'three';
import DataroomElement from 'dataroom-js';
import { updatePhysics } from './physics.js';

class NetworkVisualization extends DataroomElement {
  async initialize() {
    const width = this.clientWidth;
    const height = this.clientHeight;
    const aspect = width / height;
    const frustumSize = 100;

    this.isDragging = false;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.5;
    this.mouse = new THREE.Vector2();
    this.orbitCenter = new THREE.Vector3();
    this.selectedObject = null;

    this.camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 1000);
    this.camera.position.z = 50;
    this.scene = new THREE.Scene();

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.objectGroup = new THREE.Group();
    this.pivot.add(this.objectGroup);

    // Set a fixed rotation for an angled/trimetric view
    this.objectGroup.rotation.x = Math.PI / 6;
    this.objectGroup.rotation.y = -Math.PI / 6;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setAnimationLoop(this.animate.bind(this));

    const computedStyle = window.getComputedStyle(this);
    this.foregroundColor = computedStyle.color;
    this.backgroundColor = new THREE.Color(computedStyle.backgroundColor);
    this.renderer.setClearColor(this.backgroundColor);

    this.appendChild(this.renderer.domElement);

    this.labelContainer = document.createElement('div');
    this.labelContainer.style.position = 'absolute';
    this.labelContainer.style.top = '0';
    this.labelContainer.style.left = '0';
    this.labelContainer.style.width = '100%';
    this.labelContainer.style.height = '100%';
    this.labelContainer.style.pointerEvents = 'none';
    this.appendChild(this.labelContainer);

    const style = document.createElement('style');
    style.textContent = `
      .network-label {
        position: absolute;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-family: sans-serif;
        font-size: 12px;
        pointer-events: auto;
        transition: all 0.3s ease-in-out;
        white-space: nowrap;
        display: none;
      }

      .network-label.expanded {
        top: 0 !important;
        left: 0 !important;
        width: 33% !important;
        height: 100% !important;
        transform: none !important;
        background: rgba(0, 0, 0, 0.8);
        padding: 20px;
        white-space: normal;
        overflow: auto;
        display: block !important;
      }
    `;
    this.appendChild(style);

    this.buildGraph();
    
    this.calculateGraphCenter();
    this.pivot.position.copy(this.orbitCenter);
    this.objectGroup.position.copy(this.orbitCenter).negate();

    this.addInteraction();

    const initialScale = parseFloat(this.getAttribute('scale')) || 1.0;
    this.objectGroup.scale.set(initialScale, initialScale, initialScale);

    this.on('NODE-CHANGED', (detail) => {
      if (detail.attribute === 'scale') {
        const newScale = parseFloat(detail.newValue) || 1.0;
        this.objectGroup.scale.set(newScale, newScale, newScale);
      }
    });

    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const aspect = width / height;
        const frustumSize = 100;
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }
    });
    this.resizeObserver.observe(this);

    // Zoom to fit after a short delay to allow physics to settle
    setTimeout(() => this.zoomToFit(), 500);
  }

  buildGraph() {
    this.nodes = [];
    this.edges = [];

    const nodeElements = Array.from(this.querySelectorAll('network-node'));
    const edgeElements = Array.from(this.querySelectorAll('network-edge'));

    nodeElements.forEach(el => {
      const node = {
        id: el.getAttribute('id'),
        name: el.getAttribute('name'),
        content: el.innerHTML,
        el: el,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        velocity: new THREE.Vector3(),
        force: new THREE.Vector3(),
        mass: 1
      };

      const geometry = new THREE.ConeGeometry(1, 2, 4);
      const material = new THREE.MeshBasicMaterial({ color: this.foregroundColor, wireframe: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.position);
      node.mesh = mesh;
      this.objectGroup.add(mesh);
      this.nodes.push(node);

      const label = document.createElement('div');
      label.className = 'network-label';
      label.textContent = node.name;
      node.label = label;
      this.labelContainer.appendChild(label);
    });

    edgeElements.forEach(el => {
      const sourceId = el.getAttribute('source');
      const targetId = el.getAttribute('target');
      const source = this.nodes.find(n => n.id === sourceId);
      const target = this.nodes.find(n => n.id === targetId);

      if (source && target) {
        const edge = {
          source,
          target,
          el: el,
          name: el.getAttribute('name'),
          content: el.innerHTML
        };

        const material = new THREE.LineBasicMaterial({ color: this.foregroundColor, transparent: true, opacity: 0.5 });
        const geometry = new THREE.BufferGeometry().setFromPoints([source.position, target.position]);
        const line = new THREE.Line(geometry, material);
        edge.line = line;
        this.objectGroup.add(line);
        this.edges.push(edge);

        if (edge.name) {
          const label = document.createElement('div');
          label.className = 'network-label';
          label.textContent = edge.name;
          edge.label = label;
          this.labelContainer.appendChild(label);
        }
      }
    });
  }

  animate() {
    updatePhysics(this.nodes, this.edges);
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  }

  updateLabels() {
    const width = this.clientWidth;
    const height = this.clientHeight;
    const zoomLevel = this.camera.zoom;
    const labelsZoomLevel = parseFloat(this.getAttribute('labels-zoom-level')) || 1.5;

    const showLabels = zoomLevel >= labelsZoomLevel;

    this.nodes.forEach(node => {
      if (node.label.classList.contains('expanded')) {
        return;
      }
      if (showLabels) {
        node.label.style.display = 'block';
        const vector = new THREE.Vector3();
        node.mesh.getWorldPosition(vector);
        vector.project(this.camera);

        const x = (vector.x * 0.5 + 0.5) * width;
        const y = (vector.y * -0.5 + 0.5) * height;

        node.label.style.left = `${x}px`;
        node.label.style.top = `${y}px`;
        node.label.style.transform = 'translate(-50%, -150%)';
      } else {
        node.label.style.display = 'none';
      }
    });

    this.edges.forEach(edge => {
      if (edge.label && edge.label.classList.contains('expanded')) {
        return;
      }
      if (showLabels && edge.label) {
        edge.label.style.display = 'block';
        const start = new THREE.Vector3();
        edge.source.mesh.getWorldPosition(start);
        const end = new THREE.Vector3();
        edge.target.mesh.getWorldPosition(end);

        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        midPoint.project(this.camera);

        const x = (midPoint.x * 0.5 + 0.5) * width;
        const y = (midPoint.y * -0.5 + 0.5) * height;

        edge.label.style.left = `${x}px`;
        edge.label.style.top = `${y}px`;
        edge.label.style.transform = 'translate(-50%, -50%)';
      } else if (edge.label) {
        edge.label.style.display = 'none';
      }
    });
  }

  calculateGraphCenter() {
    if (this.nodes.length === 0) {
        this.orbitCenter.set(0, 0, 0);
        return;
    }
    const boundingBox = new THREE.Box3();
    this.nodes.forEach(node => {
      boundingBox.expandByPoint(node.position);
    });
    boundingBox.getCenter(this.orbitCenter);
  }

  handleSelection(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects([...this.nodes.map(n => n.mesh), ...this.edges.map(e => e.line)]);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const selectedNode = this.nodes.find(n => n.mesh === intersectedObject);
        const selectedEdge = this.edges.find(e => e.line === intersectedObject);
        const newSelection = selectedNode || selectedEdge;

        if (this.selectedObject && this.selectedObject !== newSelection) {
            if (this.selectedObject.mesh) { // is node
                this.selectedObject.mesh.material.color.set(this.foregroundColor);
            } else { // is edge
                this.selectedObject.line.material.opacity = 0.5;
            }
            if (this.selectedObject.label) {
                this.selectedObject.label.textContent = this.selectedObject.name;
                this.selectedObject.label.classList.remove('expanded');
            }
        }
        
        if (newSelection) {
            this.selectedObject = newSelection;
            if (this.selectedObject.mesh) { // is node
                this.selectedObject.mesh.material.color.set(0xff0000); // Highlight
                this.pivot.position.copy(this.selectedObject.position);
                this.objectGroup.position.copy(this.selectedObject.position).negate();
            } else { // is edge
                this.selectedObject.line.material.opacity = 1.0;
                const midPoint = new THREE.Vector3().addVectors(this.selectedObject.source.position, this.selectedObject.target.position).multiplyScalar(0.5);
                this.pivot.position.copy(midPoint);
                this.objectGroup.position.copy(midPoint).negate();
            }
            if (this.selectedObject.label) {
                this.selectedObject.label.innerHTML = this.selectedObject.content;
                this.selectedObject.label.classList.add('expanded');
            }
        }
    } else {
        if (this.selectedObject) {
            if (this.selectedObject.mesh) { // is node
                this.selectedObject.mesh.material.color.set(this.foregroundColor);
            } else { // is edge
                this.selectedObject.line.material.opacity = 0.5;
            }
            if (this.selectedObject.label) {
                this.selectedObject.label.textContent = this.selectedObject.name;
                this.selectedObject.label.classList.remove('expanded');
            }
            this.selectedObject = null;
        }
        
        this.calculateGraphCenter();
        this.pivot.position.copy(this.orbitCenter);
        this.objectGroup.position.copy(this.orbitCenter).negate();
    }
  }

  addInteraction() {
    let previousMousePosition = { x: 0, y: 0 };
    const dragThreshold = 5;
    let mouseDown = false;
    let dragStarted = false;

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      mouseDown = true;
      dragStarted = false;
      this.isDragging = false;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (mouseDown) {
        const deltaX = Math.abs(e.clientX - previousMousePosition.x);
        const deltaY = Math.abs(e.clientY - previousMousePosition.y);

        if (!dragStarted && (deltaX > dragThreshold || deltaY > dragThreshold)) {
            dragStarted = true;
            this.isDragging = true;
        }

        if (this.isDragging) {
            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };

            const rotationSpeed = 0.005;

            this.pivot.rotation.y += deltaMove.x * rotationSpeed;
            this.pivot.rotation.x += deltaMove.y * rotationSpeed;

            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
      }
    });

    this.renderer.domElement.addEventListener('mouseup', (e) => {
      if (mouseDown && !dragStarted) {
        this.handleSelection(e);
      }
      mouseDown = false;
      dragStarted = false;
      this.isDragging = false;
    });

    this.renderer.domElement.addEventListener('mouseleave', () => {
      mouseDown = false;
      dragStarted = false;
      this.isDragging = false;
    });

    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.05;
      const zoomFactor = 1 - e.deltaY * zoomSpeed;
      this.camera.zoom *= zoomFactor;
      this.camera.zoom = Math.max(0.1, Math.min(this.camera.zoom, 10));
      this.camera.updateProjectionMatrix();
    });
  }

  disconnect() {
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
  }

  zoomToFit() {
    if (this.nodes.length === 0) {
      return;
    }

    const boundingBox = new THREE.Box3();
    this.objectGroup.updateWorldMatrix(true, false);
    this.nodes.forEach(node => {
      const worldPosition = node.mesh.getWorldPosition(new THREE.Vector3());
      boundingBox.expandByPoint(worldPosition);
    });

    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    this.camera.position.x = center.x;
    this.camera.position.y = center.y;

    const padding = 1.2;
    const requiredWidth = size.x * padding;
    const requiredHeight = size.y * padding;

    const frustumWidth = this.camera.right - this.camera.left;
    const frustumHeight = this.camera.top - this.camera.bottom;

    if (requiredWidth === 0 && requiredHeight === 0) {
        this.camera.zoom = 10;
        this.camera.updateProjectionMatrix();
        return;
    }

    const zoomX = requiredWidth > 0 ? frustumWidth / requiredWidth : Infinity;
    const zoomY = requiredHeight > 0 ? frustumHeight / requiredHeight : Infinity;

    this.camera.zoom = Math.min(zoomX, zoomY);
    this.camera.updateProjectionMatrix();
  }
}

customElements.define('network-visualization', NetworkVisualization);
