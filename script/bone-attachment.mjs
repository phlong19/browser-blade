import { Script, Entity, Quat } from "playcanvas";

export class BoneAttachment extends Script {
  static scriptName = "boneAttachment";

  /**
   * Entity whose world position and rotation drive this attachment anchor.
   * Scale is intentionally ignored so skeleton import scale is not inherited.
   *
   * @attribute
   * @type {Entity}
   */
  target;

  initialize() {
    this.weaponSocket = this.entity.children.find(
      (child) => child.name === "WeaponSocket_R",
    );

    if (!this.weaponSocket) {
      console.warn(
        `[BoneAttachment] ${this.entity.name} is missing WeaponSocket_R`,
      );
      return;
    }

    // The Editor-authored socket transform is the canonical grip used by idle,
    // cuts and overhead attacks. Temporary combat corrections are always
    // composed on top of this transform and then restored afterwards.
    this.baseSocketPosition = this.weaponSocket.getLocalPosition().clone();
    this.baseSocketRotation = this.weaponSocket.getLocalRotation().clone();
    this.baseSocketScale = this.weaponSocket.getLocalScale().clone();

    this.entity.on("weapon:pose", this.onWeaponPose, this);
    this.entity.on("weapon:clearPose", this.onClearWeaponPose, this);
  }

  onWeaponPose(
    _positionX,
    _positionY,
    _positionZ,
    rotationX,
    rotationY,
    rotationZ,
  ) {
    // The old combat controller still emits weapon:pose for both thrust and
    // left attacks. The left animation is now authored correctly in Blender,
    // so only retain the one justified runtime exception: thrust grip rotation.
    if (this.getCurrentAttackDirection() !== "thrust") {
      return;
    }

    this.applyThrustRotationOffset(rotationX, rotationY, rotationZ);
  }

  onClearWeaponPose() {
    this.restoreWeaponSocketBase();
  }

  getCurrentAttackDirection() {
    let current = this.entity;

    while (current) {
      const controller = current.script?.combatController;

      if (controller) {
        return controller.currentAttackDirection ?? null;
      }

      current = current.parent;
    }

    return null;
  }

  applyThrustRotationOffset(rotationX = 0, rotationY = 0, rotationZ = 0) {
    if (!this.restoreWeaponSocketBase()) {
      return false;
    }

    // Do not apply the old per-thrust position offset. Position is owned by the
    // canonical socket plus the animated hand. Only the local grip orientation
    // gets a temporary thrust-specific correction.
    const localOffsetRotation = new Quat().setFromEulerAngles(
      rotationX,
      rotationY,
      rotationZ,
    );

    const composedRotation = this.baseSocketRotation
      .clone()
      .mul(localOffsetRotation);

    this.weaponSocket.setLocalRotation(composedRotation);

    return true;
  }

  restoreWeaponSocketBase() {
    if (!this.weaponSocket) {
      return false;
    }

    this.weaponSocket.setLocalPosition(this.baseSocketPosition.clone());
    this.weaponSocket.setLocalRotation(this.baseSocketRotation.clone());
    this.weaponSocket.setLocalScale(this.baseSocketScale.clone());

    return true;
  }

  postUpdate() {
    if (!this.target) {
      return;
    }

    // Follow the animated hand in world space. WeaponSocket_R remains local to
    // this anchor, so the Blender wrist motion still owns attack trajectory.
    this.entity.setPosition(this.target.getPosition());
    this.entity.setRotation(this.target.getRotation());
  }

  destroy() {
    this.entity.off("weapon:pose", this.onWeaponPose, this);
    this.entity.off("weapon:clearPose", this.onClearWeaponPose, this);
  }
}
