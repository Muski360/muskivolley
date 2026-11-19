import {
    BALL_RADIUS, COURT, GRAVITY, STEP, WALK_SPEED, createAthlete, createCourtPhysics, moveAthlete,
    type GroundPoint, type Movement,
} from './simulation';
import { DEFAULT_BOT_DIFFICULTY, type BotDifficulty } from '../bots';
import {
    BUFF_DURATION_SECONDS, BUFF_JUMP_MULTIPLIER, BUFF_LABELS, BUFF_SPEED_MULTIPLIER,
    type ActiveBuff, type BuffKind,
} from '../buffs';
import { planBots } from './team-ai';

export type Side = 'player' | 'opponent';
export type Serve = 1 | 2 | 3;
export type PracticeScenario = 'receive' | 'set' | 'attack' | 'block' | 'serve';
export type MatchFormat = 1 | 2 | 3;
export type MatchOptions = {
    teamSize: MatchFormat;
    homeBots: readonly BotDifficulty[];
    awayBots: readonly BotDifficulty[];
    buffs: boolean;
};
export type Action = 'idle' | 'move' | 'jump' | 'receive' | 'set' | 'attack' | 'block' | 'dive' | 'serve';
export type RallyInput = Movement & {
    block?: boolean;
    leftHeld?: boolean;
    leftPress?: boolean;
    rightPress?: boolean;
    setPress?: boolean;
    aim?: GroundPoint;
    serve?: Serve;
};

type Vector = GroundPoint & { y: number };
type Phase = 'ready' | 'countdown' | 'serve' | 'rally' | 'point' | 'finished';
type Swing = 'strong' | 'soft' | 'spike';
export type Athlete = ReturnType<typeof createAthlete> & {
    id: string;
    difficulty?: BotDifficulty;
    buff?: ActiveBuff;
    action: Action;
    actionUntil: number;
    swing?: { kind: Swing; at: number };
    setAt: number;
    drop: boolean;
    dive: GroundPoint;
    diveUntil: number;
};
export type Pickup = GroundPoint & { id: string; kind: BuffKind; side: Side };
export type RallyState = {
    mode: 'match' | 'practice';
    phase: Phase;
    teamSize: MatchFormat;
    countdown: number;
    server: Side;
    serverId: string;
    score: Record<Side, number>;
    touches: number;
    possession: Side;
    serve: Serve;
    serveTiming: number | null;
    serveReady: boolean;
    message: string;
    feedback: string;
    feedbackId: number;
    pickups: Pickup[];
};

export const SERVES = {
    1: { label: 'Normal', window: [.43, .81], speed: 11.5, minTravel: 1.24 },
    2: { label: 'Flutuante', window: [.49, .72], speed: 12.6, minTravel: 1.16 },
    3: { label: 'Viagem', window: [.53, .68], speed: 17, minTravel: .96 },
} as const;
const PRACTICE_MESSAGE = {
    receive: 'Segure o esquerdo para receber. Use o direito para mergulhar.',
    set: 'Mire e pressione E para levantar. Dois E fazem uma largada.',
    attack: 'Salte para acertar a bola no alto. Use os dois cliques para cravar.',
    block: 'Salte e segure Espaço perto da rede para bloquear.',
    serve: 'Escolha o saque. Clique para lançar a bola.',
} satisfies Record<PracticeScenario, string>;
const SIDE = { player: 1, opponent: -1 } as const;
const SIDES = ['player', 'opponent'] as const;
const IDLE = { x: 0, z: 0, jump: false };
const SERVE_HAND_OFFSET = .51;
const DEFAULT_OPTIONS: MatchOptions = { teamSize: 1, homeBots: [], awayBots: ['medium'], buffs: false };
const PICKUP_LAYOUT = [
    { kind: 'pass', x: -2.35, z: 4.25 },
    { kind: 'speed', x: 2.35, z: 6.2 },
    { kind: 'jump', x: 0, z: 4.6 },
] as const;
const opposite = (side: Side): Side => side === 'player' ? 'opponent' : 'player';
const sideAt = (z: number): Side => z >= 0 ? 'player' : 'opponent';
const floorTime = (position: Vector, velocity: Vector, height = BALL_RADIUS) => (velocity.y
    + Math.sqrt(Math.max(0, velocity.y ** 2 + 2 * GRAVITY * (position.y - height)))) / GRAVITY;
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const normalize = (x: number, z: number) => {
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
};

