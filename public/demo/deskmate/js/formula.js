// Tiny worksheet language: + - * /, parentheses, cell refs, and SUM.
// No eval. Cycles and junk become ERR.

const COL = /^[A-L]$/;

function expand(a, b) {
  const ca = a.charCodeAt(0) - 65;
  const ra = Number(a.slice(1));
  const cb = b.charCodeAt(0) - 65;
  const rb = Number(b.slice(1));
  const width = Math.abs(cb - ca) + 1;
  const height = Math.abs(rb - ra) + 1;
  if (width * height > 400) throw new Error('big');
  const cells = [];
  for (let r = Math.min(ra, rb); r <= Math.max(ra, rb); r += 1) {
    for (let c = Math.min(ca, cb); c <= Math.max(ca, cb); c += 1) {
      cells.push(String.fromCharCode(65 + c) + r);
    }
  }
  return cells;
}

function valueOf(addr, cells, stack) {
  const raw = cells[addr];
  if (raw == null || String(raw).trim() === '') return 0;
  const text = String(raw).trim();
  if (text.startsWith('=')) {
    if (stack.has(addr)) throw new Error('cycle');
    stack.add(addr);
    try {
      const value = evaluate(text.slice(1), cells, stack);
      if (value && typeof value === 'object' && value.error) throw new Error('err');
      return value;
    } finally {
      stack.delete(addr);
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function num(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('nan');
    return value;
  }
  if (value == null || value === '') return 0;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  throw new Error('nan');
}

function summand(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return 0;
}

class Parser {
  constructor(source, cells, stack) {
    this.s = String(source || '');
    this.i = 0;
    this.cells = cells;
    this.stack = stack;
  }

  skip() {
    while (this.s[this.i] === ' ' || this.s[this.i] === '\t') this.i += 1;
  }

  peek() {
    this.skip();
    return this.s[this.i] || '';
  }

  parseExpr() {
    let value = this.parseTerm();
    for (;;) {
      const op = this.peek();
      if (op !== '+' && op !== '-') break;
      this.i += 1;
      const right = this.parseTerm();
      value = op === '+' ? num(value) + num(right) : num(value) - num(right);
    }
    return value;
  }

  parseTerm() {
    let value = this.parseFactor();
    for (;;) {
      const op = this.peek();
      if (op !== '*' && op !== '/') break;
      this.i += 1;
      const right = this.parseFactor();
      if (op === '/' && num(right) === 0) throw new Error('div0');
      value = op === '*' ? num(value) * num(right) : num(value) / num(right);
    }
    return value;
  }

  parseFactor() {
    const ch = this.peek();
    if (ch === '(') {
      this.i += 1;
      const value = this.parseExpr();
      if (this.peek() !== ')') throw new Error('paren');
      this.i += 1;
      return value;
    }
    if (ch === '+' || ch === '-') {
      this.i += 1;
      const value = this.parseFactor();
      return ch === '-' ? -num(value) : num(value);
    }
    if (/^sum(?![a-z])/i.test(this.s.slice(this.i))) {
      this.i += 3;
      if (this.peek() !== '(') throw new Error('sum');
      this.i += 1;
      const value = this.parseSum();
      if (this.peek() !== ')') throw new Error('sum');
      this.i += 1;
      return value;
    }
    const cell = this.readCell();
    if (cell) return valueOf(cell, this.cells, this.stack);
    const number = this.readNumber();
    if (number != null) return number;
    throw new Error('bad');
  }

  parseSum() {
    let total = 0;
    let any = false;
    for (;;) {
      const start = this.readCell();
      if (!start) {
        if (!any) throw new Error('sum');
        break;
      }
      any = true;
      if (this.peek() === ':') {
        this.i += 1;
        const end = this.readCell();
        if (!end) throw new Error('sum');
        for (const addr of expand(start, end)) {
          total += summand(valueOf(addr, this.cells, this.stack));
        }
      } else {
        total += summand(valueOf(start, this.cells, this.stack));
      }
      if (this.peek() === ',') {
        this.i += 1;
        continue;
      }
      break;
    }
    return total;
  }

  readCell() {
    this.skip();
    const match = /^([A-La-l])(\d{1,2})/.exec(this.s.slice(this.i));
    if (!match) return null;
    const col = match[1].toUpperCase();
    const row = Number(match[2]);
    if (!COL.test(col) || row < 1 || row > 40) return null;
    this.i += match[0].length;
    return col + String(row);
  }

  readNumber() {
    this.skip();
    const match = /^\d+(\.\d+)?/.exec(this.s.slice(this.i));
    if (!match) return null;
    this.i += match[0].length;
    return Number(match[0]);
  }
}

export function evaluate(expr, cells, stack = new Set()) {
  try {
    const parser = new Parser(expr, cells, stack);
    const value = parser.parseExpr();
    parser.skip();
    if (parser.i < parser.s.length) return { error: true };
    if (typeof value === 'number' && !Number.isFinite(value)) return { error: true };
    return value;
  } catch {
    return { error: true };
  }
}

export function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'ERR';
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

export function present(raw, addr, cells) {
  if (raw == null || raw === '') return '';
  const text = String(raw).trim();
  if (!text.startsWith('=')) return String(raw);
  const value = evaluate(text.slice(1), cells, new Set(addr ? [addr] : []));
  if (value && typeof value === 'object' && value.error) return 'ERR';
  if (typeof value === 'number') return formatNumber(value);
  return value == null ? '' : String(value);
}
