/**
 * Animates the reveal using the actual ink pixels from the source image,
 * masked by the per-pixel timestamp buffer.
 *
 * On play(), builds a timestamp buffer from the recorded strokes, then animates
 * a `_Progress` value [0, 1] that gates which pixels are visible.
 */
export function setupPreview(state) {
  const canvas = state.canvas;
  const ctx = canvas.getContext('2d');

  let raf = null;
  let startTime = 0;
  let animationDurationMs = 0;

  // Cached per-play to avoid recomputing on every frame
  let timestampBuf = null;
  let inkBuf = null;
  let bufWidth = 0;
  let bufHeight = 0;

  function play() {
    if (state.store.strokes.length === 0) return;
    if (!state.sourceImage) return;

    cancel();
    buildBuffers();
    startTime = performance.now();
    tick();
  }

  function cancel() {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function buildBuffers() {
    const width = state.sourceImage.width;
    const height = state.sourceImage.height;
    bufWidth = width;
    bufHeight = height;

    // Read source ink: store luminance per pixel, [0, 255] where 0 = ink, 255 = white
    const tmp = document.createElement('canvas');
    tmp.width = width;
    tmp.height = height;
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.drawImage(state.sourceImage, 0, 0);
    const src = tmpCtx.getImageData(0, 0, width, height);

    inkBuf = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = src.data[i * 4];
      const g = src.data[i * 4 + 1];
      const b = src.data[i * 4 + 2];
      inkBuf[i] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }

    // Build timestamp buffer from strokes (same logic as encoder)
    timestampBuf = new Uint8ClampedArray(width * height);
    timestampBuf.fill(255);

    const resampled = state.store.strokes.map((s) => resampleByArcLength(s, 1.0));
    const lengths = resampled.map(arcLengthOf);

    if (state.parallelMode) {
      const n = resampled.length;
      const totalDurationMs = state.previewDurationMs + (n - 1) * state.strokeDelayMs;
      animationDurationMs = totalDurationMs;

      for (let i = 0; i < n; i++) {
        const stroke = resampled[i];
        const strokeLen = lengths[i];
        if (strokeLen === 0) continue;

        const startByte = Math.round((i * state.strokeDelayMs / totalDurationMs) * 255);
        const endByte   = Math.round(((i * state.strokeDelayMs + state.previewDurationMs) / totalDurationMs) * 255);
        const range = endByte - startByte;

        let localCumulative = 0;
        for (let j = 0; j < stroke.length; j++) {
          const localLen = j > 0 ? distance(stroke[j - 1], stroke[j]) : 0;
          localCumulative += localLen;
          const t = localCumulative / strokeLen;
          stampDisc(timestampBuf, width, height, stroke[j].x, stroke[j].y,
            state.brushRadius, startByte + Math.round(t * range), 255);
        }
      }
    } else {
      animationDurationMs = state.previewDurationMs;
      const total = lengths.reduce((a, b) => a + b, 0);
      if (total === 0) return;

      let cumulative = 0;
      for (let i = 0; i < resampled.length; i++) {
        const stroke = resampled[i];
        const strokeStart = cumulative;

        for (let j = 0; j < stroke.length; j++) {
          const localLen = j > 0 ? distance(stroke[j - 1], stroke[j]) : 0;
          cumulative += localLen;
          const t = cumulative / total;
          stampDisc(timestampBuf, width, height, stroke[j].x, stroke[j].y,
            state.brushRadius, Math.round(t * 255), 255);
        }

        cumulative = strokeStart + lengths[i];
      }
    }
  }

  function tick() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / animationDurationMs);

    drawFrame(progress);

    if (progress < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
      setTimeout(() => state.requestRender(), 600);
    }
  }

  function drawFrame(progress) {
    const progressByte = Math.round(progress * 255);

    // Build output: black background, white ink revealed where timestamp <= progress
    const out = ctx.createImageData(bufWidth, bufHeight);

    for (let i = 0; i < bufWidth * bufHeight; i++) {
      const luma = inkBuf[i];
      const t = timestampBuf[i];

      // Ink intensity: 1 where black, 0 where white. Linear ramp.
      const inkAmount = (255 - luma) / 255;

      // Visibility: fully on if timestamp has been reached, off otherwise
      const revealed = t <= progressByte ? 1 : 0;

      const intensity = Math.round(255 * inkAmount * revealed);

      out.data[i * 4]     = intensity; // R
      out.data[i * 4 + 1] = intensity; // G
      out.data[i * 4 + 2] = intensity; // B
      out.data[i * 4 + 3] = 255;       // A
    }

    // Black background, then the white ink composited on top
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(out, 0, 0);
  }

  return { play, cancel };
}

// -----------------------------------------------------------------------------
// Shared math (duplicated from encoder.js for module isolation)

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