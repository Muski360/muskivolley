import { BOT_DIFFICULTIES, DEFAULT_BOT_DIFFICULTY, botRoll, chooseBotAttack, chooseBotServe, type BotDifficulty } from './bots'
import {
  BUFF_DURATION_SECONDS, BUFF_JUMP_MULTIPLIER, BUFF_LABELS, BUFF_PICKUP_RADIUS, BUFF_SPEED_MULTIPLIER,
  buffPickupsForRally, type ActiveBuff, type BuffPickup,
} from './buffs'

export const COURT = { halfWidth: 450, depth: 500, netHeight: 105 } as const

type Team = 'red' | 'blue'
type Serve = 1 | 2 | 3
type Action = 'idle' | 'move' | 'jump' | 'serve' | 'receive' | 'set' | 'attack' | 'block'
type Phase = 'menu' | 'countdown' | 'serve' | 'rally' | 'point' | 'finished'
type Grade = 'A+' | 'A' | 'B'
type Hit = 'Ataque forte' | 'Shot' | 'Ataque fraco' | 'Largada'

interface Position { x: number; y: number; z: number }

export interface Player extends Position {
  id: number
  team: Team
  name: string
  bot: boolean
  difficulty?: BotDifficulty
  buff?: ActiveBuff
  vx: number
  vy: number
  action: Action
  actionTime: number
  jumpTime: number
  jumpPower: number
}

export interface MatchOptions {
  bots?: readonly [BotDifficulty, BotDifficulty, BotDifficulty]
  buffs?: boolean
}

export interface GameInput {
  left?: boolean
  right?: boolean
  up?: boolean
  down?: boolean
  space?: boolean
  w?: boolean
  s?: boolean
  serve?: Serve
}

interface Feedback extends Position {
  id: number
  text: string
  kind: Team | 'green' | 'teal' | 'yellow' | 'neutral' | 'error'
}

interface Timing {
  x: number
  y: number
  progress: number
  active: boolean
  ideal: boolean
  action: 'serve' | 'receive' | 'set' | 'attack' | 'block'
}

export interface GameState {
  red: number
  blue: number
  phase: Phase
  countdown?: number
  message: string
  player: string
  players: Player[]
  ball: Position
  serve: Serve
  server: Team
  buffsEnabled: boolean
  pickups: BuffPickup[]
  timing?: Timing
  feedback?: Feedback
  feedbackEvents: Feedback[]
}

interface Flight {
  from: Position
  to: Position
  duration: number
  elapsed: number
  gravity: number
  stage: 'incoming' | 'set' | 'attack' | 'loose'
  team: Team
  actor: Player
  serve?: Serve
  grade?: Grade
  perfect?: boolean
  lateralDrift?: number
  attack?: Hit
  pointFor?: Team
  reason?: string
}

type FlightDetails = Pick<Flight, 'grade' | 'serve' | 'perfect' | 'lateralDrift' | 'attack' | 'pointFor' | 'reason'>

const HOMES = [{ x: -288, y: 326 }, { x: -144, y: 165 }, { x: 270, y: 325 }, { x: 140, y: 167 }]
const SERVE_NAMES = { 1: 'Normal', 2: 'Flutuante', 3: 'Viagem' } as const
const SERVES = {
  1: { duration: 1.83, start: 0, end: 1, receive: .47, height: 76, gravity: 350 },
  2: { duration: 1.61, start: .26, end: .84, receive: .35, height: 85, gravity: 405 },
  3: { duration: 1.34, start: .46, end: .70, receive: .27, height: 103, gravity: 445 },
} as const
const JUMP_SECONDS = .64
const BLOCK_PLANE = 28
const RECEIVE_IDEAL = .17
const SET_IDEAL = .12
const BUFF_FEEDBACK = { pass: 'green', speed: 'yellow', jump: 'teal' } as const
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const otherTeam = (team: Team): Team => team === 'red' ? 'blue' : 'red'
const side = (team: Team) => team === 'red' ? -1 : 1
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const jumpHeight = (time: number, power: number) => Math.sin(Math.PI * clamp(time, 0, JUMP_SECONDS) / JUMP_SECONDS) * 78 * power
const jumpPower = (player: Player) => player.buff?.kind === 'jump' ? BUFF_JUMP_MULTIPLIER : 1
const blockHandHeight = (height: number) => height * .82 + 75
const difficultyOf = (player: Player) => player.difficulty ?? DEFAULT_BOT_DIFFICULTY
const moveSpeed = (player: Player, speed: number) => player.buff?.kind === 'speed' ? speed * BUFF_SPEED_MULTIPLIER : speed

