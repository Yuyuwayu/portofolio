import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { DragonParticleInteraction, type DragonInteractionFrame } from './useDragonParticleInteraction';

type Rect = { left: number; top: number; right: number; bottom: number };

const HISTORY_SIZE = 1024;
const MAX_BODY_POINTS = 40;

class DragonController {
  private readonly historyX = new Float32Array(HISTORY_SIZE);
  private readonly historyY = new Float32Array(HISTORY_SIZE);
  private readonly bodyX = new Float32Array(MAX_BODY_POINTS);
  private readonly bodyY = new Float32Array(MAX_BODY_POINTS);
  private readonly bodyAngle = new Float32Array(MAX_BODY_POINTS);
  private readonly bodyRadius = new Float32Array(MAX_BODY_POINTS);
  private readonly interactionFrame: DragonInteractionFrame = {
    x: 0,
    y: 0,
    scale: 1,
    renderScale: 1,
    bodyAngle: this.bodyAngle,
    bodyX: this.bodyX,
    bodyY: this.bodyY,
    bodyRadius: this.bodyRadius,
    stationCount: 0,
    frontCount: 0,
    bodySpacing: 1,
    hasMoved: false,
  };
  private readonly leftX = new Float32Array(MAX_BODY_POINTS);
  private readonly leftY = new Float32Array(MAX_BODY_POINTS);
  private readonly rightX = new Float32Array(MAX_BODY_POINTS);
  private readonly rightY = new Float32Array(MAX_BODY_POINTS);
  private readonly point = { x: 0, y: 0 };
  private readonly routeX = new Float32Array(3);
  private readonly routeY = new Float32Array(3);

  private historyIndex = 0;
  private trailCarry = 0;
  private routeCount = 0;
  private routeIndex = 0;
  private targetX = 0;
  private targetY = 0;
  private safeRect: Rect | null = null;
  private safePositionInitialized = false;
  private width: number;
  private height: number;
  private scale: number;
  private pointSpacing: number;
  private bodySpacing: number;
  private stationCount: number;
  private maxSpeed: number;
  private angle = -Math.PI / 2;
  private speed = 0;
  private travelPhase = 0;
  private motionAmount = 0;
  private hasMoved = false;
  private isTracking = false;
  private isDark: boolean;

  x: number;
  y: number;

  constructor(width: number, height: number, isDark: boolean) {
    this.width = width;
    this.height = height;
    this.scale = width < 1024 ? 0.74 : 1;
    this.pointSpacing = 2.6 * this.scale;
    this.bodySpacing = (width < 1024 ? 7.5 : 8.4) * this.scale;
    this.stationCount = width < 1024 ? 27 : 33;
    this.maxSpeed = (width < 1024 ? 96 : 132) * this.scale;
    this.isDark = isDark;

    this.x = Math.min(width - 34 * this.scale, Math.max(width * 0.79, width - 410 * this.scale));
    this.y = height * 0.53;
    this.seedHistory();
  }

  setDarkMode(isDark: boolean) {
    this.isDark = isDark;
  }

  setSafeRect(rect: Rect | null) {
    this.safeRect = rect;
    const firstSafeRect = Boolean(rect && !this.safePositionInitialized);
    if (firstSafeRect) this.safePositionInitialized = true;
    if (rect && firstSafeRect && !this.hasMoved && !this.isTracking) {
      const openSideX = Math.min(this.width - 34 * this.scale, rect.right + 26 * this.scale);
      if (openSideX > this.x) {
        this.x = openSideX;
        this.seedHistory();
      }
    }
  }

  setTarget(x: number, y: number) {
    const safe = this.safeRect;
    if (safe && x >= safe.left && x <= safe.right && y >= safe.top && y <= safe.bottom) {
      x = Math.min(this.width - 12 * this.scale, safe.right + 16 * this.scale);
      y = Math.max(safe.top, Math.min(safe.bottom, y));
    }

    this.routeIndex = 0;
    if (safe && this.intersectsRect(this.x, this.y, x, y, safe)) {
      const pad = 12 * this.scale;
      const topY = Math.max(8 * this.scale, safe.top - pad);
      const bottomY = Math.min(this.height - 8 * this.scale, safe.bottom + pad);
      const rightX = Math.min(this.width - 8 * this.scale, safe.right + pad);
      const leftX = Math.max(8 * this.scale, safe.left - pad);

      const topLength = this.distance(this.x, this.y, rightX, topY)
        + rightX - leftX
        + this.distance(leftX, topY, x, y);
      const bottomLength = this.distance(this.x, this.y, rightX, bottomY)
        + rightX - leftX
        + this.distance(leftX, bottomY, x, y);

      if (topLength <= bottomLength) {
        this.routeX[0] = rightX;
        this.routeY[0] = topY;
        this.routeX[1] = leftX;
        this.routeY[1] = topY;
      } else {
        this.routeX[0] = rightX;
        this.routeY[0] = bottomY;
        this.routeX[1] = leftX;
        this.routeY[1] = bottomY;
      }
      this.routeX[2] = x;
      this.routeY[2] = y;
      this.routeCount = 3;
    } else {
      this.routeX[0] = x;
      this.routeY[0] = y;
      this.routeCount = 1;
    }

    this.isTracking = true;
  }

