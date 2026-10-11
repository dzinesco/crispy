import { invalidate, noise, tone } from './audio.js';
import { esc, wait } from './util.js';

let api = null;
let stage = null;
let phase = 'idle';
let board = 'menu';
let number = '5551984';
let token = 0;
let result = '';

function pretty(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return String(value || '');
}

export const telecomApp = {
  title: 'Telecom',
  keys: ['Help', 'Dial', 'Hangup', '', '', '', '', '', '', 'Exit'],
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    this.render();
  },
  destroy() {
    token += 1;
    invalidate();
    if (phase === 'dialing') phase = 'idle';
    stage = null;
  },
  render() {
    if (!stage) return;
    if (phase === 'idle') {
      stage.innerHTML = `<div class="term">
        <p class="term-title">TELECOM</p>
        <p>Number</p>
        <input data-number maxlength="16" spellcheck="false" autocomplete="off" value="${esc(number)}">
        <p class="dim">F2 dials. The goat has a BBS.</p>
        <pre class="led" aria-hidden="true">[ ] modem</pre>
      </div>`;
      const input = stage.querySelector('[data-number]');
      input.addEventListener('input', () => {
        number = input.value;
      });
      api.setStatus('Idle');
      return;
    }
    if (phase === 'dialing') {
      stage.innerHTML = `<div class="term">
        <p class="term-title">DIALING</p>
        <pre class="log" data-log></pre>
        <pre class="led on" aria-hidden="true">[*] modem</pre>
      </div>`;
      api.setStatus('Dialing...');
      return;
    }
    stage.innerHTML = this.boardHtml();
    stage.querySelectorAll('[data-bbs]').forEach((button) => {
      button.addEventListener('click', () => this.command(button.dataset.bbs));
    });
    stage.querySelectorAll('[data-guess]').forEach((button) => {
      button.addEventListener('click', () => this.guess(button.dataset.guess));
    });
    api.setStatus('CONNECT 2400');
  },
  boardHtml() {
    if (board === 'news') {
      return `<div class="term bbs"><p class="c14">CRISPY GOAT BBS  -  NEWS</p>
        <p>From: sysop<br>Subj: the desk</p>
        <p>Welcome to the only board in town that fits on one screen. Download nothing. The files are a joke. The goat is not.</p>
        <button type="button" data-bbs="menu">Back</button></div>`;
    }
    if (board === 'files') {
      return `<div class="term bbs"><p class="c14">FILES</p>
        <button type="button" data-bbs="file">GOAT.TXT     2K</button>
        <button type="button" data-bbs="file">NOWIN.ZIP    0K</button>
        <button type="button" data-bbs="file">DESK.BAS     4K</button>
        <p>${esc(result)}</p>
        <button type="button" data-bbs="menu">Back</button></div>`;
    }
    if (board === 'games') {
      return `<div class="term bbs"><p class="c14">GAME</p>
        <p>Guess the goat's number.</p>
        <p><button type="button" data-guess="1">1</button> <button type="button" data-guess="2">2</button></p>
        <p>${esc(result)}</p>
        <button type="button" data-bbs="menu">Back</button></div>`;
    }
    return `<div class="term bbs">
      <p class="c14">CRISPY GOAT BBS</p>
      <p class="c11">NODE 1  -  2400 BAUD</p>
      <p>No overlapping windows since 1984.<br>The sysop is a goat. The goat is in.</p>
      <p>
        <button type="button" data-bbs="news">N)ews</button>
        <button type="button" data-bbs="files">F)iles</button>
        <button type="button" data-bbs="games">G)ames</button>
        <button type="button" data-bbs="quit">Q)uit</button>
      </p>
    </div>`;
  },
  command(name) {
    if (name === 'quit') {
      this.hangup();
      return;
    }
    if (name === 'file') {
      result = 'Transfer aborted. The goat unplugged the modem.';
      this.render();
      return;
    }
    result = '';
    board = name === 'menu' ? 'menu' : name;
    this.render();
  },
  guess() {
    result = 'The goat picked the other one.';
    this.render();
  },
  async dial() {
    const input = stage?.querySelector('[data-number]');
    if (input) number = input.value || number;
    const my = token + 1;
    token = my;
    phase = 'dialing';
    board = 'menu';
    result = '';
    this.render();
    const say = (line) => {
      const log = stage?.querySelector('[data-log]');
      if (token !== my || !log) return;
      log.textContent += (log.textContent ? '\n' : '') + line;
    };
    const step = async (ms, line, sound) => {
      if (token !== my) return false;
      if (line) say(line);
      sound?.();
      await wait(ms);
      return token === my;
    };
    if (!await step(80, `ATDT ${pretty(number)}`)) return;
    if (!await step(650, 'DIAL TONE', () => tone([350, 440], 0.5, 'sine', 0.035))) return;
    if (!await step(450, 'RINGING', () => tone([440, 480], 0.35, 'sine', 0.03))) return;
    if (!await step(550, 'ANSWER 2100', () => tone([2100], 0.32, 'sine', 0.04))) return;
    if (!await step(400, 'HANDSHAKE', () => {
      noise(0.28, 0.045);
      tone([1650], 0.14, 'square', 0.03);
    })) return;
    if (!await step(420, '', () => tone([1850, 980], 0.22, 'square', 0.03))) return;
    if (token !== my) return;
    phase = 'online';
    say('CONNECT 2400');
    await wait(250);
    if (token !== my) return;
    this.render();
    tone([880], 0.07, 'square', 0.04);
  },
  hangup() {
    token += 1;
    invalidate();
    phase = 'idle';
    board = 'menu';
    tone([220], 0.12, 'square', 0.04);
    noise(0.08, 0.03);
    this.render();
    api.setStatus('NO CARRIER');
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2 && phase !== 'dialing') this.dial();
    if (n === 3) this.hangup();
    if (n === 10) api.exit();
  },
  onKey(event) {
    if (event.target?.matches?.('input')) {
      if (event.key === 'Escape') api.exit();
      return;
    }
    if (event.key === 'Escape') {
      api.exit();
      return;
    }
    if (phase !== 'online') return;
    const key = event.key.toLowerCase();
    if (key === 'n') this.command('news');
    if (key === 'f') this.command('files');
    if (key === 'g') this.command('games');
    if (key === 'q') this.command('quit');
    if (key === 'b') this.command('menu');
    if (board === 'games' && (key === '1' || key === '2')) this.guess();
  },
};
