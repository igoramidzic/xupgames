import { describe, expect, it } from 'vitest';
import {
  type CanvasSize,
  clampCamera,
  cursorColor,
  cursorInterpolation,
  cursorScreenPosition,
  fitZoom,
  isEntireWorldVisible,
} from './DrawingCanvas';

const desktop: CanvasSize = { width: 1000, height: 640, pixelRatio: 1 };

describe('drawing canvas camera', () => {
  it('keeps the same zoom when the viewport shrinks', () => {
    const initialZoom = fitZoom(desktop);
    const smallerViewport: CanvasSize = { width: 520, height: 640, pixelRatio: 1 };
    const resized = clampCamera({ centerX: 800, centerY: 500, zoom: initialZoom }, smallerViewport);

    expect(resized.zoom).toBe(initialZoom);
    expect(smallerViewport.width / resized.zoom).toBeLessThan(1600);
  });

  it('keeps the camera inside the fixed drawing world while panning', () => {
    const zoom = 0.8;
    const viewport: CanvasSize = { width: 640, height: 480, pixelRatio: 1 };
    const camera = clampCamera({ centerX: 10_000, centerY: -10_000, zoom }, viewport);

    expect(camera.centerX).toBe(1200);
    expect(camera.centerY).toBe(300);
  });

  it('only needs the minimap when part of the drawing is outside the viewport', () => {
    const fittedCamera = { centerX: 800, centerY: 500, zoom: fitZoom(desktop) };
    const zoomedCamera = { ...fittedCamera, zoom: fittedCamera.zoom * 1.25 };

    expect(isEntireWorldVisible(fittedCamera, desktop)).toBe(true);
    expect(isEntireWorldVisible(zoomedCamera, desktop)).toBe(false);
  });

  it('projects shared world cursors into the local camera', () => {
    const camera = { centerX: 800, centerY: 500, zoom: 0.5 };

    expect(cursorScreenPosition({ x: 0.5, y: 0.5 }, camera, desktop)).toEqual({ x: 500, y: 320 });
    expect(cursorScreenPosition({ x: 0.75, y: 0.25 }, camera, desktop)).toEqual({ x: 700, y: 195 });
  });

  it('assigns a stable visual color to each member', () => {
    expect(cursorColor('member-alpha')).toBe(cursorColor('member-alpha'));
    expect(cursorColor('member-alpha')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('eases remote cursors toward each new network position', () => {
    expect(cursorInterpolation(0)).toBe(0);
    expect(cursorInterpolation(16)).toBeGreaterThan(0);
    expect(cursorInterpolation(16)).toBeLessThan(cursorInterpolation(64));
    expect(cursorInterpolation(64)).toBeLessThan(1);
  });
});
