import * as THREE from "three";
import { PointerLockControls } from "../vendor/PointerLockControls.js";
import { BlueprintManager } from "./blueprints.js";
import { AnimalManager } from "./mobs.js";
import {
  BLOCK_ITEM_IDS,
  cloneItem,
  createBlockItem,
  createToolItem,
  getItemDef,
} from "./items.js";
import { VoxelWorld } from "./world.js";

const SAMPLE_BLUEPRINT_URL = "./blueprints/starter-cabin.json";
const HOTBAR_SLOT_COUNT = 9;
const INVENTORY_SLOT_COUNT = 36;
const STORAGE_SLOT_COUNT = INVENTORY_SLOT_COUNT - HOTBAR_SLOT_COUNT;
const HOTBAR_START = STORAGE_SLOT_COUNT;
const TOOL_BREAK_MAP = {
  axe: new Set(["wood", "leaves"]),
  pickaxe: new Set(["stone"]),
  sword: new Set(["leaves"]),
};

const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const hotbar = document.querySelector("#hotbar");
const inventoryScreen = document.querySelector("#inventoryScreen");
const inventoryStorage = document.querySelector("#inventoryStorage");
const inventoryHotbar = document.querySelector("#inventoryHotbar");
const inventoryHeldLabel = document.querySelector("#inventoryHeldLabel");
const inventoryModeLabel = document.querySelector("#inventoryModeLabel");
const closeInventoryButton = document.querySelector("#closeInventoryButton");
const modeLabel = document.querySelector("#modeLabel");
const blockLabel = document.querySelector("#blockLabel");
const playerHealthLabel = document.querySelector("#playerHealthLabel");
const coordsLabel = document.querySelector("#coordsLabel");
const targetLabel = document.querySelector("#targetLabel");
const loadedLabel = document.querySelector("#loadedLabel");
const mobLabel = document.querySelector("#mobLabel");
const blueprintName = document.querySelector("#blueprintName");
const blueprintMeta = document.querySelector("#blueprintMeta");
const blueprintMaterials = document.querySelector("#blueprintMaterials");
const blueprintStats = document.querySelector("#blueprintStats");
const blueprintStatus = document.querySelector("#blueprintStatus");
const loadSampleBlueprintButton = document.querySelector("#loadSampleBlueprintButton");
const importBlueprintButton = document.querySelector("#importBlueprintButton");
const rotateBlueprintButton = document.querySelector("#rotateBlueprintButton");
const buildBlueprintButton = document.querySelector("#buildBlueprintButton");
const clearBlueprintButton = document.querySelector("#clearBlueprintButton");
const blueprintFileInput = document.querySelector("#blueprintFileInput");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#8db8d9");
scene.fog = new THREE.Fog("#8db8d9", 30, 130);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0.5, 10, 0.5);

const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

scene.add(new THREE.HemisphereLight("#d8ecff", "#50663d", 1.3));

