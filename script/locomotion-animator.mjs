import { Script, Asset, ANIM_BLEND_2D_DIRECTIONAL } from "playcanvas";

export class LocomotionAnimator extends Script {
  static scriptName = "locomotionAnimator";

  /**
   * @attribute
   * @title Idle
   * @type {Asset}
   * @resource animation
   */
  idle;

  /**
   * @attribute
   * @title Walk
   * @type {Asset}
   * @resource animation
   */
  walk;

  /**
   * @attribute
   * @title Walk Backward
   * @type {Asset}
   * @resource animation
   */
  walkBackward;

  /**
   * @attribute
   * @title Strafe Left
   * @type {Asset}
   * @resource animation
   */
  strafeLeft;

  /**
   * @attribute
   * @title Strafe Right
   * @type {Asset}
   * @resource animation
   */
  strafeRight;

  /**
   * @attribute
   * @title Jump
   * @type {Asset}
   * @resource animation
   */
  jump;

  /**
   * @attribute
   * @title Attack Right
   * @type {Asset}
   * @resource animation
   */
  attackRight;

  initialize() {
    const anim = this.entity.anim;

    if (!anim) {
      throw new Error(
        "LocomotionAnimator requires an Anim Component on the same entity.",
      );
    }

    this.validateAssets();

    const hasRightAttack = !!this.attackRight?.resource;

    if (hasRightAttack) {
      this.logAttackCurvePaths();
    }

    const states = [
      {
        name: "START",
      },
      {
        name: "Locomotion",
        speed: 1,
        loop: true,

        blendTree: {
          type: ANIM_BLEND_2D_DIRECTIONAL,
          syncDurations: true,
          parameters: ["moveX", "moveZ"],

          children: [
            {
              name: "Idle",
              point: [0, 0],
            },
            {
              name: "Walk",
              point: [0, 1],
            },
            {
              name: "WalkBackward",
              point: [0, -1],
            },
            {
              name: "StrafeLeft",
              point: [-1, 0],
            },
            {
              name: "StrafeRight",
              point: [1, 0],
            },
          ],
        },
      },
      {
        name: "Jump",
        speed: 1,
        loop: false,
      },
    ];

    const transitions = [
      {
        from: "START",
        to: "Locomotion",
        time: 0.15,
      },
      {
        from: "Locomotion",
        to: "Jump",
        time: 0.18,
        conditions: [
          {
            parameterName: "jump",
            predicate: "EQUAL_TO",
            value: true,
          },
        ],
      },
      {
        from: "Jump",
        to: "Locomotion",
        time: 0.2,
        exitTime: 0.9,
      },
    ];

    const parameters = {
      moveX: {
        name: "moveX",
        type: "FLOAT",
        value: 0,
      },
      moveZ: {
        name: "moveZ",
        type: "FLOAT",
        value: 0,
      },
      jump: {
        name: "jump",
        type: "TRIGGER",
        value: false,
      },
    };

    const combatStates = [
      {
        name: "START",
      },
      {
        name: "CombatIdle",
        speed: 1,
        loop: true,
      },
    ];
    const combatTransitions = [
      {
        from: "START",
        to: "CombatIdle",
        time: 0.15,
      },
    ];

    if (hasRightAttack) {
      combatStates.push({
        name: "AttackRight",
        speed: 1,
        loop: false,
      });

      combatTransitions.push(
        {
          from: "CombatIdle",
          to: "AttackRight",
          time: 0.1,
          conditions: [
            {
              parameterName: "attack",
              predicate: "EQUAL_TO",
              value: true,
            },
          ],
        },
        {
          from: "AttackRight",
          to: "CombatIdle",
          time: 0.15,
          exitTime: 0.9,
        },
      );

      parameters.attack = {
        name: "attack",
        type: "TRIGGER",
        value: false,
      };
    }

    anim.loadStateGraph({
      layers: [
        {
          name: "Base",
          states,
          transitions,
        },
        {
          name: "Combat",
          states: combatStates,
          transitions: combatTransitions,
        },
      ],
      parameters,
    });

    const layer = anim.baseLayer;
    const combatLayer = anim.findAnimationLayer("Combat");

    if (!combatLayer) {
      throw new Error("LocomotionAnimator failed to create the Combat layer.");
    }

    layer.assignAnimation("Locomotion.Idle", this.idle.resource);
    layer.assignAnimation("Locomotion.Walk", this.walk.resource);
    layer.assignAnimation(
      "Locomotion.WalkBackward",
      this.walkBackward.resource,
    );
    layer.assignAnimation("Locomotion.StrafeLeft", this.strafeLeft.resource);
    layer.assignAnimation("Locomotion.StrafeRight", this.strafeRight.resource);
    layer.assignAnimation("Jump", this.jump.resource);

    if (hasRightAttack) {
      combatLayer.assignAnimation("CombatIdle", this.idle.resource);
      combatLayer.assignAnimation("AttackRight", this.attackRight.resource);

      this.configureCombatMask(anim, combatLayer);
      combatLayer.weight = 0;
      layer.weight = 1;

      if (!combatLayer.playable) {
        throw new Error(
          "LocomotionAnimator Combat layer is not playable after assigning its tracks.",
        );
      }

      console.log("[Anim] Combat layer playable: true");
    } else {
      this.warnOnce(
        "didWarnMissingAttackRight",
        "Right Swing unavailable until LocomotionAnimator.attackRight is assigned.",
      );
    }
  }

  configureCombatMask(anim, combatLayer) {
    const combatMaskPath =
      "RootNode/mixamorig:Hips/mixamorig:Spine";

    combatLayer.mask = {
      [combatMaskPath]: {
        children: true,
      },
    };

    console.log(`[CombatMask] ${Object.keys(combatLayer.mask)[0]}`);
  }

  findRelativeBonePath(rootBone, boneName) {
    const bone =
      rootBone.name === boneName ? rootBone : rootBone.findByName(boneName);

    if (!bone) return null;

    const path = [];
    let current = bone;

    while (current && current !== rootBone) {
      path.unshift(current.name);
      current = current.parent;
    }

    return current === rootBone ? path.join("/") : null;
  }

  logAttackCurvePaths() {
    const curves = this.attackRight.resource.curves ?? [];
    const boneNames = ["Spine", "Hips", "LeftUpLeg", "RightUpLeg"];

    for (const boneName of boneNames) {
      const paths = new Set();

      for (const curve of curves) {
        for (const path of curve.paths ?? []) {
          const pathText =
            typeof path === "string" ? path : JSON.stringify(path);

          if (pathText?.includes(boneName)) {
            paths.add(pathText);
          }
        }
      }

      for (const path of paths) {
        console.log(`[AnimTrack] ${boneName}: ${path}`);
      }
    }
  }

  validateAssets() {
    const assets = [
      ["Idle", this.idle],
      ["Walk", this.walk],
      ["Walk Backward", this.walkBackward],
      ["Strafe Left", this.strafeLeft],
      ["Strafe Right", this.strafeRight],
      ["Jump", this.jump],
    ];

    for (const [name, asset] of assets) {
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

  warnOnce(flagName, message) {
    if (this[flagName]) {
      return;
    }

    this[flagName] = true;
    console.warn(message);
  }
}
