import { Entity, Script } from "playcanvas";

/**
 * Metadata describing the humanoid combatant and body zone represented by a
 * collision entity. Damage remains owned by the configured combatant.
 */
export class CombatHurtbox extends Script {
  static scriptName = "combatHurtbox";

  /** Humanoid root that owns the Damageable script. @attribute @type {Entity} */
  ownerEntity;

  /** Body zone represented by this collision entity. @attribute @type {string} */
  zone = "body";
}