const sun = new THREE.DirectionalLight("#fff4d8", 1.25);
sun.position.set(20, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

const fillLight = new THREE.DirectionalLight("#9bd0ff", 0.25);
fillLight.position.set(-12, 8, -8);
scene.add(fillLight);

const world = new VoxelWorld(scene);
camera.position.copy(world.getSpawnPoint());
world.updateStreaming(camera.position);
const animals = new AnimalManager(scene, world);
animals.syncPopulation();
const blueprints = new BlueprintManager(scene, world);

function createInitialInventory() {
  const slots = Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
  const hotbarItems = [
    createToolItem("sword"),
    createToolItem("axe"),
    createToolItem("pickaxe"),
    createToolItem("hoe"),
    createToolItem("mace"),
    createToolItem("spear"),
    createBlockItem("grass", 64),
    createBlockItem("stone", 64),
    createBlockItem("wood", 64),
  ];
  hotbarItems.forEach((item, index) => {
    slots[HOTBAR_START + index] = item;
  });
  slots[0] = createBlockItem("dirt", 64);
  slots[1] = createBlockItem("sand", 64);
  slots[2] = createBlockItem("leaves", 32);
  slots[3] = createBlockItem("water", 16);
  return slots;
}

const state = {
  mode: "survival",
  selectedIndex: 0,
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  moveUp: false,
  moveDown: false,
  sprint: false,
  onGround: false,
  velocityY: 0,
  dayTime: 0,
  lastHitName: "None",
  inventoryOpen: false,
  slots: createInitialInventory(),
  heldStack: null,
  spearCooldown: 0,
  maxPlayerHealth: 20,
  playerHealth: 20,
};

const uiCache = { hotbarSignature: "", inventorySignature: "" };
const player = {
  radius: 0.32,
  height: 1.72,
  eyeHeight: 1.62,
  walkSpeed: 5.2,
  sprintSpeed: 7.8,
  creativeSpeed: 8.4,
  jumpVelocity: 7.4,
  gravity: 22,
};

const raycaster = new THREE.Raycaster();
const mobRaycaster = new THREE.Raycaster();
raycaster.far = 7.5;
mobRaycaster.far = 12;
const clock = new THREE.Clock();
const forwardVector = new THREE.Vector3();
const fallbackAnchor = new THREE.Vector3();
const projectileGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
const projectileMaterial = new THREE.MeshLambertMaterial({ color: "#c2d8de" });
const projectiles = [];

function slotIndexForHotbarIndex(index) {
  return HOTBAR_START + index;
}

function getHotbarItem(index = state.selectedIndex) {
  return state.slots[slotIndexForHotbarIndex(index)];
}

function getSelectedItem() {
  return getHotbarItem();
}

function getSelectedItemDef() {
  const item = getSelectedItem();
  return item ? getItemDef(item.itemId) : null;
}

function selectedLabel() {
  return getSelectedItemDef()?.label ?? "Empty";
}

function heldStackLabel() {
  if (!state.heldStack) {
    return "Empty";
  }
  const definition = getItemDef(state.heldStack.itemId);
  if (definition?.kind === "tool") {
    return `${definition.label} (${state.heldStack.durability})`;
  }
  return `${definition?.label ?? state.heldStack.itemId} x${state.heldStack.count}`;
}

function addItemToInventory(itemId, count = 1) {
  const definition = getItemDef(itemId);
  if (!definition) {
    return false;
  }

  if (definition.kind === "tool") {
    const emptyIndex = state.slots.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      return false;
    }
    state.slots[emptyIndex] = createToolItem(itemId);
    return true;
  }

  let remaining = count;
  for (let index = 0; index < INVENTORY_SLOT_COUNT; index += 1) {
    const slot = state.slots[index];
    if (!slot || slot.itemId !== itemId || slot.count >= definition.maxStack) {
      continue;
    }
    const space = definition.maxStack - slot.count;
    const added = Math.min(space, remaining);
    slot.count += added;
    remaining -= added;
    if (remaining === 0) {
      return true;
    }
  }

  for (let index = 0; index < INVENTORY_SLOT_COUNT; index += 1) {
    if (state.slots[index]) {
      continue;
    }
    const added = Math.min(definition.maxStack, remaining);
    state.slots[index] = createBlockItem(itemId, added);
    remaining -= added;
    if (remaining === 0) {
      return true;
    }
  }

  return remaining === 0;
}

function damageSelectedTool(amount = 1) {
  if (state.mode === "creative") {
    return;
  }

  const slotIndex = slotIndexForHotbarIndex(state.selectedIndex);
  const slot = state.slots[slotIndex];
  const definition = slot ? getItemDef(slot.itemId) : null;
  if (!slot || definition?.kind !== "tool") {
    return;
  }
  slot.durability -= amount;
  if (slot.durability <= 0) {
    state.slots[slotIndex] = null;
  }
}

function consumeSelectedBlockItem() {
  if (state.mode === "creative") {
    return true;
  }

  const slotIndex = slotIndexForHotbarIndex(state.selectedIndex);
  const slot = state.slots[slotIndex];
  const definition = slot ? getItemDef(slot.itemId) : null;
  if (!slot || definition?.kind !== "block") {
    return false;
  }
  slot.count -= 1;
  if (slot.count <= 0) {
    state.slots[slotIndex] = null;
  }
  return true;
}

