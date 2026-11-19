import * as Phaser from 'phaser';
import { drawAthlete, type AthletePose } from './athletes';
import { COURT, type GameState } from './game';
import { makeSceneryLayers } from './scenery';

export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;

const FAR_Y = 133;
const NEAR_Y = 246;
const TEAM_COLORS = { red: 0xf64e37, blue: 0x429dff };
const FEEDBACK_COLORS = { red: '#ff6048', blue: '#6ab3ff', green: '#a4f46c', teal: '#78f0d3', yellow: '#ffda60', error: '#ff947d', neutral: '#fff2cc' };
const PICKUP_COLORS = { pass: 0xefa6fa, speed: 0x82e7ef, jump: 0xffd36a };
const PICKUP_MARKS = {
    pass: ['.##......', '#..#...#.', '####..###', '#..#...#.', '#..#.....'],
    speed: ['#...#..', '.#...#.', '..#...#', '.#...#.', '#...#..'],
    jump: ['...#...', '..###..', '.#####.', '...#...', '...#...'],
};
const POSES = ['idle', 'strideA', 'strideB', 'jump', 'bump', 'set', 'spike', 'block'] as const;

function project(x: number, y: number, z = 0) {
    const depth = y / COURT.depth;
    return {
        x: VIEW_WIDTH / 2 + 13 - depth * 19 + x * (0.294 + depth * 0.136),
        y: FAR_Y + (NEAR_Y - FAR_Y) * depth - z * (0.30 + depth * 0.105),
        scale: 0.68 + depth * 0.28,
    };
}

function drawCourtSurface() {
    const surface = document.createElement('canvas');
    surface.width = VIEW_WIDTH;
    surface.height = VIEW_HEIGHT;
    const ctx = surface.getContext('2d')!;
    const corners = [project(-COURT.halfWidth, 0), project(COURT.halfWidth, 0),
        project(COURT.halfWidth, COURT.depth), project(-COURT.halfWidth, COURT.depth)];

    function boundary() {
        ctx.beginPath();
        for (const [index, corner] of corners.entries()) {
            if (index === 0) ctx.moveTo(corner.x, corner.y);
            else ctx.lineTo(corner.x, corner.y);
        }
        ctx.closePath();
    }

    boundary();
    ctx.fillStyle = '#ffb65b23';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#99603580';
    ctx.stroke();
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = '#fff4ce';
    ctx.stroke();

    const back = project(0, 0);
    const front = project(0, COURT.depth);
    ctx.fillStyle = '#8d5638';
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.moveTo(back.x, back.y);
    ctx.lineTo(front.x, front.y);
    ctx.lineTo(front.x + 11, front.y + 3);
    ctx.lineTo(back.x + 7, back.y + 2);
    ctx.fill();
    return surface;
}

