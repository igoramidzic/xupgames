export type DoodleDashRgba = readonly [red: number, green: number, blue: number, alpha: number];

const OPAQUE_ALPHA = 255;
const CANVAS_BACKGROUND_CHANNEL = 255;
// Only translucent pixels use this tolerance; opaque ink remains the hard boundary.
// This reaches the nearly opaque fringe of the darkest palette color when composited on white.
const ANTIALIAS_VISIBLE_CHANNEL_TOLERANCE = 224;

function matchesColor(data: Uint8ClampedArray, offset: number, color: DoodleDashRgba) {
  return (
    data[offset] === color[0] &&
    data[offset + 1] === color[1] &&
    data[offset + 2] === color[2] &&
    data[offset + 3] === color[3]
  );
}

function visibleChannel(channel: number, alpha: number) {
  return Math.round((channel * alpha + CANVAS_BACKGROUND_CHANNEL * (OPAQUE_ALPHA - alpha)) / OPAQUE_ALPHA);
}

function matchesFillRegion(data: Uint8ClampedArray, offset: number, target: DoodleDashRgba) {
  if (matchesColor(data, offset, target)) return true;

  const candidateAlpha = data[offset + 3] ?? 0;
  if (target[3] !== 0 || candidateAlpha === OPAQUE_ALPHA) return false;

  for (let channelIndex = 0; channelIndex < 3; channelIndex += 1) {
    const candidateChannel = data[offset + channelIndex] ?? 0;
    const candidateVisible = visibleChannel(candidateChannel, candidateAlpha);
    const targetVisible = visibleChannel(target[channelIndex], target[3]);
    if (Math.abs(candidateVisible - targetVisible) > ANTIALIAS_VISIBLE_CHANNEL_TOLERANCE) {
      return false;
    }
  }
  return true;
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
    if (!matchesFillRegion(data, candidate * 4, target)) return;
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
