"use client";

import { useEffect, useRef, useState } from "react";
import type { Circuit } from "./championship";
import type { Preferences } from "./preferences";

const menuFile = "menu-theme.wav";
const fadeTime = .14;
type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type Playback = { context: AudioContext; voices: Map<string,Voice> };

export function useSoundtrack(preferences: Preferences, enabled: boolean, circuit: Circuit, racing: boolean) {
  const playback = useRef<Playback | null>(null);
  const buffers = useRef(new Map<string,AudioBuffer>());
  const [preparedFor,setPreparedFor] = useState<string>();
  const raceFile = circuit.music?.file;
  const raceGain = circuit.music?.gain ?? 0;
  const preparationKey = raceFile ?? menuFile;

  useEffect(() => {
    const request = new AbortController();
    const load = async () => {
      try {
        const decoder = new OfflineAudioContext(1,1,22050);
        const files = raceFile ? [menuFile,raceFile] : [menuFile];
        await Promise.allSettled(files.map(async file => {
          if (buffers.current.has(file)) return;
          const response = await fetch("/volta-rapida/audio/"+file,{signal:request.signal});
          if (!response.ok) return;
          const track = await decoder.decodeAudioData(await response.arrayBuffer());
          if (!request.signal.aborted) buffers.current.set(file,track);
        }));
      } finally {
        if (!request.signal.aborted) setPreparedFor(preparationKey);
      }
    };
    void load().catch(()=>{});
    return () => request.abort();
  }, [preparationKey,raceFile]);

  useEffect(() => () => {
    if (playback.current) void playback.current.context.close().catch(()=>{});
    playback.current = null;
  }, []);

  const ready = preparedFor === preparationKey;
  const volume = enabled && !preferences.muted ? preferences.musicVolume : 0;
  const selectedFile = racing ? raceFile : menuFile;
  const mixVolume = racing ? volume * raceGain : preferences.musicMuted ? 0 : volume;

  useEffect(() => {
    function applyMix(engine: Playback) {
      const { context, voices } = engine;
      const now = context.currentTime;
      if (selectedFile && mixVolume > 0 && !voices.has(selectedFile)) {
        const track = buffers.current.get(selectedFile);
        if (track) {
          const gain = context.createGain();
          gain.gain.value = 0;
          gain.connect(context.destination);
          const source = context.createBufferSource();
          source.buffer = track;
          source.loop = true;
          source.connect(gain);
          source.start();
          voices.set(selectedFile,{source,gain});
        }
      }
      for (const [file, voice] of voices) {
        const level = file === selectedFile ? mixVolume : 0;
        voice.gain.gain.setTargetAtTime(level,now,fadeTime);
        if (file !== menuFile && file !== raceFile) {
          voice.source.onended = () => voice.gain.disconnect();
          voice.source.stop(now+fadeTime*7);
          voices.delete(file);
        }
      }
    }

    if (playback.current) {
      try { applyMix(playback.current); } catch {}
    }
    if (!ready || !enabled || !window.AudioContext) return;

    function unlock(event: Event) {
      if (!event.isTrusted) return;
      try {
        playback.current ??= { context:new AudioContext(), voices:new Map() };
        const engine = playback.current;
        applyMix(engine);
        if (engine.context.state !== "running") void engine.context.resume().catch(()=>{});
      } catch {
        // Audio output may be unavailable while the rest of the game remains usable.
      }
    }
    window.addEventListener("pointerup",unlock);
    window.addEventListener("keydown",unlock);
    return () => {
      window.removeEventListener("pointerup",unlock);
      window.removeEventListener("keydown",unlock);
    };
  }, [enabled,mixVolume,raceFile,ready,selectedFile]);

  return ready;
}
