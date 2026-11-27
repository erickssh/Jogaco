"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { championshipCalendar, forestCircuit, pointsByPlace, seasonLengths } from "./championship";
import { accessForCode, cleanCode, playerLimit, type Access, type PublicRoom } from "./rooms";
import { LanguageSelect, Settings } from "./Settings";
import { CarPicker } from "./CarPicker";
import type { Preferences } from "./preferences";
import { text, type MessageKey } from "../../public/volta-rapida/i18n";
import styles from "./racer.module.css";

export const difficulties = ["facil", "medio", "dificil"] as const;
export type Difficulty = typeof difficulties[number];
export type MenuScreen = "main" | "single" | "quick" | "career" | "online" | "create" | "join" | "settings" | "language";

type Props = {
  screen: MenuScreen;
  shown: boolean;
  navigate: (screen: MenuScreen) => void;
  invite: string;
  onlineAvailable: boolean;
  rooms: PublicRoom[];
  directoryStatus: "loading" | "ready" | "lost";
  pending: boolean;
  starting: boolean;
  parkedRace: boolean;
  notice: string;
  preferences: Preferences;
  update: (changes: Partial<Preferences>) => void;
  expanded: boolean;
  toggleFullscreen: () => void;
  onRace: (difficulty: Difficulty, bots: number, carModel: string) => void;
  onRoom: (details: { name: string; password: string; code: string; access: Access; host: boolean; carModel: string }) => void;
};

const panels = {
  main: {},
  single: { back:"main" },
  quick: { back:"single" },
  career: { back:"single" },
  online: { back:"main" },
  create: { back:"online" },
  join: { back:"online" },
  settings: { back:"main" },
  language: { back:"main" },
} as const;

function Choice({ title, children, onClick }: { title:string; children?:ReactNode; onClick:()=>void }) {
  return <button type="button" className={styles.choice} onClick={onClick}>
    <span><strong>{title}</strong>{children && <span>{children}</span>}</span><span className={styles.arrow} aria-hidden="true">›</span>
  </button>;
}

type MenuControls = Pick<Props,"preferences"|"update"|"expanded"|"toggleFullscreen">;

export function MenuHeader({preferences,update,expanded,toggleFullscreen,home=false}:MenuControls & {home?:boolean}) {
  const t=(key:MessageKey, values?: Record<string, number>)=>text(preferences.language,key,values);
  const musicEnabled=!preferences.musicMuted && !preferences.muted;
  return <header className={styles.menuHeader}>
    <img src="/volta-rapida/overdrive-mark.webp" alt="Overdrive" width="1080" height="720"/>
    <div className={styles.headerActions}>
      {home && <button type="button" className={styles.musicButton} aria-pressed={musicEnabled}
        aria-label={musicEnabled?t("musicOn"):t("musicOff")}
        title={musicEnabled?t("muteMusic"):t("enableMusic")}
        disabled={preferences.muted} onClick={()=>update({musicMuted:!preferences.musicMuted})}>
        <span aria-hidden="true">♫</span>
      </button>}
      <button type="button" className={styles.secondary} aria-pressed={expanded} onClick={toggleFullscreen}>
        <span aria-hidden="true">⛶</span> {expanded?t("fullscreenOff"):t("fullscreenOn")}
      </button>
    </div>
  </header>;
}

