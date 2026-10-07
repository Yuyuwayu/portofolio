import type { Container, Particle } from '@tsparticles/engine';

type NetworkParticle = Particle & {
  links?: Array<{ destination: NetworkParticle; opacity: number }>;
  retina: Particle['retina'] & { linksWidth?: number };
};

type NetworkContainer = Container & {
  particles: Container['particles'] & {
    quadTree: {
      queryRectangle(position: { x: number; y: number }, size: { width: number; height: number }): Particle[];
    };
  };
};

export interface DragonInteractionFrame {
  x: number;
  y: number;
  scale: number;
  renderScale: number;
  bodyAngle: Float32Array;
  bodyX: Float32Array;
  bodyY: Float32Array;
  bodyRadius: Float32Array;
  stationCount: number;
  frontCount: number;
  bodySpacing: number;
  hasMoved: boolean;
}

type ConsumingParticle = {
  particle: NetworkParticle;
  startedAt: number;
  startX: number;
  startY: number;
  startSize: number;
  startOpacity: number;
  bodyIndex: number;
};

type BrokenEdge = {
  source: NetworkParticle;
  destination: NetworkParticle;
  startedAt: number;
  cooldownUntil: number;
  contactActive: boolean;
  lastSeenFrame: number;
  impactT: number;
  pushX: number;
  pushY: number;
  width: number;
  opacity: number;
  seed: number;
};

const EAT_DURATION = 320;
const BREAK_DURATION = 680;
const BREAK_COOLDOWN = 950;
const LINK_SEARCH_DISTANCE = 154;
const MAX_SIMULTANEOUS_EATS = 3;
const EAT_INTERVAL = 220;
const BREAK_INTERVAL = 190;

export class DragonParticleInteraction {
  private readonly consuming = new Map<number, ConsumingParticle>();
  private readonly brokenEdges = new Map<number, Map<number, BrokenEdge>>();
  private readonly queryPosition = { x: 0, y: 0 };
  private readonly querySize = { width: 0, height: 0 };
  private readonly closest = { x: 0, y: 0, bodyIndex: 0, impactT: 0, impactAngle: 0 };
  private readonly segmentHit = { distanceSquared: 0, edgeT: 0 };
  private container: NetworkContainer | null = null;
  private nextEatAt = 0;
  private nextBreakAt = 0;
  private frameNumber = 0;
  private now = 0;

  get hasTransientEffects() {
    if (this.consuming.size > 0) return true;
    for (const edgesFromSource of this.brokenEdges.values()) {
      for (const edge of edgesFromSource.values()) {
        if (this.now - edge.startedAt < BREAK_DURATION) return true;
      }
    }
    return false;
  }

