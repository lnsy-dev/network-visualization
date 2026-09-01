# Network Visualization Component

A 3D, interactive network graph built as standard HTML custom elements. Drop `<network-visualization>` into any page, declare nodes and edges as child elements, and you get a force-directed Three.js scene with labels, groups, selection, and a built-in metadata sidebar.

## Features

- **Declarative HTML API** — define the graph with `<network-node>`, `<network-edge>`, and `<network-group>` elements.
- **3D force-directed layout** — nodes start on a compact grid and a deterministic physics pass pulls connected nodes closer together.
- **Interactive camera** — click-drag to orbit; hold **Shift** and use the mouse wheel to zoom in and out. Regular page scrolling is never blocked.
- **Auto-fit camera with intro animation** — the camera flies in from a top-down view to frame the graph on load, then re-fits automatically as the layout settles.
- **HTML node labels** — labels are real HTML elements rendered with `CSS2DRenderer`, so they stay crisp and are easy to style. Labels are clickable, avoid overlapping each other, and are clamped to the viewport edges.
- **Label zoom threshold** — labels appear or disappear based on camera distance; control the cutoff with the `labels-zoom-level` attribute.
- **Node shapes** — choose `pyramid` (default), `cube`/`box`/`square`, `sphere`, or `torus`.
- **Node styling** — set an explicit `color`, use the component's foreground color, or switch on `wireframe` mode.
- **Edge styling** — edges render as arced Three.js lines; set an explicit `color` or inherit the foreground color.
- **Groups** — `<network-group>` draws a semi-transparent wireframe hull around its member nodes and updates as the layout moves.
- **Metadata sidebar / HUD** — selecting a node or group displays its inner HTML in an `aside` alongside the graph, plus a list of connected nodes or group members that can be clicked to jump to that node.
- **`<network-label>` empty state** — customize the message shown in the metadata sidebar when nothing is selected.
- **`metadata-shown` event** — listen for selection changes and build your own UI when the built-in HUD is disabled or hidden.
- **Responsive** — a `ResizeObserver` keeps the canvas and labels sized to the element, and the camera re-fits until the user takes control.
- **Theme aware** — the component re-reads the computed `color` when the OS color scheme or document theme changes.
- **No frameworks** — vanilla JavaScript, standard CSS, and Three.js. Works anywhere custom elements and ES modules work.

## Installation

```bash
npm install @lnsy/network-visualization --save
```

Import it as an ES module:

```js
import "@lnsy/network-visualization";
```

Or load the pre-built bundle from unpkg:

```html
<script type="module" src="https://unpkg.com/@lnsy/network-visualization/dist/network-visualization.min.js"></script>
```

## Quick Start

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

## Tutorial: Building a Network Graph

### 1. Add the container

Every graph lives inside `<network-visualization>`. Give it a size with CSS so the canvas has room to render.

```html
<network-visualization>
  <!-- nodes, edges, groups, and label go here -->
</network-visualization>
```

```css
network-visualization {
  display: block;
  width: 100%;
  height: 600px;
}
```

### 2. Declare nodes

Each `<network-node>` needs a unique `id`. Use `name` to show a label, and put the detail view content inside the element.

```html
<network-node id="alice" name="Alice">
  <h3>Alice</h3>
  <p>Senior frontend developer.</p>
</network-node>
```

A node can also declare a shape, an explicit color, and wireframe mode:

```html
<network-node id="server" name="Server" shape="cube" color="#ff6600" wireframe>
  <p>Production API server.</p>
</network-node>
```

Available shapes: `pyramid` (default), `cube` / `box` / `square`, `sphere`, `torus`.

### 3. Connect nodes with edges

`<network-edge>` references node IDs and may include relationship metadata.

```html
<network-edge source="alice" target="bob" name="collaborates">
  <p>Worked on the checkout flow together.</p>
</network-edge>
```

Edges with missing source or target nodes are skipped with a console warning.

### 4. Group nodes

`<network-group>` draws a wireframe boundary around a set of nodes. `node-ids` is a comma-separated list.

```html
<network-group name="Frontend Team" node-ids="alice,bob,charlie">
  <h3>Frontend Team</h3>
  <p>Responsible for the user interface.</p>
</network-group>
```

Clicking inside the group hull selects the group and shows its content.

### 5. Customize the empty-state label with `<network-label>`

When no node or group is selected, the metadata sidebar shows the contents of the first `<network-label>` child. The `<network-label>` element itself is hidden; only its inner HTML is rendered into the sidebar.

```html
<network-visualization>
  <network-label>
    <p>Click a person, team, or connection to read more.</p>
  </network-label>

  <network-node id="alice" name="Alice">…</network-node>
  …
</network-visualization>
```

If you omit `<network-label>`, the default message is shown:

> Select a node or group to see details.

The label content can be any HTML, so you can add instructions, branding, or helper links.

### 6. Control the graph with attributes

