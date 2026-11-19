import { BOT_DIFFICULTIES, botRoll, chooseBotAttack, chooseBotServe, type BotDifficulty } from '../bots';
import { COURT, GRAVITY, type GroundPoint } from './simulation';
import type { Action, RallyInput, Side } from './rally';

type Vector = GroundPoint & { y: number };

type BotAthlete = Vector & {
    id: string;
    difficulty?: BotDifficulty;
    action: Action;
    setAt: number;
    swing?: { at: number };
};

type BotContext = {
    teams: Record<Side, readonly BotAthlete[]>;
    phase: 'ready' | 'countdown' | 'serve' | 'rally' | 'point' | 'finished';
    mode: 'practice' | 'match';
    server: Side;
    serverId: string;
    possession: Side;
    touches: number;
    pointNumber: number;
    elapsed: number;
    phaseStart: number;
    tossStart: number | null;
    lastContact: number;
    lastTouchId?: string;
    lastContactWasBlock: boolean;
    terminalBlock?: Side;
    goodSet: boolean;
    ball: Vector;
    velocity: Vector;
};

const IDLE: RallyInput = { x: 0, z: 0, jump: false };
const opposite = (side: Side): Side => side === 'player' ? 'opponent' : 'player';
const direction = (side: Side) => side === 'player' ? 1 : -1;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function moveTo(athlete: BotAthlete, point: GroundPoint, stop = .18): RallyInput {
    const dx = point.x - athlete.x;
    const dz = point.z - athlete.z;
    const length = Math.hypot(dx, dz);
    return length < stop ? IDLE : { x: dx / length, z: dz / length, jump: false };
}

function closest(athletes: readonly BotAthlete[], target: GroundPoint, eligible: (athlete: BotAthlete) => boolean) {
    let best: BotAthlete | undefined;
    let min = Infinity;
    for (const athlete of athletes) {
        if (!eligible(athlete)) continue;
        const d = distance(athlete, target);
        if (d < min) {
            min = d;
            best = athlete;
        }
    }
    return best;
}

function cover(side: Side, index: number, size: number, ball: GroundPoint): GroundPoint {
    const sign = direction(side);
    const { halfWidth, halfLength } = COURT;
    if (size === 1) return { x: clamp(ball.x, -1.5, 1.5), z: sign * 1.62 };
    const lanes = size === 2 ? [-.36, .36] : [-.52, 0, .52];
    return {
        x: lanes[index] * halfWidth + clamp(ball.x, -halfWidth, halfWidth) * .18,
        z: sign * halfLength * (index === 0 ? .65 : size === 3 && index === 1 ? .57 : .23),
    };
}

function opening(team: readonly BotAthlete[], side: Side) {
    const { halfWidth, halfLength } = COURT;
    const sign = direction(side);
    let best = { x: 0, z: sign * halfLength * .66 };
    let clearer = -Infinity;
    for (const x of [-.67, 0, .67]) {
        for (const z of [.44, .66, .84]) {
            const aim = { x: x * halfWidth, z: z * halfLength * sign };
            const room = Math.min(...team.map(athlete => distance(athlete, aim)));
            if (room <= clearer) continue;
            clearer = room;
            best = aim;
        }
    }
    return best;
}

