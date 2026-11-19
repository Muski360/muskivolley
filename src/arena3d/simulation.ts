import Rapier from '@dimforge/rapier3d-deterministic-compat';

export const STEP = 1 / 60;
export const COURT = {
    halfWidth: 5,
    halfLength: 10,
    netHeight: 2.35,
    netDepth: 0.08,
    sandWidth: 17,
    sandLength: 28,
    playerLimit: { x: 7.7, near: 0.42, far: 13.1 },
} as const;
export const BALL_RADIUS = 0.22;
export const GRAVITY = 9.81;
export const WALK_SPEED = 5.5;
const JUMP_SPEED = 4.8;
const ballStart = { x: -0.95, y: BALL_RADIUS, z: 4.75 };

export type GroundPoint = { x: number; z: number };
export type Movement = GroundPoint & { jump: boolean };

let rapierReady: Promise<void> | undefined;

export async function createCourtPhysics(damping = 0.035) {
    await (rapierReady ??= Rapier.init());
    const world = new Rapier.World({ x: 0, y: -GRAVITY, z: 0 });
    world.timestep = STEP;
    const { halfWidth, netHeight, netDepth, sandWidth, sandLength } = COURT;
    const sand = world.createCollider(Rapier.ColliderDesc.cuboid(sandWidth / 2, 0.25, sandLength / 2)
        .setTranslation(0, -0.25, 0).setRestitution(0.42).setFriction(0.9));
    world.createCollider(Rapier.ColliderDesc.cuboid(halfWidth + 0.25, 0.48, netDepth / 2)
        .setTranslation(0, netHeight - 0.48, 0).setRestitution(0.08));

    const ball = world.createRigidBody(Rapier.RigidBodyDesc.dynamic()
        .setTranslation(ballStart.x, ballStart.y, ballStart.z)
        .setCcdEnabled(true).setLinearDamping(damping).setAngularDamping(0.5));
    const ballCollider = world.createCollider(Rapier.ColliderDesc.ball(BALL_RADIUS).setRestitution(0.42)
        .setFriction(0.8).setActiveEvents(Rapier.ActiveEvents.COLLISION_EVENTS), ball);
    const events = new Rapier.EventQueue(true);
    return {
        ball,
        step() {
            world.step(events);
            let landed = false;
            events.drainCollisionEvents((a, b, started) => {
                if (started && ((a === ballCollider.handle && b === sand.handle)
                    || (b === ballCollider.handle && a === sand.handle))) landed = true;
            });
            return landed;
        },
        dispose() {
            events.free();
            world.free();
        },
    };
}

export function createAthlete(side: 1 | -1) {
    return { x: 0, y: 0, z: side * COURT.halfLength * .7125, heading: side === 1 ? 0 : Math.PI, jumpVelocity: 0 };
}

export function moveAthlete(player: ReturnType<typeof createAthlete>, side: 1 | -1,
    { x, z, jump }: Movement, speed = WALK_SPEED, jumpScale = 1) {
    const { playerLimit } = COURT;
    const scale = Math.max(1, Math.hypot(x, z));
    player.x = Math.max(-playerLimit.x, Math.min(playerLimit.x, player.x + x / scale * speed * STEP));
    player.z = side * Math.max(playerLimit.near, Math.min(playerLimit.far, side * (player.z + z / scale * speed * STEP)));
    if (x || z) player.heading = Math.atan2(-x, -z);
    if (jump && player.y === 0) player.jumpVelocity = JUMP_SPEED * jumpScale;
    if (player.jumpVelocity || player.y > 0) {
        player.y = Math.max(0, player.y + player.jumpVelocity * STEP);
        player.jumpVelocity = player.y ? player.jumpVelocity - GRAVITY * STEP : 0;
    }
}

export async function createSimulation() {
    const physics = await createCourtPhysics();
    const { ball } = physics;
    const player = createAthlete(1);
    player.z = 5.7;

    function resetBall() {
        ball.setTranslation(ballStart, true);
        ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
        ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    return {
        player,
        ballPosition: () => ball.translation(),
        ballRotation: () => ball.rotation(),
        launch(target: GroundPoint) {
            const start = { x: player.x, y: player.y + 2.05, z: player.z };
            const dx = target.x - start.x;
            const dz = target.z - start.z;
            const duration = Math.max(1.17, Math.hypot(dx, dz) / 11);
            ball.setTranslation(start, true);
            ball.setLinvel({ x: dx / duration, y: (BALL_RADIUS - start.y) / duration + GRAVITY * duration / 2,
                z: dz / duration }, true);
            ball.setAngvel({ x: dz * 0.4, y: 3, z: -dx * 0.4 }, true);
        },
        step(input: Movement) {
            moveAthlete(player, 1, input);
            physics.step();
            if (ball.translation().y < -5) resetBall();
        },
        dispose: physics.dispose,
    };
}
