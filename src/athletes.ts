export type AthletePose = 'idle' | 'strideA' | 'strideB' | 'jump' | 'bump' | 'set' | 'spike' | 'block'

type Point = readonly [number, number]
type Limb = readonly [Point, Point, Point]

interface Pose {
  offset: Point
  nearArm: Limb
  farArm: Limb
  nearLeg: Limb
  farLeg: Limb
}

const poses: Record<AthletePose, Pose> = {
  idle: {
    offset: [0, 0], nearArm: [[15, 24], [12, 29], [14, 34]], farArm: [[24, 24], [27, 29], [30, 29]],
    nearLeg: [[17, 32], [15, 38], [14, 42]], farLeg: [[23, 32], [25, 37], [24, 42]],
  },
  strideA: {
    offset: [0, 1], nearArm: [[15, 25], [14, 29], [21, 28]], farArm: [[25, 25], [25, 29], [22, 31]],
    nearLeg: [[17, 33], [13, 37], [10, 42]], farLeg: [[23, 33], [29, 36], [31, 41]],
  },
  strideB: {
    offset: [0, -1], nearArm: [[15, 23], [12, 26], [9, 29]], farArm: [[24, 23], [28, 27], [31, 24]],
    nearLeg: [[17, 31], [23, 37], [26, 42]], farLeg: [[23, 31], [19, 35], [14, 40]],
  },
  jump: {
    offset: [0, -2], nearArm: [[15, 22], [13, 17], [16, 13]], farArm: [[23, 22], [27, 18], [28, 13]],
    nearLeg: [[17, 30], [20, 36], [15, 39]], farLeg: [[23, 30], [27, 34], [24, 40]],
  },
  bump: {
    offset: [2, 3], nearArm: [[16, 27], [22, 31], [31, 30]], farArm: [[25, 27], [28, 31], [33, 29]],
    nearLeg: [[19, 35], [15, 39], [11, 42]], farLeg: [[25, 35], [29, 39], [27, 42]],
  },
  set: {
    offset: [0, -2], nearArm: [[15, 22], [11, 13], [14, 6]], farArm: [[24, 22], [30, 14], [27, 6]],
    nearLeg: [[17, 30], [16, 36], [19, 40]], farLeg: [[23, 30], [27, 35], [25, 40]],
  },
  spike: {
    offset: [1, -2], nearArm: [[16, 22], [14, 12], [18, 4]], farArm: [[25, 22], [31, 19], [33, 23]],
    nearLeg: [[18, 30], [18, 35], [12, 38]], farLeg: [[24, 30], [27, 35], [24, 40]],
  },
  block: {
    offset: [0, -1], nearArm: [[15, 23], [11, 14], [10, 4]], farArm: [[24, 23], [29, 13], [31, 4]],
    nearLeg: [[17, 31], [16, 36], [16, 41]], farLeg: [[23, 31], [24, 36], [25, 41]],
  },
}

const outline = '#252335'
const white = '#fff0ca'

const people = [
  { skin: '#d69059', shade: '#a9543d', light: '#ffe0a4', hair: '#32262e', sheen: '#654034', style: 'band' },
  { skin: '#a75f47', shade: '#713d3c', light: '#db9669', hair: '#242434', sheen: '#504052', style: 'bun' },
  { skin: '#d4926b', shade: '#a95849', light: '#ffd0a0', hair: '#2b303c', sheen: '#56616a', style: 'swept' },
  { skin: '#e6a06f', shade: '#b46352', light: '#ffe1b0', hair: '#834133', sheen: '#db7747', style: 'curl' },
] as const

const uniforms = [
  { main: '#e74a45', shade: '#a62834', light: '#ff876c', shorts: '#4d303d', shortsLight: '#775052' },
  { main: '#318bd4', shade: '#25508a', light: '#78d0ef', shorts: '#293b57', shortsLight: '#4a6287' },
]

