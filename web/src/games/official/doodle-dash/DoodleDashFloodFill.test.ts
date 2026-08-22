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

  it('absorbs the translucent antialias fringe inside a solid boundary', () => {
    const width = 9;
    const height = 9;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const boundary = [20, 39, 71, 255] as const;
    const antialias = [20, 39, 71, 242] as const;
    const replacement = [20, 39, 71, 255] as const;

    for (let coordinate = 1; coordinate <= 7; coordinate += 1) {
      setPixel(pixels, width, coordinate, 1, boundary);
      setPixel(pixels, width, coordinate, 7, boundary);
      setPixel(pixels, width, 1, coordinate, boundary);
      setPixel(pixels, width, 7, coordinate, boundary);
    }
    for (let coordinate = 2; coordinate <= 6; coordinate += 1) {
      setPixel(pixels, width, coordinate, 2, antialias);
      setPixel(pixels, width, coordinate, 6, antialias);
      setPixel(pixels, width, 2, coordinate, antialias);
      setPixel(pixels, width, 6, coordinate, antialias);
    }

    expect(floodFillDoodleDashPixels(pixels, width, height, 4, 4, replacement)).toBe(true);
    expect(pixelAt(pixels, width, 2, 4)).toEqual(replacement);
    expect(pixelAt(pixels, width, 1, 4)).toEqual(boundary);
    expect(pixelAt(pixels, width, 0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('keeps an opaque outline intact when filling with a contrasting color', () => {
    const width = 7;
    const height = 7;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const boundary = [20, 39, 71, 255] as const;
    const antialias = [20, 39, 71, 96] as const;
    const replacement = [239, 91, 80, 255] as const;

    for (let coordinate = 1; coordinate <= 5; coordinate += 1) {
      setPixel(pixels, width, coordinate, 1, boundary);
      setPixel(pixels, width, coordinate, 5, boundary);
      setPixel(pixels, width, 1, coordinate, boundary);
      setPixel(pixels, width, 5, coordinate, boundary);
    }
    setPixel(pixels, width, 2, 3, antialias);

    expect(floodFillDoodleDashPixels(pixels, width, height, 3, 3, replacement)).toBe(true);
    expect(pixelAt(pixels, width, 2, 3)).toEqual(replacement);
    expect(pixelAt(pixels, width, 1, 3)).toEqual(boundary);
    expect(pixelAt(pixels, width, 0, 3)).toEqual([0, 0, 0, 0]);
  });

  it('recolors the cleaned antialias fringe on a later fill', () => {
    const width = 7;
    const height = 7;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const boundary = [20, 39, 71, 255] as const;
    const antialias = [20, 39, 71, 128] as const;
    const firstFill = [239, 91, 80, 255] as const;
    const secondFill = [49, 85, 217, 255] as const;

    for (let coordinate = 0; coordinate < height; coordinate += 1) {
      setPixel(pixels, width, 1, coordinate, boundary);
      setPixel(pixels, width, 5, coordinate, boundary);
      setPixel(pixels, width, 2, coordinate, antialias);
      setPixel(pixels, width, 4, coordinate, antialias);
    }

    expect(floodFillDoodleDashPixels(pixels, width, height, 3, 3, firstFill)).toBe(true);
    expect(pixelAt(pixels, width, 2, 3)).toEqual(firstFill);
    expect(floodFillDoodleDashPixels(pixels, width, height, 3, 3, secondFill)).toBe(true);
    expect(pixelAt(pixels, width, 2, 3)).toEqual(secondFill);
    expect(pixelAt(pixels, width, 1, 3)).toEqual(boundary);
    expect(pixelAt(pixels, width, 0, 3)).toEqual([0, 0, 0, 0]);
  });
});
