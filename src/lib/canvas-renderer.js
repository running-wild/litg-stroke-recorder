/**
 * Renders the source image and recorded strokes to the canvas.
 * Strokes are drawn with their stroke index as a debug hue, so
 * authoring is visually clear during recording.
 */
export function setupCanvas(state) {
  const canvas = state.canvas;
  const ctx = canvas.getContext('2d');

  function resize(width, height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.maxHeight = '80vh';
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Source image at adjustable opacity
    if (state.sourceImage) {
      ctx.globalAlpha = state.sourceOpacity;
      ctx.drawImage(state.sourceImage, 0, 0);
      ctx.globalAlpha = 1.0;
    }

    // Strokes, hue-coded by index for visual feedback during authoring
    const strokes = state.store.strokes;
    strokes.forEach((stroke, i) => {
      if (stroke.length < 2) return;
      const hue = (i * 47) % 360;
      ctx.strokeStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
      ctx.lineWidth = state.brushRadius * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let j = 1; j < stroke.length; j++) {
        ctx.lineTo(stroke[j].x, stroke[j].y);
      }
      ctx.stroke();
    });
  }

  state.store.onChange(render);

  return { resize, render };
}