  update(container: Container | null, frame: DragonInteractionFrame, now: number, enabled: boolean) {
    if (this.container !== container) {
      this.clear();
      this.container = container as NetworkContainer | null;
    }
    this.now = now;

    if (!enabled || !container || container.destroyed) {
      if (this.consuming.size || this.brokenEdges.size) this.clear();
      return false;
    }

    const network = container as NetworkContainer;
    const pixelRatio = Math.max(1, container.retina.pixelRatio || 1);
    let changed = this.updateConsuming(network, frame, now, pixelRatio);

    if (frame.hasMoved && network.particles.count > 0) {
      this.frameNumber += 1;
      const candidates = this.queryNearby(network, frame, pixelRatio);
      for (const particle of candidates) {
        if (this.consuming.has(particle.id) || particle.destroyed || particle.spawning || particle.unbreakable) continue;
        if (this.consuming.size >= MAX_SIMULTANEOUS_EATS || now < this.nextEatAt) break;
        if (this.findEatCollision(particle, frame, pixelRatio)) {
          this.beginEating(particle, this.closest.bodyIndex, now);
          this.nextEatAt = now + EAT_INTERVAL;
          changed = true;
        }
      }

      for (const particle of candidates) {
        const source = particle as NetworkParticle;
        const links = source.links;
        if (!links?.length || source.destroyed) continue;
        for (const link of links) {
          const destination = link.destination;
          if (!destination || destination.destroyed || source.id >= destination.id) continue;

          let edgesFromSource = this.brokenEdges.get(source.id);
          let edge = edgesFromSource?.get(destination.id);
          const sourceX = (source.position.x + source.offset.x) / pixelRatio;
          const sourceY = (source.position.y + source.offset.y) / pixelRatio;
          const destinationX = (destination.position.x + destination.offset.x) / pixelRatio;
          const destinationY = (destination.position.y + destination.offset.y) / pixelRatio;
          const width = Math.max(0.8, (source.retina.linksWidth ?? destination.retina.linksWidth ?? pixelRatio) / pixelRatio);
          const hit = this.findEdgeCollision(sourceX, sourceY, destinationX, destinationY, frame, width);

          if (!hit) continue;

          if (!edge) {
            if (now < this.nextBreakAt) continue;
            edge = {
              source,
              destination,
              startedAt: now,
              cooldownUntil: now + BREAK_COOLDOWN,
              contactActive: true,
              lastSeenFrame: this.frameNumber,
              impactT: this.closest.impactT,
              pushX: Math.cos(this.closest.impactAngle),
              pushY: Math.sin(this.closest.impactAngle),
              width,
              opacity: this.linkOpacity(link.opacity),
              seed: ((source.id * 31 + destination.id * 17) % 19) / 19,
            };
            if (!edgesFromSource) {
              edgesFromSource = new Map<number, BrokenEdge>();
              this.brokenEdges.set(source.id, edgesFromSource);
            }
            edgesFromSource.set(destination.id, edge);
            this.nextBreakAt = now + BREAK_INTERVAL;
            changed = true;
          } else {
            edge.lastSeenFrame = this.frameNumber;
            if (!edge.contactActive && now >= edge.cooldownUntil && now >= this.nextBreakAt) {
              edge.startedAt = now;
              edge.cooldownUntil = now + BREAK_COOLDOWN;
              edge.impactT = this.closest.impactT;
              edge.pushX = Math.cos(this.closest.impactAngle);
              edge.pushY = Math.sin(this.closest.impactAngle);
              edge.width = width;
              edge.opacity = this.linkOpacity(link.opacity);
              this.nextBreakAt = now + BREAK_INTERVAL;
              changed = true;
            }
            edge.contactActive = true;
          }
        }
      }

      for (const edgesFromSource of this.brokenEdges.values()) {
        for (const edge of edgesFromSource.values()) {
          if (edge.lastSeenFrame !== this.frameNumber) edge.contactActive = false;
        }
      }
    }

    // Retire an edge only after this pass has had the chance to confirm that
    // the dragon is no longer touching it. This keeps a slow or stationary
    // overlap from repeatedly starting the same break animation.
    changed = this.updateBrokenEdges(now) || changed;
    return changed;
  }

