import { setupDropZone } from './ui/drop-zone.js';
import { setupCanvas } from './lib/canvas-renderer.js';
import { setupStrokeRecorder } from './lib/stroke-recorder.js';
import { createStrokeStore } from './lib/stroke-store.js';
import { setupPreview } from './lib/preview.js';
import { setupControls } from './ui/controls.js';

const state = {
  sourceImage: null,
  store: createStrokeStore(),
  canvas: document.getElementById('canvas'),
  brushRadius: 10,
  sourceOpacity: 0.5,
  previewDurationMs: 4000,
  parallelMode: true,
  strokeDelayMs: 0,
  strokeCountEl: document.getElementById('stroke-count'),
  requestRender: null, // set below
};

const renderer = setupCanvas(state);
state.requestRender = renderer.render;

const recorder = setupStrokeRecorder(state, renderer);
const preview = setupPreview(state);

setupDropZone({
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  onImageLoaded: (img, filename) => {
    state.sourceImage = img;
    state.sourceFilename = filename;
    document.getElementById('drop-zone').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
    renderer.resize(img.width, img.height);
    renderer.render();
  },
});

setupControls({ state, renderer, recorder, preview });