  clearTarget() {
    this.isTracking = false;
    this.routeCount = 0;
  }

  getInteractionFrame() {
    const frame = this.interactionFrame;
    frame.x = this.x;
    frame.y = this.y;
    frame.scale = this.scale;
    frame.renderScale = this.width >= 1024 ? 1.27 : 1;
    frame.stationCount = this.stationCount;
    frame.frontCount = Math.min(this.stationCount, Math.ceil(138 * this.scale / this.bodySpacing) + 1);
    frame.bodySpacing = this.bodySpacing;
    frame.hasMoved = this.hasMoved;
    return frame;
  }

  update(dt: number) {
    const acceleration = 175 * this.scale;
    const deceleration = 225 * this.scale;
    let desiredSpeed = 0;
    let headingError = 0;

    if (this.isTracking && this.routeCount > 0) {
      while (this.routeIndex < this.routeCount - 1) {
        const routeDistance = this.distance(this.x, this.y, this.routeX[this.routeIndex], this.routeY[this.routeIndex]);
        if (routeDistance > 16 * this.scale) break;
        this.routeIndex += 1;
      }

      this.targetX = this.routeX[this.routeIndex];
      this.targetY = this.routeY[this.routeIndex];
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.01) {
        const desiredAngle = Math.atan2(dy, dx);
        headingError = this.wrapAngle(desiredAngle - this.angle);
        const turnLimit = 2.05 * dt;
        this.angle += Math.max(-turnLimit, Math.min(turnLimit, headingError));
        const turnFactor = 0.48 + 0.52 * (1 - Math.min(Math.abs(headingError) / Math.PI, 1));
        const brakingSpeed = Math.sqrt(2 * deceleration * distance);
        desiredSpeed = Math.min(this.maxSpeed, distance * 2.25, brakingSpeed) * turnFactor;
      }
    }

    const rate = desiredSpeed > this.speed ? acceleration : deceleration;
    this.speed += Math.max(-rate * dt, Math.min(rate * dt, desiredSpeed - this.speed));
    if (this.speed < 0.04) this.speed = 0;

