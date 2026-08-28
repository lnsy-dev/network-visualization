/**
 * Compile Markdown Logic
 *
 * Pure functions for converting markdown files that contain
 * ```network-visualization fenced code blocks into HTML documents that the
 * <network-visualization> component can render.
 *
 * The fenced block format is:
 *
 * ```network-visualization
 * Node Name:
 *   # Optional heading (becomes metadata HTML)
 *   Description text...
 *
 * Another Node:
 *   ...
 *
 * ---
 * (Source Node|wireframe:true;shape:cube) --> (Target Node)
 * (Target Node) -> (Source Node)
 * ```
 *
 * Everything above the `---` divider defines nodes and their markdown
 * metadata content. Everything below defines edges. Attributes inside
 * endpoint parentheses (e.g. `wireframe:true;shape:torus`) are merged into
 * the referenced node's definition.
 *
 * These functions have no DOM dependencies so they can be unit tested in
 * isolation.
 *
 * @module compile-markdown-logic
 */

/**
 * Matches a ```network-visualization fenced code block, capturing the
 * info-string attributes and the block body.
 *
 * @constant {RegExp}
 */
const BLOCK_REGEX = /^```network-visualization([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;

/**
 * Matches a top-level node definition line such as `Framework Du Jour:`.
 * Only unindented lines ending in a colon qualify.
 *
 * @constant {RegExp}
 */
const NODE_KEY_REGEX = /^([^:\s][^:]*):\s*$/;

/**
 * Matches an edge line such as `(A|wireframe:true) --> (B|shape:cube)`.
 * Both `-->` and `->` arrows are accepted.
 *
 * @constant {RegExp}
 */
const EDGE_LINE_REGEX =
  /^\(\s*([^()|]+?)\s*(?:\|\s*([^)]*?)\s*)?\)\s*(?:-->|->)\s*\(\s*([^()|]+?)\s*(?:\|\s*([^)]*?)\s*)?\)\s*$/;

/**
 * Matches a horizontal rule that separates the node section from the edge
 * section.
 *
 * @constant {RegExp}
 */
const DIVIDER_REGEX = /^(?:---|\*\*\*|___)\s*$/;

/**
 * Escapes HTML special characters in plain text.
 *
 * @param {string} text - Raw text to escape
 * @returns {string} Escaped text safe for HTML interpolation
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts a node name into a valid HTML id.
 *
 * @param {string} name - Display name, e.g. "Framework Du Jour"
 * @returns {string} Slugified id, e.g. "framework-du-jour"
 */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'node';
}

/**
 * Parses an attribute string such as `wireframe:true;shape:torus` or
 * `wireframe:true,shape:torus` into an object.
 *
 * @param {string} raw - Raw attribute string (may be empty)
 * @returns {Object<string, string>} Parsed attributes
 */
export function parseAttributes(raw) {
  const attributes = {};
  if (!raw) {
    return attributes;
  }
  for (const part of raw.split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      // Bare flag such as `wireframe` means truthy.
      attributes[trimmed] = 'true';
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      attributes[key] = value;
    }
  }
  return attributes;
}

/**
 * Parses the info-string that follows the fence marker into element
 * attributes, e.g. ` scale=1.2 labels-zoom-level=1.0`.
 *
 * @param {string} info - Raw info string (may be empty)
 * @returns {Object<string, string>} Parsed attributes
 */
export function parseInfoString(info) {
  const attributes = {};
  const regex = /([a-zA-Z0-9-]+)=("[^"]*"|\S+)/g;
  let match;
  while ((match = regex.exec(info || '')) !== null) {
    attributes[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return attributes;
}

/**
 * Converts inline markdown (bold, italic, code, links) to HTML, escaping
 * all raw HTML in the source text.
 *
 * @param {string} text - Inline markdown text
 * @returns {string} Inline HTML
 */
export function inlineMarkdownToHtml(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2">$1</a>'
  );
  return html;
}

/**
 * Converts a small, pragmatic subset of markdown to HTML:
 * headings, unordered lists, and paragraphs. Inline formatting is handled
 * by {@link inlineMarkdownToHtml}.
 *
 * @param {string} markdown - Markdown source
 * @returns {string} HTML fragment
 */
export function markdownToHtml(markdown) {
  const lines = String(markdown).split('\n');
  const html = [];
  let paragraph = [];
  let list = null;

  /**
   * Flushes any pending paragraph or list before the next block element.
   *
   * @returns {void}
   */
  const flush = () => {
    if (paragraph.length > 0) {
      html.push(
        `      <p>${inlineMarkdownToHtml(paragraph.join(' '))}</p>`
      );
      paragraph = [];
    }
    if (list !== null) {
      html.push(`      <ul>\n${list.join('\n')}\n      </ul>`);
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flush();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flush();
      // Metadata headings are displayed as h3-h6 so they nest inside the
      // component's metadata panel rather than implying a page outline.
      const level = Math.min(headingMatch[1].length + 2, 6);
      html.push(
        `      <h${level}>${inlineMarkdownToHtml(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (list === null) {
        flush();
        list = [];
      }
      list.push(`        <li>${inlineMarkdownToHtml(listMatch[1])}</li>`);
      continue;
    }

    if (list !== null) {
      flush();
    }
    paragraph.push(line);
  }

  flush();
  return html.join('\n');
}

