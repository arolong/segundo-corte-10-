import type { Character } from "@prisma/client";

type BattleOutcome = {
  winnerId: number;
  turns: number;
};

type CombatantState = {
  id: number;
  health: number;
  attack: number;
  defense: number;
  speed: number;
};

function toCombatant(character: Character): CombatantState {
  return {
    id: character.id,
    health: character.health,
    attack: character.attack,
    defense: character.defense,
    speed: character.speed,
  };
}

function resolveTurnOrder(first: CombatantState, second: CombatantState) {
  if (first.speed === second.speed) {
    return [first, second] as const;
  }
  return first.speed > second.speed ? ([first, second] as const) : ([second, first] as const);
}

function calculateDamage(attacker: CombatantState, defender: CombatantState) {
  const rawDamage = attacker.attack - defender.defense * 0.5;
  return Math.max(1, Math.floor(rawDamage));
}

export function simulateBattle(character1: Character, character2: Character): BattleOutcome {
  const fighterA = toCombatant(character1);
  const fighterB = toCombatant(character2);

  const [first, second] = resolveTurnOrder(fighterA, fighterB);
  let turns = 0;

  while (fighterA.health > 0 && fighterB.health > 0) {
    const damageFirst = calculateDamage(first, second);
    second.health -= damageFirst;
    turns += 1;

    if (second.health <= 0) {
      break;
    }

    const damageSecond = calculateDamage(second, first);
    first.health -= damageSecond;
    turns += 1;
  }

  const winnerId = fighterA.health > 0 ? fighterA.id : fighterB.id;
  return { winnerId, turns };
}
