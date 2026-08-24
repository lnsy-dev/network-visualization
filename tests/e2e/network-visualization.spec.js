/**
 * Network Visualization E2E Tests
 *
 * End-to-end tests for the network-visualization custom element.
 */

import { test, expect } from '@playwright/test';

const TEST_PAGE = '/e2e-test.html';
const DEMO_PAGE = '/index.html';

test.describe('Network Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PAGE);
    // Wait for the component to initialize and render labels.
    await expect(page.locator('network-visualization .node-label')).toHaveCount(3);
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

    for (let i = 0; i < count; i++) {
      const labelBox = await labels.nth(i).boundingBox();
      expect(labelBox).not.toBeNull();
      expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
      expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
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
});

test.describe('Network Visualization Demo Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(7);
  });

  test('fits all node labels inside the viewport on load', async ({ page }) => {
    const canvas = page.locator('network-visualization canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const labels = page.locator('network-visualization .node-label');
    const count = await labels.count();

    for (let i = 0; i < count; i++) {
      const labelBox = await labels.nth(i).boundingBox();
      expect(labelBox).not.toBeNull();
      expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
      expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
    }
  });

  test('resizes the canvas when the window is resized', async ({ page }) => {
    // Start wide so the element sits at its .page-constrained size, then
    // narrow the window: width shrinks and height follows via aspect-ratio.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(7);

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
    await expect(page.locator('network-visualization .node-label')).toHaveCount(7);

    const vizBox = await page.locator('network-visualization').boundingBox();
    expect(vizBox).not.toBeNull();
    expect(vizBox.height).toBeLessThanOrEqual(600);
  });

  test('built-in HUD shows selected node metadata', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Nodes' });
    await label.click();

    const hud = page.locator('network-visualization .network-hud');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Nodes');
    await expect(hud).toContainText('Edges');
  });

  test('built-in HUD extends past the element instead of covering it', async ({ page }) => {
    const label = page.locator('network-visualization .node-label', { hasText: 'Nodes' });
    await label.click();

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

  test('regular wheel scrolls the page and Shift+wheel zooms the camera', async ({ page }) => {
    // Ensure the page is tall enough to scroll.
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(DEMO_PAGE);
    await expect(page.locator('network-visualization .node-label')).toHaveCount(7);

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
});