function swapOrMergeHeldStack(slotIndex) {
  const slot = state.slots[slotIndex];
  const held = state.heldStack;
  if (!held && !slot) {
    return;
  }
  if (!held) {
    state.heldStack = cloneItem(slot);
    state.slots[slotIndex] = null;
    return;
  }
  if (!slot) {
    state.slots[slotIndex] = cloneItem(held);
    state.heldStack = null;
    return;
  }

  const heldDef = getItemDef(held.itemId);
  const slotDef = getItemDef(slot.itemId);
  if (
    heldDef?.kind === "block" &&
    slotDef?.kind === "block" &&
    held.itemId === slot.itemId &&
    slot.count < slotDef.maxStack
  ) {
    const transfer = Math.min(slotDef.maxStack - slot.count, held.count);
    slot.count += transfer;
    held.count -= transfer;
    if (held.count <= 0) {
      state.heldStack = null;
    }
    return;
  }

  state.slots[slotIndex] = cloneItem(held);
  state.heldStack = cloneItem(slot);
}

function inventorySlotMarkup(slot, slotIndex, showIndex) {
  const definition = slot ? getItemDef(slot.itemId) : null;
  const hotbarNumber = slotIndex >= HOTBAR_START ? slotIndex - HOTBAR_START + 1 : null;
  const label = definition ? definition.label : "Empty";
  const countLabel = definition?.kind === "tool"
    ? `dur ${slot.durability}`
    : slot
      ? `x${slot.count}`
      : "";
  const classes = [
    "inventory-slot",
    !slot ? "is-empty" : "",
    slotIndex === slotIndexForHotbarIndex(state.selectedIndex) ? "is-selected" : "",
    state.heldStack && state.heldStack.itemId === slot?.itemId ? "is-held" : "",
  ].filter(Boolean).join(" ");

  return `
    <button type="button" class="${classes}" data-slot-index="${slotIndex}">
      <span class="inventory-slot__name">${label}</span>
      ${countLabel ? `<span class="inventory-slot__count">${countLabel}</span>` : ""}
      ${showIndex && hotbarNumber ? `<span class="inventory-slot__index">${hotbarNumber}</span>` : ""}
    </button>
  `;
}

function renderHotbar() {
  const signature = JSON.stringify({
    selectedIndex: state.selectedIndex,
    hotbar: state.slots.slice(HOTBAR_START),
  });
  if (uiCache.hotbarSignature === signature) {
    return;
  }
  uiCache.hotbarSignature = signature;

  hotbar.innerHTML = "";
  for (let hotbarIndex = 0; hotbarIndex < HOTBAR_SLOT_COUNT; hotbarIndex += 1) {
    const slotIndex = slotIndexForHotbarIndex(hotbarIndex);
    const slot = state.slots[slotIndex];
    const definition = slot ? getItemDef(slot.itemId) : null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "inventory__slot",
      hotbarIndex === state.selectedIndex ? "is-selected" : "",
      !slot ? "is-empty" : "",
    ].filter(Boolean).join(" ");
    button.dataset.index = String(hotbarIndex);
    if (slot && definition?.kind === "tool") {
      button.innerHTML = `<strong>${definition.label}</strong><span>${slot.durability} | ${hotbarIndex + 1}</span>`;
    } else if (slot && definition) {
      button.innerHTML = `<strong>${definition.label}</strong><span>${slot.count} | ${hotbarIndex + 1}</span>`;
    } else {
      button.innerHTML = `<strong>Empty</strong><span>${hotbarIndex + 1}</span>`;
    }
    button.addEventListener("click", () => {
      state.selectedIndex = hotbarIndex;
      updatePanels();
    });
    hotbar.append(button);
  }
}

function bindInventorySlots() {
  inventoryStorage.querySelectorAll("[data-slot-index]").forEach((element) => {
    element.addEventListener("click", () => {
      swapOrMergeHeldStack(Number(element.dataset.slotIndex));
      updatePanels();
    });
  });
  inventoryHotbar.querySelectorAll("[data-slot-index]").forEach((element) => {
    element.addEventListener("click", () => {
      swapOrMergeHeldStack(Number(element.dataset.slotIndex));
      updatePanels();
    });
  });
}

