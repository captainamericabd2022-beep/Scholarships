"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// All dialogs live outside blurred/transformed dashboard ancestors.
export default function ModalLayer({ className, onClose, children }: {
  className: string; onClose: () => void; children: ReactNode;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const layer = layerRef.current;
    const dialog = layer?.querySelector<HTMLElement>("[role=dialog]");
    if (!layer || !dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const scrollTop = window.scrollY, scrollLeft = window.scrollX;
    const original = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    const background = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer && !element.contains(layer));
    const originalInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollTop}px`;
    document.body.style.width = "100%";
    const targets = () => [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']")].filter((element) => element.getClientRects().length && !element.closest("[inert]"));
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = targets(), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.tabIndex = -1;
    (dialog.querySelector<HTMLElement>(".close-button") ?? targets()[0] ?? dialog).focus({ preventScroll: true });
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      background.forEach((element, index) => { element.inert = originalInert[index]; });
      Object.assign(document.body.style, original);
      window.scrollTo(scrollLeft, scrollTop);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
  return typeof document === "undefined" ? null : createPortal(<div ref={layerRef} className={`modal-root ${className}`}>{children}</div>, document.body);
}
