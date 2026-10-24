// ui: rendering, hud, minimap, crafting menu, messages, overlay
window.G = window.G || {};
(function(){
  const G = window.G;
  const D = G.data;
  const ctx = G.ctx;

  let craftOpen = false, invOpen = false;
  let msgTimer = 0;

  G.ui = {
    msg: function(text) { document.getElementById("msg").textContent = text; msgTimer = 3; },
    refreshInv: function() {
      const p = G.player;
      document.getElementById("w").textContent = p.inventory.wood||0;
      document.getElementById("o").textContent = p.inventory.ore||0;
      document.getElementById("c").textContent = p.inventory.crystal||0;
      document.getElementById("p").textContent = p.inventory.parts||0;
    },
    toggleCraft: function() { craftOpen = !craftOpen; invOpen=false; },
    toggleInv: function() { invOpen = !invOpen; craftOpen=false; },
    hideOverlay: function() { document.getElementById("overlay").classList.add("hidden"); },
    showOverlay: function(title, body) {
      document.getElementById("ovtitle").textContent = title;
      document.getElementById("ovbody").textContent = body;
      document.getElementById("overlay").classList.remove("hidden");
    },
    update: function(dt) {
      const p = G.player;
      if (!p) return;
      // bars
      const hpPct = p.hp/p.maxhp*100;
      const enPct = p.energy/p.maxenergy*100;
      document.getElementById("hpbar").style.setProperty("--v", hpPct+"%");
      document.getElementById("enbar").style.setProperty("--v", enPct+"%");
      document.getElementById("hpval").textContent = Math.ceil(p.hp);
      document.getElementById("enval").textContent = Math.ceil(p.energy);
      // zone
      const z = G.zone;
      document.getElementById("zone").textContent = "Zone r:"+z.r.toFixed(1)+" phase "+z.phase;
      const m = Math.floor(z.timer/60), s = Math.floor(z.timer%60);
      document.getElementById("timer").textContent = String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
      if (msgTimer>0){ msgTimer-=dt; if(msgTimer<=0) document.getElementById("msg").textContent=""; }
      // minimap
      G.ui.drawMinimap();
    }
  };

  // minimap
  G.ui.drawMinimap = function() {
    const mc = document.getElementById("mm");
    const mctx = mc.getContext("2d");
    const scale = mc.width / (D.MAP_W);
    mctx.fillStyle = "#0b1220"; mctx.fillRect(0,0,mc.width,mc.height);
    // tiles
    for (let y=0;y<D.MAP_H;y++) for(let x=0;x<D.MAP_W;x++){
      const t = G.map.tiles[y*D.MAP_W+x];
      const col = G.map.types[t.type].color;
      mctx.fillStyle = col;
      mctx.fillRect(x*scale, y*scale, scale, scale);
    }
    // zone circle
    const z = G.zone;
    mctx.strokeStyle = "rgba(239,68,68,.7)"; mctx.lineWidth=1;
    mctx.beginPath();
    mctx.arc(z.cx*scale, z.cy*scale, z.r*scale, 0, Math.PI*2);
    mctx.stroke();
    // entities
    for (const e of G.map.entities) {
      if (e.dead) continue;
      const ex = (e.wx!==undefined?e.wx:e.x)/G.TILE;
      const ey = (e.wy!==undefined?e.wy:e.y)/G.TILE;
      if (e.kind==="creature") mctx.fillStyle = e.tamed? "#22c55e" : "#f97316";
      else if (e.kind==="tech") mctx.fillStyle = e.broken? "#64748b" : "#38bdf8";
      else if (e.kind==="boss") mctx.fillStyle = "#ef4444";
      else if (e.kind==="resource") mctx.fillStyle = "#fbbf24";
      mctx.fillRect(ex*scale-1, ey*scale-1, 2, 2);
    }
    // player
    mctx.fillStyle = "#fff";
    mctx.fillRect(G.player.x/G.TILE*scale-2, G.player.y/G.TILE*scale-2, 4,4);
  };

  // render main
  G.render = function(dt) {
    const ctx = G.ctx;
    ctx.clearRect(0,0,G.W,G.H);
    // background
    ctx.fillStyle = "#0a1220"; ctx.fillRect(0,0,G.W,G.H);

    if (G.state === "MENU") {
      G.renderMenu(ctx);
      return;
    }

    G.follow(G.player, dt);

    // collect drawables: tiles first then entities sorted by (x+y)
    // tiles
    const tiles = G.map.tiles;
    const W = D.MAP_W, H = D.MAP_H;
    // draw tiles in iso order (y then x? use sum)
    const tileList = [];
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) tileList.push({x,y,i:y*W+x});
    tileList.sort((a,b)=> (a.x+a.y)-(b.x+b.y));
    for (const t of tileList) {
      const tile = tiles[t.i];
      const type = G.map.types[tile.type];
      const elev = tile.elev||0;
      let col = type.color;
      // texture variation
      const v = ((t.x*7 + t.y*13) % 5) - 2;
      col = shadeColor(col, v*4);
      if (tile.type==="water") {
        const w = 0.5 + 0.5*Math.sin(G.time*2 + t.x*0.5 + t.y*0.7);
        col = shadeColor(type.color, w*20);
      }
      // draw side face for elevation
      if (elev > 0) {
        const p = G.iso(t.x*G.TILE+G.TILE/2, t.y*G.TILE+G.TILE/2, 0);
        const hw = G.TILE/2, hh = G.TILE/4;
        // left side
        ctx.beginPath();
        ctx.moveTo(p.x - hw, p.y);
        ctx.lineTo(p.x, p.y + hh);
        ctx.lineTo(p.x, p.y + hh - elev*(G.TILE/4));
        ctx.lineTo(p.x - hw, p.y - elev*(G.TILE/4));
        ctx.closePath();
        ctx.fillStyle = shadeColor(type.color, -25); ctx.fill();
        // right side
        ctx.beginPath();
        ctx.moveTo(p.x + hw, p.y);
        ctx.lineTo(p.x, p.y + hh);
        ctx.lineTo(p.x, p.y + hh - elev*(G.TILE/4));
        ctx.lineTo(p.x + hw, p.y - elev*(G.TILE/4));
        ctx.closePath();
        ctx.fillStyle = shadeColor(type.color, -15); ctx.fill();
      }
      G.drawIsoTile(ctx, t.x, t.y, elev, col, "rgba(0,0,0,.2)");
      // grass tufts
      if (tile.type==="grass" && (t.x+t.y)%3===0) {
        const p = G.iso(t.x*G.TILE+G.TILE/2, t.y*G.TILE+G.TILE/2, elev);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(p.x-1, p.y-2-elev*(G.TILE/4), 2, 3);
      }
    }

    // zone overlay (danger outside)
    // draw a subtle red vignette outside zone: skip heavy; draw zone circle outline in world
    const z = G.zone;
    const zp = G.iso(z.cx*G.TILE, z.cy*G.TILE, 0);
    ctx.strokeStyle = "rgba(239,68,68,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(zp.x, zp.y, z.r*G.TILE/2, z.r*G.TILE/4, 0, 0, Math.PI*2);
    // approximate circle in iso: use ellipse with scale; not perfect but ok
    ctx.stroke();

    // entities sorted by (wx+wy)
    const drawables = [];
    for (const e of G.map.entities) {
      if (e.dead) continue;
      const ex = e.wx!==undefined? e.wx : e.x;
      const ey = e.wy!==undefined? e.wy : e.y;
      drawables.push({ e, key: ex+ey });
    }
    // player
    drawables.push({ e: G.player, key: G.player.x+G.player.y, isPlayer:true });
    // projectiles
    for (const pr of G.projectiles) drawables.push({ e: pr, key: pr.x+pr.y, isProj:true });
    drawables.sort((a,b)=>a.key-b.key);

    for (const d of drawables) {
      if (d.isProj) { drawProjectile(ctx, d.e); continue; }
      if (d.isPlayer) { drawPlayer(ctx, d.e); continue; }
      const e = d.e;
      if (e.kind === "resource") drawResource(ctx, e);
      else if (e.kind === "creature") drawCreature(ctx, e);
      else if (e.kind === "tech") drawTech(ctx, e);
      else if (e.kind === "boss") drawBoss(ctx, e);
    }

    // particles
    G.drawParticles(ctx);

    // lighting: vignette + player glow
    const grad = ctx.createRadialGradient(G.W/2, G.H/2, 60, G.W/2, G.H/2, 420);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,G.W,G.H);

    // HUD overlays (craft menu)
    if (craftOpen) drawCraftMenu(ctx);
    if (invOpen) drawInvMenu(ctx);

    // flash damage vignette
    if (G.player.flash>0) {
      ctx.fillStyle = "rgba(239,68,68,"+(G.player.flash*0.6)+")";
      ctx.fillRect(0,0,G.W,G.H);
    }
  };

  function shade(hex, amt) {
    // lighten
    return hex;
  }

  function drawPlayer(ctx, p) {
    const bob = Math.sin(G.time*8 + p.x*0.01)*1.5;
    G.drawShadow(ctx, p.x, p.y, 11);
    const ip = G.iso(p.x, p.y, 0);
    // body
    ctx.fillStyle = p.flash>0? "#fff" : "#2563eb";
    // legs
    ctx.fillRect(ip.x-5, ip.y-2+bob, 4, 6);
    ctx.fillRect(ip.x+1, ip.y-2+bob, 4, 6);
    // torso
    ctx.fillStyle = p.flash>0? "#fff" : "#3b82f6";
    ctx.fillRect(ip.x-7, ip.y-12+bob, 14, 12);
    // head
    ctx.fillStyle = p.flash>0? "#fff" : "#fcd34d";
    ctx.beginPath();
    ctx.arc(ip.x, ip.y-16+bob, 6, 0, Math.PI*2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(ip.x-3 + (p.facing.x>0?2:-4), ip.y-18+bob, 2, 2);
    ctx.fillRect(ip.x+1 + (p.facing.x>0?2:-4), ip.y-18+bob, 2, 2);
    // weapon arm
    ctx.strokeStyle = "#93c5fd"; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(ip.x + (p.facing.x>0?6:-6), ip.y-8+bob);
    ctx.lineTo(ip.x + p.facing.x*16, ip.y-8+bob + p.facing.y*16);
    ctx.stroke();
    // name
    ctx.fillStyle = "#e6edf3"; ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("You", ip.x, ip.y-26+bob);
    // active creature indicator
    if (p.active>=0) {
      ctx.fillStyle = "#22c55e"; ctx.font="9px sans-serif";
      ctx.fillText("★", ip.x+12, ip.y-20+bob);
    }
  }

  function drawCreature(ctx, e) {
    const spec = D.creatures[e.species];
    const bob = Math.sin(G.time*6 + e.wx*0.02)*1.2;
    G.drawShadow(ctx, e.wx, e.wy, 9);
    const ip = G.iso(e.wx, e.wy, 0);
    // body color
    const base = e.tamed ? spec.color : shadeColor(spec.color, -40);
    // legs
    ctx.fillStyle = shadeColor(base, -20);
    ctx.fillRect(ip.x-5, ip.y-2+bob, 3, 5);
    ctx.fillRect(ip.x+2, ip.y-2+bob, 3, 5);
    // body
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(ip.x, ip.y-9+bob, 8, 7, 0, 0, Math.PI*2);
    ctx.fill();
    // outline
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth=1; ctx.stroke();
    // head
    ctx.fillStyle = shadeColor(base, 20);
    ctx.beginPath();
    ctx.arc(ip.x + (e.tamed?4:-4), ip.y-14+bob, 5, 0, Math.PI*2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ip.x + (e.tamed?5:-3), ip.y-15+bob, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(ip.x + (e.tamed?5.5:-2.5), ip.y-15+bob, 1, 0, Math.PI*2);
    ctx.fill();
    // element aura
    ctx.fillStyle = elemColor(spec.element);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(ip.x-6, ip.y-16+bob, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // hp bar
    drawHpBar(ctx, ip.x, ip.y-24+bob, 28, e.hp, e.maxhp, e.tamed?"#22c55e":"#ef4444");
    ctx.fillStyle = "#cbd5e1"; ctx.font="bold 9px sans-serif"; ctx.textAlign="center";
    ctx.fillText(spec.name + (e.tamed?" (T)":""), ip.x, ip.y-30+bob);
  }

  function drawTech(ctx, e) {
    const spec = D.techBeasts[e.species];
    const bob = Math.sin(G.time*5 + e.wx*0.03)*1;
    G.drawShadow(ctx, e.wx, e.wy, 10);
    const ip = G.iso(e.wx, e.wy, 0);
    const col = e.broken ? "#475569" : spec.color;
    // body (mech)
    ctx.fillStyle = shadeColor(col, -10);
    ctx.fillRect(ip.x-9, ip.y-16+bob, 18, 14);
    // panels
    ctx.fillStyle = shadeColor(col, 15);
    ctx.fillRect(ip.x-7, ip.y-14+bob, 14, 4);
    ctx.fillRect(ip.x-7, ip.y-8+bob, 14, 4);
    // head/sensor
    ctx.fillStyle = e.broken ? "#ef4444" : "#22d3ee";
    ctx.fillRect(ip.x-4, ip.y-20+bob, 8, 5);
    // glow
    ctx.globalAlpha = 0.5 + 0.3*Math.sin(G.time*4);
    ctx.fillStyle = e.broken ? "#ef4444" : "#22d3ee";
    ctx.fillRect(ip.x-2, ip.y-19+bob, 4, 3);
    ctx.globalAlpha = 1;
    // legs
    ctx.fillStyle = shadeColor(col, -25);
    ctx.fillRect(ip.x-7, ip.y-2+bob, 4, 6);
    ctx.fillRect(ip.x+3, ip.y-2+bob, 4, 6);
    // outline
    ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth=1;
    ctx.strokeRect(ip.x-9, ip.y-16+bob, 18, 14);
    drawHpBar(ctx, ip.x, ip.y-26+bob, 28, e.hp, e.maxhp, e.broken?"#ef4444":"#38bdf8");
    ctx.fillStyle = "#cbd5e1"; ctx.font="bold 9px sans-serif"; ctx.textAlign="center";
    ctx.fillText(spec.name + (e.broken?" (broken)":""), ip.x, ip.y-32+bob);
  }

  function drawBoss(ctx, e) {
    const pulse = 0.8 + 0.2*Math.sin(G.time*3);
    G.drawShadow(ctx, e.wx, e.wy, 30);
    const ip = G.iso(e.wx, e.wy, 0);
    // body
    ctx.fillStyle = e.phase===2 ? "#991b1b" : "#7f1d1d";
    ctx.beginPath();
    ctx.arc(ip.x, ip.y-22, 24*pulse, 0, Math.PI*2);
    ctx.fill();
    // core
    ctx.fillStyle = e.phase===2 ? "#fca5a5" : "#f87171";
    ctx.globalAlpha = 0.6 + 0.3*Math.sin(G.time*5);
    ctx.beginPath();
    ctx.arc(ip.x, ip.y-22, 10, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // spikes
    ctx.strokeStyle = "#fca5a5"; ctx.lineWidth=2;
    for (let i=0;i<8;i++){
      const a = (i/8)*Math.PI*2 + G.time*0.5;
      ctx.beginPath();
      ctx.moveTo(ip.x+Math.cos(a)*24, ip.y-22+Math.sin(a)*24);
      ctx.lineTo(ip.x+Math.cos(a)*34, ip.y-22+Math.sin(a)*34);
      ctx.stroke();
    }
    // outline
    ctx.strokeStyle = "#fca5a5"; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(ip.x, ip.y-22, 24*pulse, 0, Math.PI*2);
    ctx.stroke();
    drawHpBar(ctx, ip.x, ip.y-56, 70, e.hp, e.maxhp, "#ef4444");
    ctx.fillStyle = "#fca5a5"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
    ctx.fillText("COLOSSUS", ip.x, ip.y-62);
  }

  function drawResource(ctx, e) {
    const spec = D.resources[e.type];
    const bob = Math.sin(G.time*4 + e.wx*0.1)*1;
    const ip = G.iso(e.wx, e.wy, 0);
    G.drawShadow(ctx, e.wx, e.wy, 6);
    // crystal/gem shape
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.moveTo(ip.x, ip.y-12+bob);
    ctx.lineTo(ip.x+8, ip.y-4+bob);
    ctx.lineTo(ip.x+5, ip.y+3+bob);
    ctx.lineTo(ip.x-5, ip.y+3+bob);
    ctx.lineTo(ip.x-8, ip.y-4+bob);
    ctx.closePath();
    ctx.fill();
    // highlight
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath();
    ctx.moveTo(ip.x-2, ip.y-10+bob);
    ctx.lineTo(ip.x+2, ip.y-8+bob);
    ctx.lineTo(ip.x, ip.y-4+bob);
    ctx.closePath();
    ctx.fill();
    // icon
    ctx.fillStyle = "#fff"; ctx.font="bold 9px sans-serif"; ctx.textAlign="center";
    ctx.fillText(spec.icon, ip.x, ip.y-2+bob);
  }

  function drawProjectile(ctx, pr) {
    const ip = G.iso(pr.x, pr.y, 0);
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(ip.x, ip.y-4, 3, 0, Math.PI*2);
    ctx.fill();
  }

  function drawHpBar(ctx, x, y, w, hp, maxhp, color) {
    // background
    ctx.fillStyle = "rgba(0,0,0,.7)";
    ctx.fillRect(x-w/2-1, y-1, w+2, 6);
    // fill
    const pct = Math.max(0, hp/maxhp);
    const grad = ctx.createLinearGradient(x-w/2, y, x+w/2, y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shadeColor(color, 40));
    ctx.fillStyle = grad;
    ctx.fillRect(x-w/2, y, w*pct, 4);
    // border
    ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth=1;
    ctx.strokeRect(x-w/2, y, w, 4);
  }

  function elemColor(el) {
    return el==="fire"?"#f97316": el==="water"?"#38bdf8": el==="plant"?"#22c55e":"#fff";
  }
  function shadeColor(hex, amt) {
    // amt: -255..255
    let c = hex.replace("#","");
    if (c.length===3) c = c.split("").map(x=>x+x).join("");
    const num = parseInt(c,16);
    let r = (num>>16)&255, g=(num>>8)&255, b=num&255;
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  function drawCraftMenu(ctx) {
    const p = G.player;
    const x = 60, y = 80, w = 420, h = 440;
    ctx.fillStyle = "rgba(10,15,25,.92)";
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = "#334155"; ctx.strokeRect(x,y,w,h);
    ctx.fillStyle = "#7dd3fc"; ctx.font = "bold 16px sans-serif"; ctx.textAlign="left";
    ctx.fillText("Crafting (C to close)", x+12, y+24);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#cbd5e1";
    let yy = y+44;
    for (const r of D.recipes) {
      // cost string
      const cost = Object.entries(r.cost).map(([k,v])=>v+" "+k).join(", ");
      ctx.fillStyle = "#e6edf3"; ctx.fillText(r.name, x+12, yy);
      ctx.fillStyle = "#94a3b8"; ctx.fillText(cost, x+12, yy+13);
      // button
      const bx = x+w-80, by = yy-2;
      ctx.fillStyle = "#2563eb"; ctx.fillRect(bx,by,70,20);
      ctx.fillStyle = "#fff"; ctx.font="11px sans-serif"; ctx.textAlign="center";
      ctx.fillText("Craft", bx+35, by+14);
      ctx.textAlign="left"; ctx.font="11px sans-serif";
      yy += 34;
    }
    // modules attach hint
    ctx.fillStyle = "#fbbf24"; ctx.font="11px sans-serif";
    ctx.fillText("Modules in inv: "+p.modules.join(", "), x+12, y+h-40);
    ctx.fillText("Party: "+p.party.map((c,i)=>D.creatures[c.species].name+" ["+(c.modules||[]).join(",")+"]").join(" | "), x+12, y+h-22);
    // handle click
    if (G.mouse.down) {
      const mx = G.mouse.x, my = G.mouse.y;
      let yy2 = y+44;
      for (const r of D.recipes) {
        const bx = x+w-80, by = yy2-2;
        if (mx>=bx && mx<=bx+70 && my>=by && my<=by+20) {
          G.craft(r.id);
          G.mouse.down = false;
        }
        yy2 += 34;
      }
    }
  }

  function drawInvMenu(ctx) {
    const p = G.player;
    const x = 60, y = 80, w = 360, h = 320;
    ctx.fillStyle = "rgba(10,15,25,.92)";
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = "#334155"; ctx.strokeRect(x,y,w,h);
    ctx.fillStyle = "#7dd3fc"; ctx.font = "bold 16px sans-serif";
    ctx.fillText("Inventory (Tab to close)", x+12, y+24);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#cbd5e1";
    let yy = y+48;
    ctx.fillText("Weapon: "+p.weapon.name+" (dmg "+p.weapon.dmg+")", x+12, yy); yy+=18;
    ctx.fillText("Armor: +"+p.armor+"  HP "+Math.ceil(p.hp)+"/"+p.maxhp, x+12, yy); yy+=18;
    ctx.fillText("Modules: "+(p.modules.join(", ")||"none"), x+12, yy); yy+=24;
    ctx.fillStyle = "#fbbf24"; ctx.fillText("Party (press 1/2/3 to switch active):", x+12, yy); yy+=16;
    p.party.forEach((c,i)=>{
      const spec = D.creatures[c.species];
      const active = (p.active===i) ? " [ACTIVE]" : "";
      ctx.fillStyle = "#e6edf3"; ctx.fillText((i+1)+". "+spec.name+" HP "+Math.ceil(c.hp)+"/"+c.maxhp+active, x+12, yy); yy+=16;
      ctx.fillStyle = "#94a3b8"; ctx.fillText("   modules: "+((c.modules||[]).join(", ")||"none"), x+12, yy); yy+=14;
      // attach module buttons
      if (p.modules.length) {
        let bx = x+12;
        for (const m of p.modules) {
          ctx.fillStyle = "#2563eb"; ctx.fillRect(bx, yy, 90, 16);
          ctx.fillStyle="#fff"; ctx.font="10px sans-serif"; ctx.textAlign="center";
          ctx.fillText("Attach "+m, bx+45, yy+12); ctx.textAlign="left";
          // click
          if (G.mouse.down && G.mouse.x>=bx && G.mouse.x<=bx+90 && G.mouse.y>=yy && G.mouse.y<=yy+16) {
            G.attachModule(m, i); G.mouse.down=false;
          }
          bx += 96;
        }
        yy += 22;
      }
    });
    if (p.party.length===0) { ctx.fillStyle="#94a3b8"; ctx.fillText("No tamed creatures yet.", x+12, yy); }
  }

  function drawMenu(ctx) {
    // handled separately
  }

  G.renderMenu = function(ctx) {
    ctx.fillStyle = "#0a1220"; ctx.fillRect(0,0,G.W,G.H);
    ctx.fillStyle = "#7dd3fc"; ctx.font = "bold 40px sans-serif"; ctx.textAlign="center";
    ctx.fillText("WILDCORE: EXTINCTION", G.W/2, 160);
    ctx.fillStyle = "#cbd5e1"; ctx.font = "16px sans-serif";
    ctx.fillText("Creature Taming · Survival · Crafting · PvPvE", G.W/2, 200);
    ctx.fillStyle = "#94a3b8"; ctx.font = "13px sans-serif";
    const lines = [
      "WASD move · Mouse aim · LMB attack · RMB creature ability",
      "E interact/tame/pickup · Space dash · C crafting · Tab inventory · 1/2/3 swap creature",
      "Survive the shrinking zone, tame creatures, craft gear, defeat the Colossus boss.",
    ];
    lines.forEach((l,i)=>ctx.fillText(l, G.W/2, 260+i*22));
    ctx.fillStyle = "#2563eb"; 
    const bx=G.W/2-80, by=360, bw=160, bh=44;
    ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle="#fff"; ctx.font="bold 16px sans-serif";
    ctx.fillText("Start Game", G.W/2, by+28);
    if (G.mouse.down) {
      if (G.mouse.x>=bx && G.mouse.x<=bx+bw && G.mouse.y>=by && G.mouse.y<=by+bh) {
        G.startGame(); G.mouse.down=false;
      }
    }
    ctx.textAlign="left";
  };
})();
