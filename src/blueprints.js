import * as THREE from "three";
import { SUPPORTED_BLOCK_TYPES } from "./world.js";

const BLOCK_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const SUPPORTED_TYPES = new Set(SUPPORTED_BLOCK_TYPES);

const PREVIEW_COLORS = {
  pending: new THREE.Color("#6fe7ff"),
  done: new THREE.Color("#78f7a4"),
  blocked: new THREE.Color("#ff7f7f"),
};

function formatCounts(materials) {
  return materials
    .map(({ type, count }) => `${count} ${type}`)
    .join(", ");
}

function normalizeBlueprintData(data) {
  const source = Array.isArray(data)
    ? { name: "Imported Blueprint", blocks: data }
    : data;

  if (!source || typeof source !== "object" || !Array.isArray(source.blocks) || source.blocks.length === 0) {
    throw new Error("Blueprint must contain a non-empty 'blocks' array.");
  }

  const deduped = new Map();

  source.blocks.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Block ${index + 1} is not a valid object.`);
    }

    const x = Number(entry.x);
    const y = Number(entry.y);
    const z = Number(entry.z);
    const type = String(entry.type ?? "").toLowerCase();

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`Block ${index + 1} has invalid coordinates.`);
    }

    if (!SUPPORTED_TYPES.has(type)) {
      throw new Error(`Block ${index + 1} uses unsupported block type '${type}'.`);
    }

    const block = {
      x: Math.trunc(x),
      y: Math.trunc(y),
      z: Math.trunc(z),
      type,
    };

    deduped.set(`${block.x},${block.y},${block.z}`, block);
  });

  const blocks = [...deduped.values()];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  blocks.forEach((block) => {
    minX = Math.min(minX, block.x);
    minY = Math.min(minY, block.y);
    minZ = Math.min(minZ, block.z);
    maxX = Math.max(maxX, block.x);
    maxY = Math.max(maxY, block.y);
    maxZ = Math.max(maxZ, block.z);
  });

  const normalizedBlocks = blocks.map((block) => ({
    x: block.x - minX,
    y: block.y - minY,
    z: block.z - minZ,
    type: block.type,
  }));

  const counts = new Map();
  normalizedBlocks.forEach((block) => {
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
  });

  const materials = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));

  return {
    name: String(source.name || "Imported Blueprint"),
    author: source.author ? String(source.author) : null,
    description: source.description ? String(source.description) : null,
    blocks: normalizedBlocks,
    size: {
      x: maxX - minX + 1,
      y: maxY - minY + 1,
      z: maxZ - minZ + 1,
    },
    materials,
    blockCount: normalizedBlocks.length,
  };
}

function rotateBlock(block, rotation, size) {
  if (rotation === 0) {
    return { ...block };
  }

  if (rotation === 1) {
    return {
      x: size.z - 1 - block.z,
      y: block.y,
      z: block.x,
      type: block.type,
    };
  }

  if (rotation === 2) {
    return {
      x: size.x - 1 - block.x,
      y: block.y,
      z: size.z - 1 - block.z,
      type: block.type,
    };
  }

  return {
    x: block.z,
    y: block.y,
    z: size.x - 1 - block.x,
    type: block.type,
  };
}

function rotatedSize(size, rotation) {
  if (rotation % 2 === 0) {
    return { ...size };
  }

  return {
    x: size.z,
    y: size.y,
    z: size.x,
  };
}

function clonePreviewMaterial() {
  return new THREE.MeshBasicMaterial({
    color: PREVIEW_COLORS.pending.clone(),
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
}

export class BlueprintManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 2;
    this.scene.add(this.group);

    this.blueprint = null;
    this.rotation = 0;
    this.yOffset = 0;
    this.previewEntries = [];
    this.transformedBlocks = [];
    this.transformedSize = { x: 0, y: 0, z: 0 };
    this.anchor = new THREE.Vector3();
    this.anchorKey = "";
    this.refreshCooldown = 0;
    this.lastPlacementStats = { pending: 0, done: 0, blocked: 0 };
    this.status = "Import a JSON blueprint or load the sample cabin.";
  }

  hasBlueprint() {
    return this.blueprint !== null;
  }

  clear() {
    this.blueprint = null;
    this.rotation = 0;
    this.yOffset = 0;
    this.transformedBlocks = [];
    this.transformedSize = { x: 0, y: 0, z: 0 };
    this.lastPlacementStats = { pending: 0, done: 0, blocked: 0 };
    this.anchorKey = "";
    this.status = "Blueprint cleared.";
    this.disposePreview();
    this.group.visible = false;
  }

  disposePreview() {
    this.previewEntries.forEach(({ mesh }) => {
      if (mesh.material) {
        mesh.material.dispose();
      }
    });
    this.previewEntries = [];
    this.group.clear();
  }

  async loadFromUrl(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load blueprint (${response.status}).`);
    }
    const data = await response.json();
    return this.loadFromObject(data);
  }

  async loadFromFile(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("Blueprint JSON could not be parsed.");
    }
    return this.loadFromObject(data);
  }

  loadFromObject(data) {
    this.blueprint = normalizeBlueprintData(data);
    this.rotation = 0;
    this.yOffset = 0;
    this.status = `Loaded '${this.blueprint.name}'. Aim at terrain to position the hologram.`;
    this.rebuildPreview();
    this.group.visible = true;
    return this.blueprint;
  }

  rebuildPreview() {
    this.disposePreview();

    if (!this.blueprint) {
      return;
    }

    this.transformedSize = rotatedSize(this.blueprint.size, this.rotation);
    this.transformedBlocks = this.blueprint.blocks.map((block) => rotateBlock(block, this.rotation, this.blueprint.size));

    this.transformedBlocks.forEach((block) => {
      const mesh = new THREE.Mesh(BLOCK_GEOMETRY, clonePreviewMaterial());
      mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.previewEntries.push({ mesh, block });
    });

    this.refreshPreviewColors(true);
  }

  rotateRight() {
    if (!this.blueprint) {
      return;
    }

    this.rotation = (this.rotation + 1) % 4;
    this.status = `Rotated to ${this.rotation * 90} degrees.`;
    this.rebuildPreview();
  }

  adjustYOffset(delta) {
    if (!this.blueprint) {
      return;
    }

    this.yOffset = THREE.MathUtils.clamp(this.yOffset + delta, -12, 20);
    this.anchorKey = "";
    this.status = `Blueprint height offset: ${this.yOffset >= 0 ? "+" : ""}${this.yOffset}`;
  }

  setAnchor(anchor) {
    if (!this.blueprint || !anchor) {
      this.group.visible = false;
      return;
    }

    const snappedX = Math.floor(anchor.x);
    const snappedY = Math.floor(anchor.y) + this.yOffset;
    const snappedZ = Math.floor(anchor.z);
    const key = `${snappedX},${snappedY},${snappedZ}`;

    this.group.visible = true;
    this.group.position.set(snappedX, snappedY, snappedZ);

    if (this.anchorKey !== key) {
      this.anchorKey = key;
      this.anchor.set(snappedX, snappedY, snappedZ);
      this.refreshPreviewColors(true);
      return;
    }

    this.anchor.set(snappedX, snappedY, snappedZ);
  }

  update(anchor, delta) {
    if (!this.blueprint) {
      return;
    }

    this.setAnchor(anchor);
    this.refreshCooldown -= delta;
    if (this.refreshCooldown <= 0) {
      this.refreshPreviewColors();
    }
  }

  getWorldBlocks() {
    if (!this.blueprint) {
      return [];
    }

    return this.transformedBlocks.map((block) => ({
      x: this.anchor.x + block.x,
      y: this.anchor.y + block.y,
      z: this.anchor.z + block.z,
      type: block.type,
    }));
  }

  refreshPreviewColors(force = false) {
    if (!this.blueprint || (!force && this.refreshCooldown > 0)) {
      return;
    }

    const stats = { pending: 0, done: 0, blocked: 0 };

    this.previewEntries.forEach(({ mesh, block }) => {
      const worldX = this.anchor.x + block.x;
      const worldY = this.anchor.y + block.y;
      const worldZ = this.anchor.z + block.z;
      const currentType = this.world.getBlockType(worldX, worldY, worldZ);

      let state = "pending";
      if (currentType === block.type) {
        state = "done";
      } else if (currentType && currentType !== "water") {
        state = "blocked";
      }

      stats[state] += 1;
      mesh.material.color.copy(PREVIEW_COLORS[state]);
    });

    this.lastPlacementStats = stats;
    this.refreshCooldown = 0.18;
  }

  autoBuild(isCreativeMode) {
    if (!this.blueprint) {
      return { placed: 0, already: 0, blocked: 0, error: "No blueprint loaded." };
    }

    if (!isCreativeMode) {
      return { placed: 0, already: 0, blocked: 0, error: "Switch to Creative mode to auto-build." };
    }

    const blocks = this.getWorldBlocks();
    let placed = 0;
    let already = 0;
    let blocked = 0;

    this.world.beginBulkEdit();
    try {
      blocks.forEach((block) => {
        const currentType = this.world.getBlockType(block.x, block.y, block.z);
        if (currentType === block.type) {
          already += 1;
          return;
        }

        if (currentType && currentType !== "water") {
          blocked += 1;
          return;
        }

        const result = this.world.addBlock(block.x, block.y, block.z, block.type);
        if (result) {
          placed += 1;
        } else {
          blocked += 1;
        }
      });
    } finally {
      this.world.endBulkEdit();
    }

    this.status = `Build result: ${placed} placed, ${already} already correct, ${blocked} blocked.`;
    this.refreshPreviewColors(true);
    return { placed, already, blocked, error: null };
  }

  getUiState() {
    if (!this.blueprint) {
      return {
        hasBlueprint: false,
        name: "No blueprint loaded",
        meta: "Load the sample cabin or import a JSON blueprint.",
        materialsText: "Supported blocks: grass, dirt, stone, sand, wood, leaves, water.",
        statsText: "No hologram active.",
        status: this.status,
        canBuild: false,
      };
    }

    return {
      hasBlueprint: true,
      name: this.blueprint.name,
      meta: `${this.transformedSize.x} x ${this.transformedSize.y} x ${this.transformedSize.z} | ${this.blueprint.blockCount} blocks | rot ${this.rotation * 90}deg | y ${this.yOffset >= 0 ? "+" : ""}${this.yOffset}`,
      materialsText: formatCounts(this.blueprint.materials),
      statsText: `Pending ${this.lastPlacementStats.pending}, done ${this.lastPlacementStats.done}, blocked ${this.lastPlacementStats.blocked}`,
      status: this.status,
      canBuild: true,
    };
  }
}