export function Menu({
  screen,shown,navigate,invite,onlineAvailable,rooms,directoryStatus,pending,starting,parkedRace,notice,onRace,onRoom,...controls
}:Props) {
  const title=useRef<HTMLElement>(null);
  const {preferences,update}=controls;
  const t=(key:MessageKey, values?: Record<string, number>)=>text(preferences.language,key,values);
  const [difficulty,setDifficulty]=useState<Difficulty>("medio");
  const [bots,setBots]=useState(7);
  const [carModel,setCarModel]=useState("");
  const [stages,setStages]=useState<number>(seasonLengths[1]);
  const [name,setName]=useState("");
  const [code,setCode]=useState(invite);
  const [password,setPassword]=useState("");
  const [access,setAccess]=useState<Access>("publica");
  const [selectedRoom,setSelectedRoom]=useState("");
  const calendar=championshipCalendar(stages);
  const available=calendar.filter(stage=>stage.circuit).length;
  const joinAccess=accessForCode(cleanCode(code));
  const panel=panels[screen];
  const canJoinPublic=rooms.some(room=>room.code===selectedRoom && !room.racing && room.seats<playerLimit);
  const picker=<CarPicker title={t("chooseCar")} value={carModel} onChange={setCarModel}/>;

  useEffect(() => { if (shown) title.current?.focus({preventScroll:true}); }, [screen,shown]);

  function back(dest: MenuScreen) {
    setPassword("");
    navigate(dest);
  }

  return <div className={styles.menuShell} lang={preferences.language} data-screen={screen}>
    <MenuHeader {...controls} home={screen==="main"}/>
    <div className={styles.menuLayout}>
      <section key={screen} className={styles.menuPanel} data-main={screen==="main"} aria-label={t(screen)}
        tabIndex={-1} ref={title}>
        {"back" in panel && <button className={styles.back} type="button" onClick={()=>back(panel.back)}>‹ {t("back")}</button>}
        {screen!=="main" && <h2>{t(screen)}</h2>}
        {screen==="main" && <nav className={styles.mainMenu} aria-label={t("modes")}>
          {(["single","online","settings","language"] as const).map(option=>
            <Choice key={option} title={t(option==="online" && parkedRace ? "returnRace" : option)} onClick={()=>navigate(option)}/>)}
        </nav>}
        {screen==="settings" && <Settings {...controls}/>}
        {screen==="language" && <LanguageSelect language={preferences.language} onChange={language=>update({language})}/>}
        {screen==="single" && <div className={styles.menuStack}>
          <Choice title={t("quick")} onClick={()=>navigate("quick")}>{t("quickHint")}</Choice>
          <Choice title={t("career")} onClick={()=>navigate("career")}>{t("careerHint")}</Choice>
        </div>}
        {screen==="quick" && <form className={styles.menuStack} onSubmit={event=>{event.preventDefault();onRace(difficulty,bots,carModel);}}>
          <p className={styles.detail}>{forestCircuit.name} <span aria-hidden="true">·</span> {t("laps")}</p>
          <div className={styles.quickLayout}>
            <div className={styles.menuStack}>
              <label className={styles.field}>{t("botCount")}<select value={bots} onChange={event=>setBots(Number(event.target.value))}>
                {Array.from({length:8},(_,count)=><option value={count} key={count}>{count===0?t("clearTrack"):count===1?t("oneBot"):t("manyBots",{n:count})}</option>)}
              </select></label>
              <fieldset className={styles.fieldset} disabled={bots===0}>
                <legend>{t("botDifficulty")}</legend>
                <div className={styles.segments}>{difficulties.map(level=><label key={level}>
                  <input type="radio" name="quick-difficulty" value={level} checked={difficulty===level} onChange={()=>setDifficulty(level)}/>
                  <span>{t(level)}</span>
                </label>)}</div>
              </fieldset>
            </div>
            {picker}
          </div>
          <button className={styles.primary} type="submit" disabled={starting || !carModel}>
            {starting?t("preparing"):t("goToTrack")}
          </button>
        </form>}
        {screen==="career" && <div className={styles.menuStack}>
          <p className={styles.detail}>{t("scoringHint")}</p>
          <label className={styles.field}>{t("rounds")}<select value={stages} onChange={event=>setStages(Number(event.target.value))}>
            {seasonLengths.map(count=><option key={count}>{count}</option>)}
          </select></label>
          <ol className={styles.calendar}>{calendar.map(stage=><li key={stage.number}>
            <span>{stage.number}. {stage.circuit?.name ?? t("trackTba")}</span>
            <span>{stage.circuit ? t("available") : t("comingSoon")}</span>
          </li>)}</ol>
          <details className={styles.scoring}><summary>{t("scoring")}</summary><p>{pointsByPlace.map((score,i)=>
            <span key={score}>{t("ordinal",{n:i+1})} <strong>{score}</strong></span>)}</p></details>
          <button className={styles.primary} type="button" disabled>{t("startChampionship")}</button>
          <p className={styles.detail}>{t("roundsAvailable",{count:available,total:stages})}</p>
        </div>}
        {screen==="online" && <div className={styles.menuStack}>
          <Choice title={t("create")} onClick={()=>navigate("create")}>{t("createHint")}</Choice>
          <Choice title={t("join")} onClick={()=>navigate("join")}>{t("joinHint")}</Choice>
        </div>}
        {(screen==="create" || screen==="join") && !onlineAvailable &&
          <p className={styles.detail} role="status">{t("onlineUnavailable")}</p>}
        {screen==="create" && onlineAvailable && <form className={styles.menuStack} onSubmit={event=>{
          event.preventDefault();
          onRoom({name,password,code:"",access,host:true,carModel});
        }}>
          <label className={styles.field}>{t("yourName")}<input value={name} maxLength={24} onChange={event=>setName(event.target.value)} autoComplete="nickname"/></label>
          <fieldset className={styles.fieldset}>
            <legend>{t("roomAccess")}</legend>
            <div className={styles.segments}>{(["publica","privada"] as const).map(value=><label key={value}>
              <input type="radio" name="room-access" checked={access===value} onChange={()=>{setAccess(value);setPassword("");}}/>
              <span>{value==="publica"?t("public"):t("private")}</span>
            </label>)}</div>
          </fieldset>
          {access==="privada" && <label className={styles.field}>{t("password")}
            <input type="password" value={password} minLength={8} maxLength={64} required placeholder={t("minPassword")}
              autoComplete="new-password" onChange={event=>setPassword(event.target.value)}/>
          </label>}
          {picker}
          <button className={styles.primary} type="submit" disabled={pending || !carModel}>{pending?t("creating"):t("create")}</button>
        </form>}
        {screen==="join" && onlineAvailable && <div className={styles.menuStack}>
          <label className={styles.field}>{t("yourName")}<input value={name} maxLength={24} onChange={event=>setName(event.target.value)} autoComplete="nickname"/></label>
          {picker}
          <form className={styles.menuStack} onSubmit={event=>{
            event.preventDefault();
            onRoom({name,password:"",code:selectedRoom,access:"publica",host:false,carModel});
          }}>
            <label className={styles.field}>{t("publicRooms")}<select value={selectedRoom} onChange={event=>setSelectedRoom(event.target.value)}>
              <option value="">{directoryStatus==="loading"?t("findingRooms"):directoryStatus==="lost"?t("listUnavailable"):
                rooms.length?t("pickRoom"):t("noRooms")}</option>
              {rooms.map(room=><option key={room.code} value={room.code} disabled={room.racing || room.seats>=playerLimit}>
                {room.host} · {room.seats}/{playerLimit}{room.racing?" · "+t("racing"):room.seats>=playerLimit?" · "+t("full"):""}
              </option>)}
            </select></label>
            <button className={styles.secondary} type="submit" disabled={pending || !canJoinPublic || !carModel}>{t("joinPublic")}</button>
          </form>
          <form className={styles.invite} onSubmit={event=>{
            event.preventDefault();
            onRoom({name,password,code,access:joinAccess ?? "publica",host:false,carModel});
          }}>
            <label className={styles.field}>{t("inviteCode")}<input value={code} maxLength={300} required onChange={event=>setCode(event.target.value)} autoComplete="off"/></label>
            {joinAccess==="privada" && <label className={styles.field}>{t("password")}<input type="password" value={password} required maxLength={64}
              autoComplete="current-password" onChange={event=>setPassword(event.target.value)}/></label>}
            <button className={styles.primary} type="submit" disabled={pending || !carModel}>{pending?t("connecting"):t("joinInvite")}</button>
          </form>
        </div>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </section>
    </div>
  </div>;
}
