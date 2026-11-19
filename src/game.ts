export const COURT = { halfWidth: 450, depth: 500, netHeight: 105 } as const

type Team = 'red' | 'blue'
type Serve = 1 | 2 | 3
type Action = 'idle' | 'move' | 'jump' | 'serve' | 'receive' | 'set' | 'attack' | 'block'
type Phase = 'menu' | 'countdown' | 'serve' | 'rally' | 'point' | 'finished'
type Grade = 'A+' | 'A' | 'B'

interface Position { x: number; y: number; z: number }

export interface Player extends Position {
  id: number
  team: Team
  name: string
  bot: boolean
  vx: number
  vy: number
  action: Action
  actionTime: number
  jumpTime: number
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
  kind: Team | 'green' | 'teal' | 'yellow' | 'neutral'
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
  timing?: { x: number; y: number; progress: number }
  feedback?: Feedback
}

interface Flight {
  from: Position
  to: Position
  duration: number
  elapsed: number
  gravity: number
  stage: 'incoming' | 'set' | 'attack'
  team: Team
  actor: Player
  serve?: Serve
  grade?: Grade
  perfect?: boolean
}

const HOMES = [{ x: -288, y: 326 }, { x: -144, y: 165 }, { x: 270, y: 325 }, { x: 140, y: 167 }]
const SERVE_NAMES = { 1: 'Normal', 2: 'Flutuante', 3: 'Viagem' } as const
const JUMP_SECONDS = .64
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const otherTeam = (team: Team): Team => team === 'red' ? 'blue' : 'red'
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

function positionOnFlight(flight: Flight, elapsed: number): Position {
  const t = clamp(elapsed, 0, flight.duration)
  const fraction = t / flight.duration
  return {
    x: flight.from.x + (flight.to.x - flight.from.x) * fraction,
    y: flight.from.y + (flight.to.y - flight.from.y) * fraction,
    z: flight.from.z + (flight.to.z - flight.from.z) * fraction + .5 * flight.gravity * t * (flight.duration - t),
  }
}

export class Volleyball {
  readonly state: GameState = {
    red: 0, blue: 0, phase: 'menu', message: '', player: 'Você', players: [],
    ball: { x: 0, y: 255, z: 155 }, serve: 1, server: 'red',
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
    state.players = ['Você', 'Léo', 'Nina', 'Caio'].map((name, id) => ({
      ...HOMES[id]!, z: 0, id, name, bot: id !== 0, team: id < 2 ? 'red' : 'blue',
      vx: 0, vy: 0, action: 'idle', actionTime: 0, jumpTime: 0,
    }))
    state.player = 'Você'
    delete state.countdown
    delete state.feedback
    delete state.timing
    this.flight = undefined
    this.winner = undefined
    this.phaseTime = 0
    this.contacts = 0
    this.rally = 0
    state.ball = { x: 50, y: 255, z: 158 }
  }

  start(name: string): void {
    this.reset()
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
      Object.assign(player, HOMES[player.id], { z: 0, vx: 0, vy: 0, action: 'idle', actionTime: 0, jumpTime: 0 })
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
    this.state.phase = 'serve'
    this.state.message = this.state.server === 'red' ? 'Espaço para sacar' : 'Saque da equipe azul'
    delete this.state.countdown
    this.placePlayers()
  }

  private updateServe(input: GameInput): void {
    const server = this.servingPlayer()
    const selected = !server.bot && input.serve !== undefined ? input.serve : this.state.serve
    this.state.serve = selected
    const kind = server.bot ? (this.rally % 3 === 0 ? 2 : 1) : selected
    const rhythm = (this.phaseTime % 1.1) / 1.1
    if (!server.bot && kind > 1) this.state.timing = { x: server.x, y: server.y, progress: rhythm }
    else delete this.state.timing
    if ((!server.bot && !input.space) || (server.bot && this.phaseTime < .94)) return

    this.pose(server, 'serve', .34)
    const miss = !server.bot && ((kind === 2 && (rhythm < .12 || rhythm > .94)) || (kind === 3 && (rhythm < .37 || rhythm > .81)))
    if (miss) {
      this.point(otherTeam(server.team), 'Erro de saque')
      return
    }

    this.say(SERVE_NAMES[kind], server, 'neutral')
    const target = server.team === 'red'
      ? { x: 277, y: this.rally % 2 ? 326 : 236, z: 0 }
      : { x: -305, y: this.rally % 2 ? 327 : 263, z: 0 }
    this.state.phase = 'rally'
    this.sendBall(target, kind === 1 ? 1.83 : kind === 2 ? 1.63 : 1.41, 'incoming', otherTeam(server.team), server, { serve: kind })
  }

