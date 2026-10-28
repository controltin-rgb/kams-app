"use client";

import { useEffect, useRef } from "react";
import type { SceneEventMessage } from "../events";
import { useOfficeStore } from "../store";

/** Offline longer than this → events may have been pruned or missed; reload the whole snapshot */
const RESYNC_AFTER_MS = 30_000;
/** EventSource gives up on HTTP errors (401/429/...); try again after this long */
const REOPEN_MS = 5_000;

/**
 * Live scene events over SSE (IMPLEMENTATION.md §6.3). EventSource reconnects by itself with Last-Event-ID;
 * when it gives up, or was away for over 30 s, `onResync` reloads the snapshot.
 */
export function useSceneStream(after: string | null, onEvent: (e: SceneEventMessage) => void, onResync: () => void) {
  const handlers = useRef({ onEvent, onResync });
  useEffect(() => {
    handlers.current = { onEvent, onResync };
  });

  useEffect(() => {
    const setStream = useOfficeStore.getState().setStream;
    let lastId = after ?? "0";
    let lostAt: number | null = null;
    let source: EventSource | null = null;
    let reopen: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      setStream("connecting");
      const es = new EventSource(`/api/office/stream?after=${encodeURIComponent(lastId)}`);
      source = es;
      es.addEventListener("scene", (m) => {
        const event = JSON.parse((m as MessageEvent<string>).data) as SceneEventMessage;
        lastId = event.id;
        handlers.current.onEvent(event);
      });
      es.onopen = () => {
        setStream("live");
        if (lostAt !== null && Date.now() - lostAt > RESYNC_AFTER_MS) handlers.current.onResync();
        lostAt = null;
      };
      es.onerror = () => {
        lostAt ??= Date.now();
        setStream("offline");
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          reopen = setTimeout(open, REOPEN_MS);
        }
      };
    };
    open();
    return () => {
      clearTimeout(reopen);
      source?.close();
    };
    // Opened once per page; later snapshots are matched by event id in the page, not by reconnecting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
