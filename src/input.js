// Input: hold to charge (Space, left click, the Flop button), turn with the mouse (locked in races), A/D or arrows, or
// a drag anywhere on a touch screen. Two thumbs work at once: the drag and the Flop button are separate pointers.

const ow = typeof window !== 'undefined' ? window.onceworlds : null;

export function createInput(canvas, opts = {}) {
  const keys = new Set();
  const state = {
    yaw: 0,
    turnV: 0,
    mouseHold: false,
    touchHold: false,
    locked: false,
    wantLock: false, // races and trials: the mouse looks
    lostLock: false,
    lastLockAt: 0,
    rHeld: 0,
    pressedAny: false,
    enabled: true,
    dragging: new Map(), // pointerId -> last x
    onEsc: null,
    onLockLost: null,
    onAnyInput: null,
    lockRefused: false,
  };
  const isUi = (el) => !!el?.closest?.('[data-ui]');

  function keyName(e) {
    return e.code || e.key;
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = keyName(e);
    if (k === 'Space' || e.key === ' ' || k.startsWith('Arrow')) e.preventDefault();
    if (k === 'Escape') state.onEsc?.();
    if (!e.repeat) state.onKey?.(k, e);
    keys.add(k === 'Spacebar' ? 'Space' : e.key === ' ' ? 'Space' : k);
    state.pressedAny = true;
    state.onAnyInput?.();
  });
  window.addEventListener('keyup', (e) => {
    const k = keyName(e);
    keys.delete(k === 'Spacebar' || e.key === ' ' ? 'Space' : k);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    state.mouseHold = false;
    state.touchHold = false;
    state.dragging.clear();
  });

  canvas.addEventListener('pointerdown', (e) => {
    state.onAnyInput?.();
    if (!state.enabled) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      state.dragging.set(e.pointerId, e.clientX);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      // without the platform's button (a page on its own), the right third of the screen is the Flop button
      if (!ow?.controls && opts.ownFlopZone && e.clientX > window.innerWidth * 0.66) {
        state.touchHold = true;
        state.touchHoldId = e.pointerId;
        state.dragging.delete(e.pointerId);
      }
      return;
    }
    if (e.button !== 0) return;
    if (state.wantLock && !state.locked) {
      requestLock();
      return; // the click that takes the mouse doesn't flop
    }
    state.mouseHold = true;
    if (!state.locked) {
      state.dragging.set(e.pointerId, e.clientX);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    }
  });
  const endPointer = (e) => {
    if (e.pointerId === state.touchHoldId) {
      state.touchHold = false;
      state.touchHoldId = null;
    }
    state.dragging.delete(e.pointerId);
    if (e.pointerType === 'mouse' && e.button === 0) state.mouseHold = false;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointermove', (e) => {
    if (state.locked && e.pointerType === 'mouse') return;
    const last = state.dragging.get(e.pointerId);
    if (last === undefined) return;
    const dx = e.clientX - last;
    state.dragging.set(e.pointerId, e.clientX);
    const k = e.pointerType === 'mouse' ? 0.006 : 0.0072;
    state.yaw -= dx * k;
  });
  window.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    const dx = e.movementX || 0;
    if (Math.abs(dx) > 400) return; // a browser glitch on lock
    state.yaw -= dx * 0.0024;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.mouseHold = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    const now = document.pointerLockElement === canvas;
    if (state.locked && !now) {
      state.lostLock = true;
      state.mouseHold = false;
      state.lastLockAt = performance.now();
      state.onLockLost?.();
    }
    state.locked = now;
  });
  document.addEventListener('pointerlockerror', () => {
    state.lockRefused = true;
  });

  function requestLock() {
    if (state.locked || !canvas.requestPointerLock) return;
    if (performance.now() - state.lastLockAt < 1100) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch)
        p.catch((err) => {
          if (err && (err.name === 'SecurityError' || err.name === 'NotSupportedError')) state.lockRefused = true;
        });
    } catch {
      state.lockRefused = true;
    }
  }

  const api = {
    state,
    keys,
    requestLock,
    releaseLock() {
      if (document.pointerLockElement === canvas) {
        try {
          document.exitPointerLock();
        } catch {}
      }
      state.locked = false;
    },
    setWantLock(on) {
      state.wantLock = on && !(ow?.controls?.touch) && !state.lockRefused;
      if (!on) api.releaseLock();
    },
    /** Is the player holding the flop right now? */
    holding() {
      if (!state.enabled) return false;
      let pad = false;
      try {
        pad = ow?.controls?.pressed?.('flop') ?? false;
      } catch {}
      return keys.has('Space') || state.mouseHold || state.touchHold || pad || state.padHold;
    },
    /** Turn from keys (eased). Call once per frame. */
    update(dt) {
      let turn = 0;
      if (state.enabled) {
        if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('a')) turn += 1;
        if (keys.has('KeyD') || keys.has('ArrowRight') || keys.has('d')) turn -= 1;
      }
      pollPad(dt);
      turn += state.padTurn ?? 0;
      const want = turn * 2.5;
      state.turnV += (want - state.turnV) * Math.min(1, dt * 10);
      state.yaw += state.turnV * dt;
      if (state.enabled && (keys.has('KeyR') || keys.has('r'))) state.rHeld += dt;
      else state.rHeld = 0;
    },
    clear() {
      keys.clear();
      state.mouseHold = false;
      state.touchHold = false;
      state.dragging.clear();
    },
  };

  // A gamepad, if there is one: left stick turns, A flops. Guarded: some browsers throw.
  let padBroken = false;
  function pollPad() {
    state.padTurn = 0;
    state.padHold = false;
    if (padBroken || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    try {
      const pads = navigator.getGamepads();
      for (const p of pads || []) {
        if (!p) continue;
        const x = p.axes?.[0] ?? 0;
        if (Math.abs(x) > 0.18) state.padTurn = -x;
        if (p.buttons?.[0]?.pressed) state.padHold = true;
        if (Math.abs(x) > 0.18 || state.padHold) state.onAnyInput?.();
        break;
      }
    } catch {
      padBroken = true;
    }
  }
  return api;
}
