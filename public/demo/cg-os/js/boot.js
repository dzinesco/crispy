/* ============================================================
   Boot sequence — BIOS/POST → splash → driver loading list → login.
   Skippable via "Don't show this again" or "Skip boot screens".
   ============================================================ */

(function () {
  "use strict";

  const BIOS_LINES = [
    "Crispy Goat BIOS v4.7  (C)1998 Crispy Computing, Inc.",
    "",
    "Main Processor : Crispy386 @ 233 MHz",
    "Math Processor : Built-in",
    "Memory Test    : 65536 KB OK",
    "",
    "Detecting IDE Primary Master  ... CG-HDD-008GB",
    "Detecting IDE Primary Slave   ... None",
    "Detecting IDE Secondary Master ... CG-CDROM-32X",
    "Detecting IDE Secondary Slave  ... None",
    "",
    "Floppy Drive A: 1.44MB, 3.5\"",
    "Floppy Drive B: None",
    "",
    "Display Adapter : CG-VGA 800x600 64K colors",
    "Network Adapter : CG-LAN 100Mb/s",
    "Sound Adapter   : CG-SoundBlaster-Pro compatible",
    "",
    "USB Devices     : 1 Keyboard, 1 Mouse",
    "",
    "BIOS Extensions : INT 13h, INT 19h, PnP, APM",
    "",
    "Booting from C:\\WINDOWS ...",
    "Starting MS-DOS 7.1 ...",
    "",
    "HIMEM.SYS loaded.",
    "EMM386.EXE loaded.",
    "SETMANDIR=C:\\WINDOWS\\TEMP",
    "PATH=C:\\WINDOWS;C:\\WINDOWS\\COMMAND",
    "",
    "Loading WINDOWS ... ",
    "",
  ];

  const DRIVERS = [
    "VGAX.SYS    ........ OK",
    "CRISPYKBD.SYS ........ OK",
    "CRISPYMOU.SYS ........ OK",
    "HIDCLASS.SYS ........ OK",
    "MOUSECLF.SYS ........ OK",
    "KBDHID.SYS   ........ OK",
    "CRSPYSND.SYS ........ OK",
    "MMSYSTEM.DLL ........ OK",
    "WINSPOOL.DRV ........ OK",
    "CRSPYNET.SYS ........ OK",
    "AFD.SYS     ........ OK",
    "WSOCK32.DLL ........ OK",
    "  Starting Windows 98 GUI...",
  ];

  let bootEl;
  let onDone = null;

  function startBoot(done) {
    onDone = done;
    bootEl = document.getElementById("boot");
    if (!bootEl) { done && done(); return; }
    const settings = window.Persistence.loadSettings();
    if (settings.skipBoot) {
      done && done();
      return;
    }
    bootEl.hidden = false;
    showStage("bios");
    runBIOS(() => showStage("splash", runSplash))
      .then(() => showStage("loading", runLoading))
      .then(() => showStage("login", runLogin));
  }

  function showStage(name, onShown) {
    if (!bootEl) return;
    bootEl.dataset.stage = name;
    bootEl.querySelectorAll(".boot-stage").forEach((el) => {
      el.hidden = el.dataset.stageScreen !== name;
    });
    if (onShown) onShown();
  }

  function runBIOS() {
    return new Promise((resolve) => {
      const target = document.getElementById("boot-bios");
      target.textContent = "";
      let i = 0;
      function tick() {
        if (i >= BIOS_LINES.length) { resolve(); return; }
        const line = BIOS_LINES[i++];
        target.textContent += line + "\n";
        // auto-scroll
        target.parentElement.scrollTop = target.parentElement.scrollHeight;
        const base = line === "" ? 30 : 18;
        const extra = line.startsWith("Memory Test") ? 200 : 0;
        setTimeout(tick, base + extra);
      }
      tick();
    });
  }

  function runSplash(resolve) {
    const fill = bootEl.querySelector(".boot-splash-fill");
    const build = document.getElementById("boot-splash-build");
    let pct = 0;
    function step() {
      pct = Math.min(100, pct + Math.random() * 12 + 4);
      fill.style.width = pct + "%";
      if (build) build.textContent = "Build 98.012345-OS  " + Math.floor(pct) + "%";
      if (pct >= 100) setTimeout(resolve, 280);
      else setTimeout(step, 90 + Math.random() * 80);
    }
    step();
  }

  function runLoading(resolve) {
    const list = document.getElementById("boot-loading-list");
    list.innerHTML = "";
    let i = 0;
    function tick() {
      if (i >= DRIVERS.length) { setTimeout(resolve, 400); return; }
      const row = document.createElement("span");
      row.className = "row";
      row.textContent = DRIVERS[i++];
      list.appendChild(row);
      list.parentElement.scrollTop = list.parentElement.scrollHeight;
      setTimeout(tick, 90 + Math.random() * 80);
    }
    tick();
  }

  function runLogin(resolve) {
    const pw = document.getElementById("boot-login-pw");
    const go = document.getElementById("boot-login-go");
    const cancel = document.getElementById("boot-login-cancel");
    const skip = document.getElementById("boot-skip");
    const skipBtn = document.getElementById("boot-skip-btn");
    pw.value = "";
    setTimeout(() => pw.focus(), 80);
    go.classList.add("is-default");

    function done(saveSkip) {
      if (saveSkip) {
        const s = window.Persistence.loadSettings();
        s.skipBoot = true;
        window.Persistence.saveSettings(s);
      }
      go.removeEventListener("click", onGo);
      cancel.removeEventListener("click", onCancel);
      pw.removeEventListener("keydown", onKey);
      skipBtn.removeEventListener("click", onSkip);
      skip.removeEventListener("change", onChange);
      bootEl.hidden = true;
      onDone && onDone();
    }

    function onGo() { done(skip.checked); }
    function onCancel() { done(false); }
    function onSkip() { done(true); }
    function onChange() { /* checkbox state read on OK */ }
    function onKey(e) {
      if (e.key === "Enter") { e.preventDefault(); done(skip.checked); }
    }

    go.addEventListener("click", onGo);
    cancel.addEventListener("click", onCancel);
    skipBtn.addEventListener("click", onSkip);
    skip.addEventListener("change", onChange);
    pw.addEventListener("keydown", onKey);
  }

  // expose skip-boot for debugging / settings reset
  window.Boot = { startBoot };
})();