  draw(context: CanvasRenderingContext2D, dark: boolean) {
    if (!this.brokenEdges.size || !this.container || this.container.destroyed) return;
    const pixelRatio = Math.max(1, this.container.retina.pixelRatio || 1);
    const background = dark ? '#020617' : '#f8fafc';
    const line = dark ? '#6e96b3' : '#6887a3';

    for (const edgesFromSource of this.brokenEdges.values()) {
      for (const edge of edgesFromSource.values()) {
      if (edge.source.destroyed || edge.destination.destroyed) continue;
      const age = this.now - edge.startedAt;
      if (age < 0 || age >= BREAK_DURATION) continue;
      const progress = age / BREAK_DURATION;
      const envelope = progress < 0.14
        ? progress / 0.14
        : progress > 0.42 ? Math.max(0, 1 - (progress - 0.42) / 0.58) : 1;
      if (envelope <= 0.005) continue;

      const ax = (edge.source.position.x + edge.source.offset.x) / pixelRatio;
      const ay = (edge.source.position.y + edge.source.offset.y) / pixelRatio;
      const bx = (edge.destination.position.x + edge.destination.offset.x) / pixelRatio;
      const by = (edge.destination.position.y + edge.destination.offset.y) / pixelRatio;
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      const tx = dx / length;
      const ty = dy / length;
      const impactX = ax + dx * edge.impactT;
      const impactY = ay + dy * edge.impactT;
      const gap = 5.2 * envelope;
      const displacement = 3.8 * envelope;
      const leftT = Math.max(0, edge.impactT - gap / length);
      const rightT = Math.min(1, edge.impactT + gap / length);
      const leftX = ax + dx * leftT - edge.pushX * displacement;
      const leftY = ay + dy * leftT - edge.pushY * displacement;
      const rightX = ax + dx * rightT + edge.pushX * displacement;
      const rightY = ay + dy * rightT + edge.pushY * displacement;

      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalAlpha = envelope;
      context.strokeStyle = background;
      context.lineWidth = edge.width + 5.5;
      context.beginPath();
      context.moveTo(impactX - tx * (gap + 2), impactY - ty * (gap + 2));
      context.lineTo(impactX + tx * (gap + 2), impactY + ty * (gap + 2));
      context.stroke();

      context.globalAlpha = envelope * edge.opacity;
      context.strokeStyle = line;
      context.lineWidth = Math.max(0.8, edge.width);
      context.beginPath();
      context.moveTo(ax, ay);
      context.quadraticCurveTo(impactX - edge.pushX * displacement * 1.7, impactY - edge.pushY * displacement * 1.7, leftX, leftY);
      context.moveTo(rightX, rightY);
      context.quadraticCurveTo(impactX + edge.pushX * displacement * 1.7, impactY + edge.pushY * displacement * 1.7, bx, by);
      context.stroke();

      if (age < 300) {
        const fragmentFade = Math.max(0, 1 - age / 300);
        const fragmentLength = 2.3 + edge.seed * 1.8;
        context.globalAlpha = fragmentFade * edge.opacity * 1.8;
        context.lineWidth = 0.7;
        context.beginPath();
        context.moveTo(impactX - edge.pushX * 3, impactY - edge.pushY * 3);
        context.lineTo(impactX - edge.pushX * 3 + ty * fragmentLength, impactY - edge.pushY * 3 - tx * fragmentLength);
        context.moveTo(impactX + edge.pushX * 2, impactY + edge.pushY * 2);
        context.lineTo(impactX + edge.pushX * 2 - ty * fragmentLength * 0.7, impactY + edge.pushY * 2 + tx * fragmentLength * 0.7);
        context.stroke();
      }
      context.restore();
      }
    }
  }

  clear() {
    for (const effect of this.consuming.values()) {
      const particle = effect.particle;
      if (particle.destroyed) continue;
      particle.size.value = effect.startSize;
      if (particle.opacity) particle.opacity.value = effect.startOpacity;
      particle.position.x = effect.startX;
      particle.position.y = effect.startY;
    }
    this.consuming.clear();
    this.brokenEdges.clear();
    this.nextEatAt = 0;
    this.nextBreakAt = 0;
  }

  private queryNearby(container: NetworkContainer, frame: DragonInteractionFrame, pixelRatio: number) {
    let left = frame.x - 20 * frame.scale * frame.renderScale;
    let right = frame.x + 20 * frame.scale * frame.renderScale;
    let top = frame.y - 20 * frame.scale * frame.renderScale;
    let bottom = frame.y + 20 * frame.scale * frame.renderScale;
    const wingIndex = Math.min(frame.stationCount - 1, Math.round(59 * frame.scale / frame.bodySpacing));

    for (let i = 0; i < frame.stationCount; i += 1) {
      const radius = frame.bodyRadius[i] * frame.renderScale + (i === wingIndex ? 38 * frame.scale * frame.renderScale : 3);
      left = Math.min(left, frame.bodyX[i] - radius);
      right = Math.max(right, frame.bodyX[i] + radius);
      top = Math.min(top, frame.bodyY[i] - radius);
      bottom = Math.max(bottom, frame.bodyY[i] + radius);
    }

    this.queryPosition.x = (left - LINK_SEARCH_DISTANCE) * pixelRatio;
    this.queryPosition.y = (top - LINK_SEARCH_DISTANCE) * pixelRatio;
    this.querySize.width = (right - left + LINK_SEARCH_DISTANCE * 2) * pixelRatio;
    this.querySize.height = (bottom - top + LINK_SEARCH_DISTANCE * 2) * pixelRatio;
    return container.particles.quadTree.queryRectangle(this.queryPosition, this.querySize) as NetworkParticle[];
  }

