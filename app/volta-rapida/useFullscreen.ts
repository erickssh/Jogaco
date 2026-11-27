"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useFullscreen() {
  const shell = useRef<HTMLDivElement>(null);
  const fallback = useRef(false);
  const [expanded,setExpanded] = useState(false);
  const [scale,setScale] = useState(1);

  const toggleFullscreen = useCallback(async () => {
    const element = shell.current;
    if (!element) return;
    if (document.fullscreenElement === element) {
      await document.exitFullscreen().catch(()=>{});
      return;
    }
    if (fallback.current) {
      fallback.current = false;
      setExpanded(false);
      return;
    }
    if (element.requestFullscreen) {
      try {
        await element.requestFullscreen();
        return;
      } catch {}
    }
    fallback.current = true;
    setExpanded(true);
  },[]);

  useEffect(() => {
    const sync = () => setExpanded(fallback.current || document.fullscreenElement === shell.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !fallback.current) return;
      fallback.current = false;
      sync();
    };
    document.addEventListener("fullscreenchange",sync);
    window.addEventListener("keydown",escape);
    return () => {
      document.removeEventListener("fullscreenchange",sync);
      window.removeEventListener("keydown",escape);
    };
  },[]);

  useEffect(() => {
    if (!expanded) {
      setScale(1);
      return;
    }
    const measure = () => {
      const element=shell.current;
      if (!element) return;
      const {width,height}=element.getBoundingClientRect();
      setScale(Math.max(1,Math.min(1.65,width/1120,height/740)));
    };
    measure();
    const observer=new ResizeObserver(measure);
    if (shell.current) observer.observe(shell.current);
    return ()=>observer.disconnect();
  },[expanded]);

  return { shell, expanded, scale, toggleFullscreen };
}
