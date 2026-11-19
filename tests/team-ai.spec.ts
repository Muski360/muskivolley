import { expect, test } from '@playwright/test';
import { createRally } from '../src/arena3d/rally';
import { planBots } from '../src/arena3d/team-ai';

type Snapshot = Parameters<typeof planBots>[0];
type Athlete = Snapshot['teams']['opponent'][number];

const human: Athlete = { id: 'player-0', x: 0, y: 0, z: 4, setAt: -Infinity, action: 'idle' };
const bot: Athlete = { id: 'opponent-0', x: 0, y: 0, z: -4, setAt: -Infinity, action: 'idle', difficulty: 'medium' };

function snapshot(opponents: Athlete[], overrides: Partial<Snapshot> = {}): Snapshot {
    return {
        teams: { player: [human], opponent: opponents },
        mode: 'match', phase: 'rally', server: 'player', serverId: human.id, possession: 'opponent', touches: 0,
        pointNumber: 0, elapsed: 10, phaseStart: 7, lastContact: 9, lastContactWasBlock: false, goodSet: false,
        tossStart: null, ball: { x: 0, y: 1.3, z: -4 }, velocity: { x: 0, y: -5, z: -1 }, ...overrides,
    };
}

test('a reação de cada dificuldade define quando o bot passa a disputar a recepção', () => {
    const reacts = (difficulty: Athlete['difficulty'], seconds: number) => planBots(snapshot(
        [{ ...bot, difficulty }], { elapsed: 9 + seconds },
    )).get(bot.id)?.leftHeld === true;
    expect(reacts('brutal', .05)).toBe(true);
    expect(reacts('hard', .05)).toBe(false);
    expect(reacts('hard', .1)).toBe(true);
    expect(reacts('medium', .1)).toBe(false);
    expect(reacts('medium', .2)).toBe(true);
    expect(reacts('easy', .2)).toBe(false);
    expect(reacts('easy', .4)).toBe(true);
});

test('em equipes o próximo toque fica com outro atleta, com exceção do bloqueio', () => {
    const front = { ...bot, z: -2 };
    const partner = { ...front, id: 'opponent-1', x: .23 };
    const state = snapshot([front, partner, { ...bot, id: 'opponent-2', x: 3 }], {
        ball: { x: 0, y: 2.06, z: -2 }, velocity: { x: 0, y: -2, z: 0 }, touches: 1, lastTouchId: front.id,
    });

    const passing = planBots(state);
    expect(passing.get(partner.id)?.setPress).toBe(true);
    expect(passing.get(front.id)?.setPress).toBeUndefined();
    expect(passing.get('opponent-2')?.setPress).toBeUndefined();

    const blocking = planBots({ ...state, lastContactWasBlock: true });
    expect(blocking.get(front.id)?.setPress).toBe(true);
    expect(blocking.get(partner.id)?.setPress).toBeUndefined();
});

test('um salto de levantamento junto à rede pode provocar um bloqueio antecipado', () => {
    const state = snapshot([{ ...bot, z: -.82, difficulty: 'brutal' }], {
        teams: {
            player: [{ ...human, z: .92, y: .85, action: 'set' }],
            opponent: [{ ...bot, z: -.82, difficulty: 'brutal' }],
        },
        possession: 'player', touches: 1,
        ball: { x: 0, y: 3, z: 1.08 }, velocity: { x: 0, y: 4, z: 0 },
    });
    expect(planBots(state).get(bot.id)).toMatchObject({ jump: true, block: true });
    state.teams.player = [human];
    expect(planBots(state).get(bot.id)?.block).toBeUndefined();
});

for (const teamSize of [2, 3] as const) {
    test(`a equipe ${teamSize}v${teamSize} alterna atletas para devolver um saque em três toques`, async () => {
        const game = await createRally();
        const idle = { x: 0, z: 0, jump: false };
        try {
            game.start('match', undefined, {
                teamSize, homeBots: ['medium', 'medium'], awayBots: ['medium', 'medium', 'medium'], buffs: false,
            });
            for (let i = 0; i < 185 && game.state.phase === 'countdown'; i++) game.step(idle);
            expect(game.state.phase).toBe('serve');
            game.step({ ...idle, leftPress: true, serve: 1 });
            for (let i = 0; i < 35; i++) game.step(idle);
            game.step({ ...idle, leftPress: true, aim: { x: 0, z: -7.125 } });

            const contacts: string[] = [];
            const actors: string[] = [];
            let lastFeedback = game.state.feedbackId;
            for (let i = 0; i < 600 && game.state.phase === 'rally' && contacts.length < 3; i++) {
                game.step(idle);
                if (game.state.possession !== 'opponent' || lastFeedback === game.state.feedbackId) continue;
                lastFeedback = game.state.feedbackId;
                contacts.push(game.state.feedback.split(' · ')[0]);
                const action = game.state.touches === 1 ? 'receive' : game.state.touches === 2 ? 'set' : 'attack';
                actors.push(game.teams.opponent.find(athlete => athlete.action === action)?.id ?? '');
            }

            expect(contacts[0]).toBe('Manchete');
            expect(contacts[1]).toMatch(/^Levantamento/);
            expect(contacts[2]).toMatch(/^Ataque/);
            expect(actors.every(Boolean)).toBe(true);
            expect(actors[0]).not.toBe(actors[1]);
            expect(actors[1]).not.toBe(actors[2]);
        } finally { game.dispose(); }
    });
}
