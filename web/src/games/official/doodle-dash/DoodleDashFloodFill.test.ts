import { describe, expect, it } from 'vitest';
import { floodFillDoodleDashPixels } from './DoodleDashFloodFill';

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, rgba: readonly number[]) {
  const offset = (y * width + x) * 4;
  data.set(rgba, offset);
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return Array.from(data.slice(offset, offset + 4));
}

describe('floodFillDoodleDashPixels', () => {
  it('fills only the transparent area enclosed by a solid boundary', () => {
    const width = 7;
    const height = 7;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const boundary = [20, 39, 71, 255] as const;
    for (let coordinate = 1; coordinate <= 5; coordinate += 1) {
      setPixel(pixels, width, coordinate, 1, boundary);
      setPixel(pixels, width, coordinate, 5, boundary);
      setPixel(pixels, width, 1, coordinate, boundary);
      setPixel(pixels, width, 5, coordinate, boundary);
    }

    expect(floodFillDoodleDashPixels(pixels, width, height, 3, 3, [239, 91, 80, 255])).toBe(true);
    expect(pixelAt(pixels, width, 3, 3)).toEqual([239, 91, 80, 255]);
    expect(pixelAt(pixels, width, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(pixels, width, 1, 3)).toEqual(boundary);
  });
});
