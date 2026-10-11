import { goatSvg } from './icons.js';

const PAGE = [
  `<h2>HELP</h2>
<p class="joke">Press F1 for help. Press F1 again for more help.</p>
<p>This is the help. F10 or Esc puts you back.</p>
<p>Arrows move. Enter confirms. Esc backs out.
The gray bar is the menu. It was always the menu.
Alt+1 through Alt+0 are F1 through F10,
because some browsers keep the function keys
for themselves.</p>
<p>From the desk, F7 draws scanlines. Alt+L does
it from anywhere.</p>
<p>It was hard on purpose. The mouse is allowed now.
Both work. We grew.</p>`,
  `<h2>MORE HELP</h2>
<p class="joke">You pressed F1 again. There is no manual.
Press F1 once more and the first help returns.
This is not a bug. This is DeskMate.</p>
<p>Text        F2 saves, F3 loads. The disk is this browser.
Worksheet   =A1+B1   =A1*2   =SUM(A1:A4)
Calendar    F2 adds a note on the highlighted day.
Paint       Pick a color. Drag. F9 undoes.
Music       Letter keys play square waves. F2 plays.
Filer       F2 renames. F4 deletes.
Telecom     F2 dials. A goat answers.
Calculator  The keys you already know.</p>
<p>Sixteen colors. No overlapping windows.
640K RAM OK. The goat already counted.</p>`,
];

let page = 0;
let from = 'desktop';
let api = null;
let stage = null;

function paint() {
  if (!stage) return;
  stage.dataset.helpPage = String(page);
  stage.innerHTML = `<div class="doc">${PAGE[page]}</div>`;
  api?.setStatus(page === 0 ? 'F1  more help' : 'F1  first help');
}

export const helpApp = {
  title: 'Help',
  keys: ['More', '', '', '', '', '', '', '', '', 'Exit'],
  mount(nextStage, nextApi, arg) {
    stage = nextStage;
    api = nextApi;
    from = arg?.from && arg.from !== 'help' ? arg.from : from;
    if (arg?.reset) page = 0;
    this.keys = [page === 0 ? 'More' : 'Help', '', '', '', '', '', '', '', '', 'Exit'];
    api.setKeys(this.keys);
    paint();
  },
  destroy() {
    stage = null;
  },
  toggle() {
    page = page === 0 ? 1 : 0;
    this.keys = [page === 0 ? 'More' : 'Help', '', '', '', '', '', '', '', '', 'Exit'];
    api?.setKeys(this.keys);
    paint();
  },
  onF(n) {
    if (n === 1) this.toggle();
    if (n === 10) api.show(from || 'desktop');
  },
  onKey(event) {
    if (event.key === 'Escape' || event.key === 'Enter') api.show(from || 'desktop');
  },
};

export const aboutApp = {
  title: 'About',
  keys: ['Help', '', '', '', '', '', '', '', '', 'Exit'],
  mount(nextStage, nextApi) {
    api = nextApi;
    nextStage.innerHTML = `<div class="doc about">
      <div class="about-goat">${goatSvg()}</div>
      <h2>CRISPYGOAT DESKMATE  1.00</h2>
      <p>A browser sketch of a 1984 keyboard shell.
The pictures and the beeps are original.
No borrowed logos. No borrowed ROMs.</p>
      <p>Apps fill the screen. They do not stack.
The function keys are the point.</p>
      <p>640K RAM OK.</p>
    </div>`;
    nextApi.setStatus('F10  desk');
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 10) api.show('desktop');
  },
  onKey(event) {
    if (event.key === 'Escape' || event.key === 'Enter') api.show('desktop');
  },
};