    const moveX = Math.cos(this.angle) * this.speed * dt;
    const moveY = Math.sin(this.angle) * this.speed * dt;
    const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveDistance > 0) {
      const oldX = this.x;
      const oldY = this.y;
      this.x += moveX;
      this.y += moveY;
      this.appendTrail(oldX, oldY, moveX, moveY, moveDistance);
      this.hasMoved = true;
      this.travelPhase += moveDistance * 0.055;
    }

    const desiredMotion = Math.min(1, this.speed / (46 * this.scale));
    const settle = 1 - Math.exp(-dt * 4.2);
    this.motionAmount += (desiredMotion - this.motionAmount) * settle;
    this.sampleBody();
  }

  needsAnimation() {
    if (this.speed > 0.08 || this.motionAmount > 0.012) return true;
    if (!this.isTracking || this.routeCount === 0) return false;
    return this.distance(this.x, this.y, this.routeX[this.routeIndex], this.routeY[this.routeIndex]) > 1.5;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const fill = this.isDark ? 'rgba(18, 35, 55, 0.96)' : 'rgba(34, 61, 88, 0.44)';
    const shadow = this.isDark ? 'rgba(9, 20, 34, 0.96)' : 'rgba(25, 47, 69, 0.42)';
    const edge = this.isDark ? 'rgba(105, 143, 177, 0.68)' : 'rgba(45, 88, 130, 0.56)';
    const detail = this.isDark ? 'rgba(137, 174, 199, 0.58)' : 'rgba(42, 105, 150, 0.46)';
    const bodyPlane = this.isDark ? 'rgba(38, 58, 80, 0.66)' : 'rgba(69, 98, 126, 0.34)';
    const shoulderPlane = this.isDark ? 'rgba(51, 71, 94, 0.48)' : 'rgba(78, 106, 133, 0.28)';
    const membrane = this.isDark ? 'rgba(45, 64, 86, 0.9)' : 'rgba(70, 103, 136, 0.42)';
    const membraneEdge = this.isDark ? 'rgba(123, 157, 184, 0.7)' : 'rgba(45, 88, 130, 0.5)';

    ctx.save();
    if (this.width >= 1024) {
      const renderScale = 1.27;
      ctx.translate(this.x, this.y);
      ctx.scale(renderScale, renderScale);
      ctx.translate(-this.x, -this.y);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    this.drawLegs(ctx, shadow, edge, detail);
    this.drawWings(ctx, membrane, membraneEdge, detail);
    this.drawBody(ctx, fill, edge);
    this.drawBodyLayers(ctx, bodyPlane, shoulderPlane, edge);
    this.drawTailFin(ctx, membrane, membraneEdge, detail);
    this.drawHead(ctx, fill, edge, detail);

    ctx.restore();
  }

  private seedHistory() {
    this.historyIndex = 0;
    this.trailCarry = 0;
    for (let i = 0; i < HISTORY_SIZE; i += 1) {
      const distance = i * this.pointSpacing;
      const index = (HISTORY_SIZE - i) % HISTORY_SIZE;
      this.historyX[index] = this.x - Math.cos(this.angle) * distance;
      this.historyY[index] = this.y - Math.sin(this.angle) * distance;
    }
    this.sampleBody();
  }

  private appendTrail(oldX: number, oldY: number, moveX: number, moveY: number, distance: number) {
    let consumed = 0;
    let toNextPoint = this.pointSpacing - this.trailCarry;

    while (consumed + toNextPoint <= distance) {
      consumed += toNextPoint;
      this.historyIndex = (this.historyIndex + 1) % HISTORY_SIZE;
      const fraction = consumed / distance;
      this.historyX[this.historyIndex] = oldX + moveX * fraction;
      this.historyY[this.historyIndex] = oldY + moveY * fraction;
      this.trailCarry = 0;
      toNextPoint = this.pointSpacing;
    }

    this.trailCarry += distance - consumed;
  }

  private sampleTrail(distance: number, out: { x: number; y: number }) {
    if (distance <= 0) {
      out.x = this.x;
      out.y = this.y;
      return;
    }

    if (distance <= this.trailCarry && this.trailCarry > 0) {
      const blend = distance / this.trailCarry;
      out.x = this.x + (this.historyX[this.historyIndex] - this.x) * blend;
      out.y = this.y + (this.historyY[this.historyIndex] - this.y) * blend;
      return;
    }

    const units = Math.max(0, (distance - this.trailCarry) / this.pointSpacing);
    const whole = Math.floor(units);
    const blend = units - whole;
    const newer = (this.historyIndex - whole + HISTORY_SIZE) % HISTORY_SIZE;
    const older = (newer - 1 + HISTORY_SIZE) % HISTORY_SIZE;
    out.x = this.historyX[newer] + (this.historyX[older] - this.historyX[newer]) * blend;
    out.y = this.historyY[newer] + (this.historyY[older] - this.historyY[newer]) * blend;
  }

  private sampleBody() {
    for (let i = 0; i < this.stationCount; i += 1) {
      const distance = i * this.bodySpacing;
      this.sampleTrail(distance, this.point);
      let x = this.point.x;
      let y = this.point.y;

      const waveAmplitude = 2.8 * this.scale * this.motionAmount * (0.28 + 0.72 * i / (this.stationCount - 1));
      const wave = Math.sin(this.travelPhase - distance * 0.055) * waveAmplitude;

      this.sampleTrail(Math.max(0, distance - this.pointSpacing * 2), this.point);
      const aheadX = this.point.x;
      const aheadY = this.point.y;
      this.sampleTrail(distance + this.pointSpacing * 2, this.point);
      let tangentX = aheadX - this.point.x;
      let tangentY = aheadY - this.point.y;
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
      tangentX /= tangentLength;
      tangentY /= tangentLength;

      x += -tangentY * wave;
      y += tangentX * wave;
      this.bodyX[i] = x;
      this.bodyY[i] = y;
      this.bodyAngle[i] = Math.atan2(tangentY, tangentX);
      this.bodyRadius[i] = this.radiusAt(distance);
      this.leftX[i] = x - tangentY * this.bodyRadius[i];
      this.leftY[i] = y + tangentX * this.bodyRadius[i];
      this.rightX[i] = x + tangentY * this.bodyRadius[i];
      this.rightY[i] = y - tangentX * this.bodyRadius[i];
    }
  }

  private radiusAt(distance: number) {
    const neckEnd = 31 * this.scale;
    const torsoEnd = 120 * this.scale;
    const tailEnd = (this.stationCount - 1) * this.bodySpacing;

    if (distance < neckEnd) {
      const t = distance / neckEnd;
      const eased = t * t * (3 - 2 * t);
      return (3.1 + 1.25 * eased) * this.scale;
    }
    if (distance < torsoEnd) {
      const t = (distance - neckEnd) / (torsoEnd - neckEnd);
      const shoulder = 0.48;
      if (t < shoulder) {
        const rise = t / shoulder;
        const eased = rise * rise * (3 - 2 * rise);
        return (5 + 20 * eased) * this.scale;
      }
      const fall = (t - shoulder) / (1 - shoulder);
      const eased = fall * fall * (3 - 2 * fall);
      return (25 - 13 * eased) * this.scale;
    }

    const t = Math.min(1, (distance - torsoEnd) / Math.max(1, tailEnd - torsoEnd));
    return Math.max(0.06, 12 * Math.pow(1 - t, 1.12)) * this.scale;
  }

  private drawBody(ctx: CanvasRenderingContext2D, fill: string, edge: string) {
    const last = this.stationCount - 1;
    ctx.beginPath();
    const firstOffset = this.tailVisualOffset(0);
    let previousLeftX = this.leftX[0] - Math.sin(this.bodyAngle[0]) * firstOffset;
    let previousLeftY = this.leftY[0] + Math.cos(this.bodyAngle[0]) * firstOffset;
    ctx.moveTo(previousLeftX, previousLeftY);
    for (let i = 1; i <= last; i += 1) {
      const offset = this.tailVisualOffset(i);
      const leftX = this.leftX[i] - Math.sin(this.bodyAngle[i]) * offset;
      const leftY = this.leftY[i] + Math.cos(this.bodyAngle[i]) * offset;
      ctx.quadraticCurveTo(previousLeftX, previousLeftY, (previousLeftX + leftX) * 0.5, (previousLeftY + leftY) * 0.5);
      previousLeftX = leftX;
      previousLeftY = leftY;
    }
    ctx.lineTo(previousLeftX, previousLeftY);

    const lastOffset = this.tailVisualOffset(last);
    let nextRightX = this.rightX[last] - Math.sin(this.bodyAngle[last]) * lastOffset;
    let nextRightY = this.rightY[last] + Math.cos(this.bodyAngle[last]) * lastOffset;
    for (let i = last - 1; i >= 0; i -= 1) {
      const offset = this.tailVisualOffset(i);
      const rightX = this.rightX[i] - Math.sin(this.bodyAngle[i]) * offset;
      const rightY = this.rightY[i] + Math.cos(this.bodyAngle[i]) * offset;
      ctx.quadraticCurveTo(nextRightX, nextRightY, (nextRightX + rightX) * 0.5, (nextRightY + rightY) * 0.5);
      nextRightX = rightX;
      nextRightY = rightY;
    }
    ctx.lineTo(nextRightX, nextRightY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.05 * this.scale;
    ctx.fill();
    ctx.stroke();
  }

  private tailVisualOffset(index: number) {
    const tailStart = 120 * this.scale;
    const tailEnd = (this.stationCount - 1) * this.bodySpacing;
    const progress = Math.max(0, Math.min(1, (index * this.bodySpacing - tailStart) / Math.max(1, tailEnd - tailStart)));
    return 6.2 * this.scale * Math.sin(Math.PI * progress);
  }

  private drawTailFin(ctx: CanvasRenderingContext2D, fill: string, edge: string, vein: string) {
    const last = this.stationCount - 1;
    const offset = Math.max(2, Math.round(18 * this.scale / this.bodySpacing));
    const index = Math.max(0, last - offset);
    const tailCurve = this.tailVisualOffset(index);

    ctx.save();
    ctx.translate(
      this.bodyX[index] - Math.sin(this.bodyAngle[index]) * tailCurve,
      this.bodyY[index] + Math.cos(this.bodyAngle[index]) * tailCurve,
    );
    ctx.rotate(this.bodyAngle[index]);
    ctx.beginPath();
    ctx.moveTo(5 * this.scale, 0);
    ctx.quadraticCurveTo(0.8 * this.scale, -2.4 * this.scale, -4 * this.scale, -6.3 * this.scale);
    ctx.lineTo(-7 * this.scale, -3.5 * this.scale);
    ctx.lineTo(-17 * this.scale, 0);
    ctx.lineTo(-7 * this.scale, 3.5 * this.scale);
    ctx.lineTo(-4 * this.scale, 6.3 * this.scale);
    ctx.quadraticCurveTo(0.8 * this.scale, 2.4 * this.scale, 5 * this.scale, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.05 * this.scale;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(3.2 * this.scale, 0);
    ctx.quadraticCurveTo(-5 * this.scale, 0, -15.2 * this.scale, 0);
    ctx.strokeStyle = vein;
    ctx.lineWidth = 0.85 * this.scale;
    ctx.stroke();
    ctx.restore();
  }

  private drawWings(ctx: CanvasRenderingContext2D, fill: string, edge: string, vein: string) {
    const index = Math.min(this.stationCount - 1, Math.round(59 * this.scale / this.bodySpacing));
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(this.bodyX[index], this.bodyY[index]);
      ctx.rotate(this.bodyAngle[index]);
      ctx.scale(1, side);
      ctx.beginPath();
      ctx.moveTo(8 * this.scale, 4 * this.scale);
      ctx.quadraticCurveTo(0.5 * this.scale, 6 * this.scale, -8 * this.scale, 15 * this.scale);
      ctx.lineTo(-24 * this.scale, 30 * this.scale);
      ctx.quadraticCurveTo(-34 * this.scale, 40 * this.scale, -43 * this.scale, 43 * this.scale);
      ctx.quadraticCurveTo(-40 * this.scale, 34 * this.scale, -34 * this.scale, 28 * this.scale);
      ctx.quadraticCurveTo(-31 * this.scale, 25 * this.scale, -27 * this.scale, 23 * this.scale);
      ctx.quadraticCurveTo(-35 * this.scale, 20 * this.scale, -39 * this.scale, 18 * this.scale);
      ctx.quadraticCurveTo(-36 * this.scale, 12 * this.scale, -27 * this.scale, 9 * this.scale);
      ctx.quadraticCurveTo(-16 * this.scale, 4 * this.scale, -5 * this.scale, 3.2 * this.scale);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.25 * this.scale;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(5 * this.scale, 4.5 * this.scale);
      ctx.quadraticCurveTo(-16 * this.scale, 16 * this.scale, -42 * this.scale, 41 * this.scale);
      ctx.moveTo(-2 * this.scale, 8 * this.scale);
      ctx.quadraticCurveTo(-23 * this.scale, 17 * this.scale, -38 * this.scale, 18.5 * this.scale);
      ctx.moveTo(-8 * this.scale, 14 * this.scale);
      ctx.quadraticCurveTo(-23 * this.scale, 18 * this.scale, -32 * this.scale, 26 * this.scale);
      ctx.strokeStyle = vein;
      ctx.lineWidth = 1.05 * this.scale;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(6 * this.scale, 4.4 * this.scale);
      ctx.quadraticCurveTo(-8 * this.scale, 12 * this.scale, -22 * this.scale, 29 * this.scale);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.7 * this.scale;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawLegs(ctx: CanvasRenderingContext2D, fill: string, edge: string, detail: string) {
    const front = Math.min(this.stationCount - 1, Math.round(44 * this.scale / this.bodySpacing));
    const rear = Math.min(this.stationCount - 1, Math.round(103 * this.scale / this.bodySpacing));

    for (let leg = 0; leg < 4; leg += 1) {
      const side = leg % 2 === 0 ? -1 : 1;
      const index = leg < 2 ? front : rear;
      const phase = this.travelPhase * 1.35 + (leg === 1 || leg === 2 ? Math.PI : 0);
      const stride = Math.sin(phase) * 2.6 * this.scale * this.motionAmount;
      const radius = this.bodyRadius[index];
      const facing = leg < 2 ? 1 : -1;
      const elbowX = facing * 1.8 * this.scale + stride * 0.38;
      const footX = facing * 0.8 * this.scale + stride;

      ctx.save();
      ctx.translate(this.bodyX[index], this.bodyY[index]);
      ctx.rotate(this.bodyAngle[index]);
      const shoulderX = facing * 0.7 * this.scale;
      const shoulderY = side * (radius - 1.5 * this.scale);
      const elbowY = side * (radius + 3.8 * this.scale);
      const footY = side * (radius + 7.5 * this.scale);
      this.drawLimbSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 2.15 * this.scale, 1.65 * this.scale, fill, edge);
      this.drawLimbSegment(ctx, elbowX, elbowY, footX, footY, 1.65 * this.scale, 1.15 * this.scale, fill, edge);

      ctx.beginPath();
      ctx.moveTo(footX - 2.4 * this.scale, side * (radius + 6.8 * this.scale));
      ctx.lineTo(footX + 1.4 * this.scale, side * (radius + 6.9 * this.scale));
      ctx.lineTo(footX + 3.2 * this.scale, side * (radius + 9.1 * this.scale));
      ctx.lineTo(footX + 1 * this.scale, side * (radius + 8.7 * this.scale));
      ctx.lineTo(footX - 0.6 * this.scale, side * (radius + 10.2 * this.scale));
      ctx.lineTo(footX - 1.7 * this.scale, side * (radius + 8.8 * this.scale));
      ctx.lineTo(footX - 3.1 * this.scale, side * (radius + 9.4 * this.scale));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = detail;
      ctx.lineWidth = 0.95 * this.scale;
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawLimbSegment(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    startWidth: number,
    endWidth: number,
    fill: string,
    edge: string,
  ) {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;

    ctx.beginPath();
    ctx.moveTo(startX + normalX * startWidth, startY + normalY * startWidth);
    ctx.lineTo(endX + normalX * endWidth, endY + normalY * endWidth);
    ctx.lineTo(endX - normalX * endWidth, endY - normalY * endWidth);
    ctx.lineTo(startX - normalX * startWidth, startY - normalY * startWidth);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.85 * this.scale;
    ctx.fill();
    ctx.stroke();
  }

  private drawBodyLayers(ctx: CanvasRenderingContext2D, fill: string, shoulder: string, edge: string) {
    const neck = Math.min(this.stationCount - 1, Math.round(31 * this.scale / this.bodySpacing));
    const torso = Math.min(this.stationCount - 1, Math.round(120 * this.scale / this.bodySpacing));
    this.drawBodyRibbon(ctx, neck, torso, 0.7, false, fill, edge);

    const shoulderStart = Math.min(this.stationCount - 1, Math.round(37 * this.scale / this.bodySpacing));
    const shoulderEnd = Math.min(this.stationCount - 1, Math.round(83 * this.scale / this.bodySpacing));
    this.drawBodyRibbon(ctx, shoulderStart, shoulderEnd, 0.78, true, shoulder, edge);
  }

  private drawBodyRibbon(
    ctx: CanvasRenderingContext2D,
    start: number,
    end: number,
    widthFactor: number,
    taperEnds: boolean,
    fill: string,
    edge: string,
  ) {
    const span = Math.max(1, end - start);
    let previousLeftX = 0;
    let previousLeftY = 0;
    ctx.beginPath();

    for (let i = start; i <= end; i += 1) {
      const t = (i - start) / span;
      const taper = taperEnds ? Math.pow(Math.sin(Math.PI * t), 0.35) : 1;
      const width = this.bodyRadius[i] * widthFactor * taper;
      const x = this.bodyX[i] - Math.sin(this.bodyAngle[i]) * width;
      const y = this.bodyY[i] + Math.cos(this.bodyAngle[i]) * width;
      if (i === start) {
        ctx.moveTo(x, y);
      } else {
        ctx.quadraticCurveTo(previousLeftX, previousLeftY, (previousLeftX + x) * 0.5, (previousLeftY + y) * 0.5);
      }
      previousLeftX = x;
      previousLeftY = y;
    }
    ctx.lineTo(previousLeftX, previousLeftY);

    let nextRightX = 0;
    let nextRightY = 0;
    for (let i = end; i >= start; i -= 1) {
      const t = (i - start) / span;
      const taper = taperEnds ? Math.pow(Math.sin(Math.PI * t), 0.35) : 1;
      const width = this.bodyRadius[i] * widthFactor * taper;
      const x = this.bodyX[i] + Math.sin(this.bodyAngle[i]) * width;
      const y = this.bodyY[i] - Math.cos(this.bodyAngle[i]) * width;
      if (i === end) {
        ctx.lineTo(x, y);
      } else {
        ctx.quadraticCurveTo(nextRightX, nextRightY, (nextRightX + x) * 0.5, (nextRightY + y) * 0.5);
      }
      nextRightX = x;
      nextRightY = y;
    }

    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.7 * this.scale;
    ctx.fill();
    ctx.stroke();
  }

  private drawHead(ctx: CanvasRenderingContext2D, fill: string, edge: string, detail: string) {
    const size = 1.24 * this.scale;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Swept horns sit behind the cranium and continue its angular silhouette.
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(-3.8 * size, side * 3.4 * size);
      ctx.quadraticCurveTo(-8.2 * size, side * 5.4 * size, -13.2 * size, side * 10.2 * size);
      ctx.lineTo(-10.5 * size, side * 4.1 * size);
      ctx.quadraticCurveTo(-7 * size, side * 2.1 * size, -3.8 * size, side * 3.4 * size);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.95 * size;
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(16 * size, 0);
    ctx.lineTo(11.8 * size, 1.25 * size);
    ctx.lineTo(8.4 * size, 3.5 * size);
    ctx.quadraticCurveTo(5.2 * size, 5.7 * size, 1 * size, 5.8 * size);
    ctx.lineTo(-4.2 * size, 4.9 * size);
    ctx.lineTo(-8.8 * size, 3 * size);
    ctx.lineTo(-11.4 * size, 0);
    ctx.lineTo(-8.8 * size, -3 * size);
    ctx.lineTo(-4.2 * size, -4.9 * size);
    ctx.quadraticCurveTo(5.2 * size, -5.7 * size, 8.4 * size, -3.5 * size);
    ctx.lineTo(11.8 * size, -1.25 * size);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.2 * size;
    ctx.fill();
    ctx.stroke();

    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(10.4 * size, side * 1.4 * size);
      ctx.lineTo(6.2 * size, side * 3.2 * size);
      ctx.lineTo(1.5 * size, side * 3.75 * size);
      ctx.lineTo(4.2 * size, side * 2.25 * size);
      ctx.closePath();
      ctx.fillStyle = this.isDark ? 'rgba(55, 76, 99, 0.48)' : 'rgba(91, 117, 143, 0.34)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(10.8 * size, 1.4 * size);
    ctx.lineTo(7 * size, 3.2 * size);
    ctx.lineTo(1 * size, 4 * size);
    ctx.quadraticCurveTo(4.2 * size, 5.2 * size, 7.6 * size, 4 * size);
    ctx.closePath();
    ctx.fillStyle = 'rgba(55, 76, 99, 0.55)';
    ctx.fill();

    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.ellipse(3.7 * size, side * 3.15 * size, 1.05 * size, 0.68 * size, -side * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = detail;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4 * size, side * 3.15 * size, 0.42 * size, 0.54 * size, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5, 13, 24, 0.92)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.ellipse(13.5 * size, -0.9 * size, 0.55 * size, 0.32 * size, 0, 0, Math.PI * 2);
    ctx.ellipse(13.5 * size, 0.9 * size, 0.55 * size, 0.32 * size, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 13, 24, 0.9)';
    ctx.fill();

    ctx.restore();
  }

  private intersectsRect(x1: number, y1: number, x2: number, y2: number, rect: Rect) {
    let start = 0;
    let end = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;

    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const ratio = q / p;
      if (p < 0) {
        if (ratio > end) return false;
        if (ratio > start) start = ratio;
      } else {
        if (ratio < start) return false;
        if (ratio < end) end = ratio;
      }
      return true;
    };

    return clip(-dx, x1 - rect.left)
      && clip(dx, rect.right - x1)
      && clip(-dy, y1 - rect.top)
      && clip(dy, rect.bottom - y1)
      && end >= start;
  }

  private distance(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private wrapAngle(angle: number) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}

export function useDragonAnimation(
  canvasRef: Ref<HTMLCanvasElement | null>,
  getSafeZone: () => HTMLElement | null,
  getDarkMode: () => boolean,
  getParticleContainer: () => import('@tsparticles/engine').Container | null,
) {
  const particleInteraction = new DragonParticleInteraction();
  let controller: DragonController | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let appRoot: HTMLElement | null = null;
  let frame = 0;
  let lastTime = 0;
  let idlePoll = 0;
  let inViewport = true;
  let enabled = false;
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let capabilityQuery: MediaQueryList | null = null;
  let reducedMotionQuery: MediaQueryList | null = null;
  let onCapabilityChange: (() => void) | null = null;

  const motionAllowed = () => import.meta.env.DEV || !reducedMotionQuery?.matches;

  const updateSafeZone = () => {
    if (!controller) return;
    const safeElement = getSafeZone();
    if (!safeElement) {
      controller.setSafeRect(null);
      return;
    }

    const canvasRect = canvasRef.value?.getBoundingClientRect();
    const safeBounds = safeElement.getBoundingClientRect();
    if (!canvasRect) return;
    if (safeBounds.bottom < canvasRect.top || safeBounds.top > canvasRect.bottom
      || safeBounds.right < canvasRect.left || safeBounds.left > canvasRect.right) {
      controller.setSafeRect(null);
      return;
    }
    const padding = (canvasRect.width < 1024 ? 42 : 56) * (canvasRect.width < 1024 ? 0.74 : 1);
    controller.setSafeRect({
      left: Math.max(0, safeBounds.left - canvasRect.left - padding),
      top: Math.max(0, safeBounds.top - canvasRect.top - padding),
      right: Math.min(canvasRect.width, safeBounds.right - canvasRect.left + padding),
      bottom: Math.min(canvasRect.height, safeBounds.bottom - canvasRect.top + padding),
    });
  };

  const drawOnce = () => {
    if (!context || !canvasRef.value || !controller) return;
    const width = canvasRef.value.clientWidth;
    const height = canvasRef.value.clientHeight;
    context.clearRect(0, 0, width, height);
    particleInteraction.draw(context, getDarkMode());
    controller.draw(context);
  };

  const stopFrame = () => {
    if (frame) cancelAnimationFrame(frame);
    if (idlePoll) window.clearTimeout(idlePoll);
    frame = 0;
    idlePoll = 0;
    lastTime = 0;
  };

  const scheduleIdlePoll = () => {
    const particleContainer = getParticleContainer();
    if (!enabled || !motionAllowed() || !inViewport || document.hidden || !controller?.getInteractionFrame().hasMoved
      || !particleContainer || particleContainer.destroyed || !particleContainer.animationStatus || idlePoll) return;
    idlePoll = window.setTimeout(() => {
      idlePoll = 0;
      if (!enabled || !motionAllowed() || !inViewport || document.hidden || !controller || !context) return;
      if (controller.needsAnimation()) {
        wake();
        return;
      }

      const interactionChanged = particleInteraction.update(
        getParticleContainer(),
        controller.getInteractionFrame(),
        performance.now(),
        true,
      );
      if (interactionChanged || particleInteraction.hasTransientEffects) drawOnce();
      if (particleInteraction.hasTransientEffects) wake();
      else scheduleIdlePoll();
    }, 90);
  };

  const animate = (time: number) => {
    frame = 0;
    if (!enabled || !motionAllowed() || !inViewport || !controller || !context || document.hidden) return;
    const dt = lastTime ? Math.min(0.032, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    if (controller.needsAnimation()) controller.update(dt);
    particleInteraction.update(
      getParticleContainer(),
      controller.getInteractionFrame(),
      time,
      motionAllowed() && enabled && inViewport,
    );
    drawOnce();
    if (controller.needsAnimation() || particleInteraction.hasTransientEffects) {
      frame = requestAnimationFrame(animate);
    } else {
      lastTime = 0;
      scheduleIdlePoll();
    }
  };

  const wake = () => {
    if (idlePoll) {
      window.clearTimeout(idlePoll);
      idlePoll = 0;
    }
    if (!frame && enabled && motionAllowed() && inViewport && !document.hidden) frame = requestAnimationFrame(animate);
  };

  const resize = () => {
    const canvas = canvasRef.value;
    if (!canvas || !enabled) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight || !controller) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      controller = new DragonController(width, height, getDarkMode());
      updateSafeZone();
      drawOnce();
    } else if (controller) {
      controller.setDarkMode(getDarkMode());
      updateSafeZone();
      drawOnce();
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!enabled || !motionAllowed() || !controller || event.pointerType === 'touch' || !canvasRef.value) return;
    const bounds = canvasRef.value.getBoundingClientRect();
    controller.setTarget(event.clientX - bounds.left, event.clientY - bounds.top);
    wake();
  };

  const onPointerLeave = () => {
    if (!controller) return;
    controller.clearTarget();
    wake();
  };

  const onVisibilityChange = () => {
    if (document.hidden) stopFrame();
    else wake();
  };

  const setEnabled = (next: boolean) => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    if (enabled === next) {
      canvas.style.display = enabled ? 'block' : 'none';
      return;
    }
    enabled = next;
    canvas.style.display = enabled ? 'block' : 'none';
    if (enabled) {
      resize();
      appRoot?.addEventListener('pointermove', onPointerMove);
      appRoot?.addEventListener('pointerleave', onPointerLeave);
      wake();
    } else {
      stopFrame();
      particleInteraction.clear();
      appRoot?.removeEventListener('pointermove', onPointerMove);
      appRoot?.removeEventListener('pointerleave', onPointerLeave);
      context?.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }
  };

  watch(getDarkMode, (isDark) => {
    controller?.setDarkMode(isDark);
    drawOnce();
  });

  onMounted(() => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    appRoot = canvas.parentElement;
    context = canvas.getContext('2d', { alpha: true });
    if (!appRoot || !context) return;

    capabilityQuery = window.matchMedia('(min-width: 640px)');
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    onCapabilityChange = () => {
      setEnabled(capabilityQuery!.matches);
      if (motionAllowed()) wake();
      else {
        controller?.clearTarget();
        stopFrame();
        particleInteraction.clear();
        drawOnce();
      }
    };
    capabilityQuery.addEventListener('change', onCapabilityChange);
    reducedMotionQuery.addEventListener('change', onCapabilityChange);

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', updateSafeZone, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) wake();
      else stopFrame();
    });
    intersectionObserver.observe(canvas);

    onCapabilityChange();
    resize();
  });

  onBeforeUnmount(() => {
    stopFrame();
    particleInteraction.clear();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    if (onCapabilityChange) {
      capabilityQuery?.removeEventListener('change', onCapabilityChange);
      reducedMotionQuery?.removeEventListener('change', onCapabilityChange);
    }
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', updateSafeZone);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    appRoot?.removeEventListener('pointermove', onPointerMove);
    appRoot?.removeEventListener('pointerleave', onPointerLeave);
  });
}
