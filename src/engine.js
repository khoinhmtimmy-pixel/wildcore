// engine: canvas, input, camera, iso helpers, audio
window.G = window.G || {};
(function(){
  const G = window.G;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  G.canvas = canvas; G.ctx = ctx;
  G.W = canvas.width; G.H = canvas.height;

  // input
  G.keys = {};
  G.mouse = { x: 0, y: 0, down: false, rdown: false };
  window.addEventListener("keydown", e => { G.keys[e.key.toLowerCase()] = true; if ([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault(); });
  window.addEventListener("keyup", e => { G.keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener("mousemove", e => { const r = canvas.getBoundingClientRect(); G.mouse.x = e.clientX - r.left; G.mouse.y = e.clientY - r.top; });
  canvas.addEventListener("mousedown", e => { if (e.button === 0) G.mouse.down = true; if (e.button === 2) G.mouse.rdown = true; });
  canvas.addEventListener("mouseup", e => { if (e.button === 0) G.mouse.down = false; if (e.button === 2) G.mouse.rdown = false; });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // camera
  G.cam = { x: 0, y: 0 };
  G.follow = function(target, dt) {
    const tx = target.x - G.W/2, ty = target.y - G.H/2;
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt*6);
    G.cam.y += (ty - G.cam.y) * Math.min(1, dt*6);
  };

  // iso conversion: world (x,y) in tile coords -> screen
  // tile center at (tx,ty) world px = tx*TILE, ty*TILE
  G.TILE = G.data.TILE;
  G.iso = function(wx, wy, elev) {
    elev = elev || 0;
    const x = (wx - wy) * (G.TILE/2);
    const y = (wx + wy) * (G.TILE/4) - elev * (G.TILE/4);
    return { x: x - G.cam.x, y: y - G.cam.y };
  };
  // screen -> world tile (approx, ignores elev)
  G.screenToWorld = function(sx, sy) {
    const x = sx + G.cam.x, y = sy + G.cam.y;
    const wx = (x/(G.TILE/2) + y/(G.TILE/4)) / 2;
    const wy = (y/(G.TILE/4) - x/(G.TILE/2)) / 2;
    return { x: wx, y: wy };
  };

  // audio (beeps)
  let actx = null;
  G.beep = function(freq, dur, type) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  };

  // helpers
  G.clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  G.dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  G.rnd = (a,b) => a + Math.random()*(b-a);
  G.choice = arr => arr[Math.floor(Math.random()*arr.length)];

  // drawing helpers
  G.drawIsoTile = function(ctx, tx, ty, elev, color, stroke) {
    const p = G.iso(tx*G.TILE + G.TILE/2, ty*G.TILE + G.TILE/2, 0);
    // diamond
    const hw = G.TILE/2, hh = G.TILE/4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hh - elev*(G.TILE/4));
    ctx.lineTo(p.x + hw, p.y - elev*(G.TILE/4));
    ctx.lineTo(p.x, p.y + hh - elev*(G.TILE/4));
    ctx.lineTo(p.x - hw, p.y - elev*(G.TILE/4));
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };

  G.drawShadow = function(ctx, wx, wy, r) {
    const p = G.iso(wx, wy, 0);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, r, r*0.4, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
  };

  G.drawCircle = function(ctx, wx, wy, elev, r, color) {
    const p = G.iso(wx, wy, elev);
    G.drawShadow(ctx, wx, wy, r);
    ctx.beginPath();
    ctx.arc(p.x, p.y - (elev? elev*G.TILE/4 : 0) - r*0.5, r, 0, Math.PI*2);
    // simpler: draw at iso pos
    ctx.fillStyle = color; ctx.fill();
  };
})();
