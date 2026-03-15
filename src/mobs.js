import * as THREE from "three";
import { CHUNK_SIZE } from "./world.js";

const geometryCache = new Map();
const materialCache = new Map();

function hashInt(x, z, seed = 1337) {
  let value = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1);
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return value >>> 0;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function getGeometry(width, height, depth) {
  const key = `${width}:${height}:${depth}`;
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
  }
  return geometryCache.get(key);
}

function getMaterial(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
    }));
  }
  return materialCache.get(color);
}

function addBox(parent, width, height, depth, x, y, z, color) {
  const mesh = new THREE.Mesh(getGeometry(width, height, depth), getMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function getPalette(type, variant) {
  if (type === "zombie") {
    return {
      temperate: { skin: "#6f9f68", cloth: "#3e5a9d", dark: "#2a3c5e" },
      warm: { skin: "#8ba45f", cloth: "#7c5d2f", dark: "#4f3d21" },
      cold: { skin: "#7aa19c", cloth: "#5470a5", dark: "#344766" },
    }[variant];
  }

  if (type === "skeleton") {
    return {
      temperate: { bone: "#e4e6e8", dark: "#a7acb0" },
      warm: { bone: "#e3d9c4", dark: "#a89f8c" },
      cold: { bone: "#d6dde7", dark: "#9ba7b5" },
    }[variant];
  }

  if (type === "pig") {
    return {
      temperate: { body: "#d98da5", accent: "#f3bcc9", dark: "#b46f82" },
      warm: { body: "#d8a27e", accent: "#e8c8a7", dark: "#a27250" },
      cold: { body: "#d8c2c8", accent: "#f0dce0", dark: "#b5969f" },
    }[variant];
  }

  if (type === "cow") {
    return {
      temperate: { body: "#6d4d3d", patch: "#f2efe6", hoof: "#30231c", horn: "#d1c09c" },
      warm: { body: "#9d6c3c", patch: "#f2ddb2", hoof: "#533521", horn: "#d1c09c" },
      cold: { body: "#5a4f4b", patch: "#dee4ea", hoof: "#2a2422", horn: "#d1c09c" },
    }[variant];
  }

  if (type === "sheep") {
    return {
      white: { wool: "#f0f0ea", face: "#5c4d43", leg: "#473931" },
      brown: { wool: "#8d6a49", face: "#4b3629", leg: "#3c2a21" },
      gray: { wool: "#aab0b4", face: "#59565a", leg: "#424045" },
    }[variant];
  }

  return {
    temperate: { body: "#f4efe8", accent: "#d7a03e", comb: "#c94f4f", dark: "#d5b26d" },
    warm: { body: "#d8c3a1", accent: "#d39a42", comb: "#b9544e", dark: "#cda365" },
    cold: { body: "#b7c3d1", accent: "#d6a14a", comb: "#be6666", dark: "#bca06f" },
  }[variant];
}

function createPig(variant) {
  const palette = getPalette("pig", variant);
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  const legs = [];

  addBox(group, 0.98, 0.62, 0.52, 0, 0.72, 0, palette.body);
  addBox(group, 0.92, 0.16, 0.46, 0, 0.98, 0, palette.accent);
  group.add(headPivot);
  headPivot.position.set(0, 0.72, 0.34);
  addBox(headPivot, 0.44, 0.4, 0.42, 0, 0.02, 0.24, palette.body);
  addBox(headPivot, 0.22, 0.18, 0.16, 0, -0.04, 0.52, palette.accent);
  addBox(headPivot, 0.06, 0.06, 0.02, -0.09, 0.07, 0.44, "#1e1b1c");
  addBox(headPivot, 0.06, 0.06, 0.02, 0.09, 0.07, 0.44, "#1e1b1c");
  const carrot = new THREE.Group();
  carrot.position.set(0, -0.03, 0.58);
  headPivot.add(carrot);
  addBox(carrot, 0.16, 0.06, 0.06, 0, 0, 0, "#d27b2a");
  addBox(carrot, 0.08, 0.06, 0.04, 0.11, 0.02, 0, "#86b745");

  const legOffsets = [
    [-0.28, 0.22, -0.16],
    [0.28, 0.22, -0.16],
    [-0.28, 0.22, 0.16],
    [0.28, 0.22, 0.16],
  ];

  legOffsets.forEach(([x, y, z]) => {
    legs.push(addBox(group, 0.16, 0.44, 0.16, x, y, z, palette.dark));
  });

  return { group, legs, headPivot };
}

function createCow(variant) {
  const palette = getPalette("cow", variant);
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  const legs = [];

  addBox(group, 1.08, 0.74, 0.56, 0, 0.86, 0, palette.body);
  addBox(group, 0.98, 0.52, 0.2, 0, 0.92, -0.08, palette.patch);
  group.add(headPivot);
  headPivot.position.set(0, 0.9, 0.42);
  addBox(headPivot, 0.52, 0.48, 0.44, 0, 0, 0.24, palette.body);
  addBox(headPivot, 0.2, 0.08, 0.08, -0.15, 0.18, 0.48, palette.horn);
  addBox(headPivot, 0.2, 0.08, 0.08, 0.15, 0.18, 0.48, palette.horn);
  addBox(headPivot, 0.42, 0.2, 0.12, 0, -0.04, 0.52, palette.patch);
  addBox(headPivot, 0.06, 0.06, 0.02, -0.12, 0.08, 0.45, "#1a1a1a");
  addBox(headPivot, 0.06, 0.06, 0.02, 0.12, 0.08, 0.45, "#1a1a1a");
  const bell = new THREE.Group();
  bell.position.set(0, 0.55, 0.35);
  group.add(bell);
  addBox(bell, 0.36, 0.06, 0.08, 0, 0, 0, "#866d3f");
  addBox(bell, 0.12, 0.12, 0.12, 0, -0.08, 0, "#d5b24d");

  const legOffsets = [
    [-0.32, 0.28, -0.18],
    [0.32, 0.28, -0.18],
    [-0.32, 0.28, 0.18],
    [0.32, 0.28, 0.18],
  ];

  legOffsets.forEach(([x, y, z]) => {
    legs.push(addBox(group, 0.18, 0.58, 0.18, x, y, z, palette.hoof));
  });

  return { group, legs, headPivot };
}

function createSheep(variant) {
  const palette = getPalette("sheep", variant);
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  const legs = [];

  addBox(group, 1.08, 0.78, 0.62, 0, 0.84, 0, palette.wool);
  addBox(group, 0.78, 0.48, 0.32, 0, 0.88, -0.02, "#ffffff");
  group.add(headPivot);
  headPivot.position.set(0, 0.82, 0.42);
  addBox(headPivot, 0.38, 0.42, 0.36, 0, -0.04, 0.18, palette.face);
  addBox(headPivot, 0.26, 0.22, 0.18, 0, -0.1, 0.42, palette.face);
  addBox(headPivot, 0.5, 0.32, 0.42, 0, 0.04, 0.08, palette.wool);
  addBox(headPivot, 0.06, 0.06, 0.02, -0.08, 0.03, 0.39, "#171719");
  addBox(headPivot, 0.06, 0.06, 0.02, 0.08, 0.03, 0.39, "#171719");
  addBox(group, 0.18, 0.18, 0.18, -0.34, 1.08, -0.12, palette.wool);
  addBox(group, 0.18, 0.18, 0.18, 0.34, 1.08, -0.12, palette.wool);

  const legOffsets = [
    [-0.3, 0.24, -0.18],
    [0.3, 0.24, -0.18],
    [-0.3, 0.24, 0.18],
    [0.3, 0.24, 0.18],
  ];

  legOffsets.forEach(([x, y, z]) => {
    legs.push(addBox(group, 0.16, 0.48, 0.16, x, y, z, palette.leg));
  });

  return { group, legs, headPivot };
}

function createChicken(variant) {
  const palette = getPalette("chicken", variant);
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  const legs = [];

  addBox(group, 0.48, 0.56, 0.42, 0, 0.58, 0, palette.body);
  addBox(group, 0.14, 0.28, 0.12, -0.22, 0.58, 0, palette.body);
  addBox(group, 0.14, 0.28, 0.12, 0.22, 0.58, 0, palette.body);
  group.add(headPivot);
  headPivot.position.set(0, 0.82, 0.1);
  addBox(headPivot, 0.28, 0.3, 0.28, 0, 0.02, 0.22, palette.body);
  addBox(headPivot, 0.16, 0.08, 0.16, 0, -0.04, 0.42, palette.accent);
  addBox(headPivot, 0.12, 0.16, 0.12, 0, 0.2, 0.24, palette.comb);
  addBox(headPivot, 0.05, 0.05, 0.02, -0.06, 0.08, 0.34, "#151515");
  addBox(headPivot, 0.05, 0.05, 0.02, 0.06, 0.08, 0.34, "#151515");
  const seedPouch = new THREE.Group();
  seedPouch.position.set(0, 0.52, -0.18);
  group.add(seedPouch);
  addBox(seedPouch, 0.14, 0.12, 0.1, 0, 0, 0, "#8a6a42");
  addBox(seedPouch, 0.04, 0.04, 0.03, -0.03, 0.01, 0.06, "#d9c063");
  addBox(seedPouch, 0.04, 0.04, 0.03, 0.03, -0.01, 0.06, "#d9c063");

  const legOffsets = [
    [-0.08, 0.18, 0.02],
    [0.08, 0.18, 0.02],
  ];

  legOffsets.forEach(([x, y, z]) => {
    const upper = new THREE.Group();
    upper.position.set(x, y, z);
    group.add(upper);
    legs.push(upper);
    addBox(upper, 0.06, 0.34, 0.06, 0, 0, 0, palette.dark);
  });

  return { group, legs, headPivot };
}

function createZombie(variant) {
  const palette = getPalette("zombie", variant);
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  const legs = [];

  addBox(group, 0.72, 0.9, 0.34, 0, 0.92, 0, palette.cloth);
  addBox(group, 0.76, 0.22, 0.38, 0, 0.38, 0, palette.dark);
  group.add(headPivot);
  headPivot.position.set(0, 1.36, 0.04);
  addBox(headPivot, 0.46, 0.46, 0.46, 0, 0, 0, palette.skin);
  addBox(headPivot, 0.08, 0.08, 0.02, -0.12, 0.05, 0.24, "#1f2630");
  addBox(headPivot, 0.08, 0.08, 0.02, 0.12, 0.05, 0.24, "#1f2630");
  addBox(headPivot, 0.22, 0.04, 0.02, 0, -0.1, 0.24, "#344f2e");
  addBox(group, 0.14, 0.72, 0.14, -0.42, 1.02, 0, palette.skin);
  addBox(group, 0.14, 0.72, 0.14, 0.42, 1.02, 0, palette.skin);
  addBox(group, 0.22, 0.12, 0.08, 0.25, 1.06, 0.08, "#5d7488");
  const club = new THREE.Group();
  club.position.set(0.46, 0.78, 0.12);
  group.add(club);
  addBox(club, 0.08, 0.42, 0.08, 0, -0.06, 0, "#8e6339");
  addBox(club, 0.16, 0.12, 0.16, 0, 0.2, 0, "#66707a");

  const legOffsets = [
    [-0.18, 0.42, 0],
    [0.18, 0.42, 0],
  ];
  legOffsets.forEach(([x, y, z]) => {
    legs.push(addBox(group, 0.18, 0.76, 0.18, x, y, z, palette.cloth));
  });

  return { group, legs, headPivot };
}

function createSkeleton(variant) {
  const palette = getPalette("skeleton", variant);
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  const legs = [];

  addBox(group, 0.58, 0.82, 0.2, 0, 0.95, 0, palette.bone);
  group.add(headPivot);
  headPivot.position.set(0, 1.36, 0.02);
  addBox(headPivot, 0.42, 0.42, 0.42, 0, 0, 0, palette.bone);
  addBox(headPivot, 0.08, 0.08, 0.02, -0.11, 0.04, 0.22, "#202326");
  addBox(headPivot, 0.08, 0.08, 0.02, 0.11, 0.04, 0.22, "#202326");
  addBox(headPivot, 0.14, 0.04, 0.02, 0, -0.1, 0.22, "#73787c");
  addBox(group, 0.1, 0.76, 0.1, -0.34, 1.02, 0, palette.bone);
  addBox(group, 0.1, 0.76, 0.1, 0.34, 1.02, 0, palette.bone);
  const bow = new THREE.Group();
  bow.position.set(-0.4, 0.95, 0.06);
  group.add(bow);
  addBox(bow, 0.06, 0.48, 0.06, 0, 0, 0, "#7b5a36");
  addBox(bow, 0.02, 0.52, 0.02, 0.05, 0, 0, "#d9d4c2");

  const legOffsets = [
    [-0.12, 0.42, 0],
    [0.12, 0.42, 0],
  ];
  legOffsets.forEach(([x, y, z]) => {
    legs.push(addBox(group, 0.1, 0.78, 0.1, x, y, z, palette.dark));
  });

  return { group, legs, headPivot };
}

function createMobMesh(type, variant) {
  if (type === "zombie") {
    return createZombie(variant);
  }
  if (type === "skeleton") {
    return createSkeleton(variant);
  }
  if (type === "pig") {
    return createPig(variant);
  }
  if (type === "cow") {
    return createCow(variant);
  }
  if (type === "sheep") {
    return createSheep(variant);
  }
  return createChicken(variant);
}

function lerpAngle(from, to, alpha) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * alpha;
}

function pickPassiveType(surface, rng) {
  if (surface.isUnderwater) {
    return null;
  }

  if (surface.biome === "desert") {
    if (surface.blockType !== "sand") {
      return null;
    }
    return rng() > 0.5 ? "pig" : "chicken";
  }

  if (surface.biome === "savanna") {
    const roll = rng();
    if (roll < 0.5) return "cow";
    if (roll < 0.85) return "pig";
    return "chicken";
  }

  if (surface.biome === "snow" || surface.biome === "taiga") {
    const roll = rng();
    if (roll < 0.4) return "sheep";
    if (roll < 0.7) return "cow";
    return "chicken";
  }

  if (surface.biome === "forest") {
    const roll = rng();
    if (roll < 0.32) return "pig";
    if (roll < 0.62) return "cow";
    if (roll < 0.84) return "sheep";
    return "chicken";
  }

  if (surface.biome === "mountains") {
    const roll = rng();
    if (roll < 0.5) return "sheep";
    if (roll < 0.8) return "cow";
    return "chicken";
  }

  if (surface.biome === "swamp") {
    const roll = rng();
    if (roll < 0.5) return "pig";
    if (roll < 0.75) return "chicken";
    return "sheep";
  }

  const roll = rng();
  if (roll < 0.28) return "cow";
  if (roll < 0.54) return "pig";
  if (roll < 0.8) return "sheep";
  return "chicken";
}

function pickHostileType(surface, rng) {
  if (
    surface.isUnderwater ||
    (surface.blockType !== "grass" && surface.blockType !== "sand" && surface.blockType !== "stone")
  ) {
    return null;
  }
  if (surface.biome === "snow" || surface.biome === "taiga" || surface.biome === "mountains") {
    return rng() > 0.45 ? "skeleton" : "zombie";
  }
  return rng() > 0.6 ? "zombie" : "skeleton";
}

function pickVariant(type, biome) {
  if (type === "sheep") {
    if (biome === "desert" || biome === "savanna") return "brown";
    if (biome === "snow" || biome === "taiga" || biome === "mountains") return "gray";
    return "white";
  }

  if (biome === "desert" || biome === "savanna") {
    return "warm";
  }
  if (biome === "snow" || biome === "taiga" || biome === "mountains") {
    return "cold";
  }
  return "temperate";
}

function surfaceTopY(surface) {
  return surface.y + 1.02;
}

function createHealthBar() {
  const root = new THREE.Group();
  root.position.set(0, 1.55, 0);

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.11),
    new THREE.MeshBasicMaterial({
      color: "#241314",
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }),
  );
  background.renderOrder = 7;
  root.add(background);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.07),
    new THREE.MeshBasicMaterial({
      color: "#49cf62",
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  );
  fill.position.z = 0.002;
  fill.renderOrder = 8;
  root.add(fill);

  return { root, fill };
}

