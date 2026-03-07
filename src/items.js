export const TOOL_IDS = ["sword", "axe", "pickaxe", "hoe", "mace", "spear"];
export const BLOCK_ITEM_IDS = ["grass", "dirt", "stone", "sand", "wood", "leaves", "water"];

export const ITEM_DEFS = {
  grass: { id: "grass", label: "Grass", kind: "block", maxStack: 64 },
  dirt: { id: "dirt", label: "Dirt", kind: "block", maxStack: 64 },
  stone: { id: "stone", label: "Stone", kind: "block", maxStack: 64 },
  sand: { id: "sand", label: "Sand", kind: "block", maxStack: 64 },
  wood: { id: "wood", label: "Wood", kind: "block", maxStack: 64 },
  leaves: { id: "leaves", label: "Leaves", kind: "block", maxStack: 64 },
  water: { id: "water", label: "Water", kind: "block", maxStack: 16 },
  sword: {
    id: "sword",
    label: "Sword",
    kind: "tool",
    maxStack: 1,
    durability: 180,
    combatDamage: 5,
    reach: 7.5,
  },
  axe: {
    id: "axe",
    label: "Axe",
    kind: "tool",
    maxStack: 1,
    durability: 200,
    combatDamage: 4,
    mine: ["wood", "leaves"],
  },
  pickaxe: {
    id: "pickaxe",
    label: "Pickaxe",
    kind: "tool",
    maxStack: 1,
    durability: 220,
    combatDamage: 3,
    mine: ["stone"],
  },
  hoe: {
    id: "hoe",
    label: "Hoe",
    kind: "tool",
    maxStack: 1,
    durability: 170,
    combatDamage: 2,
    till: ["grass", "dirt"],
  },
  mace: {
    id: "mace",
    label: "Mace",
    kind: "tool",
    maxStack: 1,
    durability: 140,
    combatDamage: 6,
    fallBonusFactor: 0.35,
  },
  spear: {
    id: "spear",
    label: "Spear",
    kind: "tool",
    maxStack: 1,
    durability: 160,
    combatDamage: 4,
    reach: 10,
    throwable: true,
  },
};

export function getItemDef(itemId) {
  return ITEM_DEFS[itemId] ?? null;
}

export function createBlockItem(itemId, count = 1) {
  return { itemId, count };
}

export function createToolItem(itemId) {
  const definition = getItemDef(itemId);
  return {
    itemId,
    count: 1,
    durability: definition?.durability ?? 1,
  };
}

export function cloneItem(item) {
  return item ? { ...item } : null;
}
