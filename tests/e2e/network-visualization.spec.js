/**
 * Network Visualization E2E Tests
 *
 * End-to-end tests for the network-visualization custom element.
 */

import { test, expect } from '@playwright/test';

const TEST_PAGE = '/e2e-test.html';
const SCALED_TEST_PAGE = '/e2e-test-scaled.html';
const DEMO_PAGE = '/index.html';
const LABEL_TEST_PAGE = '/e2e-test-label.html';

/**
 * Waits until the intro camera animation has finished and nodes are settled.
 *
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<void>} Resolves when the camera animation is complete
 */
async function waitForIntroAnimation(page) {
  await page.waitForFunction(() => {
    const viz = document.querySelector('network-visualization');
    return viz && viz.sceneManager && !viz.sceneManager.cameraAnimation;
  });
}

test.describe('Network Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PAGE);
    // Wait for the component to initialize and render labels.
    await expect(page.locator('network-visualization .node-label')).toHaveCount(3);
    // Wait for the intro camera animation so node positions are stable.
    await waitForIntroAnimation(page);
  });

  test('renders a canvas and node labels', async ({ page }) => {
    const canvas = page.locator('network-visualization canvas');
    await expect(canvas).toBeVisible();

    const labels = page.locator('network-visualization .node-label');
    await expect(labels).toHaveCount(3);
    await expect(labels.nth(0)).toHaveText('Node A');
    await expect(labels.nth(1)).toHaveText('Node B');
    await expect(labels.nth(2)).toHaveText('Node C');
  });

  test('selects a node when its label is clicked', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await label.click();

    await expect(label).toHaveClass(/selected/);

    const metadata = page.locator('#metadata-panel');
    await expect(metadata).toBeVisible();
    await expect(metadata).toContainText('Node A');
    await expect(metadata).toContainText('Node B');
  });

  test('keeps all node labels visible after clicking a node', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await label.click();

    // Wait for the camera animation to complete.
    await page.waitForTimeout(900);

    const canvas = page.locator('network-visualization canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const labels = page.locator('network-visualization .node-label');
    const count = await labels.count();

    // Labels extend below their node anchors, so allow a small amount of slack
    // at the viewport edges.
    const tolerance = 10;

    for (let i = 0; i < count; i++) {
      const labelBox = await labels.nth(i).boundingBox();
      expect(labelBox).not.toBeNull();
      expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x - tolerance);
      expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y - tolerance);
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + tolerance);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + tolerance);
    }
  });

  test('emits metadata-shown event with correct detail', async ({ page }) => {
    const detailPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const viz = document.querySelector('network-visualization');
        viz.addEventListener(
          'metadata-shown',
          (e) => {
            resolve(e.detail);
          },
          { once: true }
        );
      });
    });

    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await label.click();

    const detail = await detailPromise;
    expect(detail).not.toBeNull();
    expect(detail.title).toBe('Node A');
    expect(detail.content).toContain('First test node');
    expect(detail.links).toContain('Node B');
  });

  test('clicking a connected-node link selects that node', async ({ page }) => {
    const labelA = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await labelA.click();

    const link = page.locator('#metadata-panel .connected-node', { hasText: 'Node B' });
    await link.click();

    const labelB = page.locator('network-visualization .node-label', { hasText: 'Node B' });
    await expect(labelB).toHaveClass(/selected/);

    const metadata = page.locator('#metadata-panel');
    await expect(metadata).toContainText('Node B');
  });

  test('deselects when clicking an empty area of the canvas', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await label.click();
    await expect(label).toHaveClass(/selected/);

    const canvas = page.locator('network-visualization canvas');
    const box = await canvas.boundingBox();
    // Click the bottom-right corner of the canvas away from any node and any overlay.
    await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20);

    await expect(label).not.toHaveClass(/selected/);
  });

  test('uses isometric view for selected node and top-down view when deselected', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    const canvas = page.locator('network-visualization canvas');

    const isTopDown = ({ pos, target }) => {
      const dx = Math.abs(pos[0] - target[0]);
      const dz = Math.abs(pos[2] - target[2]);
      const dy = pos[1] - target[1];
      // Top-down: camera is almost directly above the target.
      return dx < 1 && dz < 1 && dy > 50;
    };

    const isIsometric = ({ pos, target }) => {
      const dx = Math.abs(pos[0] - target[0]);
      const dy = Math.abs(pos[1] - target[1]);
      const dz = Math.abs(pos[2] - target[2]);
      // Isometric: camera is offset significantly along all three axes.
      return dx > 20 && dy > 20 && dz > 20;
    };

    const getCameraState = () => page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return {
        pos: viz.sceneManager.camera.position.toArray(),
        target: viz.sceneManager.controls.target.toArray(),
      };
    });

    // Initial overview is top-down.
    const initialState = await getCameraState();
    expect(isTopDown(initialState)).toBe(true);

    await label.click();
    await expect(label).toHaveClass(/selected/);
    await page.waitForTimeout(900);

    const focusedState = await getCameraState();
    expect(isIsometric(focusedState)).toBe(true);

    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20);
    await expect(label).not.toHaveClass(/selected/);
    await page.waitForTimeout(900);

    const resetState = await getCameraState();
    expect(isTopDown(resetState)).toBe(true);
  });

  test('shows pointer cursor when hovering over a node mesh', async ({ page }) => {
    const canvas = page.locator('network-visualization canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Compute the node mesh's screen position. We dispatch the event directly
    // on the canvas so the label overlay (which has its own pointer cursor) does
    // not intercept it.
    const screenPos = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const node = viz.nodes.find((n) => n.id === 'node-a');
      const pos = viz.sceneManager.camera.position.clone();
      pos.set(node.x, node.y, node.z);
      pos.project(viz.sceneManager.camera);
      return {
        x: ((pos.x + 1) / 2) * viz.clientWidth,
        y: ((-pos.y + 1) / 2) * viz.clientHeight,
      };
    });

    await page.evaluate(
      ({ clientX, clientY }) => {
        const canvas = document.querySelector('network-visualization canvas');
        canvas.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX,
            clientY,
            bubbles: true,
          })
        );
      },
      {
        clientX: canvasBox.x + screenPos.x,
        clientY: canvasBox.y + screenPos.y,
      }
    );

    await expect(canvas).toHaveCSS('cursor', 'pointer');

    // Move to an empty corner and confirm the cursor resets.
    await page.evaluate(
      ({ clientX, clientY }) => {
        const canvas = document.querySelector('network-visualization canvas');
        canvas.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX,
            clientY,
            bubbles: true,
          })
        );
      },
      {
        clientX: canvasBox.x + canvasBox.width - 20,
        clientY: canvasBox.y + canvasBox.height - 20,
      }
    );

    await expect(canvas).not.toHaveCSS('cursor', 'pointer');
  });

  test('highlights hovered node and label with secondary color', async ({ page }) => {
    const canvas = page.locator('network-visualization canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const screenPos = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const node = viz.nodes.find((n) => n.id === 'node-a');
      const pos = viz.sceneManager.camera.position.clone();
      pos.set(node.x, node.y, node.z);
      pos.project(viz.sceneManager.camera);
      return {
        x: ((pos.x + 1) / 2) * viz.clientWidth,
        y: ((-pos.y + 1) / 2) * viz.clientHeight,
      };
    });

    await page.evaluate(
      ({ clientX, clientY }) => {
        const canvas = document.querySelector('network-visualization canvas');
        canvas.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX,
            clientY,
            bubbles: true,
          })
        );
      },
      {
        clientX: canvasBox.x + screenPos.x,
        clientY: canvasBox.y + screenPos.y,
      }
    );

    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await expect(label).toHaveClass(/hover/);

    const hoveredColor = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const node = viz.nodes.find((n) => n.id === 'node-a');
      return node.mesh.material.color.getHexString();
    });
    expect(hoveredColor).not.toBe('ffffff'); // Hover uses --secondary, not foreground white

    // Move away and confirm hover state clears.
    await page.evaluate(
      ({ clientX, clientY }) => {
        const canvas = document.querySelector('network-visualization canvas');
        canvas.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX,
            clientY,
            bubbles: true,
          })
        );
      },
      {
        clientX: canvasBox.x + canvasBox.width - 20,
        clientY: canvasBox.y + canvasBox.height - 20,
      }
    );

    await expect(label).not.toHaveClass(/hover/);
  });

  test('highlights selected node label with accent color', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await label.click();

    await expect(label).toHaveClass(/selected/);
    await expect(label).toHaveCSS('color', 'rgb(255, 153, 0)');
  });

  test('keeps connected nodes closer together than unconnected ones', async ({ page }) => {
    const distances = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const byId = new Map(viz.nodes.map((n) => [n.id, n]));
      const dist = (a, b) =>
        Math.hypot(a.x - b.x, (a.y - b.y), a.z - b.z);

      return {
        connectedAB: dist(byId.get('node-a'), byId.get('node-b')),
        connectedBC: dist(byId.get('node-b'), byId.get('node-c')),
        unconnectedAC: dist(byId.get('node-a'), byId.get('node-c')),
      };
    });

    // The physics pass pulls edges toward the rest length (one grid spacing),
    // so connected pairs settle close while the unconnected pair is at least
    // two hops apart.
    expect(distances.connectedAB).toBeLessThan(200);
    expect(distances.connectedBC).toBeLessThan(200);
    expect(distances.unconnectedAC).toBeGreaterThan(distances.connectedAB);
    expect(distances.unconnectedAC).toBeGreaterThan(distances.connectedBC);
  });

  test('applies the scale attribute on first load', async ({ page }) => {
    await page.goto(SCALED_TEST_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(3);

    const scales = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return viz.nodes.map((n) => n.group.scale.x);
    });

    // The initial scale="2.0" must be applied even though no NODE-CHANGED
    // event fires for attributes set before the element connected.
    expect(scales).toHaveLength(3);
    scales.forEach((scale) => expect(scale).toBe(2.0));
  });

  test('flies the camera in to fit the graph on first load', async ({ page }) => {
    // Freeze time so the intro animation only progresses when we advance it.
    await page.clock.install();
    await page.goto(TEST_PAGE);

    // Advance a little: the first RAF ticks render labels and move the camera
    // ~10% into the intro (still near the top-down start pose).
    await page.clock.runFor(100);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(3);

    const midIntro = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return {
        animating: Boolean(viz.sceneManager.cameraAnimation),
        position: viz.sceneManager.camera.position.toArray(),
      };
    });

    expect(midIntro.animating).toBe(true);

    // Run the intro to completion.
    await page.clock.runFor(1000);

    const final = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return {
        animating: Boolean(viz.sceneManager.cameraAnimation),
        position: viz.sceneManager.camera.position.toArray(),
      };
    });

    expect(final.animating).toBe(false);

    // The camera must travel during the intro (tilt + zoom), not snap.
    const moved = Math.hypot(
      midIntro.position[0] - final.position[0],
      midIntro.position[1] - final.position[1],
      midIntro.position[2] - final.position[2]
    );
    expect(moved).toBeGreaterThan(1);

    // The intro starts farther above the graph and zooms in to the fitted
    // top-down overview, so the midpoint is higher than the final position.
    expect(midIntro.position[1]).toBeGreaterThan(final.position[1]);
  });

  test('updates node scale when the scale attribute changes', async ({ page }) => {
    const scalesBefore = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return viz.nodes.map((n) => ({
        id: n.id,
        scaleX: n.group.scale.x,
        scaleY: n.group.scale.y,
        scaleZ: n.group.scale.z,
      }));
    });

    await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      viz.setAttribute('scale', '2.0');
    });

    // Wait for the attribute change to propagate through the animation loop.
    await page.waitForTimeout(200);

    const scalesAfter = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return viz.nodes.map((n) => ({
        id: n.id,
        scaleX: n.group.scale.x,
        scaleY: n.group.scale.y,
        scaleZ: n.group.scale.z,
      }));
    });

    scalesBefore.forEach((before) => {
      const after = scalesAfter.find((s) => s.id === before.id);
      expect(after.scaleX).toBeGreaterThan(before.scaleX);
      expect(after.scaleY).toBeGreaterThan(before.scaleY);
      expect(after.scaleZ).toBeGreaterThan(before.scaleZ);
    });
  });

  test('resizes the canvas when the element is resized', async ({ page }) => {
    const canvas = page.locator('network-visualization canvas');
    const boxBefore = await canvas.boundingBox();
    expect(boxBefore).not.toBeNull();

    await page.evaluate(() => {
      const element = document.querySelector('network-visualization');
      element.style.width = '400px';
      element.style.height = '300px';
    });

    // Wait for the ResizeObserver + requestAnimationFrame resize to apply.
    await page.waitForTimeout(200);

    const boxAfter = await canvas.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(boxAfter.width).toBeGreaterThanOrEqual(398);
    expect(boxAfter.width).toBeLessThanOrEqual(402);
    expect(boxAfter.height).toBeGreaterThanOrEqual(298);
    expect(boxAfter.height).toBeLessThanOrEqual(302);
  });

  test('updates node and edge colors when the foreground theme changes', async ({ page }) => {
    const initialColors = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const nodeColor = viz.nodes[0].mesh.material.color.getHexString();
      const edgeColor = viz.links[0].line.material.color.getHexString();
      return { nodeColor, edgeColor };
    });

    // The E2E test page starts with a white foreground.
    expect(initialColors.nodeColor).toBe('ffffff');
    expect(initialColors.edgeColor).toBe('ffffff');

    // Switch the theme by changing the CSS variable and triggering the observer.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--foreground-color', '#000000');
      document.documentElement.classList.add('theme-dark');
    });

    // Wait for the MutationObserver callback + material update.
    await page.waitForTimeout(100);

    const updatedColors = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const nodeColor = viz.nodes[0].mesh.material.color.getHexString();
      const edgeColor = viz.links[0].line.material.color.getHexString();
      return { nodeColor, edgeColor };
    });

    expect(updatedColors.nodeColor).toBe('000000');
    expect(updatedColors.edgeColor).toBe('000000');
  });
});

