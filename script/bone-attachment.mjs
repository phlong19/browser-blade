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

    this.baseSocketPosition = this.weaponSocket.getLocalPosition().clone();
    this.baseSocketRotation = this.weaponSocket.getLocalRotation().clone();
    this.baseSocketScale = this.weaponSocket.getLocalScale().clone();

    this.entity.on("weapon:pose", this.onWeaponPose, this);
    this.entity.on("weapon:clearPose", this.onClearWeaponPose, this);
  }

  onWeaponPose(x, y, z) {
    this.setWeaponEulerOffset(x, y, z);
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

  setWeaponEulerOffset(x, y, z) {
    if (!this.restoreWeaponSocketBase()) {
      return false;
    }

    const localOffsetRotation = new Quat().setFromEulerAngles(x, y, z);
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
