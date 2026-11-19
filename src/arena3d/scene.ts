import * as THREE from 'three';
import type { BuffKind } from '../buffs';
import { BALL_RADIUS, COURT } from './simulation';

const sphere = new THREE.SphereGeometry(1, 24, 16);
const materials = new Map<number, THREE.MeshStandardMaterial>();

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) {
    let material = materials.get(color);
    if (!material) {
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
        materials.set(color, material);
    }
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
}

function box(parent: THREE.Object3D, color: number, w: number, h: number, d: number, x: number, y: number, z: number) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
}

function ellipsoid(parent: THREE.Object3D, color: number, w: number, h: number, d: number, x: number, y: number, z: number) {
    const object = mesh(parent, sphere, color, x, y, z);
    object.scale.set(w, h, d);
    return object;
}

function capsule(parent: THREE.Object3D, color: number, radius: number, height: number, x: number, y: number, z: number) {
    return mesh(parent, new THREE.CapsuleGeometry(radius, height, 5, 12), color, x, y, z);
}

function buildCourt(scene: THREE.Scene) {
    const { halfWidth: w, halfLength: l, netHeight: net, sandWidth, sandLength } = COURT;
    const sand = new THREE.PlaneGeometry(sandWidth, sandLength, 10, 16).rotateX(-Math.PI / 2);
    const sandPositions = sand.attributes.position;
    const colors: number[] = [];
    const color = new THREE.Color();
    const pale = new THREE.Color(0xe8c795);
    const warm = new THREE.Color(0xf6dbac);
    for (let i = 0; i < sandPositions.count; i++) {
        const tint = 0.47 + 0.17 * Math.sin(sandPositions.getX(i) * 0.57 + sandPositions.getZ(i) * 0.62);
        color.copy(pale).lerp(warm, tint).toArray(colors, i * 3);
    }
    sand.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    scene.add(new THREE.Mesh(sand, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    for (const side of [-1, 1]) {
        const x = side * w;
        const z = side * l;
        box(scene, 0x155069, 0.18, 0.02, 2 * l + 0.18, x, 0.011, 0);
        box(scene, 0x155069, w * 2 + 0.18, 0.02, 0.18, 0, 0.011, z);
        for (const end of [-1, 1]) {
            box(scene, 0xfff3cb, 0.056, 0.008, 0.65, x, 0.025, end * (l - 0.30));
            box(scene, 0xfff3cb, 0.65, 0.008, 0.056, side * (w - 0.30), 0.025, end * l);
        }

        const postX = side * (w + 0.34);
        const post = new THREE.CylinderGeometry(0.08, 0.08, net + 0.13, 14);
        mesh(scene, post, 0x144d60, postX, (net + 0.13) / 2, 0);
        capsule(scene, 0xd34e30, 0.17, 0.79, postX, 0.56, 0);
        mesh(scene, new THREE.CylinderGeometry(0.26, 0.3, 0.05, 18), 0x16485c, postX, 0.025, 0);
    }

    const netWidth = w * 2 + 0.68;
    box(scene, 0x17495e, netWidth, 0.13, 0.08, 0, net - 0.07, 0);
    box(scene, 0xfffbec, netWidth, 0.085, 0.09, 0, net - 0.0425, 0);
    const lines: number[] = [];
    const columns = Math.round(netWidth / .26);
    for (let i = 1; i < columns; i++) {
        const x = netWidth * (i / columns - .5);
        lines.push(x, net - 0.06, 0, x, net - 0.96, 0);
    }
    for (let i = 1; i <= 5; i++) lines.push(-netWidth / 2, net - i * 0.185, 0, netWidth / 2, net - i * 0.185, 0);
    const weave = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    scene.add(new THREE.LineSegments(weave, new THREE.LineBasicMaterial({ color: 0x13536b, transparent: true, opacity: 0.73 })));
}

function palm(scene: THREE.Scene, x: number, z: number, size: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(size);
    group.rotation.y = x * 0.55;
    scene.add(group);
    const trunk = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.10, 0), new THREE.Vector3(0.04, 0.95, 0),
        new THREE.Vector3(0.34, 2.1, 0), new THREE.Vector3(0.58, 3.14, 0),
    ]);
    mesh(group, new THREE.TubeGeometry(trunk, 12, 0.10, 8), 0xa28963, 0, 0, 0);

    const vertices: number[] = [];
    const faces: number[] = [];
    for (let i = 0; i <= 9; i++) {
        const t = i / 9;
        const y = 1.55 * t - 2.33 * t * t;
        const width = Math.sin(t * Math.PI) * (0.21 + 0.08 * (i % 2));
        vertices.push(1.64 * t, y - width * 0.28, -width, 1.64 * t, y, 0, 1.64 * t, y - width * 0.28, width);
        if (i) {
            const n = i * 3;
            faces.push(n - 3, n, n - 2, n, n + 1, n - 2, n - 2, n + 1, n - 1, n + 1, n + 2, n - 1);
        }
    }
    const leaf = new THREE.BufferGeometry();
    leaf.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    leaf.setIndex(faces);
    leaf.computeVertexNormals();
    for (let k = 0; k < 8; k++) {
        const frond = new THREE.Mesh(leaf, new THREE.MeshStandardMaterial({
            color: [0x236e57, 0x428773, 0x57966b][k % 3], side: THREE.DoubleSide, roughness: 0.88,
        }));
        frond.position.set(0.58, 3.12, 0);
        frond.rotation.set(0, k * Math.PI / 4, (k % 3 - 1) * 0.22);
        group.add(frond);
    }
}

