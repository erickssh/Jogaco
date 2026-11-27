"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";

export const playerLimit = 4;
export type Access = "publica" | "privada";
export type PublicRoom = { code: string; host: string; seats: number; racing: boolean };

const newCode = /^[rp][a-f0-9]{24}$/;
const legacyCode = /^[a-z0-9]{16}$/;

export function cleanCode(raw: string) {
  const text = raw.trim();
  let value = text;
  try { value = new URL(text).searchParams.get("sala") ?? ""; } catch {}
  return value.toLowerCase();
}

export function accessForCode(code: string): Access | undefined {
  if (newCode.test(code)) return code.startsWith("p") ? "privada" : "publica";
  if (legacyCode.test(code)) return "publica";
}

function toHex(buffer: Uint8Array) {
  return [...buffer].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createRoomCode(access: Access) {
  return (access === "privada" ? "p" : "r") + toHex(crypto.getRandomValues(new Uint8Array(12)));
}

export async function roomTopic(code: string, password: string) {
  if (accessForCode(code) !== "privada") {
    return (legacyCode.test(code) ? "volta-rapida-v2-" : "overdrive-room-v1-") + code;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode("overdrive/" + code), iterations: 120_000, hash: "SHA-256" }, key, 256,
  );
  return "overdrive-private-v1-" + toHex(new Uint8Array(bits));
}

function directoryRooms(channel: RealtimeChannel) {
  return Object.entries(channel.presenceState<PublicRoom>()).flatMap(([key, entries]) => {
    const entry = entries.find(room => room.code === key && newCode.test(key) && accessForCode(key) === "publica" &&
      typeof room.host === "string" && Number.isInteger(room.seats) && room.seats > 0 && room.seats <= playerLimit &&
      typeof room.racing === "boolean");
    return entry ? [{ ...entry, host: entry.host.slice(0,24) }] : [];
  }).sort((a,b) => Number(a.racing) - Number(b.racing) || b.seats - a.seats || a.host.localeCompare(b.host));
}

export function usePublicRooms(enabled: boolean, listing: PublicRoom | null) {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [directoryStatus, setDirectoryStatus] = useState<"loading" | "ready" | "lost">("loading");
  const state = useRef<{ channel: RealtimeChannel; subscribed: boolean } | null>(null);
  const current = useRef(listing);
  const code = listing?.code;
  useEffect(() => { current.current = listing; }, [listing]);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!enabled || !client) return;
    const channel = client.channel("overdrive-public-rooms-v1", {
      config: { presence: { key: code ?? crypto.randomUUID() } },
    });
    const session = { channel, subscribed: false };
    state.current = session;
    channel.on("presence", { event: "sync" }, () => {
      if (state.current !== session) return;
      setRooms(directoryRooms(channel));
      setDirectoryStatus("ready");
    }).subscribe(status => {
      if (state.current !== session) return;
      session.subscribed = status === "SUBSCRIBED";
      if (session.subscribed && current.current) void channel.track(current.current);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setDirectoryStatus("lost");
    });
    return () => {
      state.current = null;
      void client.removeChannel(channel);
    };
  }, [enabled, code]);

  useEffect(() => {
    const session = state.current;
    if (session?.subscribed && listing) void session.channel.track(listing);
  }, [listing]);
  return { rooms, directoryStatus };
}
