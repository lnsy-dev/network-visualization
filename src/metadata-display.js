import { getConnectedNodeNames, getGroupMemberNames } from './metadata-logic.js';

/**
 * Default text shown when no node or group is selected and no
 * <network-label> element is provided.
 *
 * @constant {string}
 */
const DEFAULT_EMPTY_STATE = 'Select a node or group to see details.';

/**
 * MetadataDisplay
 *
 * Manages the built-in left-sidebar HUD and emits metadata events for selected
 * nodes and groups. When the `no-hud` option is enabled, only the event is
 * emitted and no internal HUD is rendered.
 *
 * @class MetadataDisplay
 */
export default class MetadataDisplay {
  /**
   * Creates a new MetadataDisplay instance
   *
   * @param {HTMLElement} container - Container element for metadata
   * @param {Function} createElement - Function to create elements (from DataroomElement)
   * @param {boolean} noHud - If true, skip building the internal HUD
   */
  constructor(container, createElement, noHud = false) {
    this.container = container;
    this.createElement = createElement;
    this.noHud = noHud;
    this.hudElement = null;
    this.contentElement = null;

    if (!noHud) {
      this.createHud();
    }
  }

  /**
   * Creates the built-in HUD sidebar.
   *
   * @returns {void}
   */
  createHud() {
    this.hudElement = this.createElement('aside', {
      class: 'network-hud',
      'aria-label': 'Node metadata',
    });

    this.contentElement = this.createElement('div', {
      class: 'network-hud-content selected-node-metadata',
    }, this.hudElement);

    this.showEmptyState();
  }

  /**
   * Returns the HTML to display when no node or group is selected.
   *
   * Reads the contents of the first <network-label> child. If none exists or
   * it is empty, falls back to the default text.
   *
   * @returns {string} HTML string for the empty state
   */
  getEmptyStateHtml() {
    const label = this.container.querySelector('network-label');
    if (label && label.innerHTML.trim()) {
      return label.innerHTML.trim();
    }

    return DEFAULT_EMPTY_STATE;
  }

  /**
   * Shows the empty-state message in the HUD.
   *
   * @returns {void}
   */
  showEmptyState() {
    if (!this.contentElement) return;

    this.contentElement.innerHTML = this.getEmptyStateHtml();
  }

  /**
   * Clears the HUD back to the empty state.
   *
   * @returns {void}
   */
  clear() {
    if (!this.contentElement) return;

    this.showEmptyState();
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
    const connectedNodeNames = getConnectedNodeNames(node.id, links, nodes);

    this.container.event('metadata-shown', {
      title: node.name || node.id,
      content: node.content || '',
      links: connectedNodeNames,
    });

    if (this.noHud || !this.contentElement) return;

    this.contentElement.innerHTML = '';
    this.renderContent(node.content);
    this.renderConnectedNodes(connectedNodeNames, nodes, onNodeClick);
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
    const memberNames = getGroupMemberNames(group, nodes);

    this.container.event('metadata-shown', {
      title: group.name || group.id,
      content: group.content || '',
      links: memberNames,
    });

    if (this.noHud || !this.contentElement) return;

    this.contentElement.innerHTML = '';
    this.renderContent(group.content);
    this.renderGroupMembers(memberNames, nodes, onNodeClick);
  }

  /**
   * Renders HTML content in the HUD.
   *
   * @param {string} content - HTML content string
   * @returns {void}
   */
  renderContent(content) {
    if (!content || content.length === 0) return;

    this.createElement('div', { class: 'node-content', content }, this.contentElement);
  }

  /**
   * Renders a list of connected nodes with clickable links.
   *
   * @param {string[]} connectedNodeNames - Names of connected nodes
   * @param {Array} nodes - All nodes in the graph
   * @param {Function} onNodeClick - Callback when a connected node is clicked
   * @returns {void}
   */
  renderConnectedNodes(connectedNodeNames, nodes, onNodeClick) {
    if (!connectedNodeNames || connectedNodeNames.length === 0) return;

    const container = this.createElement('div', { class: 'connected-nodes' }, this.contentElement);
    this.createElement('h3', { content: 'Connected' }, container);

    const list = this.createElement('ul', {}, container);

    connectedNodeNames.forEach((name) => {
      const connectedNode = nodes.find((n) => n.name === name || n.id === name);
      if (!connectedNode) return;

      this.renderNodeLink(connectedNode, list, onNodeClick);
    });
  }

  /**
   * Renders a list of group members with clickable links.
   *
   * @param {string[]} memberNames - Names of group member nodes
   * @param {Array} nodes - All nodes in the graph
   * @param {Function} onNodeClick - Callback when a member node is clicked
   * @returns {void}
   */
  renderGroupMembers(memberNames, nodes, onNodeClick) {
    if (!memberNames || memberNames.length === 0) return;

    const container = this.createElement('div', { class: 'connected-nodes' }, this.contentElement);
    this.createElement('h3', { content: 'Group Members' }, container);

    const list = this.createElement('ul', {}, container);

    memberNames.forEach((name) => {
      const memberNode = nodes.find((n) => n.name === name || n.id === name);
      if (!memberNode) return;

      this.renderNodeLink(memberNode, list, onNodeClick);
    });
  }

  /**
   * Renders a single clickable node link.
   *
   * @param {Object} node - The node to link to
   * @param {HTMLElement} list - The parent list element
   * @param {Function} onNodeClick - Callback when the link is clicked
   * @returns {void}
   */
  renderNodeLink(node, list, onNodeClick) {
    const listItem = this.createElement('li', {}, list);
    const link = this.createElement(
      'a',
      {
        class: 'connected-node',
        href: '#',
        content: node.name || node.id,
      },
      listItem
    );

    link.addEventListener('click', (e) => {
      e.preventDefault();
      onNodeClick(node.id);
    });
  }
}