function terrain(scene: THREE.Scene) {
    const { sandWidth, sandLength } = COURT;
    const edgeX = sandWidth / 2;
    const edgeZ = sandLength / 2;
    box(scene, 0x45a1a6, 290, 0.2, 290, 0, -3.55, 0);
    box(scene, 0xd9cbbb, sandWidth + 0.24, 0.26, sandLength + 0.24, 0, -0.14, 0);
    box(scene, 0xc8ac95, sandWidth - 0.20, 0.95, sandLength - 0.20, 0, -0.74, 0);

    const coast = [[-7.6, -12], [-4.2, -12.7], [6.4, -13.4], [8.8, -8.6], [8.2, 5.6],
        [7.5, 12.6], [2.9, 13.8], [-5.7, 12.7], [-8.5, 8.8], [-7.9, -4.6]]
        .map(([x, z]) => [x * sandWidth / 15, z * sandLength / 24]);
    const strata: number[] = [];
    const stones: number[] = [];
    const rock = new THREE.Color();
    coast.forEach(([x, z], i) => {
        const next = (i + 1) % coast.length;
        const [nx, nz] = coast[next];
        const top = -1.16 + 0.12 * (i % 3);
        const nextTop = -1.16 + 0.12 * (next % 3);
        const lower = -3.57;
        const wallTint = [0x778c82, 0x8d9a86, 0x6e837e][i % 3];
        strata.push(0, -1.16, 0, nx, nextTop, nz, x, top, z,
            x, top, z, nx, nextTop, nz, x * 1.17, lower, z * 1.08,
            nx, nextTop, nz, nx * 1.17, lower, nz * 1.08, x * 1.17, lower, z * 1.08);
        for (let v = 0; v < 9; v++) rock.set(v < 3 ? 0x7c987f : wallTint).toArray(stones, stones.length);
    });
    const cliff = new THREE.BufferGeometry();
    cliff.setAttribute('position', new THREE.Float32BufferAttribute(strata, 3));
    cliff.setAttribute('color', new THREE.Float32BufferAttribute(stones, 3));
    cliff.computeVertexNormals();
    scene.add(new THREE.Mesh(cliff, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    const wave = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        color: 0xb9ece0, opacity: 0.35, transparent: true, depthWrite: false,
    }), 70);
    const transform = new THREE.Object3D();
    for (let i = 0; i < wave.count; i++) {
        transform.position.set(((i * 73) % 151 - 75) * 0.84, -3.44, ((i * 37) % 191 - 95) * 0.72);
        transform.rotation.set(-Math.PI / 2, 0, 0.18);
        transform.scale.set(0.8 + 0.64 * (i % 6), 0.065 + 0.014 * (i % 4), 1);
        transform.updateMatrix();
        wave.setMatrixAt(i, transform.matrix);
    }
    scene.add(wave);

    const islands = [
        [-37, -56, 19, 9, 12, 0x598c87], [-19, -62, 17, 15, 13, 0x6b9e94],
        [10, -62, 25, 8, 13, 0x86b1a6], [-62, -31, 19, 10, 19, 0x6a9e93],
        [-65, -6, 17, 15, 13, 0x67a195], [-68, 26, 19, 12, 15, 0x89b7ad],
    ];
    islands.forEach(([x, z, w, h, d, color], i) => {
        const island = ellipsoid(scene, color, w, h, d, x, -4.1, z);
        island.rotation.set(0, i * 0.19, (i % 2 ? 1 : -1) * 0.12);
    });

    for (const [x, z] of [[14, -34], [-36, 12]]) {
        const boat = new THREE.Group();
        boat.position.set(x, -3.45, z);
        boat.rotation.y = 0.62;
        scene.add(boat);
        ellipsoid(boat, 0xdeece5, 0.74, 0.11, 0.23, 0, 0.06, 0);
        const sail = new THREE.BufferGeometry();
        sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.15, 0, 0.63, 0.15, 0, 0, 1.51, 0], 3));
        sail.computeVertexNormals();
        boat.add(new THREE.Mesh(sail, new THREE.MeshBasicMaterial({ color: 0xf5f2df, side: THREE.DoubleSide })));
    }

    for (const side of [-1, 1]) {
        const railX = side * (edgeX - .01);
        const benchX = side * (edgeX - .42);
        const benchZ = -edgeZ * .18;
        box(scene, 0x3d7b79, 0.24, 0.30, sandLength - .3, railX, 0.15, 0);
        box(scene, 0xddedf0, 0.30, 0.07, sandLength - .3, railX, 0.32, 0);
        box(scene, 0xc99560, 0.70, 0.09, 2.32, benchX, 0.37, benchZ);
        for (const leg of [-1, 1]) box(scene, 0x315e63, 0.36, 0.33, 0.10, benchX, 0.17, benchZ + leg * .81);
    }
    for (const [side, z, size] of [[-1, -edgeZ + 1.3, .95], [-1, edgeZ - 3.65, .71], [1, -edgeZ + 1.25, .78], [-1, -edgeZ + 4.4, .65]]) {
        const x = side * (edgeX - .22);
        palm(scene, x, z, size);
        mesh(scene, new THREE.CylinderGeometry(0.32, 0.26, 0.28, 14), 0xd89768, x, 0.14, z);
    }
    const canopyX = edgeX - .13;
    const canopyZ = -edgeZ * .53;
    mesh(scene, new THREE.CylinderGeometry(0.039, 0.05, 2.15, 12), 0x275d66, canopyX, 1.075, canopyZ);
    for (let i = 0; i < 8; i++) {
        const canopy = new THREE.ConeGeometry(1.02, 0.42, 3, 1, true, i * Math.PI / 4, Math.PI / 4);
        mesh(scene, canopy, i % 2 ? 0xf3e2bb : 0xdd6540, canopyX, 2.13, canopyZ);
    }
}