export function planBots(ctx: BotContext): Map<string, RallyInput> {
    const plan = new Map<string, RallyInput>();
    if (ctx.mode === 'practice' || ctx.terminalBlock || (ctx.phase !== 'serve' && ctx.phase !== 'rally')) return plan;
    if (ctx.phase === 'serve') {
        const index = ctx.teams[ctx.server].findIndex(athlete => athlete.id === ctx.serverId);
        const athlete = ctx.teams[ctx.server][index];
        if (!athlete?.difficulty) return plan;
        const profile = BOT_DIFFICULTIES[athlete.difficulty];
        const serve = chooseBotServe(athlete.difficulty, ctx.pointNumber);
        const error = (botRoll(index, ctx.pointNumber, 0, 2) * 2 - 1) * profile.receiveJitter * .55;
        const side = opposite(ctx.server);
        const leftPress = ctx.tossStart === null
            ? ctx.elapsed - ctx.phaseStart >= .55 + profile.reaction
            : ctx.elapsed - ctx.tossStart >= .60 + error;
        const aim = athlete.difficulty === 'hard' || athlete.difficulty === 'brutal'
            ? opening(ctx.teams[side], side)
            : { x: [-.48, 0, .48][ctx.pointNumber % 3] * COURT.halfWidth, z: direction(side) * COURT.halfLength * .72 };
        plan.set(athlete.id, { ...IDLE, leftPress, serve, aim });
        return plan;
    }

    const { ball, velocity } = ctx;
    const timeSinceContact = ctx.elapsed - ctx.lastContact;
    for (const side of ['player', 'opponent'] as const) {
        const sign = direction(side);
        const team = ctx.teams[side];
        if (!team.some(athlete => athlete.difficulty)) continue;
        const rivals = ctx.teams[opposite(side)];
        const inOwnSide = sign * ball.z > .24;
        const incoming = sign * velocity.z > .7 && sign * ball.z < 0;
        const touches = ctx.possession === side ? ctx.touches : 0;
        const height = touches >= 2 ? 2.72 : touches === 1 ? 1.94 : 1.25;
        const travel = Math.max(0, (velocity.y + Math.sqrt(Math.max(0,
            velocity.y ** 2 + 2 * GRAVITY * (ball.y - height)))) / GRAVITY);
        const target = {
            x: clamp(ball.x + velocity.x * travel, -COURT.playerLimit.x, COURT.playerLimit.x),
            z: sign * clamp(sign * (ball.z + velocity.z * travel), .6, COURT.playerLimit.far),
        };
        const canTouch = (athlete: BotAthlete) => team.length === 1 || athlete.id !== ctx.lastTouchId || ctx.lastContactWasBlock;
        const active = inOwnSide || incoming ? closest(team, target, canTouch) : undefined;
        const support = active && closest(team, { ...target, z: sign * (touches === 0 ? 2.55 : 1.18) },
            athlete => athlete !== active);
        const nextPoint = {
            x: support ? clamp(support.x, -COURT.halfWidth + .55, COURT.halfWidth - .55) : target.x * (touches ? .84 : .7),
            z: sign * (touches === 0 ? 2.55 : 1.18),
        };

        const atNet = incoming ? -ball.z / velocity.z : Infinity;
        const netHeight = ball.y + velocity.y * atNet - .5 * GRAVITY * atNet ** 2;
        const crossesAtBlockHeight = atNet < .85 && Math.abs(ball.x + velocity.x * atNet) < COURT.halfWidth
            && netHeight >= COURT.netHeight && netHeight < 3.67;
        const anticipates = ctx.possession !== side && ctx.touches > 0 && sign * ball.z < 0
            && Math.abs(ball.z) < 2.2 && ball.y > 2.46 && ball.y < 3.75
            && rivals.some(athlete => athlete.y > .24 && Math.abs(athlete.z) < 2.05 && distance(athlete, ball) < 1.35);
        const blockPoint = { x: crossesAtBlockHeight ? ball.x + velocity.x * atNet : ball.x, z: sign * .82 };
        const blocker = crossesAtBlockHeight || anticipates
            ? closest(team, blockPoint, athlete => canTouch(athlete) && Math.abs(athlete.z) < 2.5) : undefined;

        for (const [index, athlete] of team.entries()) {
            if (!athlete.difficulty) continue;
            const profile = BOT_DIFFICULTIES[athlete.difficulty];
            const hold = cover(side, index, team.length, ball);
            const salt = index + (side === 'player' ? 0 : 3);
            const roll = (key: number) => botRoll(salt, ctx.pointNumber, touches, key);
            if (athlete === blocker && timeSinceContact >= profile.reaction && roll(4) < profile.blockChance) {
                const ready = distance(athlete, blockPoint) < .88;
                const jump = ready && (anticipates || atNet < .29 - profile.reaction * .18);
                plan.set(athlete.id, { ...moveTo(athlete, blockPoint), jump, block: true });
                continue;
            }
            if (athlete !== active || timeSinceContact < profile.reaction) {
                const point = athlete === support && touches < 2 ? nextPoint : hold;
                plan.set(athlete.id, moveTo(athlete, point));
                continue;
            }

            const predict = {
                x: target.x + (roll(7) * 2 - 1) * profile.receiveJitter * (touches === 0 ? 1.45 : .9),
                z: target.z + (hold.z - target.z) * (1 - profile.coverage) * .32,
            };
            const movement = moveTo(athlete, predict, touches >= 2 ? .51 : .28);
            const near = distance(athlete, predict) < (touches >= 2 ? .83 : .66);
            if (touches === 0) {
                const dive = !near && athlete.y === 0 && travel < .13 && distance(athlete, predict) < 1.73
                    && roll(8) < profile.receiveSuccess;
                plan.set(athlete.id, { ...movement, leftHeld: true, rightPress: dive, aim: dive ? predict : nextPoint });
                continue;
            }
            if (touches === 1) {
                const setPress = near && travel < .34 - profile.reaction * .15 && athlete.setAt <= ctx.elapsed - .46;
                plan.set(athlete.id, { ...movement, setPress, aim: nextPoint });
                continue;
            }

            const jump = near && travel < .43 - profile.reaction * .14;
            const swing = athlete.y > .14 && near && travel < .235 - profile.reaction * .22
                && (!athlete.swing || ctx.elapsed - athlete.swing.at > .25);
            const aim = athlete.difficulty === 'hard' || athlete.difficulty === 'brutal'
                ? opening(rivals, opposite(side))
                : { x: (rivals[0].x < 0 ? .665 : -.665) * COURT.halfWidth, z: -sign * COURT.halfLength * .67 };
            const spike = ctx.goodSet && Math.abs(target.z) < 1.72 && ball.y > 2.85 && ball.y < 3.50
                && roll(9) < profile.setChance && (athlete.difficulty === 'hard' || athlete.difficulty === 'brutal');
            const attack = chooseBotAttack(athlete.difficulty, roll(1));
            plan.set(athlete.id, { ...movement, jump, aim,
                leftPress: swing && (spike || attack === 'Ataque forte'),
                rightPress: swing && (spike || attack !== 'Ataque forte') });
        }
    }
    return plan;
}