function renderInventoryScreen() {
  const signature = JSON.stringify({
    selectedIndex: state.selectedIndex,
    heldStack: state.heldStack,
    inventoryOpen: state.inventoryOpen,
    slots: state.slots,
    mode: state.mode,
  });
  if (uiCache.inventorySignature === signature) {
    return;
  }
  uiCache.inventorySignature = signature;

  const storageMarkup = [];
  const hotbarMarkup = [];
  for (let index = 0; index < STORAGE_SLOT_COUNT; index += 1) {
    storageMarkup.push(inventorySlotMarkup(state.slots[index], index, false));
  }
  for (let index = HOTBAR_START; index < INVENTORY_SLOT_COUNT; index += 1) {
    hotbarMarkup.push(inventorySlotMarkup(state.slots[index], index, true));
  }

  inventoryStorage.innerHTML = storageMarkup.join("");
  inventoryHotbar.innerHTML = hotbarMarkup.join("");
  inventoryHeldLabel.textContent = heldStackLabel();
  inventoryModeLabel.textContent = state.mode === "creative"
    ? "Creative mode: tools never lose durability and blocks place freely."
    : "Survival mode: tools lose durability and blocks are consumed from inventory.";
  bindInventorySlots();
}

function openInventory() {
  state.inventoryOpen = true;
  inventoryScreen.classList.remove("is-hidden");
  controls.unlock();
  overlay.classList.add("is-hidden");
  updatePanels();
}

function closeInventory() {
  state.inventoryOpen = false;
  inventoryScreen.classList.add("is-hidden");
  updatePanels();
  controls.lock();
}

function toggleInventory() {
  if (state.inventoryOpen) {
    closeInventory();
  } else {
    openInventory();
  }
}

function syncRenderDistance() {
  const fogFar = world.getVisibleWorldRadius() * 1.45;
  scene.fog.near = fogFar * 0.52;
  scene.fog.far = fogFar;
  camera.far = fogFar + 80;
  camera.updateProjectionMatrix();
}

function updateBlueprintPanel() {
  const ui = blueprints.getUiState();
  blueprintName.textContent = ui.name;
  blueprintMeta.textContent = ui.meta;
  blueprintMaterials.textContent = ui.materialsText;
  blueprintStats.textContent = ui.statsText;
  blueprintStatus.textContent = ui.status;
  rotateBlueprintButton.disabled = !ui.hasBlueprint;
  clearBlueprintButton.disabled = !ui.hasBlueprint;
  buildBlueprintButton.disabled = !ui.canBuild;
  buildBlueprintButton.textContent = state.mode === "creative" ? "Auto Build" : "Build (Creative)";
}

function updatePanels(hit = null) {
  modeLabel.textContent = state.mode === "survival" ? "Survival" : "Creative";
  blockLabel.textContent = selectedLabel();
  playerHealthLabel.textContent = `${Math.ceil(state.playerHealth)} / ${state.maxPlayerHealth} HP`;
  coordsLabel.textContent = [
    camera.position.x.toFixed(1),
    camera.position.y.toFixed(1),
    camera.position.z.toFixed(1),
  ].join(", ");
  targetLabel.textContent = hit ? hit : state.lastHitName;
  loadedLabel.textContent = `${world.getLoadedChunkCount()} chunks`;
  mobLabel.textContent = `${animals.getMobCount()} passive`;
  renderHotbar();
  renderInventoryScreen();
  updateBlueprintPanel();
}

function respawnPlayer() {
  camera.position.copy(world.getSafeSpawnNear(camera.position.x, camera.position.z));
  state.velocityY = 0;
  state.onGround = false;
  state.playerHealth = state.maxPlayerHealth;
  world.updateStreaming(camera.position);
  animals.syncPopulation();
  syncRenderDistance();
}

