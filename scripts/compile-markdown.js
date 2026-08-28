#!/usr/bin/env node
/**
 * Compile Markdown Script
 *
 * CLI wrapper around {@module compile-markdown-logic}. Converts a markdown
 * file containing ```network-visualization fenced code blocks into a
 * standalone HTML page that the <network-visualization> component renders.
 *
 * Usage:
 *
 *   node scripts/compile-markdown.js network-skills.md
 *   node scripts/compile-markdown.js network-skills.md -o out.html --title "Skills"
 *
 * @module scripts/compile-markdown
 */

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compileMarkdown } from '../src/compile-markdown-logic.js';

/**
 * Derives the default output path from an input path by swapping the
 * extension to .html.
 *
 * @param {string} inputPath - Input markdown path
 * @returns {string} Default output path
 */
function defaultOutputPath(inputPath) {
  const { dir, name } = path.parse(inputPath);
  return path.join(dir, `${name}.html`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: {
      type: 'string',
      short: 'o',
    },
    title: {
      type: 'string',
      short: 't',
    },
  },
});

const inputPath = positionals[0];

if (!inputPath) {
  console.error('Usage: node scripts/compile-markdown.js <input.md> [-o output.html] [--title "Title"]');
  process.exit(1);
}

try {
  const markdown = readFileSync(inputPath, 'utf-8');
  const outputPath = values.output || defaultOutputPath(inputPath);
  const title = values.title || path.parse(inputPath).name;

  const html = compileMarkdown(markdown, { title });
  writeFileSync(outputPath, html, 'utf-8');

  console.log(`Compiled ${inputPath} -> ${outputPath}`);
} catch (error) {
  console.error(`Failed to compile ${inputPath}: ${error.message}`);
  process.exit(1);
}
