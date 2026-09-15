import {
  Script,
  Mouse,
  MOUSEBUTTON_LEFT,
  MOUSEBUTTON_RIGHT,
  Entity,
  Vec3,
} from "playcanvas";

const COMBAT_DEBUG_VERSION = "generic-chamber-right-overhead-v1";

const INDICATOR_LAYOUT = {
  overhead: { x: 0, y: 1, rotation: 180 },
  right: { x: 1, y: 0, rotation: 90 },
  thrust: { x: 0, y: -1, rotation: 0 },
  left: { x: -1, y: 0, rotation: -90 },
};

const ATTACKS = {
  right: {
    index: 0,
    state: "AttackRight",
    chamberProgressKey: "rightChamberProgress",
  },
  left: {
    index: 1,
    state: "AttackLeft",
  },
  overhead: {
    index: 2,
    state: "AttackOverhead",
    chamberProgressKey: "overheadChamberProgress",
  },
  thrust: {
    index: 3,
    state: "AttackThrust",
  },
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

  /** Attack progress at which mouse gestures can select a future attack direction. @attribute @type {number} */
  directionUnlockProgress = 0.25;

  /** Attack progress at which a new LMB press may buffer one next attack. @attribute @type {number} */
  recoveryStartProgress = 0.5;

  /** AttackRight progress at which a held input pins the Combat layer time. @attribute @type {number} */
  rightChamberProgress = 0.4;

  /** AttackOverhead progress at which a held input pins the Combat layer time. @attribute @type {number} */
  overheadChamberProgress = 0.4;

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

  /** Local WeaponSocket_R position correction during AttackThrust. @attribute @type {Vec3} */
  thrustWeaponPositionOffset = new Vec3(0, 0, 0);

  /** Local WeaponSocket_R Euler rotation correction during AttackThrust. @attribute @type {Vec3} */
  thrustWeaponEulerOffset = new Vec3(45, 0, 0);

  initialize() {
    this.state = "idle";
    this.selectedDirection = null;
    this.currentAttackDirection = null;

    // Ownership of the current physical LMB press:
    // none | current | pending | rejected.
    this.lmbPressOwner = "none";

    // At most one buffered recovery input.
    // Its direction remains live while held and is captured on release
    // or when the next held attack commits.
    this.pendingInputActive = false;
    this.pendingAttackDirection = null;
    this.pendingInputHeld = false;
    this.pendingReleaseRequested = false;

    this.recoveryOpen = false;
    this.attackCancelRequested = false;

    this.directionDx = 0;
    this.directionDy = 0;
    this.pointerLockWasActive = false;
    this.ignoreLeftUntilReleased = false;

    // Generic chamber state.
    // Right + Overhead are chamber-enabled in this milestone.
    this.chamberInputActive = false;
    this.releaseRequested = false;
    this.chamberHolding = false;
    this.chamberHoldTime = null;

    this.attackStateSeen = false;
    this.attackStateName = null;

    this.previewElapsed = 0;
    this.didWarnMissingIndicator = false;
    this.didWarnMissingWeaponAnchor = false;

    this.hideDirectionIndicator();

    this.app.mouse.on(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);

    console.log(`[CombatVersion] ${COMBAT_DEBUG_VERSION}`);

    console.log("[Combat] initialized");
  }

  update(dt) {
    const mouse = this.app.mouse;
    const locked = Mouse.isPointerLocked();

    if (!locked) {
      this.handlePointerLockLost(mouse);
      this.updateAttackCycle();
      return;
    }

    this.updateAttackCycle();
    this.pinChamberTime();
    this.updateDirectionPreview(dt);

    if (this.state === "attacking" && !this.isDirectionTrackingUnlocked()) {
      this.directionDx = 0;
      this.directionDy = 0;
    }

    if (!this.pointerLockWasActive) {
      this.pointerLockWasActive = true;

      if (mouse.isPressed(MOUSEBUTTON_LEFT)) {
        this.ignoreLeftUntilReleased = true;
        this.lmbPressOwner = "none";
      }
    }

    if (this.ignoreLeftUntilReleased) {
      if (!mouse.isPressed(MOUSEBUTTON_LEFT)) {
        this.ignoreLeftUntilReleased = false;
      }

      return;
    }

    if (mouse.wasPressed(MOUSEBUTTON_LEFT)) {
      this.handleLmbDown();
    }

    if (mouse.wasPressed(MOUSEBUTTON_RIGHT)) {
      this.handleCancelInput();
    }

    if (mouse.wasReleased(MOUSEBUTTON_LEFT)) {
      this.handleLmbUp();
    }
  }

  handlePointerLockLost(mouse) {
    if (this.pointerLockWasActive) {
      if (this.chamberInputActive || this.chamberHolding) {
        this.cancelCurrentPreparation("pointer-lock-lost");
      }

      this.clearPendingAttack();
      this.lmbPressOwner = "none";
    }

    this.hideDirectionIndicator();

    this.directionDx = 0;
    this.directionDy = 0;
    this.pointerLockWasActive = false;

    if (!mouse.isPressed(MOUSEBUTTON_LEFT)) {
      this.ignoreLeftUntilReleased = false;
    }
  }

  handleLmbDown() {
    if (this.lmbPressOwner !== "none") {
      return;
    }

    if (this.state === "idle") {
      // Accept the physical press but do not freeze direction yet.
      //
      // Quick attacks use the latest selected direction at release.
      // A fresh gesture in a chamber-enabled direction can commit the
      // held press before release.
      this.lmbPressOwner = "current";

      console.log("[CombatInput:CURRENT]");

      return;
    }

    if (this.state !== "attacking") {
      this.rejectCurrentLmbPress("invalid-state");

      return;
    }

    if (!this.recoveryOpen) {
      this.rejectCurrentLmbPress("before-recovery");

      return;
    }

    if (this.pendingInputActive) {
      this.rejectCurrentLmbPress("pending-already-exists");

      return;
    }

    this.lmbPressOwner = "pending";

    this.pendingInputActive = true;
    this.pendingAttackDirection = null;
    this.pendingInputHeld = true;
    this.pendingReleaseRequested = false;

    console.log("[CombatInput:PENDING]");
  }

  handleLmbUp() {
    switch (this.lmbPressOwner) {
      case "rejected": {
        this.lmbPressOwner = "none";
        return;
      }

      case "pending": {
        // DOWN occurred during valid recovery.
        // Capture the final quick-attack direction on release.
        this.pendingInputHeld = false;
        this.pendingReleaseRequested = true;

        this.pendingAttackDirection = this.selectedDirection;

        this.lmbPressOwner = "none";

        console.log(
          `[CombatInput:PENDING_RELEASE] direction=${this.pendingAttackDirection ?? "none"}`,
        );

        return;
      }

      case "current": {
        if (
          this.state === "attacking" &&
          (this.chamberInputActive || this.chamberHolding)
        ) {
          this.releaseChamberInput();

          this.lmbPressOwner = "none";
          return;
        }

        if (this.state === "idle") {
          // Quick attacks commit direction on release.
          const direction = this.selectedDirection;

          this.lmbPressOwner = "none";

          if (direction) {
            this.startAttack(direction, false);
          }

          return;
        }

        // An old release never becomes a new attack later.
        this.lmbPressOwner = "none";
        return;
      }

      case "none":
      default:
        return;
    }
  }

  rejectCurrentLmbPress(reason) {
    this.lmbPressOwner = "rejected";

    console.log(`[CombatInput:REJECTED] reason=${reason}`);
  }

  handleCancelInput() {
    const mouse = this.app.mouse;

    if (this.pendingInputActive) {
      const pendingPressStillHeld =
        this.lmbPressOwner === "pending" && mouse.isPressed(MOUSEBUTTON_LEFT);

      this.clearPendingAttack();

      if (pendingPressStillHeld) {
        this.lmbPressOwner = "rejected";
      } else if (this.lmbPressOwner === "pending") {
        this.lmbPressOwner = "none";
      }

      console.log("[CombatInput:CANCEL] pending");

      return;
    }

    if (this.chamberInputActive || this.chamberHolding) {
      this.cancelCurrentPreparation("rmb");

      return;
    }

    if (this.state === "idle" && this.lmbPressOwner === "current") {
      this.lmbPressOwner = mouse.isPressed(MOUSEBUTTON_LEFT)
        ? "rejected"
        : "none";

      console.log("[CombatInput:CANCEL] prepared");
    }
  }

  cancelCurrentPreparation(reason) {
    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");

    const mouse = this.app.mouse;
    const direction = this.currentAttackDirection;

    this.clearChamberState();

    this.lmbPressOwner = mouse.isPressed(MOUSEBUTTON_LEFT)
      ? "rejected"
      : "none";

    this.attackCancelRequested = true;
    this.recoveryOpen = false;

    if (layer?.states.includes("CombatIdle")) {
      layer.transition("CombatIdle", 0.1);
    } else {
      this.resetCurrentAttackAfterFailure();
    }

    console.log(
      `[CombatInput:CANCEL] current=${direction ?? "none"} reason=${reason}`,
    );
  }

  onMouseMove(event) {
    if (!Mouse.isPointerLocked() || !this.isDirectionTrackingUnlocked()) {
      this.directionDx = 0;
      this.directionDy = 0;
      return;
    }

    this.directionDx += event.dx;
    this.directionDy += event.dy;

    if (
      Math.hypot(this.directionDx, this.directionDy) < this.directionThreshold
    ) {
      return;
    }

    const direction = this.classifyDirection(
      this.directionDx,
      this.directionDy,
    );

    this.directionDx = 0;
    this.directionDy = 0;

    if (!direction) return;

    const selectionChanged = direction !== this.selectedDirection;

    if (selectionChanged) {
      this.selectedDirection = direction;

      this.showDirectionPreview(direction);

      console.log(`[Combat] selected direction: ${direction}`);
    }

    // A fresh chamber-enabled gesture matters even if the persisted
    // selectedDirection was already identical from the previous attack.
    if (
      this.isChamberEnabledDirection(direction) &&
      this.lmbPressOwner === "current" &&
      this.state === "idle" &&
      this.app.mouse.isPressed(MOUSEBUTTON_LEFT)
    ) {
      this.startAttack(direction, true);
    }
  }

  classifyDirection(x, y) {
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absX > absY * DIRECTION_DOMINANCE) {
      return x > 0 ? "right" : "left";
    }

    if (absY > absX * DIRECTION_DOMINANCE) {
      return y < 0 ? "overhead" : "thrust";
    }

    return null;
  }

  updateAttackCycle() {
    if (this.state !== "attacking") {
      return;
    }

    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");

    if (!layer) {
      this.resetCurrentAttackAfterFailure();
      return;
    }

    if (layer.activeState === this.attackStateName) {
      this.attackStateSeen = true;

      if (
        !this.recoveryOpen &&
        typeof layer.activeStateProgress === "number" &&
        layer.activeStateProgress >= this.recoveryStartProgress
      ) {
        this.recoveryOpen = true;

        console.log(
          `[CombatInput:RECOVERY_OPEN] direction=${this.currentAttackDirection} progress=${layer.activeStateProgress.toFixed(3)}`,
        );
      }

      this.updateChamber(layer);
      return;
    }

    if (
      (this.attackStateSeen || this.attackCancelRequested) &&
      layer.activeState === "CombatIdle" &&
      !layer.transitioning
    ) {
      this.completeCurrentAttack(layer);
    }
  }

  completeCurrentAttack(layer) {
    const wasCanceled = this.attackCancelRequested;

    const hadPendingInput = this.pendingInputActive;

    const pendingDirection = this.pendingAttackDirection;

    const pendingInputHeld = this.pendingInputHeld;

    const pendingReleaseRequested = this.pendingReleaseRequested;

    this.clearChamberState();
    this.clearWeaponPoseOffset();

    this.state = "idle";

    this.currentAttackDirection = null;

    this.attackStateSeen = false;
    this.attackStateName = null;

    this.recoveryOpen = false;
    this.attackCancelRequested = false;

    this.clearPendingAttack();

    console.log(
      wasCanceled ? "[Combat] attack canceled" : "[Combat] attack complete",
    );

    if (wasCanceled || !hadPendingInput) {
      layer.blendToWeight(0, 0.12);

      return;
    }

    if (pendingInputHeld && !pendingReleaseRequested) {
      // Attack A finished while the accepted recovery press
      // is still physically held.
      //
      // Direction remains live until the next attack commits.
      this.lmbPressOwner = "current";

      console.log(
        `[CombatInput:PENDING_START] held=true direction=${this.selectedDirection ?? "none"}`,
      );

      if (this.isChamberEnabledDirection(this.selectedDirection)) {
        this.startAttack(this.selectedDirection, true);
      } else {
        // Left and Thrust remain release-driven for now.
        layer.blendToWeight(0, 0.12);
      }

      return;
    }

    // Released pending inputs captured their direction on that release.
    console.log(
      `[CombatInput:PENDING_START] held=false direction=${pendingDirection ?? "none"}`,
    );

    if (pendingDirection) {
      this.startAttack(pendingDirection, false);
    } else {
      layer.blendToWeight(0, 0.12);
    }
  }

  clearPendingAttack() {
    this.pendingInputActive = false;
    this.pendingAttackDirection = null;
    this.pendingInputHeld = false;
    this.pendingReleaseRequested = false;
  }

  resetCurrentAttackAfterFailure() {
    this.clearWeaponPoseOffset();
    this.clearChamberState();
    this.clearPendingAttack();

    this.state = "idle";

    this.currentAttackDirection = null;
    this.attackStateName = null;
    this.attackStateSeen = false;

    this.recoveryOpen = false;
    this.attackCancelRequested = false;

    if (
      this.lmbPressOwner === "current" &&
      this.app.mouse.isPressed(MOUSEBUTTON_LEFT)
    ) {
      this.lmbPressOwner = "rejected";
    } else if (this.lmbPressOwner !== "rejected") {
      this.lmbPressOwner = "none";
    }
  }

  isDirectionTrackingUnlocked() {
    if (this.state !== "attacking") {
      return true;
    }

    if (this.recoveryOpen) {
      return true;
    }

    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");

    return (
      layer?.activeState === this.attackStateName &&
      typeof layer.activeStateProgress === "number" &&
      layer.activeStateProgress >= this.directionUnlockProgress
    );
  }

  isChamberEnabledDirection(direction) {
    return Boolean(direction && ATTACKS[direction]?.chamberProgressKey);
  }

  getChamberProgress(direction) {
    const progressKey = direction && ATTACKS[direction]?.chamberProgressKey;

    return progressKey ? this[progressKey] : null;
  }

  updateChamber(layer) {
    const direction = this.currentAttackDirection;

    const attack = direction && ATTACKS[direction];

    const chamberProgress = this.getChamberProgress(direction);

    if (
      !attack?.chamberProgressKey ||
      layer.activeState !== attack.state ||
      this.chamberHolding ||
      !this.chamberInputActive ||
      this.releaseRequested ||
      typeof layer.activeStateProgress !== "number" ||
      typeof chamberProgress !== "number" ||
      layer.activeStateProgress < chamberProgress
    ) {
      return;
    }

    this.chamberHoldTime = layer.activeStateCurrentTime;

    this.chamberHolding = true;
  }

  releaseChamberInput() {
    if (!this.chamberInputActive && !this.chamberHolding) {
      return;
    }

    this.chamberInputActive = false;
    this.releaseRequested = true;
    this.chamberHolding = false;
    this.chamberHoldTime = null;
  }

  clearChamberState() {
    this.chamberInputActive = false;
    this.releaseRequested = false;
    this.chamberHolding = false;
    this.chamberHoldTime = null;
  }

  pinChamberTime() {
    const direction = this.currentAttackDirection;

    const attack = direction && ATTACKS[direction];

    if (
      !attack?.chamberProgressKey ||
      !this.chamberHolding ||
      this.chamberHoldTime === null
    ) {
      return;
    }

    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");

    if (layer?.activeState !== attack.state) {
      return;
    }

    layer.activeStateCurrentTime = this.chamberHoldTime;
  }

  updateDirectionPreview(dt) {
    if (!this.directionIndicator?.enabled) {
      return;
    }

    this.previewElapsed += dt;

    if (this.previewElapsed <= this.previewHoldTime) {
      return;
    }

    const fadeElapsed = this.previewElapsed - this.previewHoldTime;

    if (fadeElapsed >= this.previewFadeTime) {
      this.hideDirectionIndicator();
      return;
    }

    const element = this.directionIndicator.element;

    if (element) {
      element.opacity = 1 - fadeElapsed / this.previewFadeTime;
    }
  }

  showDirectionPreview(direction) {
    this.previewElapsed = 0;

    this.updateDirectionIndicator(direction);

    const element = this.directionIndicator?.element;

    if (element) {
      element.opacity = 1;
    }
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
    if (!this.directionIndicator) {
      return;
    }

    this.directionIndicator.enabled = false;

    const element = this.directionIndicator.element;

    if (element) {
      element.opacity = 1;
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

      this.thrustWeaponPositionOffset.x,
      this.thrustWeaponPositionOffset.y,
      this.thrustWeaponPositionOffset.z,

      this.thrustWeaponEulerOffset.x,
      this.thrustWeaponEulerOffset.y,
      this.thrustWeaponEulerOffset.z,
    );
  }

  clearWeaponPoseOffset() {
    this.weaponAnchor?.fire("weapon:clearPose");
  }

  startAttack(direction, chamberInputActive = false) {
    this.clearChamberState();

    if (this.isChamberEnabledDirection(direction)) {
      this.chamberInputActive = chamberInputActive;

      this.releaseRequested = !chamberInputActive;
    }

    this.state = "attacking";

    this.currentAttackDirection = direction;

    this.attackStateSeen = false;
    this.attackStateName = null;

    this.recoveryOpen = false;
    this.attackCancelRequested = false;

    this.executeAttack();
  }

  executeAttack() {
    const direction = this.currentAttackDirection;

    const anim = this.animEntity?.anim;

    if (!anim) {
      console.warn(`[Combat] missing attack animation for: ${direction}`);

      this.resetCurrentAttackAfterFailure();
      return;
    }

    const combatLayer = anim.findAnimationLayer("Combat");

    if (!combatLayer) {
      console.warn("[Combat] Combat animation layer is unavailable.");

      this.resetCurrentAttackAfterFailure();
      return;
    }

    const attack = ATTACKS[direction];

    if (!attack || !combatLayer.states.includes(attack.state)) {
      console.warn(`[Combat] attack unavailable for: ${direction}`);

      this.resetCurrentAttackAfterFailure();
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
    this.clearPendingAttack();
    this.clearChamberState();
    this.clearWeaponPoseOffset();

    this.app.mouse.off(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
  }
}