test.describe('Network Label', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LABEL_TEST_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(2);
    await waitForIntroAnimation(page);
  });

  test('built-in HUD shows custom network-label content before selection', async ({ page }) => {
    const hud = page.locator('network-visualization .network-hud');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Custom starting aside:');
    await expect(hud).toContainText('select something');
    await expect(hud.locator('strong')).toHaveText('select something');
  });

  test('built-in HUD returns to custom network-label content after deselecting', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Node A' });
    await label.click();

    const hud = page.locator('network-visualization .network-hud');
    await expect(hud).toContainText('Node A');

    const canvas = page.locator('network-visualization canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20);

    await expect(hud).toContainText('Custom starting aside:');
    await expect(hud).toContainText('select something');
  });
});

test.describe('Network Visualization Demo Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(24);
    // Wait for the intro camera animation so node positions are stable.
    await waitForIntroAnimation(page);
  });

  test('fits all visible node labels inside the viewport on load', async ({ page }) => {
    const canvas = page.locator('network-visualization canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const labels = page.locator('network-visualization .node-label');
    const count = await labels.count();

    // HTML labels overhang their node anchors by their own pixel width, which
    // the world-space fit cannot fully account for; allow a generous slack.
    const tolerance = 20;

    for (let i = 0; i < count; i++) {
      const label = labels.nth(i);
      const isHidden = await label.evaluate((el) => el.style.visibility === 'hidden');
      if (isHidden) continue;

      const labelBox = await label.boundingBox();
      expect(labelBox).not.toBeNull();
      expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x - tolerance);
      expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y - tolerance);
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + tolerance);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + tolerance);
    }
  });

  test('resizes the canvas when the window is resized', async ({ page }) => {
    // Start wide so the element sits at its .page-constrained size, then
    // narrow the window: width shrinks and height follows via aspect-ratio.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(24);

    const canvas = page.locator('network-visualization canvas');
    const boxBefore = await canvas.boundingBox();
    expect(boxBefore).not.toBeNull();

    await page.setViewportSize({ width: 600, height: 900 });
    // Wait for the ResizeObserver + RAF resize to apply.
    await page.waitForTimeout(200);

    const boxAfter = await canvas.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(boxAfter.width).toBeLessThan(boxBefore.width - 50);
    expect(boxAfter.height).toBeLessThan(boxBefore.height - 50);

    // Restore the default viewport for subsequent tests.
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('visualization is never taller than the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(24);

    const vizBox = await page.locator('network-visualization').boundingBox();
    expect(vizBox).not.toBeNull();
    expect(vizBox.height).toBeLessThanOrEqual(600);
  });

  test('built-in HUD shows default empty state before selection', async ({ page }) => {
    const hud = page.locator('network-visualization .network-hud');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Select a node or group to see details.');
  });

  test('built-in HUD shows selected node metadata', async ({ page }) => {
    // The demo page hides labels at the overview zoom level, so select the node
    // through the component API instead of clicking a label.
    await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      viz.selectNodeById('javascript');
    });

    const hud = page.locator('network-visualization .network-hud');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('JavaScript');
    await expect(hud).toContainText('Connected');
  });

  test('built-in HUD extends past the element instead of covering it', async ({ page }) => {
    await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      viz.selectNodeById('javascript');
    });

    const hud = page.locator('network-visualization .network-hud');
    await expect(hud).toBeVisible();

    const vizBox = await page.locator('network-visualization').boundingBox();
    const hudBox = await hud.boundingBox();
    expect(vizBox).not.toBeNull();
    expect(hudBox).not.toBeNull();

    // The aside must start at (or beyond) the right edge of the element.
    expect(hudBox.x).toBeGreaterThanOrEqual(vizBox.x + vizBox.width - 1);
  });

  test('clipping lives on the canvas viewport, not the host element', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const viewport = viz.querySelector('.network-canvas');
      return {
        host: window.getComputedStyle(viz).overflow,
        viewport: viewport ? window.getComputedStyle(viewport).overflow : null,
      };
    });

    expect(overflow.host).toBe('visible');
    expect(overflow.viewport).toBe('hidden');
  });

  test('updates node and edge colors when the foreground theme changes', async ({ page }) => {
    const initialColors = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const nodeColor = viz.nodes[0].mesh.material.color.getHexString();
      const edgeColor = viz.links[0].line.material.color.getHexString();
      return { nodeColor, edgeColor };
    });

    // The demo page starts with a black foreground.
    expect(initialColors.nodeColor).toBe('000000');
    expect(initialColors.edgeColor).toBe('000000');

    // Switch the theme by changing the CSS variable and triggering the observer.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--foreground-color', '#ffffff');
      document.documentElement.classList.add('theme-dark');
    });

    // Wait for the MutationObserver callback + material update.
    await page.waitForTimeout(100);

    const updatedColors = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const nodeColor = viz.nodes[0].mesh.material.color.getHexString();
      const edgeColor = viz.links[0].line.material.color.getHexString();
      return { nodeColor, edgeColor };
    });

    expect(updatedColors.nodeColor).toBe('ffffff');
    expect(updatedColors.edgeColor).toBe('ffffff');
  });

  test('regular wheel scrolls the page and Shift+wheel zooms the camera', async ({ page }) => {
    // Ensure the page is tall enough to scroll.
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(24);

    // Regular wheel should scroll the page.
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);
    const scrollAfterRegularWheel = await page.evaluate(() => window.scrollY);
    expect(scrollAfterRegularWheel).toBeGreaterThan(0);

    // Reset scroll.
    await page.evaluate(() => window.scrollTo(0, 0));

    // Record camera distance before Shift+wheel.
    const distanceBefore = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return viz.sceneManager.camera.position.distanceTo(viz.sceneManager.controls.target);
    });

    // Shift+wheel over the canvas should zoom.
    await page.keyboard.down('Shift');
    await page.evaluate(() => {
      const canvas = document.querySelector('network-visualization canvas');
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -500,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);
    });
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);

    const distanceAfter = await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      return viz.sceneManager.camera.position.distanceTo(viz.sceneManager.controls.target);
    });

    expect(distanceAfter).not.toBe(distanceBefore);
  });

  test('hides labels at overview zoom and shows them after zooming in', async ({ page }) => {
    // Opt in to label hiding for this test.
    await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      viz.setAttribute('labels-zoom-level', '2');
    });
    await page.waitForTimeout(200);

    const labels = page.locator('network-visualization .node-label');
    const count = await labels.count();
    expect(count).toBe(24);

    // At the overview zoom level (zoom === 1), labels should be hidden because
    // the threshold is 2.
    const hiddenAtOverview = await labels.evaluateAll((elements) =>
      elements.every((el) => el.style.visibility === 'hidden')
    );
    expect(hiddenAtOverview).toBe(true);

    // Zoom in by moving the camera to one third of the fitted distance from
    // the target, which makes the zoom level 3 (> 2).
    await page.evaluate(() => {
      const viz = document.querySelector('network-visualization');
      const sm = viz.sceneManager;
      const target = sm.controls.target;
      const pos = sm.camera.position;
      const dx = pos.x - target.x;
      const dy = pos.y - target.y;
      const dz = pos.z - target.z;
      const currentDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const scale = (sm.fitDistance / 3) / currentDistance;
      pos.set(
        target.x + dx * scale,
        target.y + dy * scale,
        target.z + dz * scale
      );
      sm.controls.update();
    });

    // Wait for the animation loop to update label visibility.
    await page.waitForTimeout(200);

    const visibleAfterZoom = await labels.evaluateAll((elements) =>
      elements.every((el) => el.style.visibility === 'visible')
    );
    expect(visibleAfterZoom).toBe(true);
  });
});
