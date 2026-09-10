import { Script, Mouse, MOUSEBUTTON_LEFT, Entity, Vec3 } from "playcanvas";

const INDICATOR_LAYOUT = {
  // The arrow sits outside the center and points inward toward it.
  overhead: { x: 0, y: 1, rotation: 180 },
  right: { x: 1, y: 0, rotation: 90 },
  thrust: { x: 0, y: -1, rotation: 0 },
  left: { x: -1, y: 0, rotation: -90 },
};

const ATTACKS = {
  right: { index: 0, state: "AttackRight" },
  left: { index: 1, state: "AttackLeft" },
  overhead: { index: 2, state: "AttackOverhead" },
  thrust: { index: 3, state: "AttackThrust" },
};
const DIRECTION_DOMINANCE = 1.2;

export class CombatController extends Script {
  static scriptName = "combatController";

  /** Minimum accumulated mouse movement before a direction is selected. @attribute @type {number} */
  directionThreshold = 18;
  /** Seconds a preview remains visible after its gesture completes. @attribute @type {number} */
  previewHoldTime = 0.25;
  /** Seconds the direction preview takes to fade out after its hold. @attribute @type {number} */
  previewFadeTime = 0.2;
  /** Attack progress at which mouse gestures can select the next attack direction. @attribute @type {number} */
  directionUnlockProgress = 0.25;
  /** Attack progress at which one follow-up request can be accepted. @attribute @type {number} */
  nextAttackReadyProgress = 0.9;
  /** Fraction of screen width used for left/right arrow placement. @attribute @type {number} */
  horizontalOffsetFactor = 0.25;
  /** Fraction of screen height used for up/down arrow placement. @attribute @type {number} */
  verticalOffsetFactor = 0.2;
  /** Persistent scene UI entity used for the single direction arrow. @attribute @type {Entity} */
  directionIndicator;
  /** Entity containing the existing runtime Anim graph. @attribute @type {Entity} */
  animEntity;
  /** WeaponAnchor_R entity used to locate the bone attachment. @attribute @type {Entity} */
  weaponAnchor;
  /** Local WeaponSocket_R Euler rotation during AttackThrust. @attribute @type {Vec3} */
  thrustWeaponEulerOffset = new Vec3(0, 90, 0);

  initialize() {
    this.state = "idle";
    this.selectedDirection = null;
    this.currentAttackDirection = null;
    this.nextAttackDirection = null;
    this.directionDx = 0;
    this.directionDy = 0;
    this.pointerLockWasActive = false;
    this.ignoreLeftUntilReleased = false;
    this.leftPressActive = false;
    this.attackStateSeen = false;
    this.attackStateName = null;
    this.previewElapsed = 0;
    this.didWarnMissingIndicator = false;
    this.didWarnMissingWeaponAnchor = false;

    this.hideDirectionIndicator();
    this.app.mouse.on(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
    console.log("[Combat] initialized");
  }

  update(dt) {
    const mouse = this.app.mouse;
    const locked = Mouse.isPointerLocked();

    if (!locked) {
      this.hideDirectionIndicator();
      this.directionDx = 0;
      this.directionDy = 0;
      this.nextAttackDirection = null;
      this.leftPressActive = false;
      this.pointerLockWasActive = false;
      this.ignoreLeftUntilReleased = false;
      this.updateAttackCycle();
      return;
    }

    this.updateAttackCycle();
    this.updateDirectionPreview(dt);

    if (this.state === "attacking" && !this.isDirectionTrackingUnlocked()) {
      this.directionDx = 0;
      this.directionDy = 0;
    }

    if (!this.pointerLockWasActive) {
      this.pointerLockWasActive = true;
      if (mouse.isPressed(MOUSEBUTTON_LEFT)) this.ignoreLeftUntilReleased = true;
    }

    if (this.ignoreLeftUntilReleased) {
      if (!mouse.isPressed(MOUSEBUTTON_LEFT)) {
        this.ignoreLeftUntilReleased = false;
      }
      return;
    }

    if (mouse.wasPressed(MOUSEBUTTON_LEFT)) {
      this.leftPressActive = true;
    }

    if (this.leftPressActive && mouse.wasReleased(MOUSEBUTTON_LEFT)) {
      this.leftPressActive = false;
      this.handleAttackInput();
    }
  }

  onMouseMove(event) {
    if (!Mouse.isPointerLocked() || !this.isDirectionTrackingUnlocked()) {
      this.directionDx = 0;
      this.directionDy = 0;
      return;
    }

    this.directionDx += event.dx;
    this.directionDy += event.dy;

    if (Math.hypot(this.directionDx, this.directionDy) < this.directionThreshold) {
      return;
    }

    const direction = this.classifyDirection(this.directionDx, this.directionDy);
    this.directionDx = 0;
    this.directionDy = 0;

    if (!direction) return;

    this.selectedDirection = direction;
    this.showDirectionPreview(direction);
    console.log(`[Combat] selected direction: ${this.selectedDirection}`);
  }

  classifyDirection(x, y) {
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absX > absY * DIRECTION_DOMINANCE) {
      return x > 0 ? "right" : "left";
    }

    // PlayCanvas pointer-lock dy < 0 is an upward mouse gesture.
    if (absY > absX * DIRECTION_DOMINANCE) {
      return y < 0 ? "overhead" : "thrust";
    }

    return null;
  }

