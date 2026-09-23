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
    // Keep a reference for debugging / future equipment code, but do not mutate
    // WeaponSocket_R at runtime. Its local transform is the single canonical
    // sword grip authored in the Editor, while the hand bone animation owns
    // attack direction and trajectory.
    this.weaponSocket = this.entity.children.find(
      (child) => child.name === "WeaponSocket_R",
    );
  }

  postUpdate() {
    if (!this.target) {
      return;
    }

    // Follow the animated hand in world space. The socket remains a child of
    // this anchor, so its Editor-authored local grip is preserved for every
    // attack without per-attack Euler/position corrections.
    this.entity.setPosition(this.target.getPosition());
    this.entity.setRotation(this.target.getRotation());
  }
}
