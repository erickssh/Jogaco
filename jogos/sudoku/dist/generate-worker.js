importScripts('engine.js');

self.onmessage = ({ data: level }) => {
  try {
    self.postMessage(SudokuEngine.generate(level));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