function cleanBlock(flight: Flight, offset: number, handError: number): boolean {
  return offset < (flight.perfect ? 18 : 27) && handError < (flight.perfect ? 14 : 22)
}

function positionOnFlight(flight: Flight, elapsed: number): Position {
  const t = clamp(elapsed, 0, flight.duration)
  const fraction = t / flight.duration
  return {
    x: flight.from.x + (flight.to.x - flight.from.x) * fraction,
    y: flight.from.y + (flight.to.y - flight.from.y) * fraction
      + (flight.lateralDrift ?? 0) * Math.sin(fraction * Math.PI) * Math.sin(fraction * Math.PI * 3),
    z: flight.from.z + (flight.to.z - flight.from.z) * fraction + .5 * flight.gravity * t * (flight.duration - t),
  }
}

function timeAtX(flight: Flight, x: number): number {
  const fraction = (x - flight.from.x) / (flight.to.x - flight.from.x)
  return fraction > 0 && fraction <= 1 ? fraction * flight.duration : Infinity
}

function receptionGrade(flight: Flight, player: Player, ball: Position): Grade | undefined {
  const remaining = flight.duration - flight.elapsed
  const window = flight.serve ? SERVES[flight.serve].receive : flight.perfect ? .32 : .47
  if (remaining <= .035 || remaining > window || ball.x * side(player.team) <= 0
    || ball.z > 113 || distance(player, ball) > 112) return
  if (player.buff?.kind === 'pass') return flight.serve === 3 ? 'A' : 'A+'
  const error = Math.abs(remaining - RECEIVE_IDEAL)
  const tight = flight.perfect || flight.serve === 2 || flight.serve === 3
  if (flight.serve !== 3 && error <= (tight ? .05 : .07)) return 'A+'
  if (error <= (flight.serve === 3 ? .075 : tight ? .105 : .14)) return 'A'
  return 'B'
}

export class Volleyball {
  readonly state: GameState = {
    red: 0, blue: 0, phase: 'menu', message: '', player: 'Você', players: [],
    ball: { x: 0, y: 255, z: 155 }, serve: 1, server: 'red', feedbackEvents: [],
    buffsEnabled: false, pickups: [],
  }

  private flight: Flight | undefined
  private phaseTime = 0
  private rally = 0
  private contacts = 0
  private feedbackId = 0
  private winner: Team | undefined
  private combo: 'W' | 'WW' | 'WS' | undefined

  constructor() { this.reset() }

  reset(): void {
    const state = this.state
    state.red = 0
    state.blue = 0
    state.phase = 'menu'
    state.message = ''
    state.serve = 1
    state.server = 'red'
    state.buffsEnabled = false
    state.pickups = []
    state.players = ['Você', 'Léo', 'Nina', 'Caio'].map((name, id) => ({
      ...HOMES[id]!, z: 0, id, name, bot: id !== 0, team: id < 2 ? 'red' : 'blue',
      difficulty: id === 0 ? undefined : DEFAULT_BOT_DIFFICULTY,
      vx: 0, vy: 0, action: 'idle', actionTime: 0, jumpTime: 0, jumpPower: 1,
    }))
    state.player = 'Você'
    delete state.countdown
    delete state.feedback
    state.feedbackEvents.length = 0
    delete state.timing
    this.flight = undefined
    this.winner = undefined
    this.phaseTime = 0
    this.contacts = 0
    this.rally = 0
    this.combo = undefined
    state.ball = { x: 50, y: 255, z: 158 }
  }

