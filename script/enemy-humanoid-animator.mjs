import { Asset, Script } from "playcanvas";

export class EnemyHumanoidAnimator extends Script {
  static scriptName = "enemyHumanoidAnimator";

  /**
   * @attribute
   * @title Idle
   * @type {Asset}
   * @resource animation
   */
  idle;

  /**
   * @attribute
   * @title Hit Reaction
   * @type {Asset}
   * @resource animation
   */
  hitReaction;

  /**
   * @attribute
   * @title Death
   * @type {Asset}
   * @resource animation
   */
  death;

  initialize() {
    const anim = this.entity.anim;

    if (!anim) {
      throw new Error(
        "EnemyHumanoidAnimator requires an Anim Component on the same entity.",
      );
    }

    this.validateRequiredAsset("Idle", this.idle);

    const hasHitReaction = Boolean(this.hitReaction?.resource);
    const hasDeath = Boolean(this.death?.resource);

    const states = [
      { name: "START" },
      { name: "Idle", speed: 1, loop: true },
    ];

    const transitions = [
      {
        from: "START",
        to: "Idle",
        time: 0.15,
      },
    ];

    if (hasHitReaction) {
      states.push({ name: "HitReact", speed: 1, loop: false });
      transitions.push(
        {
          from: "Idle",
          to: "HitReact",
          time: 0.08,
          conditions: [
            {
              parameterName: "hit",
              predicate: "EQUAL_TO",
              value: true,
            },
          ],
        },
        {
          from: "HitReact",
          to: "Idle",
          time: 0.12,
          exitTime: 0.9,
        },
      );
    }

    if (hasDeath) {
      states.push({ name: "Death", speed: 1, loop: false });
      transitions.push({
        from: "Idle",
        to: "Death",
        time: 0.08,
        conditions: [
          {
            parameterName: "die",
            predicate: "EQUAL_TO",
            value: true,
          },
        ],
      });

      if (hasHitReaction) {
        transitions.push({
          from: "HitReact",
          to: "Death",
          time: 0.05,
          conditions: [
            {
              parameterName: "die",
              predicate: "EQUAL_TO",
              value: true,
            },
          ],
        });
      }
    }

    anim.loadStateGraph({
      layers: [
        {
          name: "Base",
          states,
          transitions,
        },
      ],
      parameters: {
        hit: {
          name: "hit",
          type: "TRIGGER",
          value: false,
        },
        die: {
          name: "die",
          type: "TRIGGER",
          value: false,
        },
        hitDirection: {
          name: "hitDirection",
          type: "INTEGER",
          value: 0,
        },
        deathDirection: {
          name: "deathDirection",
          type: "INTEGER",
          value: 0,
        },
      },
    });

    const layer = anim.baseLayer;

    layer.assignAnimation("Idle", this.idle.resource);

    if (hasHitReaction) {
      layer.assignAnimation("HitReact", this.hitReaction.resource);
    } else {
      console.warn(
        `[EnemyAnim] ${this.entity.name}: Hit Reaction asset is not assigned.`,
      );
    }

    if (hasDeath) {
      layer.assignAnimation("Death", this.death.resource);
    } else {
      console.warn(`[EnemyAnim] ${this.entity.name}: Death asset is not assigned.`);
    }

    layer.weight = 1;

    console.log(
      `[EnemyAnim] ${this.entity.name} ready hit=${hasHitReaction} death=${hasDeath}`,
    );
  }

  validateRequiredAsset(name, asset) {
    if (!asset) {
      throw new Error(`Missing animation asset: ${name}`);
    }

    if (!asset.resource) {
      throw new Error(
        `${name} is not loaded. Enable Preload for this animation asset.`,
      );
    }
  }
}
