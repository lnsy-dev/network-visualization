This is a vanilla js, css and html project. It uses rspack to build the files. 


It uses dataroom-js for all custom html elements. The code for dataroom-js looks like this: 

```js
/**
 * DataRoom Custom Element
 *
 * The main component that serves as the container for all data visualization
 * and interaction elements in the DataRoom application.
 *
 * @class DataRoom
 * @extends HTMLElement
 * 
 * @example
 * // Use this function by importing it:
 * import Dataroom from '/dataroom.js'
 * 
 * class ElementName extends Dataroom {
 *  async init(){
 *    // override the init() function
 *  }
 * }
 */

export default class DataroomElement extends HTMLElement {
  /**
   * Creates a new HTML element of the specified type and appends it to the current element or a specified target element.
   * @param {string} type - The type of element to create.
   * @param {Object} attributes - An object of key-value pairs representing attribute names and values.
   * @param {HTMLElement|null} [target_el=null] - The target element to append the new element to. Defaults to the current element.
   * @returns {HTMLElement} - The newly created element.
   */
  create(type, attributes = {}, target_el = null) {
    this.log(`Creating a new Element of ${type}`);
    const el = document.createElement(type);
    Object.keys(attributes).forEach((attribute) => {
      if (attribute === "content") {
        el.innerHTML = attributes[attribute];
      } else {
        el.setAttribute(attribute, attributes[attribute]);
      }
    });
    if (target_el === null) {
      this.appendChild(el);
    } else {
      target_el.appendChild(el);
    }
    return el;
  }

  /**
   * Emits a custom event from the element.
   * @param {string} name - The name of the event to emit.
   * @param {Object} [detail={}] - Additional data to include with the event.
   * @returns {void}
   */
  event(name, detail = {}) {
    const dtrmEvent = new CustomEvent(name, {
      detail,
    });
    this.dispatchEvent(dtrmEvent);
  }

  /**
   * Attaches an event listener to the element.
   * @param {string} name - The name of the event to listen for.
   * @param {Function} cb - The callback function to execute when the event is fired.
   * @returns {void}
   */
  on(name, cb){
    console.log('creating event listener...', name);
    return this.addEventListener(name, (e)=>{
      cb(e.detail)
    });
  }

  /**
   * A fetch helper that handles most of the complexity of 
   * talking to the server. 
   * @param  {string} endpoint the endpoint we want to talk to
   * @param  {object} body     the content of the server call
   * @returns {object}          the response from the server as an object
   */
  async call(endpoint, body = {}){
    const headers = {
      'Content-Type': 'application/json',
    }

    const securityScheme = this.getAttribute('security-scheme');

    if (securityScheme === 'localstorage') {
      const bearer_token = localStorage.getItem('bearer-token');
      headers['Authorization'] = `Bearer ${bearer_token}`;
    } else if (securityScheme === 'cookie') {
      // Cookies are sent automatically by the browser, so no special handling is needed here.
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = this.getAttribute('call-timeout');

    if (timeout) {
      setTimeout(() => controller.abort(), timeout);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'post',
        headers,
        body: JSON.stringify(body),
        signal
      });
  
      if(response.ok){
        const response_value = await response.json();
        return response_value;
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      } else {
        throw error;
      }
    }
  }

  /**
   * Logs a message if the verbose flag is set.
   * @param {string} message - The message to log.
   * @returns {void}
   */
  log(message) {
    if (this.verbose) {
      console.log(this.id, "says:", message);
      this.event("status-update", message);

    } else {
      this.event("status-update", message);
      return;
    }
  }

  /**
   * Called when the element is added to the DOM.
   * Sets the element's ID and attributes, and initializes the element.
   * @private
   * @returns {void}
   */
  connectedCallback() {
    if (document.readyState !== 'loading') {
      this.preInit();
      return;
    }
    document.addEventListener('DOMContentLoaded', () => this.preInit());
  }

  /**
   * Runs before the Initializeation 
   * @returns {void}
  */
  async preInit(){

    this.content = this.innerText; 
    this.attrs = this.getAttributeNames().reduce((acc, name) => {
      return { ...acc, [name]: this.getAttribute(name) };
    }, {});
    this.classList.add('dataroom-element');
    this.observeAttributeChanges();

    this.initialize();
  }


  /**
   * Sets multiple attributes on the element.
   * @param {Object} data - An object of key-value pairs representing attribute names and values.
   * @returns {Promise<void>}
   */
  async setAttrs(data) {
    this.log("setting attrs:", data);
    for (const [key, value] of Object.entries(data)) {
      await this.setAttribute(key, value);
    }
    this.render();
  }


  /**
   * Observes changes to element attributes and emits events when they change.
   * @private
   * @returns {void}
   */
  observeAttributeChanges() {
    this.log("observing attribute changes");
    this.attributeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          this.attrs[mutation.attributeName] = this.getAttribute(
            mutation.attributeName,
          );
          this.event("NODE-CHANGED", {
            attribute: mutation.attributeName,
            oldValue: mutation.oldValue,
            newValue: this.getAttribute(mutation.attributeName),
          });
        }
      });
    });
    const config = { attributes: true, attributeOldValue: true };
    this.attributeObserver.observe(this, config);
  }

  /**
   * Initializes the element. This function should be overridden in the child class.
   * @returns {void}
   */
  async initialize() {
    // override this class to run initialization code here
  }

  /**
   * Called when the element is removed from the DOM.
   * Disconnects the element.
   * @private
   * @returns {void}
   */
  disconnectedCallback() {
    this.log("disconnecting...");
    this.disconnect();
  }

  /**
   * Handles disconnection logic. This function should be overridden in the child class.
   * @returns {void}
   */
  async disconnect() {
    // override this function to run disconnect code
  }



}
```

Please use dataroom-js for all custom html elements, and use the above features in dataroom-js. 

We do not use shadowdom.

We do not embedd CSS in our Javascript -- we have separate CSS for that. 

We use DockBlock style comments for all code.