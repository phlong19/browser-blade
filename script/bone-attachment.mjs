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

  postUpdate() {
    if (!this.target) {
      return;
    }

    // Follow the animated hand in world space. The child WeaponSocket_R keeps
    // its Editor-authored local grip, so animation owns attack trajectory.
    this.entity.setPosition(this.target.getPosition());
    this.entity.setRotation(this.target.getRotation());
  }
}
