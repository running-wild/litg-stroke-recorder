/**
 * Encodes recorded strokes into a PNG by writing per-pixel timestamps
 * into the green channel of the source image.
 *
 * Format:
 *   R = source luminance (preserved)
 *   G = timestamp [0, 255], normalized across all strokes
 *   B = 0
 *   A = 255
 *
 * Algorithm:
 *   1. Resample each stroke at fixed pixel-spacing for uniform arc-length distribution
 *   2. Compute cumulative arc length across all strokes (continuous, not per-stroke)
 *   3. Normalize total length to [0, 1] for timestamps
 *   4. Stamp each resampled point as a filled disc of radius `brushRadius` into a
 *      timestamp buffer (first-write-wins; later overlapping strokes don't overwrite).
 *   5. Compose final image: copy source R channel, write G from timestamp buffer,
 *      B=0, A=255
 */
export function encodeStrokes({ sourceImage, strokes, brushRadius }) {
  if (!sourceImage || strokes.length === 0) {
    throw new Error('Cannot encode: no source image or no strokes recorded.');
  }

  const width = sourceImage.width;
  const height = sourceImage.height;

  // 1. Resample strokes by arc length (1px spacing) and compute cumulative length.
  const resampled = strokes.map((s) => resampleByArcLength(s, 1.0));
  const strokeLengths = resampled.map(arcLengthOf);
  const totalLength = strokeLengths.reduce((a, b) => a + b, 0);

  if (totalLength === 0) {
    throw new Error('Cannot encode: total stroke length is zero.');
  }

  // 2. Assign normalized timestamp [0,1] to each resampled point.
  let cumulative = 0;
  const timestampedPoints = [];
  for (let i = 0; i < resampled.length; i++) {
    const stroke = resampled[i];
    const strokeStartLen = cumulative;

    for (let j = 0; j < stroke.length; j++) {
      const localLen = j > 0 ? distance(stroke[j - 1], stroke[j]) : 0;
      cumulative += localLen;
      const t = cumulative / totalLength;
      timestampedPoints.push({ x: stroke[j].x, y: stroke[j].y, t });
    }

    // Ensure stroke boundaries match `strokeStartLen + strokeLengths[i]`
    cumulative = strokeStartLen + strokeLengths[i];
  }

  // 3. Read source pixel data.
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(sourceImage, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, width, height);

  // 4. Build timestamp buffer.
  // Use 255 as "untouched" sentinel (matches spec: non-ink pixels = 255).
  const timestampBuf = new Uint8ClampedArray(width * height);
  timestampBuf.fill(255);

  for (const pt of timestampedPoints) {
    stampDisc(timestampBuf, width, height, pt.x, pt.y,
              brushRadius, Math.round(pt.t * 255), 255);
  }

  // 5. Compose output. R channel is source luminance, G is timestamp, B=0, A=255.
  const outData = new ImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const srcOffset = i * 4;
    const outOffset = i * 4;

    // R: preserve source luminance. If the source isn't grayscale,
    // use the perceptual luminance from sRGB.
    const r = srcData.data[srcOffset];
    const g = srcData.data[srcOffset + 1];
    const b = srcData.data[srcOffset + 2];
    const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    outData.data[outOffset]     = luma;            // R
    outData.data[outOffset + 1] = timestampBuf[i]; // G
    outData.data[outOffset + 2] = 0;               // B
    outData.data[outOffset + 3] = 255;             // A
  }

  // 6. Render to canvas, return as blob URL.
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  outCanvas.getContext('2d').putImageData(outData, 0, 0);

  return new Promise((resolve, reject) => {
    outCanvas.toBlob((blob) => {
      if (!blob) reject(new Error('toBlob returned null'));
      else resolve(blob);
    }, 'image/png');
  });
}

// -----------------------------------------------------------------------------

function resampleByArcLength(points, spacing) {
  if (points.length < 2) return points.slice();

  const out = [points[0]];
  let leftover = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = distance(a, b);
    if (segLen === 0) continue;

    const dx = (b.x - a.x) / segLen;
    const dy = (b.y - a.y) / segLen;

    let walked = -leftover;
    while (walked + spacing <= segLen) {
      walked += spacing;
      out.push({ x: a.x + dx * walked, y: a.y + dy * walked });
    }
    leftover = segLen - walked;
  }

  // Always include the last point so stroke endpoints are exact.
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail.x !== last.x || tail.y !== last.y) out.push({ x: last.x, y: last.y });

  return out;
}

function arcLengthOf(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Stamps a filled disc of `value` into `buf` at integer pixel coordinates.
 * First-write-wins: later overwrites get discarded.
 */
function stampDisc(buf, width, height, cx, cy, radius, value, untouched) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) {
        const idx = y * width + x;
        if (buf[idx] === untouched) {
          buf[idx] = value;
        }
      }
    }
  }
}