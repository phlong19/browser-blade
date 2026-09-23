import { Script } from "playcanvas";

export class CombatDamageResolver extends Script {
  static scriptName = "combatDamageResolver";

  /** Base damage dealt by a right attack. @attribute @type {number} */
  rightDamage = 25;

  /** Base damage dealt by a left attack. @attribute @type {number} */
  leftDamage = 25;

  /** Base damage dealt by an overhead attack. @attribute @type {number} */
  overheadDamage = 30;

  /** Base damage dealt by a thrust attack. @attribute @type {number} */
  thrustDamage = 30;

  initialize() {
    this.entity.on("combat:weaponHit", this.onWeaponHit, this);
  }

  onWeaponHit(target, direction, hitInfo) {
    const damageTarget = this.resolveDamageTarget(target);

    if (!damageTarget) {
      console.warn(
        `[CombatDamage] unresolved target=${target?.name ?? "missing"}`,
      );
      return;
    }

    const damage = this.getDamageForDirection(direction);

    if (damage <= 0) {
      return;
    }

    damageTarget.fire(
      "damage:apply",
      damage,
      this.entity,
      direction,
      hitInfo,
    );

    console.log(
      `[CombatDamage] direction=${direction} target=${damageTarget.name} amount=${damage}`,
    );
  }

  resolveDamageTarget(target) {
    if (!target) {
      return null;
    }

    const hurtbox = target.script?.combatHurtbox;

    if (hurtbox?.ownerEntity) {
      return hurtbox.ownerEntity;
    }

    if (target.script?.damageable) {
      return target;
    }

    return null;
  }

  getDamageForDirection(direction) {
    const damageByDirection = {
      right: this.rightDamage,
      left: this.leftDamage,
      overhead: this.overheadDamage,
      thrust: this.thrustDamage,
    };
    const damage = damageByDirection[direction];

    return Number.isFinite(damage) ? damage : 0;
  }

  destroy() {
    this.entity.off("combat:weaponHit", this.onWeaponHit, this);
  }
}