  private findEatCollision(particle: NetworkParticle, frame: DragonInteractionFrame, pixelRatio: number) {
    const x = (particle.position.x + particle.offset.x) / pixelRatio;
    const y = (particle.position.y + particle.offset.y) / pixelRatio;
    const radius = particle.getRadius() / pixelRatio;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestIndex = 0;

    const headDx = x - frame.x;
    const headDy = y - frame.y;
    const headDistance = headDx * headDx + headDy * headDy;
    const headRadius = 10.5 * frame.scale * frame.renderScale + radius + 2.5;
    if (headDistance <= headRadius * headRadius) {
      this.closest.x = frame.x;
      this.closest.y = frame.y;
      this.closest.bodyIndex = 0;
      return true;
    }

    for (let i = 1; i < frame.frontCount; i += 1) {
      const dx = x - frame.bodyX[i];
      const dy = y - frame.bodyY[i];
      const distance = dx * dx + dy * dy;
      const collisionRadius = frame.bodyRadius[i] * frame.renderScale + radius + 2;
      if (distance <= collisionRadius * collisionRadius && distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    if (nearestDistance === Number.POSITIVE_INFINITY) return false;
    this.closest.x = frame.bodyX[nearestIndex];
    this.closest.y = frame.bodyY[nearestIndex];
    this.closest.bodyIndex = nearestIndex;
    return true;
  }

  private beginEating(particle: NetworkParticle, bodyIndex: number, now: number) {
    this.consuming.set(particle.id, {
      particle,
      startedAt: now,
      startX: particle.position.x,
      startY: particle.position.y,
      startSize: particle.size.value,
      startOpacity: particle.opacity?.value ?? 1,
      bodyIndex,
    });
  }

  private linkOpacity(opacity: number) {
    return Math.max(0.06, Math.min(0.2, opacity * 0.65));
  }

  private updateConsuming(container: NetworkContainer, frame: DragonInteractionFrame, now: number, pixelRatio: number) {
    let changed = false;
    for (const [id, effect] of this.consuming) {
      const particle = effect.particle;
      if (particle.destroyed) {
        this.consuming.delete(id);
        continue;
      }

      const progress = Math.min(1, (now - effect.startedAt) / EAT_DURATION);
      const eased = progress * (2 - progress);
      const targetX = effect.bodyIndex === 0 ? frame.x : frame.bodyX[effect.bodyIndex];
      const targetY = effect.bodyIndex === 0 ? frame.y : frame.bodyY[effect.bodyIndex];
      const dx = targetX * pixelRatio - effect.startX;
      const dy = targetY * pixelRatio - effect.startY;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = Math.min(6 * pixelRatio, distance) * eased;
      particle.position.x = effect.startX + dx / distance * pull - particle.offset.x;
      particle.position.y = effect.startY + dy / distance * pull - particle.offset.y;
      particle.size.value = Math.max(0.01, effect.startSize * (1 - eased));
      if (particle.opacity) particle.opacity.value = effect.startOpacity * (1 - eased);

      if (progress >= 1) {
        container.particles.remove(particle);
        container.particles.push(1);
        this.consuming.delete(id);
        changed = true;
      }
    }
    return changed;
  }

  private findEdgeCollision(ax: number, ay: number, bx: number, by: number, frame: DragonInteractionFrame, lineWidth: number) {
    let bestDistance = Number.POSITIVE_INFINITY;
    let impactT = 0;
    const edgeRadius = lineWidth * 0.5 + 2;

    for (let i = 1; i < frame.stationCount; i += 1) {
      const radius = Math.max(frame.bodyRadius[i - 1], frame.bodyRadius[i]) * frame.renderScale + edgeRadius;
      this.segmentDistance(ax, ay, bx, by, frame.bodyX[i - 1], frame.bodyY[i - 1], frame.bodyX[i], frame.bodyY[i], this.segmentHit);
      let effectiveRadius = radius;
      const wingIndex = Math.round(59 * frame.scale / frame.bodySpacing);
      if (i === wingIndex || i - 1 === wingIndex) effectiveRadius = Math.max(effectiveRadius, 37 * frame.scale * frame.renderScale + edgeRadius);
      if (i === 1) effectiveRadius = Math.max(effectiveRadius, 13 * frame.scale * frame.renderScale + edgeRadius);
      const legFront = Math.round(44 * frame.scale / frame.bodySpacing);
      const legRear = Math.round(103 * frame.scale / frame.bodySpacing);
      if (i === legFront || i - 1 === legFront || i === legRear || i - 1 === legRear) {
        effectiveRadius = Math.max(effectiveRadius, 12 * frame.scale * frame.renderScale + edgeRadius);
      }
      if (this.segmentHit.distanceSquared <= effectiveRadius * effectiveRadius && this.segmentHit.distanceSquared < bestDistance) {
        bestDistance = this.segmentHit.distanceSquared;
        impactT = this.segmentHit.edgeT;
        this.closest.impactAngle = frame.bodyAngle[i];
      }
    }

    this.closest.impactT = impactT;
    return bestDistance < Number.POSITIVE_INFINITY;
  }

  private segmentDistance(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    result: { distanceSquared: number; edgeT: number },
  ) {
    const ux = bx - ax;
    const uy = by - ay;
    const vx = dx - cx;
    const vy = dy - cy;
    const wx = ax - cx;
    const wy = ay - cy;
    const a = ux * ux + uy * uy;
    const b = ux * vx + uy * vy;
    const c = vx * vx + vy * vy;
    const d = ux * wx + uy * wy;
    const e = vx * wx + vy * wy;
    const denominator = a * c - b * b;
    let s = denominator > 0.0001 ? Math.max(0, Math.min(1, (b * e - c * d) / denominator)) : 0;
    let t = c > 0.0001 ? (b * s + e) / c : 0;

    if (t < 0) {
      t = 0;
      s = a > 0.0001 ? Math.max(0, Math.min(1, -d / a)) : 0;
    } else if (t > 1) {
      t = 1;
      s = a > 0.0001 ? Math.max(0, Math.min(1, (b - d) / a)) : 0;
    }

    const nearestX = cx + vx * t;
    const nearestY = cy + vy * t;
    const dragonX = ax + ux * s;
    const dragonY = ay + uy * s;
    const dxNearest = nearestX - dragonX;
    const dyNearest = nearestY - dragonY;
    result.distanceSquared = dxNearest * dxNearest + dyNearest * dyNearest;
    result.edgeT = t;
  }

  private updateBrokenEdges(now: number) {
    let changed = false;
    for (const [sourceId, edgesFromSource] of this.brokenEdges) {
      for (const [destinationId, edge] of edgesFromSource) {
        edge.contactActive = edge.lastSeenFrame === this.frameNumber;
        if (edge.source.destroyed || edge.destination.destroyed || (!edge.contactActive && now - edge.startedAt >= BREAK_DURATION)) {
          edgesFromSource.delete(destinationId);
          changed = true;
        }
      }
      if (edgesFromSource.size === 0) this.brokenEdges.delete(sourceId);
    }
    return changed;
  }
}
