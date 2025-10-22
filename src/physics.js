import * as THREE from 'three';

export function updatePhysics(nodes, edges) {
  const repulsionStrength = 0.1;
  const attractionStrength = 0.05;
  const idealEdgeLength = 10;
  const damping = 0.95;

  // Reset forces
  nodes.forEach(node => {
    node.force.set(0, 0, 0);
  });

  // Calculate repulsion forces
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const direction = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
      const distance = direction.length();
      if (distance > 0) {
        const force = direction.normalize().multiplyScalar(repulsionStrength / (distance * distance));
        nodeA.force.add(force);
        nodeB.force.sub(force);
      }
    }
  }

  // Calculate attraction forces
  edges.forEach(edge => {
    const direction = new THREE.Vector3().subVectors(edge.target.position, edge.source.position);
    const distance = direction.length();
    if (distance > 0) {
      const force = direction.normalize().multiplyScalar((distance - idealEdgeLength) * attractionStrength);
      edge.source.force.add(force);
      edge.target.force.sub(force);
    }
  });

  // Update positions
  nodes.forEach(node => {
    node.velocity.add(node.force);
    node.velocity.multiplyScalar(damping);
    node.position.add(node.velocity);
    node.mesh.position.copy(node.position);
  });

  // Update edges
  edges.forEach(edge => {
    edge.line.geometry.setFromPoints([edge.source.position, edge.target.position]);
  });
}