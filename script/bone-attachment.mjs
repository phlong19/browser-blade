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

    this.entity.setPosition(this.target.getPosition());
    this.entity.setRotation(this.target.getRotation());
  }
}
