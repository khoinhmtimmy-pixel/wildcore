// WILDCORE: EXTINCTION — data definitions
window.G = window.G || {};
G.data = {
  TILE: 32, // world px per tile (isometric diamond)
  MAP_W: 34,
  MAP_H: 34,
  // resource types
  resources: {
    wood:    { name: "Wood",    color: "#8b5a2b", icon: "W" },
    ore:     { name: "Ore",     color: "#94a3b8", icon: "O" },
    crystal: { name: "Crystal", color: "#a78bfa", icon: "C" },
    parts:   { name: "Parts",   color: "#f59e0b", icon: "P" }
  },
  creatures: {
    emberFox:  { name: "Ember Fox",  element: "fire",   color: "#f97316", hp: 60,  dmg: 12, speed: 1.6, tamingFood: "wood",    desc: "Fast fire striker." },
    tideLynx:  { name: "Tide Lynx",  element: "water",  color: "#38bdf8", hp: 70,  dmg: 10, speed: 1.4, tamingFood: "crystal", desc: "Slows enemies." },
    brambleBoar:{ name: "Bramble Boar", element: "plant", color: "#22c55e", hp: 90, dmg: 8,  speed: 1.0, tamingFood: "wood",    desc: "Tanky defender." }
  },
  techBeasts: {
    scoutDrone: { name: "Scout Drone", color: "#64748b", hp: 50, speed: 2.0, role: "recon", repair: { parts: 2, crystal: 1 } },
    ironHound:  { name: "Iron Hound",  color: "#475569", hp: 110, speed: 1.2, role: "combat", repair: { parts: 4, ore: 2 } }
  },
  modules: {
    speedDash: { name: "Speed Dash", color: "#22d3ee", stat: "speed", value: 0.4 },
    armorPlate:{ name: "Armor Plate", color: "#94a3b8", stat: "hp",    value: 30 },
    sensor:    { name: "Sensor",      color: "#fbbf24", stat: "detect",value: 1 }
  },
  recipes: [
    { id: "club",     name: "Wood Club",   cost: { wood: 5 },                 effect: "weapon",  dmg: 15 },
    { id: "bow",      name: "Crystal Bow", cost: { wood: 3, crystal: 2 },     effect: "weapon",  dmg: 22, ranged: true },
    { id: "armor",    name: "Ore Armor",   cost: { ore: 6 },                  effect: "armor",   hp: 40 },
    { id: "trap",     name: "Snare Trap",  cost: { wood: 4, parts: 1 },       effect: "trap",    dmg: 20 },
    { id: "speedMod", name: "Speed Module",cost: { parts: 2, crystal: 1 },    effect: "module",  module: "speedDash" },
    { id: "armorMod", name: "Armor Module",cost: { parts: 2, ore: 2 },        effect: "module",  module: "armorPlate" },
    { id: "sensorMod",name: "Sensor Module",cost:{ parts: 3, crystal: 2 },   effect: "module",  module: "sensor" }
  ],
  elements: { fire: 0, water: 1, plant: 2 },
  // element advantage: fire > plant, plant > water, water > fire
  elemAdv: { fire: "plant", plant: "water", water: "fire" }
};
G.saveKey = "wildcore_save_v1";
G.loadSave = function() {
  try { return JSON.parse(localStorage.getItem(G.saveKey) || "{}"); } catch (e) { return {}; }
};
G.saveProgress = function(d) {
  try { localStorage.setItem(G.saveKey, JSON.stringify(d)); } catch (e) {}
};
