export type DragonCanvasRenderState = {
  x: number;
  y: number;
  heading: number;
  scale: number;
  viewportWidth: number;
  bodyX: Float32Array;
  bodyY: Float32Array;
  stationCount: number;
  motionAmount: number;
  wingPhase: number;
  isDark: boolean;
};

type Point = { x: number; y: number };

type SpineStation = Point & {
  angle: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  width: number;
  t: number;
};

type Palette = {
  body: string;
  bodyEdge: string;
  shadow: string;
  plane: string;
  shoulder: string;
  membrane: string;
  membraneLight: string;
  membraneShadow: string;
  membraneEdge: string;
  highlight: string;
  glow: string;
  eye: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const wrapAngle = (angle: number) => {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
};

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Canvas-only visual layer for the dragon. Its source is the controller's
 * sampled head-to-tail trail; it never participates in collision decisions.
 */
export class DragonProceduralRenderer {
  private stations: SpineStation[] = [];

  draw(ctx: CanvasRenderingContext2D, state: DragonCanvasRenderState) {
    this.stations = this.buildStations(state);
    if (this.stations.length < 4) return;

    const palette = this.palette(state.isDark);
    const origin = this.stations[0];
    const renderScale = state.viewportWidth >= 1024 ? 1.27 : 1;

    ctx.save();
    if (renderScale !== 1) {
      ctx.translate(origin.x, origin.y);
      ctx.scale(renderScale, renderScale);
      ctx.translate(-origin.x, -origin.y);
    }
    if (!state.isDark) ctx.globalAlpha = 0.88;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Appendages sit behind the unbroken torso silhouette.
    this.drawFoldedLimbs(ctx, state, palette);
    this.drawWings(ctx, state, palette);
    this.drawBody(ctx, palette);
    this.drawAnatomicalLayers(ctx, state, palette);
    this.drawWingRootPlates(ctx, state.scale, palette);
    this.drawTailTip(ctx, state, palette);
    this.drawHead(ctx, state, palette);
    ctx.restore();
  }

  private palette(isDark: boolean): Palette {
    return isDark
      ? {
        body: 'rgba(18, 37, 70, 0.97)',
        bodyEdge: 'rgba(126, 185, 244, 0.9)',
        shadow: 'rgba(9, 22, 45, 0.96)',
        plane: 'rgba(43, 80, 133, 0.62)',
        shoulder: 'rgba(52, 98, 160, 0.68)',
        membrane: 'rgba(26, 57, 103, 0.86)',
        membraneLight: 'rgba(70, 116, 174, 0.3)',
        membraneShadow: 'rgba(8, 29, 63, 0.34)',
        membraneEdge: 'rgba(157, 211, 255, 0.86)',
        highlight: 'rgba(203, 234, 255, 0.92)',
        glow: 'rgba(121, 189, 255, 0.32)',
        eye: '#e5f6ff',
      }
      : {
        body: 'rgba(36, 65, 96, 0.52)',
        bodyEdge: 'rgba(53, 107, 159, 0.68)',
        shadow: 'rgba(24, 48, 75, 0.48)',
        plane: 'rgba(79, 118, 158, 0.38)',
        shoulder: 'rgba(83, 127, 173, 0.42)',
        membrane: 'rgba(64, 105, 148, 0.48)',
        membraneLight: 'rgba(104, 147, 188, 0.2)',
        membraneShadow: 'rgba(37, 73, 111, 0.2)',
        membraneEdge: 'rgba(68, 122, 175, 0.66)',
        highlight: 'rgba(108, 159, 207, 0.76)',
        glow: 'rgba(74, 132, 190, 0.18)',
        eye: '#e9f7ff',
      };
  }

  /**
   * Resample the simulation trail into an unbroken anatomical centerline.
   * A cubic Hermite spline bridges the head cranium base into the shoulder
   * frame with continuous C1 tangent and curvature matching.
   */
  private buildStations(state: DragonCanvasRenderState) {
    const visualCount = state.viewportWidth < 1024 ? 44 : 64;
    const stations: SpineStation[] = [];
    const sourceLast = Math.max(1, state.stationCount - 1);
    const maxWidth = 24 * state.scale;
    const neckEndT = 0.18;
    const size = 1.2 * state.scale;

    // Head connection point at cranium base
    const headBaseX = state.x - 13.5 * size * Math.cos(state.heading);
    const headBaseY = state.y - 13.5 * size * Math.sin(state.heading);
    const headTangentX = Math.cos(state.heading);
    const headTangentY = Math.sin(state.heading);

    // Shoulder anchor from the body simulation
    const shoulderPosition = neckEndT * sourceLast;
    const shoulderX = this.sampleCatmull(state.bodyX, state.stationCount, shoulderPosition);
    const shoulderY = this.sampleCatmull(state.bodyY, state.stationCount, shoulderPosition);
    const shoulderDx = this.sampleCatmullDerivative(state.bodyX, state.stationCount, shoulderPosition);
    const shoulderDy = this.sampleCatmullDerivative(state.bodyY, state.stationCount, shoulderPosition);
    const shoulderMag = Math.hypot(shoulderDx, shoulderDy) || 1;
    const shoulderTangentX = -shoulderDx / shoulderMag;
    const shoulderTangentY = -shoulderDy / shoulderMag;

    const neckSpan = Math.hypot(shoulderX - headBaseX, shoulderY - headBaseY) || 1;
    const v0x = -headTangentX * neckSpan;
    const v0y = -headTangentY * neckSpan;
    const v1x = -shoulderTangentX * neckSpan;
    const v1y = -shoulderTangentY * neckSpan;

    for (let index = 0; index < visualCount; index += 1) {
      const t = index / (visualCount - 1);
      let x: number;
      let y: number;
      let tangentX: number;
      let tangentY: number;

      if (t < neckEndT) {
        // Cubic Hermite spline bridging head cranium base into shoulder frame
        const u = t / neckEndT;
        const u2 = u * u;
        const u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1;
        const h10 = u3 - 2 * u2 + u;
        const h01 = -2 * u3 + 3 * u2;
        const h11 = u3 - u2;

        x = h00 * headBaseX + h10 * v0x + h01 * shoulderX + h11 * v1x;
        y = h00 * headBaseY + h10 * v0y + h01 * shoulderY + h11 * v1y;

        const dh00 = 6 * u2 - 6 * u;
        const dh10 = 3 * u2 - 4 * u + 1;
        const dh01 = -6 * u2 + 6 * u;
        const dh11 = 3 * u2 - 2 * u;

        const dx = dh00 * headBaseX + dh10 * v0x + dh01 * shoulderX + dh11 * v1x;
        const dy = dh00 * headBaseY + dh10 * v0y + dh01 * shoulderY + dh11 * v1y;
        const magnitude = Math.hypot(dx, dy) || 1;
        tangentX = -dx / magnitude;
        tangentY = -dy / magnitude;
      } else {
        // Body and tail trail from simulation
        const sourcePosition = t * sourceLast;
        x = this.sampleCatmull(state.bodyX, state.stationCount, sourcePosition);
        y = this.sampleCatmull(state.bodyY, state.stationCount, sourcePosition);
        const dx = this.sampleCatmullDerivative(state.bodyX, state.stationCount, sourcePosition);
        const dy = this.sampleCatmullDerivative(state.bodyY, state.stationCount, sourcePosition);
        const magnitude = Math.hypot(dx, dy) || 1;
        tangentX = -dx / magnitude;
        tangentY = -dy / magnitude;
      }

      stations.push({
        x,
        y,
        angle: Math.atan2(tangentY, tangentX),
        tangentX,
        tangentY,
        normalX: -tangentY,
        normalY: tangentX,
        width: this.widthAt(t, maxWidth),
        t,
      });
    }

    // Pinch width slightly on extreme bends to prevent contour folding
    for (let index = 1; index < stations.length - 1; index += 1) {
      const previous = stations[index - 1];
      const current = stations[index];
      const next = stations[index + 1];
      const span = Math.max(0.001, distance(previous, next));
      const bend = Math.abs(wrapAngle(next.angle - previous.angle));
      const curvature = bend / span;
      if (curvature > 0.0001) current.width = Math.min(current.width, 0.82 / curvature);
    }

    return stations;
  }

  private sampleCatmull(values: Float32Array, count: number, position: number) {
    const base = Math.floor(clamp(position, 0, count - 1));
    const t = clamp(position - base, 0, 1);
    const at = (index: number) => values[clamp(index, 0, count - 1)];
    const p0 = at(base - 1);
    const p1 = at(base);
    const p2 = at(base + 1);
    const p3 = at(base + 2);
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      2 * p1
      + (-p0 + p2) * t
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
      + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  private sampleCatmullDerivative(values: Float32Array, count: number, position: number) {
    const base = Math.floor(clamp(position, 0, count - 1));
    const t = clamp(position - base, 0, 1);
    const at = (index: number) => values[clamp(index, 0, count - 1)];
    const p0 = at(base - 1);
    const p1 = at(base);
    const p2 = at(base + 1);
    const p3 = at(base + 2);
    return 0.5 * (
      (-p0 + p2)
      + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t
      + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t * t
    );
  }

  /** Anatomical width, parameterized strictly by distance along the spine. */
  private widthAt(t: number, maximum: number) {
    const profile: Array<[number, number]> = [
      [0, 0.18], // cranium base connection (matches 3.6 * 1.2 = 4.32 / 24)
      [0.06, 0.22], // slender athletic neck column
      [0.12, 0.38], // smooth gradual expansion toward shoulder
      [0.18, 0.78], // strong restrained shoulder frame
      [0.26, 0.86], // chest anatomical high point
      [0.42, 0.64], // slender central torso
      [0.60, 0.45], // hip frame
      [0.70, 0.38], // smooth transition to tail base
      [0.86, 0.18], // mid tail
      [0.97, 0.045], // tapered tail filament
      [1, 0.012], // tip
    ];

    for (let index = 1; index < profile.length; index += 1) {
      const [endT, endWidth] = profile[index];
      if (t <= endT) {
        const [startT, startWidth] = profile[index - 1];
        const blend = smoothstep((t - startT) / (endT - startT));
        return (startWidth + (endWidth - startWidth) * blend) * maximum;
      }
    }
    return profile[profile.length - 1][1] * maximum;
  }

  private pointOnStation(station: SpineStation, forward: number, sideways: number): Point {
    return {
      x: station.x + station.tangentX * forward + station.normalX * sideways,
      y: station.y + station.tangentY * forward + station.normalY * sideways,
    };
  }

  /** One closed, Catmull-Rom-equivalent cubic path for the complete silhouette. */
  private drawBody(ctx: CanvasRenderingContext2D, palette: Palette) {
    const right: Point[] = [];
    const left: Point[] = [];
    for (const station of this.stations) {
      right.push(this.pointOnStation(station, 0, -station.width));
      left.push(this.pointOnStation(station, 0, station.width));
    }

    // Required contour ordering: right head -> tail, then left tail -> head.
    const contour = [...right, ...left.reverse()];
    ctx.beginPath();
    this.traceClosedSpline(ctx, contour);
    ctx.fillStyle = palette.body;
    ctx.strokeStyle = palette.bodyEdge;
    ctx.lineWidth = 1.1;
    ctx.fill();
    ctx.stroke();
  }

  private traceClosedSpline(ctx: CanvasRenderingContext2D, points: Point[]) {
    if (points.length < 3) return;
    const count = points.length;
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 0; index < count; index += 1) {
      const p0 = points[(index - 1 + count) % count];
      const p1 = points[index];
      const p2 = points[(index + 1) % count];
      const p3 = points[(index + 2) % count];
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6,
        p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,
        p2.y - (p3.y - p1.y) / 6,
        p2.x,
        p2.y,
      );
    }
    ctx.closePath();
  }

  private traceOpenSpline(ctx: CanvasRenderingContext2D, points: Point[]) {
    if (points.length < 2) return;
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 0; index < points.length - 1; index += 1) {
      const p0 = points[Math.max(0, index - 1)];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[Math.min(points.length - 1, index + 2)];
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6,
        p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,
        p2.y - (p3.y - p1.y) / 6,
        p2.x,
        p2.y,
      );
    }
  }

  private drawAnatomicalLayers(ctx: CanvasRenderingContext2D, state: DragonCanvasRenderState, palette: Palette) {
    // These stay within the main contour: additional anatomy, never extra width.
    this.drawRibbon(ctx, 0.09, 0.7, 0.67, palette.plane, 'rgba(126, 185, 244, 0.14)');
    this.drawRibbon(ctx, 0.12, 0.37, 0.77, palette.shoulder, 'rgba(167, 216, 255, 0.2)');
    this.drawRibbon(ctx, 0.2, 0.55, 0.4, palette.shoulder, 'rgba(183, 224, 255, 0.16)');
    this.drawRibbon(ctx, 0.48, 0.73, 0.43, palette.plane, 'rgba(126, 185, 244, 0.14)');
    this.drawLateralTorsoPlanes(ctx, palette);
    this.drawDorsalRidge(ctx, state.scale, palette);
    this.drawTailSidePlanes(ctx, palette);
  }

  private drawRibbon(
    ctx: CanvasRenderingContext2D,
    startT: number,
    endT: number,
    widthFactor: number,
    fill: string,
    edge: string,
  ) {
    const selected = this.stations.filter((station) => station.t >= startT && station.t <= endT);
    if (selected.length < 3) return;
    const right = selected.map((station) => this.pointOnStation(station, 0, -station.width * widthFactor));
    const left = selected.map((station) => this.pointOnStation(station, 0, station.width * widthFactor)).reverse();
    ctx.beginPath();
    this.traceClosedSpline(ctx, [...right, ...left]);
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.65;
    ctx.fill();
    ctx.stroke();
  }

  private drawLateralTorsoPlanes(ctx: CanvasRenderingContext2D, palette: Palette) {
    for (const side of [-1, 1]) {
      this.drawSidePlane(ctx, 0.16, 0.64, side, 0.12, 0.72, palette.plane, 'rgba(178, 220, 255, 0.16)');
      this.drawSidePlane(ctx, 0.17, 0.39, side, 0.3, 0.86, palette.shoulder, 'rgba(191, 226, 255, 0.2)');
    }
  }

  private drawTailSidePlanes(ctx: CanvasRenderingContext2D, palette: Palette) {
    for (const side of [-1, 1]) {
      this.drawSidePlane(ctx, 0.6, 0.95, side, 0.12, 0.64, palette.plane, 'rgba(159, 207, 250, 0.16)');
    }
  }

  private drawSidePlane(
    ctx: CanvasRenderingContext2D,
    startT: number,
    endT: number,
    side: number,
    innerFactor: number,
    outerFactor: number,
    fill: string,
    edge: string,
  ) {
    const selected = this.stations.filter((station) => station.t >= startT && station.t <= endT);
    if (selected.length < 3) return;
    const inner = selected.map((station) => this.pointOnStation(station, 0, side * station.width * innerFactor));
    const outer = selected.map((station) => this.pointOnStation(station, 0, side * station.width * outerFactor)).reverse();
    ctx.beginPath();
    this.traceClosedSpline(ctx, [...inner, ...outer]);
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.45;
    ctx.fill();
    ctx.stroke();
  }

  private drawDorsalRidge(ctx: CanvasRenderingContext2D, scale: number, palette: Palette) {
    const dorsalStations = this.stations.filter((station) => station.t >= 0.055 && station.t <= 0.93);
    const left: Point[] = [];
    const right: Point[] = [];
    const centers: Point[] = [];
    for (const station of dorsalStations) {
      const taper = 1 - Math.max(0, station.t - 0.46) * 0.72;
      const ridgeWidth = Math.min(station.width * 0.18, 2.6 * scale) * taper;
      left.push(this.pointOnStation(station, 0, ridgeWidth));
      right.push(this.pointOnStation(station, 0, -ridgeWidth));
      centers.push(this.pointOnStation(station, 0, 0));
    }
    if (centers.length < 3) return;

    ctx.beginPath();
    this.traceClosedSpline(ctx, [...right, ...left.reverse()]);
    ctx.fillStyle = palette.shoulder;
    ctx.strokeStyle = 'rgba(191, 228, 255, 0.26)';
    ctx.lineWidth = 0.55 * scale;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    this.traceOpenSpline(ctx, centers);
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 3.1 * scale;
    ctx.stroke();
    ctx.strokeStyle = palette.highlight;
    ctx.lineWidth = 0.78 * scale;
    ctx.stroke();

    const ridgeTs = [0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.36, 0.43, 0.51, 0.6, 0.69, 0.78, 0.87];
    for (const t of ridgeTs) this.drawRidgePlate(ctx, this.stationAt(t), scale, palette);
  }

  private drawRidgePlate(ctx: CanvasRenderingContext2D, station: SpineStation, scale: number, palette: Palette) {
    const length = (2.2 + (1 - station.t) * 2.4) * scale;
    const halfWidth = Math.max(0.9 * scale, Math.min(station.width * 0.19, 2.2 * scale));
    const tip = this.pointOnStation(station, length * 0.76, 0);
    const frontLeft = this.pointOnStation(station, length * 0.18, halfWidth);
    const backLeft = this.pointOnStation(station, -length * 0.42, halfWidth * 0.82);
    const tail = this.pointOnStation(station, -length * 0.7, 0);
    const backRight = this.pointOnStation(station, -length * 0.42, -halfWidth * 0.82);
    const frontRight = this.pointOnStation(station, length * 0.18, -halfWidth);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(frontLeft.x, frontLeft.y);
    ctx.lineTo(backLeft.x, backLeft.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.lineTo(backRight.x, backRight.y);
    ctx.lineTo(frontRight.x, frontRight.y);
    ctx.closePath();
    ctx.fillStyle = palette.shoulder;
    ctx.strokeStyle = 'rgba(180, 223, 255, 0.34)';
    ctx.lineWidth = 0.5 * scale;
    ctx.fill();
    ctx.stroke();
  }

  private drawFoldedLimbs(ctx: CanvasRenderingContext2D, state: DragonCanvasRenderState, palette: Palette) {
    const anchors: Array<[number, boolean]> = [[0.22, true], [0.56, false]];
    for (const [t, isFront] of anchors) {
      const station = this.stationAt(t);
      const limbPulse = Math.sin(state.wingPhase * 0.65 + t * 8) * state.motionAmount * 0.8 * state.scale;
      for (const side of [-1, 1]) {
        const root = this.pointOnStation(station, (isFront ? -1 : -3) * state.scale, side * station.width * 0.7);
        const elbow = this.pointOnStation(
          station,
          (isFront ? 5 : -8) * state.scale,
          side * (station.width + (isFront ? 8 : 7) * state.scale + limbPulse),
        );
        const claw = this.pointOnStation(
          station,
          (isFront ? 9 : -13) * state.scale,
          side * (station.width + (isFront ? 4.5 : 3.5) * state.scale + limbPulse * 0.5),
        );
        this.drawTaperedLimb(ctx, root, elbow, 3.2 * state.scale, 2.2 * state.scale, palette);
        this.drawTaperedLimb(ctx, elbow, claw, 2.25 * state.scale, 1.25 * state.scale, palette);
      }
    }
  }

  private drawTaperedLimb(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    startWidth: number,
    endWidth: number,
    palette: Palette,
  ) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    ctx.beginPath();
    ctx.moveTo(start.x + nx * startWidth, start.y + ny * startWidth);
    ctx.lineTo(end.x + nx * endWidth, end.y + ny * endWidth);
    ctx.lineTo(end.x - nx * endWidth, end.y - ny * endWidth);
    ctx.lineTo(start.x - nx * startWidth, start.y - ny * startWidth);
    ctx.closePath();
    ctx.fillStyle = palette.shadow;
    ctx.strokeStyle = palette.bodyEdge;
    ctx.lineWidth = 0.8;
    ctx.fill();
    ctx.stroke();
  }

  private drawWings(ctx: CanvasRenderingContext2D, state: DragonCanvasRenderState, palette: Palette) {
    const shoulder = this.stationAt(0.18);
    const bend = wrapAngle(this.stations[0].angle - shoulder.angle);
    const outerSide = bend >= 0 ? -1 : 1;
    const turnAmount = clamp(Math.abs(bend) / 1.25, 0, 1);
    const flap = Math.sin(state.wingPhase);
    const easedFlap = flap * (0.78 + Math.abs(flap) * 0.22);
    const amplitude = state.motionAmount * (5 + 6 * state.scale);

    for (const side of [-1, 1]) {
      const isOuter = side === outerSide;
      const openness = 1 + (isOuter ? 0.16 : -0.07) * turnAmount;
      const pulse = easedFlap * amplitude;
      this.drawWing(ctx, shoulder, side, openness, pulse, state.scale, palette);
    }
  }

  private drawWing(
    ctx: CanvasRenderingContext2D,
    shoulder: SpineStation,
    side: number,
    openness: number,
    flap: number,
    scale: number,
    palette: Palette,
  ) {
    const span = 62 * scale * openness;
    const root = this.pointOnStation(shoulder, -1 * scale, side * shoulder.width * 0.48);
    const inner = this.pointOnStation(shoulder, -4 * scale - flap * 0.18, side * (shoulder.width + span * 0.24));
    const middle = this.pointOnStation(shoulder, -15 * scale - flap * 0.48, side * (shoulder.width + span * 0.61));
    const tip = this.pointOnStation(shoulder, -32 * scale - flap * 0.76, side * (shoulder.width + span));
    const lowerOuter = this.pointOnStation(shoulder, -45 * scale + flap * 0.6, side * (shoulder.width + span * 0.72));
    const lowerInner = this.pointOnStation(shoulder, -22 * scale + flap * 0.34, side * (shoulder.width + span * 0.28));

    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(inner.x, inner.y, middle.x, middle.y);
    ctx.quadraticCurveTo(tip.x, tip.y, lowerOuter.x, lowerOuter.y);
    ctx.quadraticCurveTo(lowerInner.x, lowerInner.y, root.x, root.y);
    ctx.closePath();
    ctx.fillStyle = palette.membrane;
    ctx.strokeStyle = palette.membraneEdge;
    ctx.lineWidth = 1.15 * scale;
    ctx.fill();
    ctx.stroke();

    // Leading edge and three flexible ribs share the shoulder frame but have
    // independent anchors, avoiding a single rigid-triangle appearance.
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(inner.x, inner.y, middle.x, middle.y);
    ctx.quadraticCurveTo(tip.x, tip.y, tip.x, tip.y);
    ctx.strokeStyle = palette.highlight;
    ctx.lineWidth = 1.55 * scale;
    ctx.stroke();

    const trailing = [lowerInner, lowerOuter, tip];
    const ribs = [inner, middle, tip];
    ctx.beginPath();
    for (let index = 0; index < ribs.length; index += 1) {
      const rib = ribs[index];
      const end = trailing[index];
      ctx.moveTo(root.x, root.y);
      ctx.quadraticCurveTo(rib.x, rib.y, end.x, end.y);
    }
    ctx.strokeStyle = 'rgba(177, 221, 255, 0.5)';
    ctx.lineWidth = 0.7 * scale;
    ctx.stroke();
  }

  private drawWingRootPlates(ctx: CanvasRenderingContext2D, scale: number, palette: Palette) {
    const shoulder = this.stationAt(0.18);
    for (const side of [-1, 1]) {
      const outer = this.pointOnStation(shoulder, -3 * scale, side * shoulder.width * 1.02);
      const rear = this.pointOnStation(shoulder, -9 * scale, side * shoulder.width * 0.62);
      const inner = this.pointOnStation(shoulder, 3 * scale, side * shoulder.width * 0.4);
      ctx.beginPath();
      ctx.moveTo(outer.x, outer.y);
      ctx.lineTo(rear.x, rear.y);
      ctx.lineTo(inner.x, inner.y);
      ctx.closePath();
      ctx.fillStyle = palette.shoulder;
      ctx.strokeStyle = palette.bodyEdge;
      ctx.lineWidth = 0.75 * scale;
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawTailTip(ctx: CanvasRenderingContext2D, state: DragonCanvasRenderState, palette: Palette) {
    const tail = this.stations[this.stations.length - 1];
    const root = this.pointOnStation(tail, 0, 0);
    const upper = this.pointOnStation(tail, -5.2 * state.scale, 3.5 * state.scale);
    const tip = this.pointOnStation(tail, -10.5 * state.scale, 0);
    const lower = this.pointOnStation(tail, -5.2 * state.scale, -3.5 * state.scale);
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.lineTo(upper.x, upper.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(lower.x, lower.y);
    ctx.closePath();
    ctx.fillStyle = palette.plane;
    ctx.strokeStyle = palette.bodyEdge;
    ctx.lineWidth = 0.8 * state.scale;
    ctx.fill();
    ctx.stroke();
  }

  private drawHead(ctx: CanvasRenderingContext2D, state: DragonCanvasRenderState, palette: Palette) {
    const size = 1.2 * state.scale;
    const head = this.stations[0];
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.rotate(state.heading);

    // Swept horns are independent curved Canvas paths, set behind the skull.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-5.5 * size, side * 4.2 * size);
      ctx.bezierCurveTo(-9 * size, side * 8.4 * size, -14.5 * size, side * 10.5 * size, -18 * size, side * 11.5 * size);
      ctx.bezierCurveTo(-14.3 * size, side * 7.2 * size, -10 * size, side * 3.2 * size, -6.5 * size, side * 2.2 * size);
      ctx.closePath();
      ctx.fillStyle = palette.shadow;
      ctx.strokeStyle = palette.highlight;
      ctx.lineWidth = 0.85 * size;
      ctx.fill();
      ctx.stroke();
    }

    // Angular cranium, strong jawline, and tapered snout all share one skull.
    ctx.beginPath();
    ctx.moveTo(18 * size, 0);
    ctx.lineTo(13.4 * size, -2.2 * size);
    ctx.lineTo(9.2 * size, -5.1 * size);
    ctx.lineTo(1.8 * size, -6.8 * size);
    ctx.lineTo(-6.5 * size, -6.1 * size);
    ctx.lineTo(-12.3 * size, -3.6 * size);
    ctx.lineTo(-14 * size, 0);
    ctx.lineTo(-12.3 * size, 3.6 * size);
    ctx.lineTo(-6.5 * size, 6.1 * size);
    ctx.lineTo(1.8 * size, 6.8 * size);
    ctx.lineTo(9.2 * size, 5.1 * size);
    ctx.lineTo(13.4 * size, 2.2 * size);
    ctx.closePath();
    ctx.fillStyle = palette.body;
    ctx.strokeStyle = palette.bodyEdge;
    ctx.lineWidth = 1.2 * size;
    ctx.fill();
    ctx.stroke();

    // Brow plates and a lower jaw facet prevent the head from reading as a
    // pasted-on icon while still keeping it rigid-ish.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(11.8 * size, side * 1.7 * size);
      ctx.lineTo(5.5 * size, side * 4.9 * size);
      ctx.lineTo(-4.5 * size, side * 4.8 * size);
      ctx.lineTo(1.8 * size, side * 1.8 * size);
      ctx.closePath();
      ctx.fillStyle = palette.plane;
      ctx.strokeStyle = 'rgba(173, 219, 255, 0.42)';
      ctx.lineWidth = 0.65 * size;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(6.3 * size, side * 3.1 * size);
      ctx.lineTo(4.2 * size, side * 4.15 * size);
      ctx.lineTo(3.2 * size, side * 3.35 * size);
      ctx.closePath();
      ctx.fillStyle = palette.eye;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(16.5 * size, 0);
    ctx.lineTo(10.5 * size, -1.35 * size);
    ctx.lineTo(6.7 * size, 0);
    ctx.lineTo(10.5 * size, 1.35 * size);
    ctx.closePath();
    ctx.fillStyle = palette.shoulder;
    ctx.strokeStyle = palette.highlight;
    ctx.lineWidth = 0.65 * size;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Articulated chevron collar plate bridging the cranium base into the neck
    const s0 = this.stations[0];
    const s1 = this.stations[Math.min(2, this.stations.length - 1)];
    const scuteFront = this.pointOnStation(s0, 3.5 * size, 0);
    const scuteLeft = this.pointOnStation(s0, -1.2 * size, s0.width * 0.92);
    const scuteRight = this.pointOnStation(s0, -1.2 * size, -s0.width * 0.92);
    const scuteBack = this.pointOnStation(s1, -1 * size, 0);
    ctx.beginPath();
    ctx.moveTo(scuteFront.x, scuteFront.y);
    ctx.lineTo(scuteLeft.x, scuteLeft.y);
    ctx.lineTo(scuteBack.x, scuteBack.y);
    ctx.lineTo(scuteRight.x, scuteRight.y);
    ctx.closePath();
    ctx.fillStyle = palette.shoulder;
    ctx.strokeStyle = palette.highlight;
    ctx.lineWidth = 0.65 * size;
    ctx.fill();
    ctx.stroke();
  }

  private stationAt(t: number) {
    const index = Math.round(clamp(t, 0, 1) * (this.stations.length - 1));
    return this.stations[index];
  }
}

type PreviewPose = 'straight' | 'shallow curve' | '45 degree turn' | '90 degree turn' | 'S curve' | 'circle' | 'figure eight';

/** Development helper used by dragon-geometry-preview.html. */
export function drawDragonGeometryPreview(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Use known target dimensions. Set them on the element first so layout
  // resolves correctly (important for headless / ResizeObserver at zero size).
  const TARGET_W = 1040;
  const TARGET_H = 720;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width > 4 ? rect.width : TARGET_W;
  const cssHeight = rect.height > 4 ? rect.height : TARGET_H;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Fill background so the canvas is visibly non-empty even if geometry clips.
  ctx.fillStyle = '#071d38';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const names: PreviewPose[] = ['straight', 'shallow curve', '45 degree turn', '90 degree turn', 'S curve', 'circle', 'figure eight'];
  const columns = cssWidth < 760 ? 1 : cssWidth < 960 ? 2 : 3;
  const cellWidth = cssWidth / columns;
  const cellHeight = cssHeight / Math.ceil(names.length / columns);
  const renderer = new DragonProceduralRenderer();

  names.forEach((name, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const centerX = column * cellWidth + cellWidth * 0.56;
    const centerY = row * cellHeight + cellHeight * 0.5;
    const state = createPreviewState(name, centerX, centerY, Math.min(cellWidth, cellHeight) / 360);
    renderer.draw(ctx, state);
    ctx.fillStyle = '#9ec8ef';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(name.toUpperCase(), column * cellWidth + 16, row * cellHeight + 22);
  });
}

function createPreviewState(pose: PreviewPose, centerX: number, centerY: number, scale: number): DragonCanvasRenderState {
  const count = 33;
  const spacing = 8.2 * scale;
  const bodyX = new Float32Array(count);
  const bodyY = new Float32Array(count);
  const length = (count - 1) * spacing;

  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const local = previewPoint(pose, t, length);
    bodyX[index] = centerX + local.x;
    bodyY[index] = centerY + local.y;
  }
  const dx = bodyX[0] - bodyX[1];
  const dy = bodyY[0] - bodyY[1];
  return {
    x: bodyX[0],
    y: bodyY[0],
    heading: Math.atan2(dy, dx),
    scale,
    viewportWidth: 1200,
    bodyX,
    bodyY,
    stationCount: count,
    motionAmount: 0.46,
    wingPhase: 0.8,
    isDark: true,
  };
}

