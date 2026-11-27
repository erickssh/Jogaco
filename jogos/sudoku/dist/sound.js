(() => {
  'use strict';

  const sounds = {
    correct: new Audio('sounds/A2.wav'),
    mistake: new Audio('sounds/E3.wav'),
    victory: new Audio('sounds/V2.wav')
  };
  for (const sound of Object.values(sounds)) sound.preload = 'auto';

  let playing;
  window.playSudokuSound = async cue => {
    const sound = sounds[cue];
    if (!sound) return;

    try {
      playing?.pause();
      playing = sound;
      sound.currentTime = 0;
      await sound.play();
    } catch {
      // O jogo continua se o navegador bloquear ou interromper o áudio.
    }
  };
})();