export function drawAthlete(slot: number, pose: AthletePose, facing = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 48
  const ctx = canvas.getContext('2d')!
  if (facing < 0) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }

  const person = people[slot % people.length]
  const kit = uniforms[slot < 2 ? 0 : 1]
  const { offset: [x, y], nearArm, farArm, nearLeg, farLeg } = poses[pose]

  function box(color: string, left: number, top: number, width: number, height: number) {
    ctx.fillStyle = color
    ctx.fillRect(left, top, width, height)
  }

  function shape(color: string, points: readonly Point[]) {
    const minY = Math.min(...points.map(([, py]) => py))
    const maxY = Math.max(...points.map(([, py]) => py))
    for (let row = minY; row < maxY; row++) {
      const rowCenter = row + 0.5
      const hits: number[] = []
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]
        const [bx, by] = points[(i + 1) % points.length]
        if ((ay > rowCenter) === (by > rowCenter)) continue
        hits.push(ax + (bx - ax) * (rowCenter - ay) / (by - ay))
      }
      hits.sort((a, b) => a - b)
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const left = Math.round(hits[i])
        box(color, left, row, Math.round(hits[i + 1]) - left, 1)
      }
    }
  }

  function line(color: string, [ax, ay]: Point, [bx, by]: Point, size: number) {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1)
    const inset = Math.floor(size / 2)
    for (let i = 0; i <= steps; i++) {
      box(color, Math.round(ax + (bx - ax) * i / steps) - inset, Math.round(ay + (by - ay) * i / steps) - inset, size, size)
    }
  }

  function leg([hip, knee, ankle]: Limb, near: boolean) {
    line(outline, hip, knee, 7)
    line(outline, knee, ankle, 5)
    line(near ? person.skin : person.shade, knee, ankle, 3)
    line(near ? kit.shortsLight : kit.shorts, hip, knee, 5)
    const [fx, fy] = ankle
    box(outline, fx - 3, fy - 2, 7, 3)
    box(outline, fx - 2, fy + 1, 8, 2)
    box(near ? white : '#bbabba', fx - 2, fy - 1, 4, 2)
    box(near ? white : '#bbabba', fx - 1, fy + 1, 6, 1)
    box(kit.light, fx + 1, fy, 2, 1)
  }

  function arm([shoulder, elbow, hand]: Limb, near: boolean) {
    line(outline, shoulder, elbow, 6)
    line(outline, elbow, hand, 5)
    line(near ? person.skin : person.shade, shoulder, elbow, 4)
    line(near ? person.skin : person.shade, elbow, hand, 3)
    const [hx, hy] = hand
    if (near) box(person.light, hx, hy - 1, 1, 2)
    const [sx, sy] = shoulder
    box(near ? kit.light : kit.shade, sx - 1, sy - 1, 3, 2)
  }

  const torso = (color: string, points: readonly Point[]) => shape(color, points.map(([px, py]) => [px + x, py + y]))
  const detail = (color: string, px: number, py: number, width: number, height: number) => box(color, px + x, py + y, width, height)

  leg(farLeg, false)
  leg(nearLeg, true)
  arm(farArm, false)

  torso(outline, [[14, 20], [23, 20], [27, 23], [26, 33], [23, 35], [15, 35], [12, 31], [12, 24]])
  torso(kit.main, [[15, 21], [23, 21], [26, 24], [24, 32], [15, 33], [13, 30], [13, 24]])
  torso(kit.shade, [[23, 22], [26, 24], [24, 32], [15, 33], [15, 31], [22, 30]])
  detail(kit.light, 15, 22, 6, 1)
  detail(white, 19, 25, 3, 1)
  detail(white, 20, 26, 2, 2)
  detail(white, 19, 28, 3, 1)
  detail(kit.light, 16, 31, 5, 1)
  detail(outline, 17, 18, 7, 4)
  detail(person.shade, 18, 18, 5, 3)
  detail(person.skin, 20, 19, 3, 2)

  if (person.style === 'bun') {
    torso(outline, [[12, 4], [11, 2], [7, 2], [5, 5], [5, 9], [8, 11], [13, 9]])
    torso(person.hair, [[11, 4], [8, 3], [6, 5], [6, 8], [8, 10], [12, 8]])
    detail(person.sheen, 7, 5, 2, 2)
    detail(kit.light, 11, 7, 2, 2)
  }

  torso(outline, [[14, 5], [23, 4], [27, 6], [29, 10], [28, 12], [31, 14], [31, 16], [29, 17], [28, 20], [24, 22], [16, 21], [12, 18], [10, 14], [10, 10]])
  torso(person.shade, [[13, 8], [23, 6], [27, 8], [28, 13], [30, 15], [28, 16], [27, 19], [24, 20], [16, 20], [13, 17], [11, 13]])
  torso(person.skin, [[17, 8], [24, 7], [27, 9], [27, 13], [30, 15], [28, 16], [27, 19], [23, 20], [18, 18], [15, 14]])
  detail(person.light, 21, 9, 5, 2)
  detail(person.light, 22, 16, 4, 1)
  detail(person.light, 28, 14, 1, 1)
  detail(person.skin, 14, 14, 3, 3)
  detail(person.light, 14, 14, 1, 1)
  detail(person.shade, 15, 15, 1, 1)
  detail(outline, 23, 12, 3, 1)
  detail(outline, 24, 13, 2, 1)
  detail(person.shade, 24, 17, 3, 1)

  const hair = person.style
  if (hair === 'curl') {
    torso(outline, [[10, 12], [8, 9], [10, 5], [12, 4], [13, 2], [18, 3], [20, 2], [25, 3], [28, 4], [28, 9], [25, 11], [18, 10], [16, 13], [11, 15]])
    torso(person.hair, [[10, 9], [11, 5], [15, 3], [19, 4], [22, 2], [26, 4], [27, 8], [24, 9], [17, 9], [14, 12], [11, 13]])
    detail(person.sheen, 12, 5, 4, 2)
    detail(person.sheen, 20, 4, 4, 2)
    detail(person.sheen, 16, 7, 3, 1)
  } else {
    torso(outline, [[10, 14], [9, 10], [11, 6], [15, 3], [23, 3], [27, 5], [29, 8], [27, 11], [19, 10], [16, 14], [13, 14], [12, 16]])
    torso(person.hair, [[11, 13], [10, 10], [12, 6], [16, 4], [23, 4], [26, 6], [28, 8], [26, 10], [19, 9], [15, 13], [13, 12], [12, 15]])
    detail(person.sheen, 14, 6, 7, 1)
    detail(person.sheen, 12, 8, 4, 1)
    if (hair === 'band') {
      detail(kit.shade, 11, 10, 5, 3)
      detail(white, 11, 10, 5, 1)
      detail(white, 16, 9, 9, 1)
      detail(kit.light, 25, 9, 2, 1)
    }
    if (hair === 'swept') {
      torso(person.sheen, [[15, 6], [21, 4], [26, 5], [23, 6], [20, 6], [15, 8]])
      detail(person.hair, 26, 9, 2, 3)
    }
  }

  arm(nearArm, true)
  return canvas
}