  private sendBall(to: Position, duration: number, stage: Flight['stage'], team: Team, actor: Player, extra: Pick<Flight, 'grade' | 'serve' | 'perfect'> = {}): void {
    this.flight = { from: { ...this.state.ball }, to, duration, elapsed: 0, gravity: 420, stage, team, actor, ...extra }
    this.combo = undefined
    const human = this.state.players[0]!
    this.state.message = stage === 'incoming' && team === human.team ? 'Espaço para receber'
      : stage === 'set' && actor === human ? 'Espaço para levantar'
      : stage === 'attack' && actor === human ? 'W W ataque  ·  W S shot'
      : ''
  }

  private advanceRally(dt: number, input: GameInput): void {
    const flight = this.flight!
    const human = this.state.players[0]!
    const before = this.state.ball
    flight.elapsed += dt
    this.state.ball = positionOnFlight(flight, flight.elapsed)
    this.move(human, Number(!!input.right) - Number(!!input.left), Number(!!input.down) - Number(!!input.up), 320, dt)
    this.moveBots(flight, dt)

    const remaining = flight.duration - flight.elapsed
    const timingWindow = flight.serve === 3 ? .27 : flight.serve === 2 || flight.perfect ? .35 : .47
    const usesTiming = (flight.stage === 'incoming' && flight.team === 'red') || (flight.stage !== 'incoming' && flight.actor === human)
    if (usesTiming && remaining < .72) {
      this.state.timing = { ...flight.to, progress: clamp(1 - remaining / .72, 0, 1) }
    } else delete this.state.timing

    if (flight.stage === 'incoming') {
      const ball = this.state.ball
      if (Math.sign(before.x) !== Math.sign(ball.x) && ball.z < COURT.netHeight) {
        this.point(flight.team)
        return
      }

      if (input.space && flight.team === 'red') {
        const attacking = flight.serve === undefined && Math.abs(human.x) < 109 && Math.abs(ball.x) < 89 && distance(human, ball) < 99
        if (attacking) {
          this.pose(human, 'block', JUMP_SECONDS, true)
          this.say('Bloqueio', human, 'neutral')
          this.hitAcross(human, 'Shot', false, true)
          return
        }
        if (remaining > 0 && remaining <= .65 && distance(human, ball) <= 112) {
          if (remaining <= timingWindow) {
            const timing = Math.abs(remaining - .17)
            let grade: Grade = timing < .085 ? 'A+' : timing < .17 ? 'A' : 'B'
            if (flight.serve === 3 && grade === 'A+') grade = 'A'
            this.receive(human, grade)
            return
          }
          this.pose(human, 'receive', .24)
          this.say('Erro', human, 'red')
        }
        if (Math.abs(human.x) < 110) this.pose(human, 'block', JUMP_SECONDS, true)
      }

      if (remaining < .2 && remaining > 0) {
        const defenders = this.state.players.filter(player => player.team === flight.team && player.bot)
        const defender = defenders.find(player => distance(player, ball) < 77)
        const preferred = flight.team === 'blue' || distance(human, ball) > 92
        const miss = (this.rally * 3 + Math.floor(this.contacts / 2)) % (flight.team === 'blue' ? 7 : 5) === 0
        if (defender && preferred && !miss) {
          const grade = this.contacts % 3 ? 'A' : 'B'
          this.receive(defender, grade)
          return
        }
      }
      if (remaining <= 0) {
        const inside = Math.abs(flight.to.x) <= COURT.halfWidth && flight.to.y >= 0 && flight.to.y <= COURT.depth
        this.point(inside ? otherTeam(flight.team) : flight.team)
      }
      return
    }

    if (flight.stage === 'set') {
      const setter = flight.actor
      const manual = !setter.bot && remaining <= .38 && distance(setter, this.state.ball) < 120
      if (manual && input.s && flight.grade !== 'B') {
        this.pose(setter, 'set', JUMP_SECONDS, true)
        this.hitAcross(setter, 'Largada', flight.grade === 'A+', false)
      } else if ((manual && input.space) || remaining <= 0) {
        const attacker = this.partner(setter)
        const perfect = flight.grade === 'A+' || (manual && input.space && Math.abs(remaining - .16) < .10)
        this.pose(setter, 'set', JUMP_SECONDS, true)
        this.say(perfect ? 'Levantamento perfeito' : 'Levantamento', setter, perfect ? 'green' : 'neutral')
        this.sendBall({ x: attacker.x, y: attacker.y, z: 142 }, .85, 'attack', setter.team, attacker, { perfect })
      }
      return
    }

    const attacker = flight.actor
    if (remaining <= .5 && remaining > .43) this.pose(attacker, 'jump', JUMP_SECONDS, true)
    if (!attacker.bot && attacker.z > 0) {
      if (this.combo === 'W' && input.s) this.combo = 'WS'
      else if (this.combo === 'W' && input.w) this.combo = 'WW'
      else if (!this.combo && input.w) this.combo = 'W'
    }
    if (remaining > 0) return
    if (distance(attacker, this.state.ball) > 133) {
      this.point(otherTeam(attacker.team))
      return
    }
    const shot = this.combo === 'WS' || (attacker.bot && (this.rally + this.contacts) % 4 === 2)
    const strong = this.combo === 'WW' || (attacker.bot && !shot)
    const text = shot ? 'Shot' : strong ? 'Ataque forte' : 'Ataque fraco'
    this.hitAcross(attacker, text, !!flight.perfect, false)
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
      const covering = flight.stage === 'incoming' && player.team === flight.team && (player === nearest || nearest === human)
      const waiting = flight.stage !== 'incoming' && flight.actor === player
      const target = covering ? nearLanding : waiting ? flight.to : home
      if (distance(player, target) < 3) {
        this.move(player, 0, 0, 0, dt)
        continue
      }
      const speed = covering ? 266 : 165
      const tracking = waiting && flight.elapsed < .18 ? ball : target
      this.move(player, tracking.x - player.x, tracking.y - player.y, Math.min(speed, distance(player, tracking) / dt), dt)
    }
  }

  private receive(player: Player, grade: Grade): void {
    this.contacts++
    this.pose(player, 'receive', .38)
    this.say(grade, player, grade === 'A+' ? 'green' : grade === 'B' ? 'yellow' : 'teal')
    const partner = this.partner(player)
    this.sendBall({ x: partner.x, y: partner.y, z: 118 }, .72, 'set', player.team, partner, { grade })
  }

  private hitAcross(player: Player, name: string, perfect: boolean, blocked: boolean): void {
    this.contacts++
    if (!blocked) {
      this.pose(player, 'attack', .43, player.z === 0)
      this.say(name, player, 'neutral')
    }
    const sign = player.team === 'red' ? 1 : -1
    const shallow = name === 'Shot' || name === 'Largada'
    const weak = name === 'Ataque fraco'
    const x = shallow ? 157 : weak ? 224 : 300 + (this.contacts % 3) * 28
    const y = shallow ? 345 - (this.rally % 3) * 65 : (this.rally + this.contacts) % 2 ? 326 : 234
    this.sendBall({ x: sign * x, y, z: 0 }, shallow ? 1.38 : weak ? 1.48 : 1.16, 'incoming', otherTeam(player.team), player, { perfect })
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
      player.z = Math.sin(Math.PI * player.jumpTime / JUMP_SECONDS) * 78
      if (player.actionTime === 0) player.action = player.jumpTime ? 'jump' : 'idle'
    }
  }

  private pose(player: Player, action: Action, duration: number, jump = false): void {
    player.action = action
    player.actionTime = duration
    if (jump) player.jumpTime = JUMP_SECONDS
  }

  private say(text: string, position: Position, kind: Feedback['kind']): void {
    const { x, y, z } = position
    this.state.feedback = { id: ++this.feedbackId, text, x, y, z, kind }
  }
}