function makeAthlete(side: Side, slot: number, difficulty?: BotDifficulty): Athlete {
    return { ...createAthlete(SIDE[side]), id: `${side}-${slot}`, difficulty, buff: undefined,
        action: 'idle', actionUntil: 0, swing: undefined, setAt: -Infinity, drop: false, dive: { x: 0, z: 0 }, diveUntil: 0 };
}

const FORMATION = {
    1: [{ x: 0, z: COURT.halfLength * .7125 }],
    2: [{ x: -1.45, z: 6.6 }, { x: 1.7, z: 2.5 }],
    3: [{ x: 0, z: 6.7 }, { x: -2.85, z: 3.4 }, { x: 2.85, z: 3.4 }],
} satisfies Record<MatchFormat, readonly GroundPoint[]>;

function overNet(from: Vector, to: Vector, time: number) {
    const cross = -from.z / (to.z - from.z);
    if (!(cross > 0 && cross < 1)) return time;
    const height = from.y + (to.y - from.y) * cross;
    const required = Math.sqrt(Math.max(0, (COURT.netHeight + BALL_RADIUS + .13 - height)
        * 2 / (GRAVITY * cross * (1 - cross))));
    return Math.max(time, Math.min(required, 1.9));
}

export async function createRally() {
    const physics = await createCourtPhysics(0);
    const { ball } = physics;
    const player = makeAthlete('player', 0);
    const opponent = makeAthlete('opponent', 0, DEFAULT_BOT_DIFFICULTY);
    const teams = { player: [player], opponent: [opponent] };
    const servingSlot = { player: 0, opponent: -1 };
    let lastOptions = DEFAULT_OPTIONS;
    const state: RallyState = {
        mode: 'match', phase: 'ready', teamSize: 1, countdown: 0, server: 'player', serverId: player.id,
        score: { player: 0, opponent: 0 }, touches: 0, possession: 'player',
        serve: 1, serveTiming: null, serveReady: false, message: '', feedback: '', feedbackId: 0,
        pickups: [],
    };
    let elapsed = 0;
    let phaseStart = 0;
    let tossStart: number | null = null;
    let lastTouch: Side = 'player';
    let lastTouchId: string | undefined;
    let lastContactWasBlock = false;
    let lastContact = -Infinity;
    let exercise: PracticeScenario = 'receive';
    let flavor: 'normal' | 'float' | 'travel' | 'spike' = 'normal';
    let goodSet = false;
    let terminalBlock: Side | undefined;
    let floatAge = 0;
    let floatOffset = 0;
    let pointNumber = 0;

    function phase(next: Phase, message: string) {
        state.phase = next;
        phaseStart = elapsed;
        state.message = message;
    }

    function feedback(text: string) {
        state.feedback = text;
        state.feedbackId++;
    }

    function animate(athlete: Athlete, action: Action, duration = .29) {
        athlete.action = action;
        athlete.actionUntil = elapsed + duration;
    }

    function place(position: Vector, velocity: Vector = { x: 0, y: 0, z: 0 }) {
        ball.setTranslation(position, true);
        ball.setLinvel(velocity, true);
        ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    function fly(from: Vector, to: Vector, duration: number, spin = 1) {
        const vx = (to.x - from.x) / duration;
        const vz = (to.z - from.z) / duration;
        const vy = (to.y - from.y) / duration + GRAVITY * duration / 2;
        place(from, { x: vx, y: vy, z: vz });
        ball.setAngvel({ x: vz * spin, y: 1, z: -vx * spin }, true);
    }

    function resetTurn(clearBuffs = false) {
        for (const side of SIDES) {
            for (const [slot, athlete] of teams[side].entries()) {
                const buff = clearBuffs ? undefined : athlete.buff;
                Object.assign(athlete, makeAthlete(side, slot, athlete.difficulty));
                const home = FORMATION[state.teamSize][slot];
                athlete.x = home.x;
                athlete.z = home.z * SIDE[side];
                athlete.buff = buff;
            }
        }
        state.touches = 0;
        state.possession = state.server;
        state.pickups = [];
        state.serveTiming = null;
        state.serveReady = false;
        tossStart = null;
        flavor = 'normal';
        terminalBlock = undefined;
        goodSet = false;
        lastTouch = state.server;
        lastTouchId = undefined;
        lastContactWasBlock = false;
        lastContact = -Infinity;
        floatAge = floatOffset = 0;
    }

    function start(mode: RallyState['mode'], preset: PracticeScenario = 'receive', options = DEFAULT_OPTIONS) {
        state.mode = mode;
        exercise = preset;
        if (mode === 'match') {
            const { teamSize, homeBots, awayBots, buffs } = options;
            lastOptions = { teamSize, homeBots: [...homeBots], awayBots: [...awayBots], buffs };
        }
        const config = mode === 'match' ? lastOptions : DEFAULT_OPTIONS;
        state.teamSize = config.teamSize;
        teams.player.length = teams.opponent.length = 1;
        opponent.difficulty = config.awayBots[0] ?? DEFAULT_BOT_DIFFICULTY;
        for (let i = 1; i < state.teamSize; i++) {
            teams.player.push(makeAthlete('player', i, config.homeBots[i - 1] ?? DEFAULT_BOT_DIFFICULTY));
            teams.opponent.push(makeAthlete('opponent', i, config.awayBots[i] ?? DEFAULT_BOT_DIFFICULTY));
        }
        servingSlot.player = 0;
        servingSlot.opponent = -1;
        state.server = 'player';
        state.serverId = player.id;
        state.score.player = state.score.opponent = pointNumber = 0;
        feedback('');
        countdown();
    }

    function countdown() {
        resetTurn(true);
        if (state.mode === 'practice') {
            if (exercise === 'receive') player.z = COURT.halfLength * .565;
            if (exercise === 'attack') player.z = 1.32;
            if (exercise === 'set') player.z = 1.68;
            if (exercise === 'block') player.z = 1.02;
        }
        place({ x: player.x - .56, y: BALL_RADIUS, z: player.z - .48 });
        state.countdown = state.mode === 'match' ? 3 : 2;
        phase('countdown', 'Prepare-se');
    }

    function serveTurn() {
        resetTurn();
        const server = teams[state.server][servingSlot[state.server]];
        const sign = SIDE[state.server];
        server.z = sign * (COURT.halfLength + .65);
        place({ x: server.x + sign * SERVE_HAND_OFFSET, y: 1.36, z: server.z - sign * .36 });
        phase('serve', server === player ? 'Clique para lançar a bola' : state.server === 'player' ? 'Seu parceiro vai sacar' : 'O adversário vai sacar');
        if (state.mode === 'match' && lastOptions.buffs) {
            const layout = PICKUP_LAYOUT[pointNumber % PICKUP_LAYOUT.length];
            state.pickups = SIDES.map(side => ({ ...layout, z: SIDE[side] * layout.z, side, id: `${pointNumber}-${side}` }));
        }
    }

    function beginPractice() {
        if (exercise === 'serve') { serveTurn(); return; }
        phase('rally', PRACTICE_MESSAGE[exercise]);
        if (exercise === 'receive' || exercise === 'block') {
            lastTouch = 'opponent';
            state.possession = 'opponent';
            if (exercise === 'receive') {
                fly({ x: .18, y: 2.9, z: -COURT.halfLength * .7125 },
                    { x: .27, y: BALL_RADIUS, z: COURT.halfLength * .62 }, 1.54);
            } else {
                flavor = 'spike';
                fly({ x: 0, y: 3.29, z: -4.4 }, { x: 0, y: BALL_RADIUS, z: 4.05 }, .96);
            }
        } else {
            state.touches = exercise === 'set' ? 1 : 2;
            goodSet = exercise === 'attack';
            place({ x: 0, y: exercise === 'set' ? 3.02 : 3.92, z: player.z - .16 }, { x: 0, y: -.38, z: 0 });
        }
    }

    function award(winner: Side, text: string) {
        state.score[winner]++;
        pointNumber++;
        if (state.server !== winner) {
            servingSlot[winner] = (servingSlot[winner] + 1) % state.teamSize;
            state.server = winner;
            state.serverId = teams[winner][servingSlot[winner]].id;
        }
        feedback(text);
        const winsMatch = state.mode === 'match' && state.score[winner] >= 15
            && state.score[winner] - state.score[opposite(winner)] >= 2;
        phase(winsMatch ? 'finished' : 'point', winsMatch
            ? (winner === 'player' ? 'Você venceu' : 'O bot venceu')
            : state.mode === 'practice' ? 'Repita para praticar o lance' : winner === 'player' ? 'Ponto seu' : 'Ponto do bot');
    }

    function aim(input: RallyInput, side: Side, ownSide = false): GroundPoint {
        const point = input.aim;
        if (point && Number.isFinite(point.x) && Number.isFinite(point.z)) return point;
        return { x: 0, z: SIDE[side] * (ownSide ? 1.55 : -COURT.halfLength * .7125) };
    }

    function serveStep(input: RallyInput) {
        const side = state.server;
        const athlete = teams[side][servingSlot[side]];
        const serving = athlete === player ? state.serve : input.serve ?? (1 + pointNumber % 3) as Serve;
        const config = SERVES[serving];
        athlete.z = SIDE[side] * Math.max(Math.abs(athlete.z), COURT.halfLength + .4);
        if (tossStart === null) {
            const position = {
                x: athlete.x + SIDE[side] * SERVE_HAND_OFFSET,
                y: athlete.y + 1.36,
                z: athlete.z - SIDE[side] * .36,
            };
            place(position);
            if (!input.leftPress) return;
            tossStart = elapsed;
            state.serveTiming = 0;
            place(position, { x: 0, y: 5.4, z: 0 });
            if (athlete === player) state.message = 'Clique de novo quando a barra marcar o timing';
            return;
        }
        const timing = Math.min(1, elapsed - tossStart);
        const [min, max] = config.window;
        state.serveTiming = timing;
        state.serveReady = timing >= min && timing <= max;
        if (!input.leftPress && timing < 1) {
            physics.step();
            return;
        }
        state.serveTiming = null;
        const valid = state.serveReady;
        state.serveReady = false;
        if (!valid) { award(opposite(side), 'Erro de saque'); return; }
        const from = ball.translation();
        const target = { ...aim(input, side), y: BALL_RADIUS };
        const travel = Math.max(config.minTravel, distance(from, target) / config.speed);
        fly(from, target, overNet(from, target, travel), serving === 2 ? 0 : .6);
        flavor = serving === 2 ? 'float' : serving === 3 ? 'travel' : 'normal';
        floatAge = floatOffset = 0;
        state.possession = side;
        lastTouch = side;
        lastTouchId = athlete.id;
        lastContactWasBlock = false;
        lastContact = elapsed;
        animate(athlete, 'serve');
        feedback(config.label);
        phase('rally', 'Bola em jogo');
    }

    function move(side: Side, athlete: Athlete, input: RallyInput) {
        if (state.phase === 'rally' && input.rightPress && !input.jump && athlete.y === 0 && elapsed >= athlete.diveUntil) {
            const target = input.aim ?? athlete;
            athlete.dive = distance(target, athlete) > .13
                ? normalize(target.x - athlete.x, target.z - athlete.z)
                : { x: -Math.sin(athlete.heading), z: -Math.cos(athlete.heading) };
            athlete.diveUntil = elapsed + .35;
            animate(athlete, 'dive', .43);
            if (athlete === player) feedback('Peixinho');
        }
        const speed = athlete.buff?.kind === 'speed' ? BUFF_SPEED_MULTIPLIER : 1;
        const jump = athlete.buff?.kind === 'jump' ? Math.sqrt(BUFF_JUMP_MULTIPLIER) : 1;
        if (elapsed < athlete.diveUntil) moveAthlete(athlete, SIDE[side], { ...athlete.dive, jump: false }, 8.1 * speed);
        else moveAthlete(athlete, SIDE[side], input, WALK_SPEED * speed, jump);
        if (elapsed < athlete.actionUntil) return;
        athlete.action = athlete.y > 0
            ? input.block && Math.abs(athlete.z) < 1.8 ? 'block' : 'jump'
            : input.x || input.z ? 'move' : 'idle';
    }

    function arm(athlete: Athlete, input: RallyInput) {
        if (input.setPress) {
            athlete.drop = elapsed - athlete.setAt <= .18;
            athlete.setAt = elapsed;
        }
        if (athlete.y <= 0 || !(input.leftPress || input.rightPress)) return;
        const kind = input.leftPress ? 'strong' : 'soft';
        const previous = athlete.swing;
        const chord = (input.leftPress && input.rightPress)
            || (previous && previous.kind !== kind && previous.kind !== 'spike' && elapsed - previous.at <= .07);
        athlete.swing = { at: elapsed, kind: chord ? 'spike' : kind };
    }

    function legalTouch(side: Side, athlete: Athlete, block = false) {
        if (state.possession !== side) {
            state.possession = side;
            state.touches = 0;
        }
        if (state.touches === 3) {
            award(opposite(side), 'Quatro toques');
            return false;
        }
        if (state.teamSize > 1 && state.touches > 0 && lastTouchId === athlete.id && !lastContactWasBlock) {
            award(opposite(side), 'Dois toques seguidos');
            return false;
        }
        state.touches++;
        lastTouch = side;
        lastTouchId = athlete.id;
        lastContactWasBlock = block;
        lastContact = elapsed;
        return true;
    }

    function contact(side: Side, athlete: Athlete, input: RallyInput) {
        if (terminalBlock || elapsed - lastContact < .18 || state.phase !== 'rally') return;
        const from = ball.translation();
        const relative = from.y - athlete.y;
        const reach = distance(athlete, from);
        if (input.block && lastTouch !== side && Math.abs(athlete.z) < 1.75
            && athlete.y > .28 && from.y > COURT.netHeight && from.y < athlete.y + 2.18
            && reach < 1.3 && Math.abs(from.z) < .78) {
            if (!legalTouch(side, athlete, true)) return;
            if (flavor === 'spike') terminalBlock = side;
            const softBlock = !terminalBlock && reach > .96;
            const rebound = SIDE[side] * (softBlock ? 1 : -1);
            const target = { x: from.x * .65, z: rebound * (terminalBlock ? 1.6 : softBlock ? 2.2 : 3.65), y: BALL_RADIUS };
            const start = { ...from, z: rebound * .29 };
            fly(start, target, terminalBlock ? .23 : softBlock ? 1.16 : .65);
            flavor = 'normal';
            goodSet = false;
            animate(athlete, 'block');
            feedback(terminalBlock ? 'Cravada bloqueada' : softBlock ? 'Bloqueio amortecido' : 'Bloqueio');
            return;
        }
        if (sideAt(from.z) !== side) return;
        const swing = athlete.swing;
        const swingAge = swing ? elapsed - swing.at : Infinity;
        const height = relative > 1.34 && relative < 2.15 && athlete.y > .17;
        if (swing && height && reach < 1.12 && swingAge <= .25
            && (swing.kind === 'spike' || swingAge >= .07)) {
            if (!legalTouch(side, athlete)) return;
            athlete.swing = undefined;
            const to = { ...aim(input, side), y: BALL_RADIUS };
            const spike = swing.kind === 'spike';
            const excellent = goodSet && Math.abs(from.z) < 2.05 && from.y >= 2.73 && swingAge <= .14;
            if (spike && !excellent) {
                fly(from, { x: Math.max(-COURT.halfWidth, Math.min(COURT.halfWidth, from.x + (to.x - from.x) * .16)),
                    y: COURT.netHeight - .47, z: 0 }, .34);
                flavor = 'normal';
                feedback('Cravada na rede');
            } else {
                const duration = Math.max(spike ? .30 : swing.kind === 'strong' ? .57 : .87,
                    distance(from, to) / (spike ? 20 : swing.kind === 'strong' ? 13.8 : 9.2));
                fly(from, to, spike ? duration : overNet(from, to, duration));
                flavor = spike ? 'spike' : 'normal';
                feedback(spike ? 'Cravada' : swing.kind === 'strong' ? 'Ataque forte' : 'Ataque colocado');
            }
            goodSet = false;
            animate(athlete, 'attack');
            return;
        }
        const setAge = elapsed - athlete.setAt;
        const hasSet = ((setAge >= .18 || athlete.drop) && setAge < .46)
            && reach < 1.08 && relative > 1.3 && relative < 2.42;
        if (hasSet) {
            if (!legalTouch(side, athlete)) return;
            const to = { ...aim(input, side, !athlete.drop), y: BALL_RADIUS };
            goodSet = !athlete.drop && sideAt(to.z) === side && Math.abs(to.z) <= 2.15 && relative > 1.56;
            const duration = athlete.drop ? Math.max(.22, Math.min(.46, distance(from, to) / 12)) : 1.87;
            fly(from, to, athlete.drop ? duration : overNet(from, to, duration));
            feedback(athlete.drop ? 'Largada' : goodSet ? 'Levantamento preciso' : 'Levantamento');
            animate(athlete, 'set');
            athlete.setAt = -Infinity;
            athlete.drop = false;
            flavor = 'normal';
            return;
        }
        const dive = elapsed < athlete.diveUntil;
        if ((dive || (input.leftHeld && athlete.y < .12)) && ball.linvel().y <= 0
            && reach < (dive ? 1.38 : 1.02) && relative >= .23 && relative < (dive ? 1.08 : 1.67)) {
            if (!legalTouch(side, athlete)) return;
            const precise = athlete.buff?.kind === 'pass' || (!dive && reach < .56 && relative > .76);
            const grade = precise ? (flavor === 'travel' ? 'A' : 'A+') : !dive && reach < .89 ? 'A' : 'B';
            const to = { ...aim(input, side, true), y: BALL_RADIUS };
            const duration = grade === 'B' ? 1.59 : 1.86;
            fly(from, to, overNet(from, to, duration), .42);
            flavor = 'normal';
            goodSet = false;
            feedback((dive ? 'Peixinho · ' : 'Manchete · ') + grade);
            animate(athlete, dive ? 'dive' : 'receive');
        }
    }

    function updateBuffs() {
        for (const side of SIDES) {
            for (const athlete of teams[side]) {
                if (athlete.buff) {
                    athlete.buff.remaining -= STEP;
                    if (athlete.buff.remaining <= .00001) athlete.buff = undefined;
                }
            }
        }
        for (const pickup of state.pickups) {
            const collectors = teams[pickup.side].filter(athlete => athlete.y < .5 && distance(athlete, pickup) <= .72);
            if (!collectors.length) continue;
            const collector = collectors.reduce((nearest, athlete) => distance(athlete, pickup) < distance(nearest, pickup)
                ? athlete : nearest);
            collector.buff = { kind: pickup.kind, remaining: BUFF_DURATION_SECONDS };
            state.pickups = state.pickups.filter(item => item !== pickup);
            if (collector === player) feedback('Bônus · ' + BUFF_LABELS[pickup.kind]);
        }
    }

    function step(input: RallyInput) {
        elapsed += STEP;
        const sincePhase = elapsed - phaseStart;
        if (state.phase === 'ready') { move('player', player, input); return; }
        if (state.phase === 'finished') return;
        if (state.phase === 'countdown') {
            state.countdown = Math.max(0, Math.ceil((state.mode === 'match' ? 3 : 2) - sincePhase));
            if (state.countdown > 0) return;
            if (state.mode === 'practice') beginPractice();
            else serveTurn();
            return;
        }
        if (state.phase === 'point') {
            if (sincePhase < 1.08) { physics.step(); return; }
            if (state.mode === 'match') serveTurn();
            return;
        }
        const humanServing = state.serverId === player.id;
        if (state.phase === 'serve' && humanServing && tossStart === null && input.serve) state.serve = input.serve;
        const bots = planBots({
            teams, phase: state.phase, mode: state.mode, server: state.server, serverId: state.serverId,
            possession: state.possession, touches: state.touches, pointNumber, elapsed, phaseStart, tossStart,
            lastContact, lastTouchId, lastContactWasBlock, terminalBlock, goodSet, ball: ball.translation(), velocity: ball.linvel(),
        });
        const inputFor = (athlete: Athlete) => athlete === player ? input : bots.get(athlete.id) ?? IDLE;
        for (const side of SIDES) {
            for (const athlete of teams[side]) move(side, athlete, inputFor(athlete));
        }
        if (state.phase === 'serve') { serveStep(humanServing ? input : bots.get(state.serverId) ?? IDLE); return; }
        updateBuffs();

        const from = ball.translation();
        if (Math.abs(from.z) > BALL_RADIUS + COURT.netDepth / 2 && sideAt(from.z) !== state.possession) {
            state.possession = sideAt(from.z);
            state.touches = 0;
        }
        for (const side of SIDES) {
            for (const athlete of teams[side]) {
                const intent = inputFor(athlete);
                arm(athlete, intent);
                contact(side, athlete, intent);
            }
        }
        if (state.phase !== 'rally') return;
        if (flavor === 'float' && sideAt(from.z) !== lastTouch) {
            floatAge += STEP;
            const offset = 2.05 * Math.sin(floatAge * 13.4);
            const velocity = ball.linvel();
            ball.setLinvel({ ...velocity, x: velocity.x + offset - floatOffset }, true);
            floatOffset = offset;
        }
        const landed = physics.step();
        const after = ball.translation();
        if (from.z * after.z < 0) {
            const atNet = -from.z / (after.z - from.z);
            const crossingHeight = from.y + (after.y - from.y) * atNet;
            if (crossingHeight < COURT.netHeight - .96) {
                award(opposite(lastTouch), 'Bola por baixo da rede');
                return;
            }
        }
        if (!landed && after.y > BALL_RADIUS - .022) return;
        const inCourt = Math.abs(after.x) <= COURT.halfWidth + .055 && Math.abs(after.z) <= COURT.halfLength + .055;
        const winner = terminalBlock ?? (inCourt ? opposite(sideAt(after.z)) : opposite(lastTouch));
        award(winner, terminalBlock ? 'Bloqueio sem cobertura' : inCourt ? 'Bola no chão' : 'Bola fora');
    }

    function landingPoint() {
        if (state.phase !== 'rally') return undefined;
        const position = ball.translation();
        const velocity = ball.linvel();
        const time = floorTime(position, velocity);
        return { x: position.x + velocity.x * time, z: position.z + velocity.z * time };
    }

    place({ x: -.62, y: BALL_RADIUS, z: player.z - .5 });
    return {
        state, player, opponent, teams, start, step, landingPoint,
        replay: () => start('match', undefined, lastOptions),
        serveWindow: () => SERVES[state.serve].window,
        ballPosition: () => ball.translation(),
        ballRotation: () => ball.rotation(),
        dispose: physics.dispose,
    };
}
