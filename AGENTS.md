# Agent Conventions for Network Visualization

This file governs all code in this directory and its subdirectories.

## Technology Stack

- **JavaScript**: Vanilla ES2020+ (no frameworks)
- **CSS**: Standard CSS with variables (no CSS-in-JS, no Shadow DOM)
- **Build Tool**: Webpack 5 with SWC transpilation
- **Custom Elements**: dataroom-js (extends HTMLElement)
- **Workers**: Web Workers with custom inline bundling
- **3D Rendering**: Three.js
- **Testing**: Vitest (unit), Playwright (E2E)

## Code Style

### Comments

Use **DocBlock style comments** for all classes, methods, and exported functions:

```javascript
/**
 * Brief description.
 *
 * @param {string} paramName Description
 * @returns {number} Description
 */
```

Use inline `//` comments for implementation logic.

### Custom Elements

```javascript
import DataroomElement from 'dataroom-js';

class MyComponent extends DataroomElement {
  async initialize() {
    // Component setup
  }
}

if (!customElements.get('my-component')) {
  customElements.define('my-component', MyComponent);
}
```

Rules:

- Element names MUST contain a hyphen
- NEVER use Shadow DOM
- NEVER embed CSS in JavaScript
- Create CSS in `styles/<component-name>.css` and import in `index.css`

### Web Workers

Always use this exact syntax:

```javascript
const worker = new Worker(new URL('./my-worker.js', import.meta.url));
```

Never use string paths: `new Worker('./worker.js')` — bundlers cannot trace them.

### Testing

**Directive:** Write and run tests for every feature you add or change. Use each suite below for its stated purpose, keep all of them green, and add a matching test whenever you introduce new behavior.

#### E2E Tests (Playwright)

- Use `@playwright/test` for all E2E tests
- Place tests in `tests/e2e/*.spec.js`
- Run with `npm test`; debug with `npm run test:ui`; verify the production build with `npm run test:prod`
- Use `page.locator()` for element selection
- Use `page.evaluate()` for testing custom events
- Every user-facing feature MUST have an E2E test; run the suite before considering any change complete

#### Unit Tests (Vitest)

- Use `vitest`; place tests in `tests/unit/*.test.js`
- Run with `npm run test:unit`
- Unit tests target pure logic only — no DOM, no dev server. Extract logic from components into `src/*-logic.js` modules and test those
- Assert exact values, not just definedness — weak assertions produce surviving mutants
- New logic MUST ship with unit tests in the same change

### State Management

- Use component instance properties (`this.propertyName`)
- Emit custom events for cross-component communication via `this.event('name', detail)`
- Listen to events via `this.on('name', callback)` or `this.once('name', callback)`

### HTTP Requests

- Use `this.getJSON(url)` for simple GET requests to JSON endpoints
- Use `this.call(endpoint, body)` for POST requests with auth/timeout support
- Always wrap in `try/catch` for error handling

## File Organization

| Directory | Purpose |
|-----------|---------|
| `src/` | JavaScript modules and components |
| `styles/` | CSS files (one per component or concern) |
| `tests/` | Test files |
| `scripts/` | Build-time transformation scripts |
| `assets/` | Static files (images, fonts, etc.) |

## Prohibited Patterns

- ❌ TypeScript
- ❌ React/Vue/Angular/Svelte
- ❌ Shadow DOM
- ❌ CSS-in-JS (styled-components, emotion, etc.)
- ❌ Inline styles in JavaScript
- ❌ Framework-specific state managers (Redux, Pinia, etc.)
- ❌ jQuery or similar DOM wrappers
- ❌ `new Worker('./relative-path.js')` (use `new URL(..., import.meta.url)`)
