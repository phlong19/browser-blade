import { Script, Mouse, MOUSEBUTTON_LEFT, Entity } from "playcanvas";

const INDICATOR_LAYOUT = {
  // The arrow sits outside the center and points inward toward it.
  overhead: { x: 0, y: 1, rotation: 180 },
  right: { x: 1, y: 0, rotation: 90 },
  thrust: { x: 0, y: -1, rotation: 0 },
  left: { x: -1, y: 0, rotation: -90 },
};

export class CombatController extends Script {
  static scriptName = "combatController";

  /** Minimum mouse gesture magnitude before a direction is selected. @attribute @type {number} */
  directionThreshold = 12;
  /** Seconds a preview remains visible after its gesture completes. @attribute @type {number} */
  previewHoldTime = 0.25;
  /** Fraction of screen width used for left/right arrow placement. @attribute @type {number} */
  horizontalOffsetFactor = 0.25;
  /** Fraction of screen height used for up/down arrow placement. @attribute @type {number} */
  verticalOffsetFactor = 0.2;
  /** Persistent scene UI entity used for the single direction arrow. @attribute @type {Entity} */
  directionIndicator;
  /** Entity containing the existing runtime Anim graph. @attribute @type {Entity} */
  animEntity;

  initialize() {
    this.state = "idle";
    this.previewDirection = null;
    this.attackDirection = null;
    this.previewX = 0;
    this.previewY = 0;
    this.previewTimer = 0;
    this.pointerLockWasActive = false;
    this.ignoreLeftUntilReleased = false;
    this.attackStateSeen = false;
    this.lastCombatDiagnosticState = null;
    this.didWarnMissingIndicator = false;

    this.hideDirectionIndicator();
    this.app.mouse.on(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
    console.log("[Combat] initialized");
  }

  update(dt) {
    const mouse = this.app.mouse;
    const locked = Mouse.isPointerLocked();

    this.updateAttackCycle();

    if (!locked) {
      if (this.state === "prepared") this.cancelTracking();
      this.pointerLockWasActive = false;
      this.ignoreLeftUntilReleased = false;
      this.previewTimer = 0;
      this.hideDirectionIndicator();
      return;
    }

    if (!this.pointerLockWasActive) {
      this.pointerLockWasActive = true;
      if (mouse.isPressed(MOUSEBUTTON_LEFT)) this.ignoreLeftUntilReleased = true;
    }

    if (this.ignoreLeftUntilReleased) {
      if (!mouse.isPressed(MOUSEBUTTON_LEFT)) this.ignoreLeftUntilReleased = false;
    } else if (this.state === "idle" && mouse.wasPressed(MOUSEBUTTON_LEFT)) {
      this.beginTracking();
    } else if (this.state === "prepared" && mouse.wasReleased(MOUSEBUTTON_LEFT)) {
      this.finishTracking();
    }

    if (this.state === "idle" || this.state === "attacking") {
      this.previewTimer -= dt;
      if (this.previewTimer <= 0) this.hideDirectionIndicator();
    }
  }

  onMouseMove(event) {
    if (!Mouse.isPointerLocked()) return;

    this.previewX += event.dx;
    this.previewY += event.dy;

    if (Math.hypot(this.previewX, this.previewY) < this.directionThreshold) return;

    const direction = this.classifyDirection(this.previewX, this.previewY);
    this.previewX = 0;
    this.previewY = 0;
    this.previewTimer = this.previewHoldTime;

    if (direction !== this.previewDirection) {
      this.previewDirection = direction;
      console.log(`[Combat] preview: ${direction}`);
    }

    if (this.state === "prepared") this.attackDirection = direction;
    this.updateDirectionIndicator(direction);
  }

  classifyDirection(x, y) {
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
    // PlayCanvas pointer-lock dy < 0 is an upward mouse gesture.
    return y < 0 ? "overhead" : "thrust";
  }

  beginTracking() {
    this.state = "prepared";
    this.attackDirection = this.previewDirection ?? "right";
    if (this.attackDirection) this.updateDirectionIndicator(this.attackDirection);
    console.log(`[Combat] attack begin: ${this.attackDirection ?? "none"}`);
  }

  finishTracking() {
    const direction = this.attackDirection ?? "right";
    console.log(`[Combat] execute: ${direction}`);
    this.state = "attacking";
    this.attackStateSeen = false;
    this.attackDirection = null;
    this.hideDirectionIndicator();
    this.executeAttack(direction);
  }

  updateAttackCycle() {
    if (this.state !== "attacking") return;

    const layer = this.animEntity?.anim?.findAnimationLayer("Combat");

    if (!layer) {
      this.state = "idle";
      return;
    }

    this.logCombatState(layer);

    if (layer.activeState === "AttackRight") {
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

      layer.blendToWeight(0, 0.12);

      console.log("[Combat] attack complete");
    }
  }

  cancelTracking() {
    this.state = "idle";
    this.attackDirection = null;
    this.previewX = 0;
    this.previewY = 0;
    this.hideDirectionIndicator();
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
    if (this.directionIndicator) this.directionIndicator.enabled = false;
  }

  executeAttack(direction) {
    const anim = this.animEntity?.anim;
    if (!anim) {
      console.warn(`[Combat] missing attack animation for: ${direction}`);

      return;
    }

    const combatLayer = anim.findAnimationLayer("Combat");

    if (!combatLayer) {
      console.warn("[Combat] Combat animation layer is unavailable.");

      return;
    }

    // The only imported combat clip is Attack Downward, assigned by the
    // runtime graph to AttackRight as a temporary fallback for every direction.

    combatLayer.blendToWeight(1, 0.1);

    anim.setTrigger("attack");
    this.lastCombatDiagnosticState = null;
    this.logCombatState(combatLayer);
    console.log("[Combat] play animation: AttackRight (Attack Downward)");
  }

  logCombatState(layer) {
    const diagnosticState = `${layer.activeState}|${layer.transitioning}`;
    if (diagnosticState === this.lastCombatDiagnosticState) return;

    this.lastCombatDiagnosticState = diagnosticState;
    console.log(`[Combat] activeState: ${layer.activeState}`);
    console.log(`[Combat] weight: ${layer.weight}`);
    console.log(`[Combat] transitioning: ${layer.transitioning}`);
  }

  destroy() {
    this.app.mouse.off(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
  }
}
