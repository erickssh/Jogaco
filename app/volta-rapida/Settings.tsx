"use client";

import type { Preferences } from "./preferences";
import { languageNames, text, type Language, type MessageKey } from "../../public/volta-rapida/i18n";
import styles from "./racer.module.css";

type SettingsProps = {
  preferences: Preferences;
  update: (changes: Partial<Preferences>) => void;
  expanded: boolean;
  toggleFullscreen: () => void;
};

export function LanguageSelect({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <label className={styles.field}>{text(language,"language")}
    <select value={language} onChange={event=>onChange(event.target.value as Language)}>
      {Object.entries(languageNames).map(([code,name])=><option key={code} value={code} lang={code}>{name}</option>)}
    </select>
  </label>;
}

export function Settings({ preferences, update, expanded, toggleFullscreen }: SettingsProps) {
  const t = (key: MessageKey) => text(preferences.language,key);
  return <div className={styles.menuStack}>
    <fieldset className={styles.fieldset}>
      <legend>{t("audio")}</legend>
      <div className={styles.menuStack}>
        <label className={styles.field}>
          <span className={styles.sliderLabel}>{t("musicVolume")} <output>{Math.round(preferences.musicVolume*100)}%</output></span>
          <input aria-label={t("musicVolume")} type="range" min="0" max="100" value={Math.round(preferences.musicVolume*100)}
            onChange={event=>update({musicVolume:Number(event.target.value)/100})}/>
        </label>
        <label className={styles.field}>
          <span className={styles.sliderLabel}>{t("effectsVolume")} <output>{Math.round(preferences.effectsVolume*100)}%</output></span>
          <input aria-label={t("effectsVolume")} type="range" min="0" max="100" value={Math.round(preferences.effectsVolume*100)}
            onChange={event=>update({effectsVolume:Number(event.target.value)/100})}/>
        </label>
        <label className={styles.check}><input type="checkbox" checked={preferences.muted} onChange={event=>update({muted:event.target.checked})}/>
          {t("muteAll")}
        </label>
      </div>
    </fieldset>
    <LanguageSelect language={preferences.language} onChange={language=>update({language})}/>
    <button type="button" className={styles.secondary} aria-pressed={expanded} onClick={toggleFullscreen}>
      {expanded?t("fullscreenOff"):t("fullscreenOn")}
    </button>
  </div>;
}
