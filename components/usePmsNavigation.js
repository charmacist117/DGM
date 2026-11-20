"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { readPmsView, writePmsView } from "@/lib/pms/navigation";

export default function usePmsNavigation() {
  const [view, setView] = useState(() => readPmsView());
  const current = useRef(view);
  const currentSearch = useRef("");
  const positions = useRef(new Map());
  const pendingTop = useRef(null);

  useLayoutEffect(() => {
    const pathname = window.location.pathname;
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const load = (restoredScroll = false) => {
      currentSearch.current = window.location.search;
      current.current = readPmsView(currentSearch.current);
      setView({ ...current.current, restoredScroll });
    };
    const backOrForward = () => {
      if (window.location.pathname !== pathname) return;
      positions.current.set(currentSearch.current, window.scrollY);
      const previousTop = positions.current.get(window.location.search);
      pendingTop.current = previousTop ?? 0;
      load(previousTop !== undefined);
    };
    load();
    window.addEventListener("popstate", backOrForward);
    return () => {
      window.removeEventListener("popstate", backOrForward);
      window.history.scrollRestoration = restoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (pendingTop.current === null) return;
    const top = pendingTop.current;
    pendingTop.current = null;
    window.scrollTo({ top, left: 0, behavior: "instant" });
  }, [view]);

  const navigate = (patch, { replace = false, scroll = true } = {}) => {
    const changesModule = patch.moduleTab && patch.moduleTab !== current.current.moduleTab;
    const next = readPmsView(writePmsView({ ...(changesModule ? readPmsView() : current.current), ...patch }));
    const query = writePmsView(next);
    if (query === writePmsView(current.current)) return;
    const url = new URL(window.location.href);
    positions.current.set(currentSearch.current, window.scrollY);
    url.search = query;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    currentSearch.current = url.search;
    pendingTop.current = scroll ? 0 : null;
    current.current = next;
    setView(next);
  };

  return [view, navigate];
}