  start(name: string, options: MatchOptions = {}): void {
    this.reset()
    this.state.buffsEnabled = options.buffs ?? false
    options.bots?.forEach((difficulty, index) => { this.state.players[index + 1]!.difficulty = difficulty })
    this.state.player = name.trim().slice(0, 22) || 'Você'
    this.state.players[0]!.name = this.state.player
    this.state.phase = 'countdown'
    this.state.countdown = 3
    this.state.message = 'Prepare-se!'
    this.placePlayers()
  }

  step(dtSeconds: number, input: GameInput = {}): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return
    const dt = Math.min(dtSeconds, .05)
    const state = this.state
    this.phaseTime += dt

    if (state.phase === 'menu') {
      const t = this.phaseTime
      state.ball = { x: -24 + 252 * Math.sin(t * 1.3 + .3), y: 255 + 66 * Math.sin(t * .8), z: 87 + 110 * Math.abs(Math.cos(t * 1.32)) }
      return
    }

    if (state.phase === 'rally' && state.buffsEnabled) this.expireBuffs(dt)
    this.advancePoses(dt)
    if (state.phase === 'countdown') {
      state.countdown = Math.max(1, Math.ceil(3 - this.phaseTime - .0001))
      if (this.phaseTime >= 3 - .0001) this.prepareServe()
      return
    }

    if (state.phase === 'point') {
      if (this.phaseTime < 1.05) return
      if (this.winner) {
        state.phase = 'finished'
        state.message = this.winner === 'red' ? 'Vitória da equipe vermelha!' : 'Vitória da equipe azul!'
      } else {
        this.prepareServe()
      }
      return
    }

    if (state.phase === 'serve') {
      this.updateServe(input)
      return
    }