  handleAttackInput() {
    if (this.state === "idle") {
      if (!this.selectedDirection) return;
      this.startAttack(this.selectedDirection);
      return;
    }

    if (
      this.state !== "attacking" ||
      this.nextAttackDirection ||
      !this.selectedDirection ||
      !this.isReadyForNextAttack()
    ) {
      return;
    }

    this.nextAttackDirection = this.selectedDirection;
    console.log(`[Combat] follow-up requested: ${this.nextAttackDirection}`);
  }

  updateAttackCycle() {
    if (this.state !== "attacking") return;

    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");

    if (!layer) {
      this.clearWeaponPoseOffset();
      this.state = "idle";
      this.currentAttackDirection = null;
      this.nextAttackDirection = null;
      return;
    }

    if (layer.activeState === this.attackStateName) {
      this.attackStateSeen = true;
      return;
    }

    if (
      this.attackStateSeen &&
      layer.activeState === "CombatIdle" &&
      !layer.transitioning
    ) {
      this.state = "idle";
      this.attackStateSeen = false;
      this.attackStateName = null;
      this.clearWeaponPoseOffset();

      console.log("[Combat] attack complete");

      const nextDirection = this.nextAttackDirection;
      this.nextAttackDirection = null;
      this.currentAttackDirection = null;

      if (nextDirection) {
        this.startAttack(nextDirection);
      } else {
        layer.blendToWeight(0, 0.12);
      }
    }
  }

  isDirectionTrackingUnlocked() {
    if (this.state !== "attacking") return true;

    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");
    return (
      layer?.activeState === this.attackStateName &&
      typeof layer.activeStateProgress === "number" &&
      layer.activeStateProgress >= this.directionUnlockProgress
    );
  }

  isReadyForNextAttack() {
    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");
    return (
      layer?.activeState === this.attackStateName &&
      typeof layer.activeStateProgress === "number" &&
      layer.activeStateProgress >= this.nextAttackReadyProgress
    );
  }

  updateDirectionPreview(dt) {
    if (!this.directionIndicator?.enabled) return;

    this.previewElapsed += dt;
    if (this.previewElapsed <= this.previewHoldTime) return;

    const fadeElapsed = this.previewElapsed - this.previewHoldTime;
    if (fadeElapsed >= this.previewFadeTime) {
      this.hideDirectionIndicator();
      return;
    }

    const element = this.directionIndicator.element;
    if (element) element.opacity = 1 - fadeElapsed / this.previewFadeTime;
  }

