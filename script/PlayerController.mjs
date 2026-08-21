import {
  Script,
  Entity,
  KEY_W,
  KEY_A,
  KEY_S,
  KEY_D,
  KEY_SHIFT,
  Vec3,
  KEY_SPACE,
} from "playcanvas";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

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

  /** @attribute @type {number} */
  jumpSpeed = 4.5;

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

    this.viewDirection = new Vec3();

    this.cameraOffset = new Vec3();

    this.groundCheckStart = new Vec3();
    this.groundCheckEnd = new Vec3();

    this.didWarnMissingVisualRoot = false;
    this.didWarnMissingFollowCamera = false;
    this.didWarnMissingRigidbody = false;

    this.isGrounded = false;

    // Current animation-tree position.
    this.animMoveX = 0;
    this.animMoveZ = 0;
  }

  update(dt) {
    if (!this.entity.rigidbody) {
      this.warnOnce(
        "didWarnMissingRigidbody",
        "PlayerController requires a Rigidbody.",
      );
      return;
    }

    this.isGrounded = this.checkGrounded();
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
    const jumpPressed = keyboard.wasPressed(KEY_SPACE);

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

    this.updateFacingAxes();

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

    if (jumpPressed && this.isGrounded) {
      this.velocity.y = this.jumpSpeed;

      if (this.visual?.anim) {
        this.visual.anim.setTrigger("jump");
      }
    }

    this.entity.rigidbody.linearVelocity = this.velocity;

    this.updateVisualFacing();

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

  checkGrounded() {
    const collision = this.entity.collision;

    if (!collision) {
      return false;
    }

    const position = this.entity.getPosition();

    const margin = 0.08;

    let bottomOffset;

    if (collision.type === "capsule" && collision.axis === 1) {
      bottomOffset = collision.linearOffset.y - collision.height * 0.5;
    } else if (collision.type === "box") {
      bottomOffset = collision.linearOffset.y - collision.halfExtents.y;
    } else if (collision.type === "sphere") {
      bottomOffset = collision.linearOffset.y - collision.radius;
    } else {
      console.warn(
        `Unsupported collision setup for ground check: ${collision.type}`,
      );
      return false;
    }

    this.groundCheckStart.set(
      position.x,
      position.y + bottomOffset + margin,
      position.z,
    );

    this.groundCheckEnd.set(
      position.x,
      position.y + bottomOffset - margin,
      position.z,
    );

    const result = this.app.systems.rigidbody.raycastFirst(
      this.groundCheckStart,
      this.groundCheckEnd,
      {
        filterCallback: (entity) => entity !== this.entity,
      },
    );

    return !!result;
  }
  getViewYaw() {
    const followCameraEntity = this.getFollowCameraEntity();
    const followCameraScript = this.getFollowCameraScript(followCameraEntity);

    if (typeof followCameraScript?.yaw === "number") {
      return followCameraScript.yaw;
    }

    if (followCameraEntity) {
      return this.getYawFromCameraEntity(
        followCameraEntity,
        followCameraScript,
      );
    }

    this.warnOnce(
      "didWarnMissingFollowCamera",
      "Assign PlayerController.followCamera to the Camera entity for camera-facing movement.",
    );

    return this.facingYaw;
  }

  getFollowCameraEntity() {
    if (this.followCamera) {
      return this.followCamera;
    }

    return this.app.root.findByName("Camera");
  }

  getFollowCameraScript(followCameraEntity) {
    const scripts = followCameraEntity?.script;

    return scripts?.followCamera ?? scripts?.get?.("followCamera");
  }

  getYawFromCameraEntity(cameraEntity, followCameraScript) {
    const targetEntity = followCameraScript?.target ?? this.entity;

    if (targetEntity) {
      this.cameraOffset.sub2(
        cameraEntity.getPosition(),
        targetEntity.getPosition(),
      );
      this.cameraOffset.y = 0;

      if (this.cameraOffset.lengthSq() > 0.001) {
        this.cameraOffset.normalize();

        return (
          Math.atan2(this.cameraOffset.x, this.cameraOffset.z) * RAD_TO_DEG
        );
      }
    }

    this.viewDirection.copy(cameraEntity.forward);
    this.viewDirection.y = 0;

    if (this.viewDirection.lengthSq() <= 0.001) {
      return this.facingYaw;
    }

    this.viewDirection.normalize();

    return (
      Math.atan2(-this.viewDirection.x, -this.viewDirection.z) * RAD_TO_DEG
    );
  }

  updateFacingAxes() {
    const yawRadians = this.facingYaw * DEG_TO_RAD;

    // PlayCanvas gameplay forward is -Z when facingYaw is 0.
    this.forward.set(-Math.sin(yawRadians), 0, -Math.cos(yawRadians));

    this.right.set(Math.cos(yawRadians), 0, -Math.sin(yawRadians));
  }

  updateVisualFacing() {
    if (!this.visualRoot) {
      this.warnOnce(
        "didWarnMissingVisualRoot",
        "Assign PlayerController.visualRoot so gameplay yaw can rotate the character mesh.",
      );
      return;
    }

    // modelYawOffset is an imported-model visual correction only.
    // It must not be applied to gameplay movement axes or WASD signs.
    this.visualRoot.setLocalEulerAngles(
      0,
      this.facingYaw + this.modelYawOffset,
      0,
    );
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

    let zSpeed;

    if (inputZ >= 0) {
      zSpeed = fast ? this.runForwardSpeed : this.walkForwardSpeed;
    } else {
      zSpeed = fast ? this.runBackwardSpeed : this.walkBackwardSpeed;
    }

    const xSpeed = fast ? this.strafeFastSpeed : this.strafeSlowSpeed;

    return (zSpeed * absZ + xSpeed * absX) / total;
  }

  warnOnce(flagName, message) {
    if (this[flagName]) {
      return;
    }

    this[flagName] = true;

    console.warn(message);
  }
}
