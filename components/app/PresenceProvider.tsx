"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { touchLastSeen } from "@/lib/actions/presence";

const IDLE_AFTER_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 45 * 1000;

export type PresenceStatus = "online" | "idle";

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  status: PresenceStatus;
  since: string;
}

interface PresenceContextValue {
  selfStatus: PresenceStatus;
  online: PresenceUser[];
}

const PresenceContext = createContext<PresenceContextValue>({ selfStatus: "online", online: [] });

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceProvider({
  userId,
  orgId,
  name,
  role,
  children,
}: {
  userId: string;
  orgId: string;
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [selfStatus, setSelfStatus] = useState<PresenceStatus>("online");
  const statusRef = useRef<PresenceStatus>("online");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:org:${orgId}`, {
      config: { presence: { key: userId } },
    });

    function track(status: PresenceStatus) {
      statusRef.current = status;
      setSelfStatus(status);
      channel.track({ userId, name, role, status, since: new Date().toISOString() });
    }

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users = Object.values(state)
          .map((entries) => entries[0])
          .filter((u): u is PresenceUser & { presence_ref: string } => !!u);
        setOnline(users);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") track("online");
      });

    touchLastSeen();
    const heartbeat = window.setInterval(() => touchLastSeen(), HEARTBEAT_MS);

    let idleTimer: number;
    function resetIdleTimer() {
      window.clearTimeout(idleTimer);
      if (statusRef.current === "idle") track("online");
      idleTimer = window.setTimeout(() => track("idle"), IDLE_AFTER_MS);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(idleTimer);
        track("idle");
      } else {
        resetIdleTimer();
      }
    }

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer));
    document.addEventListener("visibilitychange", onVisibilityChange);
    resetIdleTimer();

    return () => {
      window.clearInterval(heartbeat);
      window.clearTimeout(idleTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [userId, orgId, name, role]);

  return <PresenceContext.Provider value={{ selfStatus, online }}>{children}</PresenceContext.Provider>;
}
