import * as THREE from "three";

const SHARED_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const TEMP_MATRIX = new THREE.Matrix4();

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 40;
export const SEA_LEVEL = 9;

const WORLD_SEED = 20260307;
const TREE_SCAN_RADIUS = 2;
const BASE_VIEW_DISTANCE = 3;
const MAX_VIEW_DISTANCE = 5;

const BLOCK_IDS = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  wood: 5,
  leaves: 6,
  water: 7,
  farmland: 8,
};

const ID_TO_TYPE = Object.entries(BLOCK_IDS).reduce((lookup, [type, id]) => {
  lookup[id] = type;
  return lookup;
}, {});

const SOLID_IDS = new Set([
  BLOCK_IDS.grass,
  BLOCK_IDS.dirt,
  BLOCK_IDS.stone,
  BLOCK_IDS.sand,
  BLOCK_IDS.wood,
  BLOCK_IDS.leaves,
  BLOCK_IDS.farmland,
]);

export const HOTBAR_TYPES = ["grass", "stone", "dirt", "wood", "sand"];
export const SUPPORTED_BLOCK_TYPES = ["grass", "dirt", "stone", "sand", "wood", "leaves", "water", "farmland"];

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hashInt(x, z, seed = WORLD_SEED) {
  let value = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1);
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return value >>> 0;
}

function random01(x, z, seed = WORLD_SEED) {
  return hashInt(x, z, seed) / 4294967295;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function valueNoise2D(x, z, scale, seed) {
  const sampleX = x / scale;
  const sampleZ = z / scale;
  const x0 = Math.floor(sampleX);
  const z0 = Math.floor(sampleZ);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = smoothstep(sampleX - x0);
  const tz = smoothstep(sampleZ - z0);

  const n00 = random01(x0, z0, seed);
  const n10 = random01(x1, z0, seed);
  const n01 = random01(x0, z1, seed);
  const n11 = random01(x1, z1, seed);

  const top = lerp(n00, n10, tx);
  const bottom = lerp(n01, n11, tx);
  return lerp(top, bottom, tz);
}

function signedNoise2D(x, z, scale, seed) {
  return valueNoise2D(x, z, scale, seed) * 2 - 1;
}

function layeredNoise(x, z, {
  scale,
  octaves,
  persistence,
  lacunarity,
  seed,
}) {
  let amplitude = 1;
  let total = 0;
  let max = 0;
  let octaveScale = scale;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += signedNoise2D(x, z, octaveScale, seed + octave * 97) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    octaveScale /= lacunarity;
  }

  return total / max;
}

function makePixelTexture(base, accent, overlay) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 32, 32);

  for (let index = 0; index < 64; index += 1) {
    const size = index % 7 === 0 ? 3 : 2;
    const x = Math.floor(Math.random() * (32 - size));
    const y = Math.floor(Math.random() * (32 - size));
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, size, size);
  }

  if (overlay) {
    overlay(ctx);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function createMaterials() {
  const dirtTexture = makePixelTexture("#7f5c3d", "#5f4126");
  const stoneTexture = makePixelTexture("#8f979d", "#6b7278");
  const sandTexture = makePixelTexture("#dccb8c", "#c2b06d");
  const woodTexture = makePixelTexture("#936237", "#5f3d1f", (ctx) => {
    ctx.fillStyle = "rgba(70, 40, 18, 0.28)";
    for (let y = 4; y < 32; y += 8) {
      ctx.fillRect(0, y, 32, 2);
    }
  });
  const leavesTexture = makePixelTexture("#4d8742", "#2d5626");
  const farmlandTexture = makePixelTexture("#71472b", "#4c2d18", (ctx) => {
    ctx.fillStyle = "rgba(41, 23, 10, 0.35)";
    for (let x = 2; x < 32; x += 6) {
      ctx.fillRect(x, 0, 2, 32);
    }
  });
  const waterTexture = makePixelTexture("rgba(97, 171, 214, 0.72)", "rgba(212, 239, 255, 0.22)", (ctx) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    for (let y = 2; y < 32; y += 7) {
      ctx.fillRect(0, y, 32, 1);
    }
  });

  const grassTop = makePixelTexture("#6fbe55", "#4f8b3d");
  const grassSide = makePixelTexture("#7f5c3d", "#5f4126", (ctx) => {
    ctx.fillStyle = "#6fbe55";
    ctx.fillRect(0, 0, 32, 8);
    ctx.fillStyle = "#4f8b3d";
    for (let x = 0; x < 32; x += 3) {
      ctx.fillRect(x, 7, 2, Math.floor(Math.random() * 5) + 2);
    }
  });

  return {
    grass: [
      new THREE.MeshLambertMaterial({ map: grassSide }),
      new THREE.MeshLambertMaterial({ map: grassSide }),
      new THREE.MeshLambertMaterial({ map: grassTop }),
      new THREE.MeshLambertMaterial({ map: dirtTexture }),
      new THREE.MeshLambertMaterial({ map: grassSide }),
      new THREE.MeshLambertMaterial({ map: grassSide }),
    ],
    dirt: new THREE.MeshLambertMaterial({ map: dirtTexture }),
    stone: new THREE.MeshLambertMaterial({ map: stoneTexture }),
    sand: new THREE.MeshLambertMaterial({ map: sandTexture }),
    wood: new THREE.MeshLambertMaterial({ map: woodTexture }),
    leaves: new THREE.MeshLambertMaterial({ map: leavesTexture }),
    farmland: new THREE.MeshLambertMaterial({ map: farmlandTexture }),
    water: new THREE.MeshLambertMaterial({
      map: waterTexture,
      transparent: true,
      opacity: 0.72,
    }),
  };
}

