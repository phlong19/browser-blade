import { Entity, Quat, Script, Vec3 } from "playcanvas";

/** Follows an assigned entity's world position and rotation without scale. */
export class BoneFollower extends Script {
  static scriptName = "boneFollower";

  /** Entity whose animated world transform drives this entity. @attribute @type {Entity} */
  target;

  /** Offset expressed in the target's local coordinate space. @attribute @type {Vec3} */
  positionOffset = new Vec3();

  /** Euler rotation offset composed after the target rotation. @attribute @type {Vec3} */
  rotationOffset = new Vec3();

  initialize() {
    this.worldPosition = new Vec3();
    this.worldPositionOffset = new Vec3();
    this.targetRotation = new Quat();
    this.localRotationOffset = new Quat();
    this.worldRotation = new Quat();
  }

  postUpdate() {
    if (!this.target) {
      return;
    }

    this.worldPosition.copy(this.target.getPosition());
    this.targetRotation.copy(this.target.getRotation());

    this.targetRotation.transformVector(
      this.positionOffset,
      this.worldPositionOffset,
    );
    this.worldPosition.add(this.worldPositionOffset);

    this.localRotationOffset.setFromEulerAngles(
      this.rotationOffset.x,
      this.rotationOffset.y,
      this.rotationOffset.z,
    );
    this.worldRotation.copy(this.targetRotation).mul(this.localRotationOffset);

    this.entity.setPosition(this.worldPosition);
    this.entity.setRotation(this.worldRotation);
  }
}