function numberMaterial(number: number) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '900 55px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff6e3';
    ctx.fillText(String(number), 32, 35);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.45 });
}

function athlete(scene: THREE.Scene, opponent: boolean, slot: number, number: THREE.Material) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    scene.add(root);

    const jersey = (opponent ? [0x166eab, 0x338cba, 0x146996] : [0xe34c29, 0xd15634, 0xe86241])[slot];
    const trim = opponent ? 0xa4f6ff : 0xffebaa;
    const skin = (opponent ? [0x855b49, 0xca885e, 0xa66e50] : [0xc88a62, 0x90604f, 0xd79772])[slot];
    const style = (slot + Number(opponent)) % 3;
    const hair = [0x3f2b24, 0x392a2c, 0x50413c][style];
    const shorts = opponent ? 0x174869 : 0x254653;
    ellipsoid(body, shorts, 0.29, 0.185, 0.21, 0, 0.95, 0);
    ellipsoid(body, jersey, 0.35, 0.36, 0.205, 0, 1.25, 0);
    const label = new THREE.PlaneGeometry(.23, .27);
    for (const side of [-1, 1]) {
        const badge = new THREE.Mesh(label, number);
        badge.position.set(0, 1.26, side * .208);
        badge.rotation.y = side < 0 ? Math.PI : 0;
        body.add(badge);
    }
    capsule(body, skin, 0.105, 0.075, 0, 1.57, 0);
    ellipsoid(body, skin, 0.235, 0.255, 0.215, 0, 1.77, -0.025);
    ellipsoid(body, skin, 0.059, 0.067, 0.065, 0, 1.74, -0.232);
    ellipsoid(body, hair, 0.251, 0.176, 0.226, 0, 1.887, 0.012);
    if (style === 1) {
        ellipsoid(body, trim, 0.25, 0.055, 0.228, 0, 1.853, 0.006);
        ellipsoid(body, hair, 0.115, 0.117, 0.108, -0.12, 2.019, 0.04);
    } else if (style === 0) {
        ellipsoid(body, hair, 0.118, 0.105, 0.095, 0.14, 1.97, -0.10);
    } else {
        ellipsoid(body, trim, 0.245, 0.082, 0.215, 0, 1.946, -0.01);
    }

    const legs: THREE.Group[] = [];
    const knees: THREE.Group[] = [];
    const arms: THREE.Group[] = [];
    const elbows: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        ellipsoid(body, skin, 0.053, 0.073, 0.042, side * 0.22, 1.75, 0);
        ellipsoid(body, 0x233540, 0.029, 0.033, 0.013, side * 0.09, 1.793, -0.221);

        const leg = new THREE.Group();
        leg.position.set(side * 0.16, 0.94, 0);
        body.add(leg);
        const knee = new THREE.Group();
        knee.position.y = -0.45;
        leg.add(knee);
        capsule(leg, shorts, 0.13, 0.18, 0, -0.19, 0);
        capsule(knee, skin, 0.093, 0.29, 0, -0.177, 0);
        ellipsoid(knee, trim, 0.108, 0.075, 0.19, 0, -0.401, -0.07);
        ellipsoid(knee, shorts, 0.113, 0.030, 0.194, 0, -0.446, -0.07);
        legs.push(leg);
        knees.push(knee);

        const arm = new THREE.Group();
        arm.position.set(side * 0.309, 1.446, 0);
        body.add(arm);
        const elbow = new THREE.Group();
        elbow.position.y = -0.33;
        arm.add(elbow);
        ellipsoid(arm, jersey, 0.141, 0.152, 0.134, 0, -0.05, 0);
        capsule(arm, skin, 0.095, 0.205, 0, -0.185, 0);
        capsule(elbow, skin, 0.082, 0.16, 0, -0.138, 0);
        ellipsoid(elbow, trim, 0.086, 0.056, 0.088, 0, -0.233, 0);
        ellipsoid(elbow, skin, 0.074, 0.083, 0.062, 0, -0.293, 0);
        arms.push(arm);
        elbows.push(elbow);
    }

    return { root, body, legs, knees, arms, elbows };
}

