/**
 * MetadataDisplay
 * 
 * Manages the display of metadata for selected nodes and groups
 * 
 * @class MetadataDisplay
 */
export default class MetadataDisplay {
  /**
   * Creates a new MetadataDisplay instance
   * 
   * @param {HTMLElement} container - Container element for metadata
   * @param {Function} createElement - Function to create elements (from DataroomElement)
   */
  constructor(container, createElement) {
    this.container = container;
    this.createElement = createElement;
  }

  /**
   * Removes all metadata displays
   * 
   * @returns {void}
   */
  clear() {
    [...this.container.querySelectorAll('.selected-node-metadata')]
      .forEach(node => {
        node.remove();
      });
  }

  /**
   * Displays metadata for a selected node
   * 
   * @param {Object} node - The selected node object
   * @param {Array} nodes - All nodes in the graph
   * @param {Array} links - All links in the graph
   * @param {Function} onNodeClick - Callback when a connected node is clicked
   * @returns {void}
   */
  showNodeMetadata(node, nodes, links, onNodeClick) {
    this.clear();
    
    const metadata_container = this.createElement('div', {class:'selected-node-metadata'});
    
    if(node.content && node.content.length > 0){
      this.createElement('div', {class:'node-content', content:node.content}, metadata_container);
    }
    
    const connectedNodeIds = new Set();
    
    links.forEach(link => {
      if(link.source === node.id){
        connectedNodeIds.add(link.target);
      } else if(link.target === node.id){
        connectedNodeIds.add(link.source);
      }
    });
    
    if(connectedNodeIds.size > 0){
      const connections_container = this.createElement('div', {class:'connected-nodes'}, metadata_container);
      this.createElement('h3', {content:'Connected Nodes'}, connections_container);
      
      connectedNodeIds.forEach(nodeId => {
        const connectedNode = nodes.find(n => n.id === nodeId);
        
        if(connectedNode){
          const node_div = this.createElement('div', {
            class:'connected-node',
            content: connectedNode.name || connectedNode.id
          }, connections_container);
          
          node_div.addEventListener('click', () => {
            onNodeClick(nodeId);
          });
        }
      });
    }

    const connectedNodeNames = Array.from(connectedNodeIds).map(nodeId => {
      const connectedNode = nodes.find(n => n.id === nodeId);
      return connectedNode ? (connectedNode.name || connectedNode.id) : nodeId;
    });

    this.container.event('metadata-shown', {
      title: node.name || node.id,
      content: node.content || '',
      links: connectedNodeNames
    });
  }

  /**
   * Displays metadata for a selected group
   * 
   * @param {Object} group - The selected group object
   * @param {Array} nodes - All nodes in the graph
   * @param {Function} onNodeClick - Callback when a member node is clicked
   * @returns {void}
   */
  showGroupMetadata(group, nodes, onNodeClick) {
    this.clear();
    
    const metadata_container = this.createElement('div', {class:'selected-node-metadata'});
    
    if(group.content && group.content.length > 0){
      this.createElement('div', {class:'node-content', content:group.content}, metadata_container);
    }
    
    const memberNames = [];
    
    if(group.nodeIds && group.nodeIds.length > 0){
      const members_container = this.createElement('div', {class:'connected-nodes'}, metadata_container);
      this.createElement('h3', {content:'Group Members'}, members_container);
      
      group.nodeIds.forEach(nodeId => {
        const memberNode = nodes.find(n => n.id === nodeId);
        
        if(memberNode){
          memberNames.push(memberNode.name || memberNode.id);
          
          const node_div = this.createElement('div', {
            class:'connected-node',
            content: memberNode.name || memberNode.id
          }, members_container);
          
          node_div.addEventListener('click', () => {
            onNodeClick(nodeId);
          });
        }
      });
    }

    this.container.event('metadata-shown', {
      title: group.name || group.id,
      content: group.content || '',
      links: memberNames
    });
  }
}
