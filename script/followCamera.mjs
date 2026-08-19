import { Script, Entity, Vec3, Mouse } from "playcanvas";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export class FollowCamera extends Script {
  static scriptName = "followCamera";

  /**
   * Point that the camera follows and looks at.
   *
   * @attribute
   * @type {Entity}
   */
  target;

  /**
   * Distance from the target.
   *
   * @attribute
   * @type {number}
   */
  distance = 5;

  /**
   * Mouse sensitivity.
   *
   * @attribute
   * @type {number}
   */
  sensitivity = 0.15;

  /**
   * Highest camera elevation.
   *
   * @attribute
   * @type {number}
   */
  maxElevation = 89.5;

  /**
   * Ground height used for the dynamic lower elevation clamp.
   *
   * @attribute
   * @type {number}
   */
  groundY = 0;

  /**
   * Minimum camera height above ground.
   *
   * @attribute
   * @type {number}
   */
  groundClearance = 0.25;

  initialize() {
    this.offset = new Vec3();
    this.didWarnMissingTarget = false;

    this.initializeOrbitFromPlacement();

    this.app.mouse.on(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);

    this.app.mouse.on(Mouse.EVENT_MOUSEDOWN, this.onMouseDown, this);
  }

  onMouseDown() {
    if (!Mouse.isPointerLocked()) {
      this.app.mouse.enablePointerLock();
    }
  }

  onMouseMove(event) {
    if (!Mouse.isPointerLocked()) {
      return;
    }

    this.yaw -= event.dx * this.sensitivity;
    this.elevation += event.dy * this.sensitivity;

    this.clampElevation();
  }

  postUpdate() {
    if (!this.target) {
      this.warnOnce(
        "didWarnMissingTarget",
        "Assign FollowCamera.target to the Player or CameraTarget entity.",
      );
      return;
    }

    const targetPosition = this.target.getPosition();

    this.clampElevation();

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

  initializeOrbitFromPlacement() {
    if (!this.target) {
      this.yaw = 0;
      this.elevation = 15;
      return;
    }

    const targetPosition = this.target.getPosition();
    const cameraPosition = this.entity.getPosition();

    this.offset.sub2(cameraPosition, targetPosition);

    const horizontalDistance = Math.hypot(this.offset.x, this.offset.z);
    const currentDistance = this.offset.length();

    if (currentDistance > 0.001) {
      this.distance = currentDistance;
    }

    this.yaw = Math.atan2(this.offset.x, this.offset.z) * RAD_TO_DEG;
    this.elevation =
      Math.atan2(this.offset.y, Math.max(horizontalDistance, 0.001)) *
      RAD_TO_DEG;

    this.clampElevation();
  }

  clampElevation() {
    const minElevation = this.getGroundLimitedMinElevation();

    this.elevation = Math.max(
      minElevation,
      Math.min(this.maxElevation, this.elevation),
    );
  }

  getGroundLimitedMinElevation() {
    if (!this.target || this.distance <= 0) {
      return -89.5;
    }

    const targetY = this.target.getPosition().y;
    const minimumCameraY = this.groundY + this.groundClearance;
    const minimumOffsetY = minimumCameraY - targetY;
    const normalizedOffsetY = Math.max(
      -1,
      Math.min(1, minimumOffsetY / this.distance),
    );

    return Math.asin(normalizedOffsetY) * RAD_TO_DEG;
  }

  destroy() {
    this.app.mouse.off(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);

    this.app.mouse.off(Mouse.EVENT_MOUSEDOWN, this.onMouseDown, this);
  }

  warnOnce(flagName, message) {
    if (this[flagName]) {
      return;
    }

    this[flagName] = true;

    console.warn(message);
  }
}
