import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

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
    if (rect && !this.hasMoved && !this.isTracking) {
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
    const fill = this.isDark ? 'rgba(13, 29, 48, 0.84)' : 'rgba(26, 57, 86, 0.16)';
    const edge = this.isDark ? 'rgba(92, 133, 169, 0.56)' : 'rgba(45, 88, 130, 0.34)';
    const detail = this.isDark ? 'rgba(103, 168, 198, 0.48)' : 'rgba(42, 105, 150, 0.35)';
    const softDetail = this.isDark ? 'rgba(86, 132, 163, 0.35)' : 'rgba(45, 88, 130, 0.24)';

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    this.drawLegs(ctx, edge);
    this.drawWings(ctx, fill, edge, softDetail);
    this.drawBody(ctx, fill, edge);
    this.drawSpines(ctx, detail);
    this.drawNetworkMarks(ctx, detail, softDetail);
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
    const neckEnd = 28 * this.scale;
    const torsoEnd = 112 * this.scale;
    const tailEnd = (this.stationCount - 1) * this.bodySpacing;

    if (distance < neckEnd) {
      const t = distance / neckEnd;
      return (4.2 + 1.2 * t) * this.scale;
    }
    if (distance < torsoEnd) {
      const t = (distance - neckEnd) / (torsoEnd - neckEnd);
      return (5.3 + 5.8 * Math.pow(Math.sin(Math.PI * t), 0.82)) * this.scale;
    }

    const t = Math.min(1, (distance - torsoEnd) / Math.max(1, tailEnd - torsoEnd));
    return (5.1 * Math.pow(1 - t, 1.12) + 0.42) * this.scale;
  }

  private drawBody(ctx: CanvasRenderingContext2D, fill: string, edge: string) {
    const last = this.stationCount - 1;
    ctx.beginPath();
    ctx.moveTo(this.leftX[0], this.leftY[0]);
    for (let i = 1; i <= last; i += 1) {
      const midX = (this.leftX[i - 1] + this.leftX[i]) * 0.5;
      const midY = (this.leftY[i - 1] + this.leftY[i]) * 0.5;
      ctx.quadraticCurveTo(this.leftX[i - 1], this.leftY[i - 1], midX, midY);
    }
    ctx.lineTo(this.leftX[last], this.leftY[last]);
    for (let i = last - 1; i >= 0; i -= 1) {
      const midX = (this.rightX[i + 1] + this.rightX[i]) * 0.5;
      const midY = (this.rightY[i + 1] + this.rightY[i]) * 0.5;
      ctx.quadraticCurveTo(this.rightX[i + 1], this.rightY[i + 1], midX, midY);
    }
    ctx.lineTo(this.rightX[0], this.rightY[0]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.05 * this.scale;
    ctx.fill();
    ctx.stroke();
  }

  private drawWings(ctx: CanvasRenderingContext2D, fill: string, edge: string, vein: string) {
    const index = Math.min(this.stationCount - 1, Math.round(58 * this.scale / this.bodySpacing));
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(this.bodyX[index], this.bodyY[index]);
      ctx.rotate(this.bodyAngle[index]);
      ctx.scale(1, side);
      ctx.beginPath();
      ctx.moveTo(4 * this.scale, 3 * this.scale);
      ctx.quadraticCurveTo(-2 * this.scale, 13 * this.scale, -15 * this.scale, 20 * this.scale);
      ctx.lineTo(-20 * this.scale, 11 * this.scale);
      ctx.quadraticCurveTo(-18 * this.scale, 5 * this.scale, -8 * this.scale, 3.5 * this.scale);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.9 * this.scale;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(2 * this.scale, 4 * this.scale);
      ctx.quadraticCurveTo(-8 * this.scale, 10 * this.scale, -17 * this.scale, 17 * this.scale);
      ctx.strokeStyle = vein;
      ctx.lineWidth = 0.8 * this.scale;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawLegs(ctx: CanvasRenderingContext2D, color: string) {
    const front = Math.min(this.stationCount - 1, Math.round(34 * this.scale / this.bodySpacing));
    const rear = Math.min(this.stationCount - 1, Math.round(103 * this.scale / this.bodySpacing));

    for (let leg = 0; leg < 4; leg += 1) {
      const side = leg % 2 === 0 ? -1 : 1;
      const index = leg < 2 ? front : rear;
      const phase = this.travelPhase * 1.35 + (leg === 1 || leg === 2 ? Math.PI : 0);
      const stride = Math.sin(phase) * 3.3 * this.scale * this.motionAmount;
      const radius = this.bodyRadius[index];

      ctx.save();
      ctx.translate(this.bodyX[index], this.bodyY[index]);
      ctx.rotate(this.bodyAngle[index]);
      ctx.beginPath();
      ctx.moveTo(0, side * (radius - 0.4 * this.scale));
      ctx.quadraticCurveTo(stride * 0.55, side * (radius + 3.5 * this.scale), stride, side * (radius + 6.2 * this.scale));
      ctx.lineTo(stride + 1.4 * this.scale, side * (radius + 5.7 * this.scale));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.65 * this.scale;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawSpines(ctx: CanvasRenderingContext2D, color: string) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i += 1) {
      const index = Math.min(this.stationCount - 1, Math.round((32 + i * 12) * this.scale / this.bodySpacing));
      const angle = this.bodyAngle[index];
      const size = (2.1 - i * 0.12) * this.scale;
      ctx.save();
      ctx.translate(this.bodyX[index], this.bodyY[index]);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(size * 1.7, 0);
      ctx.lineTo(-size, -size * 0.72);
      ctx.lineTo(-size * 0.8, 0);
      ctx.lineTo(-size, size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawNetworkMarks(ctx: CanvasRenderingContext2D, node: string, line: string) {
    ctx.beginPath();
    for (let i = 5; i < 11; i += 3) {
      const index = i;
      ctx.moveTo(this.bodyX[index], this.bodyY[index]);
      ctx.lineTo(this.bodyX[index + 3], this.bodyY[index + 3]);
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.8 * this.scale;
    ctx.stroke();

    ctx.fillStyle = node;
    for (let index = 5; index <= 11; index += 3) {
      ctx.beginPath();
      ctx.arc(this.bodyX[index], this.bodyY[index], 1.25 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHead(ctx: CanvasRenderingContext2D, fill: string, edge: string, detail: string) {
    const size = this.scale;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(-4 * size, side * 3.3 * size);
      ctx.quadraticCurveTo(-9 * size, side * 7.5 * size, -14 * size, side * 8.2 * size);
      ctx.quadraticCurveTo(-11 * size, side * 4.2 * size, -8 * size, side * 1.6 * size);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.55 * size;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(11 * size, 0);
    ctx.quadraticCurveTo(8 * size, 6.2 * size, 2 * size, 6.1 * size);
    ctx.lineTo(-5 * size, 4.7 * size);
    ctx.lineTo(-10 * size, 2.3 * size);
    ctx.lineTo(-13 * size, 0);
    ctx.lineTo(-10 * size, -2.3 * size);
    ctx.lineTo(-5 * size, -4.7 * size);
    ctx.quadraticCurveTo(8 * size, -6.2 * size, 11 * size, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.1 * size;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = detail;
    ctx.beginPath();
    ctx.arc(2.5 * size, -2.6 * size, 0.8 * size, 0, Math.PI * 2);
    ctx.arc(2.5 * size, 2.6 * size, 0.8 * size, 0, Math.PI * 2);
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
) {
  let controller: DragonController | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let hero: HTMLElement | null = null;
  let frame = 0;
  let lastTime = 0;
  let inViewport = true;
  let enabled = false;
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let capabilityQuery: MediaQueryList | null = null;
  let reducedMotionQuery: MediaQueryList | null = null;
  let onCapabilityChange: (() => void) | null = null;

  const motionAllowed = () => import.meta.env.DEV || !reducedMotionQuery?.matches;

  const updateSafeZone = () => {
    if (!controller || !hero) return;
    const safeElement = getSafeZone();
    if (!safeElement) {
      controller.setSafeRect(null);
      return;
    }

    const canvasRect = canvasRef.value?.getBoundingClientRect();
    const safeBounds = safeElement.getBoundingClientRect();
    if (!canvasRect) return;
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
    controller.draw(context);
  };

  const stopFrame = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };

  const animate = (time: number) => {
    frame = 0;
    if (!enabled || !inViewport || !controller || !context || document.hidden || !motionAllowed()) return;
    const dt = lastTime ? Math.min(0.032, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    controller.update(dt);
    drawOnce();
    if (controller.needsAnimation()) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  };

  const wake = () => {
    if (!frame && enabled && inViewport && !document.hidden && motionAllowed()) frame = requestAnimationFrame(animate);
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
    if (!enabled || !controller || !motionAllowed() || event.pointerType === 'touch' || !canvasRef.value) return;
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
      hero?.addEventListener('pointermove', onPointerMove);
      hero?.addEventListener('pointerleave', onPointerLeave);
      wake();
    } else {
      stopFrame();
      hero?.removeEventListener('pointermove', onPointerMove);
      hero?.removeEventListener('pointerleave', onPointerLeave);
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
    hero = canvas.parentElement;
    context = canvas.getContext('2d', { alpha: true });
    if (!hero || !context) return;

    capabilityQuery = window.matchMedia('(min-width: 640px)');
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    onCapabilityChange = () => {
      setEnabled(capabilityQuery!.matches);
      if (!motionAllowed()) {
        controller?.clearTarget();
        stopFrame();
        drawOnce();
      } else {
        wake();
      }
    };
    capabilityQuery.addEventListener('change', onCapabilityChange);
    reducedMotionQuery.addEventListener('change', onCapabilityChange);

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) wake();
      else stopFrame();
    });
    intersectionObserver.observe(hero);

    onCapabilityChange();
    resize();
  });

  onBeforeUnmount(() => {
    stopFrame();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    if (onCapabilityChange) {
      capabilityQuery?.removeEventListener('change', onCapabilityChange);
      reducedMotionQuery?.removeEventListener('change', onCapabilityChange);
    }
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    hero?.removeEventListener('pointermove', onPointerMove);
    hero?.removeEventListener('pointerleave', onPointerLeave);
  });
}
