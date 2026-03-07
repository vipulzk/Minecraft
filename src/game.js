import * as THREE from "three";
import { PointerLockControls } from "../vendor/PointerLockControls.js";
import { AnimalManager } from "./mobs.js";
import { HOTBAR_TYPES, VoxelWorld } from "./world.js";

const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const hotbar = document.querySelector("#hotbar");
const modeLabel = document.querySelector("#modeLabel");
const blockLabel = document.querySelector("#blockLabel");
const coordsLabel = document.querySelector("#coordsLabel");
const targetLabel = document.querySelector("#targetLabel");
const loadedLabel = document.querySelector("#loadedLabel");
const mobLabel = document.querySelector("#mobLabel");

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

const ambient = new THREE.HemisphereLight("#d8ecff", "#50663d", 1.3);
scene.add(ambient);

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

const state = {
  mode: "survival",
  selectedIndex: 1,
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
};

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
raycaster.far = 7.5;
const clock = new THREE.Clock();

function prettyName(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function selectedType() {
  return HOTBAR_TYPES[state.selectedIndex];
}

function createHotbar() {
  hotbar.innerHTML = "";
  HOTBAR_TYPES.forEach((type, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inventory__slot";
    button.dataset.index = String(index);
    button.innerHTML = `<strong>${prettyName(type)}</strong><span>${index + 1}</span>`;
    button.addEventListener("click", () => {
      state.selectedIndex = index;
      updateHud();
    });
    hotbar.append(button);
  });
}

function syncRenderDistance() {
  const fogFar = world.getVisibleWorldRadius() * 1.45;
  scene.fog.near = fogFar * 0.52;
  scene.fog.far = fogFar;
  camera.far = fogFar + 80;
  camera.updateProjectionMatrix();
}

function updateHud(hit = null) {
  modeLabel.textContent = state.mode === "survival" ? "Survival" : "Creative";
  blockLabel.textContent = prettyName(selectedType());
  coordsLabel.textContent = [
    camera.position.x.toFixed(1),
    camera.position.y.toFixed(1),
    camera.position.z.toFixed(1),
  ].join(", ");
  targetLabel.textContent = hit ? prettyName(hit.type) : state.lastHitName;
  loadedLabel.textContent = `${world.getLoadedChunkCount()} chunks`;
  mobLabel.textContent = `${animals.getMobCount()} passive`;

  [...hotbar.children].forEach((slot, index) => {
    slot.classList.toggle("is-selected", index === state.selectedIndex);
  });
}

function respawnPlayer() {
  camera.position.copy(world.getSafeSpawnNear(camera.position.x, camera.position.z));
  state.velocityY = 0;
  state.onGround = false;
  world.updateStreaming(camera.position);
  animals.syncPopulation();
  syncRenderDistance();
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

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const move = new THREE.Vector3();
  if (state.moveForward) move.add(forward);
  if (state.moveBackward) move.sub(forward);
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
  state.velocityY -= player.gravity * delta;
  camera.position.y += state.velocityY * delta;
  resolveCollisions("y", state.velocityY);

  if (camera.position.y < -10) {
    respawnPlayer();
  }
}

function toggleMode() {
  state.mode = state.mode === "survival" ? "creative" : "survival";
  state.velocityY = 0;
  state.onGround = false;
  updateHud();
}

function currentIntersection() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(world.getInteractableMeshes(), false);
  const hit = hits[0] ?? null;
  if (!hit) {
    return null;
  }

  const block = world.resolveHit(hit);
  if (!block) {
    return null;
  }

  return { hit, block };
}

function handlePrimaryAction(event) {
  if (!controls.isLocked) {
    return;
  }

  const intersection = currentIntersection();
  if (!intersection) {
    return;
  }

  const { hit, block } = intersection;

  if (event.button === 0) {
    if (block.type !== "water") {
      world.removeBlock(block.x, block.y, block.z);
      state.lastHitName = "None";
    }
  }

  if (event.button === 2) {
    const placement = world.getPlacementPosition(hit);
    if (!placement) {
      return;
    }

    if (!isPlacementBlocked(placement.x, placement.y, placement.z)) {
      world.addBlock(placement.x, placement.y, placement.z, selectedType());
    }
  }

  updateHud();
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
    case "Digit1":
    case "Digit2":
    case "Digit3":
    case "Digit4":
    case "Digit5":
      if (pressed) {
        state.selectedIndex = Number(event.code.replace("Digit", "")) - 1;
        updateHud();
      }
      break;
    case "KeyM":
      if (pressed && !event.repeat) {
        toggleMode();
      }
      break;
    default:
      break;
  }
}

function updateSky(delta) {
  state.dayTime += delta * 0.08;
  const sunHeight = Math.sin(state.dayTime);
  const sunOrbit = Math.cos(state.dayTime);
  sun.position.set(24 * sunOrbit, 16 + 16 * sunHeight, 20 * Math.sin(state.dayTime * 0.5));
  sun.intensity = THREE.MathUtils.clamp(0.3 + Math.max(sunHeight, 0) * 1.15, 0.3, 1.5);
  ambient.intensity = THREE.MathUtils.clamp(0.45 + Math.max(sunHeight, 0) * 0.95, 0.35, 1.4);

  const dayColor = new THREE.Color("#8db8d9");
  const duskColor = new THREE.Color("#d88b63");
  const nightColor = new THREE.Color("#1d2945");
  const blend = sunHeight > 0
    ? dayColor.clone().lerp(duskColor, 1 - sunHeight)
    : duskColor.clone().lerp(nightColor, Math.min(1, Math.abs(sunHeight) + 0.1));
  scene.background.copy(blend);
  scene.fog.color.copy(blend);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (controls.isLocked) {
    updateMovement(delta);
  }

  const streamingChanged = world.updateStreaming(camera.position);
  if (streamingChanged) {
    syncRenderDistance();
    animals.syncPopulation();
  }

  animals.update(delta, camera.position);

  if (controls.isLocked) {
    const intersection = currentIntersection();
    const hit = intersection?.block ?? null;
    state.lastHitName = hit ? prettyName(hit.type) : "None";
    updateHud(hit);
  }

  updateSky(delta);
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

document.addEventListener("keydown", (event) => onKeyChange(event, true));
document.addEventListener("keyup", (event) => onKeyChange(event, false));
document.addEventListener("mousedown", handlePrimaryAction);
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("wheel", (event) => {
  const direction = event.deltaY > 0 ? 1 : -1;
  const total = HOTBAR_TYPES.length;
  state.selectedIndex = (state.selectedIndex + direction + total) % total;
  updateHud();
}, { passive: true });

controls.addEventListener("lock", () => {
  overlay.classList.add("is-hidden");
});

controls.addEventListener("unlock", () => {
  overlay.classList.remove("is-hidden");
});

startButton.addEventListener("click", () => controls.lock());
window.addEventListener("resize", onResize);

createHotbar();
syncRenderDistance();
updateHud();
animate();

window.blockWorldDebug = {
  world,
  animals,
  camera,
  state,
};
