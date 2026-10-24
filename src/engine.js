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
  G.shake = { x: 0, y: 0, t: 0, mag: 0 };
  G.time = 0;
  G.particles = [];
  G.follow = function(target, dt) {
    const tsx = (target.x - target.y) * 0.5;
    const tsy = (target.x + target.y) * 0.25;
    const tx = tsx - G.W/2, ty = tsy - G.H/2;
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt*6);
    G.cam.y += (ty - G.cam.y) * Math.min(1, dt*6);
    // shake decay
    G.shake.t = Math.max(0, G.shake.t - dt);
    const s = G.shake.t > 0 ? G.shake.mag * (G.shake.t/0.3) : 0;
    G.shake.x = (Math.random()*2-1)*s;
    G.shake.y = (Math.random()*2-1)*s;
  };

  // iso conversion: world (x,y) in tile coords -> screen
  // tile center at (tx,ty) world px = tx*TILE, ty*TILE
  G.TILE = G.data.TILE;
  G.iso = function(wx, wy, elev) {
    elev = elev || 0;
    const x = (wx - wy) * 0.5;
    const y = (wx + wy) * 0.25 - elev * (G.TILE/4);
    return { x: x - G.cam.x + G.shake.x, y: y - G.cam.y + G.shake.y };
  };
  // screen -> world (pixels)
  G.screenToWorld = function(sx, sy) {
    const u = sx + G.cam.x, v = sy + G.cam.y;
    const wx = u + 2*v;
    const wy = 2*v - u;
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
  // particles
  G.spawnParticle = function(x, y, vx, vy, life, color, size) {
    G.particles.push({ x, y, vx, vy, life, maxlife: life, color, size: size||3 });
  };
  G.updateParticles = function(dt) {
    for (const p of G.particles) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
    }
    G.particles = G.particles.filter(p => p.life > 0);
  };
  G.drawParticles = function(ctx) {
    for (const p of G.particles) {
      const ip = G.iso(p.x, p.y, 0);
      const a = Math.max(0, p.life / p.maxlife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(ip.x, ip.y-4, Math.max(0.5, p.size*a+1), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  G.screenShake = function(mag, dur) { G.shake.mag = mag; G.shake.t = dur||0.3; };
})();
