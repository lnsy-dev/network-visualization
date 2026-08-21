# Build Scripts

This directory contains build-time transformation scripts for the project.

## transform-workers.js

This script automatically embeds Web Worker code into the main bundle during the build process.

### What it does

1. **Scans** source files for worker imports using `new Worker(new URL('./file.js', import.meta.url))`.
2. **Reads** the worker file contents.
3. **Transforms** the code to embed the worker as a string using the Blob/Object URL pattern.
4. **Replaces** the original worker import with inline worker creation.

### When it runs

This loader runs automatically as part of the webpack JavaScript pipeline for every `.js` file.

### Why this approach?

By embedding workers as strings in the bundle:

- ✅ Single file deployment (works with unpkg.com and other CDNs)
- ✅ No separate worker files to manage
- ✅ No CORS issues
- ✅ Workers and main code always in sync
- ✅ Standard Web Worker API in source code

### Example transformation

**Before transformation:**

```javascript
const worker = new Worker(new URL('./example-webworker.js', import.meta.url));
```

**After transformation:**

```javascript
const worker = (function() {
  const __workerCode = `self.onmessage = (e) => { /* worker code */ };`;
  const blob = new Blob([__workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
})();
```
