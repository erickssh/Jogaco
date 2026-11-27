"use client";

import { useEffect, useState } from "react";

import { normalizeLanguage, type Language } from "../../public/volta-rapida/i18n";
export type { Language } from "../../public/volta-rapida/i18n";
export type Preferences = {
  language: Language;
  musicVolume: number;
  effectsVolume: number;
  musicMuted: boolean;
  muted: boolean;
};

const key = "overdrive.preferences";
const defaults: Preferences = {
  language: "pt-BR", musicVolume: .35, effectsVolume: 1, musicMuted: false, muted: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      if (saved) {
        const volume = (value: unknown, fallback: number) =>
          typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1,value)) : fallback;
        setPreferences({
          language: normalizeLanguage(saved.language),
          musicVolume: volume(saved.musicVolume, defaults.musicVolume),
          effectsVolume: volume(saved.effectsVolume, defaults.effectsVolume),
          musicMuted: saved.musicMuted === true,
          muted: saved.muted === true,
        });
      } else if (localStorage.getItem("volta-rapida-muted") === "1") {
        setPreferences({ ...defaults, muted: true });
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(key, JSON.stringify(preferences)); } catch {}
  }, [loaded, preferences]);

  function update(change: Partial<Preferences>) {
    setPreferences(previous => ({ ...previous, ...change }));
  }
  return { preferences, loaded, update };
}