| Attribute | Effect | Default |
|-----------|--------|---------|
| `scale` | Multiplies the size of every node. | `1.0` |
| `minimum-node-size` | Minimum size multiplier for nodes. | `1.0` |
| `labels-zoom-level` | Minimum zoom level (relative to the fitted view) at which labels are visible. | `0.5` |
| `no-hud` | Disables the built-in metadata sidebar; only the `metadata-shown` event is emitted. | absent |

Example:

```html
<network-visualization scale="1.3" labels-zoom-level="0.7" minimum-node-size="1.5">
  …
</network-visualization>
```

### 7. Listen to selection changes

The component fires a `metadata-shown` event whenever a node or group is selected.

```js
const viz = document.querySelector('network-visualization');

viz.addEventListener('metadata-shown', (e) => {
  console.log('Title:', e.detail.title);
  console.log('Content:', e.detail.content);
  console.log('Links:', e.detail.links);
});
```

`detail.links` is an array of connected node names for node selections, or group member names for group selections.

### 8. Style the graph with CSS

The component reads its look from ordinary CSS.

```css
:root {
  --background-color: #0f0f23;
  --foreground-color: #e0e0e0;
  --secondary: #00ccff;
  --accent: #ff9900;
}

network-visualization {
  display: block;
  width: 100vw;
  height: 100vh;
  background-color: var(--background-color);
  color: var(--foreground-color);
}
```

Useful selectors:

```css
/* Node labels */
network-visualization .node-label {
  background-color: rgba(15, 15, 35, 0.9);
  color: var(--foreground-color);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

/* Hovered node label */
network-visualization .node-label.hover {
  color: var(--secondary);
}

/* Selected node label */
network-visualization .node-label.selected {
  color: var(--accent);
}

/* Built-in metadata sidebar */
network-visualization .network-hud {
  width: 24ch;
  margin-left: 1.5rem;
  font-size: 14px;
}
```

CSS custom properties recognized by the component:

| Variable | Used for |
|----------|----------|
| `--background-color` | Fallback background for the component and node labels. |
| `--foreground-color` | Fallback text color; used for nodes and edges when no explicit color is set. |
| `--secondary` | Hover highlight color for nodes and labels. |
| `--accent` | Selected-state color for nodes and labels. |
| `--network-fit-inset` | Pixel insets (top, right, bottom, left) reserved around the graph when the camera auto-fits. |
| `--rhythm-md` | Gap between the graph and the metadata sidebar. |

