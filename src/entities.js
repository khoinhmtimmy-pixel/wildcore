// entities: player, creatures, tech beasts, boss, resources, projectiles
window.G = window.G || {};
(function(){
  const G = window.G;
  const D = G.data;

  // player
  G.player = null;
  G.initPlayer = function() {
    const s = G.playerSpawn;
    G.player = {
      x: s.x, y: s.y, vx:0, vy:0,
      r: 10, hp:100, maxhp:100, energy:100, maxenergy:100,
      speed: 2.2, armor:0,
      weapon: { name:"Fists", dmg:8, ranged:false },
      inventory: { wood:0, ore:0, crystal:0, parts:0 },
      party: [], active: -1,
      modules: [],
      xp:0, level:1,
      cooldowns: { attack:0, dash:0, ability:0 },
      facing: { x:1, y:0 },
      dead:false, invuln:0
    };
  };

  // projectiles
  G.projectiles = [];
  G.spawnProjectile = function(x,y,vx,vy,dmg,owner,color,life) {
    G.projectiles.push({ x,y,vx,vy,dmg,owner,color,life: life||1.2, r:4 });
  };

  // damage helper
  G.damage = function(target, amount, source) {
    if (!target || target.dead) return;
    if (target.invuln>0) return;
    let dmg = amount;
    if (target.armor) dmg = Math.max(1, dmg - target.armor);
    target.hp -= dmg;
    target.flash = 0.15;
    if (target === G.player) { G.screenShake(6, 0.2); }
    const ty = target.wy!==undefined? target.wy : target.y;
    const col = source==="player" ? "#fbbf24" : "#ef4444";
    for (let i=0;i<6;i++){
      G.spawnParticle(tx, ty, (Math.random()-0.5)*4, (Math.random()-0.5)*4 - 1, 0.4, col, 2);
    }
    if (target.hp <= 0) {
      target.hp = 0;
      if (target === G.player) { G.playerDead(); }
      else {
        target.dead = true;
        // grant XP to active creature if player killed it
        if (source === "player") {
          const p = G.player;
          if (p.active>=0 && p.party[p.active]) {
            const c = p.party[p.active];
            c.xp = (c.xp||0) + 10;
            const spec = D.creatures[c.species];
            const newLevel = 1 + Math.floor(c.xp / 30);
            if (newLevel > (c.level||1)) {
              c.level = newLevel;
              c.maxhp = (c.maxhp||spec.hp) + 10;
              c.hp = c.maxhp;
              c.dmg = (c.dmg || spec.dmg) + 2;
              G.ui.msg(spec.name+" leveled up to "+c.level+"!");
              G.spawnParticle(c.wx, c.wy, 0, -3, 1, "#fbbf24", 4);
              G.beep(660,0.15,"sine");
              if (c.level >= 3 && !c.evolved) {
                c.evolved = true;
                c.maxhp += 20; c.hp = c.maxhp;
                G.ui.msg(spec.name+" evolved!");
                G.spawnParticle(c.wx, c.wy, 0, -4, 1.2, "#a78bfa", 5);
              }
            }
          }
        }
      }
      G.beep(120, 0.1, "sawtooth");
    } else {
      G.beep(220, 0.05, "square");
    }
  };

  // element multiplier
  G.elemMult = function(atkElem, defElem) {
    if (!atkElem || !defElem) return 1;
    if (D.elemAdv[atkElem] === defElem) return 1.5;
    if (D.elemAdv[defElem] === atkElem) return 0.6;
    return 1;
  };

  // update player
  G.updatePlayer = function(dt) {
    const p = G.player;
    if (p.dead) return;
    // movement
    let mx=0, my=0;
    if (G.keys["w"]||G.keys["arrowup"]) my -= 1;
    if (G.keys["s"]||G.keys["arrowdown"]) my += 1;
    if (G.keys["a"]||G.keys["arrowleft"]) mx -= 1;
    if (G.keys["d"]||G.keys["arrowright"]) mx += 1;
    const len = Math.hypot(mx,my) || 1;
    mx/=len; my/=len;
    p.vx = mx * p.speed; p.vy = my * p.speed;
    // dash
    if (G.keys[" "] && p.cooldowns.dash<=0 && p.energy>=15) {
      p.vx *= 3; p.vy *= 3; p.cooldowns.dash = 1.2; p.energy -= 15; G.beep(440,0.08,"sine");
    }
    // apply with collision
    const nx = p.x + p.vx;
    const ny = p.y + p.vy;
    if (G.canMove(nx, p.y, p.r)) { p.x = nx; if (Math.random()<0.3) G.spawnParticle(p.x, p.y, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, 0.3, "rgba(255,255,255,.4)", 1); }
    if (G.canMove(p.x, ny, p.r)) { p.y = ny; }

    // facing toward mouse
    const w = G.screenToWorld(G.mouse.x, G.mouse.y);
    const wx = w.x*G.TILE, wy = w.y*G.TILE;
    const fx = wx - p.x, fy = wy - p.y;
    const fl = Math.hypot(fx,fy) || 1;
    p.facing = { x: fx/fl, y: fy/fl };

    // energy regen
    p.energy = Math.min(p.maxenergy, p.energy + 8*dt);
    // cooldowns
    for (const k in p.cooldowns) p.cooldowns[k] = Math.max(0, p.cooldowns[k]-dt);
    p.invuln = Math.max(0, p.invuln-dt);
    p.flash = Math.max(0, (p.flash||0)-dt);

    // attack
    if (G.mouse.down && p.cooldowns.attack<=0) {
      p.cooldowns.attack = 0.35;
      const w = p.weapon;
      if (w.ranged) {
        G.spawnProjectile(p.x, p.y, p.facing.x*9, p.facing.y*9, w.dmg, "player", "#fbbf24", 1.0);
        G.beep(660,0.06,"triangle");
      } else {
        // melee: hit nearest enemy in front
        G.meleeHit(p.x + p.facing.x*18, p.y + p.facing.y*18, 26, w.dmg, "player");
        G.beep(300,0.06,"square");
      }
    }
    // creature ability
    if (G.mouse.rdown && p.cooldowns.ability<=0 && p.active>=0) {
      const c = p.party[p.active];
      if (c) { G.creatureAbility(c, p); p.cooldowns.ability = 1.4; }
    }
    // creature mode toggle
    if (G.keys["f"]) { G.keys["f"]=false; if (p.active>=0 && p.party[p.active]) { const c=p.party[p.active]; c.mode = c.mode==="stay"?"follow":"stay"; G.ui.msg(D.creatures[c.species].name+" mode: "+c.mode); } }
    // interact key
    if (G.keys["e"]) { G.keys["e"]=false; G.interact(); }
    // crafting toggle
    if (G.keys["c"]) { G.keys["c"]=false; G.ui.toggleCraft(); }
    // inventory toggle
    if (G.keys["tab"]) { G.keys["tab"]=false; G.ui.toggleInv(); }
    // swap creature
    for (let i=0;i<3;i++){
      if (G.keys[String(i+1)]) { G.keys[String(i+1)]=false; if (i < p.party.length) p.active = i; }
    }
    // zone damage
    if (!G.inZone(p.x,p.y)) {
      p.hp -= 6*dt;
      if (p.hp<=0){ p.hp=0; G.playerDead(); }
    }
  };

  G.canMove = function(x,y,r) {
    // check tile walkability at circle
    const pts = [[x,y],[x-r,y],[x+r,y],[x,y-r],[x,y+r]];
    for (const pt of pts) {
      const t = G.screenToWorld? null : null;
      const tx = Math.floor(pt[0]/G.TILE), ty = Math.floor(pt[1]/G.TILE);
      if (!G.walkable(tx,ty)) return false;
    }
    // bounds
    if (x<0 || y<0 || x>G.data.MAP_W*G.TILE || y>G.data.MAP_H*G.TILE) return false;
    return true;
  };

  G.meleeHit = function(x,y,range,dmg,owner) {
    for (const e of G.map.entities) {
      if (e.dead || e.kind==="resource" || e.kind==="boss") continue;
      if (e === G.player) continue;
      const d = Math.hypot(e.wx?e.wx:e.x - x, (e.wy?e.wy:e.y) - y);
      // use wx/wy if present else x/y
      const ex = e.wx!==undefined? e.wx : e.x;
      const ey = e.wy!==undefined? e.wy : e.y;
      const dd = Math.hypot(ex-x, ey-y);
      if (dd <= range) {
        let mult = 1;
        if (e.element) mult = G.elemMult(owner==="player"? (G.player.active>=0? G.data.creatures[G.player.party[G.player.active].species].element : null) : null, e.element);
        // player melee no element unless creature active? keep simple
        G.damage(e, dmg*mult, owner);
        // knockback
        const l = dd||1; e.kx = (ex-x)/l*3; e.ky=(ey-y)/l*3;
      }
    }
    // also boss
    const b = G.map.entities.find(e=>e.kind==="boss" && !e.dead);
    if (b) {
      const dd = Math.hypot(b.wx-x, b.wy-y);
      if (dd <= range+10) { G.damage(b, dmg, owner); b.kx=(b.wx-x)/dd*2; b.ky=(b.wy-y)/dd*2; }
    }
  };

  G.interact = function() {
    const p = G.player;
    // resources
    let best=null, bd=40;
    for (const e of G.map.entities) {
      if (e.dead || e.kind!=="resource") continue;
      const d = Math.hypot(e.wx-p.x, e.wy-p.y);
      if (d<bd){bd=d;best=e;}
    }
    if (best) {
      const amt = best.amount;
      p.inventory[best.type] = (p.inventory[best.type]||0)+amt;
      best.dead = true;
      for (let i=0;i<10;i++) G.spawnParticle(best.wx, best.wy, (Math.random()-0.5)*3, (Math.random()-0.5)*3-1, 0.6, "#fbbf24", 2);
      G.beep(520,0.08,"sine");
      G.ui.msg("Picked up "+amt+" "+best.type);
      G.ui.refreshInv();
      return;
    }
    // broken tech beast repair
    let tech=null, td=46;
    for (const e of G.map.entities) {
      if (e.dead || e.kind!=="tech") continue;
      const d = Math.hypot(e.wx-p.x, e.wy-p.y);
      if (d<td){td=d;tech=e;}
    }
    if (tech && tech.broken) {
      const spec = D.techBeasts[tech.species];
      // check resources
      let ok = true;
      for (const k in spec.repair) if ((p.inventory[k]||0) < spec.repair[k]) ok=false;
      if (!ok) { G.ui.msg("Need parts to repair "+spec.name); return; }
      for (const k in spec.repair) p.inventory[k] -= spec.repair[k];
      tech.broken=false; tech.repaired=true; tech.hp=tech.maxhp; tech.owner="player";
      G.ui.msg("Repaired "+spec.name);
      G.ui.refreshInv();
      G.beep(330,0.12,"triangle");
      return;
    }
    // taming: nearest wild creature
    let cr=null, cd=46;
    for (const e of G.map.entities) {
      if (e.dead || e.kind!=="creature" || e.tamed) continue;
      const d = Math.hypot(e.wx-p.x, e.wy-p.y);
      if (d<cd){cd=d;cr=e;}
    }
    if (cr) {
      G.tryTame(cr);
    }
  };

  G.tryTame = function(cr) {
    const p = G.player;
    const spec = D.creatures[cr.species];
    if (cr.hp > cr.maxhp*0.35) { G.ui.msg(spec.name+" not weakened enough"); return; }
    if ((p.inventory[spec.tamingFood]||0) < 1) { G.ui.msg("Need "+spec.tamingFood+" to tame"); return; }
    p.inventory[spec.tamingFood] -= 1;
    cr.tamingProgress = (cr.tamingProgress||0) + 1;
    const req = cr.tamingRequired || 3;
    const pct = cr.tamingProgress / req;
    G.ui.msg(spec.name+" taming: "+Math.round(pct*100)+"%");
    G.spawnParticle(cr.wx, cr.wy, 0, -2, 0.6, "#22c55e", 3);
    if (cr.tamingProgress >= req) {
      cr.tamed = true; cr.owner="player";
      for (let i=0;i<16;i++) G.spawnParticle(cr.wx, cr.wy, (Math.random()-0.5)*4, (Math.random()-0.5)*4-2, 0.8, "#22c55e", 3);
      G.beep(780,0.15,"sine");
      G.ui.msg("Tamed "+spec.name+"!");
      const save = G.loadSave();
      save.codex = save.codex || {};
      if (!save.codex[cr.species]) { save.codex[cr.species]=true; G.ui.msg("Codex unlocked: "+spec.name); }
      G.saveProgress(save);
      if (p.party.length < 2) {
        p.party.push(cr); cr.inParty = true; cr.mode = "follow";
        if (p.active < 0) p.active = 0;
      } else {
        G.ui.msg(spec.name+" tamed but party full (max 2)");
      }
    } else {
      if (Math.random() < 0.25) { cr.state = "flee"; cr.tamingProgress = Math.max(0, cr.tamingProgress-1); G.ui.msg(spec.name+" resisted!"); }
    }
    G.ui.refreshInv();
  };

  G.creatureAbility = function(c, p) {
    const spec = D.creatures[c.species];
    const dmg = c.dmg || spec.dmg;
    const elem = spec.element;
    const x = p.x + p.facing.x*10, y = p.y + p.facing.y*10;
    // simple projectile per element
    if (elem === "fire") {
      G.spawnProjectile(p.x, p.y, p.facing.x*7, p.facing.y*7, dmg, "player", "#f97316", 0.9);
      G.spawnProjectile(p.x, p.y, p.facing.x*7+0.5, p.facing.y*7, dmg*0.6, "player", "#f97316", 0.9);
    } else if (elem === "water") {
      // slow AoE around player
      for (const e of G.map.entities) {
        if (e.dead || e.kind==="resource") continue;
        const ex = e.wx!==undefined?e.wx:e.x, ey=e.wy!==undefined?e.wy:e.y;
        if (Math.hypot(ex-p.x, ey-p.y) < 80) { e.slow = 2; G.damage(e, dmg, "player"); }
      }
    } else {
      // plant: heal player + thorns damage
      p.hp = Math.min(p.maxhp, p.hp + 8);
      for (const e of G.map.entities) {
        if (e.dead || e.kind==="resource") continue;
        const ex = e.wx!==undefined?e.wx:e.x, ey=e.wy!==undefined?e.wy:e.y;
        if (Math.hypot(ex-p.x, ey-p.y) < 90) { G.damage(e, dmg, "player"); }
      }
    }
    c.cooldown = 3;
    G.beep(500,0.1,"triangle");
  };

  // update creatures
  G.updateCreatures = function(dt) {
    for (const e of G.map.entities) {
      if (e.dead || e.kind!=="creature") continue;
      if (e.tamed) {
        if (e.cooldown>0) e.cooldown -= dt;
        // follow player if in party
        if (e.inParty && e.mode !== "stay") {
          const p = G.player;
          const dx = p.x - e.wx, dy = p.y - e.wy;
          const d = Math.hypot(dx,dy);
          if (d > 40) {
            const sp = G.data.creatures[e.species].speed;
            e.wx += (dx/d)*sp; e.wy += (dy/d)*sp;
          }
        }
        continue;
      }
      // wild AI
      e.cooldown = Math.max(0, (e.cooldown||0)-dt);
      if (e.slow>0) e.slow -= dt;
      const sp = G.data.creatures[e.species].speed * (e.slow>0?0.5:1);
      // state machine
      if (e.state === "idle") {
        if (Math.random() < 0.005) { e.state="wander"; e.wdx = G.rnd(-1,1); e.wdy = G.rnd(-1,1); e.wtimer = G.rnd(1,3); }
        // detect player proximity
        const d = Math.hypot(e.wx-G.player.x, e.wy-G.player.y);
        if (d < 120) { e.state = "chase"; }
      } else if (e.state === "wander") {
        e.wtimer -= dt;
        const tx = e.wx + e.wdx*sp, ty = e.wy + e.wdy*sp;
        if (G.canMoveWorld(tx,ty)) { e.wx=tx; e.wy=ty; }
        if (e.wtimer<=0) e.state="idle";
        const d = Math.hypot(e.wx-G.player.x, e.wy-G.player.y);
        if (d < 120) e.state="chase";
      } else if (e.state === "chase") {
        const dx = G.player.x - e.wx, dy = G.player.y - e.wy;
        const d = Math.hypot(dx,dy);
        if (d > 260) { e.state="idle"; }
        else if (d < 30) {
          // attack
          if (e.cooldown<=0) {
            const dmg = G.data.creatures[e.species].dmg;
            const mult = G.elemMult(G.data.creatures[e.species].element, (G.player.active>=0? G.data.creatures[G.player.party[G.player.active].species].element : null));
            G.damage(G.player, dmg*mult, "creature");
            e.cooldown = 1.2;
          }
        } else {
          e.wx += (dx/d)*sp; e.wy += (dy/d)*sp;
        }
      } else if (e.state === "flee") {
        const dx = e.wx - G.player.x, dy = e.wy - G.player.y;
        const d = Math.hypot(dx,dy)||1;
        e.wx += (dx/d)*sp*1.5; e.wy += (dy/d)*sp*1.5;
        e.ftime = (e.ftime||2)-dt;
        if (e.ftime<=0) { e.state="idle"; e.ftime=0; }
      }
      // sync tx/ty
      e.tx = Math.floor(e.wx/G.TILE); e.ty = Math.floor(e.wy/G.TILE);
    }
  };

  G.canMoveWorld = function(x,y) {
    const tx = Math.floor(x/G.TILE), ty = Math.floor(y/G.TILE);
    return G.walkable(tx,ty);
  };

  // tech beasts
  G.updateTech = function(dt) {
    for (const e of G.map.entities) {
      if (e.dead || e.kind!=="tech") continue;
      if (e.broken) continue;
      if (e.owner !== "player") continue;
      const spec = D.techBeasts[e.species];
      e.hp = Math.max(0, e.hp - 0.5*dt); // maintenance drain
      if (e.hp<=0) { e.broken=true; e.repaired=false; G.ui.msg(spec.name+" ran out of energy"); }
      // follow player slowly
      const p = G.player;
      const dx = p.x - e.wx, dy = p.y - e.wy;
      const d = Math.hypot(dx,dy);
      if (d > 60) {
        e.wx += (dx/d)*spec.speed; e.wy += (dy/d)*spec.speed;
      }
      // scout: reveal handled in ui minimap (range)
      // iron hound: auto attack near enemies
      if (spec.role === "combat") {
        let target = null, bd = 90;
        for (const en of G.map.entities) {
          if (en.dead || en.kind==="resource" || en.tamed || en.owner==="player") continue;
          const ex = en.wx!==undefined?en.wx:en.x, ey=en.wy!==undefined?en.wy:en.y;
          const dd = Math.hypot(ex-e.wx, ey-e.wy);
          if (dd < bd) { bd=dd; target=en; }
        }
        if (target && e.cooldown<=0) {
          const ex = target.wx!==undefined?target.wx:target.x, ey=target.wy!==undefined?target.wy:target.y;
          const l = Math.hypot(ex-e.wx, ey-e.wy)||1;
          G.spawnProjectile(e.wx, e.wy, (ex-e.wx)/l*6, (ey-e.wy)/l*6, 10, "player", "#94a3b8", 0.8);
          e.cooldown = 1.0;
        }
      }
      e.cooldown = Math.max(0, (e.cooldown||0)-dt);
    }
  };

  // boss
  G.updateBoss = function(dt) {
    const b = G.map.entities.find(e=>e.kind==="boss" && !e.dead);
    if (!b) return;
    b.cooldown = Math.max(0, (b.cooldown||0)-dt);
    const p = G.player;
    const dx = p.x - b.wx, dy = p.y - b.wy;
    const d = Math.hypot(dx,dy);
    if (d < 400) {
      // move toward player slowly
      if (d > 60) { b.wx += (dx/d)*1.0; b.wy += (dy/d)*1.0; }
      if (b.cooldown<=0) {
        // attack pattern: projectile burst
        for (let i=0;i<5;i++){
          const ang = Math.atan2(dy,dx) + (i-2)*0.25;
          G.spawnProjectile(b.wx, b.wy, Math.cos(ang)*5, Math.sin(ang)*5, 12, "boss", "#ef4444", 1.5);
        }
        b.cooldown = 2.2;
        G.beep(180,0.12,"sawtooth");
      }
    }
    if (b.hp < b.maxhp*0.5 && b.phase===1) { b.phase=2; b.cooldown=0; G.ui.msg("Boss enraged!"); }
    if (b.hp <= 0) {
      b.dead = true;
      G.ui.msg("Boss defeated! You win.");
      G.ui.showOverlay("VICTORY", "You defeated the Colossus and survived the island.");
      G.saveProgress({ bossDefeated: true });
      G.beep(880,0.3,"sine");
      setTimeout(()=>G.state="VICTORY", 1200);
    }
  };

  // projectiles
  G.updateProjectiles = function(dt) {
    for (const pr of G.projectiles) {
      pr.x += pr.vx; pr.y += pr.vy;
      pr.life -= dt;
      // collision with entities
      if (pr.owner === "player") {
        for (const e of G.map.entities) {
          if (e.dead || e.kind==="resource" || e.kind==="boss") continue;
          if (e.owner==="player" && e.kind==="tech") continue;
          const ex = e.wx!==undefined?e.wx:e.x, ey=e.wy!==undefined?e.wy:e.y;
          if (Math.hypot(ex-pr.x, ey-pr.y) < 12) {
            let dmg = pr.dmg;
            if (e.element) {
              // if player has active creature, use its element
              const p = G.player;
              if (p.active>=0) {
                const spec = D.creatures[p.party[p.active].species];
                dmg *= G.elemMult(spec.element, e.element);
              }
            }
            G.damage(e, dmg, "player");
            pr.life = 0;
          }
        }
        const b = G.map.entities.find(e=>e.kind==="boss" && !e.dead);
        if (b && Math.hypot(b.wx-pr.x, b.wy-pr.y) < 18) { G.damage(b, pr.dmg, "player"); pr.life=0; }
      } else {
        // boss/enemy projectile vs player
        const p = G.player;
        if (!p.dead && Math.hypot(p.x-pr.x, p.y-pr.y) < 12) {
          G.damage(p, pr.dmg, "enemy");
          pr.life = 0;
        }
      }
    }
    G.projectiles = G.projectiles.filter(pr => pr.life > 0);
  };

  // player dead
  G.playerDead = function() {
    const p = G.player;
    p.dead = true;
    G.state = "DEFEAT";
    G.ui.showOverlay("DEFEATED", "You did not survive the island.");
    G.beep(100,0.4,"sawtooth");
  };

  // update all
  G.updateEntities = function(dt) {
    G.updatePlayer(dt);
    if (G.player.dead) return;
    G.updateCreatures(dt);
    G.updateTech(dt);
    G.updateBoss(dt);
    G.updateProjectiles(dt);
    // knockback decay
    for (const e of G.map.entities) {
      if (e.kx) { 
        const ex = e.wx!==undefined? e : e;
        if (e.wx!==undefined){ e.wx += e.kx; e.wy += e.ky; }
        else { e.x += e.kx; e.y += e.ky; }
        e.kx *= 0.8; e.ky *= 0.8;
        if (Math.abs(e.kx)<0.05){e.kx=0;e.ky=0;}
      }
    }
  };
})();
