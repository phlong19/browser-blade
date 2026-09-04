import { Script, Entity, Vec3, Mouse } from "playcanvas";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export class FollowCamera extends Script {
  static scriptName = "followCamera";

  /** Orbit anchor, assigned to the Player's CameraTarget entity. @attribute @type {Entity} */
  target;
  /** Distance from CameraTarget. @attribute @type {number} */
  distance = 2.6;
  /** Starting yaw around CameraTarget, in degrees. @attribute @type {number} */
  initialYaw = 0;
  /** Starting elevation around CameraTarget, in degrees. @attribute @type {number} */
  initialElevation = 3;
  /** Mouse sensitivity. @attribute @type {number} */
  sensitivity = 0.15;
  /** Highest camera elevation. @attribute @type {number} */
  maxElevation = 89.5;
  /** Ground height used by the lower elevation clamp. @attribute @type {number} */
  groundY = 0;
  /** Minimum camera height above ground. @attribute @type {number} */
  groundClearance = 0.25;

  initialize() {
    this.offset = new Vec3();
    this.didWarnMissingTarget = false;

    // Runtime composition uses configured values, never the editor transform.
    this.yaw = this.initialYaw;
    this.elevation = this.initialElevation;
    this.clampElevation();

    this.app.mouse.on(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(Mouse.EVENT_MOUSEDOWN, this.onMouseDown, this);
  }

  onMouseDown() {
    if (!Mouse.isPointerLocked()) {
      this.app.mouse.enablePointerLock(() => {}, () => {});
    }
  }

  onMouseMove(event) {
    if (!Mouse.isPointerLocked()) return;

    this.yaw -= event.dx * this.sensitivity;
    this.elevation += event.dy * this.sensitivity;
    this.clampElevation();
  }

  postUpdate() {
    if (!this.target) {
      this.warnOnce("didWarnMissingTarget", "Assign FollowCamera.target to CameraTarget.");
      return;
    }

    const targetPosition = this.target.getPosition();
    const yawRadians = this.yaw * DEG_TO_RAD;
    const elevationRadians = this.elevation * DEG_TO_RAD;
    const horizontalDistance = Math.cos(elevationRadians) * this.distance;

    this.offset.set(
      Math.sin(yawRadians) * horizontalDistance,
      Math.sin(elevationRadians) * this.distance,
      Math.cos(yawRadians) * horizontalDistance,
    );

    this.entity.setPosition(
      targetPosition.x + this.offset.x,
      targetPosition.y + this.offset.y,
      targetPosition.z + this.offset.z,
    );
    this.entity.lookAt(targetPosition);
  }

  clampElevation() {
    this.elevation = Math.max(
      this.getGroundLimitedMinElevation(),
      Math.min(this.maxElevation, this.elevation),
    );
  }

  getGroundLimitedMinElevation() {
    if (!this.target || this.distance <= 0) return -89.5;

    const targetY = this.target.getPosition().y;
    const normalizedOffsetY = Math.max(
      -1,
      Math.min(1, (this.groundY + this.groundClearance - targetY) / this.distance),
    );
    return Math.asin(normalizedOffsetY) * RAD_TO_DEG;
  }

  destroy() {
    this.app.mouse.off(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.off(Mouse.EVENT_MOUSEDOWN, this.onMouseDown, this);
  }

  warnOnce(flagName, message) {
    if (!this[flagName]) {
      this[flagName] = true;
      console.warn(message);
    }
  }
}
