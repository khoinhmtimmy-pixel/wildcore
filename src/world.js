// world: tilemap, generation, spawns, zone
window.G = window.G || {};
(function(){
  const G = window.G;
  const D = G.data;
  const W = D.MAP_W, H = D.MAP_H;

  // tile grid: {type, elev, walkable}
  G.map = { w: W, h: H, tiles: [], entities: [] };

  const TYPES = {
    grass:   { color: "#2f6b3a", walk: true,  elev: 0 },
    dirt:    { color: "#6b5a3a", walk: true,  elev: 0 },
    stone:   { color: "#5a6270", walk: true,  elev: 0 },
    water:   { color: "#1e4f7a", walk: false, elev: -1 },
    ruin:    { color: "#4a4a52", walk: true,  elev: 0 },
    crystal: { color: "#3b2f6b", walk: true,  elev: 0 },
    sand:    { color: "#a39060", walk: true,  elev: 0 }
  };

  function idx(x,y){ return y*W + x; }
  function inBounds(x,y){ return x>=0 && y>=0 && x<W && y<H; }

  G.tileAt = function(tx,ty){
    if(!inBounds(tx,ty)) return null;
    return G.map.tiles[idx(tx,ty)];
  };
  G.walkable = function(tx,ty){
    const t = G.tileAt(tx,ty);
    return !!t && TYPES[t.type].walk;
  };

  // generate map with biomes
  G.generateWorld = function() {
    const tiles = [];
    // base grass
    for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
      tiles.push({ type: "grass", elev: 0 });
    }
    // water pond
    for (let i=0;i<40;i++){
      const cx = 6+Math.floor(Math.random()*8), cy = 20+Math.floor(Math.random()*8);
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
        if (dx*dx+dy*dy<=5 && inBounds(cx+dx,cy+dy)) tiles[idx(cx+dx,cy+dy)].type="water";
      }
    }
    // dirt paths
    for (let i=0;i<200;i++){
      const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
      if (tiles[idx(x,y)].type==="grass") tiles[idx(x,y)].type="dirt";
    }
    // ruin area (ironfall) top-right
    for (let y=4;y<14;y++) for(let x=20;x<32;x++){
      if (Math.random()<0.7) tiles[idx(x,y)].type="ruin";
    }
    // crystal area (corelands) bottom
    for (let y=24;y<33;y++) for(let x=10;x<24;x++){
      if (Math.random()<0.5) tiles[idx(x,y)].type="crystal";
    }
    // stone clusters
    for (let i=0;i<30;i++){
      const cx=Math.floor(Math.random()*W), cy=Math.floor(Math.random()*H);
      for(let d=0;d<4;d++){
        const x=cx+Math.floor(Math.random()*3)-1, y=cy+Math.floor(Math.random()*3)-1;
        if(inBounds(x,y) && tiles[idx(x,y)].type==="grass") tiles[idx(x,y)].type="stone";
      }
    }
    // elevation hills
    for (let i=0;i<6;i++){
      const cx=Math.floor(Math.random()*W), cy=Math.floor(Math.random()*H);
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
        if (dx*dx+dy*dy<=4 && inBounds(cx+dx,cy+dy)){
          const t=tiles[idx(cx+dx,cy+dy)];
          if (TYPES[t.type].walk) t.elev = 1;
        }
      }
    }
    G.map.tiles = tiles;
    G.map.types = TYPES;

    // spawns
    G.map.entities = [];
    // resource nodes
    const resTypes = ["wood","ore","crystal","parts"];
    for (let i=0;i<60;i++){
      const x = Math.floor(Math.random()*W), y = Math.floor(Math.random()*H);
      const t = tiles[idx(x,y)];
      if (!TYPES[t.type].walk) continue;
      let rtype = "wood";
      if (t.type==="stone") rtype="ore";
      else if (t.type==="crystal") rtype="crystal";
      else if (t.type==="ruin") rtype="parts";
      else rtype = G.choice(["wood","wood","wood","ore"]);
      G.map.entities.push({ kind:"resource", type:rtype, tx:x, ty:y, wx:x*G.TILE+G.TILE/2, wy:y*G.TILE+G.TILE/2, amount: 3+Math.floor(Math.random()*4), alive:true });
    }
    // creatures (wild)
    const ckeys = Object.keys(D.creatures);
    for (let i=0;i<12;i++){
      const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
      const t=tiles[idx(x,y)];
      if (!TYPES[t.type].walk) continue;
      const ck = G.choice(ckeys);
      G.map.entities.push({ kind:"creature", species:ck, tx:x, ty:y, wx:x*G.TILE+G.TILE/2, wy:y*G.TILE+G.TILE/2, hp:D.creatures[ck].hp, maxhp:D.creatures[ck].hp, tamed:false, state:"idle", cooldown:0, level:1 });
    }
    // tech beasts (broken)
    const tkeys = Object.keys(D.techBeasts);
    for (let i=0;i<5;i++){
      const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
      const t=tiles[idx(x,y)];
      if (!TYPES[t.type].walk) continue;
      const tk = G.choice(tkeys);
      G.map.entities.push({ kind:"tech", species:tk, tx:x, ty:y, wx:x*G.TILE+G.TILE/2, wy:y*G.TILE+G.TILE/2, hp:0, maxhp:D.techBeasts[tk].hp, broken:true, repaired:false, state:"idle" });
    }
    // boss
    G.map.entities.push({ kind:"boss", species:"colossus", tx:26, ty:28, wx:26*G.TILE+G.TILE/2, wy:28*G.TILE+G.TILE/2, hp:400, maxhp:400, phase:1, state:"idle", cooldown:0 });
    // player spawn
    G.playerSpawn = { x: 4*G.TILE+G.TILE/2, y: 4*G.TILE+G.TILE/2 };
  };

  // zone (shrinking circle) in tile coords center
  G.zone = { cx: W/2, cy: H/2, r: Math.max(W,H)*0.7, targetR: 6, phase:0, timer: 60, shrinking:false };
  G.updateZone = function(dt) {
    const z = G.zone;
    z.timer -= dt;
    if (z.timer <= 0) {
      z.phase++;
      z.timer = Math.max(20, 60 - z.phase*8);
      z.shrinking = true;
      z.targetR = Math.max(6, z.r - 6);
    }
    if (z.shrinking) {
      z.r += (z.targetR - z.r) * Math.min(1, dt*0.5);
      if (Math.abs(z.r - z.targetR) < 0.1) { z.r = z.targetR; z.shrinking = false; }
    }
  };
  G.inZone = function(wx,wy){
    const z=G.zone;
    const tx=wx/G.TILE, ty=wy/G.TILE;
    const d = Math.hypot(tx-z.cx, ty-z.cy);
    return d <= z.r;
  };

  // find nearest entity
  G.nearest = function(kind, wx,wy, range) {
    let best=null, bd=range||9999;
    for (const e of G.map.entities) {
      if (e.kind!==kind || e.dead) continue;
      const d = Math.hypot(e.wx-wx, e.wy-wy);
      if (d<bd){bd=d;best=e;}
    }
    return best;
  };
})();
