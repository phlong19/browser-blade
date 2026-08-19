import {
  Script,
  Entity,
  KEY_W,
  KEY_A,
  KEY_S,
  KEY_D,
  KEY_SHIFT,
  Vec3,
} from "playcanvas";

const DEG_TO_RAD = Math.PI / 180;

export class PlayerController extends Script {
  static scriptName = "playerController";

  /**
   * Entity containing the Anim Component.
   *
   * @attribute
   * @type {Entity}
   */
  visual;

  /**
   * Wrapper used to rotate the model.
   *
   * @attribute
   * @type {Entity}
   */
  visualRoot;

  /**
   * Camera entity with the FollowCamera script.
   *
   * @attribute
   * @type {Entity}
   */
  followCamera;

  /** @attribute @type {number} */
  walkForwardSpeed = 2.5;

  /** @attribute @type {number} */
  runForwardSpeed = 5;

  /** @attribute @type {number} */
  walkBackwardSpeed = 1.8;

  /** @attribute @type {number} */
  runBackwardSpeed = 3;

  /** @attribute @type {number} */
  strafeSlowSpeed = 2;

  /** @attribute @type {number} */
  strafeFastSpeed = 3;

  /**
   * Degrees per second. Use 0 for immediate facing changes.
   *
   * @attribute
   * @type {number}
   */
  facingFollowSpeed = 720;

  /**
   * How quickly animation parameters
   * approach their target.
   *
   * Larger = snappier.
   *
   * @attribute
   * @type {number}
   */
  animationBlendSpeed = 12;

  /** @attribute @type {number} */
  modelYawOffset = 0;

  /** @attribute @type {number} */
  initialFacingYaw = 0;

  initialize() {
    this.facingYaw = this.initialFacingYaw;

    this.forward = new Vec3();

    this.right = new Vec3();

    this.direction = new Vec3();

    this.velocity = new Vec3();

    // Current animation-tree position.
    this.animMoveX = 0;
    this.animMoveZ = 0;
  }

  update(dt) {
    const keyboard = this.app.keyboard;

    // ----------------------------
    // INPUT
    // ----------------------------

    let inputX = 0;
    let inputZ = 0;

    if (keyboard.isPressed(KEY_W)) {
      inputZ += 1;
    }

    if (keyboard.isPressed(KEY_S)) {
      inputZ -= 1;
    }

    if (keyboard.isPressed(KEY_A)) {
      inputX -= 1;
    }

    if (keyboard.isPressed(KEY_D)) {
      inputX += 1;
    }

    const inputLength = Math.hypot(inputX, inputZ);
    const hasMovementInput = inputLength > 0.01;

    if (inputLength > 1) {
      inputX /= inputLength;
      inputZ /= inputLength;
    }

    const fast = keyboard.isPressed(KEY_SHIFT) && hasMovementInput;

    // ----------------------------
    // FACING
    // ----------------------------

    if (hasMovementInput) {
      this.facingYaw = this.updateFacingYaw(this.getViewYaw(), dt);
    }

    this.facingYaw = this.normalizeYaw(this.facingYaw);

    // ----------------------------
    // LOCAL CHARACTER AXES
    // ----------------------------

    const yawRadians = this.facingYaw * DEG_TO_RAD;

    this.forward.set(-Math.sin(yawRadians), 0, -Math.cos(yawRadians));

    this.right.set(Math.cos(yawRadians), 0, -Math.sin(yawRadians));

    // ----------------------------
    // MOVEMENT
    // ----------------------------

    this.direction.set(0, 0, 0);

    this.direction.addScaled(this.forward, inputZ);

    this.direction.addScaled(this.right, inputX);

    if (this.direction.lengthSq() > 1) {
      this.direction.normalize();
    }

    // ----------------------------
    // MOVEMENT SPEED
    // ----------------------------

    const movementSpeed = this.getMovementSpeed(inputX, inputZ, fast);

    const currentVelocity = this.entity.rigidbody.linearVelocity;

    this.velocity.copy(this.direction).mulScalar(movementSpeed);

    // Preserve gravity.
    this.velocity.y = currentVelocity.y;

    this.entity.rigidbody.linearVelocity = this.velocity;

    if (this.visualRoot) {
      this.visualRoot.setLocalEulerAngles(
        0,
        this.facingYaw + this.modelYawOffset,
        0,
      );
    }

    // ----------------------------
    // ANIMATION TARGET
    // ----------------------------

    const animMagnitude = fast ? 2 : 1;
    const targetAnimX = inputX * animMagnitude;
    const targetAnimZ = inputZ * animMagnitude;

    // ----------------------------
    // SMOOTH BLEND PARAMETERS
    // ----------------------------

    const blendAmount = 1 - Math.exp(-this.animationBlendSpeed * dt);

    this.animMoveX += (targetAnimX - this.animMoveX) * blendAmount;

    this.animMoveZ += (targetAnimZ - this.animMoveZ) * blendAmount;

    // ----------------------------
    // SEND TO BLEND TREE
    // ----------------------------

    if (this.visual?.anim) {
      this.visual.anim.setFloat("moveX", this.animMoveX);

      this.visual.anim.setFloat("moveZ", this.animMoveZ);
    }
  }

  getViewYaw() {
    const followCameraScript = this.followCamera?.script?.followCamera;

    if (typeof followCameraScript?.yaw === "number") {
      return followCameraScript.yaw;
    }

    return this.facingYaw;
  }

  updateFacingYaw(targetYaw, dt) {
    if (this.facingFollowSpeed <= 0) {
      return targetYaw;
    }

    const delta = this.shortestYawDelta(this.facingYaw, targetYaw);
    const maxDelta = this.facingFollowSpeed * dt;

    if (Math.abs(delta) <= maxDelta) {
      return targetYaw;
    }

    return this.facingYaw + Math.sign(delta) * maxDelta;
  }

  shortestYawDelta(fromYaw, toYaw) {
    return this.normalizeYaw(toYaw - fromYaw);
  }

  normalizeYaw(yaw) {
    let normalizedYaw = yaw;

    while (normalizedYaw > 180) {
      normalizedYaw -= 360;
    }

    while (normalizedYaw < -180) {
      normalizedYaw += 360;
    }

    return normalizedYaw;
  }

  getMovementSpeed(inputX, inputZ, fast) {
    const absX = Math.abs(inputX);
    const absZ = Math.abs(inputZ);
    const total = absX + absZ;

    if (total <= 0.001) {
      return 0;
    }

    const zSpeed =
      inputZ >= 0
        ? fast
          ? this.runForwardSpeed
          : this.walkForwardSpeed
        : fast
          ? this.runBackwardSpeed
          : this.walkBackwardSpeed;

    const xSpeed = fast ? this.strafeFastSpeed : this.strafeSlowSpeed;

    return (zSpeed * absZ + xSpeed * absX) / total;
  }
}
