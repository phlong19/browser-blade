import { Color, Script, Entity, Vec3 } from "playcanvas";

const WEAPON_HIT_DETECTOR_VERSION = "timed-window-v2";
const ACTIVE_BLADE_DEBUG_COLOR = new Color(1, 0.8, 0);

export class WeaponHitDetector extends Script {
  static scriptName = "weaponHitDetector";

  /** Marker near the start of the blade. @attribute @type {Entity} */
  bladeBase;

  /** Marker at the physical blade tip. @attribute @type {Entity} */
  bladeTip;

  /** Entity whose hierarchy should never be detected. @attribute @type {Entity} */
  ownerEntity;

  /** Number of evenly spaced blade sweep samples. @attribute @type {number} */
  bladeSampleCount = 5;

  initialize() {
    this.activeAttackDirection = null;
    this.sweepActive = false;
    this.hitEntities = new Set();
    this.previousSamplePositions = [];
    this.currentSamplePositions = [];
    this.swordRoot = null;

    this.entity.on("combat:hitWindowStart", this.onHitWindowStart, this);
    this.entity.on("combat:hitWindowEnd", this.onHitWindowEnd, this);

    this.syncSamplePositions();

    console.log(
      `[WeaponHitDetectorVersion] ${WEAPON_HIT_DETECTOR_VERSION}`,
    );
    console.log(
      `[WeaponHitDetector:init] base=${this.bladeBase?.name ?? "missing"} tip=${this.bladeTip?.name ?? "missing"} owner=${this.ownerEntity?.name ?? "missing"} samples=${this.getSampleCount()}`,
    );

    if (!this.hasBladeMarkers()) {
      console.warn(
        "[WeaponHitDetector:init] BladeBase and BladeTip must both be assigned.",
      );
    }
  }

  onHitWindowStart(direction) {
    this.activeAttackDirection = direction;
    this.hitEntities.clear();
    this.swordRoot = this.findSwordRoot();
    this.syncSamplePositions();
    this.sweepActive = true;
  }

  onHitWindowEnd(direction) {
    if (direction !== this.activeAttackDirection) {
      return;
    }

    this.sweepActive = false;
    this.activeAttackDirection = null;
    this.hitEntities.clear();
    this.syncSamplePositions();
    this.swordRoot = null;
  }

  postUpdate() {
    if (!this.hasBladeMarkers()) {
      return;
    }

    if (!this.sweepActive) {
      this.syncSamplePositions();

      return;
    }

    const basePosition = this.bladeBase.getPosition();
    const tipPosition = this.bladeTip.getPosition();

    this.app.drawLine(
      basePosition,
      tipPosition,
      ACTIVE_BLADE_DEBUG_COLOR,
      false,
    );

    this.populateCurrentSamplePositions();

    for (let index = 0; index < this.currentSamplePositions.length; index += 1) {
      this.raycastSample(
        this.previousSamplePositions[index],
        this.currentSamplePositions[index],
      );
    }

    this.copyCurrentToPrevious();
  }

  hasBladeMarkers() {
    return Boolean(this.bladeBase && this.bladeTip);
  }

  getSampleCount() {
    const configuredCount = Math.floor(this.bladeSampleCount);

    return Number.isFinite(configuredCount)
      ? Math.max(2, configuredCount)
      : 5;
  }

  ensureSampleStorage() {
    const sampleCount = this.getSampleCount();

    if (this.previousSamplePositions.length === sampleCount) {
      return;
    }

    this.previousSamplePositions = Array.from(
      { length: sampleCount },
      () => new Vec3(),
    );
    this.currentSamplePositions = Array.from(
      { length: sampleCount },
      () => new Vec3(),
    );
  }

  populateCurrentSamplePositions() {
    this.ensureSampleStorage();

    const basePosition = this.bladeBase.getPosition();
    const tipPosition = this.bladeTip.getPosition();
    const sampleCount = this.currentSamplePositions.length;

    for (let index = 0; index < sampleCount; index += 1) {
      const progress = index / (sampleCount - 1);
      const sample = this.currentSamplePositions[index];

      sample.set(
        basePosition.x + (tipPosition.x - basePosition.x) * progress,
        basePosition.y + (tipPosition.y - basePosition.y) * progress,
        basePosition.z + (tipPosition.z - basePosition.z) * progress,
      );
    }
  }

  syncSamplePositions() {
    if (!this.hasBladeMarkers()) {
      return;
    }

    this.populateCurrentSamplePositions();
    this.copyCurrentToPrevious();
  }

  copyCurrentToPrevious() {
    for (let index = 0; index < this.currentSamplePositions.length; index += 1) {
      this.previousSamplePositions[index].copy(this.currentSamplePositions[index]);
    }
  }

  raycastSample(previousPosition, currentPosition) {
    const hits = this.app.systems.rigidbody.raycastAll(
      previousPosition,
      currentPosition,
      {
        filterCallback: (target) => {
          return (
            !this.shouldIgnoreEntity(target) && !this.hitEntities.has(target)
          );
        },
        sort: true,
      },
    );
    const closestHit = hits[0]?.entity;

    if (!closestHit) {
      return;
    }

    this.hitEntities.add(closestHit);

    const progress = this.entity.script?.combatController?.currentAttackProgress;
    const progressSuffix = Number.isFinite(progress)
      ? ` progress=${progress.toFixed(3)}`
      : "";

    console.log(
      `[WeaponHit] direction=${this.activeAttackDirection} target=${closestHit.name}${progressSuffix}`,
    );
  }

  shouldIgnoreEntity(target) {
    const owner = this.ownerEntity ?? this.entity;

    return (
      this.isInHierarchy(target, owner) ||
      this.isInHierarchy(target, this.swordRoot) ||
      this.isInHierarchy(target, this.bladeBase) ||
      this.isInHierarchy(target, this.bladeTip)
    );
  }

  isInHierarchy(target, ancestor) {
    for (let entity = target; entity; entity = entity.parent) {
      if (entity === ancestor) {
        return true;
      }
    }

    return false;
  }

  findSwordRoot() {
    if (!this.hasBladeMarkers()) {
      return null;
    }

    const baseAncestors = new Set();

    for (let entity = this.bladeBase; entity; entity = entity.parent) {
      baseAncestors.add(entity);
    }

    for (let entity = this.bladeTip; entity; entity = entity.parent) {
      if (baseAncestors.has(entity)) {
        return entity;
      }
    }

    return null;
  }

  destroy() {
    this.entity.off("combat:hitWindowStart", this.onHitWindowStart, this);
    this.entity.off("combat:hitWindowEnd", this.onHitWindowEnd, this);

    this.sweepActive = false;
    this.activeAttackDirection = null;
    this.hitEntities.clear();
    this.previousSamplePositions.length = 0;
    this.currentSamplePositions.length = 0;
    this.swordRoot = null;
  }
}
