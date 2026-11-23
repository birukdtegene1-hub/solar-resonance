(() => {
  // node_modules/@lucasmarkes/hairline/dist/index.js
  var LIGHT = { plate: "#ffffff", hi: "#232327", edge: "#a4a4ac", mid: "#c3c3c9", lo: "#e0e0e4" };
  var DARK = { plate: "#08090a", hi: "#d0d6e0", edge: "#5b5d64", mid: "#3e3e44", lo: "#29292d" };
  var KEYS = ["plate", "hi", "edge", "mid", "lo"];
  var vars = (p) => KEYS.map((k) => `--hl-${k}:var(--hairline-${k},${p[k]});`).join("");
  var EASE = "cubic-bezier(0.5,0,0.1,1)";
  var SVG = ":where([data-hairline]>svg)";
  function css(lightDark) {
    const both = Object.fromEntries(KEYS.map((k) => [k, `light-dark(${LIGHT[k]},${DARK[k]})`]));
    return [
      // the box, and the palette: light unless something below says otherwise
      `:where([data-hairline]){display:block;position:relative;aspect-ratio:5/4;touch-action:pan-y;user-select:none;-webkit-user-select:none;--hl-sw:var(--hairline-stroke,0.9);${vars(LIGHT)}}`,
      // the page's color-scheme
      lightDark ? `:where([data-hairline]){${vars(both)}}` : "",
      // an ancestor that says dark
      `:where(.dark,[data-theme="dark"]) :where([data-hairline]){${vars(DARK)}}`,
      // the figure's own theme option
      `:where([data-hairline][data-hairline-theme="light"]){${vars(LIGHT)}}`,
      `:where([data-hairline][data-hairline-theme="dark"]){${vars(DARK)}}`,
      `:where([data-hairline]:focus-visible){outline:1.5px solid var(--hl-hi);outline-offset:2px}`,
      `${SVG}{position:absolute;inset:0;width:100%;height:100%;display:block}`,
      // Riffle's live region: read, not seen
      `:where([data-hairline]>[data-hairline-live]){position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`,
      // the drawing: plates are filled with the plate colour and painted back to front
      `${SVG} :where(path,polygon,ellipse,line){fill:var(--hl-plate);stroke:var(--hl-mid);stroke-width:var(--hl-sw);vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;transition:stroke 260ms ${EASE}}`,
      `${SVG} :where(.nf){fill:none}`,
      `${SVG} :where(.fo){stroke:none}`,
      `${SVG} :where(.sil){stroke:var(--hl-edge)}`,
      `${SVG} :where(.hi){stroke:var(--hl-hi)}`,
      `${SVG} :where(.lo){stroke:var(--hl-lo)}`,
      `${SVG} :where(.dash){stroke-dasharray:1 3}`,
      `${SVG} :where(.dot){stroke:none;fill:var(--hl-hi);transition:fill 260ms ${EASE}}`,
      `${SVG} :where(.dot.m){fill:var(--hl-edge)}`,
      `${SVG} :where(.dot.off){fill:var(--hl-lo)}`,
      `${SVG} :where(.ghost path){fill:none;stroke:var(--hl-mid)}`
    ].join("");
  }
  var done = /* @__PURE__ */ new WeakSet();
  function inject(root) {
    if (done.has(root)) return;
    done.add(root);
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const win = doc.defaultView;
    const text = css(!!win?.CSS?.supports?.("color", "light-dark(#000,#fff)"));
    if (win && "adoptedStyleSheets" in root) {
      try {
        const sheet = new win.CSSStyleSheet();
        sheet.replaceSync(text);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        return;
      } catch {
      }
    }
    const style = doc.createElement("style");
    style.setAttribute("data-hairline-style", "");
    style.textContent = text;
    (root.nodeType === 9 ? doc.head ?? doc.documentElement : root).appendChild(style);
  }
  var rad = (d) => d * Math.PI / 180;
  var r2 = (n) => Math.round(n * 100) / 100;
  var poly = (pts) => "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L") + "Z";
  var seg = (a, b) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;
  var open = (pts) => pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L");
  var Cam = (azDeg, k, S9) => ({ az: rad(azDeg), k, S: S9, ox: 0, oy: 0 });
  function proj(C) {
    const c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - C.k * C.k);
    return (x, y, z) => {
      const X = x * c - y * s, Y = x * s + y * c;
      return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)];
    };
  }
  function fit(C, pts, cx, cy) {
    C.ox = 0;
    C.oy = 0;
    const P = proj(C);
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of pts) {
      const q = P(p[0], p[1], p[2]);
      a = Math.min(a, q[0]);
      b = Math.max(b, q[0]);
      c = Math.min(c, q[1]);
      d = Math.max(d, q[1]);
    }
    C.ox = cx - (a + b) / 2;
    C.oy = cy - (c + d) / 2;
  }
  function rrect(u0, v0, u1, v1, r, n = 4) {
    r = Math.max(0, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2));
    const out = [];
    for (const [cu, cv, a0] of [[u1 - r, v1 - r, 0], [u0 + r, v1 - r, 90], [u0 + r, v0 + r, 180], [u1 - r, v0 + r, 270]])
      for (let k = 0; k <= n; k++) {
        const a = rad(a0 + 90 * k / n), ca = Math.cos(a), sa = Math.sin(a);
        out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa });
      }
    return out;
  }
  function circ(R9, n = 96) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      out.push({ u: R9 * ca, v: R9 * sa, nu: ca, nv: sa });
    }
    return out;
  }
  function hull(input) {
    const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) {
      while (lo.length > 1 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (up.length > 1 && x(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
      up.push(p);
    }
    lo.pop();
    up.pop();
    return lo.concat(up);
  }
  var ringAt = (P, ring, z) => ring.map((q) => P(q.u, q.v, z));
  var facing = (C) => {
    const s = Math.sin(C.az), c = Math.cos(C.az);
    return (q) => q.nu * s + q.nv * c >= -1e-6;
  };
  function run(ring, keep) {
    const n = ring.length;
    let s = -1;
    for (let i = 0; i < n; i++) if (keep(ring[i]) && !keep(ring[(i + n - 1) % n])) {
      s = i;
      break;
    }
    if (s < 0) return keep(ring[0]) ? ring.slice() : [];
    const out = [];
    for (let k = 0; k < n && keep(ring[(s + k) % n]); k++) out.push(ring[(s + k) % n]);
    return out;
  }
  function prism(P, front2, ring, inner3, z0, z1) {
    return {
      sil: poly(hull(ringAt(P, ring, z1).concat(ringAt(P, ring, z0)))),
      crease: inner3 ? open(ringAt(P, run(inner3, front2), z1)) : ""
    };
  }
  var rings = (x0, y0, x1, y1, r, b) => [
    rrect(x0, y0, x1, y1, r),
    rrect(x0 + b, y0 + b, x1 - b, y1 - b, Math.max(0.3, r - b))
  ];
  function fillet(pts, rs, n = 4) {
    const m = pts.length, out = [];
    for (let i = 0; i < m; i++) {
      const a = pts[(i + m - 1) % m], p = pts[i], b = pts[(i + 1) % m];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const t = Math.min(rs[i], la / 2, lb / 2);
      const p1 = [p[0] + (a[0] - p[0]) / la * t, p[1] + (a[1] - p[1]) / la * t];
      const p2 = [p[0] + (b[0] - p[0]) / lb * t, p[1] + (b[1] - p[1]) / lb * t];
      for (let k = 0; k <= n; k++) {
        const s = k / n, w = 1 - s;
        out.push([w * w * p1[0] + 2 * w * s * p[0] + s * s * p2[0], w * w * p1[1] + 2 * w * s * p[1] + s * s * p2[1]]);
      }
    }
    return out;
  }
  var reduced = false;
  var setReducedMotion = (on) => {
    reduced = on;
  };
  var reducedMotion = () => reduced;
  function spring(x, o = {}) {
    return { x, v: 0, t: x, k: o.k ?? 100, c: o.c ?? 18, m: o.m ?? 1, eps: o.eps ?? 0.01 };
  }
  function stepS(sp, dt) {
    if (reduced) {
      sp.x = sp.t;
      sp.v = 0;
      return false;
    }
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = (-sp.k * (sp.x - sp.t) - sp.c * sp.v) / sp.m;
      sp.v += a * h;
      sp.x += sp.v * h;
    }
    if (Math.abs(sp.x - sp.t) < sp.eps && Math.abs(sp.v) < sp.eps * 10) {
      sp.x = sp.t;
      sp.v = 0;
      return false;
    }
    return true;
  }
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax2 = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (u) => ((ax2 * u + bx) * u + cx) * u;
    const Y = (u) => ((ay * u + by) * u + cy) * u;
    const dX = (u) => (3 * ax2 * u + 2 * bx) * u + cx;
    return (t) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let u = t;
      for (let i = 0; i < 8; i++) {
        const e = X(u) - t;
        if (Math.abs(e) < 1e-5) break;
        const d = dX(u);
        if (Math.abs(d) < 1e-6) break;
        u -= e / d;
      }
      if (!(u >= 0 && u <= 1) || Math.abs(X(u) - t) > 1e-4) {
        let lo = 0, hi = 1;
        u = t;
        for (let i = 0; i < 24; i++) {
          if (X(u) < t) lo = u;
          else hi = u;
          u = (lo + hi) / 2;
        }
      }
      return Y(u);
    };
  }
  var EASE_LIFT = bezier(0.32, 0.72, 0, 1);
  var NS = "http://www.w3.org/2000/svg";
  function mk(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function solid(parent) {
    const g = mk("g", {}, parent);
    return { g, sil: mk("path", { class: "sil" }, g), cr: mk("path", { class: "nf lo" }, g) };
  }
  var put = (el, s) => {
    el.sil.setAttribute("d", s.sil);
    el.cr.setAttribute("d", s.crease);
  };
  var flatDot = (parent, C, r, cls) => mk("ellipse", { rx: r2(r * C.S), ry: r2(r * C.S * C.k), class: cls }, parent);
  var place = (el, q) => {
    el.setAttribute("cx", String(r2(q[0])));
    el.setAttribute("cy", String(r2(q[1])));
  };
  var boards = [];
  var byStage = /* @__PURE__ */ new Map();
  var raf = 0;
  var last = 0;
  var io = null;
  var rm = null;
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1e3));
    last = now;
    let any = false;
    for (const b of boards.slice()) if (b.vis && b.awake) {
      try {
        b.awake = !!b.tick(dt, now);
      } catch (err) {
        b.awake = false;
        setTimeout(() => {
          throw err;
        });
      }
      any = any || b.awake;
    }
    raf = any ? requestAnimationFrame(frame) : 0;
  }
  function wake(b) {
    b.awake = true;
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  var onMotion = () => {
    setReducedMotion(!!rm?.matches);
    boards.forEach(wake);
  };
  function start() {
    if (io) return;
    io = new IntersectionObserver((es) => {
      for (const e of es) {
        const set = byStage.get(e.target);
        if (!set) continue;
        for (const b of set) {
          b.vis = e.isIntersecting;
          if (b.vis) wake(b);
        }
      }
    }, { rootMargin: "80px" });
    rm = matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(rm.matches);
    rm.addEventListener("change", onMotion);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    io?.disconnect();
    io = null;
    rm?.removeEventListener("change", onMotion);
    rm = null;
  }
  function register(stage, tick) {
    start();
    const b = { stage, tick, vis: false, awake: true };
    boards.push(b);
    const peers = byStage.get(stage);
    if (peers) {
      for (const p of peers) b.vis = p.vis;
      peers.add(b);
      if (b.vis) wake(b);
    } else {
      byStage.set(stage, /* @__PURE__ */ new Set([b]));
      io.observe(stage);
    }
    tick(0, performance.now());
    let gone = false;
    return {
      wake: () => {
        if (!gone) wake(b);
      },
      unregister: () => {
        if (gone) return;
        gone = true;
        boards = boards.filter((x) => x !== b);
        const set = byStage.get(stage);
        if (set) {
          set.delete(b);
          if (!set.size) {
            byStage.delete(stage);
            io?.unobserve(stage);
          }
        }
        if (!boards.length) stop();
      }
    };
  }
  var handlers = /* @__PURE__ */ new WeakMap();
  var touring = /* @__PURE__ */ new WeakMap();
  function pointer(stage, on) {
    handlers.set(stage, on);
    let tm = 0;
    const pt = (e) => {
      const r = stage.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * 400, (e.clientY - r.top) / r.height * 320];
    };
    const move = (e) => {
      clearTimeout(tm);
      touring.get(stage)?.hold();
      on.move(pt(e), e);
    };
    const down = (e) => {
      clearTimeout(tm);
      touring.get(stage)?.hold();
      if (e.pointerType !== "mouse") stage.releasePointerCapture?.(e.pointerId);
      if (on.down) on.down(pt(e), e);
      else on.move(pt(e), e);
    };
    const leave = (e) => {
      clearTimeout(tm);
      tm = window.setTimeout(() => {
        on.leave(e);
        touring.get(stage)?.release();
      }, e.pointerType === "mouse" ? 0 : 1400);
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointerleave", leave);
    return () => {
      clearTimeout(tm);
      if (handlers.get(stage) === on) handlers.delete(stage);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointerleave", leave);
    };
  }
  var LAP = [[128, 150], [200, 118], [272, 150], [200, 206], null];
  var TRAVEL = 900;
  var DWELL = 1200;
  var REST = 1800;
  var RESUME = 1200;
  var STAGGER = 450;
  var GHOST = { pointerType: "ghost" };
  var started = 0;
  function entry([x, y]) {
    const dx = x - 200, dy = y - 160;
    if (!dx && !dy) return [200, 320];
    const k = Math.min(dx ? (dx > 0 ? 200 : -200) / dx : Infinity, dy ? (dy > 0 ? 160 : -160) / dy : Infinity);
    return [200 + dx * k, 160 + dy * k];
  }
  function tour(stage, stops, onStop) {
    let i = 0;
    let wait = RESUME + STAGGER * (started++ % 4);
    let t = -1;
    let at2 = null;
    let origin = [200, 320];
    let hand = false, keys2 = stage.contains(stage.ownerDocument.activeElement);
    let gone = false;
    const leave = () => {
      at2 = null;
      t = -1;
      handlers.get(stage)?.leave(GHOST);
    };
    const tick = (dt) => {
      if (hand || keys2 || !stops.length) return false;
      if (reducedMotion()) {
        if (at2) leave();
        return false;
      }
      if (wait > 0) {
        wait -= dt * 1e3;
        return true;
      }
      const stop2 = stops[i];
      if (stop2 === null) {
        if (at2) leave();
        onStop?.(i);
        i = (i + 1) % stops.length;
        wait = REST;
        return true;
      }
      const h = handlers.get(stage);
      if (!h) return true;
      if (t < 0) {
        origin = at2 ?? entry(stop2);
        t = 0;
      }
      t = Math.min(TRAVEL, t + dt * 1e3);
      const k = EASE_LIFT(t / TRAVEL);
      at2 = [origin[0] + (stop2[0] - origin[0]) * k, origin[1] + (stop2[1] - origin[1]) * k];
      h.move(at2, GHOST);
      if (t < TRAVEL) return true;
      onStop?.(i);
      i = (i + 1) % stops.length;
      t = -1;
      wait = DWELL;
      return true;
    };
    const take = () => {
      at2 = null;
      t = -1;
    };
    const give = () => {
      if (hand || keys2) return;
      i = 0;
      t = -1;
      wait = RESUME;
      board.wake();
    };
    const me = {
      hold: () => {
        hand = true;
        take();
      },
      release: () => {
        if (!hand) return;
        hand = false;
        give();
      }
    };
    const focusIn = () => {
      keys2 = true;
      take();
    };
    const focusOut = (e) => {
      if (keys2 && !stage.contains(e.relatedTarget)) {
        keys2 = false;
        give();
      }
    };
    stage.addEventListener("focusin", focusIn);
    stage.addEventListener("focusout", focusOut);
    touring.set(stage, me);
    const board = register(stage, tick);
    return {
      stop: () => {
        if (gone) return;
        gone = true;
        board.unregister();
        stage.removeEventListener("focusin", focusIn);
        stage.removeEventListener("focusout", focusOut);
        if (touring.get(stage) === me) touring.delete(stage);
        if (at2) leave();
      }
    };
  }
  function disposer() {
    let fns = [];
    return {
      add: (fn) => {
        fns.push(fn);
      },
      on: (target2, type, fn, opts) => {
        const h = fn;
        target2.addEventListener(type, h, opts);
        fns.push(() => target2.removeEventListener(type, h, opts));
      },
      dispose: () => {
        const run2 = fns;
        fns = [];
        for (let i = run2.length - 1; i >= 0; i--) run2[i]();
      }
    };
  }
  var TABLE = {
    riffle: [0, 40, 90],
    // stagger, ms
    terrain: [1.5, 3, 5],
    // radius, cells
    exploded: [12, 28, 40],
    // gap, viewBox units
    phosphor: [150, 520, 1500],
    // afterglow, ms
    slow: [0.6, 0.2, 0.05],
    // rate, × normal speed
    turntable: [200, 650, 1500],
    // coast, ms
    keyboard: [1, 2, 3.5],
    // radius, keys
    elevator: [40, 100, 220],
    // stiffness, spring units
    phone: [16, 28, 40],
    // gap, viewBox units
    laptop: [100, 125, 150],
    // lid, degrees
    terminal: [1, 2, 3.5],
    // spread, lines
    cabinet: [1.5, 3, 5],
    // reach, blades
    branches: [1, 3, 6],
    // reach, commits
    vault: [250, 600, 1500],
    // coast, ms
    lockers: [55, 90, 120],
    // opening, degrees
    padlock: [45, 90, 100],
    // swing, degrees
    patch: [1, 2.5, 5],
    // radius, ports
    dish: [30, 50, 70],
    // reach, degrees
    router: [0.5, 1.5, 3],
    // spread, antennas
    loupe: [1.3, 1.8, 2.6],
    // magnification, ×
    sieve: [6, 14, 24],
    // gap, viewBox units
    rail: [1, 2, 3.5],
    // radius, hangers
    plug: [0.35, 0.6, 0.9],
    // pull, fraction of the way to the socket
    query: [20, 40, 55],
    // turn, degrees; past 55 the hook folds over itself and stops reading as one
    drawer: [12, 22, 34],
    // pull, viewBox units
    basket: [8, 16, 28],
    // tilt, degrees
    plot: [3, 6, 12],
    // lift, viewBox units
    hub: [10, 16, 24],
    // rise, viewBox units
    relay: [40, 120, 220],
    // delay, ms per hop
    settle: [90, 120, 150],
    // reach, viewBox units from the hub
    format: [9, 12, 14],
    // disorder, degrees of the worst skew
    rebuild: [8, 14, 20],
    // rise, viewBox units
    stack: [22, 34, 46]
    // lift, viewBox units
  };
  var DEFAULT = 0.5;
  function intensity(value) {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT;
    return Math.min(1, Math.max(0, n));
  }
  function parameter(figure, value) {
    const [lo, mid, hi] = TABLE[figure];
    const i = intensity(value);
    const v = i <= 0.5 ? lo + i / 0.5 * (mid - lo) : mid + (i - 0.5) / 0.5 * (hi - mid);
    return Math.round(v * 1e3) / 1e3;
  }
  var NS2 = "http://www.w3.org/2000/svg";
  var mounted = /* @__PURE__ */ new WeakMap();
  var report = (err) => {
    if (typeof reportError === "function") reportError(err);
    else setTimeout(() => {
      throw err;
    });
  };
  function create(spec, el, options) {
    if (typeof document === "undefined") {
      throw new Error(`hairline: ${spec.id}() needs a DOM. Call it in the browser, once the element exists: in an effect, in onMount, or in a script after the element.`);
    }
    if (!el || el.nodeType !== 1) {
      throw new TypeError(`hairline: ${spec.id}() takes an element as its first argument, and got ${el === null ? "null" : typeof el}.`);
    }
    mounted.get(el)?.();
    const opts = { ...options };
    const doc = el.ownerDocument;
    const root = el.getRootNode();
    inject(root.nodeType === 9 || "host" in root ? root : doc);
    const owned = /* @__PURE__ */ new Set();
    const attr = (name, value2) => {
      if (!owned.has(name) && el.hasAttribute(name)) return;
      if (value2 === null) {
        el.removeAttribute(name);
        owned.delete(name);
      } else {
        el.setAttribute(name, value2);
        owned.add(name);
      }
    };
    const dress = () => {
      attr("data-hairline-theme", opts.theme === "light" || opts.theme === "dark" ? opts.theme : null);
      attr("aria-label", el.hasAttribute("aria-labelledby") ? null : typeof opts.label === "string" ? opts.label : spec.label);
    };
    attr("data-hairline", spec.id);
    attr("role", spec.focusable ? "group" : "img");
    if (spec.focusable) attr("tabindex", "0");
    dress();
    const svg2 = doc.createElementNS(NS2, "svg");
    svg2.setAttribute("viewBox", "0 0 400 320");
    svg2.setAttribute("aria-hidden", "true");
    el.appendChild(svg2);
    let live = null;
    if (spec.focusable) {
      live = doc.createElement("span");
      live.setAttribute("data-hairline-live", "");
      live.setAttribute("aria-live", "polite");
      el.appendChild(live);
    }
    let text = null;
    let playing = null;
    const read = {
      get textContent() {
        return text;
      },
      set textContent(value2) {
        const next = value2 ?? "";
        if (next === text) return;
        text = next;
        if (live && live.textContent !== next && (!playing || next === spec.rest || el.matches(":hover, :focus-within"))) live.textContent = next;
        const fn = opts.onRead;
        if (typeof fn === "function") try {
          fn(next);
        } catch (err) {
          report(err);
        }
      }
    };
    let value = parameter(spec.id, opts.intensity);
    playing = opts.play === true ? tour(el, spec.tour ?? LAP) : null;
    let engine;
    try {
      engine = spec.engine({ stage: el, svg: svg2, read }, value);
    } catch (err) {
      playing?.stop();
      throw err;
    }
    if (text === null) read.textContent = spec.rest;
    let dead = false;
    const destroy = () => {
      if (dead) return;
      dead = true;
      if (mounted.get(el) === destroy) mounted.delete(el);
      playing?.stop();
      playing = null;
      engine.destroy();
      svg2.remove();
      live?.remove();
      for (const name of owned) el.removeAttribute(name);
      owned.clear();
    };
    mounted.set(el, destroy);
    return {
      update(next) {
        if (dead || !next) return;
        const own = opts, given = next;
        for (const k in given) {
          if (given[k] === void 0) delete own[k];
          else own[k] = given[k];
        }
        const v = parameter(spec.id, opts.intensity);
        if (v !== value) {
          value = v;
          engine.set(v);
        }
        const play = opts.play === true;
        if (play !== !!playing) {
          playing?.stop();
          playing = play ? tour(el, spec.tour ?? LAP) : null;
        }
        dress();
      },
      destroy
    };
  }
  var HH = 30;
  var GRIP = 9;
  var GRIPS = [[-GRIP, HH], [GRIP, HH]];
  var D = 30;
  var FY = 58;
  var RT2 = 2.6;
  var PH = 2.4;
  var CH = 6;
  var BX1 = 7 * D + 15;
  var BY1 = FY + 14;
  var ZTOP = RT2 + PH + CH;
  var N2 = 12;
  var U = 10.4;
  var BH = 9.6;
  var W = 84;
  var X1 = W + 10;
  var ZB = 11;
  var ZT = ZB + (N2 - 1) * U + BH;
  var H2 = ZT + 6;
  var R = 26;
  var FOC = 17;
  var SK = 1.4;
  var DEP = R * R / (4 * FOC);
  var ZE = 46;
  var W2 = 31;
  var T = 5;
  var ZB2 = 10;
  var ZY = 16;
  var AZ0 = 45;
  var EL0 = 40;
  var REST3 = [-20, 30];
  var PIV = [0, 0, ZE];
  var ax = (p, q, s) => [p[0] + q[0] * s, p[1] + q[1] * s, p[2] + q[2] * s];
  var dot3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  function frame2(th, ph) {
    const t = rad(th), f = rad(ph), c = Math.cos(f), s = Math.sin(f);
    const h = [Math.cos(t), Math.sin(t), 0], e = [-Math.sin(t), Math.cos(t), 0];
    return { th, h, e, a: [h[0] * c, h[1] * c, s], u: [-h[0] * s, -h[1] * s, c] };
  }
  var onDish = (F2, along2, rho, psi) => ax(ax(ax(PIV, F2.a, along2), F2.e, rho * Math.cos(psi)), F2.u, rho * Math.sin(psi));
  var disc = (c, x, y, r, n) => Array.from({ length: n }, (_, i) => ax(ax(c, x, r * Math.cos(2 * Math.PI * i / n)), y, r * Math.sin(2 * Math.PI * i / n)));
  var turn = (ring, F2) => ring.map((q) => ({
    u: q.u * F2.h[0] + q.v * F2.e[0],
    v: q.u * F2.h[1] + q.v * F2.e[1],
    nu: q.nu * F2.h[0] + q.nv * F2.e[0],
    nv: q.nu * F2.h[1] + q.nv * F2.e[1]
  }));
  var mount4 = ({ stage, svg: svg2, read }, value) => {
    const bag = disposer();
    let reach = value, over = null;
    const C = Cam(45, 0.5, 2.5), pts = [[-30, -30, 0], [30, 30, 0], [30, -30, 0], [-30, 30, 0]];
    for (const [th, ph] of [[-25, 5], [-25, 75], [115, 5], [115, 75], REST3]) {
      const F2 = frame2(th, ph);
      pts.push(...disc(PIV, F2.e, F2.u, R, 16), onDish(F2, FOC - DEP + 3, 0, 0));
      for (const s of [-1, 1]) pts.push(ax(ax(PIV, F2.e, s * (W2 + T / 2)), [0, 0, 1], 6));
    }
    fit(C, pts, 200, 166);
    const P = proj(C), front2 = facing(C), Pv = (q) => P(q[0], q[1], q[2]);
    const o = P(0, 0, 0), cx = P(1, 0, 0), cy = P(0, 1, 0), cz = P(0, 0, 1);
    const r1 = [cx[0] - o[0], cy[0] - o[0], cz[0] - o[0]], r22 = [cx[1] - o[1], cy[1] - o[1], cz[1] - o[1]];
    const cross3 = [r1[1] * r22[2] - r1[2] * r22[1], r1[2] * r22[0] - r1[0] * r22[2], r1[0] * r22[1] - r1[1] * r22[0]];
    const vl = Math.hypot(...cross3) * Math.sign(cross3[2]);
    const VD = cross3.map((x) => x / vl);
    const g = mk("g", {}, svg2);
    const [br, bi] = rings(-30, -30, 30, 30, 9, 2);
    put(solid(g), prism(P, front2, br, bi, 0, 5));
    for (let i = 0; i < 36; i++) {
      const t = i / 36 * 2 * Math.PI, r = i % 9 === 0 ? 26.5 : 25.5;
      place(flatDot(g, C, i % 9 === 0 ? 0.75 : 0.5, "dot off"), P(r * Math.cos(t), r * Math.sin(t), 5));
    }
    put(solid(g), prism(P, front2, circ(20, 48), circ(18.8, 48), 5, ZB2));
    const index = flatDot(g, C, 0.8, "dot m");
    const beam = solid(g);
    const yb = W2 + T / 2 + 1, [bmr, bmi] = rings(-9, -yb, 9, yb, 4, 1.4);
    const dishG = mk("g", {}, g);
    const sides = [-1, 1].map((s) => {
      const sg = mk("g", {}, g);
      return {
        s,
        g: sg,
        near: null,
        ring: mk("path", { class: "nf" }, sg),
        arm: solid(sg),
        trun: mk("path", { class: "sil" }, sg),
        foot: rrect(-8, s * W2 - T / 2, 8, s * W2 + T / 2, 2.5, 4),
        top: rrect(-5.5, s * W2 - T / 2, 5.5, s * W2 + T / 2, 2.5, 4),
        inner: rrect(-4.5, s * W2 - T / 2 + 1, 4.5, s * W2 + T / 2 - 1, 1.5, 4)
      };
    });
    const outline = mk("path", { class: "sil" }, dishG), seam = mk("path", { class: "nf lo" }, dishG), hubR = mk("path", { class: "nf lo" }, dishG);
    const rim2 = mk("path", { class: "nf hi" }, dishG), struts = mk("path", { class: "nf" }, dishG);
    const feed = solid(dishG);
    const BACK2 = [0, 0.35, 0.6, 0.78, 0.9, 0.97, 1];
    function seen(F2, rho, n) {
      const along2 = rho * rho / (4 * FOC) - DEP, t = -along2 / dot3(F2.a, VD), q = [], s = [];
      for (let i2 = 0; i2 < n; i2++) {
        q.push(onDish(F2, along2, rho, 2 * Math.PI * i2 / n));
        const hit = ax(q[i2], VD, t);
        s.push(R - Math.hypot(hit[0] - PIV[0], hit[1] - PIV[1], hit[2] - PIV[2]));
      }
      if (s.every((x) => x > 0)) return poly(q.map(Pv));
      const i0 = s.findIndex((x, i2) => x > 0 && s[(i2 + n - 1) % n] <= 0);
      if (i0 < 0) return "";
      const cut2 = (i2, j) => Pv(ax(q[i2], [q[j][0] - q[i2][0], q[j][1] - q[i2][1], q[j][2] - q[i2][2]], s[i2] / (s[i2] - s[j])));
      const out = [cut2((i0 + n - 1) % n, i0)];
      let i = i0;
      while (s[i] > 0) {
        out.push(Pv(q[i]));
        i = (i + 1) % n;
      }
      out.push(cut2((i + n - 1) % n, i));
      return open(out);
    }
    let drawn = "";
    function draw(th, ph) {
      const key = th.toFixed(3) + "," + ph.toFixed(3);
      if (key === drawn) return;
      drawn = key;
      const F2 = frame2(th, ph);
      place(index, P(18 * F2.h[0], 18 * F2.h[1], ZB2));
      put(beam, prism(P, front2, turn(bmr, F2), turn(bmi, F2), ZB2, ZY));
      for (const sd of sides) {
        const near = sd.s * dot3(F2.e, VD) > 0;
        if (near !== sd.near) {
          sd.near = near;
          if (near) {
            sd.g.append(sd.trun, sd.arm.g, sd.ring);
            dishG.after(sd.g);
          } else {
            sd.g.append(sd.ring, sd.arm.g, sd.trun);
            dishG.before(sd.g);
          }
        }
        put(sd.arm, {
          sil: poly(hull(ringAt(P, turn(sd.foot, F2), ZY).concat(ringAt(P, turn(sd.top, F2), ZE + 6)))),
          crease: open(ringAt(P, run(turn(sd.inner, F2), front2), ZE + 6))
        });
        const zz = [0, 0, 1], out = ax(PIV, F2.e, sd.s * (W2 + T / 2));
        sd.ring.setAttribute("d", poly(disc(out, F2.h, zz, 3.4, 24).map(Pv)));
        sd.trun.setAttribute("d", poly(hull(disc(ax(PIV, F2.e, sd.s * R), F2.h, zz, 2.2, 16).concat(disc(ax(PIV, F2.e, sd.s * (W2 - T / 2)), F2.h, zz, 2.2, 16)).map(Pv))));
      }
      const lip = disc(PIV, F2.e, F2.u, R, 72), back = [];
      for (const f of BACK2) for (let i = 0; i < 40; i++) back.push(onDish(F2, f * f * R * R / (4 * FOC) - DEP - SK, f * R, 2 * Math.PI * i / 40));
      outline.setAttribute("d", poly(hull(lip.concat(back).map(Pv))));
      seam.setAttribute("d", seen(F2, 0.62 * R, 48));
      hubR.setAttribute("d", seen(F2, 3.2, 20));
      rim2.setAttribute("d", poly(lip.map(Pv)));
      const mouth = onDish(F2, FOC - DEP - 3, 0, 0), tail = onDish(F2, FOC - DEP + 3, 0, 0);
      struts.setAttribute("d", [90, 210, 330].map((d) => seg(Pv(onDish(F2, 0, R, rad(d))), Pv(mouth))).join(""));
      put(feed, {
        sil: poly(hull(disc(mouth, F2.e, F2.u, 3.6, 16).concat(disc(tail, F2.e, F2.u, 2.4, 16)).map(Pv))),
        crease: poly(disc(tail, F2.e, F2.u, 1.3, 16).map(Pv))
      });
    }
    const az = spring(REST3[0], { eps: 0.01 }), el = spring(REST3[1], { eps: 0.01 });
    const B6 = register(stage, (dt) => {
      const a = stepS(az, dt), b = stepS(el, dt);
      draw(az.x, el.x);
      return a || b;
    });
    bag.add(B6.unregister);
    const hub2 = P(0, 0, ZE);
    function retarget() {
      if (over) {
        az.t = AZ0 - reach * Math.tanh((over[0] - hub2[0]) / 120);
        el.t = EL0 + reach / 2 * Math.tanh((hub2[1] - over[1]) / 90);
        read.textContent = `az ${Math.round((az.t + 360) % 360)} \xB7 el ${Math.round(el.t)}`;
      } else {
        az.t = REST3[0];
        el.t = REST3[1];
        read.textContent = "rest";
      }
      B6.wake();
    }
    bag.add(pointer(stage, {
      move: (p) => {
        over = p;
        retarget();
      },
      leave: () => {
        over = null;
        retarget();
      }
    }));
    bag.add(() => svg2.replaceChildren());
    return {
      set: (v) => {
        reach = v;
        if (over) retarget();
      },
      destroy: bag.dispose
    };
  };
  var N3 = 3;
  var Z02 = 5;
  var M = 3;
  var PITCH = 26;
  var ZB3 = Z02 + M;
  var H3 = ZB3 + N3 * PITCH + M;
  var SY = 34;
  var FH = 36;
  var CH2 = 25;
  var TOP = 3 * FH + CH2 + 7;
  var RX = 16.5;
  var CW = [-8, 11, -2, 23];
  var BASE = fillet([[-16, -2], [33, -2], [33, -56], [76, -56], [76, 38], [-16, 38]], [3, 2, 4, 6, 6, 6]);
  var FLOOR = fillet([[33, -56], [72, -56], [72, -6], [43, -6], [43, 34], [33, 34]], [4, 4, 4, 3, 3, 3]);
  var CWX = (CW[0] + CW[2]) / 2;
  var SR = (RX - CWX) / 2;
  var SC = [CWX + SR, SY / 2, TOP + 3 + SR + 2];
  var REST_Z = 1.5 * FH - 4;
  var G2 = 12;
  var WD = 5.5;
  var BY12 = 9 * G2 + WD + 8;
  var LINES = [
    [0, 56, 0.3, -8, -2, 0],
    [1, 40, 0.75, 8, -1.9, 0],
    [1, 58, 0.3, -8, -0.8, 0],
    [2, 74, 1, -8, -1.9, 0],
    [2, 48, 1, 8, 1.3, 0],
    [1, 34, 0.3, 8, 2, 0],
    [1, 66, 1, -8, -2, 0],
    [2, 52, 1, -8, -0.8, 0],
    [1, 30, 0.45, 8, 2, 0],
    [0, 22, 1, -8, 1.6, 0]
  ];
  var N4 = LINES.length;
  var L = (s) => s.split(" ").map((c) => [1, "key " + c]);
  var ROWS = [
    [[1, "esc"], ...L("1 2 3 4 5 6 7 8 9 0 - ="), [2, "bksp"]],
    [[1.5, "tab"], ...L("q w e r t y u i o p [ ]"), [1.5, "key \\"]],
    [[1.75, "caps"], ...L("a s d f g h j k l ; '"), [2.25, "enter"]],
    [[2.25, "shift l"], ...L("z x c v b n m , . /"), [2.75, "shift r"]],
    [[1.5, "ctrl l"], [1, "super"], [1.5, "alt l"], [7, "space"], [1.5, "alt r"], [1, "fn"], [1.5, "ctrl r"]]
  ];
  var HB = 4;
  var T6 = 2.4;
  var HZ = HB + T6 / 2;
  var COLS = 6;
  var ROWS2 = 2;
  var W6 = 24;
  var HR2 = 38;
  var GAP = 1.2;
  var FM = 3;
  var BW = COLS * W6 + 2 * FM;
  var BH2 = ROWS2 * HR2 + 2 * FM;
  var DW = W6 - 2 * GAP;
  var DH = HR2 - 2 * GAP;
  var OUTLINE = rrect(0, 0, DW, DH, 1.8, 4);
  var VENTS = [0, 1, 2].map((k) => rrect(4, DH - 6.6 - k * 3.2, DW - 4, DH - 5.2 - k * 3.2, 0.7, 2));
  var PLATE = rrect(DW / 2 - 4.5, DH - 19, DW / 2 + 4.5, DH - 15, 1, 3);
  var CUP = rrect(DW - 5.6, DH / 2 - 7, DW - 2.8, DH / 2 + 2, 1.2, 3);
  var FRAME = rrect(2.6, 2.6, DW - 2.6, DH - 2.6, 1.4, 3);
  var ML = 26;
  var R3 = 27;
  var GLASS = R3 - 1.4;
  var REST7 = [ML + 9, 46];
  var D7 = 20;
  var YC = D7 / 2;
  var VX = Math.SQRT1_2 * Math.sqrt(3);
  var NC = 12;
  var PITCH2 = 15;
  var GAP2 = 8;
  var EAR2 = 15;
  var MAR = 5;
  var X03 = EAR2 + MAR;
  var W8 = 2 * X03 + NC * PITCH2 + GAP2;
  var W9 = 68;
  var L2 = 140;
  var TG = 2;
  var TB = 1.6;
  var TC = 1.8;
  var TBAT = 7;
  var TS = 6;
  var TBUMP = 2.2;
  var TL = 0.9;
  var STACK = TG + TB + TC + TBAT + TS + TBUMP + TL;
  var BOARD = [[4, L2 - 44], [W9 - 4, L2 - 44], [W9 - 4, L2 - 5], [36, L2 - 5], [36, L2 - 30], [4, L2 - 30]];
  var BAT = [9, 12, W9 - 9, L2 - 48];
  var CHIPS = [
    [10, L2 - 41, 26, L2 - 34, 1.4],
    [45, L2 - 40, 54, L2 - 35, 1.2],
    [57, L2 - 42, 62, L2 - 36, 1.2],
    [42, L2 - 27, 56, L2 - 13, 1.8]
  ];
  var RECT = [[0, 0], [W9, 0], [W9, L2], [0, L2]];
  var FOOT2 = [RECT, BOARD, [[BAT[0], BAT[1]], [BAT[2], BAT[1]], [BAT[2], BAT[3]], [BAT[0], BAT[3]]], RECT];
  var N5 = 7;
  var PITCH3 = 10;
  var M2 = 8;
  var EXT = M2 * 2 + PITCH3 * (N5 - 1);
  var N6 = 7;
  var X04 = 13;
  var DX = 10;
  var L3 = 2 * X04 + (N6 - 1) * DX;
  var HP = 34;
  var ARC = 5;
  var FACE = /* @__PURE__ */ fillet([[L3 - 2, 0], [L3 - 2, HP], [2, HP], [2, 0]], [0.6, 4, 4, 0.6], ARC);
  var EDGE = [ARC, 3 * (ARC + 1)];
  var LIGHT2 = [-Math.SQRT1_2, -Math.SQRT1_2];
  var N8 = 8;
  var W10 = 84;
  var G3 = 13;
  var X12 = W10 + 5;
  var Y1 = (N8 - 1) * G3 + 9;
  var R12 = 2.1;
  var STOP = R12 + 1;
  var D9 = [Math.SQRT1_2, -Math.SQRT1_2];
  var L6 = 210;
  var NC2 = 6;
  var SPEED = 1 / 9;
  var GATE = L6 * 0.62;
  var RISE2 = L6 / NC2 / 2;
  var FALL3 = RISE2 / 2;
  var N11 = 24;
  var V = 7;
  var G4 = 11;
  var TB2 = 17;
  var PB3 = 17;
  var VA = PB3 + V * G4;
  var H9 = VA + TB2;
  var REST_TOP = N11 - V - 2.6;
  var N12 = 9;
  var CELL = 14;
  var EXT2 = N12 * CELL;
  var R8 = 40;
  var HX = -R8 - 8;
  var V2 = [Math.SQRT1_2 * Math.sqrt(0.75), Math.SQRT1_2 * Math.sqrt(0.75), 0.5];
  function dish(el, options) {
    return create({
      id: "dish",
      label: "A parabolic dish on a two-axis gimbal: the pointer aims it, and it follows on a spring.",
      rest: "rest",
      engine: mount4
    }, el, options);
  }

  // receiver.mjs
  var host = document.querySelector("#receiver");
  var target = document.querySelector("#receiver-gl");
  var dateReadout = document.querySelector("#receiver-readout");
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  var receiver = dish(host, {
    theme: "dark",
    label: "Steerable illustration showing detected sunspots on a receiver dish"
  });
  var svg = host.querySelector("svg");
  var rim = svg.querySelector("path.nf.hi");
  var ns = "http://www.w3.org/2000/svg";
  var aperture = document.createElementNS(ns, "g");
  aperture.setAttribute("class", "solar-aperture");
  var markings = document.createElementNS(ns, "path");
  markings.setAttribute("d", "M-.92 0H.92 M0 -.92V.92 M-.69 0a.69 .69 0 1 0 1.38 0a.69 .69 0 1 0 -1.38 0 M-.32 0a.32 .32 0 1 0 .64 0a.32 .32 0 1 0 -.64 0");
  var detections = document.createElementNS(ns, "g");
  aperture.append(markings, detections);
  if (rim) rim.after(aperture);
  var spots = null;
  var projection;
  var tracking = false;
  var visible = false;
  var pending = 0;
  var palette = { fill: "#1e1e1b", bright: "#f5e9d5", edge: "#bdb5a6", mid: "#898479", dim: "#5e5a51", spot: "#f58a68" };
  function contours(data) {
    return (data.match(/M[^M]+/g) || []).map((path) => {
      const values = (path.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const points = [];
      for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]);
      return { points, closed: path.endsWith("Z") };
    });
  }
  function alignAperture() {
    const points = contours(rim?.getAttribute("d") || "")[0]?.points;
    if (!points?.length || points.length % 4) return;
    const first = points[0], quarter = points[points.length / 4], opposite = points[points.length / 2];
    const x = (first[0] + opposite[0]) / 2, y = (first[1] + opposite[1]) / 2;
    projection = [first[0] - x, first[1] - y, quarter[0] - x, quarter[1] - y, x, y];
    aperture.setAttribute("transform", `matrix(${projection.join(" ")})`);
  }
  var paint = SolarVisuals.surface(target, ({ polygon, line, dot }) => {
    for (const node of svg.querySelectorAll("path,ellipse,.solar-aperture")) {
      if (node === aperture) {
        if (!projection || !spots) continue;
        const [a, b, c, d, px, py] = projection;
        const place2 = ([x, y]) => [px + a * x + c * y, py + b * x + d * y];
        for (const ring of [0.32, 0.69]) line(SolarVisuals.ellipse(0, 0, ring, ring, 48).map(place2), 0.7, palette.mid, true);
        line([[-0.92, 0], [0.92, 0]].map(place2), 0.7, palette.mid);
        line([[0, -0.92], [0, 0.92]].map(place2), 0.7, palette.mid);
        for (const [x, y, area] of spots) {
          const radius = Math.min(0.085, 0.03 + Math.sqrt(area) * 3e-3);
          polygon(SolarVisuals.ellipse(x, -y, radius).map(place2), palette.spot);
        }
      } else if (!aperture.contains(node)) {
        const classes = node.classList;
        if (node.localName === "ellipse") {
          const [cx, cy, rx, ry] = ["cx", "cy", "rx", "ry"].map((key) => Number(node.getAttribute(key)));
          dot(cx, cy, rx, classes.contains("off") ? palette.dim : palette.edge, ry);
        } else {
          const shade = classes.contains("hi") ? palette.bright : classes.contains("sil") ? palette.edge : classes.contains("lo") ? palette.dim : palette.mid;
          for (const { points, closed } of contours(node.getAttribute("d") || "")) {
            if (closed && !classes.contains("nf")) polygon(points, palette.fill);
            line(points, 1.05, shade, closed);
          }
        }
      }
    }
  }, { fallback: false, viewport: [400, 320] });
  function refresh() {
    if (!visible || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      alignAperture();
      paint();
    });
  }
  var geometryChanges = new MutationObserver(refresh);
  geometryChanges.observe(svg, { subtree: true, childList: true, attributes: true, attributeFilter: ["d", "cx", "cy"] });
  new IntersectionObserver(([entry2]) => {
    visible = entry2.isIntersecting;
    refresh();
  }).observe(host);
  var aimX = 0.5;
  var aimY = 0.5;
  host.addEventListener("keydown", (event) => {
    const delta = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    aimX = Math.min(1, Math.max(0, aimX + delta[0]));
    aimY = Math.min(1, Math.max(0, aimY + delta[1]));
    const rect = host.getBoundingClientRect();
    host.dispatchEvent(new PointerEvent("pointermove", {
      pointerType: "mouse",
      clientX: rect.left + rect.width * aimX,
      clientY: rect.top + rect.height * aimY
    }));
  });
  host.addEventListener("blur", () => {
    aimX = 0.5;
    aimY = 0.5;
    host.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
  });
  window.SolarReceiver = {
    observe(row) {
      spots = row.spots ?? null;
      host.classList.toggle("no-frame", !spots);
      detections.replaceChildren(...(spots || []).map(([x, y, area]) => {
        const spot = document.createElementNS(ns, "circle");
        spot.setAttribute("cx", x);
        spot.setAttribute("cy", -y);
        spot.setAttribute("r", Math.min(0.085, 0.03 + Math.sqrt(area) * 3e-3));
        return spot;
      }));
      dateReadout.textContent = spots ? `${spots.length} detected ${spots.length === 1 ? "feature" : "features"}` : "No observation";
      receiver.update({ intensity: 0.3 + Math.min(0.7, Math.sqrt((spots?.length || 0) / 30)), play: tracking && Boolean(spots) && !reduceMotion.matches });
      refresh();
    },
    track(active) {
      tracking = active;
      receiver.update({ play: active && Boolean(spots) && !reduceMotion.matches });
    }
  };
})();