function previewPoint(pose: PreviewPose, t: number, length: number): Point {
  const back = t * length;
  switch (pose) {
    case 'straight':
      return { x: length * 0.46 - back, y: 0 };
    case 'shallow curve':
      return { x: length * 0.42 - back, y: Math.sin(t * Math.PI) * length * 0.16 };
    case '45 degree turn': {
      const angle = t * Math.PI * 0.27;
      const radius = length / (Math.PI * 0.27);
      return { x: length * 0.43 - Math.sin(angle) * radius, y: -radius + Math.cos(angle) * radius };
    }
    case '90 degree turn': {
      const angle = t * Math.PI * 0.52;
      const radius = length / (Math.PI * 0.52);
      return { x: length * 0.4 - Math.sin(angle) * radius, y: -radius + Math.cos(angle) * radius };
    }
    case 'S curve':
      return { x: length * 0.46 - back, y: Math.sin(t * Math.PI * 2) * length * 0.18 };
    case 'circle': {
      const angle = -Math.PI * 0.12 + t * Math.PI * 1.66;
      const radius = length / (Math.PI * 1.66);
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
    case 'figure eight': {
      const angle = -Math.PI * 0.22 + t * Math.PI * 2.12;
      const radius = length / 4.5;
      return { x: Math.sin(angle) * radius, y: Math.sin(angle * 2) * radius * 0.58 };
    }
  }
}
