import { Entity, Script } from "playcanvas";

const DEATH_DIRECTION_INDEX = {
  right: 0,
  left: 1,
  overhead: 2,
  thrust: 3,
};

export class DeathController extends Script {
  static scriptName = "deathController";

  /** Entity that owns the Anim component. @attribute @type {Entity} */
  animEntity = null;

  /** Optional entity whose collision / rigidbody should be disabled on death. @attribute @type {Entity} */
  physicsEntity = null;

  /** Anim trigger fired once health is depleted. @attribute @type {string} */
  deathTrigger = "die";

  /** Anim integer used to select a directional death animation. @attribute @type {string} */
  deathDirectionParameter = "deathDirection";

  /** Disable collision and rigidbody immediately after death starts. @attribute @type {boolean} */
  disablePhysicsOnDeath = true;

  initialize() {
    this.isDead = false;
    this.entity.on("damage:depleted", this.onDamageDepleted, this);
  }

  onDamageDepleted(source, direction, hitInfo) {
    if (this.isDead) {
      return;
    }

    this.isDead = true;

    const anim = this.getAnim();

    if (anim) {
      const directionIndex = DEATH_DIRECTION_INDEX[direction];

      if (Number.isInteger(directionIndex) && this.deathDirectionParameter) {
        anim.setInteger(this.deathDirectionParameter, directionIndex);
      }

      if (this.deathTrigger) {
        anim.setTrigger(this.deathTrigger);
      }
    } else {
      console.warn(`[Death] target=${this.entity.name} missing Anim component`);
    }

    if (this.disablePhysicsOnDeath) {
      this.disablePhysics();
    }

    const zoneSuffix = hitInfo?.zone ? ` zone=${hitInfo.zone}` : "";
    console.log(`[Death] target=${this.entity.name} direction=${direction}${zoneSuffix}`);
    this.entity.fire("death:started", source, direction, hitInfo);
  }

  getAnim() {
    const entity = this.animEntity instanceof Entity ? this.animEntity : this.entity;
    return entity.anim ?? null;
  }

  disablePhysics() {
    const entity = this.physicsEntity instanceof Entity ? this.physicsEntity : this.entity;

    if (entity.collision) {
      entity.collision.enabled = false;
    }

    if (entity.rigidbody) {
      entity.rigidbody.enabled = false;
    }
  }

  destroy() {
    this.entity.off("damage:depleted", this.onDamageDepleted, this);
  }
}
