/* ============================================================
   Clipboard — shared text clipboard for all apps.
   Uses navigator.clipboard when available, falls back to a
   localStorage-backed clipboard that survives reloads.
   ============================================================ */

(function () {
  "use strict";

  const LS_KEY = "cg.os.clipboard";
  const listeners = new Set();

  function readLS() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
    catch { return null; }
  }
  function writeLS(value) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(value)); } catch {}
  }

  const clipboard = {
    /** get the current text (string) */
    async getText() {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const t = await navigator.clipboard.readText();
          if (t != null) {
            writeLS({ text: t, ts: Date.now() });
            return t;
          }
        }
      } catch (e) { /* fall through */ }
      const ls = readLS();
      return ls?.text || "";
    },

    /** set the current text */
    async setText(text) {
      const t = String(text ?? "");
      writeLS({ text: t, ts: Date.now() });
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(t);
        }
      } catch (e) { /* ignore — local copy is the persistent one */ }
      for (const fn of listeners) {
        try { fn(t); } catch (e) { console.error(e); }
      }
      return t;
    },

    /** synchronous getter using local cache (always works) */
    peek() {
      const ls = readLS();
      return ls?.text || "";
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  // re-emit on focus in case OS clipboard changed elsewhere
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // best-effort refresh from system
      clipboard.getText().catch(() => {});
    }
  });

  window.Clipboard = clipboard;
})();