export class AnimalManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mobs = new Map();
    this.chunkMobIds = new Map();
    this.populationTimer = 0;
  }

  getMobCount() {
    return this.mobs.size;
  }

  getMobCounts() {
    let passive = 0;
    let hostile = 0;
    this.mobs.forEach((mob) => {
      if (mob.hostile) {
        hostile += 1;
      } else {
        passive += 1;
      }
    });
    return { passive, hostile, total: passive + hostile };
  }

  syncPopulation() {
    const loadedChunks = this.world.getLoadedChunks();
    const loadedKeys = new Set(loadedChunks.map((chunk) => chunk.key));

    for (const [chunkKey, mobIds] of this.chunkMobIds.entries()) {
      if (loadedKeys.has(chunkKey)) {
        continue;
      }

      mobIds.forEach((mobId) => {
        const mob = this.mobs.get(mobId);
        if (mob) {
          this.scene.remove(mob.group);
          this.mobs.delete(mobId);
        }
      });
      this.chunkMobIds.delete(chunkKey);
    }

    loadedChunks.forEach((chunk) => {
      if (!this.chunkMobIds.has(chunk.key)) {
        this.spawnChunkMobs(chunk);
      }
    });
  }

  spawnChunkMobs(chunk) {
    const rng = createRng(hashInt(chunk.chunkX, chunk.chunkZ, 7109));
    const herdCount =
      rng() < 0.48
        ? 0
        : 1 + (rng() > 0.82 ? 1 : 0);
    const hostilePackCount = rng() > 0.78 ? 1 : 0;

    const mobIds = [];
    const baseX = chunk.chunkX * CHUNK_SIZE;
    const baseZ = chunk.chunkZ * CHUNK_SIZE;

    for (let herdIndex = 0; herdIndex < herdCount; herdIndex += 1) {
      const herdX = baseX + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
      const herdZ = baseZ + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
      const centerSurface = this.world.getSurfaceInfo(herdX, herdZ);
      const type = pickPassiveType(centerSurface, rng);

      if (!type) {
        continue;
      }

      const herdSize = 1 + (rng() > 0.55 ? 1 : 0) + (type === "sheep" && rng() > 0.76 ? 1 : 0);
      for (let member = 0; member < herdSize; member += 1) {
        const candidateX = herdX + Math.round((rng() - 0.5) * 4);
        const candidateZ = herdZ + Math.round((rng() - 0.5) * 4);
        const surface = this.world.getSurfaceInfo(candidateX, candidateZ);

        if (
          surface.isUnderwater ||
          Math.abs(surface.y - centerSurface.y) > 1 ||
          (surface.blockType !== "grass" && surface.blockType !== "sand" && surface.blockType !== "stone")
        ) {
          continue;
        }

        const variant = pickVariant(type, surface.biome);
        const id = `${chunk.key}:${herdIndex}:${member}`;
        const mob = this.createMob({
          id,
          type,
          variant,
          x: candidateX + 0.5,
          y: surfaceTopY(surface),
          z: candidateZ + 0.5,
          seed: hashInt(candidateX, candidateZ, 1973),
        });

        this.scene.add(mob.group);
        this.mobs.set(id, mob);
        mobIds.push(id);
      }
    }

    for (let hostileIndex = 0; hostileIndex < hostilePackCount; hostileIndex += 1) {
      const spawnX = baseX + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
      const spawnZ = baseZ + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
      const surface = this.world.getSurfaceInfo(spawnX, spawnZ);
      const hostileType = pickHostileType(surface, rng);
      if (!hostileType) {
        continue;
      }

      const id = `${chunk.key}:hostile:${hostileIndex}`;
      const mob = this.createMob({
        id,
        type: hostileType,
        variant: pickVariant(hostileType, surface.biome),
        x: spawnX + 0.5,
        y: surfaceTopY(surface),
        z: spawnZ + 0.5,
        seed: hashInt(spawnX, spawnZ, 3907),
      });
      this.scene.add(mob.group);
      this.mobs.set(id, mob);
      mobIds.push(id);
    }

    this.chunkMobIds.set(chunk.key, mobIds);
  }

  createMob({ id, type, variant, x, y, z, seed }) {
    const { group, legs, headPivot } = createMobMesh(type, variant);
    const rng = createRng(seed);
    const healthBar = createHealthBar();
    const hostile = type === "zombie" || type === "skeleton";
    const maxHealth = hostile ? (type === "zombie" ? 12 : 10) : type === "chicken" ? 4 : type === "sheep" ? 5 : 6;
    const attackDamage = type === "zombie" ? 3 : type === "skeleton" ? 2 : 0;
    group.position.set(x, y, z);
    group.rotation.y = rng() * Math.PI * 2;
    group.add(healthBar.root);
    group.userData.mobId = id;
    group.traverse((child) => {
      child.userData.mobId = id;
    });

    return {
      id,
      type,
      variant,
      hostile,
      group,
      health: maxHealth,
      maxHealth,
      healthBar,
      legs,
      headPivot,
      rng,
      homeX: x,
      homeZ: z,
      heading: group.rotation.y,
      state: "idle",
      stateTimer: 1 + rng() * 2,
      speed: hostile ? 1.05 + rng() * 0.24 : type === "chicken" ? 0.55 : 0.8 + rng() * 0.22,
      phase: rng() * Math.PI * 2,
      animationTime: rng() * Math.PI * 2,
      deathTimer: 0,
      deathSpinDirection: rng() > 0.5 ? 1 : -1,
      attackRange: hostile ? 1.45 : 0,
      attackCooldown: 0.8 + rng() * 0.4,
      attackDamage,
    };
  }

  update(delta, playerPosition, onPlayerDamage = null, playerMode = "survival") {
    this.populationTimer -= delta;
    if (this.populationTimer <= 0) {
      this.syncPopulation();
      this.populationTimer = 1;
    }

    for (const mob of this.mobs.values()) {
      this.updateMob(mob, delta, playerPosition, onPlayerDamage, playerMode);
    }
  }

  getTargetMeshes() {
    return [...this.mobs.values()]
      .filter((mob) => mob.state !== "dying")
      .map((mob) => mob.group);
  }

  resolveHit(hit) {
    const mob = hit?.object?.parent?.userData?.mobId
      ? this.mobs.get(hit.object.parent.userData.mobId) ?? null
      : hit?.object?.userData?.mobId
        ? this.mobs.get(hit.object.userData.mobId) ?? null
        : null;
    return mob && mob.state !== "dying" ? mob : null;
  }

  updateHealthBar(mob) {
    const ratio = THREE.MathUtils.clamp(mob.health / mob.maxHealth, 0, 1);
    const clamped = Math.max(0.001, ratio);
    mob.healthBar.fill.scale.x = clamped;
    mob.healthBar.fill.position.x = (clamped - 1) * 0.33;
    if (ratio > 0.6) {
      mob.healthBar.fill.material.color.set("#49cf62");
    } else if (ratio > 0.3) {
      mob.healthBar.fill.material.color.set("#d8b53f");
    } else {
      mob.healthBar.fill.material.color.set("#d15858");
    }
  }

  despawnMob(mob) {
    this.scene.remove(mob.group);
    this.mobs.delete(mob.id);

    for (const [chunkKey, mobIds] of this.chunkMobIds.entries()) {
      const index = mobIds.indexOf(mob.id);
      if (index >= 0) {
        mobIds.splice(index, 1);
        if (mobIds.length === 0) {
          this.chunkMobIds.delete(chunkKey);
        }
        break;
      }
    }
  }

  damageMob(mobId, damage) {
    const mob = this.mobs.get(mobId);
    if (!mob || mob.state === "dying") {
      return null;
    }

    mob.health -= damage;
    this.updateHealthBar(mob);

    if (mob.health > 0) {
      if (mob.hostile) {
        mob.state = "chase";
        mob.stateTimer = 1.1;
      } else {
        mob.state = "flee";
        mob.stateTimer = 1.4;
        mob.heading += Math.PI;
      }
      return { defeated: false, mob };
    }

    mob.health = 0;
    mob.state = "dying";
    mob.stateTimer = 0;
    mob.deathTimer = 0.55;
    mob.healthBar.root.visible = false;

    return { defeated: true, mob };
  }

  updateMob(mob, delta, playerPosition, onPlayerDamage, playerMode) {
    const position = mob.group.position;
    if (mob.state === "dying") {
      mob.deathTimer -= delta;
      mob.group.rotation.z += delta * 8 * mob.deathSpinDirection;
      mob.group.position.y -= delta * 1.4;
      const scale = Math.max(0.05, mob.group.scale.x - delta * 1.9);
      mob.group.scale.setScalar(scale);
      if (mob.deathTimer <= 0) {
        this.despawnMob(mob);
      }
      return;
    }

    mob.healthBar.root.lookAt(playerPosition);
    const distanceToPlayer = position.distanceTo(playerPosition);
    const distanceFromHome = Math.hypot(position.x - mob.homeX, position.z - mob.homeZ);
    mob.attackCooldown = Math.max(0, mob.attackCooldown - delta);

    if (mob.hostile) {
      if (playerMode !== "creative" && distanceToPlayer < 10.5) {
        mob.state = "chase";
        mob.heading = Math.atan2(playerPosition.x - position.x, playerPosition.z - position.z);
        mob.stateTimer = 0.45;
      } else if (mob.state === "chase" && distanceToPlayer >= 12) {
        mob.state = "wander";
        mob.stateTimer = 1.1;
      }

      if (playerMode !== "creative" && distanceToPlayer < mob.attackRange && mob.attackCooldown <= 0) {
        mob.attackCooldown = 0.95 + mob.rng() * 0.45;
        if (onPlayerDamage) {
          onPlayerDamage(mob.attackDamage, mob.type);
        }
      }
    } else if (distanceToPlayer < 3.2) {
      mob.state = "flee";
      mob.heading = Math.atan2(position.x - playerPosition.x, position.z - playerPosition.z);
      mob.stateTimer = 1.1 + mob.rng() * 0.9;
    } else if (distanceFromHome > 6.5) {
      mob.state = "wander";
      mob.heading = Math.atan2(mob.homeX - position.x, mob.homeZ - position.z);
      mob.stateTimer = 1.2 + mob.rng();
    } else {
      mob.stateTimer -= delta;
      if (mob.stateTimer <= 0) {
        if (mob.rng() > 0.42) {
          mob.state = "wander";
          mob.heading += (mob.rng() - 0.5) * Math.PI * 1.5;
          mob.stateTimer = 1.2 + mob.rng() * 2.8;
        } else {
          mob.state = "idle";
          mob.stateTimer = 0.8 + mob.rng() * 2.4;
        }
      }
    }

    let moveSpeed = 0;
    if (mob.state === "wander" || mob.state === "chase") {
      moveSpeed = mob.speed;
    } else if (mob.state === "flee") {
      moveSpeed = mob.speed * 1.8;
    }

    if (moveSpeed > 0) {
      const nextX = position.x + Math.sin(mob.heading) * moveSpeed * delta;
      const nextZ = position.z + Math.cos(mob.heading) * moveSpeed * delta;
      const surface = this.world.getSurfaceInfo(nextX, nextZ);

      if (
        !surface.isUnderwater &&
        (surface.blockType === "grass" || surface.blockType === "sand" || surface.blockType === "stone") &&
        Math.abs(surfaceTopY(surface) - position.y) <= 1.2
      ) {
        position.x = nextX;
        position.z = nextZ;
        position.y = THREE.MathUtils.lerp(position.y, surfaceTopY(surface), 0.35);
      } else {
        mob.heading += Math.PI * (0.6 + mob.rng() * 0.8);
        mob.stateTimer = 0.2;
      }
    } else {
      const surface = this.world.getSurfaceInfo(position.x, position.z);
      if (!surface.isUnderwater) {
        position.y = THREE.MathUtils.lerp(position.y, surfaceTopY(surface), 0.35);
      }
    }

    mob.group.rotation.y = lerpAngle(mob.group.rotation.y, mob.heading, Math.min(1, delta * 6));

    mob.animationTime += delta * (moveSpeed > 0 ? 7 : 1.4);
    const stride = moveSpeed > 0 ? 0.48 : 0.05;

    if (mob.legs.length >= 4) {
      mob.legs[0].rotation.x = Math.sin(mob.animationTime) * stride;
      mob.legs[1].rotation.x = Math.sin(mob.animationTime + Math.PI) * stride;
      mob.legs[2].rotation.x = Math.sin(mob.animationTime + Math.PI) * stride;
      mob.legs[3].rotation.x = Math.sin(mob.animationTime) * stride;
    } else if (mob.legs.length === 2) {
      mob.legs[0].rotation.x = Math.sin(mob.animationTime) * stride;
      mob.legs[1].rotation.x = Math.sin(mob.animationTime + Math.PI) * stride;
    }

    mob.headPivot.rotation.y = Math.sin(mob.animationTime * 0.32 + mob.phase) * 0.12;
    mob.headPivot.rotation.x = Math.sin(mob.animationTime * 0.25 + mob.phase) * 0.04;
  }
}