function applyPlayerDamage(amount, reason = "damage") {
  if (state.mode === "creative" || amount <= 0) {
    return;
  }
  state.playerHealth = Math.max(0, state.playerHealth - amount);
  blueprints.status = `Player took ${amount} ${reason}.`;
  if (state.playerHealth <= 0) {
    blueprints.status = "You died. Respawning.";
    respawnPlayer();
  }
}

function playerBounds(position = camera.position) {
  const footY = position.y - player.eyeHeight;
  return {
    minX: position.x - player.radius,
    maxX: position.x + player.radius,
    minY: footY,
    maxY: footY + player.height,
    minZ: position.z - player.radius,
    maxZ: position.z + player.radius,
  };
}

function overlaps(a, b) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

function resolveCollisions(axis, amount) {
  const bounds = playerBounds();
  const nearby = world.getNearbySolidBlocks(
    bounds.minX,
    bounds.maxX,
    bounds.minY,
    bounds.maxY,
    bounds.minZ,
    bounds.maxZ,
  );

  for (const block of nearby) {
    const blockBounds = {
      minX: block.x,
      maxX: block.x + 1,
      minY: block.y,
      maxY: block.y + 1,
      minZ: block.z,
      maxZ: block.z + 1,
    };
    const current = playerBounds();
    if (!overlaps(current, blockBounds)) {
      continue;
    }

    if (axis === "x") {
      camera.position.x = amount > 0 ? blockBounds.minX - player.radius : blockBounds.maxX + player.radius;
    } else if (axis === "z") {
      camera.position.z = amount > 0 ? blockBounds.minZ - player.radius : blockBounds.maxZ + player.radius;
    } else if (axis === "y") {
      if (amount > 0) {
        camera.position.y = blockBounds.minY - player.height + player.eyeHeight;
      } else {
        camera.position.y = blockBounds.maxY + player.eyeHeight;
        state.onGround = true;
      }
      state.velocityY = 0;
    }
  }
}

function isPlacementBlocked(x, y, z) {
  const blockBounds = {
    minX: x,
    maxX: x + 1,
    minY: y,
    maxY: y + 1,
    minZ: z,
    maxZ: z + 1,
  };
  return overlaps(playerBounds(), blockBounds);
}

function updateMovement(delta) {
  const speed = state.sprint ? player.sprintSpeed : player.walkSpeed;
  const creativeSpeed = state.sprint ? player.creativeSpeed * 1.35 : player.creativeSpeed;

  camera.getWorldDirection(forwardVector);
  forwardVector.y = 0;
  forwardVector.normalize();
  const right = new THREE.Vector3().crossVectors(forwardVector, camera.up).normalize();
  const move = new THREE.Vector3();
  if (state.moveForward) move.add(forwardVector);
  if (state.moveBackward) move.sub(forwardVector);
  if (state.moveRight) move.add(right);
  if (state.moveLeft) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize();
  }

  if (state.mode === "creative") {
    camera.position.addScaledVector(move, creativeSpeed * delta);
    if (state.moveUp) camera.position.y += creativeSpeed * delta;
    if (state.moveDown) camera.position.y -= creativeSpeed * delta;
    if (camera.position.y < -10) {
      respawnPlayer();
    }
    return;
  }

  const horizontal = move.multiplyScalar(speed * delta);
  if (horizontal.x !== 0) {
    camera.position.x += horizontal.x;
    resolveCollisions("x", horizontal.x);
  }
  if (horizontal.z !== 0) {
    camera.position.z += horizontal.z;
    resolveCollisions("z", horizontal.z);
  }

  state.onGround = false;
  const verticalVelocityBeforeCollision = state.velocityY - player.gravity * delta;
  state.velocityY = verticalVelocityBeforeCollision;
  camera.position.y += state.velocityY * delta;
  resolveCollisions("y", verticalVelocityBeforeCollision);
  if (state.onGround && verticalVelocityBeforeCollision < -10.5) {
    const fallDamage = Math.max(1, Math.floor(Math.abs(verticalVelocityBeforeCollision) - 10.5));
    applyPlayerDamage(fallDamage, "fall damage");
  }
  if (camera.position.y < -10) {
    respawnPlayer();
  }
}

