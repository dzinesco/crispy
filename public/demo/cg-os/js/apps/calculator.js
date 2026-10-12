/* ============================================================
   Calculator — Win98-style basic calculator.
   ============================================================ */

(function () {
  "use strict";

  const KEYS = [
    ["MC", "7", "8", "9", "/", "sqrt"],
    ["MR", "4", "5", "6", "*", "%"],
    ["MS", "1", "2", "3", "-", "1/x"],
    ["M+", "0", "+/-", ".", "+", "="],
  ];

  const app = {
    id: "calculator",
    name: "Calculator",
    icon: "calc",
    category: "utility",

    launch(opts = {}) {
      const winId = "calc_" + Date.now();
      const state = {
        current: "0",
        previous: null,
        op: null,
        waitingForOperand: false,
        memory: 0,
        history: "",
      };
      Object.assign(state, opts.state || {});

      const displaySmall = document.createElement("div");
      displaySmall.className = "small";
      const displayMain = document.createElement("div");
      displayMain.className = "main";

      const screen = document.createElement("div");
      screen.className = "calc-screen";
      screen.appendChild(displaySmall);
      screen.appendChild(displayMain);

      const menu = document.createElement("div");
      menu.className = "win-menubar";
      ["Edit", "View", "Help"].forEach((m) => {
        const item = document.createElement("span");
        item.className = "win-menubar-item";
        item.textContent = m;
        menu.appendChild(item);
      });

      const keysHost = document.createElement("div");
      keysHost.className = "calc-keys";

      const win = window.WM.createWindow({
        id: winId,
        title: "Calculator",
        icon: "calc",
        width: 240, height: 280,
        x: opts.x, y: opts.y,
        persistKey: "calculator",
        resizable: false,
        content: (body) => {
          body.style.display = "flex";
          body.style.flexDirection = "column";
          body.style.padding = "0";

          const calc = document.createElement("div");
          calc.className = "calc";
          calc.appendChild(screen);

          KEYS.forEach((row) => {
            row.forEach((k) => {
              const btn = document.createElement("button");
              btn.textContent = k;
              btn.dataset.k = k;
              if ("+-*/=".includes(k)) btn.classList.add("op");
              if (k === "=") btn.classList.add("eq");
              if (!"+-*/=.".includes(k) && isNaN(Number(k))) btn.classList.add("op");
              if ("0123456789".includes(k)) btn.classList.add("num");
              btn.addEventListener("click", () => handleKey(k));
              keysHost.appendChild(btn);
            });
          });
          calc.appendChild(keysHost);

          body.appendChild(menu);
          body.appendChild(calc);

          body.addEventListener("keydown", (e) => {
            const k = e.key;
            if ("0123456789.".includes(k)) { handleKey(k); e.preventDefault(); }
            else if ("+-*/".includes(k)) { handleKey(k); e.preventDefault(); }
            else if (k === "Enter" || k === "=") { handleKey("="); e.preventDefault(); }
            else if (k === "Backspace") { handleKey("Back"); e.preventDefault(); }
            else if (k === "Escape") { handleKey("C"); e.preventDefault(); }
            else if (k.toLowerCase() === "c") { handleKey("CE"); e.preventDefault(); }
          });

          function handleKey(k) {
            if (k === "C" || k === "CE") {
              state.current = "0"; state.history = "";
              state.previous = null; state.op = null; state.waitingForOperand = false;
            } else if (k === "Back") {
              state.current = (state.current.length <= 1) ? "0" : state.current.slice(0, -1);
            } else if (k === "MC") { state.memory = 0; }
            else if (k === "MR") { state.current = String(state.memory); state.waitingForOperand = true; }
            else if (k === "MS") { state.memory = Number(state.current); }
            else if (k === "M+") { state.memory += Number(state.current); }
            else if (k === "+/-") {
              if (state.current.startsWith("-")) state.current = state.current.slice(1);
              else if (state.current !== "0") state.current = "-" + state.current;
            } else if (k === "1/x") {
              const v = Number(state.current);
              state.current = v === 0 ? "Cannot divide by zero" : String(1 / v);
              state.waitingForOperand = true;
            } else if (k === "sqrt") {
              const v = Number(state.current);
              state.current = v < 0 ? "Invalid input" : String(Math.sqrt(v));
              state.waitingForOperand = true;
            } else if (k === "%") {
              const v = Number(state.current);
              state.current = String(v / 100);
              state.waitingForOperand = true;
            } else if ("+-*/".includes(k)) {
              if (state.previous != null && state.op && !state.waitingForOperand) {
                compute();
              }
              state.previous = Number(state.current);
              state.op = k;
              state.waitingForOperand = true;
              state.history = `${fmt(state.previous)} ${k}`;
            } else if (k === "=") {
              if (state.op != null) {
                state.history = `${fmt(state.previous)} ${state.op} ${fmt(Number(state.current))} =`;
                compute();
                state.op = null;
                state.previous = null;
                state.waitingForOperand = true;
              }
            } else if ("0123456789".includes(k)) {
              if (state.waitingForOperand) { state.current = "0"; state.waitingForOperand = false; }
              if (state.current === "0" && k !== "0") state.current = k;
              else if (state.current === "0" && k === "0") {/* keep */}
              else state.current += k;
              if (state.history.endsWith("=")) state.history = "";
            } else if (k === ".") {
              if (state.waitingForOperand) { state.current = "0"; state.waitingForOperand = false; }
              if (!state.current.includes(".")) state.current += ".";
            }
            render();
          }
          function compute() {
            const a = state.previous;
            const b = Number(state.current);
            let r = 0;
            switch (state.op) {
              case "+": r = a + b; break;
              case "-": r = a - b; break;
              case "*": r = a * b; break;
              case "/": r = b === 0 ? NaN : a / b; break;
            }
            state.current = isFinite(r) ? String(r) : "Error";
            state.history = `${fmt(a)} ${state.op} ${fmt(b)} =`;
          }
          function render() {
            displayMain.textContent = state.current.length > 18 ? Number(state.current).toExponential(8) : state.current;
            displaySmall.textContent = state.history || "";
          }
          function fmt(v) {
            if (!isFinite(v)) return "Error";
            return Math.abs(v) >= 1e10 ? v.toExponential(6) : String(v);
          }
          render();
          win.getAppState = () => ({ ...state });
          win.app = "calculator";
        },
      });
      win.app = "calculator";
      return win;
    },
  };

  window.CalculatorApp = app;
})();