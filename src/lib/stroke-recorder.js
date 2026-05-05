/**
 * Captures pointer input on the canvas and pushes completed strokes
 * into the store. One stroke = one pointerdown→pointerup motion.
 */
export function setupStrokeRecorder(state, renderer) {
  const canvas = state.canvas;
  let active = null;

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      t: performance.now(),
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    active = [canvasPoint(e)];
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    active.push(canvasPoint(e));
    renderer.render();
    drawActiveStroke(active);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!active) return;
    if (active.length >= 2) {
      state.store.addStroke(active);
    }
    active = null;
  });

  canvas.addEventListener('pointercancel', () => {
    active = null;
    renderer.render();
  });

  function drawActiveStroke(points) {
    const ctx = canvas.getContext('2d');
    if (points.length < 2) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = state.brushRadius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  return {};
}