  showDirectionPreview(direction) {
    this.previewElapsed = 0;
    this.updateDirectionIndicator(direction);
    const element = this.directionIndicator?.element;
    if (element) element.opacity = 1;
  }

  updateDirectionIndicator(direction) {
    if (!direction) {
      this.hideDirectionIndicator();
      return;
    }

    if (!this.directionIndicator) {
      if (!this.didWarnMissingIndicator) {
        this.didWarnMissingIndicator = true;
        console.warn("[Combat] directionIndicator is not assigned.");
      }
      return;
    }

    const layout = INDICATOR_LAYOUT[direction];
    const screen = this.directionIndicator.parent?.screen;
    const resolution = screen?.referenceResolution;
    const width = resolution?.x ?? resolution?.[0] ?? 1280;
    const height = resolution?.y ?? resolution?.[1] ?? 720;
    this.directionIndicator.setLocalPosition(
      layout.x * width * this.horizontalOffsetFactor,
      layout.y * height * this.verticalOffsetFactor,
      0,
    );
    this.directionIndicator.setLocalEulerAngles(0, 0, layout.rotation);
    this.directionIndicator.enabled = true;
  }

  hideDirectionIndicator() {
    if (this.directionIndicator) {
      this.directionIndicator.enabled = false;
      const element = this.directionIndicator.element;
      if (element) element.opacity = 1;
    }
  }

  applyThrustWeaponPose() {
    if (!this.weaponAnchor) {
      if (!this.didWarnMissingWeaponAnchor) {
        this.didWarnMissingWeaponAnchor = true;
        console.warn("[Combat] weaponAnchor is not assigned.");
      }
      return;
    }

    this.weaponAnchor.fire(
      "weapon:pose",
      this.thrustWeaponEulerOffset.x,
      this.thrustWeaponEulerOffset.y,
      this.thrustWeaponEulerOffset.z,
    );
  }

  clearWeaponPoseOffset() {
    this.weaponAnchor?.fire("weapon:clearPose");
  }

  startAttack(direction) {
    this.state = "attacking";
    this.currentAttackDirection = direction;
    this.attackStateSeen = false;
    this.executeAttack();
  }

  executeAttack() {
    const direction = this.currentAttackDirection;
    const anim = this.animEntity?.anim;
    if (!anim) {
      console.warn(`[Combat] missing attack animation for: ${direction}`);
      this.clearWeaponPoseOffset();
      this.state = "idle";
      this.currentAttackDirection = null;
      this.attackStateName = null;
      this.attackStateSeen = false;
      return;
    }

    const combatLayer = anim.findAnimationLayer("Combat");

    if (!combatLayer) {
      console.warn("[Combat] Combat animation layer is unavailable.");
      this.clearWeaponPoseOffset();
      this.state = "idle";
      this.currentAttackDirection = null;
      this.attackStateName = null;
      this.attackStateSeen = false;
      return;
    }

    const attack = ATTACKS[direction];

    if (!attack || !combatLayer.states.includes(attack.state)) {
      console.warn(`[Combat] attack unavailable for: ${direction}`);
      this.clearWeaponPoseOffset();
      this.state = "idle";
      this.currentAttackDirection = null;
      this.attackStateName = null;
      this.attackStateSeen = false;
      return;
    }

    this.attackStateName = attack.state;
    combatLayer.blendToWeight(1, 0.1);

    anim.setInteger("attackDirection", attack.index);
    this.entity.fire("combat:faceView");
    anim.setTrigger("attack");

    if (direction === "thrust") {
      this.applyThrustWeaponPose();
    }

    console.log(`[Combat] play animation: ${attack.state}`);
  }

  destroy() {
    this.clearWeaponPoseOffset();
    this.app.mouse.off(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
  }
}
