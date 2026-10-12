/* ============================================================
   Winamp-style music player.
   Loads local MP3s (file input), generates a synthetic spectrum
   from the AnalyserNode when playing, falls back to a fake
   spectrum when no audio is loaded.
   ============================================================ */

(function () {
  "use strict";

  const app = {
    id: "winamp",
    name: "Winamp",
    icon: "winamp",
    category: "media",

    launch(opts = {}) {
      const winId = "winamp_" + Date.now();

      const state = Object.assign({
        playing: false,
        currentIdx: -1,
        volume: 0.6,
        eqBands: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
        playlist: [
          { title: "(no track loaded)", src: null, duration: 0 },
        ],
        seek: 0,
      }, opts.state || {});

      // --- DOM ---
      const root = document.createElement("div");
      root.className = "winamp";

      const title = document.createElement("div");
      title.className = "winamp-title";
      title.textContent = "WINAMP 2 — WEB EDITION";

      const spectrum = document.createElement("div");
      spectrum.className = "winamp-spectrum";
      const BARS = 28;
      const barEls = [];
      for (let i = 0; i < BARS; i++) {
        const b = document.createElement("div");
        b.className = "winamp-bar";
        b.style.height = "2px";
        spectrum.appendChild(b);
        barEls.push(b);
      }

      const display = document.createElement("div");
      display.className = "winamp-display";
      const trackEl = document.createElement("div");
      trackEl.className = "track";
      trackEl.textContent = state.playlist[Math.max(0, state.currentIdx)]?.title || "(no track)";
      const timeEl = document.createElement("div");
      timeEl.className = "time";
      timeEl.textContent = "00:00 / 00:00";
      display.appendChild(trackEl);
      display.appendChild(timeEl);

      const ctrls = document.createElement("div");
      ctrls.className = "winamp-ctrls";
      const ctrlsDef = ["PREV", "PLAY", "PAUSE", "STOP", "NEXT", "EXIT"];
      const ctrlsMap = {};
      ctrlsDef.forEach((c) => {
        const b = document.createElement("button");
        b.textContent = c;
        b.addEventListener("click", () => handleCtrl(c));
        ctrls.appendChild(b);
        ctrlsMap[c] = b;
      });

      const playlistEl = document.createElement("div");
      playlistEl.className = "winamp-playlist";
      renderPlaylist();

      const volumeRow = document.createElement("div");
      volumeRow.className = "winamp-volume";
      volumeRow.innerHTML = `<span>VOL</span>`;
      const vol = document.createElement("input");
      vol.type = "range"; vol.min = 0; vol.max = 100; vol.value = Math.round(state.volume * 100);
      vol.addEventListener("input", () => setVolume(vol.value / 100));
      volumeRow.appendChild(vol);

      let audio, audioContext, analyser, source, gainNode, biquads = [];
      const eq = document.createElement("div");
      eq.className = "winamp-eq";
      const bands = ["60Hz", "170Hz", "310Hz", "600Hz", "1K", "3K", "6K", "12K", "14K", "16K"];
      bands.forEach((band, i) => {
        const col = document.createElement("div");
        col.className = "slider";
        col.innerHTML = `<div class="track"><div class="thumb"></div></div><div>${band}</div>`;
        const track = col.querySelector(".track");
        const thumb = col.querySelector(".thumb");
        const setFromValue = (v) => {
          state.eqBands[i] = v;
          thumb.style.bottom = v + "%";
          if (audioContext && biquads[i]) biquads[i].gain.value = (v - 50) * 0.5;
        };
        setFromValue(state.eqBands[i]);
        track.addEventListener("click", (e) => {
          const r = track.getBoundingClientRect();
          const v = Math.max(0, Math.min(100, Math.round(((e.clientY - r.top) / r.height) * 100)));
          setFromValue(100 - v);
        });
        col.addEventListener("wheel", (e) => {
          e.preventDefault();
          setFromValue(Math.max(0, Math.min(100, state.eqBands[i] + (e.deltaY > 0 ? -4 : 4))));
        }, { passive: false });
        eq.appendChild(col);
      });

      const loadRow = document.createElement("div");
      loadRow.className = "winamp-load";
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "audio/*";
      fileInput.multiple = true;
      fileInput.style.display = "none";
      const loadBtn = document.createElement("button");
      loadBtn.className = "btn";
      loadBtn.textContent = "Load…";
      loadBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        Array.from(fileInput.files || []).forEach((f) => {
          state.playlist.push({ title: f.name, src: URL.createObjectURL(f), duration: 0, file: f });
        });
        if (state.currentIdx < 0 && state.playlist.length > 1) {
          state.currentIdx = 1; // skip the "(no track loaded)" slot
          playIdx(state.currentIdx);
        }
        renderPlaylist();
      });
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn";
      saveBtn.textContent = "Save Playlist";
      saveBtn.addEventListener("click", () => {
        const pl = state.playlist.map((t) => ({ title: t.title }));
        window.FS.write("/C:/Music/playlist.json", JSON.stringify(pl, null, 2), "application/json");
      });
      loadRow.appendChild(loadBtn);
      loadRow.appendChild(saveBtn);
      loadRow.appendChild(fileInput);

      root.appendChild(title);
      root.appendChild(spectrum);
      root.appendChild(display);
      root.appendChild(ctrls);
      root.appendChild(playlistEl);
      root.appendChild(volumeRow);
      root.appendChild(eq);
      root.appendChild(loadRow);

      // --- audio backend ---
      function ensureAudio() {
        if (audioContext) return;
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          gainNode = audioContext.createGain();
          gainNode.gain.value = state.volume;
          // build 10-band EQ
          const freqs = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
          let prev = gainNode;
          biquads = freqs.map((f) => {
            const bq = audioContext.createBiquadFilter();
            bq.type = "peaking";
            bq.frequency.value = f;
            bq.Q.value = 1;
            bq.gain.value = 0;
            prev.connect(bq);
            return bq;
          });
          biquads[biquads.length - 1].connect(analyser);
          analyser.connect(audioContext.destination);
        } catch (e) {
          console.warn("AudioContext failed:", e);
        }
      }
      function setVolume(v) {
        state.volume = v;
        if (gainNode) gainNode.gain.value = v;
        if (audio) audio.volume = v;
      }

      function playIdx(i) {
        state.currentIdx = i;
        const t = state.playlist[i];
        if (!t || !t.src) {
          trackEl.textContent = "(no track loaded — use Load…)";
          timeEl.textContent = "00:00 / 00:00";
          return;
        }
        ensureAudio();
        if (audio) { audio.pause(); audio.src = ""; }
        audio = new Audio(t.src);
        audio.crossOrigin = "anonymous";
        audio.volume = state.volume;
        audio.addEventListener("loadedmetadata", () => {
          t.duration = audio.duration;
          timeEl.textContent = `${fmt(0)} / ${fmt(t.duration)}`;
        });
        audio.addEventListener("timeupdate", () => {
          state.seek = audio.currentTime;
          timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(t.duration)}`;
        });
        audio.addEventListener("ended", () => {
          if (state.currentIdx < state.playlist.length - 1) playIdx(state.currentIdx + 1);
          else { state.playing = false; }
          renderPlaylist();
        });
        if (audioContext && source) try { source.disconnect(); } catch {}
        if (audioContext) {
          source = audioContext.createMediaElementSource(audio);
          source.connect(biquads[0]);
        }
        audio.play().catch(() => { /* ignore autoplay errors */ });
        state.playing = true;
        trackEl.textContent = t.title;
        renderPlaylist();
      }
      function fmt(s) {
        if (!isFinite(s)) return "00:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
      }

      function handleCtrl(name) {
        if (name === "PLAY") {
          if (state.currentIdx < 0) {
            const first = state.playlist.findIndex((t) => t.src);
            if (first >= 0) playIdx(first);
          } else {
            audio?.play();
            state.playing = true;
          }
        } else if (name === "PAUSE") {
          audio?.pause();
          state.playing = false;
        } else if (name === "STOP") {
          audio?.pause();
          if (audio) audio.currentTime = 0;
          state.playing = false;
        } else if (name === "PREV") {
          if (state.currentIdx > 0) playIdx(state.currentIdx - 1);
        } else if (name === "NEXT") {
          if (state.currentIdx < state.playlist.length - 1) playIdx(state.currentIdx + 1);
        } else if (name === "EXIT") {
          audio?.pause();
          window.WM.closeWindow(winId);
        }
      }

      function renderPlaylist() {
        playlistEl.innerHTML = "";
        state.playlist.forEach((t, i) => {
          const row = document.createElement("div");
          row.className = "row" + (i === state.currentIdx ? " is-active" : "");
          const titleCell = document.createElement("span");
          titleCell.textContent = (i + 1) + ". " + t.title;
          const timeCell = document.createElement("span");
          timeCell.textContent = t.duration ? fmt(t.duration) : "--:--";
          row.appendChild(titleCell);
          row.appendChild(timeCell);
          if (t.src) {
            row.addEventListener("dblclick", () => playIdx(i));
            row.addEventListener("click", () => { state.currentIdx = i; renderPlaylist(); });
          }
          playlistEl.appendChild(row);
        });
      }

      // --- spectrum animation ---
      function drawSpectrum() {
        const data = new Uint8Array(BARS);
        if (analyser && state.playing && audio && !audio.paused) {
          analyser.getByteFrequencyData(data);
          // analyser only gives N/2 bins; downsample to BARS
        }
        for (let i = 0; i < BARS; i++) {
          let v;
          if (data && state.playing && audio && !audio.paused) {
            v = data[i] || 0;
          } else {
            // fake idle spectrum: tiny bouncing
            v = 8 + Math.abs(Math.sin((Date.now() / 600) + i * 0.4)) * 12;
          }
          const h = Math.max(2, Math.round((v / 255) * 56));
          barEls[i].style.height = h + "px";
        }
        requestAnimationFrame(drawSpectrum);
      }
      requestAnimationFrame(drawSpectrum);

      const win = window.WM.createWindow({
        id: winId,
        title: "Winamp",
        icon: "winamp",
        width: 320, height: 480,
        x: opts.x, y: opts.y,
        persistKey: "winamp",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(root);
        },
      });
      win.getAppState = () => ({ volume: state.volume, eqBands: state.eqBands, currentIdx: state.currentIdx });
      win.app = "winamp";
      return win;
    },
  };

  window.WinampApp = app;
})();