    if (state.phase === 'rally') this.advanceRally(dt, input)
  }

  private placePlayers(): void {
    for (const player of this.state.players) {
      Object.assign(player, HOMES[player.id], { z: 0, vx: 0, vy: 0, action: 'idle', actionTime: 0, jumpTime: 0, jumpPower: 1 })
    }
    const server = this.servingPlayer()
    server.x = server.team === 'red' ? -414 : 414
    server.y = 320
    this.state.ball = { x: server.x, y: server.y, z: 76 }
  }

  private servingPlayer(): Player {
    return this.state.players[this.state.server === 'red' ? 0 : 2]!
  }

  private prepareServe(): void {
    this.phaseTime = 0
    this.rally++
    this.contacts = 0
    if (this.state.buffsEnabled) this.state.pickups = buffPickupsForRally(this.rally)
    this.state.phase = 'serve'
    this.state.message = this.state.server === 'red' ? 'Espaço para sacar' : 'Saque da equipe azul'
    delete this.state.countdown
    this.placePlayers()
  }

  private updateServe(input: GameInput): void {
    const server = this.servingPlayer()
    const selected = !server.bot && input.serve !== undefined ? input.serve : this.state.serve
    this.state.serve = selected
    const difficulty = difficultyOf(server)
    const kind = server.bot ? chooseBotServe(difficulty, this.rally) : selected
    const profile = SERVES[kind]
    const rhythm = (this.phaseTime % 1.1) / 1.1
    const active = rhythm >= profile.start && rhythm <= profile.end
    this.state.ball.z = profile.height
    if (!server.bot) {
      this.state.timing = {
        x: server.x, y: server.y, progress: rhythm, active,
        ideal: kind === 1 || Math.abs(rhythm - .58) < .06, action: 'serve',
      }
      this.state.message = `Saque ${SERVE_NAMES[kind].toLowerCase()} · ${kind === 1 || active ? 'Espaço para sacar' : 'Espere o anel acender'}`
    } else {
      delete this.state.timing
    }
    const botTiming = .63 + (botRoll(server.id, this.rally, 0, 1) * 2 - 1) * BOT_DIFFICULTIES[difficulty].receiveJitter * 1.25
    if (server.bot ? this.phaseTime < botTiming : !input.space) return

    this.pose(server, 'serve', .34)
    this.state.phase = 'rally'
    if (!active) {
      this.say('Erro de saque', server, 'error')
      const front = { x: -side(server.team) * 52, y: server.y + (rhythm < profile.start ? -16 : 16), z: 0 }
      this.sendBall(front, .62, 'incoming', otherTeam(server.team), server, { reason: 'Erro de saque' }, 195)
      this.state.message = 'Erro de saque'
      return
    }

    this.say(SERVE_NAMES[kind], server, 'neutral')
    const target = server.team === 'red'
      ? { x: 277, y: this.rally % 2 ? 326 : 236, z: 0 }
      : { x: -305, y: this.rally % 2 ? 327 : 263, z: 0 }
    this.sendBall(target, profile.duration, 'incoming', otherTeam(server.team), server,
      { serve: kind, lateralDrift: kind === 2 ? (this.rally % 2 ? 34 : -34) : undefined }, profile.gravity)
  }

  private sendBall(to: Position, duration: number, stage: Flight['stage'], team: Team, actor: Player, details: FlightDetails = {}, gravity = 370): void {
    const flight = { from: { ...this.state.ball }, to, duration, elapsed: 0, gravity, stage, team, actor, ...details }
    const crossing = timeAtX(flight, 0)
    if (stage === 'incoming' && details.reason !== 'Erro de saque' && Number.isFinite(crossing) && crossing < duration) {
      // Keep intended shots above the tape even when contact happens far from the net.
      const flatHeight = flight.from.z + (to.z - flight.from.z) * crossing / duration
      const requiredGravity = (COURT.netHeight + 10 - flatHeight) / (.5 * crossing * (duration - crossing))
      flight.gravity = Math.max(gravity, requiredGravity)
    }
    this.flight = flight
    this.combo = undefined
    delete this.state.timing
    const human = this.state.players[0]!
    this.state.message = stage === 'incoming' && team === human.team ? 'Espaço para receber'
      : stage === 'loose' ? details.reason ?? 'Bola desviada'
      : stage === 'set' && actor === human ? details.grade === 'B' ? 'Passe B · Espaço para levantar' : 'Espaço para levantar · S para largar'
      : stage === 'attack' && actor === human ? 'W W ataque  ·  W S shot'
      : stage === 'set' && team === human.team ? 'Seu parceiro vai levantar'
      : stage === 'set' ? 'O adversário vai levantar'
      : stage === 'attack' ? 'Ataque a caminho' : 'Observe a defesa'
  }

  private advanceRally(dt: number, input: GameInput): void {
    const flight = this.flight!
    const human = this.state.players[0]!
    const previousTime = flight.elapsed
    flight.elapsed += dt
    const ball = this.state.ball = positionOnFlight(flight, flight.elapsed)
    this.move(human, Number(!!input.right) - Number(!!input.left), Number(!!input.down) - Number(!!input.up), moveSpeed(human, 320), dt)
    const remaining = flight.duration - flight.elapsed
    if (flight.stage === 'loose') {
      if (remaining <= 0) this.point(flight.pointFor!, flight.reason)
      return
    }
    this.moveBots(flight, dt)
    if (this.state.pickups.length) this.collectBuffs()
    delete this.state.timing

    if (flight.stage === 'incoming') {
      this.advanceIncoming(flight, previousTime, remaining, human, input)
      return
    }

    const player = flight.actor
    const controlled = player === human
    const autoJump = flight.stage === 'set' ? .43 : .49
    if (remaining <= autoJump && flight.duration - previousTime > autoJump) {
      this.pose(player, 'jump', JUMP_SECONDS, true)
    }
    if (flight.stage === 'set') {
      const reachable = distance(player, ball) <= 108 && ball.z <= player.z + 109
      const windowError = Math.abs(remaining - SET_IDEAL)
      const active = reachable && player.jumpTime > 0 && remaining >= .02 && remaining <= .29
      const ideal = flight.grade === 'A+' || windowError <= .055
      const canDump = active && (flight.grade === 'A+' || (flight.grade === 'A' && windowError <= .062))
      const manualSet = controlled && !!input.space && active
      const botSet = player.bot && active && remaining <= SET_IDEAL
      const preciseBotSet = botSet && botRoll(player.id, this.rally, this.contacts, 2) < BOT_DIFFICULTIES[difficultyOf(player)].setChance
      if (controlled && remaining <= .66) this.markTiming(flight.to, remaining, .66, 'set', active, active && ideal)
      if (controlled && input.s && canDump) {
        this.hitAcross(player, 'Largada', flight.grade === 'A+')
      } else if (manualSet || botSet || remaining <= 0) {
        if (reachable) this.set(player, flight.grade === 'A+' || (manualSet && ideal) || preciseBotSet)
        else this.missOwnCourt(flight, player, 'Erro de levantamento')
      }
      return
    }

    const airborne = player.jumpTime > 0 && player.z > 2
    if (controlled && remaining <= .66) {
      this.markTiming(flight.to, remaining, .66, 'attack', airborne, false)
    }
    if (controlled && airborne) {
      if (this.combo === 'W' && input.s) this.combo = 'WS'
      else if (this.combo === 'W' && input.w) this.combo = 'WW'
      else if (!this.combo && input.w) this.combo = 'W'
    }
    if (remaining > 0) return
    if (distance(player, ball) > 111 || ball.z > player.z + 111) {
      this.missOwnCourt(flight, player, 'Erro de ataque')
      return
    }
    const text = player.bot ? this.botAttack(player)
      : this.combo === 'WS' ? 'Shot' : this.combo === 'WW' ? 'Ataque forte' : 'Ataque fraco'
    this.hitAcross(player, text, !!flight.perfect)
  }

  private markTiming(at: Position, remaining: number, preview: number, action: Timing['action'], active: boolean, ideal: boolean): void {
    this.state.timing = { x: at.x, y: at.y, progress: clamp(1 - remaining / preview, 0, 1), action, active, ideal }
  }

  private advanceIncoming(flight: Flight, previousTime: number, remaining: number, human: Player, input: GameInput): void {
    const ball = this.state.ball
    const netTime = timeAtX(flight, 0)
    if (previousTime < netTime && netTime <= flight.elapsed) {
      const crossing = positionOnFlight(flight, netTime)
      if (crossing.z < COURT.netHeight && crossing.y >= 0 && crossing.y <= COURT.depth) {
        this.state.ball = crossing
        const hitter = flight.actor
        if (!flight.reason) this.say('Rede', crossing, 'error')
        this.sendBall({ x: side(hitter.team) * 22, y: crossing.y, z: 0 }, .32, 'loose', hitter.team, hitter,
          { pointFor: otherTeam(hitter.team), reason: flight.reason ?? 'Bola na rede' }, 125)
        return
      }
    }

    const blockTime = flight.attack ? timeAtX(flight, side(flight.team) * BLOCK_PLANE) : Infinity
    const blockRemaining = blockTime - flight.elapsed
    if (previousTime < blockTime && blockTime <= flight.elapsed && this.resolveBlock(flight, blockTime)) return
    if (human.team === flight.team) {
      const blockAt = positionOnFlight(flight, blockTime)
      const nearNet = Math.abs(human.x) <= 111
      const watchBlock = nearNet && blockRemaining > 0 && blockRemaining <= .72
      if (watchBlock) {
        const offset = Math.abs(blockAt.y - human.y)
        const height = jumpHeight(blockRemaining, jumpPower(human))
        const handError = Math.abs(blockAt.z - blockHandHeight(height))
        const active = human.jumpTime <= 0 && height > 18 && Math.abs(blockAt.x - human.x) <= 70
          && offset <= 76 && handError <= 40
        const ideal = active && cleanBlock(flight, offset, handError)
        this.markTiming(blockAt, blockRemaining, .72, 'block', active, ideal)
        this.state.message = 'Espaço para bloquear · alinhe-se com a bola'
        if (input.space && human.jumpTime <= 0) this.pose(human, 'block', JUMP_SECONDS, true)
      } else {
        this.state.message = 'Espaço para receber'
        const grade = receptionGrade(flight, human, ball)
        if (remaining <= .65 && remaining > 0) {
          const target = positionOnFlight(flight, flight.duration - RECEIVE_IDEAL)
          const ideal = grade === 'A+' || (flight.serve === 3 && grade === 'A')
          this.markTiming(target, remaining, .65, 'receive', grade !== undefined, ideal)
          if (input.space && human.action !== 'receive') {
            if (grade) {
              this.receive(human, grade)
              return
            }
            this.pose(human, 'receive', .26)
            this.say('Erro', human, 'error')
            if (ball.x * side(human.team) > 0 && distance(human, ball) <= 112 && ball.z <= 132) {
              const y = clamp(ball.y + (ball.y < human.y ? -86 : 86), 15, COURT.depth - 15)
              this.sendBall({ x: side(human.team) * Math.max(48, Math.abs(ball.x) - 35), y, z: 0 }, .39,
                'loose', human.team, human, { pointFor: otherTeam(human.team), reason: 'Erro de recepção' }, 135)
              return
            }
          }
        }
      }
    }

    if (flight.attack && blockRemaining >= .27 && blockRemaining <= .34) {
      const target = positionOnFlight(flight, blockTime)
      const bot = this.state.players.find(player => player.team === flight.team && player.bot && player.jumpTime <= 0
        && Math.abs(player.x) <= 96 && Math.abs(player.y - target.y) <= 62
        && botRoll(player.id, this.rally, this.contacts, 3) < BOT_DIFFICULTIES[difficultyOf(player)].blockChance)
      if (bot) this.pose(bot, 'block', JUMP_SECONDS, true)
    }

    if ((flight.team !== human.team || distance(human, ball) > 92) && this.receiveWithBot(flight, previousTime, remaining)) return
    if (remaining <= 0) {
      const inside = Math.abs(ball.x) <= COURT.halfWidth && ball.y >= 0 && ball.y <= COURT.depth
      if (inside && human.team === flight.team && distance(human, ball) < 85 && human.action !== 'receive') {
        this.pose(human, 'receive', .22)
        this.say('Erro', human, 'error')
      }
      this.point(inside ? otherTeam(ball.x < 0 ? 'red' : 'blue') : otherTeam(flight.actor.team), inside ? undefined : 'Bola fora')
    }
  }

  private receiveWithBot(flight: Flight, previousTime: number, remaining: number): boolean {
    const previousRemaining = flight.duration - previousTime
    // Long exchanges build pressure so strong bots eventually leave an opening.
    const pressure = Math.min(.32, Math.max(0, this.contacts - 6) * .022)
    for (const bot of this.state.players) {
      if (!bot.bot || bot.team !== flight.team || bot.action === 'block') continue
      const profile = BOT_DIFFICULTIES[difficultyOf(bot)]
      const jitter = (botRoll(bot.id, this.rally, this.contacts, 4) * 2 - 1) * profile.receiveJitter
      const attemptAt = Math.max(.045, RECEIVE_IDEAL + jitter)
      if (remaining > attemptAt || previousRemaining <= attemptAt
        || botRoll(bot.id, this.rally, this.contacts, 5) >= profile.receiveSuccess - pressure) continue
      const grade = receptionGrade(flight, bot, this.state.ball)
      if (!grade) continue
      this.receive(bot, grade)
      return true
    }
    return false
  }

  private resolveBlock(flight: Flight, time: number): boolean {
    const ball = positionOnFlight(flight, time)
    const blocker = this.state.players.find(player => player.team === flight.team && player.action === 'block'
      && player.z > 18 && Math.abs(ball.x - player.x) <= 70 && Math.abs(ball.y - player.y) <= 76
      && Math.abs(ball.z - blockHandHeight(player.z)) <= 40)
    if (!blocker) return false
    this.state.ball = ball
    this.contacts++
    const offset = Math.abs(ball.y - blocker.y)
    const handError = Math.abs(ball.z - blockHandHeight(blocker.z))

    if (offset > 50) {
      this.say('Explorou o bloqueio', ball, 'yellow')
      this.sendBall({ x: side(blocker.team) * 145, y: ball.y < blocker.y ? -45 : COURT.depth + 45, z: 0 },
        .56, 'loose', blocker.team, blocker, { pointFor: flight.actor.team, reason: 'Explorou o bloqueio' }, 235)
    } else if (cleanBlock(flight, offset, handError)) {
      this.say('Bloqueio', blocker, 'green')
      this.sendBall({ x: side(flight.actor.team) * 82, y: ball.y, z: 0 }, .53, 'incoming', flight.actor.team, blocker, { perfect: true }, 255)
    } else {
      const partner = this.partner(blocker)
      this.say('Amorteceu', blocker, 'teal')
      this.sendBall({ x: side(blocker.team) * Math.max(163, Math.abs(partner.x)), y: partner.y, z: 0 },
        .98, 'incoming', blocker.team, blocker, {}, 225)
    }
    return true
  }

  private missOwnCourt(flight: Flight, player: Player, reason: string): void {
    this.say(reason, player, 'error')
    this.sendBall({ ...flight.to, z: 0 }, .34, 'loose', player.team, player,
      { pointFor: otherTeam(player.team), reason }, 145)
  }

  private moveBots(flight: Flight, dt: number): void {
    const human = this.state.players[0]!
    const ball = this.state.ball
    const nearLanding = positionOnFlight(flight, flight.duration - .14)
    const eligible = this.state.players.filter(player => player.team === flight.team)
    const nearest = eligible.reduce((a, b) => distance(a, nearLanding) <= distance(b, nearLanding) ? a : b)
    for (const player of this.state.players) {
      if (!player.bot) continue
      const home = HOMES[player.id]!
      const profile = BOT_DIFFICULTIES[difficultyOf(player)]
      const covering = flight.stage === 'incoming' && flight.elapsed >= profile.reaction
        && player.team === flight.team && (player === nearest || nearest === human)
      const waiting = flight.stage !== 'incoming' && flight.actor === player
      const target = covering ? {
        x: home.x + (nearLanding.x - home.x) * profile.coverage,
        y: home.y + (nearLanding.y - home.y) * profile.coverage,
      } : waiting ? flight.to : home
      if (distance(player, target) < 3) {
        this.move(player, 0, 0, 0, dt)
        continue
      }
      const speed = moveSpeed(player, covering ? profile.trackingSpeed : profile.returnSpeed)
      const tracking = waiting && flight.elapsed < profile.reaction ? ball : target
      this.move(player, tracking.x - player.x, tracking.y - player.y, Math.min(speed, distance(player, tracking) / dt), dt)
    }
  }

  private expireBuffs(dt: number): void {
    for (const player of this.state.players) {
      if (!player.buff) continue
      player.buff.remaining -= dt
      if (player.buff.remaining <= 1e-9) delete player.buff
    }
  }

  private collectBuffs(): void {
    const { pickups, players } = this.state
    for (let index = pickups.length - 1; index >= 0; index--) {
      const pickup = pickups[index]!
      const collector = players.find(player => player.team === pickup.team && player.z <= 20 && distance(player, pickup) <= BUFF_PICKUP_RADIUS)
      if (!collector) continue
      collector.buff = { kind: pickup.kind, remaining: BUFF_DURATION_SECONDS }
      pickups.splice(index, 1)
      this.say(`Buff de ${BUFF_LABELS[pickup.kind].toLowerCase()}`, collector, BUFF_FEEDBACK[pickup.kind])
    }
  }

  private receive(player: Player, grade: Grade): void {
    this.contacts++
    this.pose(player, 'receive', .38)
    this.say(grade, player, grade === 'A+' ? 'green' : grade === 'B' ? 'yellow' : 'teal')
    const partner = this.partner(player)
    const distanceToNet = Math.max(94, Math.abs(partner.x) - 38)
    const elevation = grade === 'A+' ? 105 : grade === 'A' ? 113 : 121
    this.sendBall({ x: side(player.team) * distanceToNet, y: partner.y, z: elevation }, .83, 'set', player.team, partner, { grade }, 285)
  }

  private set(setter: Player, perfect: boolean): void {
    const attacker = this.partner(setter)
    this.pose(setter, 'set', .34)
    this.say(perfect ? 'Levantamento perfeito' : 'Levantamento', setter, perfect ? 'green' : 'neutral')
    this.sendBall({ x: attacker.x, y: attacker.y, z: perfect ? 140 : 128 }, .85, 'attack', setter.team, attacker, { perfect }, 275)
  }

  private hitAcross(player: Player, name: Hit, perfect: boolean): void {
    this.contacts++
    this.pose(player, name === 'Largada' ? 'set' : 'attack', .39)
    this.say(name, player, 'neutral')
    const shallow = name === 'Shot' || name === 'Largada'
    this.sendBall(this.attackTarget(player.team, name, this.contacts), shallow ? 1.25 : name === 'Ataque fraco' ? 1.40 : 1.07,
      'incoming', otherTeam(player.team), player, { perfect, attack: name }, shallow ? 245 : 215)
  }

  private attackTarget(team: Team, hit: Hit, contacts: number): Position {
    const shallow = hit === 'Shot' || hit === 'Largada'
    const x = shallow ? 157 : hit === 'Ataque fraco' ? 224 : 300 + (contacts % 3) * 28
    const y = shallow ? 345 - (this.rally % 3) * 65 : (this.rally + contacts) % 2 ? 326 : 234
    return { x: -side(team) * x, y, z: 0 }
  }

  private botAttack(player: Player): Hit {
    const difficulty = difficultyOf(player)
    const roll = botRoll(player.id, this.rally, this.contacts, 6)
    if (difficulty !== 'brutal') return chooseBotAttack(difficulty, roll)
    const defenders = this.state.players.filter(defender => defender.team !== player.team)
    const roomFor = (hit: Hit) => {
      const target = this.attackTarget(player.team, hit, this.contacts + 1)
      return Math.min(...defenders.map(defender => distance(defender, target)))
    }
    return chooseBotAttack(difficulty, roll, roomFor('Shot'), roomFor('Ataque forte'))
  }

  private partner(player: Player): Player {
    return this.state.players[player.id % 2 === 0 ? player.id + 1 : player.id - 1]!
  }

  private point(team: Team, reason?: string): void {
    this.state[team]++
    this.state.server = team
    this.state.phase = 'point'
    const message = team === 'red' ? 'Ponto da equipe vermelha' : 'Ponto da equipe azul'
    this.state.message = reason ? `${reason} · ${message.toLowerCase()}` : message
    this.phaseTime = 0
    this.flight = undefined
    this.state.pickups.length = 0
    delete this.state.timing
    if (this.state[team] >= 15 && this.state[team] - this.state[otherTeam(team)] >= 2) this.winner = team
    const scorer = this.state.players[team === 'red' ? 0 : 2]!
    this.say('+1', scorer, team)
  }

  private move(player: Player, dx: number, dy: number, speed: number, dt: number): void {
    const length = Math.hypot(dx, dy) || 1
    player.vx = dx / length * speed
    player.vy = dy / length * speed
    player.x = clamp(player.x + player.vx * dt, player.team === 'red' ? -432 : 22, player.team === 'red' ? -22 : 432)
    player.y = clamp(player.y + player.vy * dt, 21, 480)
    if (player.actionTime <= 0) player.action = dx || dy ? 'move' : 'idle'
  }

  private advancePoses(dt: number): void {
    for (const player of this.state.players) {
      player.actionTime = Math.max(0, player.actionTime - dt)
      player.jumpTime = Math.max(0, player.jumpTime - dt)
      player.z = jumpHeight(player.jumpTime, player.jumpPower)
      if (player.actionTime === 0) player.action = player.jumpTime ? 'jump' : 'idle'
    }
  }

  private pose(player: Player, action: Action, duration: number, jump = false): void {
    player.action = action
    player.actionTime = duration
    if (jump) {
      player.jumpTime = JUMP_SECONDS
      player.jumpPower = jumpPower(player)
    }
  }

  private say(text: string, position: Position, kind: Feedback['kind']): void {
    const { x, y, z } = position
    const event = { id: ++this.feedbackId, text, x, y, z, kind }
    this.state.feedback = event
    this.state.feedbackEvents.push(event)
    if (this.state.feedbackEvents.length > 16) this.state.feedbackEvents.shift()
  }
}
