import { stageScale } from './util.js';

export function createScroll(parent, { onResize } = {}) {
  const root = document.createElement('div');
  root.className = 'pane';
  root.innerHTML = `
    <div class="pane-clip"><div class="pane-content"></div></div>
    <div class="vscroll">
      <button type="button" class="sarrow up" aria-label="Scroll up"></button>
      <div class="strack"><div class="sthumb"></div></div>
      <button type="button" class="sarrow down" aria-label="Scroll down"></button>
    </div>
    <div class="hscroll">
      <button type="button" class="sarrow left" aria-label="Scroll left"></button>
      <div class="strack"><div class="sthumb"></div></div>
      <button type="button" class="sarrow right" aria-label="Scroll right"></button>
    </div>
    <button type="button" class="grow" data-grow aria-label="Resize"></button>`;
  parent.appendChild(root);
  const clip = root.querySelector('.pane-clip');
  const content = root.querySelector('.pane-content');
  let sx = 0;
  let sy = 0;

  const metrics = () => ({
    cw: clip.clientWidth,
    ch: clip.clientHeight,
    sw: Math.max(clip.clientWidth, content.scrollWidth),
    sh: Math.max(clip.clientHeight, content.scrollHeight),
  });

  const placeThumb = (track, thumb, view, full, pos) => {
    const trackSize = track.clientHeight || track.clientWidth;
    const vertical = track.parentElement.classList.contains('vscroll');
    const size = full <= view ? trackSize : Math.max(18, trackSize * (view / full));
    const max = Math.max(0, trackSize - size);
    const offset = full <= view ? 0 : (pos / (full - view)) * max;
    if (vertical) {
      thumb.style.height = `${size}px`;
      thumb.style.top = `${offset}px`;
    } else {
      thumb.style.width = `${size}px`;
      thumb.style.left = `${offset}px`;
    }
    thumb.classList.toggle('idle', full <= view);
  };

  function refresh() {
    const box = metrics();
    sx = Math.max(0, Math.min(sx, box.sw - box.cw));
    sy = Math.max(0, Math.min(sy, box.sh - box.ch));
    content.style.transform = `translate3d(${-sx}px, ${-sy}px, 0)`;
    placeThumb(root.querySelector('.vscroll .strack'), root.querySelector('.vscroll .sthumb'), box.ch, box.sh, sy);
    placeThumb(root.querySelector('.hscroll .strack'), root.querySelector('.hscroll .sthumb'), box.cw, box.sw, sx);
  }

  const scrollBy = (dx, dy) => {
    sx += dx;
    sy += dy;
    refresh();
  };

  const hold = (button, dx, dy) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollBy(dx, dy);
      let timer = setTimeout(function tick() {
        scrollBy(dx, dy);
        timer = setTimeout(tick, 60);
      }, 260);
      const up = () => {
        clearTimeout(timer);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointerup', up);
    });
  };
  hold(root.querySelector('.sarrow.up'), 0, -18);
  hold(root.querySelector('.sarrow.down'), 0, 18);
  hold(root.querySelector('.sarrow.left'), -18, 0);
  hold(root.querySelector('.sarrow.right'), 18, 0);

  const trackClick = (track, vertical) => {
    track.addEventListener('pointerdown', (event) => {
      if (event.target.classList.contains('sthumb')) return;
      const box = metrics();
      const rect = track.getBoundingClientRect();
      const along = vertical ? event.clientY - rect.top : event.clientX - rect.left;
      const thumb = track.querySelector('.sthumb');
      const thumbStart = vertical ? thumb.offsetTop : thumb.offsetLeft;
      const page = vertical ? box.ch : box.cw;
      const delta = along < thumbStart ? -page : page;
      scrollBy(vertical ? 0 : delta, vertical ? delta : 0);
    });
  };
  trackClick(root.querySelector('.vscroll .strack'), true);
  trackClick(root.querySelector('.hscroll .strack'), false);

  const thumbDrag = (thumb, vertical) => {
    thumb.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      thumb.setPointerCapture(event.pointerId);
      const start = vertical ? event.clientY : event.clientX;
      const origin = vertical ? sy : sx;
      const box = metrics();
      const track = thumb.parentElement;
      const trackSize = vertical ? track.clientHeight : track.clientWidth;
      const thumbSize = vertical ? thumb.offsetHeight : thumb.offsetWidth;
      const full = vertical ? box.sh : box.sw;
      const view = vertical ? box.ch : box.cw;
      const move = (ev) => {
        const delta = ((vertical ? ev.clientY : ev.clientX) - start) / stageScale();
        const range = Math.max(1, trackSize - thumbSize);
        const travel = Math.max(1, full - view);
        const next = origin + (delta / range) * travel;
        if (vertical) sy = next;
        else sx = next;
        refresh();
      };
      const up = () => {
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', up);
      };
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', up);
    });
  };
  thumbDrag(root.querySelector('.vscroll .sthumb'), true);
  thumbDrag(root.querySelector('.hscroll .sthumb'), false);

  clip.addEventListener('wheel', (event) => {
    event.preventDefault();
    const dx = event.shiftKey ? event.deltaY : event.deltaX;
    const dy = event.shiftKey ? 0 : event.deltaY;
    scrollBy(dx, dy);
  }, { passive: false });

  if (onResize) {
    const grow = root.querySelector('[data-grow]');
    grow.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      grow.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      onResize({ phase: 'start', dx: 0, dy: 0 });
      const move = (ev) => {
        onResize({
          phase: 'move',
          dx: (ev.clientX - startX) / stageScale(),
          dy: (ev.clientY - startY) / stageScale(),
        });
      };
      const up = (ev) => {
        onResize({
          phase: 'end',
          dx: (ev.clientX - startX) / stageScale(),
          dy: (ev.clientY - startY) / stageScale(),
        });
        grow.removeEventListener('pointermove', move);
        grow.removeEventListener('pointerup', up);
      };
      grow.addEventListener('pointermove', move);
      grow.addEventListener('pointerup', up);
    });
  }

  requestAnimationFrame(refresh);
  return { root, content, clip, refresh, reset: () => { sx = 0; sy = 0; refresh(); } };
}
