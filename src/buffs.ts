export const BUFF_LABELS = { pass: 'Passe', speed: 'Velocidade', jump: 'Salto' } as const

export type BuffKind = keyof typeof BUFF_LABELS

export interface ActiveBuff {
  kind: BuffKind
  remaining: number
}

export interface BuffPickup {
  kind: BuffKind
  team: 'red' | 'blue'
  x: number
  y: number
}

export const BUFF_DURATION_SECONDS = 6
export const BUFF_SPEED_MULTIPLIER = 1.25
export const BUFF_JUMP_MULTIPLIER = 1.3
export const BUFF_PICKUP_RADIUS = 28

const OPPORTUNITIES = [
  { kind: 'pass', x: 255, y: 220 },
  { kind: 'speed', x: 270, y: 365 },
  { kind: 'jump', x: 225, y: 255 },
] as const

export function buffPickupsForRally(rally: number): BuffPickup[] {
  const pickup = OPPORTUNITIES[(rally - 1) % OPPORTUNITIES.length]!
  return [{ ...pickup, x: -pickup.x, team: 'red' }, { ...pickup, team: 'blue' }]
}