export type AthletePose = 'idle' | 'run' | 'jump' | 'receive' | 'dive' | 'set' | 'attack' | 'block' | 'serve';

function shadow(scene: THREE.Scene, texture: THREE.Texture, radius: number, y: number, opacity: number) {
    const object = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity, depthWrite: false, color: 0x1b303a,
    }));
    object.rotation.x = -Math.PI / 2;
    object.position.y = y;
    scene.add(object);
    return object;
}

function markControlled(shadow: THREE.Object3D) {
    for (const angle of [0, Math.PI]) {
        const edge = new THREE.Mesh(new THREE.RingGeometry(.43, .57, 12, 1, angle - .42, .84),
            new THREE.MeshBasicMaterial({ color: 0x993e30 }));
        const stripe = new THREE.Mesh(new THREE.RingGeometry(.459, .541, 12, 1, angle - .37, .74),
            new THREE.MeshBasicMaterial({ color: 0xfff8e6 }));
        edge.position.z = .005;
        stripe.position.z = .006;
        shadow.add(edge, stripe);
    }
}

const PICKUP_COLORS = { pass: 0x70edcb, speed: 0xffba4f, jump: 0xc5adff } as const;

function pickupSymbols(scene: THREE.Scene) {
    const ink = new THREE.MeshBasicMaterial({ color: 0x202c40 });
    const geometries: Record<BuffKind, THREE.BufferGeometry> = {
        pass: new THREE.RingGeometry(.135, .24, 24),
        speed: new THREE.ShapeGeometry(new THREE.Shape([
            [-.17, .015], [.03, .268], [.005, .065], [.17, .065], [-.053, -.26], [-.009, .015],
        ].map(([x, y]) => new THREE.Vector2(x, y)))),
        jump: new THREE.ShapeGeometry(new THREE.Shape([
            [-.245, .015], [0, .257], [.245, .015], [.109, .015], [.109, -.225], [-.109, -.225], [-.109, .015],
        ].map(([x, y]) => new THREE.Vector2(x, y)))),
    };
    const slots = [0, 1].map(() => {
        const token = new THREE.Group();
        const rim = new THREE.Mesh(new THREE.CircleGeometry(.57, 32), ink);
        rim.rotation.x = -Math.PI / 2;
        const face = new THREE.Mesh(new THREE.CircleGeometry(.485, 32), new THREE.MeshBasicMaterial());
        face.rotation.x = -Math.PI / 2;
        face.position.y = .002;
        const stamp = new THREE.Mesh(geometries.pass, ink);
        stamp.rotation.x = -Math.PI / 2;
        stamp.position.y = .004;
        token.add(rim, face, stamp);
        token.visible = false;
        scene.add(token);
        return { token, face, stamp };
    });

    return (pickups: readonly { kind: BuffKind; x: number; z: number }[]) => {
        slots.forEach(({ token, face, stamp }, index) => {
            const pickup = pickups[index];
            token.visible = pickup !== undefined;
            if (!pickup) return;
            face.material.color.setHex(PICKUP_COLORS[pickup.kind]);
            stamp.geometry = geometries[pickup.kind];
            token.position.set(pickup.x, .025, pickup.z);
        });
    };
}

