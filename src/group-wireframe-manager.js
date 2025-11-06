import * as THREE from 'three';

/**
 * GroupWireframeManager
 * 
 * Manages wireframe cubes that surround groups of nodes
 * 
 * @class GroupWireframeManager
 */
export default class GroupWireframeManager {
  /**
   * Creates a new GroupWireframeManager instance
   * 
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    this.groupWireframes = [];
  }

  /**
   * Creates wireframe cubes for all groups
   * 
   * @param {Array} groups - Array of group objects
   * @returns {void}
   */
  createWireframes(groups) {
    this.removeAll();

    groups.forEach(group => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.LineBasicMaterial({ 
        color: group.color || 0x888888, 
        linewidth: 1,
        transparent: true,
        opacity: 0.5
      });
      const edges = new THREE.EdgesGeometry(geometry);
      const wireframe = new THREE.LineSegments(edges, material);
      
      material.linecap = 'round';
      material.linejoin = 'round';
      
      this.scene.add(wireframe);
      
      this.groupWireframes.push({
        mesh: wireframe,
        group: group
      });
    });
  }

  /**
   * Updates wireframe positions and sizes based on node positions
   * Creates a single polygon outline around all nodes in the group
   * 
   * @param {Array} nodes - Array of node objects with position data
   * @returns {void}
   */
  update(nodes) {
    this.groupWireframes.forEach(({ mesh, group }) => {
      const groupNodes = nodes.filter(n => group.nodeIds.includes(n.id));
      
      if (groupNodes.length === 0) return;
      
      // Remove the old mesh
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      
      // Create axis-aligned boxes around each node
      const padding = 20;
      const boxes = [];
      
      groupNodes.forEach(node => {
        if (node.x !== undefined) {
          boxes.push({
            minX: node.x - padding,
            maxX: node.x + padding,
            minY: node.y - padding,
            maxY: node.y + padding,
            minZ: node.z - padding,
            maxZ: node.z + padding
          });
        }
      });
      
      // Find the bounding box of all boxes
      let globalMinX = Infinity, globalMaxX = -Infinity;
      let globalMinY = Infinity, globalMaxY = -Infinity;
      let globalMinZ = Infinity, globalMaxZ = -Infinity;
      
      boxes.forEach(box => {
        globalMinX = Math.min(globalMinX, box.minX);
        globalMaxX = Math.max(globalMaxX, box.maxX);
        globalMinY = Math.min(globalMinY, box.minY);
        globalMaxY = Math.max(globalMaxY, box.maxY);
        globalMinZ = Math.min(globalMinZ, box.minZ);
        globalMaxZ = Math.max(globalMaxZ, box.maxZ);
      });
      
      // Create a 3D voxel grid to mark occupied space
      const voxelSize = padding * 2; // Each voxel is the size of a box
      const voxelMap = new Map();
      
      /**
       * Gets voxel key for a position
       * 
       * @param {number} x - X coordinate
       * @param {number} y - Y coordinate
       * @param {number} z - Z coordinate
       * @returns {string} Voxel key
       */
      const getVoxelKey = (x, y, z) => `${x},${y},${z}`;
      
      /**
       * Checks if a voxel is occupied
       * 
       * @param {number} vx - Voxel X
       * @param {number} vy - Voxel Y
       * @param {number} vz - Voxel Z
       * @returns {boolean} True if occupied
       */
      const isVoxelOccupied = (vx, vy, vz) => {
        return voxelMap.has(getVoxelKey(vx, vy, vz));
      };
      
      // Mark all voxels that contain boxes
      const nodeVoxels = [];
      
      boxes.forEach(box => {
        const voxelX = Math.round((box.minX + box.maxX) / 2 / voxelSize);
        const voxelY = Math.round((box.minY + box.maxY) / 2 / voxelSize);
        const voxelZ = Math.round((box.minZ + box.maxZ) / 2 / voxelSize);
        
        nodeVoxels.push({ voxelX, voxelY, voxelZ });
        
        voxelMap.set(getVoxelKey(voxelX, voxelY, voxelZ), {
          x: voxelX * voxelSize,
          y: voxelY * voxelSize,
          z: voxelZ * voxelSize,
          size: voxelSize
        });
      });
      
      /**
       * Adds a corridor of voxels connecting two points
       * Uses Manhattan routing (move along one axis at a time)
       * 
       * @param {number} x1 - Start voxel X
       * @param {number} y1 - Start voxel Y
       * @param {number} z1 - Start voxel Z
       * @param {number} x2 - End voxel X
       * @param {number} y2 - End voxel Y
       * @param {number} z2 - End voxel Z
       * @returns {void}
       */
      const addCorridor = (x1, y1, z1, x2, y2, z2) => {
        // Move along X axis first
        const stepX = x1 < x2 ? 1 : -1;
        for (let x = x1; x !== x2; x += stepX) {
          const key = getVoxelKey(x, y1, z1);
          if (!voxelMap.has(key)) {
            voxelMap.set(key, {
              x: x * voxelSize,
              y: y1 * voxelSize,
              z: z1 * voxelSize,
              size: voxelSize
            });
          }
        }
        
        // Then move along Y axis
        const stepY = y1 < y2 ? 1 : -1;
        for (let y = y1; y !== y2; y += stepY) {
          const key = getVoxelKey(x2, y, z1);
          if (!voxelMap.has(key)) {
            voxelMap.set(key, {
              x: x2 * voxelSize,
              y: y * voxelSize,
              z: z1 * voxelSize,
              size: voxelSize
            });
          }
        }
        
        // Finally move along Z axis
        const stepZ = z1 < z2 ? 1 : -1;
        for (let z = z1; z !== z2; z += stepZ) {
          const key = getVoxelKey(x2, y2, z);
          if (!voxelMap.has(key)) {
            voxelMap.set(key, {
              x: x2 * voxelSize,
              y: y2 * voxelSize,
              z: z * voxelSize,
              size: voxelSize
            });
          }
        }
      };
      
      // Connect each node to its nearest neighbor to form a connected graph
      for (let i = 0; i < nodeVoxels.length; i++) {
        // Find nearest unconnected neighbor
        let minDist = Infinity;
        let nearestIdx = -1;
        
        for (let j = 0; j < nodeVoxels.length; j++) {
          if (i === j) continue;
          
          const dx = nodeVoxels[i].voxelX - nodeVoxels[j].voxelX;
          const dy = nodeVoxels[i].voxelY - nodeVoxels[j].voxelY;
          const dz = nodeVoxels[i].voxelZ - nodeVoxels[j].voxelZ;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = j;
          }
        }
        
        // Add corridor to nearest neighbor
        if (nearestIdx >= 0) {
          addCorridor(
            nodeVoxels[i].voxelX, nodeVoxels[i].voxelY, nodeVoxels[i].voxelZ,
            nodeVoxels[nearestIdx].voxelX, nodeVoxels[nearestIdx].voxelY, nodeVoxels[nearestIdx].voxelZ
          );
        }
      }
      
      // Store all exterior edges
      const edgeSet = new Set();
      
      /**
       * Adds an edge to the set
       * Normalizes direction to avoid duplicates
       * 
       * @param {number} x1 - Start X
       * @param {number} y1 - Start Y
       * @param {number} z1 - Start Z
       * @param {number} x2 - End X
       * @param {number} y2 - End Y
       * @param {number} z2 - End Z
       * @returns {void}
       */
      const addEdge = (x1, y1, z1, x2, y2, z2) => {
        // Normalize: smaller coordinates first
        let key;
        if (x1 < x2 || (x1 === x2 && y1 < y2) || (x1 === x2 && y1 === y2 && z1 < z2)) {
          key = `${x1.toFixed(2)},${y1.toFixed(2)},${z1.toFixed(2)},${x2.toFixed(2)},${y2.toFixed(2)},${z2.toFixed(2)}`;
        } else {
          key = `${x2.toFixed(2)},${y2.toFixed(2)},${z2.toFixed(2)},${x1.toFixed(2)},${y1.toFixed(2)},${z1.toFixed(2)}`;
        }
        edgeSet.add(key);
      };
      
      voxelMap.forEach((voxel, key) => {
        const [vx, vy, vz] = key.split(',').map(Number);
        const { x, y, z, size } = voxel;
        const half = size / 2;
        
        // Check each of the 6 faces
        // If the adjacent voxel is not occupied, add the face edges
        
        // Front face (-Z direction)
        if (!isVoxelOccupied(vx, vy, vz - 1)) {
          const minX = x - half, maxX = x + half;
          const minY = y - half, maxY = y + half;
          const z0 = z - half;
          
          addEdge(minX, minY, z0, maxX, minY, z0);
          addEdge(maxX, minY, z0, maxX, maxY, z0);
          addEdge(maxX, maxY, z0, minX, maxY, z0);
          addEdge(minX, maxY, z0, minX, minY, z0);
        }
        
        // Back face (+Z direction)
        if (!isVoxelOccupied(vx, vy, vz + 1)) {
          const minX = x - half, maxX = x + half;
          const minY = y - half, maxY = y + half;
          const z0 = z + half;
          
          addEdge(minX, minY, z0, maxX, minY, z0);
          addEdge(maxX, minY, z0, maxX, maxY, z0);
          addEdge(maxX, maxY, z0, minX, maxY, z0);
          addEdge(minX, maxY, z0, minX, minY, z0);
        }
        
        // Left face (-X direction)
        if (!isVoxelOccupied(vx - 1, vy, vz)) {
          const x0 = x - half;
          const minY = y - half, maxY = y + half;
          const minZ = z - half, maxZ = z + half;
          
          addEdge(x0, minY, minZ, x0, maxY, minZ);
          addEdge(x0, maxY, minZ, x0, maxY, maxZ);
          addEdge(x0, maxY, maxZ, x0, minY, maxZ);
          addEdge(x0, minY, maxZ, x0, minY, minZ);
        }
        
        // Right face (+X direction)
        if (!isVoxelOccupied(vx + 1, vy, vz)) {
          const x0 = x + half;
          const minY = y - half, maxY = y + half;
          const minZ = z - half, maxZ = z + half;
          
          addEdge(x0, minY, minZ, x0, maxY, minZ);
          addEdge(x0, maxY, minZ, x0, maxY, maxZ);
          addEdge(x0, maxY, maxZ, x0, minY, maxZ);
          addEdge(x0, minY, maxZ, x0, minY, minZ);
        }
        
        // Bottom face (-Y direction)
        if (!isVoxelOccupied(vx, vy - 1, vz)) {
          const minX = x - half, maxX = x + half;
          const y0 = y - half;
          const minZ = z - half, maxZ = z + half;
          
          addEdge(minX, y0, minZ, maxX, y0, minZ);
          addEdge(maxX, y0, minZ, maxX, y0, maxZ);
          addEdge(maxX, y0, maxZ, minX, y0, maxZ);
          addEdge(minX, y0, maxZ, minX, y0, minZ);
        }
        
        // Top face (+Y direction)
        if (!isVoxelOccupied(vx, vy + 1, vz)) {
          const minX = x - half, maxX = x + half;
          const y0 = y + half;
          const minZ = z - half, maxZ = z + half;
          
          addEdge(minX, y0, minZ, maxX, y0, minZ);
          addEdge(maxX, y0, minZ, maxX, y0, maxZ);
          addEdge(maxX, y0, maxZ, minX, y0, maxZ);
          addEdge(minX, y0, maxZ, minX, y0, minZ);
        }
      });
      
      // Convert all edges to array (no filtering)
      const edges = Array.from(edgeSet).map(edgeKey => {
        const coords = edgeKey.split(',').map(parseFloat);
        return {
          x1: coords[0], y1: coords[1], z1: coords[2],
          x2: coords[3], y2: coords[4], z2: coords[5]
        };
      });
      
      // Group edges by direction and plane
      const edgeGroups = new Map();
      
      edges.forEach(edge => {
        // Determine edge direction (which axis changes)
        let direction, plane;
        
        if (edge.x1 !== edge.x2 && edge.y1 === edge.y2 && edge.z1 === edge.z2) {
          // X-axis edge
          direction = 'x';
          plane = `${edge.y1.toFixed(2)},${edge.z1.toFixed(2)}`;
        } else if (edge.y1 !== edge.y2 && edge.x1 === edge.x2 && edge.z1 === edge.z2) {
          // Y-axis edge
          direction = 'y';
          plane = `${edge.x1.toFixed(2)},${edge.z1.toFixed(2)}`;
        } else if (edge.z1 !== edge.z2 && edge.x1 === edge.x2 && edge.y1 === edge.y2) {
          // Z-axis edge
          direction = 'z';
          plane = `${edge.x1.toFixed(2)},${edge.y1.toFixed(2)}`;
        } else {
          return; // Skip diagonal edges (shouldn't exist)
        }
        
        const key = `${direction}:${plane}`;
        if (!edgeGroups.has(key)) {
          edgeGroups.set(key, []);
        }
        edgeGroups.get(key).push(edge);
      });
      
      // Merge collinear edges in each group
      const mergedEdges = [];
      
      edgeGroups.forEach((groupEdges, key) => {
        const [direction] = key.split(':');
        
        // Build a graph of connected segments
        const segments = [...groupEdges];
        const used = new Set();
        
        for (let i = 0; i < segments.length; i++) {
          if (used.has(i)) continue;
          
          let current = segments[i];
          used.add(i);
          
          // Try to extend this segment by finding connected collinear segments
          let extended = true;
          while (extended) {
            extended = false;
            
            for (let j = 0; j < segments.length; j++) {
              if (used.has(j)) continue;
              
              const other = segments[j];
              const tolerance = 0.01;
              
              // Check if segments are collinear and connected
              if (direction === 'x') {
                if (Math.abs(current.x2 - other.x1) < tolerance) {
                  current = { ...current, x2: other.x2 };
                  used.add(j);
                  extended = true;
                } else if (Math.abs(current.x1 - other.x2) < tolerance) {
                  current = { ...current, x1: other.x1 };
                  used.add(j);
                  extended = true;
                }
              } else if (direction === 'y') {
                if (Math.abs(current.y2 - other.y1) < tolerance) {
                  current = { ...current, y2: other.y2 };
                  used.add(j);
                  extended = true;
                } else if (Math.abs(current.y1 - other.y2) < tolerance) {
                  current = { ...current, y1: other.y1 };
                  used.add(j);
                  extended = true;
                }
              } else if (direction === 'z') {
                if (Math.abs(current.z2 - other.z1) < tolerance) {
                  current = { ...current, z2: other.z2 };
                  used.add(j);
                  extended = true;
                } else if (Math.abs(current.z1 - other.z2) < tolerance) {
                  current = { ...current, z1: other.z1 };
                  used.add(j);
                  extended = true;
                }
              }
            }
          }
          
          mergedEdges.push(current);
        }
      });
      
      // Convert merged edges to vertices
      const vertices = [];
      mergedEdges.forEach(edge => {
        vertices.push(edge.x1, edge.y1, edge.z1);
        vertices.push(edge.x2, edge.y2, edge.z2);
      });
      
      // Create geometry from vertices
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      // Create line segments
      const material = new THREE.LineBasicMaterial({ 
        color: group.color || 0x888888, 
        linewidth: 1,
        transparent: true,
        opacity: 0.5
      });
      
      const newMesh = new THREE.LineSegments(geometry, material);
      this.scene.add(newMesh);
      
      // Calculate group center for metadata display
      let centerX = 0, centerY = 0, centerZ = 0;
      groupNodes.forEach(node => {
        centerX += node.x;
        centerY += node.y;
        centerZ += node.z;
      });
      
      group.center = { 
        x: centerX / groupNodes.length, 
        y: centerY / groupNodes.length, 
        z: centerZ / groupNodes.length 
      };
      
      // Store reference to new mesh for future updates
      const wireframeIndex = this.groupWireframes.findIndex(w => w.group === group);
      if (wireframeIndex >= 0) {
        this.groupWireframes[wireframeIndex].mesh = newMesh;
      }
    });
  }

  /**
   * Removes all wireframes from the scene
   * 
   * @returns {void}
   */
  removeAll() {
    this.groupWireframes.forEach(wireframe => {
      this.scene.remove(wireframe.mesh);
    });
    this.groupWireframes = [];
  }

  /**
   * Gets all wireframe objects
   * 
   * @returns {Array} Array of wireframe objects
   */
  getWireframes() {
    return this.groupWireframes;
  }
}
