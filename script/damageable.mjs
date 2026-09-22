import { Script } from "playcanvas";

export class Damageable extends Script {
  static scriptName = "damageable";

  /** Maximum health restored when this script initializes. @attribute @type {number} */
  maxHealth = 100;

  initialize() {
    this.currentHealth = this.getMaxHealth();
    this.isDepleted = false;

    this.entity.on("damage:apply", this.onDamageApply, this);
  }

  onDamageApply(amount, source, direction, hitInfo) {
    if (!Number.isFinite(amount) || amount <= 0 || this.isDepleted) {
      return;
    }

    const maxHealth = this.getMaxHealth();

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    const zoneSuffix = hitInfo?.zone ? ` zone=${hitInfo.zone}` : "";

    console.log(
      `[Damageable] target=${this.entity.name} damage=${amount} health=${this.currentHealth}/${maxHealth} direction=${direction}${zoneSuffix}`,
    );

    this.entity.fire("damage:taken", amount, source, direction, hitInfo);

    if (this.currentHealth !== 0 || this.isDepleted) {
      return;
    }

    this.isDepleted = true;
    this.entity.fire("damage:depleted", source, direction, hitInfo);
    console.log(`[Damageable] target=${this.entity.name} depleted`);
  }

  getMaxHealth() {
    return Number.isFinite(this.maxHealth) ? Math.max(0, this.maxHealth) : 0;
  }

  destroy() {
    this.entity.off("damage:apply", this.onDamageApply, this);
  }
}
