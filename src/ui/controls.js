import { encodeStrokes } from '../lib/encoder.js';

export function setupControls({ state, renderer, recorder, preview }) {
  const opacity = document.getElementById('opacity-slider');
  const brush = document.getElementById('brush-radius');
  const undo = document.getElementById('btn-undo');
  const clear = document.getElementById('btn-clear');
  const previewBtn = document.getElementById('btn-preview');
  const exportBtn = document.getElementById('btn-export');

  opacity.addEventListener('input', () => {
    state.sourceOpacity = opacity.value / 100;
    renderer.render();
  });

  brush.addEventListener('input', () => {
    state.brushRadius = parseInt(brush.value, 10);
    renderer.render();
  });

  undo.addEventListener('click', () => state.store.undo());

  clear.addEventListener('click', () => {
    if (state.store.strokes.length === 0) return;
    if (confirm('Clear all strokes?')) state.store.clear();
  });

  previewBtn.addEventListener('click', () => {
    if (state.store.strokes.length === 0) {
      alert('Record at least one stroke before previewing.');
      return;
    }
    preview.play();
  });

  exportBtn.addEventListener('click', async () => {
    if (!state.sourceImage) {
      alert('Load a source image first.');
      return;
    }
    if (state.store.strokes.length === 0) {
      alert('Record at least one stroke before exporting.');
      return;
    }

    exportBtn.disabled = true;
    exportBtn.textContent = 'Encoding…';

    try {
      const blob = await encodeStrokes({
        sourceImage: state.sourceImage,
        strokes: state.store.strokes,
        brushRadius: state.brushRadius,
      });
      downloadBlob(blob, suggestedFilename(state));
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + err.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export PNG';
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      state.store.undo();
    }
  });

  state.store.onChange(() => {
    state.strokeCountEl.textContent =
      `${state.store.strokes.length} stroke${state.store.strokes.length === 1 ? '' : 's'}`;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function suggestedFilename(state) {
  const original = state.sourceFilename || 'img.png';
  const stem = original.replace(/\.[^.]+$/, '');
  return `${stem}.png`;
}