### 9. A complete styled example

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://unpkg.com/@lnsy/network-visualization/dist/network-visualization.min.js"></script>
  <style>
    :root {
      --background-color: #111;
      --foreground-color: #eee;
      --secondary: #4af;
      --accent: #f90;
    }

    body {
      margin: 0;
      font-family: system-ui, sans-serif;
    }

    network-visualization {
      display: block;
      width: 100vw;
      height: 100vh;
      background-color: var(--background-color);
      color: var(--foreground-color);
    }

    network-visualization .node-label {
      background-color: rgba(17, 17, 17, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <network-visualization scale="1.2" labels-zoom-level="0.6">
    <network-label>
      <p><strong>Team Explorer</strong></p>
      <p>Click a person or team to see details.</p>
    </network-label>

    <network-node id="alice" name="Alice" shape="sphere" color="#4af">
      <h3>Alice</h3>
      <p>Frontend lead.</p>
    </network-node>

    <network-node id="bob" name="Bob" shape="sphere">
      <h3>Bob</h3>
      <p>Frontend engineer.</p>
    </network-node>

    <network-node id="carol" name="Carol" shape="cube" color="#f90">
      <h3>Carol</h3>
      <p>Engineering manager.</p>
    </network-node>

    <network-edge source="alice" target="bob" name="pair programming"></network-edge>
    <network-edge source="carol" target="alice" name="manages"></network-edge>
    <network-edge source="carol" target="bob" name="manages"></network-edge>

    <network-group name="Frontend" node-ids="alice,bob">
      <h3>Frontend Team</h3>
      <p>Owns the user interface.</p>
    </network-group>
  </network-visualization>

  <script type="module">
    const viz = document.querySelector('network-visualization');
    viz.addEventListener('metadata-shown', (e) => {
      document.title = e.detail.title;
    });
  </script>
</body>
</html>
```

## Component Reference

### `<network-visualization>`

The main container element for the 3D network graph.

#### Attributes

- **`scale`** (optional): Scale factor for the entire graph. Default: `1.0`
  - Example: `scale="1.5"` makes every node 50% larger.
  - Can be changed dynamically and the graph will update automatically.
- **`labels-zoom-level`** (optional): Zoom level at which labels become visible. Default: `0.5` (labels visible at the fitted overview zoom).
- **`minimum-node-size`** (optional): Minimum size multiplier for nodes. Default: `1.0`.
- **`no-hud`** (optional): Suppress the built-in metadata sidebar and rely on the `metadata-shown` event.

#### Events

- **`metadata-shown`**: Fired when a node or group is selected and metadata is displayed.
  - `title`: The name or ID of the selected node/group.
  - `content`: The HTML content of the node/group.
  - `links`: Array of connected node names (or group member names).

```js
const viz = document.querySelector('network-visualization');
viz.addEventListener('metadata-shown', (e) => {
  console.log('Selected:', e.detail.title);
  console.log('Content:', e.detail.content);
  console.log('Connected nodes:', e.detail.links);
});
```

### `<network-node>`

Represents a node in the network graph.

#### Attributes

- **`id`** (required): Unique identifier for the node.
- **`name`** (optional): Display name shown as a label above the node.
- **`shape`** (optional): Node geometry — `pyramid`, `cube` / `box` / `square`, `sphere`, or `torus`. Default: `pyramid`.
- **`color`** (optional): Explicit node color. Falls back to the component's foreground color.
- **`wireframe`** (optional): Render the node as a wireframe.

#### Content

The inner HTML is shown in the metadata sidebar when the node is selected.

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

- **`source`** (required): ID of the source node.
- **`target`** (required): ID of the target node.
- **`name`** (optional): Name/label for the edge (shown only via the `metadata-shown` event content, not on the canvas).
- **`color`** (optional): Explicit edge color. Falls back to the component's foreground color.

#### Content

The inner HTML can contain metadata about the relationship.

```html
<network-edge source="person1" target="person2" name="mentor">
  Mentorship started in 2020
</network-edge>
```

### `<network-group>`

Creates a wireframe boundary around a collection of related nodes.

#### Attributes

- **`name`** (required): Display name for the group.
- **`node-ids`** (required): Comma-separated list of node IDs to include in the group.
- **`color`** (optional): Wireframe color. Default: `#888888`.

#### Content

The inner HTML can contain descriptive information about the group that is displayed when the group is selected.

```html
<network-group name="Engineering Team" node-ids="alice,bob,charlie">
  <h3>Engineering Team</h3>
  <p>Core development team responsible for product features</p>
  <ul>
    <li>Full-stack development</li>
    <li>Code reviews</li>
    <li>Architecture decisions</li>
  </ul>
</network-group>
```

#### Behavior

- Groups automatically calculate their position and size based on member node positions.
- A padding of 20 units is added around the group's nodes.
- Groups update dynamically as the force simulation adjusts node positions.
- Clicking anywhere inside a group's wireframe displays the group's metadata.

### `<network-label>`

Sets the content shown in the built-in metadata aside when no node or group is selected. The element itself is hidden; only its inner HTML is rendered into the aside.

#### Content

The inner HTML can contain any markup. If no `<network-label>` is provided, the aside shows the default message: "Select a node or group to see details."

```html
<network-label>
  <p>Select a node or group to see details.</p>
</network-label>
```

#### Behavior

- The first `<network-label>` child of `<network-visualization>` is read when the sidebar is cleared.
- It is not rendered as a visible element itself; it only supplies the empty-state HTML.
- Because the content is copied into the sidebar, any event listeners attached to elements inside `<network-label>` are not preserved.

## Examples

### Example 1: Team Organization with Groups

```html
<network-visualization scale="1.3">
  <!-- Frontend Team Members -->
  <network-node id="alice" name="Alice" wireframe="true" shape="sphere">
    <h2>Alice</h2>
    <p>Senior Frontend Developer</p>
  </network-node>

  <network-node id="bob" name="Bob" wireframe="true" shape="sphere">
    <h2>Bob</h2>
    <p>Frontend Developer</p>
  </network-node>

  <!-- Backend Team Members -->
  <network-node id="dave" name="Dave" wireframe="true" shape="cube">
    <h2>Dave</h2>
    <p>Backend Lead</p>
  </network-node>

  <network-node id="eve" name="Eve" wireframe="true" shape="cube">
    <h2>Eve</h2>
    <p>Backend Developer</p>
  </network-node>

  <!-- Edges -->
  <network-edge source="alice" target="bob" name="collaborates"></network-edge>
  <network-edge source="dave" target="eve" name="mentors"></network-edge>
  <network-edge source="alice" target="dave" name="API integration"></network-edge>

  <!-- Groups -->
  <network-group name="Frontend Team" node-ids="alice,bob">
    <h3>Frontend Team</h3>
    <p>Responsible for user interface development</p>
  </network-group>

  <network-group name="Backend Team" node-ids="dave,eve">
    <h3>Backend Team</h3>
    <p>Handles server-side logic and databases</p>
  </network-group>
</network-visualization>
```

[View full groups demo](./groups-demo.html)

### Example 2: Simple Social Network

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

### Example 3: Knowledge Graph

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

### Example 4: Styled with CSS Variables

```html
<style>
  :root {
    --background-color: #0f0f23;
    --foreground-color: #00ff00;
    --accent: #ff9900;
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
- **dataroom-js**: Custom element base class
- **OrbitControls**: Camera navigation
- **CSS2DRenderer**: HTML label rendering

### Browser Support

Requires modern browsers with:

- WebGL support
- ES6 modules
- Custom Elements v1

## License

Unlicense (public domain). See [LICENSE](./LICENSE) for details.
