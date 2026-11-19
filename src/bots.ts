export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'brutal'

interface BotProfile {
  label: string
  reaction: number
  coverage: number
  trackingSpeed: number
  returnSpeed: number
  receiveJitter: number
  receiveSuccess: number
  blockChance: number
  setChance: number
  weakChance: number
  shotChance: number
}

export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'medium'

export const BOT_DIFFICULTIES = {
  easy: {
    label: 'Fácil', reaction: .34, coverage: .76, trackingSpeed: 220, returnSpeed: 132,
    receiveJitter: .20, receiveSuccess: .72, blockChance: .12, setChance: .09,
    weakChance: .48, shotChance: .18,
  },
  medium: {
    label: 'Médio', reaction: .17, coverage: .94, trackingSpeed: 266, returnSpeed: 165,
    receiveJitter: .11, receiveSuccess: .86, blockChance: .34, setChance: .22,
    weakChance: .20, shotChance: .25,
  },
  hard: {
    label: 'Difícil', reaction: .09, coverage: .98, trackingSpeed: 294, returnSpeed: 193,
    receiveJitter: .065, receiveSuccess: .94, blockChance: .60, setChance: .48,
    weakChance: .08, shotChance: .34,
  },
  brutal: {
    label: 'Brutal', reaction: .035, coverage: 1, trackingSpeed: 320, returnSpeed: 220,
    receiveJitter: .028, receiveSuccess: .985, blockChance: .82, setChance: .76,
    weakChance: .03, shotChance: .40,
  },
} as const satisfies Record<BotDifficulty, BotProfile>

// Decisions stay constant for one contact, regardless of the simulation step size.
export function botRoll(playerId: number, rally: number, contact: number, salt = 0): number {
  const seed = Math.imul(playerId + 1, 0x9e3779b1) ^ Math.imul(rally + 1, 0x85ebca6b)
    ^ Math.imul(contact + 1, 0xc2b2ae35) ^ Math.imul(salt, 0x27d4eb2d)
  const mixed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d)
  const spread = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return ((spread ^ (spread >>> 16)) >>> 0) / 0x100000000
}

export function chooseBotServe(difficulty: BotDifficulty, rally: number): 1 | 2 | 3 {
  switch (difficulty) {
    case 'easy': return rally % 7 === 0 ? 2 : 1
    case 'medium': return rally % 5 === 0 ? 3 : rally % 3 === 0 ? 2 : 1
    case 'hard': return rally % 5 === 0 ? 1 : rally % 3 === 0 ? 3 : 2
    case 'brutal': return rally % 6 === 0 ? 1 : rally % 3 === 1 ? 2 : 3
  }
}

export function chooseBotAttack(
  difficulty: BotDifficulty, roll: number, roomForShot = 0, roomForStrong = 0,
): 'Ataque forte' | 'Shot' | 'Ataque fraco' {
  if (difficulty === 'brutal' && Math.abs(roomForShot - roomForStrong) >= 10) {
    return roomForShot > roomForStrong ? 'Shot' : 'Ataque forte'
  }
  const { weakChance, shotChance } = BOT_DIFFICULTIES[difficulty]
  if (roll < weakChance) return 'Ataque fraco'
  return roll < weakChance + shotChance ? 'Shot' : 'Ataque forte'
}