function toggleMode() {
  state.mode = state.mode === "survival" ? "creative" : "survival";
  state.velocityY = 0;
  state.onGround = false;
  blueprints.status = state.mode === "creative"
    ? "Creative mode active. Tools do not lose durability."
    : "Survival mode active. Tools lose durability and blocks are consumed.";
  updatePanels();
}

function currentBlockIntersection() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = raycaster.intersectObjects(world.getInteractableMeshes(), false)[0] ?? null;
  if (!hit) {
    return null;
  }
  const block = world.resolveHit(hit);
  return block ? { hit, block, distance: hit.distance } : null;
}

function currentMobIntersection(reach = 7.5) {
  mobRaycaster.far = reach;
  mobRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = mobRaycaster.intersectObjects(animals.getTargetMeshes(), true)[0] ?? null;
  if (!hit) {
    return null;
  }
  const mob = animals.resolveHit(hit);
  return mob ? { hit, mob, distance: hit.distance } : null;
}

function computeBlueprintAnchor(intersection) {
  if (!blueprints.hasBlueprint()) {
    return null;
  }
  if (intersection?.hit) {
    const placement = world.getPlacementPosition(intersection.hit);
    if (placement) {
      return placement;
    }
  }

  camera.getWorldDirection(forwardVector);
  const projectedX = camera.position.x + forwardVector.x * 8;
  const projectedZ = camera.position.z + forwardVector.z * 8;
  const surface = world.getSurfaceInfo(projectedX, projectedZ);
  fallbackAnchor.set(Math.floor(projectedX), surface.y + 1, Math.floor(projectedZ));
  return fallbackAnchor;
}

function refreshBlueprintPreview() {
  blueprints.refreshPreviewColors(true);
  updatePanels();
}

function meleeDamageForTool(definition) {
  if (!definition || definition.kind !== "tool") {
    return 1;
  }
  if (definition.id === "mace") {
    return definition.combatDamage + Math.max(0, Math.floor(Math.abs(Math.min(0, state.velocityY)) * definition.fallBonusFactor));
  }
  return definition.combatDamage;
}

function harvestBlockDrop(blockType) {
  return blockType === "farmland" ? "dirt" : blockType;
}

function tryBreakBlock(block, definition) {
  const matchedTool = definition?.kind === "tool" && TOOL_BREAK_MAP[definition.id]?.has(block.type);
  const canBreak = !definition || definition.kind === "block" || matchedTool || definition.id === "sword";
  if (!canBreak) {
    return false;
  }

  if (!world.removeBlock(block.x, block.y, block.z)) {
    return false;
  }

  const dropId = harvestBlockDrop(block.type);
  if (BLOCK_ITEM_IDS.includes(dropId)) {
    addItemToInventory(dropId, 1);
  }
  if (definition?.kind === "tool") {
    damageSelectedTool(1);
  }
  refreshBlueprintPreview();
  return true;
}

function tryTillBlock(block, definition) {
  if (definition?.id !== "hoe" || !definition.till.includes(block.type)) {
    return false;
  }
  const aboveType = world.getBlockType(block.x, block.y + 1, block.z);
  if (aboveType && aboveType !== "water") {
    return false;
  }

  if (!world.setBlockId(block.x, block.y, block.z, 8)) {
    return false;
  }
  damageSelectedTool(1);
  refreshBlueprintPreview();
  return true;
}

function attackMob(mob, definition) {
  const damage = meleeDamageForTool(definition);
  const result = animals.damageMob(mob.id, damage);
  if (definition?.kind === "tool") {
    damageSelectedTool(1);
  }
  if (result?.defeated) {
    addItemToInventory("wood", 1);
  }
  updatePanels();
}

function throwSpear() {
  const selected = getSelectedItem();
  const definition = getSelectedItemDef();
  if (!selected || definition?.id !== "spear" || state.spearCooldown > 0) {
    return;
  }

  camera.getWorldDirection(forwardVector);
  const mesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
  mesh.castShadow = true;
  mesh.position.copy(camera.position);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forwardVector.clone().normalize());
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity: forwardVector.clone().multiplyScalar(18),
    life: 1.6,
  });
  state.spearCooldown = 0.8;
  damageSelectedTool(2);
}

