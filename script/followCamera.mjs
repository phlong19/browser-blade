import { Script, Entity, Vec3, Mouse } from "playcanvas";

const CAMERA_INPUT_VERSION = "raw-pointer-v1";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export class FollowCamera extends Script {
  static scriptName = "followCamera";

  /** Orbit anchor, assigned to the Player's CameraTarget entity. @attribute @type {Entity} */
  target;

  /** Distance from CameraTarget. @attribute @type {number} */
  distance = 2.6;

  /** Follow position half-life in seconds. Use 0 to follow instantly. @attribute @type {number} */
  followHalfLife = 0.035;

  /** Starting yaw around CameraTarget, in degrees. @attribute @type {number} */
  initialYaw = 0;

  /** Starting elevation around CameraTarget, in degrees. @attribute @type {number} */
  initialElevation = 3;

  /**
   * Mouse sensitivity in degrees per mouse delta unit.
   * Inspector values may override this source default.
   * @attribute @type {number}
   */
  sensitivity = 0.12;

  /**
   * Emergency maximum yaw rotation allowed in one rendered frame.
   * Normal mouse movement should remain well below this.
   * @attribute @type {number}
   */
  maxYawDegreesPerFrame = 30;

  /**
   * Emergency maximum elevation rotation allowed in one rendered frame.
   * @attribute @type {number}
   */
  maxElevationDegreesPerFrame = 20;

  /** Highest camera elevation. @attribute @type {number} */
  maxElevation = 89.5;

  /** Ground height used by the lower elevation clamp. @attribute @type {number} */
  groundY = 0;

  /** Minimum camera height above ground. @attribute @type {number} */
  groundClearance = 0.25;

  initialize() {
    this.offset = new Vec3();
    this.followPosition = new Vec3();
    this.followedTarget = null;

    this.didWarnMissingTarget = false;
    this.didWarnRawPointerUnavailable = false;

    // Runtime composition uses configured values, never the editor transform.
    this.yaw = this.initialYaw;
    this.elevation = this.initialElevation;

    // Mouse events may arrive multiple times between rendered frames.
    // Accumulate them here and consume once in update().
    this.pendingMouseDx = 0;
    this.pendingMouseDy = 0;

    // Pointer-lock acquisition can occasionally produce a discontinuous first
    // movement event. Ignore only that first event after each fresh lock.
    this.ignoreNextMouseMove = false;

    this.clampElevation();

    this.canvas = this.app.graphicsDevice?.canvas ?? null;

    this.app.mouse.on(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);

    this.app.mouse.on(Mouse.EVENT_MOUSEDOWN, this.onMouseDown, this);

    document.addEventListener(
      "pointerlockchange",
      (this.onPointerLockChangeBound = this.onPointerLockChange.bind(this)),
    );

    document.addEventListener(
      "pointerlockerror",
      (this.onPointerLockErrorBound = this.onPointerLockError.bind(this)),
    );

    console.log(`[CameraVersion] ${CAMERA_INPUT_VERSION}`);
  }

  onMouseDown() {
    if (Mouse.isPointerLocked()) return;

    this.requestPointerLock();
  }

  requestPointerLock() {
    const canvas = this.canvas;

    if (!canvas?.requestPointerLock) {
      // Very old / unusual browser fallback.
      this.app.mouse.enablePointerLock(
        () => {},
        () => {
          console.warn("[Camera] Pointer lock request failed.");
        },
      );
      return;
    }

    // Prefer raw/unadjusted mouse input so OS mouse acceleration does not
    // distort camera movement when the browser/platform supports it.
    try {
      const result = canvas.requestPointerLock({
        unadjustedMovement: true,
      });

      // Modern implementations may return a Promise.
      if (result && typeof result.catch === "function") {
        result.catch(() => {
          // Raw input may not be supported. Fall back to ordinary pointer
          // lock rather than preventing the player from controlling camera.
          this.requestStandardPointerLock();
        });
      }
    } catch {
      // Browsers that do not understand the options object can throw
      // synchronously.
      this.requestStandardPointerLock();
    }
  }

  requestStandardPointerLock() {
    const canvas = this.canvas;

    if (!canvas?.requestPointerLock) {
      this.app.mouse.enablePointerLock(
        () => {},
        () => {},
      );
      return;
    }

    if (!this.didWarnRawPointerUnavailable) {
      this.didWarnRawPointerUnavailable = true;

      console.warn(
        "[Camera] Raw mouse input unavailable; using standard pointer lock.",
      );
    }

    try {
      const result = canvas.requestPointerLock();

      if (result && typeof result.catch === "function") {
        result.catch(() => {
          // Do not repeatedly retry. Another user click can request lock again.
        });
      }
    } catch {
      // Leave unlocked. The next mouse click can retry.
    }
  }

  onPointerLockChange() {
    // Never carry mouse input across lock/unlock boundaries.
    this.pendingMouseDx = 0;
    this.pendingMouseDy = 0;

    if (Mouse.isPointerLocked()) {
      // Ignore exactly one movement event after acquiring the lock.
      this.ignoreNextMouseMove = true;
    } else {
      this.ignoreNextMouseMove = false;
    }
  }

  onPointerLockError() {
    // Keep accumulated state clean if a lock request fails.
    this.pendingMouseDx = 0;
    this.pendingMouseDy = 0;
  }

  onMouseMove(event) {
    if (!Mouse.isPointerLocked()) return;

    if (this.ignoreNextMouseMove) {
      this.ignoreNextMouseMove = false;
      return;
    }

    // Do not reject fast individual mouse events.
    // Accumulate all movement received during this rendered frame.
    this.pendingMouseDx += event.dx;
    this.pendingMouseDy += event.dy;
  }

  update() {
    const dx = this.pendingMouseDx;
    const dy = this.pendingMouseDy;

    // Consume accumulated movement exactly once this frame.
    this.pendingMouseDx = 0;
    this.pendingMouseDy = 0;

    if (!Mouse.isPointerLocked() || (dx === 0 && dy === 0)) {
      return;
    }

    // Mouse deltas already represent displacement.
    // Do NOT multiply these by dt.
    const requestedYawDelta = -dx * this.sensitivity;

    const requestedElevationDelta = dy * this.sensitivity;

    // Safety is applied to CAMERA ROTATION rather than throwing away the
    // entire mouse event/frame. Legitimately fast movement therefore still
    // produces continuous camera movement instead of a visible freeze.
    const yawDelta = this.clamp(
      requestedYawDelta,
      -this.maxYawDegreesPerFrame,
      this.maxYawDegreesPerFrame,
    );

    const elevationDelta = this.clamp(
      requestedElevationDelta,
      -this.maxElevationDegreesPerFrame,
      this.maxElevationDegreesPerFrame,
    );

    this.yaw += yawDelta;
    this.elevation += elevationDelta;

    this.clampElevation();
  }

  postUpdate(dt) {
    if (!this.target) {
      this.followedTarget = null;
      this.warnOnce(
        "didWarnMissingTarget",
        "Assign FollowCamera.target to CameraTarget.",
      );
      return;
    }

    const targetPosition = this.target.getPosition();

    // Smooth only the moving anchor; mouse-controlled yaw and elevation must
    // remain immediate so camera-facing movement and combat stay responsive.
    if (
      this.followedTarget !== this.target ||
      this.followPosition.distance(targetPosition) > 5 ||
      this.followHalfLife <= 0
    ) {
      this.followPosition.copy(targetPosition);
      this.followedTarget = this.target;
    } else {
      const blend = 1 - Math.pow(0.5, dt / this.followHalfLife);
      this.followPosition.lerp(this.followPosition, targetPosition, blend);
    }

    // The target may change height even when there is no mouse input.
    this.clampElevation(this.followPosition.y);

    const yawRadians = this.yaw * DEG_TO_RAD;

    const elevationRadians = this.elevation * DEG_TO_RAD;

    const horizontalDistance = Math.cos(elevationRadians) * this.distance;

    this.offset.set(
      Math.sin(yawRadians) * horizontalDistance,

      Math.sin(elevationRadians) * this.distance,

      Math.cos(yawRadians) * horizontalDistance,
    );

    this.entity.setPosition(
      this.followPosition.x + this.offset.x,

      this.followPosition.y + this.offset.y,

      this.followPosition.z + this.offset.z,
    );

    this.entity.lookAt(this.followPosition);
  }

  clampElevation(targetY) {
    this.elevation = Math.max(
      this.getGroundLimitedMinElevation(targetY),

      Math.min(this.maxElevation, this.elevation),
    );
  }

  getGroundLimitedMinElevation(targetY) {
    if (!this.target || this.distance <= 0) {
      return -89.5;
    }

    const anchorY = targetY ?? this.target.getPosition().y;

    const normalizedOffsetY = Math.max(
      -1,
      Math.min(
        1,
        (this.groundY + this.groundClearance - anchorY) / this.distance,
      ),
    );

    return Math.asin(normalizedOffsetY) * RAD_TO_DEG;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  destroy() {
    this.app.mouse.off(Mouse.EVENT_MOUSEMOVE, this.onMouseMove, this);

    this.app.mouse.off(Mouse.EVENT_MOUSEDOWN, this.onMouseDown, this);

    document.removeEventListener(
      "pointerlockchange",
      this.onPointerLockChangeBound,
    );

    document.removeEventListener(
      "pointerlockerror",
      this.onPointerLockErrorBound,
    );
  }

  warnOnce(flagName, message) {
    if (!this[flagName]) {
      this[flagName] = true;
      console.warn(message);
    }
  }
}