function marker(scene: THREE.Scene, landing = false) {
    const group = new THREE.Group();
    const pieces = landing ? 4 : 1;
    for (let i = 0; i < pieces; i++) {
        const start = Math.PI / 2 * i;
        const arc = landing ? Math.PI * 0.31 : Math.PI * 2;
        const edge = new THREE.Mesh(new THREE.RingGeometry(landing ? 0.36 : 0.275, landing ? 0.56 : 0.43, 28, 1, start, arc),
            new THREE.MeshBasicMaterial({ color: 0x123d54, depthTest: false, depthWrite: false }));
        const core = new THREE.Mesh(new THREE.RingGeometry(landing ? 0.40 : 0.31, landing ? 0.52 : 0.39, 28, 1, start + (landing ? 0.07 : 0), arc - (landing ? 0.14 : 0)),
            new THREE.MeshBasicMaterial({ color: landing ? 0xffdc46 : 0xf6ffff, depthTest: false, depthWrite: false }));
        edge.rotation.x = core.rotation.x = -Math.PI / 2;
        edge.renderOrder = 2;
        core.renderOrder = 3;
        group.add(edge, core);
    }

    const dot = new THREE.Mesh(new THREE.CircleGeometry(landing ? 0.080 : 0.045, landing ? 4 : 18),
        new THREE.MeshBasicMaterial({ color: landing ? 0xffdc46 : 0x173c56, depthTest: false, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2;
    dot.renderOrder = 3;
    group.add(dot);
    group.visible = false;
    scene.add(group);
    return group;
}

function volleyball(scene: THREE.Scene) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff9df';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = -1; i < 5; i++) {
        const x = 128 * i;
        ctx.beginPath();
        ctx.moveTo(x - 100, 0);
        ctx.bezierCurveTo(x + 35, 75, x - 8, 170, x + 83, 256);
        ctx.lineTo(x + 123, 256);
        ctx.bezierCurveTo(x + 24, 162, x + 77, 79, x - 63, 0);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#ffbb41' : '#135382';
        ctx.fill();
        ctx.strokeStyle = '#376274';
        ctx.lineWidth = 1.4;
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const shape = new THREE.SphereGeometry(BALL_RADIUS * 1.19, 32, 24);
    const ball = new THREE.Mesh(shape,
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.53, emissive: 0x1a1a1a, emissiveIntensity: 0.5 }));
    const edge = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: 0x274456, side: THREE.BackSide }));
    edge.scale.setScalar(1.055);
    ball.add(edge);
    scene.add(ball);
    return ball;
}

