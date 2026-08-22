export type DoodleDashRgba = readonly [red: number, green: number, blue: number, alpha: number];

function matchesColor(data: Uint8ClampedArray, offset: number, color: DoodleDashRgba) {
  return (
    data[offset] === color[0] &&
    data[offset + 1] === color[1] &&
    data[offset + 2] === color[2] &&
    data[offset + 3] === color[3]
  );
}

export function doodleDashHexToRgba(color: string): DoodleDashRgba {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-f]{6}$/iu.test(normalized)) throw new Error('Invalid Doodle Dash fill color.');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    255,
  ];
}

export function floodFillDoodleDashPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  replacement: DoodleDashRgba
): boolean {
  const pixelCount = width * height;
  if (
    width < 1 ||
    height < 1 ||
    data.length !== pixelCount * 4 ||
    seedX < 0 ||
    seedX >= width ||
    seedY < 0 ||
    seedY >= height
  ) {
    return false;
  }

  const seedIndex = seedY * width + seedX;
  const seedOffset = seedIndex * 4;
  const target: DoodleDashRgba = [
    data[seedOffset] ?? 0,
    data[seedOffset + 1] ?? 0,
    data[seedOffset + 2] ?? 0,
    data[seedOffset + 3] ?? 0,
  ];
  if (target.every((channel, index) => channel === replacement[index])) return false;

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let readIndex = 0;
  let writeIndex = 1;
  queue[0] = seedIndex;
  visited[seedIndex] = 1;
  const enqueueMatchingPixel = (candidate: number) => {
    if (visited[candidate] === 1) return;
    visited[candidate] = 1;
    if (!matchesColor(data, candidate * 4, target)) return;
    queue[writeIndex] = candidate;
    writeIndex += 1;
  };

  while (readIndex < writeIndex) {
    const pixelIndex = queue[readIndex] ?? 0;
    readIndex += 1;
    const offset = pixelIndex * 4;
    data[offset] = replacement[0];
    data[offset + 1] = replacement[1];
    data[offset + 2] = replacement[2];
    data[offset + 3] = replacement[3];

    const x = pixelIndex % width;
    if (x > 0) enqueueMatchingPixel(pixelIndex - 1);
    if (x + 1 < width) enqueueMatchingPixel(pixelIndex + 1);
    if (pixelIndex >= width) enqueueMatchingPixel(pixelIndex - width);
    if (pixelIndex + width < pixelCount) enqueueMatchingPixel(pixelIndex + width);
  }
  return true;
}

export function floodFillDoodleDashCanvas(
  context: CanvasRenderingContext2D,
  normalizedX: number,
  normalizedY: number,
  color: string
) {
  const { width, height } = context.canvas;
  if (width < 1 || height < 1) return;
  const pixels = context.getImageData(0, 0, width, height);
  const changed = floodFillDoodleDashPixels(
    pixels.data,
    width,
    height,
    Math.min(width - 1, Math.max(0, Math.floor(normalizedX * width))),
    Math.min(height - 1, Math.max(0, Math.floor(normalizedY * height))),
    doodleDashHexToRgba(color)
  );
  if (changed) context.putImageData(pixels, 0, 0);
}
