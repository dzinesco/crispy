import { DESK_W, DESK_H, setStage, setStageScale } from './util.js';
import { initFS, settings } from './fs.js';
import { setAudioLevel, unlockAudio } from './audio.js';
import { initDesktop } from './desktop.js';
import { closeMenu, initMenus, isMenuOpen, run, wake } from './menus.js';
import { dialogIsOpen } from './dialog.js';
import { dispatchAppKey } from './games.js';
import { boot, replayBoot } from './startup.js';
import './finder.js';
import './textapps.js';
import './paint.js';

const stage = document.getElementById('stage');

function fit() {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const scale = Math.min(vw / DESK_W, vh / DESK_H);
  setStageScale(scale || 1);
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(vw - DESK_W * scale) / 2}px`;
  stage.style.top = `${(vh - DESK_H * scale) / 2}px`;
}

initFS();
setAudioLevel(settings().volume, settings().muted);
setStage(stage);
initDesktop();
initMenus();
fit();
window.addEventListener('resize', fit);

const clock = document.getElementById('clock');
let showDate = false;
const tick = () => {
  const date = new Date();
  clock.textContent = showDate
    ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
tick();
window.setInterval(tick, 1000);
clock.addEventListener('click', () => {
  showDate = !showDate;
  tick();
});

stage.addEventListener('pointerdown', () => unlockAudio());
document.addEventListener('os-restart', () => replayBoot());
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('shutdown').hidden = true;
  replayBoot();
});
document.getElementById('sleep').addEventListener('pointerdown', (event) => {
  event.stopPropagation();
  wake();
});

window.addEventListener('keydown', (event) => {
  if (event.defaultPrevented) return;
  if (!document.getElementById('shutdown').hidden) {
    if (event.key === 'Enter') document.getElementById('restart-btn').click();
    return;
  }
  if (wake()) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && isMenuOpen()) {
    event.preventDefault();
    closeMenu();
    return;
  }
  if (dialogIsOpen()) return;
  const typing = document.activeElement && (
    document.activeElement.tagName === 'TEXTAREA'
    || (document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'checkbox')
  );
  const mod = event.metaKey || event.ctrlKey;
  if (mod) {
    const key = event.key.toLowerCase();
    const map = {
      n: 'new', o: 'open', w: 'close', s: 'save', q: 'quit', i: 'info',
      z: 'undo', x: 'cut', c: 'copy', v: 'paste', a: 'select-all',
    };
    if (map[key]) {
      event.preventDefault();
      run(map[key]);
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      run('trash');
    }
    return;
  }
  if (typing) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    run('trash');
    return;
  }
  if (dispatchAppKey(event)) return;
  if (event.key === 'Enter') run('open');
});

boot();