function handlePrimaryAction(event) {
  if (!controls.isLocked || state.inventoryOpen) {
    return;
  }

  const definition = getSelectedItemDef();
  const mobIntersection = currentMobIntersection(definition?.reach ?? 7.5);
  const blockIntersection = currentBlockIntersection();

  if (event.button === 0) {
    if (mobIntersection && (!blockIntersection || mobIntersection.distance <= blockIntersection.distance)) {
      attackMob(mobIntersection.mob, definition);
      return;
    }

    if (blockIntersection?.block && blockIntersection.block.type !== "water") {
      tryBreakBlock(blockIntersection.block, definition);
      state.lastHitName = "None";
    }
  }

  if (event.button === 2) {
    if (definition?.id === "spear") {
      throwSpear();
      return;
    }

    if (blockIntersection && tryTillBlock(blockIntersection.block, definition)) {
      return;
    }

    const selected = getSelectedItem();
    if (!selected || definition?.kind !== "block") {
      return;
    }

    const placement = blockIntersection ? world.getPlacementPosition(blockIntersection.hit) : null;
    if (!placement) {
      return;
    }

    if (!isPlacementBlocked(placement.x, placement.y, placement.z) && consumeSelectedBlockItem()) {
      const added = world.addBlock(placement.x, placement.y, placement.z, selected.itemId);
      if (!added && state.mode === "survival") {
        addItemToInventory(selected.itemId, 1);
      } else if (added) {
        refreshBlueprintPreview();
      }
    }
  }

  updatePanels();
}

async function loadSampleBlueprint() {
  try {
    await blueprints.loadFromUrl(SAMPLE_BLUEPRINT_URL);
  } catch (error) {
    blueprints.status = error.message;
  }
  updatePanels();
}

async function importBlueprintFile(file) {
  if (!file) {
    return;
  }
  try {
    await blueprints.loadFromFile(file);
  } catch (error) {
    blueprints.status = error.message;
  }
  updatePanels();
}

function autoBuildBlueprint() {
  const result = blueprints.autoBuild(state.mode === "creative");
  if (result.error) {
    blueprints.status = result.error;
  }
  updatePanels();
}

function onKeyChange(event, pressed) {
  switch (event.code) {
    case "KeyW":
      state.moveForward = pressed;
      break;
    case "KeyS":
      state.moveBackward = pressed;
      break;
    case "KeyA":
      state.moveLeft = pressed;
      break;
    case "KeyD":
      state.moveRight = pressed;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      state.sprint = pressed;
      if (state.mode === "creative") {
        state.moveDown = pressed;
      }
      break;
    case "Space":
      if (pressed) {
        if (state.mode === "creative") {
          state.moveUp = true;
        } else if (state.onGround) {
          state.velocityY = player.jumpVelocity;
          state.onGround = false;
        }
      } else {
        state.moveUp = false;
      }
      break;
    case "KeyE":
      if (pressed && !event.repeat) {
        toggleInventory();
      }
      break;
    case "Digit1":
    case "Digit2":
    case "Digit3":
    case "Digit4":
    case "Digit5":
    case "Digit6":
    case "Digit7":
    case "Digit8":
    case "Digit9":
      if (pressed) {
        state.selectedIndex = Number(event.code.replace("Digit", "")) - 1;
        updatePanels();
      }
      break;
    case "KeyM":
      if (pressed && !event.repeat) {
        toggleMode();
      }
      break;
    case "KeyR":
      if (pressed && !event.repeat && blueprints.hasBlueprint()) {
        blueprints.rotateRight();
        updatePanels();
      }
      break;
    case "BracketLeft":
      if (pressed && !event.repeat && blueprints.hasBlueprint()) {
        blueprints.adjustYOffset(-1);
        updatePanels();
      }
      break;
    case "BracketRight":
      if (pressed && !event.repeat && blueprints.hasBlueprint()) {
        blueprints.adjustYOffset(1);
        updatePanels();
      }
      break;
    case "KeyG":
      if (pressed && !event.repeat && blueprints.hasBlueprint()) {
        autoBuildBlueprint();
      }
      break;
    default:
      break;
  }
}

