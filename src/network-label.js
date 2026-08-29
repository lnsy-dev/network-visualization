import DataroomElement from 'dataroom-js';

/**
 * NetworkLabel Custom Element
 *
 * A declarative container for the empty-state content shown in the network
 * visualization's metadata aside when no node or group is selected. Place
 * <network-label> inside <network-visualization> with arbitrary HTML content;
 * it is hidden by default and its innerHTML is copied into the aside whenever
 * the selection is cleared.
 *
 * @class NetworkLabel
 * @extends DataroomElement
 *
 * @example
 * <network-visualization>
 *   <network-label>
 *     <p>Select a node or group to see details.</p>
 *   </network-label>
 *   <network-node id="a" name="A">...</network-node>
 * </network-visualization>
 */
class NetworkLabel extends DataroomElement {
  /**
   * Initializes the network label element.
   *
   * The element exists only to supply content to the metadata aside, so no
   * runtime setup is required.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    // No runtime behavior: content is read by MetadataDisplay.
  }
}

if (!customElements.get('network-label')) {
  customElements.define('network-label', NetworkLabel);
}