export function buildScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbde4e2);
    scene.fog = new THREE.Fog(0xbde4e2, 38, 112);
    scene.add(new THREE.HemisphereLight(0xf8fcff, 0x9d8771, 2.25));
    const sun = new THREE.DirectionalLight(0xffe4c2, 2.05);
    sun.position.set(-7, 12, 5);
    scene.add(sun);
    terrain(scene);
    buildCourt(scene);

    const ball = volleyball(scene);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 64;
    const ctx = shadowCanvas.getContext('2d')!;
    const feather = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    feather.addColorStop(0, '#fffffff2');
    feather.addColorStop(0.53, '#ffffffaa');
    feather.addColorStop(1, '#ffffff00');
    ctx.fillStyle = feather;
    ctx.fillRect(0, 0, 64, 64);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);

    const ballShadow = shadow(scene, shadowTexture, 0.32, 0.023, 0.70);
    const aim = marker(scene);
    const landing = marker(scene, true);
    const updatePickups = pickupSymbols(scene);

    function applyPose({ body, legs, knees, arms, elbows }: ReturnType<typeof athlete>, pose: AthletePose, stride: number) {
        body.position.y = pose === 'receive' ? -0.13 : pose === 'dive' ? 0.18 : 0;
        body.rotation.x = pose === 'dive' ? -1.16 : pose === 'receive' ? -0.16 : 0;
        const left: [number, number, number] = [0, -0.15, 0.1];
        const right: [number, number, number] = [0, 0.15, 0.1];
        if (pose === 'run') {
            const swing = Math.sin(stride) * 0.65;
            left[0] = swing;
            right[0] = -swing;
            left[2] = right[2] = 0.75;
        } else if (pose === 'jump') {
            left[0] = right[0] = 0.35;
        } else if (pose === 'receive' || pose === 'dive') {
            left[0] = right[0] = pose === 'dive' ? 2.36 : 1.34;
            left[1] = 0.37;
            right[1] = -0.37;
        } else if (pose === 'set' || pose === 'block') {
            left[0] = right[0] = pose === 'block' ? 3.08 : 2.51;
            left[2] = right[2] = pose === 'set' ? 0.58 : 0;
        } else if (pose === 'attack' || pose === 'serve') {
            left[0] = 1.21;
            right[0] = 3.23;
            right[2] = 0.18;
        }
        [left, right].forEach(([pitch, flare, bend], i) => {
            const direction = i === 0 ? 1 : -1;
            arms[i].rotation.set(pitch, 0, flare);
            elbows[i].rotation.x = bend;
            legs[i].rotation.x = pose === 'run' ? -pitch : pose === 'receive' ? 0.40 : pose === 'jump' ? direction * 0.32 : 0;
            knees[i].rotation.x = pose === 'receive' ? -0.60 : pose === 'jump' ? -0.33 : 0;
        });
    }

    const numbers = [1, 2, 3].map(numberMaterial);
    function buildTeam(opponent: boolean) {
        return numbers.map((material, slot) => {
            const actor = athlete(scene, opponent, slot, material);
            const groundShadow = shadow(scene, shadowTexture, .61, .018, .55);
            actor.root.visible = groundShadow.visible = slot === 0;
            return {
                model: actor.root, shadow: groundShadow, legs: actor.legs, arms: actor.arms,
                pose: (pose: AthletePose, stride = 0) => applyPose(actor, pose, stride),
            };
        });
    }
    const teams = { player: buildTeam(false), opponent: buildTeam(true) };
    const [human] = teams.player;
    const [rival] = teams.opponent;
    markControlled(human.shadow);

    function poseAthlete(side: 'player' | 'bot', pose: AthletePose, stride = 0) {
        (side === 'player' ? human : rival).pose(pose, stride);
    }

    return {
        scene, player: human.model, legs: human.legs, arms: human.arms, playerShadow: human.shadow,
        bot: rival.model, botLegs: rival.legs, botArms: rival.arms, botShadow: rival.shadow,
        poseAthlete, ball, ballShadow, aim, landing, teams, updatePickups,
    };
}