function makeBall() {
    const ball = document.createElement('canvas');
    ball.width = ball.height = 11;
    const ctx = ball.getContext('2d')!;
    const tiles = [
        '....###....',
        '..##111##..',
        '.#1111333#.',
        '.#1122333#.',
        '#122222333#',
        '#122211333#',
        '#222111444#',
        '.#2114444#.',
        '.#1144444#.',
        '..##444##..',
        '....###....',
    ];
    const colors: Record<string, string> = { '#': '#283e38', '1': '#fff7e2', '2': '#ffd36a', '3': '#4f9dfd', '4': '#d7e3d8' };
    for (const [y, line] of tiles.entries()) {
        for (const [x, symbol] of [...line].entries()) {
            if (symbol === '.') continue;
            ctx.fillStyle = colors[symbol];
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return ball;
}

function poseFor(player: GameState['players'][number], time: number): AthletePose {
    switch (player.action) {
        case 'move': return Math.floor(time / 108) % 2 === 0 ? 'strideA' : 'strideB';
        case 'receive': return 'bump';
        case 'set': return 'set';
        case 'serve': return player.actionTime > 0.22 ? 'jump' : 'spike';
        case 'attack': return 'spike';
        case 'block': return 'block';
        case 'jump': return 'jump';
        default: return player.z > 3 ? 'jump' : 'idle';
    }
}

interface CourtOptions {
    state: GameState;
    step: (delta: number) => void;
    effects: () => boolean;
    textMode: () => 'animated' | 'static' | 'off';
}

export class CourtScene extends Phaser.Scene {
    private athletes: Phaser.GameObjects.Image[] = [];
    private labels: HTMLSpanElement[] = [];
    private toasts: { label: Phaser.GameObjects.Text; y: number; born: number }[] = [];
    private ball!: Phaser.GameObjects.Image;
    private clouds!: Phaser.GameObjects.Image;
    private ground!: Phaser.GameObjects.Graphics;
    private air!: Phaser.GameObjects.Graphics;
    private cloudTime = 0;
    private lastFeedback = -1;

    constructor(private readonly court: CourtOptions) {
        super('Court');
    }

    preload() {
        this.load.image('rio', `${import.meta.env.BASE_URL}assets/mirante.png`);
    }

    create() {
        const source = this.textures.get('rio').getSourceImage() as HTMLImageElement;
        const { background, clouds, foliage } = makeSceneryLayers(source);
        this.textures.addCanvas('rio-background', background);
        this.textures.addCanvas('rio-clouds', clouds);
        this.textures.addCanvas('rio-foliage', foliage);
        this.add.image(0, 0, 'rio-background').setOrigin(0).setDepth(-5);
        this.clouds = this.add.image(0, 0, 'rio-clouds').setOrigin(0).setDepth(-4);
        this.add.image(0, 0, 'rio-foliage').setOrigin(0).setDepth(570);
        this.textures.addCanvas('court-surface', drawCourtSurface());
        this.add.image(0, 0, 'court-surface').setOrigin(0).setDepth(-2);
        this.ground = this.add.graphics().setDepth(1);
        this.air = this.add.graphics().setDepth(550);
        this.drawNet();

        const nameLayer = document.createElement('div');
        nameLayer.className = 'court-names';
        nameLayer.setAttribute('aria-hidden', 'true');
        this.game.canvas.parentElement?.append(nameLayer);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => nameLayer.remove());
        for (const player of this.court.state.players) {
            for (const pose of POSES) {
                this.textures.addCanvas(`athlete-${player.id}-${pose}`, drawAthlete(player.id, pose));
            }
            this.athletes.push(this.add.image(0, 0, `athlete-${player.id}-idle`).setOrigin(0.5, 44 / 48));
            const label = document.createElement('span');
            label.className = `court-name court-name--${player.team}`;
            nameLayer.append(label);
            this.labels.push(label);
        }

        this.textures.addCanvas('volleyball', makeBall());
        this.ball = this.add.image(0, 0, 'volleyball');
        this.game.canvas.setAttribute('aria-label', 'Quadra de vôlei no mirante carioca');
    }

    private drawNet() {
        const mesh = this.add.graphics().setDepth(265);
        const far = project(0, 0, COURT.netHeight);
        const near = project(0, COURT.depth, COURT.netHeight);
        const farBottom = project(0, 0, 42);
        const nearBottom = project(0, COURT.depth, 42);
        const silhouette = [far, near, nearBottom, farBottom].map(({ x, y }) => new Phaser.Math.Vector2(x, y));
        mesh.fillStyle(0x233c38, 0.19).fillPoints(silhouette, true);
        mesh.lineStyle(0.65, 0x263c37, 0.66);
        for (let i = 0; i <= 22; i++) {
            const y = COURT.depth * i / 22;
            const top = project(0, y, COURT.netHeight);
            const bottom = project(0, y, 42);
            mesh.lineBetween(top.x, top.y, bottom.x, bottom.y);
        }
        for (const height of [42, 56, 72, 88]) {
            const back = project(0, 0, height);
            const front = project(0, COURT.depth, height);
            mesh.lineBetween(back.x, back.y, front.x, front.y);
        }
        mesh.lineStyle(3, 0x694c3d).lineBetween(far.x, far.y, near.x, near.y);
        mesh.lineStyle(1.5, 0xfff3d4).lineBetween(far.x, far.y, near.x, near.y);

        for (const y of [0, COURT.depth]) {
            const pole = this.add.graphics().setDepth(10 + y);
            const base = project(0, y);
            const tip = project(0, y, COURT.netHeight + 20);
            const width = y === 0 ? 3 : 5;
            pole.fillStyle(0x896244, 0.32);
            pole.fillEllipse(base.x + 4, base.y + 1, width * 3, width + 1);
            pole.fillStyle(0x173b3b);
            pole.fillRect(base.x - width / 2, tip.y, width, base.y - tip.y);
            pole.fillStyle(0x4f776b);
            pole.fillRect(base.x - width / 2, tip.y + 4, 1, base.y - tip.y - 6);
            pole.fillStyle(0xffefc5);
            pole.fillRect(base.x - width / 2, tip.y, width, 3);
            pole.fillStyle(0xf65339);
            pole.fillRect(base.x - width / 2, tip.y + 5, width, 4);
        }
    }

    private drawPickups(time: number, animated: boolean) {
        for (const pickup of this.court.state.pickups) {
            const position = project(pickup.x, pickup.y);
            const x = Math.round(position.x);
            const y = Math.round(position.y) - (animated ? Math.round(Math.sin(time / 280)) : 0);
            const color = PICKUP_COLORS[pickup.kind];
            this.ground.fillStyle(0x352e38, 0.29).fillEllipse(x, position.y + 2, 18, 7);
            this.ground.fillStyle(0x202d31).fillCircle(x, y - 5, 8);
            this.ground.lineStyle(1.2, color).strokeCircle(x, y - 5, 7.3);
            this.ground.fillStyle(TEAM_COLORS[pickup.team]).fillRect(x - 1, y + 2, 3, 2);
            this.ground.fillStyle(color);
            const mark = PICKUP_MARKS[pickup.kind];
            const left = x - Math.floor(mark[0].length / 2);
            for (const [row, line] of mark.entries()) {
                for (let column = 0; column < line.length; column++) {
                    if (line[column] === '#') this.ground.fillRect(left + column, y - 7 + row, 1, 1);
                }
            }
        }
    }

    update(time: number, delta: number) {
        this.court.step(Math.min(delta, 50) / 1000);
        const { state } = this.court;
        this.ground.clear();
        this.air.clear();
        const effects = this.court.effects();

        if (effects) {
            this.cloudTime += delta;
            this.clouds.x = Math.round(2 * Math.sin(this.cloudTime / 3200));
            for (let i = 0; i < 9; i++) {
                const x = ((i * 73 + time / (120 + i * 9)) % (VIEW_WIDTH + 12)) - 6;
                const y = 27 + (i * 31) % 99 + Math.sin(time / 600 + i) * 4;
                this.air.fillStyle(i % 3 === 0 ? 0xffc277 : 0xffffd9, 0.45);
                this.air.fillRect(Math.round(x), Math.round(y), i % 2 + 1, 1);
            }
        }

        this.drawPickups(time, effects);
        for (const [index, player] of state.players.entries()) {
            const ground = project(player.x, player.y);
            const position = project(player.x, player.y, player.z);
            const sprite = this.athletes[index];
            this.ground.fillStyle(0x583f2f, 0.30).fillEllipse(ground.x, ground.y, 21 * ground.scale, 7 * ground.scale);
            if (index === 0) {
                this.ground.lineStyle(1.5, 0xfff1c2, 0.96).strokeEllipse(ground.x, ground.y, 23 * ground.scale, 9 * ground.scale);
                this.ground.lineStyle(0.75, TEAM_COLORS.red, 0.9).strokeEllipse(ground.x, ground.y, 26 * ground.scale, 11 * ground.scale);
            }
            if (player.buff) {
                const width = 31 * ground.scale;
                const height = 13 * ground.scale;
                this.ground.lineStyle(3, 0x202d31, 0.9).strokeEllipse(ground.x, ground.y, width, height);
                this.ground.lineStyle(1.5, PICKUP_COLORS[player.buff.kind]).strokeEllipse(ground.x, ground.y, width, height);
            }

            const pose = poseFor(player, time);
            const bob = pose === 'idle' && effects ? Math.floor(Math.sin(time / 260 + index) + 0.6) : 0;
            sprite.setTexture(`athlete-${player.id}-${pose}`)
                .setPosition(Math.round(position.x), Math.round(position.y - bob))
                .setScale(position.scale)
                .setFlipX(Math.abs(player.vx) > 18 ? player.vx < 0 : player.team === 'blue')
                .setDepth(12 + player.y);

            const text = index === 0 ? (state.player || 'VOCÊ') : player.name;
            const label = this.labels[index];
            if (label.textContent !== text) label.textContent = text;
            label.style.left = `${ground.x / VIEW_WIDTH * 100}%`;
            label.style.top = `${(ground.y + 5) / VIEW_HEIGHT * 100}%`;
        }

        const ground = project(state.ball.x, state.ball.y);
        const ball = project(state.ball.x, state.ball.y, state.ball.z);
        this.ground.fillStyle(0x583f2f, 0.24).fillEllipse(ground.x, ground.y, 10, 4);
        this.ball.setPosition(Math.round(ball.x), Math.round(ball.y))
            .setScale(0.8 + ball.scale * 0.24)
            .setDepth(state.ball.z >= COURT.netHeight ? 539 : 16 + state.ball.y)
            .setRotation(state.phase === 'rally' ? Math.floor(time / 85) * Math.PI / 4 : 0);

        const timing = state.timing;
        if (timing) {
            const marker = project(timing.x, timing.y);
            const progress = Phaser.Math.Clamp(timing.progress, 0, 1);
            const radius = 16 - progress * 10;
            const color = timing.ideal ? 0xb7ff8c : timing.active ? 0xffdc76 : 0xfffcdb;
            this.ground.lineStyle(1, 0x453d36, 0.54).strokeEllipse(marker.x, marker.y, 15, 6);
            this.ground.lineStyle(timing.active ? 2 : 1.5, color, 1)
                .strokeEllipse(marker.x, marker.y, radius * 2, radius * 0.86);
        }

        this.drawFeedback(time);
    }

    private drawFeedback(time: number) {
        const { feedbackEvents } = this.court.state;
        const mode = this.court.textMode();
        for (const feedback of feedbackEvents) {
            if (feedback.id <= this.lastFeedback) continue;
            this.lastFeedback = feedback.id;
            if (mode !== 'off') {
                const p = project(feedback.x, feedback.y, feedback.z);
                const y = Math.max(27, p.y - 17);
                const margin = Math.min(95, feedback.text.length * 3 + 6);
                const x = Phaser.Math.Clamp(p.x, margin, VIEW_WIDTH - margin);
                const label = this.add.text(x, y, feedback.text.toUpperCase(), {
                    fontFamily: 'monospace', fontSize: feedback.text === '+1' ? '18px' : '9px', fontStyle: 'bold',
                    color: FEEDBACK_COLORS[feedback.kind], stroke: '#26352d', strokeThickness: 2,
                }).setOrigin(0.5).setDepth(600);
                this.toasts.push({ label, y, born: time });
            }
        }

        this.toasts = this.toasts.filter(({ label, y, born }) => {
            const age = (time - born) / 850;
            if (age >= 1 || mode === 'off' || this.court.state.phase === 'menu') {
                label.destroy();
                return false;
            }
            label.y = Math.round(mode === 'animated' ? y - 15 * Math.min(1, age * 1.4) : y);
            label.alpha = mode === 'animated' ? Math.min(1, 4 * (1 - age)) : 1;
            return true;
        });
    }
}
