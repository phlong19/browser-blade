import { Script, Entity } from "playcanvas";

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

    // The Editor-authored socket transform is the canonical grip for every
    // attack. Authored animation owns hand / wrist motion; runtime code must
    // not add thrust-specific position or rotation corrections on top.
    this.baseSocketPosition = this.weaponSocket.getLocalPosition().clone();
    this.baseSocketRotation = this.weaponSocket.getLocalRotation().clone();
    this.baseSocketScale = this.weaponSocket.getLocalScale().clone();

    // The new thrust clip starts in its authored chamber pose. The combat
    // controller historically froze thrust later in the old clip, so force the
    // hold point back to the beginning until the legacy editor attribute is
    // removed from combat-controller.mjs.
    const combatController = this.findCombatController();

    if (combatController) {
      combatController.thrustChamberProgress = 0;
    }

    // Ignore legacy weapon:pose events. They were introduced to compensate for
    // the previous thrust animation and would now double-adjust a correct clip.
    this.entity.on("weapon:clearPose", this.onClearWeaponPose, this);
  }

  findCombatController() {
    let current = this.entity;

    while (current) {
      const controller = current.script?.combatController;

      if (controller) {
        return controller;
      }

      current = current.parent;
    }

    return null;
  }

  onClearWeaponPose() {
    this.restoreWeaponSocketBase();
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

    // Follow the animated hand in world space. WeaponSocket_R stays at its
    // canonical local transform, so the authored hand animation owns the full
    // attack trajectory and orientation.
    this.entity.setPosition(this.target.getPosition());
    this.entity.setRotation(this.target.getRotation());
  }

  destroy() {
    this.entity.off("weapon:clearPose", this.onClearWeaponPose, this);
  }
}
