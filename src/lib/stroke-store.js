/**
 * In-memory store of strokes. Each stroke is an array of {x, y, t}
 * where t is the wall-clock time at sample (raw, normalized later).
 */
export function createStrokeStore() {
  const strokes = [];
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => fn(strokes));
  }

  return {
    get strokes() { return strokes; },
    addStroke(stroke) { strokes.push(stroke); emit(); },
    undo() {
      if (strokes.length === 0) return;
      strokes.pop();
      emit();
    },
    clear() {
      strokes.length = 0;
      emit();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}