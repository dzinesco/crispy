/* CAD — single-file drawing app
 * Vanilla JS, no build step. Renders to <canvas> with pan/zoom camera,
 * entity-based scene graph, layers, undo/redo, JSON save/load, SVG/PNG export.
 */

(() => {
  "use strict";

  // -------- State --------------------------------------------------------
  const state = {
    entities: [], // {id, type, layerId, stroke, strokeWidth, fill, fillEnabled, ...}
    layers: [
      { id: "L0", name: "Layer 0", visible: true, locked: false, color: "#101014" },
    ],
    activeLayerId: "L0",
    camera: { x: 0, y: 0, zoom: 1 }, // world point at center of viewport
    tool: "select",
    selection: new Set(),
    drawing: null, // in-progress entity
    hover: { x: 0, y: 0, screen: { x: 0, y: 0 } },
    style: {
      stroke: "#101014",
      fill: "#ffffff",
      fillEnabled: false,
      strokeWidth: 1.5,
      fontSize: 16,
      polygonSides: 6,
    },
    showGrid: true,
    snap: true,
    history: [],
    redoStack: [],
  };

  // -------- DOM ----------------------------------------------------------
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const hud = {
    tool: document.getElementById("hud-tool"),
    cursor: document.getElementById("hud-cursor"),
    count: document.getElementById("hud-count"),
    zoom: document.getElementById("hud-zoom"),
  };
  const styleInputs = {
    stroke: document.getElementById("stroke-color"),
    fill: document.getElementById("fill-color"),
    fillEnabled: document.getElementById("fill-enabled"),
    strokeWidth: document.getElementById("stroke-width"),
    strokeWidthValue: document.getElementById("stroke-width-value"),
    fontSize: document.getElementById("font-size"),
    polygonSides: document.getElementById("polygon-sides"),
  };
  const layerList = document.getElementById("layer-list");
  const selectionInfo = document.getElementById("selection-info");
  const textInput = document.getElementById("text-input");
  const textInputField = document.getElementById("text-input-field");
  const stage = document.querySelector(".stage");

  // -------- Helpers ------------------------------------------------------
  let _id = 1;
  const nextId = () => "E" + _id++;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function getActiveLayer() {
    return state.layers.find((l) => l.id === state.activeLayerId) || state.layers[0];
  }

  function pushHistory() {
    state.history.push(JSON.stringify({ entities: state.entities, layers: state.layers }));
    if (state.history.length > 200) state.history.shift();
    state.redoStack.length = 0;
  }

  function undo() {
    if (state.history.length === 0) return;
    state.redoStack.push(JSON.stringify({ entities: state.entities, layers: state.layers }));
    const snap = JSON.parse(state.history.pop());
    state.entities = snap.entities;
    state.layers = snap.layers;
    state.activeLayerId = state.layers[0].id;
    state.selection.clear();
    renderLayers();
    draw();
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    state.history.push(JSON.stringify({ entities: state.entities, layers: state.layers }));
    const snap = JSON.parse(state.redoStack.pop());
    state.entities = snap.entities;
    state.layers = snap.layers;
    state.activeLayerId = state.layers[0].id;
    state.selection.clear();
    renderLayers();
    draw();
  }

  function snapPoint(p) {
    if (!state.snap) return p;
    const s = 10; // world units per grid cell at zoom 1
    return { x: Math.round(p.x / s) * s, y: Math.round(p.y / s) * s };
  }

  // -------- Camera / coords ---------------------------------------------
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // world <-> screen
  function worldToScreen(w) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (w.x - state.camera.x) * state.camera.zoom + r.width / 2,
      y: (w.y - state.camera.y) * state.camera.zoom + r.height / 2,
    };
  }

  function screenToWorld(s) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (s.x - r.width / 2) / state.camera.zoom + state.camera.x,
      y: (s.y - r.height / 2) / state.camera.zoom + state.camera.y,
    };
  }

  function viewBounds() {
    const r = canvas.getBoundingClientRect();
    const tl = screenToWorld({ x: 0, y: 0 });
    const br = screenToWorld({ x: r.width, y: r.height });
    return { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y };
  }

  // -------- Entity ops ---------------------------------------------------
  function addEntity(e) {
    pushHistory();
    state.entities.push(e);
    draw();
  }

  function removeEntity(id) {
    pushHistory();
    state.entities = state.entities.filter((e) => e.id !== id);
    state.selection.delete(id);
    draw();
  }

  function clearAll() {
    pushHistory();
    state.entities = [];
    state.selection.clear();
    draw();
  }

  // -------- Rendering ----------------------------------------------------
  function draw() {
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);

    if (state.showGrid) drawGrid();

    for (const e of state.entities) {
      const layer = state.layers.find((l) => l.id === e.layerId);
      if (!layer || !layer.visible) continue;
      drawEntity(e, state.selection.has(e.id));
    }

    if (state.drawing) drawEntity(state.drawing, false, true);

    hud.count.textContent = state.entities.length;
    hud.zoom.textContent = Math.round(state.camera.zoom * 100) + "%";
  }

  function drawGrid() {
    const r = canvas.getBoundingClientRect();
    const b = viewBounds();
    const cellWorld = 10;
    const cellScreen = cellWorld * state.camera.zoom;
    if (cellScreen < 6) return;

    const startX = Math.floor(b.minX / cellWorld) * cellWorld;
    const endX = Math.ceil(b.maxX / cellWorld) * cellWorld;
    const startY = Math.floor(b.minY / cellWorld) * cellWorld;
    const endY = Math.ceil(b.maxY / cellWorld) * cellWorld;

    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += cellWorld) {
      const s = worldToScreen({ x, y: 0 });
      ctx.moveTo(s.x + 0.5, 0);
      ctx.lineTo(s.x + 0.5, r.height);
    }
    for (let y = startY; y <= endY; y += cellWorld) {
      const s = worldToScreen({ x: 0, y });
      ctx.moveTo(0, s.y + 0.5);
      ctx.lineTo(r.width, s.y + 0.5);
    }
    ctx.stroke();

    // origin axes
    const o = worldToScreen({ x: 0, y: 0 });
    ctx.strokeStyle = "rgba(166, 124, 26, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, o.y + 0.5);
    ctx.lineTo(r.width, o.y + 0.5);
    ctx.moveTo(o.x + 0.5, 0);
    ctx.lineTo(o.x + 0.5, r.height);
    ctx.stroke();
  }

  function strokeFor(e) {
    const layer = state.layers.find((l) => l.id === e.layerId);
    return e.stroke || (layer && layer.color) || state.style.stroke;
  }

  function drawEntity(e, selected, preview) {
    const stroke = strokeFor(e);
    const w = e.strokeWidth || 1.5;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = e.fill || state.style.fill;
    ctx.lineWidth = w * (preview ? 1 : 1);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const withFill = () => {
      if (e.fillEnabled) ctx.fill();
    };

    switch (e.type) {
      case "line": {
        ctx.beginPath();
        const a = worldToScreen(e.a);
        const b = worldToScreen(e.b);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case "rect": {
        const a = worldToScreen(e.a);
        const b = worldToScreen(e.b);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w2 = Math.abs(b.x - a.x);
        const h2 = Math.abs(b.y - a.y);
        ctx.beginPath();
        ctx.rect(x, y, w2, h2);
        withFill();
        ctx.stroke();
        break;
      }
      case "circle": {
        const c = worldToScreen(e.c);
        const r = Math.abs(e.c.r) * state.camera.zoom;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        if (e.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "ellipse": {
        const c = worldToScreen(e.c);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, Math.abs(e.rx) * state.camera.zoom, Math.abs(e.ry) * state.camera.zoom, 0, 0, Math.PI * 2);
        if (e.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "polyline": {
        if (e.points.length < 1) break;
        ctx.beginPath();
        const p0 = worldToScreen(e.points[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < e.points.length; i++) {
          const p = worldToScreen(e.points[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        break;
      }
      case "polygon": {
        const pts = polygonPoints(e);
        if (pts.length === 0) break;
        ctx.beginPath();
        const p0 = worldToScreen(pts[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < pts.length; i++) {
          const p = worldToScreen(pts[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        if (e.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "arc": {
        const a = worldToScreen(e.a);
        const b = worldToScreen(e.b);
        const t = worldToScreen(e.through);
        const r = dist(a, b) / 2; // radius in screen pixels (matches world when zoom=1)
        // Solve circle center from a, b, t
        const center = circleFrom3Pts(a, b, t);
        const ang1 = Math.atan2(a.y - center.y, a.x - center.x);
        const ang2 = Math.atan2(b.y - center.y, b.x - center.x);
        let ang3 = Math.atan2(t.y - center.y, t.x - center.x);
        let sweep = ang2 - ang1;
        const mid = (ang1 + ang2) / 2;
        let diff = ((ang3 - mid + Math.PI) % (2 * Math.PI)) - Math.PI;
        if (diff < 0) diff += 2 * Math.PI;
        let startA = ang1;
        let endA = ang2;
        if (diff > Math.PI) {
          // counter-clockwise sweep
          startA = ang1;
          endA = ang2 - 2 * Math.PI;
        }
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, startA, endA, diff > Math.PI);
        ctx.stroke();
        break;
      }
      case "text": {
        const p = worldToScreen(e.p);
        ctx.font = `${e.fontSize * state.camera.zoom}px -apple-system, "Segoe UI", Inter, sans-serif`;
        ctx.textBaseline = "top";
        if (e.fillEnabled) {
          ctx.fillStyle = stroke;
          ctx.fillText(e.text, p.x, p.y);
        } else {
          ctx.fillStyle = stroke;
          ctx.fillText(e.text, p.x, p.y);
        }
        break;
      }
      case "dimension": {
        drawDimension(e);
        break;
      }
    }

    if (selected) {
      ctx.strokeStyle = "#E1064A";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      drawEntityBBox(e);
      ctx.setLineDash([]);
    }
  }

  function polygonPoints(e) {
    const sides = Math.max(3, Math.floor(e.sides || 6));
    const r = e.r;
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = e.startAngle + (i * 2 * Math.PI) / sides;
      pts.push({ x: e.c.x + Math.cos(a) * r, y: e.c.y + Math.sin(a) * r });
    }
    return pts;
  }

  function drawEntityBBox(e) {
    const bb = entityBBox(e);
    if (!bb) return;
    const a = worldToScreen({ x: bb.minX, y: bb.minY });
    const b = worldToScreen({ x: bb.maxX, y: bb.maxY });
    ctx.strokeRect(
      Math.min(a.x, b.x) - 2,
      Math.min(a.y, b.y) - 2,
      Math.abs(b.x - a.x) + 4,
      Math.abs(b.y - a.y) + 4,
    );
  }

  function entityBBox(e) {
    switch (e.type) {
      case "line":
        return bboxOfPoints([e.a, e.b]);
      case "rect":
        return bboxOfPoints([e.a, e.b]);
      case "circle":
        return {
          minX: e.c.x - Math.abs(e.c.r),
          minY: e.c.y - Math.abs(e.c.r),
          maxX: e.c.x + Math.abs(e.c.r),
          maxY: e.c.y + Math.abs(e.c.r),
        };
      case "ellipse":
        return {
          minX: e.c.x - Math.abs(e.rx),
          minY: e.c.y - Math.abs(e.ry),
          maxX: e.c.x + Math.abs(e.rx),
          maxY: e.c.y + Math.abs(e.ry),
        };
      case "polyline":
        return bboxOfPoints(e.points);
      case "polygon": {
        const pts = polygonPoints(e);
        return bboxOfPoints(pts);
      }
      case "arc": {
        const pts = [e.a, e.b, e.through];
        return bboxOfPoints(pts);
      }
      case "text": {
        const w = (e.text || "").length * e.fontSize * 0.55;
        const h = e.fontSize;
        return { minX: e.p.x, minY: e.p.y, maxX: e.p.x + w, maxY: e.p.y + h };
      }
      case "dimension": {
        return bboxOfPoints([e.a, e.b]);
      }
      default:
        return null;
    }
  }

  function bboxOfPoints(pts) {
    if (!pts.length) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  function circleFrom3Pts(p1, p2, p3) {
    const ax = p1.x,
      ay = p1.y,
      bx = p2.x,
      by = p2.y,
      cx = p3.x,
      cy = p3.y;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-6) return { x: (ax + bx) / 2, y: (ay + by) / 2 };
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { x: ux, y: uy };
  }

  function drawDimension(e) {
    const a = worldToScreen(e.a);
    const b = worldToScreen(e.b);
    const offset = 16;
    // direction
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const ox = nx * offset;
    const oy = ny * offset;
    const a2 = { x: a.x + ox, y: a.y + oy };
    const b2 = { x: b.x + ox, y: b.y + oy };

    ctx.beginPath();
    // extension lines
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a2.x, a2.y);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b2.x, b2.y);
    // dimension line
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(b2.x, b2.y);
    // arrow heads
    const ang = Math.atan2(b2.y - a2.y, b2.x - a2.x);
    const ah = 6;
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(a2.x + Math.cos(ang + 0.4) * ah, a2.y + Math.sin(ang + 0.4) * ah);
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(a2.x + Math.cos(ang - 0.4) * ah, a2.y + Math.sin(ang - 0.4) * ah);
    ctx.moveTo(b2.x, b2.y);
    ctx.lineTo(b2.x - Math.cos(ang + 0.4) * ah, b2.y - Math.sin(ang + 0.4) * ah);
    ctx.moveTo(b2.x, b2.y);
    ctx.lineTo(b2.x - Math.cos(ang - 0.4) * ah, b2.y - Math.sin(ang - 0.4) * ah);
    ctx.stroke();

    // label
    const worldLen = dist(e.a, e.b);
    const label = formatNumber(worldLen);
    ctx.font = `12px -apple-system, "Segoe UI", Inter, sans-serif`;
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(label).width;
    const lx = (a2.x + b2.x) / 2 - tw / 2;
    const ly = (a2.y + b2.y) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(lx - 3, ly - 8, tw + 6, 16);
    ctx.fillStyle = strokeFor(e);
    ctx.fillText(label, lx, ly);
  }

  function formatNumber(n) {
    if (Math.abs(n) >= 100) return n.toFixed(0);
    if (Math.abs(n) >= 10) return n.toFixed(1);
    return n.toFixed(2);
  }

  // -------- Hit testing --------------------------------------------------
  function hitEntityAt(w, screen) {
    // search in reverse draw order
    const tol = 6 / state.camera.zoom;
    for (let i = state.entities.length - 1; i >= 0; i--) {
      const e = state.entities[i];
      const layer = state.layers.find((l) => l.id === e.layerId);
      if (!layer || !layer.visible || layer.locked) continue;
      if (hitTest(e, w, screen, tol)) return e;
    }
    return null;
  }

  function hitTest(e, w, screen, tol) {
    switch (e.type) {
      case "line":
        return pointToSegment(w, e.a, e.b) < tol;
      case "rect": {
        const x1 = Math.min(e.a.x, e.b.x);
        const y1 = Math.min(e.a.y, e.b.y);
        const x2 = Math.max(e.a.x, e.b.x);
        const y2 = Math.max(e.a.y, e.b.y);
        const inside = w.x >= x1 && w.x <= x2 && w.y >= y1 && w.y <= y2;
        if (inside && e.fillEnabled) return true;
        const distH = Math.min(Math.abs(w.x - x1), Math.abs(w.x - x2));
        const distV = Math.min(Math.abs(w.y - y1), Math.abs(w.y - y2));
        return w.x >= x1 - tol && w.x <= x2 + tol && w.y >= y1 - tol && w.y <= y2 + tol && (distH < tol || distV < tol);
      }
      case "circle":
        return Math.abs(dist(w, e.c) - Math.abs(e.c.r)) < tol;
      case "ellipse": {
        if (e.rx === 0 || e.ry === 0) return false;
        const dx = (w.x - e.c.x) / e.rx;
        const dy = (w.y - e.c.y) / e.ry;
        return Math.abs(Math.hypot(dx, dy) - 1) * Math.min(e.rx, e.ry) < tol;
      }
      case "polyline":
        for (let i = 0; i < e.points.length - 1; i++) {
          if (pointToSegment(w, e.points[i], e.points[i + 1]) < tol) return true;
        }
        return false;
      case "polygon": {
        const pts = polygonPoints(e);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i],
            b = pts[(i + 1) % pts.length];
          if (pointToSegment(w, a, b) < tol) return true;
        }
        return false;
      }
      case "arc":
        return pointToSegment(w, e.a, e.b) < tol;
      case "text": {
        const w2 = (e.text || "").length * e.fontSize * 0.55;
        const h2 = e.fontSize;
        return w.x >= e.p.x && w.x <= e.p.x + w2 && w.y >= e.p.y && w.y <= e.p.y + h2;
      }
      case "dimension":
        return pointToSegment(w, e.a, e.b) < tol;
    }
    return false;
  }

  function pointToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = clamp(t, 0, 1);
    return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
  }

  // -------- Tools --------------------------------------------------------
  let mouseDown = false;
  let mouseDownPt = null;
  let dragOp = null; // { kind: 'pan' | 'box' | 'move' | 'create', ... }
  const DRAG_TOOLS = new Set(["rect", "line", "circle", "ellipse", "polygon", "dimension"]);

  function setTool(name) {
    state.tool = name;
    document.querySelectorAll(".tool").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === name);
    });
    canvas.style.cursor = cursorForTool(name);
    state.drawing = null;
    cancelTextInput();
    hud.tool.textContent = name[0].toUpperCase() + name.slice(1);
    draw();
  }

  function cursorForTool(name) {
    switch (name) {
      case "select":
        return "default";
      case "pan":
        return "grab";
      case "eraser":
        return "not-allowed";
      case "text":
        return "text";
      default:
        return "crosshair";
    }
  }

  function onMouseDown(e) {
    mouseDown = true;
    const screen = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };
    const world = screenToWorld(screen);
    mouseDownPt = { screen, world };

    if (e.button === 1 || (e.button === 0 && (state.tool === "pan" || isSpaceHeld))) {
      dragOp = { kind: "pan", start: { ...state.camera }, last: screen };
      canvas.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;

    const layer = getActiveLayer();
    if (!layer || layer.locked) return;

    const raw = snapPoint(world);

    switch (state.tool) {
      case "select": {
        const hit = hitEntityAt(world, screen);
        if (hit) {
          if (!state.selection.has(hit.id)) {
            state.selection.clear();
            state.selection.add(hit.id);
          }
          dragOp = { kind: "move", start: world, originals: state.selection };
          draw();
          updateSelectionInfo();
        } else {
          state.selection.clear();
          dragOp = { kind: "box", start: world };
          draw();
          updateSelectionInfo();
        }
        break;
      }
      case "line": {
        if (!state.drawing) {
          state.drawing = {
            id: nextId(),
            type: "line",
            layerId: state.activeLayerId,
            stroke: state.style.stroke,
            strokeWidth: state.style.strokeWidth,
            fillEnabled: false,
            a: raw,
            b: raw,
          };
        } else {
          state.drawing.b = raw;
          finalizeDrawing();
        }
        draw();
        break;
      }
      case "rect": {
        state.drawing = {
          id: nextId(),
          type: "rect",
          layerId: state.activeLayerId,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          fill: state.style.fill,
          fillEnabled: state.style.fillEnabled,
          a: raw,
          b: raw,
        };
        draw();
        break;
      }
      case "circle": {
        state.drawing = {
          id: nextId(),
          type: "circle",
          layerId: state.activeLayerId,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          fill: state.style.fill,
          fillEnabled: state.style.fillEnabled,
          c: raw,
          r: 0,
        };
        draw();
        break;
      }
      case "ellipse": {
        state.drawing = {
          id: nextId(),
          type: "ellipse",
          layerId: state.activeLayerId,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          fill: state.style.fill,
          fillEnabled: state.style.fillEnabled,
          c: raw,
          rx: 0,
          ry: 0,
        };
        draw();
        break;
      }
      case "polyline": {
        if (!state.drawing) {
          state.drawing = {
            id: nextId(),
            type: "polyline",
            layerId: state.activeLayerId,
            stroke: state.style.stroke,
            strokeWidth: state.style.strokeWidth,
            points: [raw],
          };
        } else {
          state.drawing.points.push(raw);
        }
        draw();
        break;
      }
      case "polygon": {
        state.drawing = {
          id: nextId(),
          type: "polygon",
          layerId: state.activeLayerId,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          fill: state.style.fill,
          fillEnabled: state.style.fillEnabled,
          c: raw,
          r: 0,
          startAngle: 0,
          sides: state.style.polygonSides,
        };
        draw();
        break;
      }
      case "arc": {
        if (!state.drawing) {
          state.drawing = {
            id: nextId(),
            type: "arc",
            layerId: state.activeLayerId,
            stroke: state.style.stroke,
            strokeWidth: state.style.strokeWidth,
            step: "a",
            a: raw,
            b: raw,
            through: raw,
          };
        } else if (state.drawing.step === "a") {
          state.drawing.step = "through";
          state.drawing.through = raw;
        } else if (state.drawing.step === "through") {
          state.drawing.b = raw;
          finalizeDrawing();
        }
        draw();
        break;
      }
      case "text": {
        const p = raw;
        const ent = {
          id: nextId(),
          type: "text",
          layerId: state.activeLayerId,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          fillEnabled: false,
          p,
          text: "",
          fontSize: state.style.fontSize,
        };
        state.drawing = ent;
        openTextInput(screen, ent);
        draw();
        break;
      }
      case "dimension": {
        state.drawing = {
          id: nextId(),
          type: "dimension",
          layerId: state.activeLayerId,
          stroke: state.style.stroke,
          strokeWidth: state.style.strokeWidth,
          a: raw,
          b: raw,
        };
        draw();
        break;
      }
      case "eraser": {
        const hit = hitEntityAt(world, screen);
        if (hit) removeEntity(hit.id);
        break;
      }
    }
  }

  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    const world = screenToWorld(screen);
    state.hover = { x: world.x, y: world.y, screen };
    hud.cursor.textContent = `${formatNumber(world.x)}, ${formatNumber(world.y)}`;

    if (!mouseDown) {
      draw();
      return;
    }

    if (dragOp?.kind === "pan") {
      const dx = (screen.x - dragOp.last.x) / state.camera.zoom;
      const dy = (screen.y - dragOp.last.y) / state.camera.zoom;
      state.camera.x -= dx;
      state.camera.y -= dy;
      dragOp.last = screen;
      draw();
      return;
    }

    const raw = snapPoint(world);

    if (dragOp?.kind === "move") {
      const dx = raw.x - dragOp.start.x;
      const dy = raw.y - dragOp.start.y;
      for (const e of state.entities) {
        if (state.selection.has(e.id)) translateEntity(e, dx, dy);
      }
      dragOp.start = raw;
      draw();
      return;
    }

    if (dragOp?.kind === "box") {
      draw();
      const a = dragOp.start;
      const sa = worldToScreen(a);
      ctx.strokeStyle = "#E1064A";
      ctx.fillStyle = "rgba(225, 6, 74, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      const x = Math.min(sa.x, screen.x);
      const y = Math.min(sa.y, screen.y);
      const w = Math.abs(screen.x - sa.x);
      const h = Math.abs(screen.y - sa.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      return;
    }

    if (!state.drawing) return;

    switch (state.drawing.type) {
      case "line":
      case "rect":
      case "dimension":
        state.drawing.b = raw;
        break;
      case "circle":
        state.drawing.r = dist(state.drawing.c, raw);
        break;
      case "ellipse":
        state.drawing.rx = Math.abs(raw.x - state.drawing.c.x);
        state.drawing.ry = Math.abs(raw.y - state.drawing.c.y);
        break;
      case "polyline":
        // hover preview handled by drawing the polyline + a dashed line to cursor
        draw();
        drawRubberLineTo(state.drawing.points[state.drawing.points.length - 1], raw);
        return;
      case "polygon":
        state.drawing.r = dist(state.drawing.c, raw);
        state.drawing.startAngle = Math.atan2(raw.y - state.drawing.c.y, raw.x - state.drawing.c.x) + Math.PI / 2;
        break;
      case "arc":
        if (state.drawing.step === "a") {
          state.drawing.through = raw;
        } else if (state.drawing.step === "through") {
          state.drawing.b = raw;
        }
        break;
    }
    draw();
  }

  function drawRubberLineTo(a, b) {
    const sa = worldToScreen(a);
    const sb = worldToScreen(b);
    ctx.strokeStyle = state.style.stroke;
    ctx.lineWidth = state.style.strokeWidth;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function translateEntity(e, dx, dy) {
    switch (e.type) {
      case "line":
      case "rect":
      case "dimension":
        e.a.x += dx;
        e.a.y += dy;
        e.b.x += dx;
        e.b.y += dy;
        break;
      case "circle":
      case "ellipse":
      case "polygon":
        e.c.x += dx;
        e.c.y += dy;
        break;
      case "polyline":
        for (const p of e.points) {
          p.x += dx;
          p.y += dy;
        }
        break;
      case "arc":
        e.a.x += dx;
        e.a.y += dy;
        e.b.x += dx;
        e.b.y += dy;
        e.through.x += dx;
        e.through.y += dy;
        break;
      case "text":
        e.p.x += dx;
        e.p.y += dy;
        break;
    }
  }

  function onMouseUp(e) {
    if (!mouseDown) return;
    mouseDown = false;
    if (dragOp?.kind === "pan") {
      dragOp = null;
      canvas.style.cursor = cursorForTool(state.tool);
      return;
    }
    if (dragOp?.kind === "move") {
      pushHistory();
      dragOp = null;
      return;
    }
    if (dragOp?.kind === "box") {
      const a = dragOp.start;
      const r = canvas.getBoundingClientRect();
      const world = screenToWorld({ x: e.clientX - r.left, y: e.clientY - r.top });
      const x1 = Math.min(a.x, world.x);
      const y1 = Math.min(a.y, world.y);
      const x2 = Math.max(a.x, world.x);
      const y2 = Math.max(a.y, world.y);
      state.selection.clear();
      for (const ent of state.entities) {
        const bb = entityBBox(ent);
        if (!bb) continue;
        if (bb.maxX >= x1 && bb.minX <= x2 && bb.maxY >= y1 && bb.minY <= y2) {
          state.selection.add(ent.id);
        }
      }
      dragOp = null;
      updateSelectionInfo();
      draw();
      return;
    }
    // Drag-to-create: finalize in-progress drawing on mouseup for tools that use it
    if (state.drawing && DRAG_TOOLS.has(state.drawing.type)) {
      // Reject zero-size for shape tools (avoid accidental click noise)
      const d = state.drawing;
      const minSize = 1; // world units
      let valid = true;
      switch (d.type) {
        case "rect":
        case "line":
        case "dimension":
          if (Math.abs(d.a.x - d.b.x) < minSize && Math.abs(d.a.y - d.b.y) < minSize) valid = false;
          break;
        case "circle":
        case "polygon":
          if (d.r < minSize) valid = false;
          break;
        case "ellipse":
          if (d.rx < minSize && d.ry < minSize) valid = false;
          break;
      }
      if (valid) {
        finalizeDrawing();
      } else {
        state.drawing = null;
        draw();
      }
    }
  }

  function onDblClick(e) {
    if (state.tool === "polyline" && state.drawing && state.drawing.points.length >= 2) {
      state.drawing.points.pop(); // discard last preview point if double-click is on same spot
      finalizeDrawing();
    }
  }

  function finalizeDrawing() {
    pushHistory();
    state.entities.push(state.drawing);
    state.drawing = null;
    draw();
  }

  function onWheel(e) {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    const before = screenToWorld(screen);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    state.camera.zoom = clamp(state.camera.zoom * factor, 0.1, 20);
    const after = screenToWorld(screen);
    state.camera.x += before.x - after.x;
    state.camera.y += before.y - after.y;
    draw();
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (state.drawing) {
      if (state.tool === "polyline" && state.drawing.points.length >= 2) {
        finalizeDrawing();
      } else {
        state.drawing = null;
        draw();
      }
    }
  }

  // -------- Text input overlay -------------------------------------------
  function openTextInput(screen, ent) {
    textInput.hidden = false;
    textInput.style.left = screen.x + "px";
    textInput.style.top = screen.y + "px";
    textInputField.value = "";
    state._textEnt = ent;
    // Defer focus until after the current event loop tick; some browsers
    // ignore focus() on a freshly-shown element within the same handler.
    setTimeout(() => {
      try {
        textInputField.focus({ preventScroll: true });
      } catch (e) {
        textInputField.focus();
      }
    }, 0);
  }

  function cancelTextInput() {
    closeTextInput(false);
  }

  function closeTextInput(commit) {
    if (commit) {
      const ent = state._textEnt;
      if (ent) {
        ent.text = textInputField.value || "Text";
        pushHistory();
        state.entities.push(ent);
      }
    }
    state.drawing = null;
    textInput.hidden = true;
    state._textEnt = null;
    // hand focus back to the body so subsequent shortcuts work
    try {
      textInputField.blur();
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    } catch (e) {}
    draw();
  }

  textInputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      closeTextInput(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeTextInput(false);
    }
  });

  // -------- Keyboard -----------------------------------------------------
  let isSpaceHeld = false;
  // Bail only for real text inputs, not checkboxes / buttons / labels
  function isTypingTarget(t) {
    if (!t) return false;
    if (t.isContentEditable) return true;
    const tag = t.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = (t.type || "text").toLowerCase();
      return ["text", "number", "password", "email", "search", "tel", "url", "color", "range"].includes(type);
    }
    return false;
  }
  window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === " ") {
      isSpaceHeld = true;
      canvas.style.cursor = "grab";
      return;
    }
    if (e.key === "Escape") {
      state.drawing = null;
      state.selection.clear();
      updateSelectionInfo();
      draw();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (state.selection.size) {
        pushHistory();
        state.entities = state.entities.filter((e) => !state.selection.has(e.id));
        state.selection.clear();
        updateSelectionInfo();
        draw();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    const k = e.key.toLowerCase();
    const map = {
      v: "select",
      h: "pan",
      l: "line",
      r: "rect",
      c: "circle",
      e: "ellipse",
      y: "polyline",
      p: "polygon",
      a: "arc",
      t: "text",
      d: "dimension",
      x: "eraser",
    };
    if (map[k]) {
      setTool(map[k]);
      return;
    }
    if (k === "g") {
      state.showGrid = !state.showGrid;
      document.getElementById("toggle-grid").checked = state.showGrid;
      draw();
      return;
    }
    if (k === "s") {
      state.snap = !state.snap;
      document.getElementById("toggle-snap").checked = state.snap;
      return;
    }
    if (k === "+" || k === "=") {
      state.camera.zoom = clamp(state.camera.zoom * 1.2, 0.1, 20);
      draw();
      return;
    }
    if (k === "-" || k === "_") {
      state.camera.zoom = clamp(state.camera.zoom / 1.2, 0.1, 20);
      draw();
      return;
    }
    if (k === "0") {
      state.camera = { x: 0, y: 0, zoom: 1 };
      draw();
      return;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      isSpaceHeld = false;
      canvas.style.cursor = cursorForTool(state.tool);
    }
  });

  // -------- Layers -------------------------------------------------------
  function renderLayers() {
    layerList.innerHTML = "";
    for (const l of state.layers) {
      const li = document.createElement("li");
      li.className = l.id === state.activeLayerId ? "active" : "";
      li.dataset.id = l.id;
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = l.color;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = l.name;
      const vis = document.createElement("button");
      vis.className = "vis";
      vis.textContent = l.visible ? "👁" : "✕";
      vis.title = l.visible ? "Hide layer" : "Show layer";
      vis.onclick = (ev) => {
        ev.stopPropagation();
        l.visible = !l.visible;
        renderLayers();
        draw();
      };
      li.appendChild(sw);
      li.appendChild(name);
      li.appendChild(vis);
      li.onclick = () => {
        state.activeLayerId = l.id;
        renderLayers();
      };
      layerList.appendChild(li);
    }
  }

  document.getElementById("btn-add-layer").onclick = () => {
    const id = "L" + state.layers.length;
    state.layers.push({
      id,
      name: "Layer " + state.layers.length,
      visible: true,
      locked: false,
      color: "#101014",
    });
    state.activeLayerId = id;
    renderLayers();
  };

  // -------- Selection info ----------------------------------------------
  function updateSelectionInfo() {
    if (state.selection.size === 0) {
      selectionInfo.textContent = "Nothing selected";
      selectionInfo.className = "muted";
      return;
    }
    const items = [];
    for (const id of state.selection) {
      const e = state.entities.find((x) => x.id === id);
      if (e) items.push(`${e.type} ${id}`);
    }
    selectionInfo.textContent = items.join(", ");
    selectionInfo.className = "";
  }

  // -------- Style inputs -------------------------------------------------
  function bindStyleInputs() {
    styleInputs.stroke.oninput = () => {
      state.style.stroke = styleInputs.stroke.value;
      const layer = getActiveLayer();
      if (layer) layer.color = styleInputs.stroke.value;
      draw();
    };
    styleInputs.fill.oninput = () => (state.style.fill = styleInputs.fill.value);
    styleInputs.fillEnabled.oninput = () => (state.style.fillEnabled = styleInputs.fillEnabled.checked);
    styleInputs.strokeWidth.oninput = () => {
      state.style.strokeWidth = parseFloat(styleInputs.strokeWidth.value);
      styleInputs.strokeWidthValue.textContent = state.style.strokeWidth.toFixed(1);
    };
    styleInputs.fontSize.oninput = () => (state.style.fontSize = parseInt(styleInputs.fontSize.value, 10) || 16);
    styleInputs.polygonSides.oninput = () => (state.style.polygonSides = parseInt(styleInputs.polygonSides.value, 10) || 6);
  }

  // -------- Toolbar ------------------------------------------------------
  function newElement() {
    document.getElementById("btn-new").onclick = () => {
      if (state.entities.length === 0) return;
      if (!confirm("Clear the canvas?")) return;
      clearAll();
    };
    document.getElementById("btn-save").onclick = () => {
      const blob = new Blob(
        [JSON.stringify({ entities: state.entities, layers: state.layers }, null, 2)],
        { type: "application/json" },
      );
      downloadBlob(blob, "drawing.json");
    };
    document.getElementById("file-load").onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          pushHistory();
          state.entities = data.entities || [];
          state.layers = data.layers || [{ id: "L0", name: "Layer 0", visible: true, locked: false, color: "#101014" }];
          state.activeLayerId = state.layers[0].id;
          state.selection.clear();
          renderLayers();
          draw();
        } catch (err) {
          alert("Bad JSON: " + err.message);
        }
      };
      r.readAsText(f);
      e.target.value = "";
    };
    document.getElementById("btn-export-svg").onclick = exportSVG;
    document.getElementById("btn-export-png").onclick = exportPNG;
    document.getElementById("btn-undo").onclick = undo;
    document.getElementById("btn-redo").onclick = redo;
    document.getElementById("btn-zoom-in").onclick = () => {
      state.camera.zoom = clamp(state.camera.zoom * 1.2, 0.1, 20);
      draw();
    };
    document.getElementById("btn-zoom-out").onclick = () => {
      state.camera.zoom = clamp(state.camera.zoom / 1.2, 0.1, 20);
      draw();
    };
    document.getElementById("btn-zoom-reset").onclick = () => {
      state.camera = { x: 0, y: 0, zoom: 1 };
      draw();
    };
    document.getElementById("toggle-grid").onchange = (e) => {
      state.showGrid = e.target.checked;
      draw();
    };
    document.getElementById("toggle-snap").onchange = (e) => (state.snap = e.target.checked);
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // -------- Export -------------------------------------------------------
  function exportPNG() {
    // render scene onto offscreen canvas at 2x resolution
    const r = canvas.getBoundingClientRect();
    const off = document.createElement("canvas");
    off.width = r.width * 2;
    off.height = r.height * 2;
    const c = off.getContext("2d");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, off.width, off.height);
    c.scale(2, 2);

    const oldZoom = state.camera.zoom;
    const backup = state.camera;
    // use current view
    const tempCtx = ctx;
    // hack: re-render to off by temporarily swapping ctx
    // Simpler: rebuild with offCtx-like calls
    function exportDraw() {
      c.clearRect(0, 0, r.width, r.height);
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, r.width, r.height);
      // entities in screen coords: use the same draw functions via a swapped ctx
      const oldStroke = c.strokeStyle;
      for (const e of state.entities) {
        const layer = state.layers.find((l) => l.id === e.layerId);
        if (!layer || !layer.visible) continue;
        const stroke = e.stroke || layer.color;
        c.strokeStyle = stroke;
        c.lineWidth = e.strokeWidth;
        c.lineJoin = "round";
        c.lineCap = "round";
        const a = e.a ? worldToScreen(e.a) : null;
        const b = e.b ? worldToScreen(e.b) : null;
        const cpt = e.c ? worldToScreen(e.c) : null;
        switch (e.type) {
          case "line":
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.stroke();
            break;
          case "rect":
            c.beginPath();
            c.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
            if (e.fillEnabled) {
              c.fillStyle = e.fill;
              c.fill();
              c.strokeStyle = stroke;
            }
            c.stroke();
            break;
          case "circle":
            c.beginPath();
            c.arc(cpt.x, cpt.y, Math.abs(e.c.r) * state.camera.zoom, 0, Math.PI * 2);
            if (e.fillEnabled) {
              c.fillStyle = e.fill;
              c.fill();
              c.strokeStyle = stroke;
            }
            c.stroke();
            break;
          case "ellipse":
            c.beginPath();
            c.ellipse(cpt.x, cpt.y, Math.abs(e.rx) * state.camera.zoom, Math.abs(e.ry) * state.camera.zoom, 0, 0, Math.PI * 2);
            if (e.fillEnabled) {
              c.fillStyle = e.fill;
              c.fill();
              c.strokeStyle = stroke;
            }
            c.stroke();
            break;
          case "polyline":
            c.beginPath();
            for (let i = 0; i < e.points.length; i++) {
              const p = worldToScreen(e.points[i]);
              if (i === 0) c.moveTo(p.x, p.y);
              else c.lineTo(p.x, p.y);
            }
            c.stroke();
            break;
          case "polygon": {
            const pts = polygonPoints(e);
            c.beginPath();
            for (let i = 0; i < pts.length; i++) {
              const p = worldToScreen(pts[i]);
              if (i === 0) c.moveTo(p.x, p.y);
              else c.lineTo(p.x, p.y);
            }
            c.closePath();
            if (e.fillEnabled) {
              c.fillStyle = e.fill;
              c.fill();
              c.strokeStyle = stroke;
            }
            c.stroke();
            break;
          }
          case "arc":
            // render arc as line between endpoints + a hint
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.stroke();
            break;
          case "text": {
            const p = worldToScreen(e.p);
            c.font = `${e.fontSize * state.camera.zoom}px -apple-system, "Segoe UI", Inter, sans-serif`;
            c.fillStyle = stroke;
            c.textBaseline = "top";
            c.fillText(e.text, p.x, p.y);
            break;
          }
          case "dimension":
            // simplified: line between endpoints with offset
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len * 16;
            const ny = dx / len * 16;
            c.beginPath();
            c.moveTo(a.x + nx, a.y + ny);
            c.lineTo(b.x + nx, b.y + ny);
            c.stroke();
            break;
        }
      }
      c.strokeStyle = oldStroke;
    }
    exportDraw();
    off.toBlob((b) => downloadBlob(b, "drawing.png"), "image/png");
  }

  function exportSVG() {
    const r = canvas.getBoundingClientRect();
    const bb = bboxOfPoints(
      state.entities.flatMap((e) => {
        const b = entityBBox(e);
        return b ? [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }] : [];
      }),
    );
    const pad = 20;
    const minX = (bb ? bb.minX : -100) - pad;
    const minY = (bb ? bb.minY : -100) - pad;
    const w = (bb ? bb.maxX - bb.minX : 200) + pad * 2;
    const h = (bb ? bb.maxY - bb.minY : 200) + pad * 2;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}">`;
    s += `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="white"/>`;
    for (const e of state.entities) {
      const layer = state.layers.find((l) => l.id === e.layerId);
      if (!layer || !layer.visible) continue;
      const stroke = e.stroke || layer.color;
      const sw = e.strokeWidth;
      const fill = e.fillEnabled ? e.fill : "none";
      switch (e.type) {
        case "line":
          s += `<line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" stroke="${stroke}" stroke-width="${sw}" />`;
          break;
        case "rect": {
          const x = Math.min(e.a.x, e.b.x);
          const y = Math.min(e.a.y, e.b.y);
          const w2 = Math.abs(e.b.x - e.a.x);
          const h2 = Math.abs(e.b.y - e.a.y);
          s += `<rect x="${x}" y="${y}" width="${w2}" height="${h2}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" />`;
          break;
        }
        case "circle":
          s += `<circle cx="${e.c.x}" cy="${e.c.y}" r="${Math.abs(e.c.r)}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" />`;
          break;
        case "ellipse":
          s += `<ellipse cx="${e.c.x}" cy="${e.c.y}" rx="${Math.abs(e.rx)}" ry="${Math.abs(e.ry)}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" />`;
          break;
        case "polyline":
          s += `<polyline points="${e.points.map((p) => `${p.x},${p.y}`).join(" ")}" stroke="${stroke}" stroke-width="${sw}" fill="none" />`;
          break;
        case "polygon": {
          const pts = polygonPoints(e);
          s += `<polygon points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" />`;
          break;
        }
        case "arc":
          s += `<line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" stroke="${stroke}" stroke-width="${sw}" />`;
          break;
        case "text":
          s += `<text x="${e.p.x}" y="${e.p.y}" font-size="${e.fontSize}" fill="${stroke}" font-family="-apple-system, Segoe UI, sans-serif">${escapeXml(e.text)}</text>`;
          break;
        case "dimension": {
          const off = 16;
          const dx = e.b.x - e.a.x;
          const dy = e.b.y - e.a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len * off;
          const ny = dx / len * off;
          const a2x = e.a.x + nx;
          const a2y = e.a.y + ny;
          const b2x = e.b.x + nx;
          const b2y = e.b.y + ny;
          const wlen = dist(e.a, e.b);
          s += `<line x1="${e.a.x}" y1="${e.a.y}" x2="${a2x}" y2="${a2y}" stroke="${stroke}" stroke-width="${sw}" />`;
          s += `<line x1="${e.b.x}" y1="${e.b.y}" x2="${b2x}" y2="${b2y}" stroke="${stroke}" stroke-width="${sw}" />`;
          s += `<line x1="${a2x}" y1="${a2y}" x2="${b2x}" y2="${b2y}" stroke="${stroke}" stroke-width="${sw}" />`;
          s += `<text x="${(a2x + b2x) / 2}" y="${(a2y + b2y) / 2}" font-size="12" fill="${stroke}" text-anchor="middle" font-family="-apple-system, Segoe UI, sans-serif">${formatNumber(wlen)}</text>`;
          break;
        }
      }
    }
    s += `</svg>`;
    downloadBlob(new Blob([s], { type: "image/svg+xml" }), "drawing.svg");
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  }

  // -------- Init ---------------------------------------------------------
  function setActiveToolButton(name) {
    document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === name));
  }

  function init() {
    resizeCanvas();
    window.addEventListener("resize", () => {
      resizeCanvas();
      draw();
    });
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", () => {
      mouseDown = false;
      draw();
    });
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("contextmenu", onContextMenu);

    document.querySelectorAll(".tool").forEach((b) => {
      b.onclick = () => setTool(b.dataset.tool);
    });

    bindStyleInputs();
    newElement();
    renderLayers();
    setTool("select");
    setActiveToolButton("select");
    // seed a few entities so the canvas is not empty
    seedDemo();
    draw();
  }

  function seedDemo() {
    const layer = state.layers[0];
    state.entities.push({
      id: nextId(),
      type: "rect",
      layerId: layer.id,
      stroke: "#E1064A",
      strokeWidth: 2,
      fillEnabled: false,
      a: { x: -60, y: -40 },
      b: { x: 60, y: 40 },
    });
    state.entities.push({
      id: nextId(),
      type: "circle",
      layerId: layer.id,
      stroke: "#dc2626",
      strokeWidth: 2,
      fillEnabled: false,
      c: { x: 0, y: 0 },
      r: 30,
    });
    state.entities.push({
      id: nextId(),
      type: "line",
      layerId: layer.id,
      stroke: "#101014",
      strokeWidth: 1.5,
      fillEnabled: false,
      a: { x: -100, y: -60 },
      b: { x: 100, y: 60 },
    });
    pushHistory();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();