/* =====================================================================
 * LOTUS 1-2-3 — browser recreation
 *
 * Sections:
 *   Constants · State · DOM refs · Parsing · Tokens · Parse ·
 *   Evaluate · Functions · Formulas · Cell model · Render ·
 *   Persistence · Mode machine · Menus · Commands · Demo ·
 *   Chart · Soft-keys · Input · Boot
 * ===================================================================== */

(() => {
  "use strict";

  // =====================================================================
  // 1. CONSTANTS
  // =====================================================================

  const SCHEMA_VERSION = 1;
  const STATE_KEY = "lotus.save.v1";
  const SETTINGS_KEY = "lotus.settings.v1";
  const DEMO_KEY = "lotus.demo.v1";

  const VISIBLE_ROWS = 20;
  const VISIBLE_COLS = 8;       // 8 data columns A..H by default
  const TOTAL_COLS = 24;        // A..X
  const TOTAL_ROWS = 50;        // 1..50
  const DEFAULT_COL_WIDTH = 9;

  // Range of columns A..X (24 cols). Lotus 1-2-3 supports A..IV (256).
  const COLUMN_LETTERS = (() => {
    const out = [];
    for (let i = 0; i < 26; i++) out.push(String.fromCharCode(65 + i));
    return out.slice(0, TOTAL_COLS);
  })();

  // Top-of-screen menu header for each top-level menu (Lotus uses single
  // letters at the top, the user presses the first letter of each word).
  const TOP_MENUS = [
    { key: "W", label: "Worksheet" },
    { key: "R", label: "Range" },
    { key: "C", label: "Copy" },
    { key: "M", label: "Move" },
    { key: "F", label: "File" },
    { key: "P", label: "Print" },
    { key: "G", label: "Graph" },
    { key: "D", label: "Data" },
    { key: "N", label: "Name" },
    { key: "Q", label: "Quit" },
  ];

  // Mode labels (the right edge of the mode strip)
  const MODE_LABEL = {
    READY: "READY",
    EDIT: "EDIT",
    MENU: "MENU",
    POINT: "POINT",
    FILL: "FILL",
    DIR: "DIRECTORY",
    ERROR: "ERROR",
    HELP: "HELP",
    GRAPH: "GRAPH",
    WAIT: "WAIT",
  };

  // =====================================================================
  // 2. STATE
  // =====================================================================

  // Each cell: { raw: string, type: 'label'|'number'|'formula', expr?: AST|raw }
  const cells = new Map();

  // Computed values cache: { value, kind } where kind ∈ 'number','string','na','err'
  const computed = new Map();

  // Per-cell display formats: fix, sci, cur, pct, plusminus, gen, date, txt
  // Default = 'general'
  const formats = new Map();

  // Per-cell alignment override; otherwise derived from type
  const alignOverrides = new Map();

  // Column widths; the grid uses widths to compute cell render width
  const colWidths = new Array(TOTAL_COLS).fill(DEFAULT_COL_WIDTH);

  // Named ranges: name → { ref: {c1,r1,c2,r2} }
  const names = new Map();

  // Range formats applied to a rectangular range: "C1:C2|fix" → keep track of format tags
  // applied so we can re-apply. For simplicity, per-cell formats are stored on `formats`.

  // Recompute order cache
  let recomputeOrder = [];   // array of keys
  let recomputeStale = true;
  let dirtyCells = new Set();

  // Current cell pointer (column index 0.., row 1..)
  let cur = { c: 0, r: 1 };

  // Mode stack + buffers
  const mode = {
    name: "READY",
    // EDIT
    editBuffer: "",
    editCursor: 0,
    editOriginalRaw: "",
    // MENU
    menuPath: [],   // array of menu objects, where menu = { key, label, action?, parent? }
    menuPrompt: "", // current input for sub-prompts
    // POINT
    anchor: null,   // {c, r} start of highlighted range
    pointTarget: null, // {c, r} end
    pointOrigin: null, // {c, r} where it began (for /C and /M)
    // FILL
    fill: null,
    // ERROR
    errorMessage: "",
    // HELP
    helpTopic: null,
    // DIR (for /F List / Retrieve)
    dirSheetNames: [],
    dirSheetCursor: 0,
    // GRAPH
    graphSpec: null,
    graphRanges: null,
    graphType: "Bar",
  };

  // Range of cells we highlight as part of a pending command (e.g. /C source)
  let inRange = null;
  let anchorMarker = null;

  // Text typed in /D Fill interval or /F Save filename, /F Retrieve input
  const promptBuffer = { text: "", cursor: 0 };

  // Sheet title (status)
  let sheetTitle = "Untitled";

  // Settings
  const settings = {
    phosphor: "amber",
    autosave: true,
    beep: false,
  };

  // Flag if the spreadsheet is in a "ready" state to be saved
  let sheetDirty = false;

  // =====================================================================
  // 3. DOM REFS
  // =====================================================================

  const $ = (id) => document.getElementById(id);
  const grid = $("grid");
  const cellCoord = $("cell-coord");
  const cellContentsEl = $("cell-contents");
  const modeLabel = $("mode-label");
  const modeMenus = $("mode-menus");
  const keyLine = $("key-line");
  const caret = $("caret");
  const screen = $("screen");
  const legendKeys = $("legend-keys");
  const softkeys = $("softkeys");
  const floppyLed = $("floppy-led");
  const hddLed = $("hdd-led");
  const chartOverlay = $("chart-overlay");
  const chartCanvas = $("chart-canvas");
  const chartTitle = $("chart-title");

  // =====================================================================
  // 4. UTIL — Coordinates, cell math, ranges, formatting
  // =====================================================================

  function colIndexToLetter(i) {
    return String.fromCharCode(65 + i);
  }
  function colLetterToIndex(letter) {
    const u = letter.toUpperCase();
    return u.charCodeAt(0) - 65;
  }
  function cellKey(c, r) {
    return `${colIndexToLetter(c)}${r}`;
  }
  function coordValid(c, r) {
    return c >= 0 && c < TOTAL_COLS && r >= 1 && r <= TOTAL_ROWS;
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function nextCellDown() {
    if (cur.r >= TOTAL_ROWS) return;
    cur.r += 1;
    render();
  }
  function nextCellUp() {
    if (cur.r <= 1) return;
    cur.r -= 1;
    render();
  }
  function nextCellLeft() {
    if (cur.c <= 0) { if (cur.r > 1) { cur.r -= 1; cur.c = TOTAL_COLS - 1; } }
    else cur.c -= 1;
    render();
  }
  function nextCellRight() {
    if (cur.c >= TOTAL_COLS - 1) { if (cur.r < TOTAL_ROWS) { cur.r += 1; cur.c = 0; } }
    else cur.c += 1;
    render();
  }

  // Range encoding/decoding
  function encodeRange(c1, r1, c2, r2) {
    const a = { c: Math.min(c1, c2), r: Math.min(r1, r2) };
    const b = { c: Math.max(c1, c2), r: Math.max(r1, r2) };
    return { a, b };
  }
  function rangeContains(range, c, r) {
    if (!range) return false;
    return c >= range.a.c && c <= range.b.c && r >= range.a.r && r <= range.b.r;
  }

  // =====================================================================
  // 5. PARSING — classify raw text by leading prefix
  //    '  → left-aligned label
  //    "  → right-aligned label
  //    ^  → centered label
  //    \  → left-aligned, fills to end of cell
  //    +  → formula
  //    -  → formula
  //    =  → formula (display)
  //    @  → formula function call
  //    digit or . or +digit etc → number
  // =====================================================================

  function classifyInput(raw, allowNumberPrefix = true) {
    if (raw === "" || raw == null) return { type: "empty", raw: "" };
    const ch = raw[0];
    if (ch === "'") return { type: "label", raw: raw.slice(1), labelAlign: "left" };
    if (ch === '"') return { type: "label", raw: raw.slice(1), labelAlign: "right" };
    if (ch === "^") return { type: "label", raw: raw.slice(1), labelAlign: "center" };
    if (ch === "\\") return { type: "label", raw: raw.slice(1), labelAlign: "fill" };
    if (ch === "+" || ch === "-" || ch === "=") {
      const rest = raw.slice(1).trim();
      if (looksLikeNumber(rest)) {
        return { type: "number", raw, value: parseFloat(raw) };
      }
      // Store formula with leading prefix preserved so we can reconstruct
      // the user's exact text on copy/move.
      return { type: "formula", raw };
    }
    if (ch === "@") return { type: "formula", raw };
    if (/[0-9.]/.test(ch) && allowNumberPrefix) {
      if (looksLikeNumber(raw)) {
        return { type: "number", raw, value: parseFloat(raw) };
      }
      return { type: "formula", raw };
    }
    if (ch === "(") return { type: "formula", raw };
    return { type: "label", raw, labelAlign: "left" };
  }

  function looksLikeNumber(s) {
    if (s === "" || s == null) return false;
    // Accept: digits, optional ., optional e or E, optional sign on exponent
    return /^[+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?$/.test(s);
  }

  // Determine display format priority: cell-level > column-default > general
  function cellFormat(c, r) {
    const key = cellKey(c, r);
    if (formats.has(key)) return formats.get(key);
    return "general";
  }

  function displayNumber(n, format) {
    if (!isFinite(n)) return "ERR";
    switch (format) {
      case "fix":
        return n.toFixed(2);
      case "fix-0":
        return n.toFixed(0);
      case "fix-1":
        return n.toFixed(1);
      case "fix-3":
        return n.toFixed(3);
      case "fix-4":
        return n.toFixed(4);
      case "sci":
        return n.toExponential(2);
      case "currency":
        return "$" + n.toFixed(2);
      case "currency-minus":
        return "$" + Math.abs(n).toFixed(2);
      case "percent":
        return (n * 100).toFixed(2) + "%";
      case "plusminus":
        return (n >= 0 ? " +" : " -") + Math.abs(n).toFixed(0).padStart(2, " ");
      case "date":
        // Lotus date: integer 1 = Jan 1 1900; we'll use 1900 epoch
        return dateToStr(Math.round(n) + 1);
      default:
        // general: 10 wide, scientific for very large/small
        if (Math.abs(n) >= 1e10 || (Math.abs(n) < 1e-3 && n !== 0))
          return n.toExponential(2);
        // general needs right-align, drop trailing zeros
        let s = n.toPrecision(10);
        if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
        return s;
    }
  }

  function dateToStr(serial) {
    // Lotus 1-2-3 had a quirky leap year bug; we won't emulate it.
    const epoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899 → day 0 = Jan 1, 1900 (serial 1)
    const d = new Date(epoch.getTime() + serial * 86400000);
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${year}`;
  }

  function displayLabel(s, w, align) {
    s = String(s);
    if (s.length >= w) return s.slice(0, w);
    if (align === "right") return s.padStart(w, " ");
    if (align === "center") {
      const pad = w - s.length;
      const l = Math.floor(pad / 2);
      const r = pad - l;
      return " ".repeat(l) + s + " ".repeat(r);
    }
    return s.padEnd(w, " ");
  }

  // =====================================================================
  // 6. TOKENIZER — turns formula text into tokens
  //    Tokens: NUM, STR, IDENT (function or var), CELL, RANGE,
  //    CELLVLOOKUP, OP (+ - * / ^ ( ) ,), TEXT-LIT for strings.
  // =====================================================================

  const TT = {
    NUM: "NUM",
    STR: "STR",
    IDENT: "IDENT",
    CELL: "CELL",
    RANGE: "RANGE",
    OP: "OP",
    LPAREN: "LPAREN",
    RPAREN: "RPAREN",
    COMMA: "COMMA",
    COLON: "COLON",
    SEMI: "SEMI",
    BANG: "BANG",
  };

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === " " || ch === "\t") { i++; continue; }
      // Parens
      if (ch === "(") { tokens.push({ t: TT.LPAREN, v: "(" }); i++; continue; }
      if (ch === ")") { tokens.push({ t: TT.RPAREN, v: ")" }); i++; continue; }
      if (ch === ",") { tokens.push({ t: TT.COMMA, v: "," }); i++; continue; }
      if (ch === ";") { tokens.push({ t: TT.SEMI, v: ";" }); i++; continue; }
      if (ch === ":") {
        // Range operator — peek for a cell
        tokens.push({ t: TT.COLON, v: ":" });
        i++;
        continue;
      }
      // Quoted string
      if (ch === '"') {
        let j = i + 1;
        let lit = "";
        while (j < src.length && src[j] !== '"') { lit += src[j]; j++; }
        if (j < src.length) j++;
        tokens.push({ t: TT.STR, v: lit });
        i = j;
        continue;
      }
      // ".." range operator: must be checked before numbers, or ".." lexes as a NaN number
      if (ch === "." && src[i + 1] === ".") {
        tokens.push({ t: TT.COLON, v: ":" });
        i += 2;
        continue;
      }
      // Number
      if (/[0-9.]/.test(ch) || (ch === "-" || ch === "+") && /[0-9.]/.test(src[i + 1] || "")) {
        // handle optional sign on number but only if not followed by identifier (those are subtractions)
        let j = i;
        if (src[j] === "+" || src[j] === "-") {
          // Lookahead: if next char is digit, it's number; if next is letter or paren, it's an operator
          if (!/[0-9.(]/.test(src[j + 1] || "")) {
            tokens.push({ t: TT.OP, v: src[j] }); i = j + 1; continue;
          }
          j++;
        }
        let k = j;
        while (k < src.length && /[0-9.]/.test(src[k])) k++;
        if (src[k] === "e" || src[k] === "E") {
          k++;
          if (src[k] === "+" || src[k] === "-") k++;
          while (k < src.length && /[0-9]/.test(src[k])) k++;
        }
        const lit = src.slice(i, k);
        tokens.push({ t: TT.NUM, v: parseFloat(lit) });
        i = k;
        continue;
      }
      // Operator (and +/-)
      if ("+-*/^".indexOf(ch) >= 0) {
        tokens.push({ t: TT.OP, v: ch });
        i++; continue;
      }
      // Identifier: starts with letter, then letters/digits (no dot inside — leave dots to be range tokens)
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
        const ident = src.slice(i, j);
        // If followed by ":" or ".." → range endpoint — treat as cell token
        // Find a single cell coord like "A1", "AB23", etc. Identifier vs coord:
        const m = ident.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        if (m) {
          tokens.push({ t: TT.CELL, v: { c: colLetterToIndex(m[1]), r: parseInt(m[2], 10) } });
        } else {
          // Could be function name or named range name
          tokens.push({ t: TT.IDENT, v: ident.toUpperCase() });
        }
        i = j;
        continue;
      }
      // ".." alternative range operator
      if (ch === "." && src[i + 1] === ".") {
        tokens.push({ t: TT.COLON, v: ":" });
        i += 2;
        continue;
      }
      // Skip unknown
      i++;
    }
    return tokens;
  }

  // =====================================================================
  // 7. PARSER — recursive descent / precedence climbing
  // =====================================================================
  // Expression := Or
  // Or         := And ( "|" And )*
  // Actually, real Lotus only uses & and | as booleans inside @IF/@AND/@OR;
  // we don't expose them at top level — we treat AND/OR/IF as functions.

  // For expression grammar:
  //   expr := addExpr
  //   addExpr := mulExpr (('+'|'-') mulExpr)*
  //   mulExpr := unary (('*'|'/') unary)*
  //   unary := ('+'|'-')? primary
  //   primary := NUMBER | STRING | '(' expr ')' | functionCall | cellRef | rangeExpr

  // We use a Pratt-like approach with precedence.
  const PREC = { "+": 10, "-": 10, "*": 11, "/": 11, "^": 12 };

  function parseFormula(src) {
    const toks = tokenize(src);
    let pos = 0;
    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }
    function parsePrimary() {
      const t = peek();
      if (!t) throw makeErr("#PARSE!");
      if (t.t === TT.NUM) { next(); return { kind: "num", value: t.v }; }
      if (t.t === TT.STR) { next(); return { kind: "str", value: t.v }; }
      if (t.t === TT.OP && (t.v === "+" || t.v === "-")) {
        next();
        const e = parseUnary();
        return { kind: "neg", op: t.v === "-" ? "-" : "+", expr: e };
      }
      if (t.t === TT.LPAREN) {
        next();
        const e = parseExpr();
        const r = next();
        if (!r || r.t !== TT.RPAREN) throw makeErr("#PARSE!");
        return e;
      }
      if (t.t === TT.CELL) {
        next();
        // Maybe range: cell:cell
        if (peek() && peek().t === TT.COLON) {
          next();
          const r = next();
          if (!r || r.t !== TT.CELL) throw makeErr("#PARSE!");
          return { kind: "range", c1: t.v.c, r1: t.v.r, c2: r.v.c, r2: r.v.r };
        }
        return { kind: "cell", c: t.v.c, r: t.v.r };
      }
      if (t.t === TT.IDENT) {
        next();
        const name = t.v;
        // Allow short-named range lookup
        if (peek() && peek().t === TT.LPAREN) {
          // Function call
          next();
          const args = [];
          if (peek() && peek().t !== TT.RPAREN) {
            args.push(parseExpr());
            while (peek() && (peek().t === TT.COMMA || peek().t === TT.SEMI)) {
              next(); args.push(parseExpr());
            }
          }
          if (!(peek() && peek().t === TT.RPAREN)) throw makeErr("#PARSE!");
          next();
          return { kind: "func", name, args };
        }
        // Bare identifier → treat as a named range or 0/#NAME?
        // In Lotus this is the way to reference a named range.
        return { kind: "name", name };
      }
      if (t.t === TT.BANG) { next(); throw makeErr("#PARSE!"); }
      throw makeErr("#PARSE!");
    }
    function parseUnary() {
      if (peek() && peek().t === TT.OP && (peek().v === "+" || peek().v === "-")) {
        const op = next();
        const e = parseUnary();
        return { kind: "neg", op: op.v === "-" ? "-" : "+", expr: e };
      }
      return parsePrimary();
    }
    function parseBinary(prec) {
      let left = parseUnary();
      while (peek() && peek().t === TT.OP && PREC[peek().v] >= prec) {
        const op = next();
        const right = parseBinary(PREC[op.v] + (op.v === "^" ? 0 : 1));
        left = { kind: "bin", op: op.v, a: left, b: right };
      }
      return left;
    }
    function parseExpr() { return parseBinary(0); }
    const ast = parseExpr();
    if (pos < toks.length) throw makeErr("#PARSE!");
    return ast;
  }

  function makeErr(code) {
    const e = new Error(code);
    return e;
  }

  // =====================================================================
  // 8. CELL VALUE HELPERS — read computed value if any
  // =====================================================================

  function getCellValue(c, r) {
    const key = cellKey(c, r);
    return computed.get(key);
  }

  function evalCellRaw(c, r, visiting) {
    const key = cellKey(c, r);
    if (visiting.has(key)) throw new Error("#CIRC!");
    const cell = cells.get(key);
    if (!cell || !cell.raw) return { value: 0, kind: "number" };
    if (cell.type === "label") return { value: cell.raw, kind: "string" };
    if (cell.type === "number") return { value: cell.value, kind: "number" };
    if (cell.type === "formula") {
      // Cache-hit
      if (computed.has(key)) return computed.get(key);
      visiting.add(key);
      try {
        const src = cell.raw.replace(/^[+\-=@]/, "");
        const ast = cell._ast || (cell._ast = parseFormula(src));
        const v = evalAst(ast, visiting);
        return v;
      } catch (e) {
        const code = (e && typeof e === "object" && e.message) || "#ERR";
        return { value: code, kind: "err" };
      } finally {
        visiting.delete(key);
      }
    }
    return { value: 0, kind: "number" };
  }

  function rangeToCells(c1, r1, c2, r2) {
    const out = [];
    const { a, b } = encodeRange(c1, r1, c2, r2);
    for (let c = a.c; c <= b.c; c++) {
      for (let r = a.r; r <= b.r; r++) {
        out.push({ c, r });
      }
    }
    return out;
  }

  function rangeToValues(c1, r1, c2, r2, visiting) {
    const arr = [];
    for (const { c, r } of rangeToCells(c1, r1, c2, r2)) {
      const v = evalCellRaw(c, r, visiting);
      if (v.kind === "number") arr.push(v.value);
      else arr.push(v);  // strings/errs pass through
    }
    return arr;
  }

  // =====================================================================
  // 9. AST EVALUATION
  // =====================================================================

  function evalAst(node, visiting) {
    switch (node.kind) {
      case "num": return { value: node.value, kind: "number" };
      case "str": return { value: node.value, kind: "string" };
      case "neg":
        {
          const v = evalAst(node.expr, visiting);
          const num = toNumber(v);
          if (!isFinite(num)) return { value: "#VALUE!", kind: "err" };
          return { value: node.op === "-" ? -num : num, kind: "number" };
        }
      case "bin":
        {
          const a = evalAst(node.a, visiting);
          const b = evalAst(node.b, visiting);
          const na = toNumber(a);
          const nb = toNumber(b);
          if (!isFinite(na) || !isFinite(nb)) {
            if (node.op === "&") {
              return { value: trimStr(a) + trimStr(b), kind: "string" };
            }
            return { value: "#VALUE!", kind: "err" };
          }
          switch (node.op) {
            case "+": return { value: na + nb, kind: "number" };
            case "-": return { value: na - nb, kind: "number" };
            case "*": return { value: na * nb, kind: "number" };
            case "/":
              if (nb === 0) return { value: "#DIV/0!", kind: "err" };
              return { value: na / nb, kind: "number" };
            case "^": return { value: Math.pow(na, nb), kind: "number" };
            default:  return { value: "#VALUE!", kind: "err" };
          }
        }
      case "cell":
        return evalCellRaw(node.c, node.r, visiting);
      case "range": {
        // A range by itself yields @ERR or @NA — only valid as function argument
        return { value: "#VALUE!", kind: "err" };
      }
      case "name": {
        const k = node.name.toUpperCase();
        const range = names.get(k);
        if (!range) return { value: "#NAME?", kind: "err" };
        // Evaluate each cell in the range and return the first value's cell-like wrapper
        // (For SUM etc., functions handle ranges directly via nodes; here we just resolve.)
        // We'll return a virtual value: first cell's value
        return evalCellRaw(range.a.c, range.a.r, visiting);
      }
      case "func":
        return callFunction(node.name, node.args, visiting);
      default:
        return { value: "#ERR", kind: "err" };
    }
  }

  function toNumber(v) {
    if (!v) return 0;
    if (v.kind === "number") return v.value;
    if (v.kind === "string") {
      const n = parseFloat(v.value);
      return isFinite(n) ? n : NaN;
    }
    return NaN;
  }
  function trimStr(v) {
    if (!v) return "";
    if (v.kind === "string") return String(v.value);
    return String(v.value);
  }
  function toBool(v) {
    if (!v) return false;
    if (v.kind === "number") return v.value !== 0;
    if (v.kind === "string") return v.value !== "" && v.value !== "0";
    if (v.kind === "na" || v.kind === "err") return false;
    return false;
  }

  // Convert arg to "argument list": numbers → numbers, ranges → arrays of numbers,
  // strings → strings, cells → single values, ...
  function expandArg(arg, visiting) {
    const v = evalAst(arg, visiting);
    if (v.kind === "number" || v.kind === "string") return v;
    if (arg.kind === "range") {
      // Range of mixed cells → array
      const out = [];
      for (const { c, r } of rangeToCells(arg.c1, arg.r1, arg.c2, arg.r2)) {
        const cv = evalCellRaw(c, r, visiting);
        out.push(cv);
      }
      return { value: out, kind: "array" };
    }
    return v;
  }

  function flatNumbers(args, visiting) {
    const out = [];
    for (const a of args) {
      const ex = expandArg(a, visiting);
      if (ex.kind === "array") {
        for (const x of ex.value) {
          if (x.kind === "number") out.push(x.value);
        }
      } else if (ex.kind === "number") {
        out.push(ex.value);
      }
    }
    return out;
  }

  // =====================================================================
  // 10. FUNCTION LIBRARY — @-functions
  // =====================================================================

  const FUNCTIONS = {
    // ---- Aggregate / Statistical ----
    SUM(args, visiting) {
      const xs = flatNumbers(args, visiting);
      let s = 0; for (const x of xs) s += x;
      return { value: s, kind: "number" };
    },
    AVG(args, visiting) {
      const xs = flatNumbers(args, visiting);
      if (!xs.length) return { value: "#DIV/0!", kind: "err" };
      let s = 0; for (const x of xs) s += x;
      return { value: s / xs.length, kind: "number" };
    },
    MEAN(args, v) { return FUNCTIONS.AVG(args, v); },
    MIN(args, visiting) {
      const xs = flatNumbers(args, visiting);
      if (!xs.length) return { value: 0, kind: "number" };
      return { value: Math.min(...xs), kind: "number" };
    },
    MAX(args, visiting) {
      const xs = flatNumbers(args, visiting);
      if (!xs.length) return { value: 0, kind: "number" };
      return { value: Math.max(...xs), kind: "number" };
    },
    COUNT(args, visiting) {
      const xs = flatNumbers(args, visiting);
      return { value: xs.length, kind: "number" };
    },
    STD(args, visiting) {
      const xs = flatNumbers(args, visiting);
      const n = xs.length;
      if (n < 2) return { value: 0, kind: "number" };
      const m = xs.reduce((a, b) => a + b, 0) / n;
      const s = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1);
      return { value: Math.sqrt(s), kind: "number" };
    },
    VAR(args, v) {
      const xs = flatNumbers(args, v);
      const n = xs.length;
      if (n < 2) return { value: 0, kind: "number" };
      const m = xs.reduce((a, b) => a + b, 0) / n;
      const s = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1);
      return { value: s, kind: "number" };
    },

    // ---- Logical ----
    IF(args, visiting) {
      // IF(cond, then, [else])
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const cond = evalAst(args[0], visiting);
      return toBool(cond) ? evalAst(args[1], visiting) : (args.length >= 3 ? evalAst(args[2], visiting) : { value: 0, kind: "number" });
    },
    AND(args, visiting) {
      let res = true;
      for (const a of args) {
        const v = evalAst(a, visiting);
        if (!toBool(v)) { res = false; break; }
      }
      return { value: res ? 1 : 0, kind: "number" };
    },
    OR(args, visiting) {
      let res = false;
      for (const a of args) {
        const v = evalAst(a, visiting);
        if (toBool(v)) { res = true; break; }
      }
      return { value: res ? 1 : 0, kind: "number" };
    },
    NOT(args, visiting) {
      const v = evalAst(args[0], visiting);
      return { value: toBool(v) ? 0 : 1, kind: "number" };
    },

    // ---- Math / Trig ----
    INT(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.floor(v), kind: "number" };
    },
    ROUND(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const d = args.length >= 2 ? toNumber(evalAst(args[1], visiting)) : 0;
      const m = Math.pow(10, d);
      return { value: Math.round(v * m) / m, kind: "number" };
    },
    MOD(args, visiting) {
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const a = toNumber(evalAst(args[0], visiting));
      const b = toNumber(evalAst(args[1], visiting));
      if (b === 0) return { value: "#DIV/0!", kind: "err" };
      return { value: a - Math.floor(a / b) * b, kind: "number" };
    },
    ABS(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.abs(v), kind: "number" };
    },
    SQRT(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      if (v < 0) return { value: "#NUM!", kind: "err" };
      return { value: Math.sqrt(v), kind: "number" };
    },
    EXP(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.exp(v), kind: "number" };
    },
    LN(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      if (v <= 0) return { value: "#NUM!", kind: "err" };
      return { value: Math.log(v), kind: "number" };
    },
    LOG(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const base = args.length >= 2 ? toNumber(evalAst(args[1], visiting)) : 10;
      if (v <= 0 || base <= 0) return { value: "#NUM!", kind: "err" };
      return { value: Math.log(v) / Math.log(base), kind: "number" };
    },
    PI() {
      return { value: Math.PI, kind: "number" };
    },
    POW(args, visiting) {
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const a = toNumber(evalAst(args[0], visiting));
      const b = toNumber(evalAst(args[1], visiting));
      return { value: Math.pow(a, b), kind: "number" };
    },
    SIN(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.sin(v), kind: "number" };
    },
    COS(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.cos(v), kind: "number" };
    },
    TAN(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.tan(v), kind: "number" };
    },
    ASIN(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      if (v < -1 || v > 1) return { value: "#NUM!", kind: "err" };
      return { value: Math.asin(v), kind: "number" };
    },
    ACOS(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      if (v < -1 || v > 1) return { value: "#NUM!", kind: "err" };
      return { value: Math.acos(v), kind: "number" };
    },
    ATAN(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.atan(v), kind: "number" };
    },
    ATAN2(args, visiting) {
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const a = toNumber(evalAst(args[0], visiting));
      const b = toNumber(evalAst(args[1], visiting));
      return { value: Math.atan2(a, b), kind: "number" };
    },
    RAND() { return { value: Math.random(), kind: "number" }; },
    SIGN(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: Math.sign(v), kind: "number" };
    },

    // ---- Text ----
    LEN(args, visiting) {
      const v = evalAst(args[0], visiting);
      const s = trimStr(v);
      return { value: s.length, kind: "number" };
    },
    MID(args, visiting) {
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const s = trimStr(evalAst(args[0], visiting));
      const start = toNumber(evalAst(args[1], visiting));
      const count = args.length >= 3 ? toNumber(evalAst(args[2], visiting)) : 1;
      return { value: s.substr(Math.max(0, start - 1), count), kind: "string" };
    },
    LEFT(args, visiting) {
      const s = trimStr(evalAst(args[0], visiting));
      const n = args.length >= 2 ? toNumber(evalAst(args[1], visiting)) : 1;
      return { value: s.substr(0, n), kind: "string" };
    },
    RIGHT(args, visiting) {
      const s = trimStr(evalAst(args[0], visiting));
      const n = args.length >= 2 ? toNumber(evalAst(args[1], visiting)) : 1;
      return { value: s.slice(-n), kind: "string" };
    },
    REPT(args, visiting) {
      const s = trimStr(evalAst(args[0], visiting));
      const n = toNumber(evalAst(args[1], visiting));
      if (!s || n <= 0) return { value: "", kind: "string" };
      return { value: s.repeat(Math.floor(n)), kind: "string" };
    },
    UPPER(args, visiting) {
      return { value: trimStr(evalAst(args[0], visiting)).toUpperCase(), kind: "string" };
    },
    LOWER(args, visiting) {
      return { value: trimStr(evalAst(args[0], visiting)).toLowerCase(), kind: "string" };
    },
    VALUE(args, visiting) {
      const s = trimStr(evalAst(args[0], visiting));
      const n = parseFloat(s);
      return isFinite(n) ? { value: n, kind: "number" } : { value: "#VALUE!", kind: "err" };
    },
    STRING(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const d = args.length >= 2 ? toNumber(evalAst(args[1], visiting)) : 2;
      return { value: v.toFixed(d), kind: "string" };
    },
    FIXED(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const d = args.length >= 2 ? toNumber(evalAst(args[1], visiting)) : 2;
      return { value: v.toFixed(d), kind: "string" };
    },
    CHAR(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      return { value: String.fromCharCode(Math.round(v)), kind: "string" };
    },
    CODE(args, visiting) {
      const s = trimStr(evalAst(args[0], visiting));
      if (!s) return { value: 0, kind: "number" };
      return { value: s.charCodeAt(0), kind: "number" };
    },

    // ---- Date / Time ----
    NOW() {
      return { value: (Date.now() - Date.UTC(1899, 11, 30)) / 86400000, kind: "number" };
    },
    TODAY() {
      const t = new Date();
      const midnightUtc = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
      return { value: (midnightUtc - Date.UTC(1899, 11, 30)) / 86400000, kind: "number" };
    },
    DATE(args, visiting) {
      if (args.length < 3) return { value: "#VALUE!", kind: "err" };
      const y = Math.round(toNumber(evalAst(args[0], visiting)));
      const m = Math.round(toNumber(evalAst(args[1], visiting)));
      const d = Math.round(toNumber(evalAst(args[2], visiting)));
      const ms = Date.UTC(y, m - 1, d);
      const epoch = Date.UTC(1899, 11, 30);
      return { value: (ms - epoch) / 86400000, kind: "number" };
    },
    MONTH(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      return { value: new Date(ms).getUTCMonth() + 1, kind: "number" };
    },
    DAY(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      return { value: new Date(ms).getUTCDate(), kind: "number" };
    },
    YEAR(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      return { value: new Date(ms).getUTCFullYear(), kind: "number" };
    },
    HOUR(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      return { value: new Date(ms).getUTCHours(), kind: "number" };
    },
    MINUTE(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      return { value: new Date(ms).getUTCMinutes(), kind: "number" };
    },
    SECOND(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      return { value: new Date(ms).getUTCSeconds(), kind: "number" };
    },
    DTSTRING(args, visiting) {
      const v = toNumber(evalAst(args[0], visiting));
      const ms = Date.UTC(1899, 11, 30) + v * 86400000;
      const d = new Date(ms);
      return { value: `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}-${d.getUTCFullYear()}`, kind: "string" };
    },

    // ---- Special ----
    NA() { return { value: "#NA", kind: "err" }; },
    ERR() { return { value: "#ERR", kind: "err" }; },
    ISERR(args, visiting) {
      const v = evalAst(args[0], visiting);
      return { value: v.kind === "err" && v.value !== "#NA" ? 1 : 0, kind: "number" };
    },
    ISNA(args, visiting) {
      const v = evalAst(args[0], visiting);
      return { value: v.kind === "err" && v.value === "#NA" ? 1 : 0, kind: "number" };
    },
    ISNUMBER(args, visiting) {
      const v = evalAst(args[0], visiting);
      return { value: v.kind === "number" ? 1 : 0, kind: "number" };
    },
    ISSTRING(args, visiting) {
      const v = evalAst(args[0], visiting);
      return { value: v.kind === "string" ? 1 : 0, kind: "number" };
    },

    // ---- Lookup ----
    CHOOSE(args, visiting) {
      if (!args.length) return { value: "#VALUE!", kind: "err" };
      const idx = Math.round(toNumber(evalAst(args[0], visiting)));
      if (idx < 1 || idx > args.length - 1) return { value: "#VALUE!", kind: "err" };
      return evalAst(args[idx], visiting);
    },
    INDEX(args, visiting) {
      // INDEX(range, col, [row]) — col is horizontal, row is vertical (1-based)
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const rangeArg = args[0];
      if (rangeArg.kind !== "range") return { value: "#VALUE!", kind: "err" };
      const col = Math.round(toNumber(evalAst(args[1], visiting)));
      const row = args.length >= 3 ? Math.round(toNumber(evalAst(args[2], visiting))) : 1;
      const { a, b } = encodeRange(rangeArg.c1, rangeArg.r1, rangeArg.c2, rangeArg.r2);
      const c = a.c + col - 1;
      const r = a.r + row - 1;
      if (c > b.c || r > b.r) return { value: "#VALUE!", kind: "err" };
      return evalCellRaw(c, r, visiting);
    },
    VLOOKUP(args, visiting) {
      // VLOOKUP(key, table, colOffset) — table = c1..c2 / r1..r2 with first column = keys
      if (args.length < 3) return { value: "#VALUE!", kind: "err" };
      const key = evalAst(args[0], visiting);
      const table = args[1];
      const colOffset = Math.round(toNumber(evalAst(args[2], visiting)));
      if (table.kind !== "range") return { value: "#VALUE!", kind: "err" };
      const { a, b } = encodeRange(table.c1, table.r1, table.c2, table.r2);
      const targetC = a.c + colOffset - 1;
      if (targetC < a.c || targetC > b.c) return { value: "#REF!", kind: "err" };
      for (let r = a.r; r <= b.r; r++) {
        const kv = evalCellRaw(a.c, r, visiting);
        if (kv.kind === key.kind && kv.value === key.value) {
          return evalCellRaw(targetC, r, visiting);
        }
      }
      return { value: "#NA", kind: "err" };
    },
    HLOOKUP(args, visiting) {
      if (args.length < 3) return { value: "#VALUE!", kind: "err" };
      const key = evalAst(args[0], visiting);
      const table = args[1];
      const rowOffset = Math.round(toNumber(evalAst(args[2], visiting)));
      if (table.kind !== "range") return { value: "#VALUE!", kind: "err" };
      const { a, b } = encodeRange(table.c1, table.r1, table.c2, table.r2);
      const targetR = a.r + rowOffset - 1;
      if (targetR < a.r || targetR > b.r) return { value: "#REF!", kind: "err" };
      for (let c = a.c; c <= b.c; c++) {
        const kv = evalCellRaw(c, a.r, visiting);
        if (kv.kind === key.kind && kv.value === key.value) {
          return evalCellRaw(c, targetR, visiting);
        }
      }
      return { value: "#NA", kind: "err" };
    },
    MATCH() { return { value: "#NOT IMPL", kind: "err" }; },

    // ---- Cell meta ----
    CELL(args, visiting) {
      // CELL(addr, "type") returns type code; we only implement a subset
      if (args.length < 2) return { value: "#VALUE!", kind: "err" };
      const cellArg = args[0];
      if (cellArg.kind !== "cell") return { value: "#VALUE!", kind: "err" };
      const info = trimStr(evalAst(args[1], visiting)).toLowerCase();
      const cell = cells.get(cellKey(cellArg.c, cellArg.r));
      const v = cell ? evalCellRaw(cellArg.c, cellArg.r, visiting) : { value: 0, kind: "number" };
      if (info === "type") return { value: v.kind === "number" ? "v" : "l", kind: "string" };
      if (info === "contents") return { value: v.value, kind: v.kind };
      if (info === "format") return { value: cellFormat(cellArg.c, cellArg.r), kind: "string" };
      if (info === "width") return { value: colWidths[cellArg.c], kind: "number" };
      return { value: "#VALUE!", kind: "err" };
    },
    CELLPOINTER(args, visiting) {
      // Returns "width" of the current cell — interpreted as offset value.
      const idx = Math.round(toNumber(evalAst(args[0], visiting)));
      if (idx === 0) return { value: cur.c, kind: "number" };
      if (idx === 1) return { value: cur.r, kind: "number" };
      return { value: "#VALUE!", kind: "err" };
    },

    // ---- Dependency helpers ----
    HLOOKUP_ALT() { return { value: "#HLOOKUP2", kind: "err" }; },
  };

  // Aliases
  FUNCTIONS.PI = FUNCTIONS.PI;

  function callFunction(name, args, visiting) {
    const n = name.toUpperCase();
    let f = FUNCTIONS[n];
    if (!f) return { value: "#NAME?", kind: "err" };
    try {
      return f(args, visiting) || { value: 0, kind: "number" };
    } catch (e) {
      return { value: (e && e.message) || "#ERR", kind: "err" };
    }
  }

  // =====================================================================
  // 11. CELL STORAGE + RECOMPUTATION
  // =====================================================================

  function setCell(c, r, raw) {
    const key = cellKey(c, r);
    const cls = classifyInput(raw);
    if (cls.type === "empty") {
      cells.delete(key);
      formats.delete(key);
      computed.delete(key);
    } else if (cls.type === "label") {
      cells.set(key, { raw: cls.raw, type: "label", align: cls.labelAlign });
      computed.set(key, { value: cls.raw, kind: "string" });
    } else if (cls.type === "number") {
      cells.set(key, { raw: cls.raw, type: "number", value: cls.value });
      computed.set(key, { value: cls.value, kind: "number" });
    } else if (cls.type === "formula") {
      const cell = { raw: cls.raw, type: "formula" };
      cells.set(key, cell);
      try {
        const src = cls.raw.replace(/^[+\-=@]/, "");
        cell._ast = parseFormula(src);
        const v = evalCellRaw(c, r, new Set());
        computed.set(key, v);
      } catch (e) {
        computed.set(key, { value: (e && e.message) || "#ERR", kind: "err" });
      }
    }
    recomputeStale = true;
    sheetDirty = true;
    if (settings.autosave) scheduleAutosave();
    render();
  }

  function setCellLabel(c, r, text, align) {
    const key = cellKey(c, r);
    cells.set(key, { raw: text, type: "label", align: align || "left" });
    computed.set(key, { value: text, kind: "string" });
    recomputeStale = true;
    sheetDirty = true;
    if (settings.autosave) scheduleAutosave();
    render();
  }

  function setCellNumber(c, r, value) {
    const key = cellKey(c, r);
    cells.set(key, { raw: String(value), type: "number", value });
    computed.set(key, { value, kind: "number" });
    sheetDirty = true;
    if (settings.autosave) scheduleAutosave();
    render();
  }

  function getCellRaw(c, r) {
    const cell = cells.get(cellKey(c, r));
    return cell ? cell.raw : "";
  }

  function getCellDisplay(c, r) {
    const key = cellKey(c, r);
    const cell = cells.get(key);
    const v = computed.get(key);
    const w = colWidths[c];
    const fmt = cellFormat(c, r);
    if (!cell || cell.type === "empty") return " ".repeat(w);
    if (cell.type === "label") {
      return displayLabel(v.value, w, cell.align || "left");
    }
    if (cell.type === "number") {
      return displayLabel(displayNumber(v.value, fmt), w, "right");
    }
    if (cell.type === "formula") {
      if (v.kind === "number") return displayLabel(displayNumber(v.value, fmt), w, "right");
      if (v.kind === "string") return displayLabel(v.value, w, "left");
      if (v.kind === "err") return displayLabel(v.value, w, "right");
      return " ".repeat(w);
    }
    return " ".repeat(w);
  }

  function getCellTypeLabel(c, r) {
    const cell = cells.get(cellKey(c, r));
    if (!cell) return "";
    if (cell.type === "label") return `'${cell.raw}`;
    if (cell.type === "number") return String(cell.value);
    if (cell.type === "formula") return "+" + cell.raw;
    return "";
  }

  function recalcAll() {
    // Recompute formulas only. Labels and numbers keep their computed values.
    for (const [key, cell] of cells.entries()) {
      if (cell.type === "formula") {
        try {
          cell._ast = null;  // invalidate cached AST
          const c = colLetterToIndex(key.match(/^[A-Z]+/)[0]);
          const r = parseInt(key.match(/\d+$/)[0], 10);
          const v = evalCellRaw(c, r, new Set());
          computed.set(key, v);
        } catch (e) {
          computed.set(key, { value: "#ERR", kind: "err" });
        }
      }
    }
    recomputeStale = false;
  }

  // =====================================================================
  // 12. PERSISTENCE
  // =====================================================================

  function serializeState() {
    const cellsArr = [];
    for (const [key, cell] of cells.entries()) {
      const c = colLetterToIndex(key.match(/^[A-Z]+/)[0]);
      const r = parseInt(key.match(/\d+$/)[0], 10);
      cellsArr.push({
        c, r,
        raw: cell.raw,
        type: cell.type,
        value: cell.value,
        align: cell.align,
        format: formats.get(key) || null,
      });
    }
    const namesArr = [];
    for (const [name, range] of names.entries()) {
      namesArr.push({ name, range: { c1: range.a.c, r1: range.a.r, c2: range.b.c, r2: range.b.r } });
    }
    return {
      version: SCHEMA_VERSION,
      title: sheetTitle,
      cells: cellsArr,
      names: namesArr,
      colWidths,
    };
  }

  function loadState(state) {
    if (!state || state.version !== SCHEMA_VERSION) return false;
    trace("loadState start cells.length=" + (state.cells ? state.cells.length : "?"));
    cells.clear(); computed.clear(); formats.clear(); names.clear();
    sheetTitle = state.title || "Untitled";
    if (Array.isArray(state.colWidths)) {
      for (let i = 0; i < TOTAL_COLS; i++) colWidths[i] = state.colWidths[i] || DEFAULT_COL_WIDTH;
    }
    for (const c of state.cells || []) {
      trace("loadState iter c=" + c.c + " r=" + c.r + " type=" + c.type);
      if (c.type === "label") {
        setCellLabel(c.c, c.r, c.raw, c.align);
        if (c.format) formats.set(cellKey(c.c, c.r), c.format);
      } else if (c.type === "number") {
        setCellNumber(c.c, c.r, c.value);
        if (c.format) formats.set(cellKey(c.c, c.r), c.format);
      } else if (c.type === "formula") {
        setCell(c.c, c.r, c.raw);
        if (c.format) formats.set(cellKey(c.c, c.r), c.format);
      }
    }
    for (const n of state.names || []) {
      names.set(n.name.toUpperCase(), encodeRange(n.range.c1, n.range.r1, n.range.c2, n.range.r2));
    }
    return true;
  }

  let autosaveTimer = null;
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(serializeState()));
        document.body.dataset.saved = "yes";
      } catch (_) {}
    }, 600);
  }

  function saveAsFile() {
    const data = JSON.stringify(serializeState(), null, 2);
    const filename = (sheetTitle || "untitled").toUpperCase().replace(/[^A-Z0-9]+/g, "_") + ".123.json";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function loadFromFile() {
    const input = $("file-input");
    input.onchange = (e) => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const obj = JSON.parse(ev.target.result);
          if (loadState(obj)) render();
          else setError("Invalid file format");
        } catch (e) { setError("Could not parse file"); }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  // =====================================================================
  // 13. RENDERING — Lotus screen layout
  // =====================================================================

  function columnWidthStyle(i) {
    const w = colWidths[i];
    return `${w}ch`;
  }

  function render() {
    if (recomputeStale) recalcAll();

    // Build a CSS grid style for each row based on column widths
    const widths = Array.from({ length: VISIBLE_COLS + 1 }, (_, i) => {
      if (i === 0) return "5ch";
      return `${colWidths[i - 1]}ch`;
    }).join(" ");

    // Compute scroll position: ensure cur is visible
    const totalHeight = grid.clientHeight;
    const rowHeight = 14; // approximate
    const offsetTop = (cur.r - 1) * rowHeight;
    const offsetLeft = cur.c * 8 * 9; // approximate
    // (Simplified: keep fixed view; virtual scrolling handled below)

    // Build header row + 20 data rows
    const headerCols = ["", ...COLUMN_LETTERS.slice(0, VISIBLE_COLS)];
    let html = `<div class="grid-row header-row" style="grid-template-columns:${widths};">`;
    for (let i = 0; i < VISIBLE_COLS + 1; i++) {
      const text = i === 0 ? "A1" : COLUMN_LETTERS[i - 1];
      html += `<div class="cell col-header" style="grid-column:${i + 1};">${text}</div>`;
    }
    html += "</div>";

    // Display only rows around current pointer
    const startRow = Math.max(1, Math.min(cur.r - 4, TOTAL_ROWS - VISIBLE_ROWS + 1));
    const endRow = startRow + VISIBLE_ROWS - 1;
    if (endRow > TOTAL_ROWS) endRow = TOTAL_ROWS;

    for (let r = startRow; r <= endRow; r++) {
      html += `<div class="grid-row" style="grid-template-columns:${widths};">`;
      html += `<div class="cell row-header" style="grid-column:1;">${r}</div>`;
      for (let i = 0; i < VISIBLE_COLS; i++) {
        const c = i;
        const klass = c === cur.c && r === cur.r ? "cell current"
          : inRange && rangeContains(inRange, c, r) ? "cell in-range"
          : cellClass(c, r);
        html += `<div class="${klass}" style="grid-column:${i + 2};">${escapeHtml(getCellDisplay(c, r))}</div>`;
      }
      html += "</div>";
    }

    grid.innerHTML = html;

    // Indicator
    cellCoord.textContent = cellKey(cur.c, cur.r);
    cellContentsEl.innerHTML = renderContents();

    // Mode strip + keys
    if (mode.name === "MENU") {
      modeLabel.textContent = "MENU";
      // Show the choices on the menu line, as 1-2-3 does (they were never rendered).
      const node = currentMenuNode();
      const path = mode.menuPath.map(m => m.label).filter(Boolean).join(" ");
      const choices = node && node.children ? node.children.filter(Boolean).map(c => c.label).join("  ") : "";
      modeMenus.textContent = (path ? path + ": " : "") + choices;
    } else if (mode.name === "EDIT") {
      modeLabel.textContent = "EDIT";
      modeMenus.textContent = "";
    } else if (mode.name === "POINT") {
      modeLabel.textContent = "POINT";
      const a = cellKey(mode.anchor.c, mode.anchor.r);
      const b = cellKey(mode.pointTarget.c, mode.pointTarget.r);
      modeMenus.textContent = `${a}..${b}`;
    } else if (mode.name === "FILL") {
      modeLabel.textContent = "FILL";
      modeMenus.textContent = "Enter value and step";
    } else if (mode.name === "ERROR") {
      modeLabel.textContent = "ERROR";
      modeMenus.textContent = mode.errorMessage || "";
    } else if (mode.name === "HELP") {
      modeLabel.textContent = "HELP";
      modeMenus.textContent = "Press any key to return";
    } else if (mode.name === "GRAPH") {
      modeLabel.textContent = "GRAPH";
      modeMenus.textContent = "Press Esc to return";
    } else if (mode.name === "DIR") {
      modeLabel.textContent = "DIRECTORY";
      modeMenus.textContent = mode.dirSheetNames.length
        ? `↑↓ choose · Enter retrieve · Esc cancel`
        : `No saved sheets · Esc cancel`;
    } else {
      modeLabel.textContent = "READY";
      modeMenus.textContent = "";
    }

    renderKeyLine();
    updateLegend();
    renderCaret();
    updateFloppyLed();
    if (mode.name !== "GRAPH") chartOverlay.hidden = true;
  }

  function cellClass(c, r) {
    const cell = cells.get(cellKey(c, r));
    if (!cell) return "cell";
    if (cell.type === "label") return "cell label";
    if (cell.type === "number") return "cell number";
    return "cell formula";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  function renderContents() {
    if (mode.name === "EDIT") {
      const buf = mode.editBuffer;
      // Insert cursor mark
      const idx = mode.editCursor;
      const left = escapeHtml(buf.slice(0, idx));
      const cursor = idx < buf.length ? escapeHtml(buf[idx]) : " ";
      const right = escapeHtml(buf.slice(idx + 1));
      return (left || " ") + `<span class="caret-mark">${cursor}</span>` + (right || "");
    }
    const cell = cells.get(cellKey(cur.c, cur.r));
    if (!cell || !cell.raw) return "&nbsp;";
    if (cell.type === "label") return `'${escapeHtml(cell.raw)}`;
    if (cell.type === "number") return escapeHtml(String(cell.value));
    if (cell.type === "formula") return `+${escapeHtml(cell.raw)}`;
    return "&nbsp;";
  }

  function renderKeyLine() {
    const keyMap = {
      READY: ["F1 Help", "F2 Edit", "/", "Arrows", "F5 Goto"],
      EDIT: ["Enter ↵", "Esc cancel", "← →", "Tab", "Arrows"],
      MENU: ["Esc back", "Letter", "Enter", "← →", ""],
      POINT: ["Arrows", "Enter ok", "Esc cancel", "", "", ""],
      FILL: ["Enter ok", "Esc cancel", "", "", "", ""],
      ERROR: ["Enter ok", "Esc back", "", "", "", ""],
      HELP: ["Esc back", "Any key", "", "", "", ""],
      GRAPH: ["Esc back", "", "", "", "", ""],
      DIR: ["↑ ↓", "Enter ok", "Esc cancel", "", "", ""],
    };
    const slots = keyMap[mode.name] || keyMap.READY;
    // Lotus shows 8 columns of key-assignments at the bottom — pad to 8
    while (slots.length < 8) slots.push("");
    let html = "";
    for (let i = 0; i < 8; i++) {
      html += `<span class="key-row">${slots[i] ? "[" + slots[i] + "]" : ""}</span>`;
    }
    keyLine.innerHTML = html;
  }

  function renderCaret() {
    if (mode.name !== "EDIT") {
      caret.style.display = "none";
      return;
    }
    caret.style.display = "block";
  }

  // On-screen function keys: every button replays the real key through onKeyDown,
  // so clicks/taps and the keyboard share one code path.
  const FKEY_BUTTONS = [
    { k: "F1", l: "Help" },
    { k: "F2", l: "Edit" },
    { k: "F3", l: "Name" },
    { k: "F4", l: "Menu" },
    { k: "F5", l: "GoTo" },
    { k: "F6", l: "Window" },
    { k: "F7", l: "Format" },
    { k: "F8", l: "Calc" },
    { k: "F9", l: "File" },
    { k: "F10", l: "Graph" },
    { k: "/", l: "Menu" },
    { k: "Escape", t: "Esc", l: "Cancel" },
  ];
  let legendBuilt = false;
  function updateLegend() {
    if (legendBuilt) return;
    legendBuilt = true;
    legendKeys.innerHTML = FKEY_BUTTONS
      .map(s => `<button type="button" class="fkey" data-key="${s.k}" aria-label="${s.t || s.k} ${s.l}">` +
        `<span class="key">${s.t || s.k}</span><span class="fkey-label">${s.l}</span></button>`)
      .join("");
    // Keep focus where it is (the sheet listens on document).
    legendKeys.addEventListener("mousedown", (e) => { if (e.target.closest(".fkey")) e.preventDefault(); });
    legendKeys.addEventListener("click", (e) => {
      const btn = e.target.closest(".fkey");
      if (!btn) return;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: btn.dataset.key, bubbles: true, cancelable: true }));
    });
  }

  function updateFloppyLed() {
    if (floppyLed) floppyLed.style.opacity = sheetDirty ? "0.95" : "0.3";
    if (hddLed) {
      hddLed.classList.add("on");
      setTimeout(() => hddLed.classList.remove("on"), 200);
    }
  }

  // =====================================================================
  // 14. ERROR / MESSAGE HANDLING
  // =====================================================================

  function setError(msg) {
    mode.name = "ERROR";
    mode.errorMessage = msg;
    render();
  }
  function clearError() {
    if (mode.name === "ERROR") mode.name = "READY";
    mode.errorMessage = "";
  }

  function setIndicatorMenuText(text) {
    if (mode.name === "MENU") {
      modeMenuLastPrompt = text;
    }
  }
  let modeMenuLastPrompt = "";

  // =====================================================================
  // 15. INPUT — Keyboard dispatcher per mode
  // =====================================================================

  function onKeyDown(e) {
    const k = e.key;
    // Global shortcuts
    if (k === "F1") { e.preventDefault(); enterHelp(); return; }
    if (mode.name === "READY") return handleReadyKey(e);
    if (mode.name === "EDIT")  return handleEditKey(e);
    if (mode.name === "MENU")  return handleMenuKey(e);
    if (mode.name === "POINT") return handlePointKey(e);
    if (mode.name === "FILL")  return handleFillKey(e);
    if (mode.name === "ERROR") return handleErrorKey(e);
    if (mode.name === "HELP")  return handleHelpKey(e);
    if (mode.name === "GRAPH") return handleGraphKey(e);
    if (mode.name === "DIR")   return handleDirKey(e);
  }

  function isPrintable(k) { return k.length === 1; }

  function handleReadyKey(e) {
    const k = e.key;
    if (k === "F2") { e.preventDefault(); beginEdit(getCellRaw(cur.c, cur.r)); return; }
    if (k === "F4") { e.preventDefault(); openMenu("/"); return; }
    if (k === "F5") {
      e.preventDefault();
      const target = prompt("Goto cell (e.g. B17) or named range", "");
      if (!target) return;
      const t = target.trim().toUpperCase();
      // Try named range first
      if (names.has(t)) {
        const r = names.get(t);
        cur.c = r.a.c; cur.r = r.a.r;
        render();
        return;
      }
      // Try direct coord
      const m = t.match(/^([A-Z]+)(\d+)$/);
      if (m) {
        const c = colLetterToIndex(m[1]);
        const r = parseInt(m[2], 10);
        if (coordValid(c, r)) { cur.c = c; cur.r = r; render(); return; }
      }
      setError(`No cell or name "${target}"`);
      return;
    }
    if (k === "F3" || k === "F6") {
      e.preventDefault();
      setIndicatorNote(k === "F3" ? "F3 Name: use /Range Name in this edition" : "F6 Window: single window in this edition");
      return;
    }
    if (k === "F7") { e.preventDefault(); enterRangeFormatPrompt(); return; }
    if (k === "F8" || (k === "Ctrl" && false)) { e.preventDefault(); recalcAll(); render(); return; }
    if (k === "F9") { e.preventDefault(); openMenu("/"); const w = findMenu("File"); mode.menuPath.push(w); render(); return; }
    if (k === "F10") { e.preventDefault(); openMenu("/"); const w = findMenu("Graph"); mode.menuPath.push(w); render(); return; }
    if (k === "Escape") { e.preventDefault(); inRange = null; anchorMarker = null; render(); return; }
    if (k === "ArrowDown") { e.preventDefault(); nextCellDown(); return; }
    if (k === "ArrowUp")   { e.preventDefault(); nextCellUp(); return; }
    if (k === "ArrowLeft") { e.preventDefault(); nextCellLeft(); return; }
    if (k === "ArrowRight"){ e.preventDefault(); nextCellRight(); return; }
    if (k === "Tab")       { e.preventDefault(); nextCellRight(); return; }
    if (k === "Enter")     { e.preventDefault(); nextCellDown(); return; }
    if (k === "PageDown")  { e.preventDefault(); cur.r = Math.min(TOTAL_ROWS, cur.r + VISIBLE_ROWS); render(); return; }
    if (k === "PageUp")    { e.preventDefault(); cur.r = Math.max(1, cur.r - VISIBLE_ROWS); render(); return; }
    if (k === "Home")      { e.preventDefault(); cur.c = 0; cur.r = 1; render(); return; }
    if (k === "End")       {
      e.preventDefault();
      const lastUsed = findLastUsed();
      cur.c = lastUsed.c; cur.r = lastUsed.r;
      render();
      return;
    }
    if (k === "/")  { e.preventDefault(); openMenu("/"); return; }
    if (isPrintable(k) || k === "+" || k === "-" || k === "*" || k === "/" || k === "=" || k === "@" || k === "'" || k === '"' || k === "^") {
      e.preventDefault();
      beginEdit(k);
      return;
    }
  }

  function handleEditKey(e) {
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      mode.name = "READY";
      mode.editBuffer = "";
      render();
      return;
    }
    if (k === "Enter") {
      e.preventDefault();
      commitEdit();
      nextCellDown();
      return;
    }
    if (k === "Tab") {
      e.preventDefault();
      commitEdit();
      nextCellRight();
      return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      const buf = mode.editBuffer;
      const idx = mode.editCursor;
      if (idx === 0) return;
      mode.editBuffer = buf.slice(0, idx - 1) + buf.slice(idx);
      mode.editCursor = idx - 1;
      render();
      return;
    }
    if (k === "Delete") {
      e.preventDefault();
      const buf = mode.editBuffer;
      const idx = mode.editCursor;
      if (idx >= buf.length) return;
      mode.editBuffer = buf.slice(0, idx) + buf.slice(idx + 1);
      render();
      return;
    }
    if (k === "ArrowLeft") { e.preventDefault(); mode.editCursor = Math.max(0, mode.editCursor - 1); render(); return; }
    if (k === "ArrowRight"){ e.preventDefault(); mode.editCursor = Math.min(mode.editBuffer.length, mode.editCursor + 1); render(); return; }
    if (k === "Home") { e.preventDefault(); mode.editCursor = 0; render(); return; }
    if (k === "End")  { e.preventDefault(); mode.editCursor = mode.editBuffer.length; render(); return; }
    if (isPrintable(k) && mode.editBuffer.length < 240) {
      e.preventDefault();
      const buf = mode.editBuffer;
      const idx = mode.editCursor;
      mode.editBuffer = buf.slice(0, idx) + k + buf.slice(idx);
      mode.editCursor = idx + 1;
      render();
      return;
    }
  }

  function handleMenuKey(e) {
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      mode.menuPath.pop();
      if (mode.menuPath.length === 0) {
        mode.name = "READY";
      }
      render();
      return;
    }
    if (k === "Enter") {
      e.preventDefault();
      // Activate first available child if menu shows multiple options
      const cur = currentMenuNode();
      if (cur && cur.children && cur.children.length) {
        const first = cur.children[0];
        activateMenuNode(first);
      } else if (cur && cur.action) {
        cur.action();
      }
      return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      // delete last typed character from prompt buffer
      const text = mode.menuPrompt;
      if (text.length === 0) {
        mode.menuPath.pop();
        if (mode.menuPath.length === 0) mode.name = "READY";
        render();
      } else {
        mode.menuPrompt = text.slice(0, -1);
        render();
      }
      return;
    }
    if (isPrintable(k) && mode.menuPrompt.length < 60) {
      e.preventDefault();
      mode.menuPrompt += k.toUpperCase();
      // Try to advance/finish
      tryAdvanceMenu(k.toUpperCase());
      render();
      return;
    }
  }

  function handlePointKey(e) {
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); cancelPoint(); return; }
    if (k === "Enter") {
      e.preventDefault();
      commitPoint();
      return;
    }
    if (k === "ArrowDown") { e.preventDefault(); movePoint(0, 1); return; }
    if (k === "ArrowUp")   { e.preventDefault(); movePoint(0, -1); return; }
    if (k === "ArrowLeft") { e.preventDefault(); movePoint(-1, 0); return; }
    if (k === "ArrowRight"){ e.preventDefault(); movePoint(1, 0); return; }
    if (k === "Tab") { e.preventDefault(); movePoint(1, 0); return; }
    // Type a coordinate letter/digit to jump point target
    if (/^[A-Z]$/i.test(k)) {
      e.preventDefault();
      mode.pointCoord = (mode.pointCoord || "") + k.toUpperCase();
      const m = mode.pointCoord.match(/([A-Z]+)(\d*)$/);
      if (!m) { mode.pointCoord = k.toUpperCase(); return; }
      const colLetters = m[1];
      const digits = m[2] || "";
      const c = colLetterToIndex(colLetters[0]);
      let r = digits ? parseInt(digits, 10) : mode.pointTarget.r;
      if (coordValid(c, r)) { mode.pointTarget = { c, r }; inRange = encodeRange(mode.anchor.c, mode.anchor.r, c, r); render(); }
      return;
    }
    if (/^[0-9]$/.test(k) && mode.pointCoord) {
      e.preventDefault();
      mode.pointCoord += k;
      const m = mode.pointCoord.match(/^([A-Z]+)(\d+)$/);
      if (m) {
        const c = colLetterToIndex(m[1]);
        const r = parseInt(m[2], 10);
        if (coordValid(c, r)) { mode.pointTarget = { c, r }; inRange = encodeRange(mode.anchor.c, mode.anchor.r, c, r); render(); }
      }
      return;
    }
  }

  function handleFillKey(e) {
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); mode.name = "READY"; render(); return; }
    if (k === "Enter") {
      e.preventDefault();
      const parts = promptBuffer.text.split(",").map(s => s.trim());
      if (parts.length < 2) { setError("Need start,step — e.g. 1,1"); return; }
      const start = parseFloat(parts[0]);
      const step = parseFloat(parts[1]);
      if (!isFinite(start) || !isFinite(step)) { setError("Numbers required"); return; }
      const range = encodeRange(mode.fill.c1, mode.fill.r1, mode.fill.c2, mode.fill.r2);
      let val = start;
      // Fill column-major by default
      for (let c = range.a.c; c <= range.b.c; c++) {
        for (let r = range.a.r; r <= range.b.r; r++) {
          const cell = cells.get(cellKey(c, r));
          if (cell && cell.type === "formula") continue;
          setCellNumber(c, r, val);
          val += step;
        }
      }
      mode.name = "READY";
      promptBuffer.text = "";
      render();
      return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      promptBuffer.text = promptBuffer.text.slice(0, -1);
      // Update indicator
      showFillPrompt();
      return;
    }
    if (isPrintable(k) && promptBuffer.text.length < 60) {
      e.preventDefault();
      promptBuffer.text += k;
      showFillPrompt();
      return;
    }
  }

  function showFillPrompt() {
    mode.name = "FILL";
    modeLabel.textContent = "FILL";
    cellContentsEl.innerHTML = `Enter Start, Step: <span style="opacity:0.85">${escapeHtml(promptBuffer.text)}</span>`;
  }

  function handleErrorKey(e) {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      mode.name = "READY";
      mode.errorMessage = "";
      render();
      return;
    }
  }

  function handleHelpKey(e) {
    e.preventDefault();
    mode.name = "READY";
    render();
  }

  function handleGraphKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      mode.name = "READY";
      chartOverlay.hidden = true;
      render();
    }
  }

  function handleDirKey(e) {
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); mode.name = "READY"; render(); return; }
    if (k === "ArrowDown") {
      e.preventDefault();
      mode.dirSheetCursor = Math.min(mode.dirSheetNames.length - 1, mode.dirSheetCursor + 1);
      render();
      return;
    }
    if (k === "ArrowUp") {
      e.preventDefault();
      mode.dirSheetCursor = Math.max(0, mode.dirSheetCursor - 1);
      render();
      return;
    }
    if (k === "Enter") {
      e.preventDefault();
      const name = mode.dirSheetNames[mode.dirSheetCursor];
      if (!name) { mode.name = "READY"; render(); return; }
      const data = localStorage.getItem("lotus.sheet." + name);
      if (!data) { setError("Sheet not found"); return; }
      try {
        const obj = JSON.parse(data);
        loadState(obj);
        sheetTitle = name;
        mode.name = "READY";
        render();
      } catch (_) { setError("Corrupt sheet"); }
      return;
    }
  }

  // =====================================================================
  // 16. EDIT BUFFER
  // =====================================================================

  function beginEdit(initial) {
    mode.name = "EDIT";
    let base;
    if (initial === undefined) {
      // F2 edit: keep existing content, cursor at end
      const cell = cells.get(cellKey(cur.c, cur.r));
      base = cell ? cell.raw : "";
    } else {
      // Lotus: first printable in READY clears the cell and starts a new edit
      base = initial;
    }
    mode.editBuffer = base;
    mode.editCursor = base.length;
    render();
  }

  function commitEdit() {
    const buf = mode.editBuffer;
    setCell(cur.c, cur.r, buf);
    mode.editBuffer = "";
    mode.editCursor = 0;
    mode.name = "READY";
  }

  // =====================================================================
  // 17. COORDINATE PROMPTING
  // =====================================================================

  function findLastUsed() {
    let maxc = 0, maxr = 1;
    for (const key of cells.keys()) {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      if (!m) continue;
      const c = colLetterToIndex(m[1]);
      const r = parseInt(m[2], 10);
      if (r > maxr || (r === maxr && c > maxc)) { maxr = r; maxc = c; }
    }
    return { c: maxc, r: maxr };
  }

  // =====================================================================
  // 18. SLASH MENU TREE
  // =====================================================================

  const SLASH_TOP = [
    {
      key: "W", label: "Worksheet",
      children: [
        { key: "C", label: "Cell", action: () => { mode.name = "READY"; render(); } },
        { key: "D", label: "Delete", children: [
          { key: "C", label: "Column", action: deleteColumnAt },
          { key: "R", label: "Row", action: deleteRowAt },
        ] },
        { key: "E", label: "Erase", children: [
          { key: "C", label: "Column", action: eraseColumnAt },
          { key: "R", label: "Row", action: eraseRowAt },
        ] },
        { key: "I", label: "Insert", children: [
          { key: "C", label: "Column", action: insertColumnAt },
          { key: "R", label: "Row", action: insertRowAt },
        ] },
        { key: "T", label: "Title", action: setTitlePrompt },
        { key: "W", label: "Window", action: () => setError("Window manager — single window") },
        { key: "C", label: "Column", children: [
          { key: "W", label: "Set-Width", action: setColumnWidthPrompt },
          { key: "R", label: "Reset-Width", action: resetColumnWidth },
        ] },
        { key: "R", label: "Rows", action: () => setError("No hidden rows in this clone") },
        { key: "G", label: "Global", children: [
          { key: "F", label: "Format", action: enterRangeFormatPrompt },
          { key: "L", label: "Label-Prefix", action: () => setError("Use ' \" ^ prefixes") },
        ] },
        { key: "Q", label: "Quit", action: () => { try { localStorage.setItem(STATE_KEY, JSON.stringify(serializeState())); mode.name = "READY"; render(); setIndicatorNote("Sheet saved"); } catch (_) {} } },
      ],
    },
    {
      key: "R", label: "Range",
      children: [
        { key: "F", label: "Format", children: [
          { key: "F", label: "Fixed", action: () => applyFormatPrompt("fix") },
          { key: "S", label: "Sci", action: () => applyFormatPrompt("sci") },
          { key: "C", label: "Currency", action: () => applyFormatPrompt("currency") },
          { key: "P", label: "Percent", action: () => applyFormatPrompt("percent") },
          { key: "+", label: "Plus", action: () => applyFormatPrompt("plusminus") },
          { key: "D", label: "Date", action: () => applyFormatPrompt("date") },
          { key: "G", label: "General", action: () => applyFormatPrompt("general") },
          { key: "T", label: "Text", action: () => applyFormatPrompt("txt") },
        ] },
        { key: "L", label: "Label", children: [
          { key: "L", label: "Left", action: () => applyAlignPrompt("left") },
          { key: "R", label: "Right", action: () => applyAlignPrompt("right") },
          { key: "C", label: "Center", action: () => applyAlignPrompt("center") },
        ] },
        { key: "J", label: "Justify", action: () => applyJustifyPrompt() },
        { key: "E", label: "Erase", children: [
          { key: "E", label: "Everything", action: applyErase("all") },
          { key: "F", label: "Formats", action: applyErase("formats") },
        ] },
        { key: "V", label: "Values", action: applyErase("values") },
        { key: "N", label: "Name", children: [
          { key: "C", label: "Create", action: nameCreatePrompt },
          { key: "D", label: "Delete", action: nameDeletePrompt },
          { key: "T", label: "Table", action: () => renderNamesTable() },
        ] },
      ],
    },
    {
      key: "F", label: "File",
      children: [
        { key: "R", label: "Retrieve", action: fileRetrievePrompt },
        { key: "S", label: "Save", action: fileSavePrompt },
        { key: "C", label: "Combine", action: () => setError("Combine not implemented — use a new sheet") },
        { key: "X", label: "Xtract", action: () => setError("Xtract not implemented in this clone") },
        { key: "E", label: "Erase", action: fileErasePrompt },
        { key: "L", label: "List", action: fileList },
        { key: "I", label: "Import", action: fileImport },
      ],
    },
    {
      key: "P", label: "Print",
      children: [
        { key: "P", label: "Printer", action: () => setError("No printer — use Ctrl+P in your actual browser") },
        { key: "F", label: "File", action: () => setError("No printer — use Ctrl+P in your actual browser") },
        { key: "O", label: "Options", action: () => setError("No printer — use Ctrl+P in your actual browser") },
        { key: "C", label: "Clear", action: () => setError("No printer — use Ctrl+P in your actual browser") },
        { key: "A", label: "Align", action: () => setError("No printer — use Ctrl+P in your actual browser") },
        { key: "G", label: "Go", action: () => setError("No printer — use Ctrl+P in your actual browser") },
      ],
    },
    {
      key: "G", label: "Graph",
      children: [
        { key: "T", label: "Type", children: [
          { key: "L", label: "Line", action: () => setGraphType("Line") },
          { key: "B", label: "Bar", action: () => setGraphType("Bar") },
          { key: "X", label: "Stacked", action: () => setGraphType("Stacked") },
          { key: "P", label: "Pie", action: () => setGraphType("Pie") },
        ] },
        { key: "V", label: "View", action: graphView },
        { key: "S", label: "Save", action: graphSave },
        { key: "R", label: "Reset", action: () => { mode.graphRanges = null; mode.graphSpec = null; setIndicatorNote("Graph reset"); render(); } },
        { key: "X", label: "X-axis", action: () => setError("Use X-axis auto labels") },
        { key: "O", label: "Options", action: () => setError("Use /G View to see the current graph") },
      ],
    },
    {
      key: "D", label: "Data",
      children: [
        { key: "F", label: "Fill", action: fillPrompt },
        { key: "S", label: "Sort", action: sortPrompt },
        { key: "Q", label: "Query", action: () => setError("Query not implemented") },
        { key: "M", label: "Matrix", action: () => setError("Matrix not implemented") },
        { key: "D", label: "Distribution", action: () => setError("Distribution not implemented") },
        { key: "A", label: "Analysis", action: () => setError("Analysis not implemented") },
      ],
    },
    {
      key: "N", label: "Name",
      children: [
        { key: "C", label: "Create", action: nameCreatePrompt },
        { key: "D", label: "Delete", action: nameDeletePrompt },
        { key: "T", label: "Table", action: () => renderNamesTable() },
        { key: "L", label: "List", action: () => {
          if (!names.size) { setError("No named ranges defined"); return; }
          mode.name = "MENU";
          mode.menuPath = [];
          mode.menuPrompt = "";
          render();
          // Render names in indicator
          const lines = [];
          for (const [n, r] of names.entries()) {
            lines.push(`${n.padEnd(10)}  ${cellKey(r.a.c, r.a.r)}..${cellKey(r.b.c, r.b.r)}`);
          }
          cellContentsEl.innerHTML = lines.map(l => escapeHtml(l)).join(" · ");
        } },
      ],
    },
  ];

  function findMenu(label) {
    for (const m of SLASH_TOP) if (m.label === label) return m;
    return null;
  }

  const MENU = {
    "/": { label: "", children: [
      findMenu("Worksheet"),
      findMenu("Range"),
      { key: "C", label: "Copy", action: copyAtCursor },
      { key: "M", label: "Move", action: moveAtCursor },
      findMenu("File"),
      findMenu("Print"),
      findMenu("Graph"),
      findMenu("Data"),
      findMenu("Name"),
      { key: "Q", label: "Quit", action: () => { localStorage.setItem(STATE_KEY, JSON.stringify(serializeState())); mode.name = "READY"; render(); setIndicatorNote("Sheet saved"); } },
    ] },
  };

  function openMenu(seed) {
    mode.name = "MENU";
    mode.menuPath = [MENU["/"]];
    mode.menuPrompt = "";
    render();
  }

  function currentMenuNode() {
    let node = MENU["/"];
    for (const p of mode.menuPath) {
      if (!p || !p.label) continue;  // root
      node = node.children.find(c => c.label === p.label);
      if (!node) break;
    }
    return node;
  }

  function tryAdvanceMenu(char) {
    const node = currentMenuNode();
    if (!node || !node.children) {
      // terminal node — try to match action key
      // (most leaves only activate when Enter pressed anyway)
      return;
    }
    // Find any child whose label starts with the typed uppercase char, or whose key equals
    const matches = node.children.filter(c =>
      (c.key && c.key.toUpperCase() === char) ||
      (c.label && c.label.toUpperCase().startsWith(char))
    );
    if (matches.length === 1) {
      const m = matches[0];
      mode.menuPrompt = "";
      if (m.children && m.children.length) {
        mode.menuPath.push(m);
      } else {
        // Run action
        mode.menuPath = []; mode.name = "READY"; mode.menuPrompt = "";
        // Run the action after leaving MENU so modes it opens (GRAPH, POINT, DIR...) stick.
        activateMenuNode(m);
      }
    }
  }

  function activateMenuNode(n) {
    if (!n) return;
    if (n.children && n.children.length) {
      mode.menuPath.push(n);
      return;
    }
    if (n.action) {
      try {
        n.action();
      } catch (e) {
        setError((e && e.message) || "Command failed");
      }
      if (mode.name !== "MENU" && mode.name !== "POINT" && mode.name !== "FILL" && mode.name !== "DIR") {
        render();
      }
    }
  }

  // =====================================================================
  // 19. COMMANDS — Copy / Move / Format / Save / Retrieve / Graph
  // =====================================================================

  function setIndicatorNote(text) {
    cellContentsEl.textContent = text;
  }

  function copyAtCursor() {
    pendingCommand = "copy";
    startPointFrom({ c: cur.c, r: cur.r });
    setIndicatorNote("Copy from " + cellKey(cur.c, cur.r) + " · extend range with arrows");
  }

  function moveAtCursor() {
    pendingCommand = "move";
    startPointFrom({ c: cur.c, r: cur.r });
    setIndicatorNote("Move from " + cellKey(cur.c, cur.r) + " · extend range with arrows");
  }

  function startPointFrom(origin) {
    mode.name = "POINT";
    mode.anchor = { c: origin.c, r: origin.r };
    mode.pointOrigin = { c: origin.c, r: origin.r };
    mode.pointTarget = { c: origin.c, r: origin.r };
    inRange = encodeRange(origin.c, origin.r, origin.c, origin.r);
    render();
  }

  function movePoint(dx, dy) {
    const target = mode.pointTarget;
    let nc = clamp(target.c + dx, 0, TOTAL_COLS - 1);
    let nr = clamp(target.r + dy, 1, TOTAL_ROWS);
    if (e.shiftKey) { nc = clamp(target.c + dx * 5, 0, TOTAL_COLS - 1); nr = clamp(target.r + dy * 5, 1, TOTAL_ROWS); }
    mode.pointTarget = { c: nc, r: nr };
    inRange = encodeRange(mode.anchor.c, mode.anchor.r, nc, nr);
    render();
  }

  function cancelPoint() {
    mode.name = "READY";
    inRange = null; anchorMarker = null;
    mode.pointCoord = "";
    pendingCommand = null;
    render();
  }

  // capture which command triggered the point mode
  let pendingCommand = null;

  function commitPoint() {
    const a = mode.anchor;
    const t = mode.pointTarget;
    if (!a || !t) { cancelPoint(); return; }

    // Fill command: source range picked; show prompt for value+step.
    if (pendingCommand === "fill") {
      const range = encodeRange(a.c, a.r, t.c, t.r);
      mode.name = "FILL";
      mode.fill = range;
      promptBuffer.text = "1,1";
      pendingCommand = null;
      showFillPrompt();
      return;
    }

    // Sort: source range picked; ask for key column.
    if (pendingCommand === "sort") {
      const range = encodeRange(a.c, a.r, t.c, t.r);
      const keyIdx = prompt("Sort by column index within range (1..N)", "1");
      if (keyIdx == null) { cancelPoint(); return; }
      const ki = parseInt(keyIdx, 10);
      if (!isFinite(ki) || ki < 1) { setError("Bad index"); cancelPoint(); return; }
      const dirAns = prompt("Descending? (y/N)", "N");
      const descending = /[Yy]/.test(dirAns || "");
      sortRange(range, ki - 1, descending);
      cancelPoint();
      render();
      return;
    }

    // Name: source range picked; ask for name.
    if (pendingCommand === "name") {
      const range = encodeRange(a.c, a.r, t.c, t.r);
      inRange = null;
      mode.name = "READY";
      const n = prompt("Range name (UPPERCASE recommended)", "");
      if (n) {
        names.set(n.toUpperCase(), range);
        setIndicatorNote(`Created name ${n.toUpperCase()} ${cellKey(range.a.c, range.a.r)}..${cellKey(range.b.c, range.b.r)}`);
      }
      pendingCommand = null;
      render();
      return;
    }

    // Graph: source range picked; show chart now.
    if (pendingCommand === "graph") {
      const range = encodeRange(a.c, a.r, t.c, t.r);
      mode.graphRanges = [range];
      pendingCommand = null;
      cancelPoint();
      graphView();
      return;
    }

    // Copy: source → destination
    if (pendingCommand === "copy") {
      mode.copySource = encodeRange(a.c, a.r, t.c, t.r);
      // Destination anchors one cell right of the target so the user can extend it
      startPointFrom({ c: t.c + 1, r: t.r });
      pendingCommand = "copy-dest";
      return;
    }
    if (pendingCommand === "copy-dest") {
      const src = mode.copySource;
      const dstRange = encodeRange(a.c, a.r, t.c, t.r);
      doCopy(src, dstRange);
      pendingCommand = null;
      cancelPoint();
      return;
    }

    // Move: source → destination
    if (pendingCommand === "move") {
      mode.moveSource = encodeRange(a.c, a.r, t.c, t.r);
      startPointFrom({ c: t.c + 1, r: t.r });
      pendingCommand = "move-dest";
      return;
    }
    if (pendingCommand === "move-dest") {
      const src = mode.moveSource;
      const dstRange = encodeRange(a.c, a.r, t.c, t.r);
      doMove(src, dstRange);
      pendingCommand = null;
      cancelPoint();
      return;
    }

    cancelPoint();
  }

  // Returns the raw text the user originally typed for a cell,
  // restoring label prefixes (' " ^ \) and formula prefixes (+ - = @).
  function getCellFullRaw(c, r) {
    const cell = cells.get(cellKey(c, r));
    if (!cell) return "";
    if (cell.type === "label") {
      const prefix = cell.align === "right" ? '"' : cell.align === "center" ? "^" : cell.align === "fill" ? "\\" : "'";
      return prefix + cell.raw;
    }
    if (cell.type === "number") return String(cell.value);
    if (cell.type === "formula") return cell.raw;
    return "";
  }

  function doCopy(src, dst) {
    const sh = src.b.r - src.a.r + 1;
    const sw = src.b.c - src.a.c + 1;
    for (let dr = 0; dr < sh; dr++) {
      for (let dc = 0; dc < sw; dc++) {
        const sc = src.a.c + dc, sr = src.a.r + dr;
        const dcC = dst.a.c + dc, dcR = dst.a.r + dr;
        const fullRaw = getCellFullRaw(sc, sr);
        if (!fullRaw) continue;
        setCell(dcC, dcR, fullRaw);
        // Copy the per-cell format if present
        const fmtKey = cellKey(sc, sr);
        if (formats.has(fmtKey)) formats.set(cellKey(dcC, dcR), formats.get(fmtKey));
      }
    }
    render();
    setIndicatorNote(`Copied ${sw}×${sh} to ${cellKey(dst.a.c, dst.a.r)}..${cellKey(dst.b.c, dst.b.r)}`);
  }
  function doMove(src, dst) {
    doCopy(src, dst);
    for (let r = src.a.r; r <= src.b.r; r++) {
      for (let c = src.a.c; c <= src.b.c; c++) {
        cells.delete(cellKey(c, r));
        computed.delete(cellKey(c, r));
        formats.delete(cellKey(c, r));
      }
    }
    recalcAll();
    render();
    setIndicatorNote(`Moved ${src.b.c - src.a.c + 1}×${src.b.r - src.a.r + 1} to ${cellKey(dst.a.c, dst.a.r)}..${cellKey(dst.b.c, dst.b.r)}`);
  }

  // INSERT / DELETE row/column helpers
  function insertRowAt() {
    const insertAt = cur.r;
    // Shift rows insertAt..TOTAL_ROWS up by 1 (down); clamp
    const old = new Map(cells);
    const oldFormats = new Map(formats);
    cells.clear(); formats.clear();
    for (const [key, cell] of old.entries()) {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      if (!m) continue;
      const c = colLetterToIndex(m[1]); let r = parseInt(m[2], 10);
      if (r >= insertAt) r += 1;
      if (r > TOTAL_ROWS) continue;
      if (cell.type === "label") setCellLabel(c, r, cell.raw, cell.align);
      else if (cell.type === "number") setCellNumber(c, r, cell.value);
      else setCell(c, r, (cell.raw[0] === "+" || cell.raw[0] === "-") ? "+" + cell.raw : cell.raw);
      if (oldFormats.has(key)) formats.set(cellKey(c, r), oldFormats.get(key));
    }
    recalcAll();
    render();
    setIndicatorNote("Inserted row " + insertAt);
  }
  function deleteRowAt() {
    const deleteAt = cur.r;
    const old = new Map(cells);
    const oldFormats = new Map(formats);
    cells.clear(); formats.clear();
    for (const [key, cell] of old.entries()) {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      if (!m) continue;
      const c = colLetterToIndex(m[1]); let r = parseInt(m[2], 10);
      if (r === deleteAt) continue;
      if (r > deleteAt) r -= 1;
      if (cell.type === "label") setCellLabel(c, r, cell.raw, cell.align);
      else if (cell.type === "number") setCellNumber(c, r, cell.value);
      else setCell(c, r, (cell.raw[0] === "+" || cell.raw[0] === "-") ? "+" + cell.raw : cell.raw);
      if (oldFormats.has(key)) formats.set(cellKey(c, r), oldFormats.get(key));
    }
    recalcAll();
    render();
    setIndicatorNote("Deleted row " + deleteAt);
  }
  function insertColumnAt() {
    const insertAt = cur.c;
    const old = new Map(cells);
    const oldFormats = new Map(formats);
    cells.clear(); formats.clear();
    for (const [key, cell] of old.entries()) {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      if (!m) continue;
      let c = colLetterToIndex(m[1]); const r = parseInt(m[2], 10);
      if (c >= insertAt) c += 1;
      if (c >= TOTAL_COLS) continue;
      if (cell.type === "label") setCellLabel(c, r, cell.raw, cell.align);
      else if (cell.type === "number") setCellNumber(c, r, cell.value);
      else setCell(c, r, (cell.raw[0] === "+" || cell.raw[0] === "-") ? "+" + cell.raw : cell.raw);
      if (oldFormats.has(key)) formats.set(cellKey(c, r), oldFormats.get(key));
    }
    recalcAll();
    render();
    setIndicatorNote("Inserted column " + colIndexToLetter(insertAt));
  }
  function deleteColumnAt() {
    const deleteAt = cur.c;
    const old = new Map(cells);
    const oldFormats = new Map(formats);
    cells.clear(); formats.clear();
    for (const [key, cell] of old.entries()) {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      if (!m) continue;
      let c = colLetterToIndex(m[1]); const r = parseInt(m[2], 10);
      if (c === deleteAt) continue;
      if (c > deleteAt) c -= 1;
      if (cell.type === "label") setCellLabel(c, r, cell.raw, cell.align);
      else if (cell.type === "number") setCellNumber(c, r, cell.value);
      else setCell(c, r, (cell.raw[0] === "+" || cell.raw[0] === "-") ? "+" + cell.raw : cell.raw);
      if (oldFormats.has(key)) formats.set(cellKey(c, r), oldFormats.get(key));
    }
    recalcAll();
    render();
    setIndicatorNote("Deleted column " + colIndexToLetter(deleteAt));
  }
  function eraseRowAt() {
    for (let c = 0; c < TOTAL_COLS; c++) {
      cells.delete(cellKey(c, cur.r));
      computed.delete(cellKey(c, cur.r));
      formats.delete(cellKey(c, cur.r));
    }
    render();
    setIndicatorNote("Erased row " + cur.r);
  }
  function eraseColumnAt() {
    for (let r = 1; r <= TOTAL_ROWS; r++) {
      cells.delete(cellKey(cur.c, r));
      computed.delete(cellKey(cur.c, r));
      formats.delete(cellKey(cur.c, r));
    }
    render();
    setIndicatorNote("Erased column " + colIndexToLetter(cur.c));
  }

  // ---- Column width ----
  function setColumnWidthPrompt() {
    const w = prompt("Set column width (1-78)", String(colWidths[cur.c]));
    if (w == null) return;
    const n = parseInt(w, 10);
    if (!isFinite(n) || n < 1 || n > 78) { setError("Width must be 1..78"); return; }
    colWidths[cur.c] = n;
    render();
    setIndicatorNote(`Column ${colIndexToLetter(cur.c)} width = ${n}`);
  }
  function resetColumnWidth() {
    for (let i = 0; i < TOTAL_COLS; i++) colWidths[i] = DEFAULT_COL_WIDTH;
    render();
    setIndicatorNote("All column widths reset to 9");
  }
  function setTitlePrompt() {
    const t = prompt("Sheet title", sheetTitle);
    if (t != null) { sheetTitle = t; render(); }
  }

  // ---- Range Format ----
  // Lotus: /RFF prompts for a format spec; we use a simpler chooser mapped
  // onto the classic 8-format palette.
  function enterRangeFormatPrompt() {
    openMenu("/");
    const rangeNode = SLASH_TOP.find(s => s.label === "Range");
    const formatNode = rangeNode.children.find(c => c.label === "Format");
    mode.menuPath = [MENU["/"], rangeNode, formatNode];
    mode.menuPrompt = "";
    mode.name = "MENU";
    render();
  }

  function applyFormatPrompt(formatKey) {
    const key = cellKey(cur.c, cur.r);
    if (formatKey === "general") {
      formats.set(key, "general");
      render();
      setIndicatorNote(`Format reset on ${key}`);
      return;
    }
    if (formatKey === "txt") {
      formats.set(key, "txt");
      render();
      setIndicatorNote(`Text format on ${key}`);
      return;
    }
    // Numeric formats: apply directly.
    formats.set(key, formatKey);
    render();
    setIndicatorNote(`Format ${formatKey} applied to ${key}`);
  }

  function applyAlignPrompt(align) {
    const key = cellKey(cur.c, cur.r);
    const cell = cells.get(key);
    if (!cell || cell.type !== "label") { setError("Alignment only applies to labels"); return; }
    cell.align = align;
    render();
  }
  function applyJustifyPrompt() {
    const cell = cells.get(cellKey(cur.c, cur.r));
    if (!cell || cell.type !== "label") return;
    cell.align = "fill";
    render();
  }
  function applyErase(what) {
    const key = cellKey(cur.c, cur.r);
    if (what === "all") {
      cells.delete(key);
      formats.delete(key);
      computed.delete(key);
    } else if (what === "formats") {
      formats.delete(key);
    } else if (what === "values") {
      // Convert formula to its computed value
      const v = computed.get(key);
      if (v && v.kind === "number") setCellNumber(cur.c, cur.r, v.value);
    }
    render();
  }

  // ---- File ----
  function fileList() {
    mode.name = "DIR";
    const names = Object.keys(localStorage).filter(k => k.startsWith("lotus.sheet."))
      .map(k => k.slice("lotus.sheet.".length))
      .sort();
    mode.dirSheetNames = names;
    mode.dirSheetCursor = 0;
    render();
  }

  function fileSavePrompt() {
    const defaultName = sheetTitle || "untitled";
    const t = prompt("Save sheet as:", defaultName);
    if (t == null) return;
    sheetTitle = t;
    try {
      localStorage.setItem("lotus.sheet." + t, JSON.stringify(serializeState()));
      localStorage.setItem(DEMO_KEY, JSON.stringify(t));
      setIndicatorNote(`Saved as "${t}"`);
      render();
    } catch (e) {
      setError("Save failed: " + e.message);
    }
  }
  function fileRetrievePrompt() {
    fileList();
  }
  function fileErasePrompt() {
    const t = prompt("Erase which saved sheet?", "");
    if (!t) return;
    localStorage.removeItem("lotus.sheet." + t);
    setIndicatorNote(`Erased "${t}"`);
  }
  function fileImport() {
    loadFromFile();
    setIndicatorNote("Imported JSON file");
  }

  // ---- Data ----
  function fillPrompt() {
    if (mode.name !== "READY") return;
    // Anchor source range = current cell
    mode.name = "POINT";
    mode.anchor = { c: cur.c, r: cur.r };
    mode.pointTarget = { c: cur.c, r: cur.r };
    inRange = encodeRange(mode.anchor.c, mode.anchor.r, mode.anchor.c, mode.anchor.r);
    pendingCommand = "fill";
    render();
  }
  function sortPrompt() {
    if (mode.name !== "READY") return;
    // Anchor sort range = current cell down to data extent; let user point second.
    mode.name = "POINT";
    mode.anchor = { c: cur.c, r: cur.r };
    mode.pointTarget = { c: cur.c, r: cur.r };
    inRange = encodeRange(mode.anchor.c, mode.anchor.r, mode.anchor.c, mode.anchor.r);
    pendingCommand = "sort";
    render();
  }

  function sortRange(range, keyColOffset, descending) {
    const { a, b } = range;
    const width = b.c - a.c + 1;
    const height = b.r - a.r + 1;
    // Read all rows of cells
    const rows = [];
    for (let r = a.r; r <= b.r; r++) {
      const row = [];
      for (let c = a.c; c <= b.c; c++) {
        const cell = cells.get(cellKey(c, r));
        row.push(cell ? { ...cell, _c: c, _r: r } : null);
      }
      rows.push(row);
    }
    // Sort by key column
    const key = (row) => {
      const cell = row[keyColOffset];
      if (!cell) return null;
      if (cell.type === "number") return cell.value;
      if (cell.type === "label") return cell.raw.toLowerCase();
      const v = computed.get(cellKey(row._c, row._r));
      return v ? v.value : null;
    };
    rows.sort((x, y) => {
      const kx = key(x), ky = key(y);
      if (kx == null && ky == null) return 0;
      if (kx == null) return 1;
      if (ky == null) return -1;
      if (typeof kx === "number" && typeof ky === "number") return descending ? ky - kx : kx - ky;
      return descending ? String(ky).localeCompare(String(kx)) : String(kx).localeCompare(String(ky));
    });
    // Clear range
    for (let r = a.r; r <= b.r; r++) {
      for (let c = a.c; c <= b.c; c++) {
        cells.delete(cellKey(c, r));
        computed.delete(cellKey(c, r));
        formats.delete(cellKey(c, r));
      }
    }
    // Write back
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (!cell) continue;
        const cc = a.c + j;
        const rr = a.r + i;
        if (cell.type === "label") setCellLabel(cc, rr, cell.raw, cell.align);
        else if (cell.type === "number") setCellNumber(cc, rr, cell.value);
        else setCell(cc, rr, "+" + cell.raw);
        // Preserve format from old cell:
        const oldKey = cellKey(cell._c, cell._r);
        if (formats.has(oldKey)) formats.set(cellKey(cc, rr), formats.get(oldKey));
      }
    }
    recalcAll();
    render();
    setIndicatorNote(`Sorted ${height} rows`);
  }

  // ---- Graph ----
  function setGraphType(t) {
    mode.graphType = t;
    setIndicatorNote(`Graph type = ${t}`);
  }
  function graphSave() {
    if (!mode.graphRanges) {
      // Save current graph with current type
      mode.graphRanges = [encodeRange(0, 1, TOTAL_COLS - 1, TOTAL_ROWS)];
    }
    setIndicatorNote("Graph saved (set)");
  }
  function graphView() {
    if (!mode.graphRanges || !mode.graphRanges.length) {
      // Default to data extent around cursor
      const last = findLastUsed();
      mode.graphRanges = [encodeRange(0, 1, last.c, last.r)];
    }
    mode.name = "GRAPH";
    chartOverlay.hidden = false;
    renderChart();
  }
  function renderChart() {
    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.width = chartCanvas.clientWidth || 640;
    const h = chartCanvas.height = chartCanvas.clientHeight || 320;
    ctx.clearRect(0, 0, w, h);
    const data = collectGraphData();
    if (!data.series.length) {
      ctx.fillStyle = "currentColor";
      ctx.font = '14px "IBM Plex Mono", monospace';
      ctx.fillText("NO DATA", 20, 30);
      chartTitle.textContent = "Graph";
      return;
    }
    chartTitle.textContent = `Graph — ${mode.graphType}`;
    drawChart(ctx, w, h, data);
  }
  function collectGraphData() {
    if (!mode.graphRanges || !mode.graphRanges[0]) return { labels: [], series: [] };
    const range = mode.graphRanges[0];
    const { a, b } = range;
    const labels = [];
    const values = [];
    for (let r = a.r; r <= b.r; r++) {
      // Label = first column cell value (label preferred)
      const labelCell = cells.get(cellKey(a.c, r));
      const labelV = computed.get(cellKey(a.c, r));
      labels.push(labelV && labelV.kind === "string" ? labelV.value : `Row ${r}`);
      // Use column a.c+1 as value (or a.c if single column)
      const valCell = b.c > a.c ? cells.get(cellKey(b.c, r)) : labelCell;
      const valV = b.c > a.c ? computed.get(cellKey(b.c, r)) : labelV;
      values.push(valV && valV.kind === "number" ? valV.value : null);
    }
    return { labels, series: [{ name: "Series 1", values }] };
  }
  function drawChart(ctx, w, h, data) {
    const padL = 40, padR = 10, padT = 18, padB = 30;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const xs = data.series[0].values;
    const labels = data.labels;
    const validXs = xs.filter(x => typeof x === "number" && isFinite(x));
    const minV = Math.min(...validXs, 0);
    const maxV = Math.max(...validXs, 1);
    const range = (maxV - minV) || 1;

    // Phosphor color
    const color = getComputedStyle(screen).color || "#ffb000";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.font = '11px "IBM Plex Mono", monospace';

    // Axes
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + innerH);
    ctx.lineTo(padL + innerW, padT + innerH);
    ctx.stroke();

    // Y-axis ticks
    for (let i = 0; i <= 4; i++) {
      const v = minV + (range * i) / 4;
      const y = padT + innerH - (innerH * i) / 4;
      ctx.fillText(v.toFixed(0), 4, y + 4);
      ctx.beginPath();
      ctx.moveTo(padL - 2, y);
      ctx.lineTo(padL, y);
      ctx.stroke();
    }

    if (mode.graphType === "Pie") {
      // Draw pie chart
      const cx = padL + innerW / 2;
      const cy = padT + innerH / 2;
      const r = Math.min(innerW, innerH) * 0.45;
      let start = -Math.PI / 2;
      let total = validXs.reduce((a, b) => a + Math.abs(b), 0) || 1;
      validXs.forEach((v, i) => {
        const angle = (Math.abs(v) / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        // Slash pattern fill for separation
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start + angle, start + angle);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        start += angle;
      });
      // Labels around the pie
      let angle2 = -Math.PI / 2;
      validXs.forEach((v, i) => {
        const ang = (Math.abs(v) / total) * Math.PI * 2;
        const tx = cx + Math.cos(angle2 + ang / 2) * (r * 0.55);
        const ty = cy + Math.sin(angle2 + ang / 2) * (r * 0.55);
        ctx.fillStyle = "#000";
        ctx.fillRect(tx - 18, ty - 6, 36, 12);
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText((labels[i] || "").slice(0, 6), tx, ty + 4);
        ctx.textAlign = "left";
        angle2 += ang;
      });
      return;
    }

    if (mode.graphType === "Bar" || mode.graphType === "Stacked") {
      const barWidth = innerW / Math.max(xs.length, 1) * 0.7;
      const gap = innerW / Math.max(xs.length, 1) * 0.3;
      xs.forEach((v, i) => {
        if (typeof v !== "number") return;
        const x = padL + i * (barWidth + gap) + gap / 2;
        const y = padT + innerH - innerH * (v - minV) / range;
        const bh = padT + innerH - y;
        ctx.fillRect(x, y, barWidth, bh);
        // Crosshatch for clarity
        ctx.beginPath();
        for (let k = 0; k < bh; k += 4) {
          ctx.moveTo(x, y + k);
          ctx.lineTo(x + barWidth, y + k);
        }
        ctx.stroke();
        // Label
        ctx.fillText((labels[i] || "").slice(0, 6), x, padT + innerH + 14);
      });
      return;
    }

    // Line graph (default)
    ctx.beginPath();
    let prevX = null;
    xs.forEach((v, i) => {
      if (typeof v !== "number" || !isFinite(v)) return;
      const x = padL + (i / Math.max(xs.length - 1, 1)) * innerW;
      const y = padT + innerH - innerH * (v - minV) / range;
      if (prevX == null) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prevX = x;
    });
    ctx.stroke();
    xs.forEach((v, i) => {
      if (typeof v !== "number" || !isFinite(v)) return;
      const x = padL + (i / Math.max(xs.length - 1, 1)) * innerW;
      const y = padT + innerH - innerH * (v - minV) / range;
      ctx.fillRect(x - 1, y - 1, 3, 3);
    });
    labels.forEach((l, i) => {
      const x = padL + (i / Math.max(labels.length - 1, 1)) * innerW;
      ctx.fillText((l || "").slice(0, 6), x - 6, padT + innerH + 14);
    });
  }

  // ---- Name ----
  function nameCreatePrompt() {
    if (mode.name !== "READY") return;
    // Lotus prompts for range first, then name.
    mode.name = "POINT";
    mode.anchor = { c: cur.c, r: cur.r };
    mode.pointTarget = { c: cur.c, r: cur.r };
    inRange = encodeRange(mode.anchor.c, mode.anchor.r, mode.anchor.c, mode.anchor.r);
    pendingCommand = "name";
    render();
  }
  function nameDeletePrompt() {
    const n = prompt("Delete which name?", "");
    if (!n) return;
    if (names.delete(n.toUpperCase())) {
      setIndicatorNote(`Deleted name ${n.toUpperCase()}`);
      render();
    } else {
      setError(`No such name: ${n}`);
    }
  }
  function gotoName(name) {
    const r = names.get(name.toUpperCase());
    if (!r) { setError(`No such name: ${name}`); return; }
    cur.c = r.a.c;
    cur.r = r.a.r;
    setIndicatorNote(`Jumped to ${name} ${cellKey(r.a.c, r.a.r)}..${cellKey(r.b.c, r.b.r)}`);
    render();
  }
  function renderNamesTable() {
    if (!names.size) { setError("No named ranges defined"); return; }
    const lines = [];
    for (const [n, r] of names.entries()) {
      lines.push(`${n.padEnd(10)}  ${cellKey(r.a.c, r.a.r)}..${cellKey(r.b.c, r.b.r)}`);
    }
    setIndicatorNote(lines.join("   "));
  }

  // ---- Help ----
  function enterHelp() {
    mode.name = "HELP";
    const lines = [
      "Arrows move.  / opens menu.  F2 edit.  F5 Goto (Name).  F7 Format.",
      "/W Worksheet  /R Range  /C Copy  /M Move  /F File  /G Graph  /D Data  /N Name",
      "Cell prefixes:  ' \" ^ \\  label,  + - = @  formula,  number",
      "Functions: SUM AVG MIN MAX COUNT IF INT ROUND MOD ABS SQRT LN LOG EXP PI",
      "           SIN COS TAN ASIN ACOS ATAN ATAN2 RAND",
      "           LEN MID LEFT RIGHT UPPER LOWER VALUE STRING REPT CHAR FIXED",
      "           NOW TODAY DATE MONTH DAY YEAR HOUR MINUTE SECOND",
      "           IF AND OR NOT ISERR ISNA ISNUMBER ISSTRING",
      "           CHOOSE INDEX VLOOKUP HLOOKUP",
      "Mod tip: 'C5..E12' range; /C copies.  /DS sort.  /WCS column width.",
    ];
    mode.helpTopic = lines;
    cellContentsEl.innerHTML = lines.map(l => escapeHtml(l)).join("<br>");
    render();
  }

  // =====================================================================
  // 20. SOFT-KEYS — mobile fallback
  // =====================================================================

  function renderSoftKeys() {
    const defs = [
      { label: "/", call: () => openMenu("/") },
      { label: "Edit", call: () => beginEdit(getCellRaw(cur.c, cur.r)) },
      { label: "←", call: () => nextCellLeft() },
      { label: "→", call: () => nextCellRight() },
      { label: "↑", call: () => nextCellUp() },
      { label: "↓", call: () => nextCellDown() },
      { label: "Help", call: () => enterHelp() },
      { label: "Format", call: () => enterRangeFormatPrompt() },
      { label: "File", call: () => { openMenu("/"); mode.menuPath.push(SLASH_TOP.find(s => s.label === "File")); mode.menuPrompt = ""; render(); } },
      { label: "Sort", call: () => sortPrompt() },
    ];
    softkeys.innerHTML = "";
    for (const d of defs) {
      const b = document.createElement("button");
      b.className = "softkey";
      b.textContent = d.label;
      b.onclick = d.call;
      softkeys.appendChild(b);
    }
  }

  // =====================================================================
  // 21. DEMO — built-in sheets
  // =====================================================================

  function loadDemo(name) {
    if (DEMOS[name]) {
      loadState(DEMOS[name]());
      sheetTitle = name;
      cur = { c: 0, r: 1 };
      render();
    }
  }

  // Returns a snapshot of a built-in sheet
  function makeBudget() {
    return {
      version: SCHEMA_VERSION,
      title: "Household Budget",
      colWidths: colWidths.slice(),
      cells: [
        // Header row
        { c: 0, r: 1, type: "label", raw: "CATEGORY", align: "left" },
        { c: 1, r: 1, type: "label", raw: "JAN", align: "right" },
        { c: 2, r: 1, type: "label", raw: "FEB", align: "right" },
        { c: 3, r: 1, type: "label", raw: "MAR", align: "right" },
        { c: 4, r: 1, type: "label", raw: "Q1", align: "right" },

        { c: 0, r: 2, type: "label", raw: "Rent", align: "left" },
        { c: 1, r: 2, type: "number", value: 1200 },
        { c: 2, r: 2, type: "number", value: 1200 },
        { c: 3, r: 2, type: "number", value: 1200 },
        { c: 4, r: 2, type: "formula", raw: "@SUM(B2..D2)" },

        { c: 0, r: 3, type: "label", raw: "Food", align: "left" },
        { c: 1, r: 3, type: "number", value: 320 },
        { c: 2, r: 3, type: "number", value: 290 },
        { c: 3, r: 3, type: "number", value: 305 },
        { c: 4, r: 3, type: "formula", raw: "@SUM(B3..D3)" },

        { c: 0, r: 4, type: "label", raw: "Utilities", align: "left" },
        { c: 1, r: 4, type: "number", value: 145 },
        { c: 2, r: 4, type: "number", value: 130 },
        { c: 3, r: 4, type: "number", value: 165 },
        { c: 4, r: 4, type: "formula", raw: "@SUM(B4..D4)" },

        { c: 0, r: 5, type: "label", raw: "Transport", align: "left" },
        { c: 1, r: 5, type: "number", value: 90 },
        { c: 2, r: 5, type: "number", value: 95 },
        { c: 3, r: 5, type: "number", value: 110 },
        { c: 4, r: 5, type: "formula", raw: "@SUM(B5..D5)" },

        { c: 0, r: 6, type: "label", raw: "Entertainment", align: "left" },
        { c: 1, r: 6, type: "number", value: 60 },
        { c: 2, r: 6, type: "number", value: 45 },
        { c: 3, r: 6, type: "number", value: 30 },
        { c: 4, r: 6, type: "formula", raw: "@SUM(B6..D6)" },

        { c: 0, r: 7, type: "label", raw: "TOTALS", align: "left" },
        { c: 1, r: 7, type: "formula", raw: "@SUM(B2..B6)", format: "currency" },
        { c: 2, r: 7, type: "formula", raw: "@SUM(C2..C6)", format: "currency" },
        { c: 3, r: 7, type: "formula", raw: "@SUM(D2..D6)", format: "currency" },
        { c: 4, r: 7, type: "formula", raw: "@SUM(E2..E6)", format: "currency" },

        { c: 0, r: 9, type: "label", raw: "AVG MONTH", align: "left" },
        { c: 4, r: 9, type: "formula", raw: "@AVG(B7..D7)", format: "currency" },
        { c: 0, r: 10, type: "label", raw: "Q1 GRAND TOTAL", align: "left" },
        { c: 4, r: 10, type: "formula", raw: "+E7", format: "currency" },
      ].map(c => Object.assign({ format: c.format || null }, c)),
      names: [],
    };
  }
  function makeTrig() {
    const cells = [];
    cells.push({ c: 0, r: 1, type: "label", raw: "DEGREES", align: "left" });
    cells.push({ c: 1, r: 1, type: "label", raw: "RADIANS", align: "right" });
    cells.push({ c: 2, r: 1, type: "label", raw: "SIN", align: "right" });
    cells.push({ c: 3, r: 1, type: "label", raw: "COS", align: "right" });
    cells.push({ c: 4, r: 1, type: "label", raw: "TAN", align: "right" });
    for (let i = 0; i < 12; i++) {
      const deg = i * 15;
      const r = i + 2;
      cells.push({ c: 0, r, type: "number", value: deg });
      cells.push({ c: 1, r, type: "formula", raw: `A${r}*@PI()/180`, format: "fix-4" });
      cells.push({ c: 2, r, type: "formula", raw: `@SIN(B${r})`, format: "fix-4" });
      cells.push({ c: 3, r, type: "formula", raw: `@COS(B${r})`, format: "fix-4" });
      cells.push({ c: 4, r, type: "formula", raw: `@TAN(B${r})`, format: "fix-4" });
    }
    return { version: SCHEMA_VERSION, title: "Trig Table", colWidths: colWidths.slice(), cells, names: [] };
  }
  function makeInventory() {
    const cells = [];
    cells.push({ c: 0, r: 1, type: "label", raw: "ITEM", align: "left" });
    cells.push({ c: 1, r: 1, type: "label", raw: "QTY", align: "right" });
    cells.push({ c: 2, r: 1, type: "label", raw: "PRICE", align: "right" });
    cells.push({ c: 3, r: 1, type: "label", raw: "VALUE", align: "right" });
    const items = [
      ["Apples", 14, 0.85],
      ["Bread", 4, 3.50],
      ["Cheese", 6, 5.25],
      ["Coffee", 1, 12.0],
      ["Pasta", 9, 1.50],
      ["Soap", 7, 2.75],
      ["Tea", 5, 4.20],
      ["Wine", 2, 18.0],
    ];
    items.forEach((it, i) => {
      const r = i + 2;
      cells.push({ c: 0, r, type: "label", raw: it[0], align: "left" });
      cells.push({ c: 1, r, type: "number", value: it[1] });
      cells.push({ c: 2, r, type: "number", value: it[2], format: "currency" });
      cells.push({ c: 3, r, type: "formula", raw: `+B${r}*C${r}`, format: "currency" });
    });
    cells.push({ c: 0, r: items.length + 2, type: "label", raw: "TOTAL", align: "left" });
    cells.push({ c: 1, r: items.length + 2, type: "formula", raw: `@SUM(B2..B${items.length + 1})` });
    cells.push({ c: 3, r: items.length + 2, type: "formula", raw: `@SUM(D2..D${items.length + 1})`, format: "currency" });
    return { version: SCHEMA_VERSION, title: "Grocery Inventory", colWidths: colWidths.slice(), cells, names: [] };
  }

  const DEMOS = {
    "Household Budget": makeBudget,
    "Trig Table": makeTrig,
    "Grocery Inventory": makeInventory,
  };

  // =====================================================================
  // 22. INPUT — coord buffer initialization, hook up listeners
  // =====================================================================
  mode.coordBuffer = "";
  mode.coordStage = "letters";

  document.addEventListener("keydown", onKeyDown);
  screen.addEventListener("click", () => {
    cur = { c: 1, r: 1 };
    render();
  });

  // =====================================================================
  // 23. BOOT
  // =====================================================================

  function boot() {
    // Settings
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (s && s.phosphor) {
        settings.phosphor = s.phosphor;
        document.body.dataset.phosphor = settings.phosphor;
      }
    } catch (_) {}

    let loaded = false;
    try {
      const data = localStorage.getItem(STATE_KEY);
      if (data) {
        const obj = JSON.parse(data);
        if (loadState(obj)) loaded = true;
      }
    } catch (_) {}

    if (!loaded) {
      loadDemo("Household Budget");
    }

    trace("demo loaded cells=" + cells.size);
    renderSoftKeys();
    render();
    trace("render called");
  }

  // Surface boot errors visibly while developing
  window.addEventListener("error", (e) => {
    const div = document.createElement("pre");
    div.style.cssText = "position:fixed;top:0;left:0;right:0;background:#400;color:#fdd;padding:8px;font:11px monospace;z-index:9999;white-space:pre-wrap;";
    div.textContent = "JS ERROR: " + (e?.error?.stack || e?.message || e);
    document.body.appendChild(div);
  });

  // Diagnostic tracing: report boot/render status
  window.__lotusTrace = window.__lotusTrace || [];
  function trace(msg) {
    window.__lotusTrace.push(msg);
    if (window.__lotusTrace.length > 200) window.__lotusTrace.shift();
  }
  window.__lotusDebug = { cells, computed, formats, names, DEMOS };
  const _render = render;
  const _setCellLabel = setCellLabel;
  setCellLabel = function(c, r, text, align) {
    try {
      trace("setCellLabel " + c + "," + r + " before:" + cells.size);
      _setCellLabel(c, r, text, align);
      trace("setCellLabel done size=" + cells.size);
    } catch (e) {
      trace("setCellLabel FAIL " + (e?.stack || e));
      throw e;
    }
  };
  render = function() {
    try {
      _render();
      trace("render ok cells=" + cells.size);
    } catch (e) {
      trace("render FAIL " + (e?.stack || e));
      throw e;
    }
  };
  trace("boot begin");

  boot();
})();