/**
 * Extracts every ```network-visualization fenced block from a markdown
 * document.
 *
 * @param {string} markdown - Full markdown source
 * @returns {Array<{info: string, body: string}>} Extracted blocks in order
 */
export function extractVisualizationBlocks(markdown) {
  const blocks = [];
  BLOCK_REGEX.lastIndex = 0;
  let match;
  while ((match = BLOCK_REGEX.exec(markdown)) !== null) {
    blocks.push({ info: match[1], body: match[2] });
  }
  return blocks;
}

/**
 * Parses the body of a visualization block into node definitions and edge
 * definitions. Endpoint attributes found on edge lines are merged into the
 * corresponding node definition.
 *
 * @param {string} body - Raw block body (everything between the fences)
 * @returns {{nodes: Array<Object>, edges: Array<Object>}} Parsed graph
 */
export function parseVisualizationBody(body) {
  const lines = body.split('\n');
  const nodesByName = new Map();
  const edges = [];

  let inEdges = false;
  let currentNode = null;
  let currentLines = [];

  /**
   * Finalizes the node currently being collected.
   *
   * @returns {void}
   */
  const flushNode = () => {
    if (currentNode) {
      currentNode.markdown = currentLines.join('\n');
      currentLines = [];
      currentNode = null;
    }
  };

  for (const rawLine of lines) {
    if (DIVIDER_REGEX.test(rawLine.trim())) {
      flushNode();
      inEdges = true;
      continue;
    }

    if (!inEdges) {
      const isIndented = /^\s/.test(rawLine);
      if (isIndented || !rawLine.trim()) {
        // Content (or a blank separator) belonging to the current node.
        if (currentNode) {
          currentLines.push(rawLine.trim());
        }
        continue;
      }

      const keyMatch = rawLine.trim().match(NODE_KEY_REGEX);
      if (keyMatch) {
        flushNode();
        const name = keyMatch[1].trim();
        currentNode = { name, attributes: {}, markdown: '' };
        nodesByName.set(name, currentNode);
      }
      continue;
    }

    // Edge section.
    const edgeMatch = rawLine.trim().match(EDGE_LINE_REGEX);
    if (!edgeMatch) {
      continue;
    }
    const [, sourceName, sourceAttrs, targetName, targetAttrs] = edgeMatch;
    edges.push({
      source: sourceName.trim(),
      target: targetName.trim(),
    });

    // Endpoint attributes describe how the referenced node should render.
    // Endpoints referenced only by edges are registered so the full graph
    // is represented even when a node has no dedicated definition.
    for (const [name, attrRaw] of [
      [sourceName.trim(), sourceAttrs],
      [targetName.trim(), targetAttrs],
    ]) {
      if (!nodesByName.has(name)) {
        nodesByName.set(name, { name, attributes: {}, markdown: '' });
      }
      if (attrRaw) {
        Object.assign(nodesByName.get(name).attributes, parseAttributes(attrRaw));
      }
    }
  }
  flushNode();

  return { nodes: Array.from(nodesByName.values()), edges };
}

