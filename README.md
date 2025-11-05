<div>
  <network-visualization scale="1.6">
  <network-node id="2" name="Component" shape="cube" wireframe="true">Component</network-node>

  <network-node id="1" name="Visualization" shape="sphere" wireframe="true">Visualization</network-node>
    <network-node id="0" name="Network" shape="torus" wireframe="true">Network</network-node>

  <network-edge source="0" target="1"></network-edge>
  <network-edge source="1" target="2"></network-edge>
</network-visualization>
</div>


# Network Visualization Component

A 3D network visualization component built with Three.js that displays interactive force-directed graphs. Create beautiful, navigable network diagrams using simple HTML custom elements.

## Installation

```
npm install @lnsy/network-visualization --save

```

and import it with es6 format:

```js
  import "@lnsy/network-visualization";
```

or include it via unpkg: 

```
  <script type="module" src="https://unpkg.com/@lnsy/network-visualization/dist/network-visualization.min.js"></script>

```

## Quick Start

### Basic Usage

Create a simple network visualization by adding nodes and edges in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://unpkg.com/@lnsy/network-visualization/dist/network-visualization.min.js"></script>
  <style>
    network-visualization {
      display: block;
      width: 800px;
      height: 600px;
    }
  </style>
</head>
<body>
  <network-visualization>
    <network-node id="node1" name="Alice">Alice's profile information</network-node>
    <network-node id="node2" name="Bob">Bob's profile information</network-node>
    <network-node id="node3" name="Charlie">Charlie's profile information</network-node>
    
    <network-edge source="node1" target="node2" name="friends">They met in college</network-edge>
    <network-edge source="node2" target="node3" name="colleagues">Work together at TechCorp</network-edge>
  </network-visualization>
</body>
</html>
```

## Component Reference

### `<network-visualization>`

The main container element for the 3D network graph.

#### Attributes

- **`scale`** (optional): Scale factor for the entire graph. Default: `1.0`
  - Example: `scale="1.5"` makes the graph 50% larger
  - Can be changed dynamically and the graph will update automatically

- **`labels-zoom-level`** (optional): Zoom level at which labels become visible. Default: `1.1`

#### Events

The component emits the following custom events:

- **`metadata-shown`**: Fired when a node or group is selected and metadata is displayed
  - Event detail contains:
    - `title`: The name or ID of the selected node/group
    - `content`: The HTML content of the node/group
    - `links`: Array of connected node names (or group member names)

```js
const viz = document.querySelector('network-visualization');
viz.addEventListener('metadata-shown', (e) => {
  console.log('Selected:', e.detail.title);
  console.log('Content:', e.detail.content);
  console.log('Connected nodes:', e.detail.links);
});
```

#### CSS Styling

The component inherits `color` and `background-color` from CSS:

```css
network-visualization {
  display: block;
  width: 100%;
  height: 600px;
  background-color: #1a1a1a;
  color: #ffffff;
}
```

### `<network-node>`

Represents a node in the network graph.

#### Attributes

- **`id`** (required): Unique identifier for the node
- **`name`** (optional): Display name shown as a label above the node

#### Content

The inner HTML of the node element can contain any content (text, HTML, etc.) which will be associated with the node.

```html
<network-node id="person1" name="John Doe">
  <h3>John Doe</h3>
  <p>Software Engineer</p>
  <p>Email: john@example.com</p>
</network-node>
```

### `<network-edge>`

Represents a connection between two nodes.

#### Attributes

- **`source`** (required): ID of the source node
- **`target`** (required): ID of the target node  
- **`name`** (optional): Name/label for the edge

#### Content

The inner HTML can contain metadata about the relationship.

```html
<network-edge source="person1" target="person2" name="mentor">
  Mentorship started in 2020
</network-edge>
```

## Examples

### Example 1: Simple Social Network

```html
<network-visualization scale="1.2">
  <network-node id="alice" name="Alice">Designer</network-node>
  <network-node id="bob" name="Bob">Developer</network-node>
  <network-node id="carol" name="Carol">Manager</network-node>
  <network-node id="dave" name="Dave">Developer</network-node>
  
  <network-edge source="alice" target="bob" name="collaborates"></network-edge>
  <network-edge source="bob" target="dave" name="pair programming"></network-edge>
  <network-edge source="carol" target="alice" name="manages"></network-edge>
  <network-edge source="carol" target="bob" name="manages"></network-edge>
  <network-edge source="carol" target="dave" name="manages"></network-edge>
