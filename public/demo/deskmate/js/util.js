export function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function cleanName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/.test(name)) return null;
  return name;
}

export function askLine(parent, label, { value = '', save = false } = {}) {
  const form = document.createElement('form');
  form.className = 'ask';
  form.innerHTML = `<label>${esc(label)} <input maxlength="12" autocomplete="off" spellcheck="false"></label>`;
  const input = form.querySelector('input');
  input.setAttribute('data-ask', '');
  if (save) input.setAttribute('data-save-name', '');
  input.value = value;
  parent.appendChild(form);
  input.focus();
  input.select();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (next) => {
      if (settled) return;
      settled = true;
      form.remove();
      resolve(next);
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(input.value.trim());
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      }
    });
  });
}

export function formatClock(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let hour = date.getHours();
  const ap = hour >= 12 ? 'p' : 'a';
  hour = hour % 12 || 12;
  const min = String(date.getMinutes()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(2);
  return `${days[date.getDay()]} ${month}-${day}-${year} ${hour}:${min}${ap}`;
}

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fileBytes(file) {
  if (!file) return 0;
  if (file.kind === 'text') return String(file.text || '').length;
  if (file.kind === 'paint') return String(file.data || '').length;
  try {
    return JSON.stringify(file).length;
  } catch {
    return 0;
  }
}