/**
 * Builds the attribute portion of a network-node tag from parsed
 * attributes. Only recognized attributes are emitted.
 *
 * @param {Object<string, string>} attributes - Parsed attributes
 * @returns {string} Serialized attributes with a leading space, or ''
 */
export function serializeNodeAttributes(attributes) {
  let serialized = '';
  if (attributes.shape) {
    serialized += ` shape="${escapeHtml(attributes.shape)}"`;
  }
  if (String(attributes.wireframe) === 'true') {
    serialized += ' wireframe="true"';
  }
  if (attributes.color) {
    serialized += ` color="${escapeHtml(attributes.color)}"`;
  }
  return serialized;
}

/**
 * Compiles a single extracted block into <network-node> and <network-edge>
 * elements ready to be placed inside <network-visualization>.
 *
 * @param {{info: string, body: string}} block - Extracted block
 * @returns {string} HTML fragment
 */
export function compileBlock(block) {
  const { nodes, edges } = parseVisualizationBody(block.body);
  const knownNames = new Set(nodes.map((node) => node.name));

  // Ensure every edge endpoint exists as a node so the component's link
  // filter does not silently drop edges.
  for (const edge of edges) {
    for (const name of [edge.source, edge.target]) {
      if (!knownNames.has(name)) {
        nodes.push({ name, attributes: {}, markdown: '' });
        knownNames.add(name);
      }
    }
  }

  const elementAttributes = Object.entries(parseInfoString(block.info))
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join('');

  const lines = [];
  lines.push(`    <network-visualization${elementAttributes}>`);
  for (const node of nodes) {
    const id = slugify(node.name);
    const attrs = serializeNodeAttributes(node.attributes);
    lines.push(
      `    <network-node id="${id}" name="${escapeHtml(node.name)}"${attrs}>`
    );
    const contentHtml = markdownToHtml(node.markdown);
    if (contentHtml) {
      lines.push(contentHtml);
    }
    lines.push('    </network-node>');
  }
  for (const edge of edges) {
    lines.push(
      `    <network-edge source="${slugify(edge.source)}" target="${slugify(edge.target)}"></network-edge>`
    );
  }
  lines.push('    </network-visualization>');
  return lines.join('\n');
}

/**
 * Compiles a full markdown document into a standalone HTML page. Fenced
 * network-visualization blocks are converted into <network-visualization>
 * elements; all other markdown is rendered as plain document content.
 *
 * @param {string} markdown - Full markdown source
 * @param {Object} [options] - Compile options
 * @param {string} [options.title] - Document title
 * @returns {string} Complete HTML document
 */
export function compileMarkdown(markdown, options = {}) {
  const title = options.title || 'Network Visualization';

  const segments = [];
  let lastIndex = 0;
  BLOCK_REGEX.lastIndex = 0;
  let match;
  while ((match = BLOCK_REGEX.exec(markdown)) !== null) {
    const preceding = markdown.slice(lastIndex, match.index);
    segments.push(markdownToHtml(preceding));
    segments.push(compileBlock({ info: match[1], body: match[2] }));
    lastIndex = match.index + match[0].length;
  }
  segments.push(markdownToHtml(markdown.slice(lastIndex)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <script type="module" src="/network-visualization.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..700&display=swap');

    :root {
      --background-color: #dddbc7;
      --foreground-color: #000;
      --panel-background: rgba(255, 255, 255, 0.85);
    }

    * {
      box-sizing: border-box;
    }

    body {
      background-color: var(--background-color);
      color: var(--foreground-color);
      margin: 0;
      padding: 1em;
      font-family: "Fira Code", monospace;
      min-height: 100vh;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
    }

    network-visualization {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      background-color: var(--background-color);
      color: var(--foreground-color);
    }
  </style>
</head>
<body>
  <div class="page">
${segments.filter(Boolean).join('\n\n')}
  </div>
</body>
</html>
`;
}
