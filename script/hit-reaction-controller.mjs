import { Entity, Script } from "playcanvas";

const HIT_DIRECTION_INDEX = {
  right: 0,
  left: 1,
  overhead: 2,
  thrust: 3,
};

export class HitReactionController extends Script {
  static scriptName = "hitReactionController";

  /** Entity that owns the Anim component. @attribute @type {Entity} */
  animEntity = null;

  /** Anim trigger fired when non-lethal damage is received. @attribute @type {string} */
  hitTrigger = "hit";

  /** Anim integer used to select a directional hit reaction. @attribute @type {string} */
  hitDirectionParameter = "hitDirection";

  initialize() {
    this.entity.on("damage:taken", this.onDamageTaken, this);
  }

  onDamageTaken(amount, source, direction, hitInfo) {
    const damageable = this.entity.script?.damageable;

    // damage:taken fires before damage:depleted. Do not start a hit reaction
    // when this hit has already reduced health to zero; death owns that pose.
    if (damageable?.currentHealth === 0) {
      return;
    }

    const anim = this.getAnim();

    if (!anim) {
      console.warn(`[HitReaction] target=${this.entity.name} missing Anim component`);
      return;
    }

    const directionIndex = HIT_DIRECTION_INDEX[direction];

    if (Number.isInteger(directionIndex) && this.hitDirectionParameter) {
      anim.setInteger(this.hitDirectionParameter, directionIndex);
    }

    if (this.hitTrigger) {
      anim.setTrigger(this.hitTrigger);
    }

    const zoneSuffix = hitInfo?.zone ? ` zone=${hitInfo.zone}` : "";
    console.log(
      `[HitReaction] target=${this.entity.name} damage=${amount} direction=${direction}${zoneSuffix}`,
    );
  }

  getAnim() {
    const entity = this.animEntity instanceof Entity ? this.animEntity : this.entity;
    return entity.anim ?? null;
  }

  destroy() {
    this.entity.off("damage:taken", this.onDamageTaken, this);
  }
}