class Chunk {
  constructor(world, chunkX, chunkZ) {
    this.world = world;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.key = world.chunkKey(chunkX, chunkZ);
    this.cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    this.group = new THREE.Group();
    this.interactables = [];

    this.generate();
    this.rebuild();
  }

  index(localX, y, localZ) {
    return y * CHUNK_SIZE * CHUNK_SIZE + localZ * CHUNK_SIZE + localX;
  }

  getLocalBlock(localX, y, localZ) {
    if (
      localX < 0 || localX >= CHUNK_SIZE ||
      localZ < 0 || localZ >= CHUNK_SIZE ||
      y < 0 || y >= WORLD_HEIGHT
    ) {
      return BLOCK_IDS.air;
    }
    return this.cells[this.index(localX, y, localZ)];
  }

  setLocalBlock(localX, y, localZ, id) {
    if (
      localX < 0 || localX >= CHUNK_SIZE ||
      localZ < 0 || localZ >= CHUNK_SIZE ||
      y < 0 || y >= WORLD_HEIGHT
    ) {
      return;
    }
    this.cells[this.index(localX, y, localZ)] = id;
  }

  containsWorldPosition(x, z) {
    const startX = this.chunkX * CHUNK_SIZE;
    const startZ = this.chunkZ * CHUNK_SIZE;
    return (
      x >= startX &&
      x < startX + CHUNK_SIZE &&
      z >= startZ &&
      z < startZ + CHUNK_SIZE
    );
  }

