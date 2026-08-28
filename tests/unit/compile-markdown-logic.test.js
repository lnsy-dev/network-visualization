/**
 * Unit tests for compile-markdown-logic.
 *
 * Covers block extraction, YAML node/edge parsing, markdown-to-HTML
 * conversion, and full document compilation.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  slugify,
  parseAttributes,
  parseInfoString,
  inlineMarkdownToHtml,
  markdownToHtml,
  extractVisualizationBlocks,
  parseVisualizationBody,
  serializeNodeAttributes,
  compileBlock,
  compileMarkdown,
} from '../../src/compile-markdown-logic.js';

const SAMPLE_BLOCK = `\`\`\`network-visualization scale=1.2
JavaScript:
  # EcmaScript (JavaScript)
  The most widely used programming language on the web.

Framework Du Jour:
  # Framework Du Jour
  No upsells, no resume-driven development.

---
(JavaScript|wireframe:true;shape:torus) --> (HTML|wireframe:true;shape:cube)
(Framework Du Jour|wireframe:true,shape:sphere) -> (JavaScript)
\`\`\``;

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123');
  });
});

describe('slugify', () => {
  it('slugifies multi-word names', () => {
    expect(slugify('Framework Du Jour')).toBe('framework-du-jour');
  });

  it('replaces punctuation with dashes', () => {
    expect(slugify('Bun.sh')).toBe('bun-sh');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  Linux  ')).toBe('linux');
  });

  it('falls back to "node" when nothing usable remains', () => {
    expect(slugify('***')).toBe('node');
  });
});

describe('parseAttributes', () => {
  it('parses semicolon-separated attributes', () => {
    expect(parseAttributes('wireframe:true;shape:torus')).toEqual({
      wireframe: 'true',
      shape: 'torus',
    });
  });

  it('parses comma-separated attributes', () => {
    expect(parseAttributes('wireframe:true,shape:sphere')).toEqual({
      wireframe: 'true',
      shape: 'sphere',
    });
  });

  it('treats bare flags as true', () => {
    expect(parseAttributes('wireframe')).toEqual({ wireframe: 'true' });
  });

  it('returns an empty object for empty input', () => {
    expect(parseAttributes('')).toEqual({});
    expect(parseAttributes(null)).toEqual({});
  });
});

describe('parseInfoString', () => {
  it('parses key=value pairs from a fence info string', () => {
    expect(parseInfoString(' scale=1.2 labels-zoom-level=1.0')).toEqual({
      scale: '1.2',
      'labels-zoom-level': '1.0',
    });
  });

  it('supports quoted values', () => {
    expect(parseInfoString(' title="My Graph"')).toEqual({ title: 'My Graph' });
  });

  it('returns an empty object for an empty info string', () => {
    expect(parseInfoString('')).toEqual({});
  });
});

describe('inlineMarkdownToHtml', () => {
  it('escapes raw HTML before formatting', () => {
    expect(inlineMarkdownToHtml('a < b')).toBe('a &lt; b');
  });

  it('converts bold text', () => {
    expect(inlineMarkdownToHtml('**bold**')).toBe('<strong>bold</strong>');
  });

  it('converts italic text', () => {
    expect(inlineMarkdownToHtml('_ital_ and *tal*')).toBe('<em>ital</em> and <em>tal</em>');
  });

  it('converts code spans', () => {
    expect(inlineMarkdownToHtml('use `x = 1`')).toBe('use <code>x = 1</code>');
  });

  it('converts links', () => {
    expect(inlineMarkdownToHtml('[site](https://example.com)')).toBe(
      '<a href="https://example.com">site</a>'
    );
  });
});

describe('markdownToHtml', () => {
  it('converts h1 headings to h3 for metadata display', () => {
    expect(markdownToHtml('# Title')).toBe('      <h3>Title</h3>');
  });

  it('maps deeper heading levels (h2 -> h4)', () => {
    expect(markdownToHtml('## Sub')).toBe('      <h4>Sub</h4>');
  });

  it('clamps headings at h6', () => {
    expect(markdownToHtml('#### Deep')).toBe('      <h6>Deep</h6>');
  });

  it('groups consecutive lines into a single paragraph', () => {
    const html = markdownToHtml('line one\nline two');
    expect(html).toBe('      <p>line one line two</p>');
  });

  it('converts lists', () => {
    const html = markdownToHtml('- a\n- b');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<li>b</li>');
    expect(html).toContain('</ul>');
  });

  it('separates blocks with blank lines', () => {
    const html = markdownToHtml('# Head\n\nPara.');
    expect(html).toBe('      <h3>Head</h3>\n      <p>Para.</p>');
  });

  it('returns an empty string for empty markdown', () => {
    expect(markdownToHtml('')).toBe('');
  });
});

describe('extractVisualizationBlocks', () => {
  it('extracts blocks with info strings and bodies', () => {
    const blocks = extractVisualizationBlocks(`before\n\n${SAMPLE_BLOCK}\n\nafter`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].info).toBe(' scale=1.2');
    expect(blocks[0].body).toContain('JavaScript:');
    expect(blocks[0].body).toContain('(JavaScript|wireframe:true;shape:torus) --> (HTML|wireframe:true;shape:cube)');
  });

  it('finds multiple blocks in document order', () => {
    const doc = `${SAMPLE_BLOCK}\n\nmiddle\n\n${SAMPLE_BLOCK}`;
    expect(extractVisualizationBlocks(doc)).toHaveLength(2);
  });

  it('returns an empty array when no blocks exist', () => {
    expect(extractVisualizationBlocks('just text\n\n```js\nconst x = 1;\n```')).toEqual([]);
  });
});

describe('parseVisualizationBody', () => {
  it('parses node definitions with markdown metadata', () => {
    const { nodes } = parseVisualizationBody(
      'JavaScript:\n  # EcmaScript (JavaScript)\n  The most widely used language.\n\nCSS:\n  # CSS\n  Shapes the feel of a site.'
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].name).toBe('JavaScript');
    expect(nodes[0].markdown).toContain('# EcmaScript (JavaScript)');
    expect(nodes[1].name).toBe('CSS');
  });

  it('preserves node names containing spaces, dots, and hyphens', () => {
    const { nodes } = parseVisualizationBody('Framework Du Jour:\n  # Framework\n\nBun.sh:\n  # Bun\n\nNode-Red:\n  # Red');
    expect(nodes.map((n) => n.name)).toEqual(['Framework Du Jour', 'Bun.sh', 'Node-Red']);
  });

  it('parses edges with both arrow styles', () => {
    const { edges } = parseVisualizationBody('---\n(A) --> (B)\n(B) -> (C)');
    expect(edges).toEqual([
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
    ]);
  });

  it('merges endpoint attributes into node definitions', () => {
    const { nodes } = parseVisualizationBody(
      'JavaScript:\n  # JS\n\n---\n(JavaScript|wireframe:true;shape:torus) --> (HTML|wireframe:true;shape:cube)'
    );
    const js = nodes.find((n) => n.name === 'JavaScript');
    const html = nodes.find((n) => n.name === 'HTML');
    expect(js.attributes).toEqual({ wireframe: 'true', shape: 'torus' });
    expect(html.attributes).toEqual({ wireframe: 'true', shape: 'cube' });
  });

  it('registers nodes referenced only by edges', () => {
    const { nodes } = parseVisualizationBody('JavaScript:\n  # JS\n\n---\n(JavaScript) --> (Mystery Node)');
    const mystery = nodes.find((n) => n.name === 'Mystery Node');
    expect(mystery).toBeDefined();
    expect(mystery.markdown).toBe('');
  });

  it('does not treat colon-containing description lines as node keys', () => {
    const { nodes } = parseVisualizationBody(
      'JavaScript:\n  Note: a description line with a colon stays content.'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('JavaScript');
    expect(nodes[0].markdown).toContain('Note: a description line');
  });
});

describe('serializeNodeAttributes', () => {
  it('emits shape and wireframe when set', () => {
    expect(serializeNodeAttributes({ shape: 'torus', wireframe: 'true' })).toBe(
      ' shape="torus" wireframe="true"'
    );
  });

  it('omits wireframe when false', () => {
    expect(serializeNodeAttributes({ wireframe: 'false' })).toBe('');
  });

  it('emits color when set', () => {
    expect(serializeNodeAttributes({ color: '#ff9900' })).toBe(' color="#ff9900"');
  });

  it('returns an empty string with no attributes', () => {
    expect(serializeNodeAttributes({})).toBe('');
  });
});

describe('compileBlock', () => {
  it('generates network-node elements with ids, names, and metadata', () => {
    const html = compileBlock({ info: '', body: 'JavaScript:\n  # EcmaScript (JavaScript)\n  The most widely used language.' });
    expect(html).toContain('<network-node id="javascript" name="JavaScript">');
    expect(html).toContain('<h3>EcmaScript (JavaScript)</h3>');
    expect(html).toContain('<p>The most widely used language.</p>');
    expect(html).toContain('</network-node>');
  });

  it('applies node attributes from edge endpoints', () => {
    const html = compileBlock({
      info: '',
      body: 'JavaScript:\n  # JS\n\n---\n(JavaScript|wireframe:true;shape:torus) --> (HTML|wireframe:true;shape:cube)',
    });
    expect(html).toContain('<network-node id="javascript" name="JavaScript" shape="torus" wireframe="true">');
    expect(html).toContain('<network-node id="html" name="HTML" shape="cube" wireframe="true">');
  });

  it('generates network-edge elements referencing slugified ids', () => {
    const html = compileBlock({
      info: '',
      body: 'Software:\n  # Software\n\n---\n(Framework Du Jour) --> (Software)',
    });
    expect(html).toContain('<network-edge source="framework-du-jour" target="software"></network-edge>');
  });

  it('wraps output in a network-visualization element with info-string attributes', () => {
    const html = compileBlock({ info: ' scale=1.2', body: 'A:\n  # A\n\n---\n(A) --> (B)' });
    expect(html).toContain('<network-visualization scale="1.2">');
    expect(html.trim().endsWith('</network-visualization>')).toBe(true);
  });
});

describe('compileMarkdown', () => {
  it('produces a complete HTML document', () => {
    const html = compileMarkdown(SAMPLE_BLOCK, { title: 'Network Skills' });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<title>Network Skills</title>');
    expect(html).toContain('<script type="module" src="/network-visualization.min.js"></script>');
  });

  it('includes the compiled visualization inside the page', () => {
    const html = compileMarkdown(SAMPLE_BLOCK);
    expect(html).toContain('<network-visualization scale="1.2">');
    expect(html).toContain('<network-node id="javascript" name="JavaScript" shape="torus" wireframe="true">');
    expect(html).toContain('<network-edge source="javascript" target="html"></network-edge>');
  });

  it('renders markdown outside of blocks as document content', () => {
    const html = compileMarkdown(`# Skills\n\nIntro paragraph.\n\n${SAMPLE_BLOCK}`);
    expect(html).toContain('<h3>Skills</h3>');
    expect(html).toContain('<p>Intro paragraph.</p>');
  });

  it('escapes the document title', () => {
    const html = compileMarkdown(SAMPLE_BLOCK, { title: '<b>skills</b>' });
    expect(html).toContain('<title>&lt;b&gt;skills&lt;/b&gt;</title>');
  });
});