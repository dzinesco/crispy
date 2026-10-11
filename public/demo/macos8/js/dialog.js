import { esc } from './util.js';
import { play } from './audio.js';

let open = null;

export function dialogIsOpen() {
  return Boolean(open);
}

export function dialog({
  message = '',
  buttons = [{ id: 'ok', label: 'OK', default: true }],
  fields = [],
  validate,
  wide = false,
  list,
} = {}) {
  return new Promise((resolve) => {
    const host = document.getElementById('dialogs');
    host.classList.add('open');
    host.replaceChildren();
    const normalized = buttons.map((button, index) => (
      typeof button === 'string'
        ? { id: button.toLowerCase().replace(/\s+/g, '-'), label: button, default: index === buttons.length - 1 }
        : button
    ));
    const defaultBtn = normalized.find((button) => button.default) || normalized[normalized.length - 1];
    const shade = document.createElement('div');
    shade.className = 'shade';
    shade.dataset.dialog = 'open';
    const box = document.createElement('form');
    box.className = `dialog${wide ? ' wide' : ''}`;
    box.setAttribute('role', 'alertdialog');
    box.innerHTML = `
      <p class="dialog-msg">${esc(message).replace(/\n/g, '<br>')}</p>
      ${fields.map((field) => `
        <label class="dialog-field">
          <span>${esc(field.label || '')}</span>
          <input data-field="${esc(field.name)}" name="${esc(field.name)}" maxlength="31" value="${esc(field.value || '')}" autocomplete="off" />
        </label>`).join('')}
      ${list ? `<div class="dialog-list" data-list></div>` : ''}
      <p class="dialog-error" data-error hidden></p>
      <div class="dialog-buttons">
        ${normalized.map((button) => `
          <button type="button" class="btn${button.default ? ' default' : ''}" data-btn="${esc(button.id)}">${esc(button.label)}</button>
        `).join('')}
      </div>`;
    shade.appendChild(box);
    host.appendChild(shade);

    const listEl = box.querySelector('[data-list]');
    let picked = list?.[0]?.id || null;
    if (listEl && list) {
      const paintList = () => {
        listEl.innerHTML = list.map((item) => `
          <button type="button" class="dialog-row${item.id === picked ? ' selected' : ''}" data-row="${esc(item.id)}">${esc(item.label)}</button>
        `).join('') || '<p class="muted">Nothing to open.</p>';
      };
      paintList();
      listEl.addEventListener('click', (event) => {
        const row = event.target.closest('[data-row]');
        if (!row) return;
        picked = row.dataset.row;
        paintList();
        if (event.detail === 2) finish('ok');
      });
    }

    const values = () => {
      const out = {};
      for (const field of fields) {
        const input = box.querySelector(`[data-field="${field.name}"]`);
        out[field.name] = input ? input.value : '';
      }
      if (list) out.picked = picked;
      return out;
    };

    const finish = (id) => {
      const payload = { button: id, values: values() };
      if (id !== 'cancel' && validate) {
        const problem = validate(payload);
        const error = box.querySelector('[data-error]');
        if (problem) {
          error.hidden = false;
          error.textContent = problem;
          play('alert');
          return;
        }
      }
      cleanup();
      resolve(payload);
    };

    const cleanup = () => {
      host.classList.remove('open');
      host.replaceChildren();
      open = null;
      document.removeEventListener('keydown', onKey, true);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        const cancel = normalized.find((button) => button.id === 'cancel') || normalized.find((button) => !button.default);
        finish(cancel ? cancel.id : defaultBtn.id);
      } else if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        finish(defaultBtn.id);
      }
    };

    box.addEventListener('click', (event) => {
      const button = event.target.closest('[data-btn]');
      if (!button) return;
      event.preventDefault();
      finish(button.dataset.btn);
    });
    document.addEventListener('keydown', onKey, true);
    open = { finish };
    const focusEl = box.querySelector('input') || box.querySelector('.btn.default') || box.querySelector('button');
    focusEl?.focus();
    if (focusEl?.select) focusEl.select();
  });
}