function updateProjectiles(delta) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.life -= delta;
    projectile.velocity.y -= 14 * delta;
    projectile.mesh.position.addScaledVector(projectile.velocity, delta);

    const direction = projectile.velocity.clone().normalize();
    projectile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    const blockType = world.getBlockType(
      Math.floor(projectile.mesh.position.x),
      Math.floor(projectile.mesh.position.y),
      Math.floor(projectile.mesh.position.z),
    );

    let shouldRemove = projectile.life <= 0 || (blockType && blockType !== "water");
    if (!shouldRemove) {
      for (const target of animals.getTargetMeshes()) {
        if (target.position.distanceTo(projectile.mesh.position) > 0.95) {
          continue;
        }

        const result = animals.damageMob(target.userData.mobId, 6);
        if (result?.defeated) {
          addItemToInventory("wood", 1);
        }
        shouldRemove = true;
        break;
      }
    }

    if (shouldRemove) {
      scene.remove(projectile.mesh);
      projectiles.splice(index, 1);
    }
  }
}

function updateInteractionTarget() {
  const selectedDefinition = getSelectedItemDef();
  const mobIntersection = currentMobIntersection(selectedDefinition?.reach ?? 7.5);
  const blockIntersection = currentBlockIntersection();

  if (mobIntersection && (!blockIntersection || mobIntersection.distance <= blockIntersection.distance)) {
    state.lastHitName = mobIntersection.mob.type[0].toUpperCase() + mobIntersection.mob.type.slice(1);
  } else if (blockIntersection?.block) {
    state.lastHitName = blockIntersection.block.type[0].toUpperCase() + blockIntersection.block.type.slice(1);
  } else {
    state.lastHitName = "None";
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  state.dayTime = (state.dayTime + delta * 0.02) % 1;
  state.spearCooldown = Math.max(0, state.spearCooldown - delta);

  updateMovement(delta);
  world.updateStreaming(camera.position);
  animals.update(delta, camera.position);
  updateProjectiles(delta);
  blueprints.update(computeBlueprintAnchor(currentBlockIntersection()), delta);
  updateInteractionTarget();
  syncRenderDistance();

  renderer.render(scene, camera);
  updatePanels();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("wheel", (event) => {
  if (state.inventoryOpen) {
    return;
  }
  const direction = event.deltaY > 0 ? 1 : -1;
  state.selectedIndex = (state.selectedIndex + direction + HOTBAR_SLOT_COUNT) % HOTBAR_SLOT_COUNT;
  updatePanels();
}, { passive: true });

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  onKeyChange(event, true);
});

window.addEventListener("keyup", (event) => {
  onKeyChange(event, false);
});

window.addEventListener("mousedown", handlePrimaryAction);
window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

startButton.addEventListener("click", () => {
  controls.lock();
});

controls.addEventListener("lock", () => {
  overlay.classList.add("is-hidden");
  if (!state.inventoryOpen) {
    updatePanels();
  }
});

controls.addEventListener("unlock", () => {
  if (!state.inventoryOpen) {
    overlay.classList.remove("is-hidden");
  }
});

closeInventoryButton.addEventListener("click", () => {
  closeInventory();
});

loadSampleBlueprintButton.addEventListener("click", () => {
  loadSampleBlueprint();
});

importBlueprintButton.addEventListener("click", () => {
  blueprintFileInput.click();
});

blueprintFileInput.addEventListener("change", (event) => {
  importBlueprintFile(event.target.files?.[0] ?? null);
  blueprintFileInput.value = "";
});

rotateBlueprintButton.addEventListener("click", () => {
  if (!blueprints.hasBlueprint()) {
    return;
  }
  blueprints.rotateRight();
  updatePanels();
});

buildBlueprintButton.addEventListener("click", () => {
  if (!blueprints.hasBlueprint()) {
    return;
  }
  autoBuildBlueprint();
});

clearBlueprintButton.addEventListener("click", () => {
  blueprints.clear();
  updatePanels();
});

updatePanels();
syncRenderDistance();
animate();