</network-visualization>
```

<div>
<network-visualization scale="1.2">
  <network-node id="alice" name="Alice">Designer</network-node>
  <network-node id="bob" name="Bob">Developer</network-node>
  <network-node id="carol" name="Carol">Manager</network-node>
  <network-node id="dave" name="Dave">Developer</network-node>
  
  <network-edge source="alice" target="bob" name="collaborates"></network-edge>
  <network-edge source="bob" target="dave" name="pair programming"></network-edge>
  <network-edge source="carol" target="alice" name="manages"></network-edge>
  <network-edge source="carol" target="bob" name="manages"></network-edge>
  <network-edge source="carol" target="dave" name="manages"></network-edge>
</network-visualization>
</div>

### Example 2: Knowledge Graph

```html
<network-visualization>
  <network-node id="js" name="JavaScript">
    <h4>JavaScript</h4>
    <p>Programming language</p>
  </network-node>
  
  <network-node id="react" name="React">
    <h4>React</h4>
    <p>UI library</p>
  </network-node>
  
  <network-node id="vue" name="Vue">
    <h4>Vue</h4>
    <p>Progressive framework</p>
  </network-node>
  
  <network-node id="node" name="Node.js">
    <h4>Node.js</h4>
    <p>Runtime environment</p>
  </network-node>
  
  <network-edge source="react" target="js" name="built with"></network-edge>
  <network-edge source="vue" target="js" name="built with"></network-edge>
  <network-edge source="node" target="js" name="runs"></network-edge>
</network-visualization>
```

<div>
<network-visualization>
  <network-node id="js" name="JavaScript">
    <h4>JavaScript</h4>
    <p>Programming language</p>
  </network-node>
  
  <network-node id="react" name="React">
    <h4>React</h4>
    <p>UI library</p>
  </network-node>
  
  <network-node id="vue" name="Vue">
    <h4>Vue</h4>
    <p>Progressive framework</p>
  </network-node>
  
  <network-node id="node" name="Node.js">
    <h4>Node.js</h4>
    <p>Runtime environment</p>
  </network-node>
  
  <network-edge source="react" target="js" name="built with"></network-edge>
  <network-edge source="vue" target="js" name="built with"></network-edge>
  <network-edge source="node" target="js" name="runs"></network-edge>
</network-visualization>

</div>

### Example 3: Styled with CSS Variables

```html
<style>
  :root {
    --background-color: #0f0f23;
    --foreground-color: #00ff00;
  }
  
  network-visualization {
    display: block;
    width: 100vw;
    height: 100vh;
    background-color: var(--background-color);
    color: var(--foreground-color);
  }
  
  network-visualization .node-label {
    background-color: var(--background-color);
    color: var(--foreground-color);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
</style>

<network-visualization scale="1.0">
  <!-- nodes and edges -->
</network-visualization>
```
---

## Use with mark-down component

You can use this component with my [mark-down element](https://lindseymysse.com/mark-down/). 

Include the mark-down component following the instructions. The markdown code block looks like this:

````markdown
```network
---
width: 800
height: 600
---

Node A:
    # Node A Title
    This is the content of Node A

Node B:
    # Node B Title
    Content for Node B

---

(Node A) --> (Node B)
```
````

## Document Structure

A network visualization block has three sections, separated by `---`:

1. **Front Matter** (optional) - Configuration attributes
2. **Definitions** - Node and edge definitions with content
3. **Connections** - Visual diagram describing how nodes connect


## Development

### Running Locally

```bash
npm run start
```

This starts a development server on port 3000 (configurable via `.env`).

### Building for Production

```bash
npm run build
```

Creates optimized files in the `dist/` folder.

### Customizing the Build

Create a `.env` file:

```
OUTPUT_FILE_NAME=network-visualization.min.js
PORT=8080
```

## Technical Details

### Built With

- **Three.js**: 3D rendering engine
- **three-forcegraph**: Force-directed graph layout
- **dataroom-js**: Custom element base class
- **OrbitControls**: Camera navigation
- **CSS2DRenderer**: HTML label rendering

### Browser Support

Requires modern browsers with:
- WebGL support
- ES6 modules
- Custom Elements v1


## License

MIT