  generate() {
    this.cells.fill(BLOCK_IDS.air);

    const startX = this.chunkX * CHUNK_SIZE;
    const startZ = this.chunkZ * CHUNK_SIZE;

    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
        const worldX = startX + localX;
        const worldZ = startZ + localZ;
        const column = this.world.getColumnInfo(worldX, worldZ);

        for (let y = 0; y <= column.height; y += 1) {
          let id = BLOCK_IDS.stone;
          if (y === column.height) {
            id = column.surfaceId;
          } else if (y >= column.height - 2) {
            id = column.fillerId;
          }
          this.setLocalBlock(localX, y, localZ, id);
        }

        for (let y = column.height + 1; y <= column.waterLevel; y += 1) {
          this.setLocalBlock(localX, y, localZ, BLOCK_IDS.water);
        }
      }
    }

    for (let treeX = startX - TREE_SCAN_RADIUS; treeX < startX + CHUNK_SIZE + TREE_SCAN_RADIUS; treeX += 1) {
      for (let treeZ = startZ - TREE_SCAN_RADIUS; treeZ < startZ + CHUNK_SIZE + TREE_SCAN_RADIUS; treeZ += 1) {
        const tree = this.world.getTreeAt(treeX, treeZ);
        if (tree) {
          this.world.applyTreeToChunk(this, tree);
        }
      }
    }

    const edits = this.world.edits.get(this.key);
    if (edits) {
      for (const [index, id] of edits.entries()) {
        this.cells[index] = id;
      }
    }
  }

  rebuild() {
    this.group.clear();
    this.interactables = [];

    const visibleByType = new Map();
    const startX = this.chunkX * CHUNK_SIZE;
    const startZ = this.chunkZ * CHUNK_SIZE;

    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
          const id = this.getLocalBlock(localX, y, localZ);
          if (id === BLOCK_IDS.air) {
            continue;
          }

          const worldX = startX + localX;
          const worldZ = startZ + localZ;
          if (!this.world.shouldRenderBlock(worldX, y, worldZ, id)) {
            continue;
          }

          const type = ID_TO_TYPE[id];
          if (!visibleByType.has(type)) {
            visibleByType.set(type, []);
          }
          visibleByType.get(type).push({ x: worldX, y, z: worldZ, type });
        }
      }
    }

    for (const [type, blocks] of visibleByType.entries()) {
      if (blocks.length === 0) {
        continue;
      }

      const mesh = new THREE.InstancedMesh(
        SHARED_GEOMETRY,
        this.world.materials[type],
        blocks.length,
      );
      mesh.castShadow = type !== "water";
      mesh.receiveShadow = true;
      mesh.userData = { type, blocks, chunkKey: this.key };

      blocks.forEach((block, index) => {
        TEMP_MATRIX.makeTranslation(block.x + 0.5, block.y + 0.5, block.z + 0.5);
        mesh.setMatrixAt(index, TEMP_MATRIX);
      });

      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.interactables.push(mesh);
    }
  }
}

export class VoxelWorld {
  constructor(scene) {
    this.scene = scene;
    this.materials = createMaterials();
    this.edits = new Map();
    this.chunks = new Map();
    this.interactableMeshes = [];
    this.columnCache = new Map();
    this.treeCache = new Map();
    this.solidTypes = new Set(["grass", "dirt", "stone", "sand", "wood", "leaves", "farmland"]);
    this.currentChunkX = null;
    this.currentChunkZ = null;
    this.currentViewDistance = BASE_VIEW_DISTANCE;
    this.bulkEditDepth = 0;
    this.pendingChunkRebuilds = new Set();
    this.spawnPoint = this.findSpawnPoint();
  }

  chunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
  }

  toChunkCoord(value) {
    return Math.floor(value / CHUNK_SIZE);
  }

  localCoord(value) {
    return mod(value, CHUNK_SIZE);
  }

  columnKey(x, z) {
    return `${x},${z}`;
  }

  getColumnInfo(x, z) {
    const worldX = Math.floor(x);
    const worldZ = Math.floor(z);
    const key = this.columnKey(worldX, worldZ);
    if (this.columnCache.has(key)) {
      return this.columnCache.get(key);
    }

    const continental = layeredNoise(worldX, worldZ, {
      scale: 240,
      octaves: 4,
      persistence: 0.56,
      lacunarity: 2,
      seed: WORLD_SEED + 11,
    });
    const hills = layeredNoise(worldX, worldZ, {
      scale: 88,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.3,
      seed: WORLD_SEED + 41,
    });
    const detail = layeredNoise(worldX, worldZ, {
      scale: 24,
      octaves: 2,
      persistence: 0.5,
      lacunarity: 2.8,
      seed: WORLD_SEED + 73,
    });
    const ridgeBase = layeredNoise(worldX, worldZ, {
      scale: 110,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2,
      seed: WORLD_SEED + 103,
    });
    const ridges = 1 - Math.abs(ridgeBase);
    const erosion = valueNoise2D(worldX + 1130, worldZ - 930, 175, WORLD_SEED + 127);
    const basin = layeredNoise(worldX, worldZ, {
      scale: 170,
      octaves: 2,
      persistence: 0.52,
      lacunarity: 2.1,
      seed: WORLD_SEED + 181,
    });

    const temperature = valueNoise2D(worldX + 500, worldZ - 700, 220, WORLD_SEED + 149);
    const moisture = valueNoise2D(worldX - 1700, worldZ + 900, 190, WORLD_SEED + 211);
    const climateDrift = valueNoise2D(worldX + 2400, worldZ + 1300, 560, WORLD_SEED + 263);

    let biome = "plains";
    if (continental + ridges > 1.18 && erosion < 0.52) {
      biome = "mountains";
    } else if (temperature > 0.74 && moisture < 0.35) {
      biome = "desert";
    } else if (temperature > 0.62 && moisture < 0.55) {
      biome = "savanna";
    } else if (temperature < 0.26) {
      biome = "snow";
    } else if (temperature < 0.38) {
      biome = "taiga";
    } else if (moisture > 0.72 && continental < 0.14) {
      biome = "swamp";
    } else if (moisture > 0.62) {
      biome = "forest";
    }

    let height = 12 + continental * 8 + hills * 4.5 + ridges * 4 + detail * 2 + basin * 1.8;
    if (biome === "desert") {
      height -= 1.8;
    } else if (biome === "savanna") {
      height -= 0.8;
    } else if (biome === "taiga") {
      height += 0.8;
    } else if (biome === "snow") {
      height += 1.5;
    } else if (biome === "swamp") {
      height -= 2.4;
      height -= Math.abs(detail) * 1.2;
    } else if (biome === "mountains") {
      height += 5 + ridges * 10 + (0.5 - erosion) * 4;
    }
    height += (climateDrift - 0.5) * 1.8;

    height = THREE.MathUtils.clamp(Math.floor(height), 4, WORLD_HEIGHT - 8);

    let surfaceId = BLOCK_IDS.grass;
    if (height <= SEA_LEVEL + 1 || biome === "desert") {
      surfaceId = BLOCK_IDS.sand;
    } else if (biome === "mountains" && height > SEA_LEVEL + 7) {
      surfaceId = BLOCK_IDS.stone;
    }

    const fillerId = surfaceId === BLOCK_IDS.sand ? BLOCK_IDS.sand : BLOCK_IDS.dirt;
    const waterLevel =
      biome === "swamp"
        ? SEA_LEVEL + 2
        : biome === "mountains"
          ? SEA_LEVEL - 1
          : biome === "desert"
            ? SEA_LEVEL - 1
            : SEA_LEVEL;

    const info = {
      height,
      biome,
      temperature,
      moisture,
      surfaceId,
      fillerId,
      waterLevel,
    };

    this.columnCache.set(key, info);
    return info;
  }

  treeKey(x, z) {
    return `${x},${z}`;
  }

  getTreeAt(x, z) {
    const worldX = Math.floor(x);
    const worldZ = Math.floor(z);
    const key = this.treeKey(worldX, worldZ);

    if (this.treeCache.has(key)) {
      return this.treeCache.get(key);
    }

    const column = this.getColumnInfo(worldX, worldZ);
    if (column.surfaceId !== BLOCK_IDS.grass || column.height <= column.waterLevel + 1) {
      this.treeCache.set(key, null);
      return null;
    }

    const cellX = Math.floor(worldX / 4);
    const cellZ = Math.floor(worldZ / 4);
    const anchorX = cellX * 4 + Math.floor(random01(cellX, cellZ, WORLD_SEED + 307) * 4);
    const anchorZ = cellZ * 4 + Math.floor(random01(cellX, cellZ, WORLD_SEED + 389) * 4);

    if (anchorX !== worldX || anchorZ !== worldZ) {
      this.treeCache.set(key, null);
      return null;
    }

    let chance = 0.12;
    if (column.biome === "forest") {
      chance = 0.36;
    } else if (column.biome === "plains") {
      chance = 0.18;
    } else if (column.biome === "taiga") {
      chance = 0.2;
    } else if (column.biome === "snow") {
      chance = 0.06;
    } else if (column.biome === "swamp") {
      chance = 0.16;
    } else if (column.biome === "savanna") {
      chance = 0.1;
    } else if (column.biome === "mountains") {
      chance = 0.05;
    } else if (column.biome === "desert") {
      chance = 0.02;
    } else if (column.biome === "cold") {
      chance = 0.08;
    } else if (column.biome === "warm") {
      chance = 0.03;
    }

    if (random01(worldX, worldZ, WORLD_SEED + 463) > chance) {
      this.treeCache.set(key, null);
      return null;
    }

    const trunkBase =
      column.biome === "taiga"
        ? 5
        : column.biome === "mountains"
          ? 5
          : 4;
    const trunkRange =
      column.biome === "taiga"
        ? 3
        : column.biome === "savanna"
          ? 1
          : 2;

    const tree = {
      x: worldX,
      z: worldZ,
      baseY: column.height + 1,
      trunkHeight: trunkBase + Math.floor(random01(worldX, worldZ, WORLD_SEED + 557) * trunkRange),
      style:
        column.biome === "savanna"
          ? "acacia"
          : column.biome === "taiga" || column.biome === "snow"
            ? "taiga"
            : column.biome === "swamp"
              ? "swamp"
              : column.biome === "mountains"
                ? "alpine"
                : "oak",
    };

    this.treeCache.set(key, tree);
    return tree;
  }

  getTreeBlockAt(tree, x, y, z) {
    if (x === tree.x && z === tree.z && y >= tree.baseY && y < tree.baseY + tree.trunkHeight) {
      return BLOCK_IDS.wood;
    }

    const dx = Math.abs(x - tree.x);
    const dz = Math.abs(z - tree.z);
    const canopyCenter = tree.baseY + tree.trunkHeight - 1;
    const dy = y - canopyCenter;

    if (tree.style === "taiga") {
      if (dy >= -2 && dy <= 2) {
        const radius = Math.max(0, 2 - Math.abs(dy));
        return dx <= radius && dz <= radius && dx + dz <= radius + 1 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
      }
      return BLOCK_IDS.air;
    }

    if (tree.style === "acacia") {
      if (dy >= 0 && dy <= 1) {
        const skewX = tree.x + 1;
        const skewDx = Math.abs(x - skewX);
        return skewDx <= 2 && dz <= 2 && skewDx + dz <= 3 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
      }
      return BLOCK_IDS.air;
    }

    if (tree.style === "swamp") {
      if (dy >= -1 && dy <= 1) {
        return dx <= 2 && dz <= 2 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
      }
      if (dy === -2 && ((dx === 2 && dz <= 1) || (dz === 2 && dx <= 1))) {
        return BLOCK_IDS.leaves;
      }
      return BLOCK_IDS.air;
    }

    if (tree.style === "alpine") {
      if (dy >= -1 && dy <= 1) {
        return dx <= 1 && dz <= 1 && dx + dz <= 2 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
      }
      if (dy === 2) {
        return dx + dz === 0 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
      }
      return BLOCK_IDS.air;
    }

    if (dy === 2) {
      return dx + dz <= 1 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
    }

    if (dy >= -1 && dy <= 1) {
      return dx <= 2 && dz <= 2 && dx + dz <= 4 ? BLOCK_IDS.leaves : BLOCK_IDS.air;
    }

    return BLOCK_IDS.air;
  }

  applyTreeToChunk(chunk, tree) {
    const writeBlock = (worldX, y, worldZ, id) => {
      if (!chunk.containsWorldPosition(worldX, worldZ) || y < 0 || y >= WORLD_HEIGHT) {
        return;
      }

      const localX = worldX - chunk.chunkX * CHUNK_SIZE;
      const localZ = worldZ - chunk.chunkZ * CHUNK_SIZE;
      const current = chunk.getLocalBlock(localX, y, localZ);

      if (id === BLOCK_IDS.wood) {
        chunk.setLocalBlock(localX, y, localZ, id);
        return;
      }

      if (current === BLOCK_IDS.air || current === BLOCK_IDS.water || current === BLOCK_IDS.leaves) {
        chunk.setLocalBlock(localX, y, localZ, id);
      }
    };

    for (let offset = 0; offset < tree.trunkHeight; offset += 1) {
      writeBlock(tree.x, tree.baseY + offset, tree.z, BLOCK_IDS.wood);
    }

    for (let x = -2; x <= 2; x += 1) {
      for (let y = -1; y <= 2; y += 1) {
        for (let z = -2; z <= 2; z += 1) {
          const block = this.getTreeBlockAt(
            tree,
            tree.x + x,
            tree.baseY + tree.trunkHeight - 1 + y,
            tree.z + z,
          );

          if (block === BLOCK_IDS.leaves) {
            writeBlock(tree.x + x, tree.baseY + tree.trunkHeight - 1 + y, tree.z + z, block);
          }
        }
      }
    }
  }

  getNaturalBlockId(x, y, z) {
    const worldX = Math.floor(x);
    const worldY = Math.floor(y);
    const worldZ = Math.floor(z);

    if (worldY < 0) {
      return BLOCK_IDS.stone;
    }

    if (worldY >= WORLD_HEIGHT) {
      return BLOCK_IDS.air;
    }

    const column = this.getColumnInfo(worldX, worldZ);

    if (worldY <= column.height) {
      if (worldY === column.height) {
        return column.surfaceId;
      }
      if (worldY >= column.height - 2) {
        return column.fillerId;
      }
      return BLOCK_IDS.stone;
    }

    for (let treeX = worldX - TREE_SCAN_RADIUS; treeX <= worldX + TREE_SCAN_RADIUS; treeX += 1) {
      for (let treeZ = worldZ - TREE_SCAN_RADIUS; treeZ <= worldZ + TREE_SCAN_RADIUS; treeZ += 1) {
        const tree = this.getTreeAt(treeX, treeZ);
        if (!tree) {
          continue;
        }

        const treeBlock = this.getTreeBlockAt(tree, worldX, worldY, worldZ);
        if (treeBlock !== BLOCK_IDS.air) {
          return treeBlock;
        }
      }
    }

    if (worldY <= column.waterLevel) {
      return BLOCK_IDS.water;
    }

    return BLOCK_IDS.air;
  }

  getBlockId(x, y, z) {
    const worldX = Math.floor(x);
    const worldY = Math.floor(y);
    const worldZ = Math.floor(z);

    if (worldY < 0 || worldY >= WORLD_HEIGHT) {
      return BLOCK_IDS.air;
    }

    const chunkX = this.toChunkCoord(worldX);
    const chunkZ = this.toChunkCoord(worldZ);
    const key = this.chunkKey(chunkX, chunkZ);
    const chunk = this.chunks.get(key);

    if (chunk) {
      return chunk.getLocalBlock(this.localCoord(worldX), worldY, this.localCoord(worldZ));
    }

    const edits = this.edits.get(key);
    if (edits) {
      const localIndex =
        worldY * CHUNK_SIZE * CHUNK_SIZE +
        this.localCoord(worldZ) * CHUNK_SIZE +
        this.localCoord(worldX);
      if (edits.has(localIndex)) {
        return edits.get(localIndex);
      }
    }

    return this.getNaturalBlockId(worldX, worldY, worldZ);
  }

  getBlockType(x, y, z) {
    const id = this.getBlockId(x, y, z);
    return id === BLOCK_IDS.air ? null : ID_TO_TYPE[id];
  }

  shouldRenderBlock(x, y, z, id) {
    const neighbors = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    for (const [dx, dy, dz] of neighbors) {
      const neighborId = this.getBlockId(x + dx, y + dy, z + dz);
      if (id === BLOCK_IDS.water) {
        if (neighborId !== BLOCK_IDS.water) {
          return true;
        }
        continue;
      }

      if (neighborId === BLOCK_IDS.air || neighborId === BLOCK_IDS.water) {
        return true;
      }
    }

    return false;
  }

  findSpawnPoint(centerX = 0, centerZ = 0) {
    let bestSurface = null;

    for (let radius = 0; radius <= 10; radius += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        for (let z = -radius; z <= radius; z += 1) {
          const surface = this.getSurfaceInfo(centerX + x, centerZ + z);
          if (
            !surface ||
            surface.isUnderwater ||
            (surface.blockType !== "grass" && surface.blockType !== "sand")
          ) {
            continue;
          }

          if (!bestSurface || surface.y > bestSurface.y) {
            bestSurface = surface;
          }
        }
      }

      if (bestSurface) {
        return new THREE.Vector3(bestSurface.x + 0.5, bestSurface.y + 2.62, bestSurface.z + 0.5);
      }
    }

    return new THREE.Vector3(0.5, SEA_LEVEL + 4, 0.5);
  }

  getSpawnPoint() {
    return this.spawnPoint.clone();
  }

  getSafeSpawnNear(x, z) {
    return this.findSpawnPoint(Math.floor(x), Math.floor(z));
  }

  getSurfaceInfo(x, z) {
    const worldX = Math.floor(x);
    const worldZ = Math.floor(z);
    const column = this.getColumnInfo(worldX, worldZ);
    return {
      x: worldX,
      y: column.height,
      z: worldZ,
      biome: column.biome,
      blockType: ID_TO_TYPE[column.surfaceId],
      isUnderwater: column.height < column.waterLevel,
    };
  }

  getViewDistanceForPosition(position) {
    let radius = BASE_VIEW_DISTANCE;
    if (position.y > 26) {
      radius += 1;
    }
    if (position.y > 42) {
      radius += 1;
    }
    return THREE.MathUtils.clamp(radius, BASE_VIEW_DISTANCE, MAX_VIEW_DISTANCE);
  }

  loadChunk(chunkX, chunkZ) {
    const key = this.chunkKey(chunkX, chunkZ);
    if (this.chunks.has(key)) {
      return;
    }

    const chunk = new Chunk(this, chunkX, chunkZ);
    this.chunks.set(key, chunk);
    this.scene.add(chunk.group);
  }

  unloadChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) {
      return;
    }

    this.scene.remove(chunk.group);
    this.chunks.delete(key);
  }

  refreshInteractableMeshes() {
    this.interactableMeshes = [];
    for (const chunk of this.chunks.values()) {
      this.interactableMeshes.push(...chunk.interactables);
    }
  }

  updateStreaming(position) {
    const chunkX = this.toChunkCoord(Math.floor(position.x));
    const chunkZ = this.toChunkCoord(Math.floor(position.z));
    const viewDistance = this.getViewDistanceForPosition(position);

    if (
      chunkX === this.currentChunkX &&
      chunkZ === this.currentChunkZ &&
      viewDistance === this.currentViewDistance
    ) {
      return false;
    }

    this.currentChunkX = chunkX;
    this.currentChunkZ = chunkZ;
    this.currentViewDistance = viewDistance;

    const desiredChunks = [];
    const desiredKeys = new Set();

    for (let dz = -viewDistance; dz <= viewDistance; dz += 1) {
      for (let dx = -viewDistance; dx <= viewDistance; dx += 1) {
        const targetChunkX = chunkX + dx;
        const targetChunkZ = chunkZ + dz;
        desiredChunks.push({ chunkX: targetChunkX, chunkZ: targetChunkZ, distance: Math.abs(dx) + Math.abs(dz) });
        desiredKeys.add(this.chunkKey(targetChunkX, targetChunkZ));
      }
    }

    desiredChunks.sort((left, right) => left.distance - right.distance);

    for (const target of desiredChunks) {
      this.loadChunk(target.chunkX, target.chunkZ);
    }

    for (const key of [...this.chunks.keys()]) {
      if (!desiredKeys.has(key)) {
        this.unloadChunk(key);
      }
    }

    this.refreshInteractableMeshes();
    return true;
  }

  getInteractableMeshes() {
    return this.interactableMeshes;
  }

  getLoadedChunkCount() {
    return this.chunks.size;
  }

  getLoadedChunks() {
    return [...this.chunks.values()];
  }

  getCurrentViewDistance() {
    return this.currentViewDistance;
  }

  getVisibleWorldRadius() {
    return (this.currentViewDistance + 0.5) * CHUNK_SIZE;
  }

  getBlock(x, y, z) {
    const type = this.getBlockType(x, y, z);
    if (!type) {
      return null;
    }
    return {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
      type,
    };
  }

  getNearbySolidBlocks(minX, maxX, minY, maxY, minZ, maxZ) {
    const results = [];

    for (let x = Math.floor(minX); x <= Math.floor(maxX); x += 1) {
      for (let y = Math.floor(minY); y <= Math.floor(maxY); y += 1) {
        for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z += 1) {
          const id = this.getBlockId(x, y, z);
          if (SOLID_IDS.has(id)) {
            results.push({ x, y, z, type: ID_TO_TYPE[id] });
          }
        }
      }
    }

    return results;
  }

  resolveHit(hit) {
    if (hit.instanceId == null) {
      return null;
    }

    const block = hit.object.userData.blocks?.[hit.instanceId];
    return block ?? null;
  }

  worldNormalFromHit(hit) {
    if (!hit.face) {
      return new THREE.Vector3();
    }

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    return hit.face.normal.clone().applyMatrix3(normalMatrix).round();
  }

  getPlacementPosition(hit) {
    const block = this.resolveHit(hit);
    if (!block) {
      return null;
    }

    const normal = this.worldNormalFromHit(hit);
    return new THREE.Vector3(
      block.x + normal.x,
      block.y + normal.y,
      block.z + normal.z,
    );
  }

  getTouchedChunkKeys(x, z) {
    const worldX = Math.floor(x);
    const worldZ = Math.floor(z);
    const chunkX = this.toChunkCoord(worldX);
    const chunkZ = this.toChunkCoord(worldZ);

    const targets = new Set([this.chunkKey(chunkX, chunkZ)]);
    const localX = this.localCoord(worldX);
    const localZ = this.localCoord(worldZ);

    if (localX === 0) {
      targets.add(this.chunkKey(chunkX - 1, chunkZ));
    }
    if (localX === CHUNK_SIZE - 1) {
      targets.add(this.chunkKey(chunkX + 1, chunkZ));
    }
    if (localZ === 0) {
      targets.add(this.chunkKey(chunkX, chunkZ - 1));
    }
    if (localZ === CHUNK_SIZE - 1) {
      targets.add(this.chunkKey(chunkX, chunkZ + 1));
    }

    return targets;
  }

  flushPendingChunkRebuilds() {
    if (this.pendingChunkRebuilds.size === 0) {
      return;
    }

    for (const key of this.pendingChunkRebuilds) {
      const chunk = this.chunks.get(key);
      if (!chunk) {
        continue;
      }

      chunk.generate();
      chunk.rebuild();
    }

    this.pendingChunkRebuilds.clear();
    this.refreshInteractableMeshes();
  }

  rebuildTouchedChunks(x, z) {
    const targets = this.getTouchedChunkKeys(x, z);
    for (const key of targets) {
      this.pendingChunkRebuilds.add(key);
    }

    if (this.bulkEditDepth === 0) {
      this.flushPendingChunkRebuilds();
    }
  }

  beginBulkEdit() {
    this.bulkEditDepth += 1;
  }

  endBulkEdit() {
    if (this.bulkEditDepth === 0) {
      return;
    }

    this.bulkEditDepth -= 1;
    if (this.bulkEditDepth === 0) {
      this.flushPendingChunkRebuilds();
    }
  }

  setBlockId(x, y, z, id) {
    const worldX = Math.floor(x);
    const worldY = Math.floor(y);
    const worldZ = Math.floor(z);

    if (worldY < 0 || worldY >= WORLD_HEIGHT) {
      return false;
    }

    const chunkX = this.toChunkCoord(worldX);
    const chunkZ = this.toChunkCoord(worldZ);
    const key = this.chunkKey(chunkX, chunkZ);
    const localX = this.localCoord(worldX);
    const localZ = this.localCoord(worldZ);
    const localIndex =
      worldY * CHUNK_SIZE * CHUNK_SIZE +
      localZ * CHUNK_SIZE +
      localX;

    const naturalId = this.getNaturalBlockId(worldX, worldY, worldZ);

    if (!this.edits.has(key)) {
      this.edits.set(key, new Map());
    }

    const editMap = this.edits.get(key);
    if (id === naturalId) {
      editMap.delete(localIndex);
      if (editMap.size === 0) {
        this.edits.delete(key);
      }
    } else {
      editMap.set(localIndex, id);
    }

    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.setLocalBlock(localX, worldY, localZ, id);
    }

    this.rebuildTouchedChunks(worldX, worldZ);
    return true;
  }

  addBlock(x, y, z, type) {
    const id = BLOCK_IDS[type];
    if (!id) {
      return null;
    }

    const currentId = this.getBlockId(x, y, z);
    if (currentId !== BLOCK_IDS.air && currentId !== BLOCK_IDS.water) {
      return null;
    }

    this.setBlockId(x, y, z, id);
    return {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
      type,
    };
  }

  removeBlock(x, y, z) {
    const currentId = this.getBlockId(x, y, z);
    if (currentId === BLOCK_IDS.air || currentId === BLOCK_IDS.water) {
      return false;
    }

    this.setBlockId(x, y, z, BLOCK_IDS.air);
    return true;
  }
}
