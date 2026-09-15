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
      return;
    }

    // Canonical weapon grip authored in the Editor.
    // Every temporary combat pose is applied relative to these values.
    this.baseSocketPosition = this.weaponSocket.getLocalPosition().clone();

    this.baseSocketRotation = this.weaponSocket.getLocalRotation().clone();

    this.baseSocketScale = this.weaponSocket.getLocalScale().clone();

    this.entity.on("weapon:pose", this.onWeaponPose, this);

    this.entity.on("weapon:clearPose", this.onClearWeaponPose, this);
  }

  onWeaponPose(
    positionX,
    positionY,
    positionZ,
    rotationX,
    rotationY,
    rotationZ,
  ) {
    this.setWeaponPoseOffset(
      positionX,
      positionY,
      positionZ,
      rotationX,
      rotationY,
      rotationZ,
    );
  }

  onClearWeaponPose() {
    this.clearWeaponPose();
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

  setWeaponPoseOffset(
    positionX = 0,
    positionY = 0,
    positionZ = 0,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0,
  ) {
    if (!this.restoreWeaponSocketBase()) {
      return false;
    }

    // Position correction is relative to the canonical socket position,
    // expressed in WeaponSocket_R's parent-local coordinate system.
    const composedPosition = this.baseSocketPosition.clone();

    composedPosition.x += positionX;
    composedPosition.y += positionY;
    composedPosition.z += positionZ;

    this.weaponSocket.setLocalPosition(composedPosition);

    // Rotation correction is composed on top of the canonical socket grip.
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

  clearWeaponPose() {
    return this.restoreWeaponSocketBase();
  }

  postUpdate() {
    if (!this.target) {
      return;
    }

    this.entity.setPosition(this.target.getPosition());

    this.entity.setRotation(this.target.getRotation());
  }

  destroy() {
    this.entity.off("weapon:pose", this.onWeaponPose, this);

    this.entity.off("weapon:clearPose", this.onClearWeaponPose, this);
  }
}
