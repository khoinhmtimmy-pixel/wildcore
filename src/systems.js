// systems: crafting, fusion, game state, main loop hooks
window.G = window.G || {};
(function(){
  const G = window.G;
  const D = G.data;

  G.state = "MENU";

  G.craft = function(recipeId) {
    const p = G.player;
    const r = D.recipes.find(x=>x.id===recipeId);
    if (!r) return;
    for (const k in r.cost) if ((p.inventory[k]||0) < r.cost[k]) { G.ui.msg("Not enough "+k); return; }
    for (const k in r.cost) p.inventory[k] -= r.cost[k];
    if (r.effect === "weapon") { p.weapon = { name: r.name, dmg: r.dmg, ranged: !!r.ranged }; G.ui.msg("Crafted "+r.name); }
    else if (r.effect === "armor") { p.maxhp += r.hp; p.hp = Math.min(p.maxhp, p.hp+r.hp); p.armor += 2; G.ui.msg("Crafted "+r.name); }
    else if (r.effect === "trap") { p.inventory.trap = (p.inventory.trap||0)+1; G.ui.msg("Crafted "+r.name); }
    else if (r.effect === "module") { p.modules.push(r.module); G.ui.msg("Crafted module "+r.name); }
    G.ui.refreshInv();
    G.beep(440,0.1,"triangle");
  };

  G.attachModule = function(moduleId, creatureIndex) {
    const p = G.player;
    const c = p.party[creatureIndex];
    if (!c) { G.ui.msg("No creature"); return; }
    if (!c.modules) c.modules = [];
    if (c.modules.length >= 2) { G.ui.msg("No module slots"); return; }
    const idx = p.modules.indexOf(moduleId);
    if (idx < 0) { G.ui.msg("Module not in inventory"); return; }
    p.modules.splice(idx,1);
    c.modules.push(moduleId);
    // apply stat
    const mod = D.modules[moduleId];
    const spec = D.creatures[c.species];
    if (mod.stat === "speed") spec.speed += mod.value; // note: mutates base spec; acceptable for prototype
    if (mod.stat === "hp") { c.maxhp = (c.maxhp||spec.hp) + mod.value; c.hp = Math.min(c.maxhp, c.hp+mod.value); }
    G.ui.msg("Attached "+mod.name);
    G.beep(660,0.1,"sine");
  };

  G.startGame = function() {
    G.generateWorld();
    G.initPlayer();
    G.projectiles = [];
    G.zone = { cx: D.MAP_W/2, cy: D.MAP_H/2, r: Math.max(D.MAP_W,D.MAP_H)*0.7, targetR: 6, phase:0, timer: 60, shrinking:false };
    G.state = "PLAYING";
    G.ui.hideOverlay();
  };

  // main loop
  let last = 0;
  G.loop = function(ts) {
    const dt = Math.min(0.05, (ts-last)/1000 || 0.016);
    last = ts;
    if (G.state === "PLAYING") {
      G.updateEntities(dt);
      G.updateZone(dt);
      G.ui.update(dt);
    }
    G.render(dt);
    requestAnimationFrame(G.loop);
  };
})();
