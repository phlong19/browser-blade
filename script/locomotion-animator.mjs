import {
  Script,
  Asset,
  AnimCurve,
  AnimEvents,
  AnimTrack,
  ANIM_BLEND_2D_DIRECTIONAL,
} from "playcanvas";

const COMBAT_TRACK_VERSION = "left-block";
const COMBAT_LEG_BONES = new Set([
  "mixamorig:LeftUpLeg",
  "mixamorig:LeftLeg",
  "mixamorig:LeftFoot",
  "mixamorig:LeftToeBase",
  "mixamorig:RightUpLeg",
  "mixamorig:RightLeg",
  "mixamorig:RightFoot",
  "mixamorig:RightToeBase",
]);

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

  /**
   * @attribute
   * @title Attack Left
   * @type {Asset}
   * @resource animation
   */
  attackLeft;

  /**
   * @attribute
   * @title Attack Overhead
   * @type {Asset}
   * @resource animation
   */
  attackOverhead;

  /**
   * @attribute
   * @title Attack Thrust
   * @type {Asset}
   * @resource animation
   */
  attackThrust;

  /**
   * @attribute
   * @title Block Vs Overhead
   * @type {Asset}
   * @resource animation
   */
  blockOverhead;

  /**
   * @attribute
   * @title Block Vs Left
   * @type {Asset}
   * @resource animation
   */
  blockLeft;

  initialize() {
    const anim = this.entity.anim;

    if (!anim) {
      throw new Error(
        "LocomotionAnimator requires an Anim Component on the same entity.",
      );
    }

    // Base and Combat are intentionally not normalized. The Combat layer is an
    // overwrite layer, and normalizing both non-zero weights can expose imported
    // skeleton scale transforms during the handoff.
    anim.normalizeWeights = false;

    this.validateAssets();

    const attackDefinitions = [
      {
        direction: "right",
        index: 0,
        state: "AttackRight",
        asset: this.attackRight,
      },
      {
        direction: "left",
        index: 1,
        state: "AttackLeft",
        asset: this.attackLeft,
      },
      {
        direction: "overhead",
        index: 2,
        state: "AttackOverhead",
        asset: this.attackOverhead,
      },
      {
        direction: "thrust",
        index: 3,
        state: "AttackThrust",
        asset: this.attackThrust,
      },
    ];
    const availableAttacks = attackDefinitions.filter(
      ({ asset }) => !!asset?.resource,
    );
    const hasBlockOverhead = Boolean(this.blockOverhead?.resource);
    const hasBlockLeft = Boolean(this.blockLeft?.resource);

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

    if (availableAttacks.length > 0) {
      for (const attack of availableAttacks) {
        combatStates.push({
          name: attack.state,
          speed: 1,
          loop: false,
        });

        combatTransitions.push(
          {
            from: "CombatIdle",
            to: attack.state,
            time: 0.1,
            conditions: [
              {
                parameterName: "attack",
                predicate: "EQUAL_TO",
                value: true,
              },
              {
                parameterName: "attackDirection",
                predicate: "EQUAL_TO",
                value: attack.index,
              },
            ],
          },
          {
            from: attack.state,
            to: "CombatIdle",
            time: 0.15,
            exitTime: 0.9,
          },
        );
      }

      parameters.attack = {
        name: "attack",
        type: "TRIGGER",
        value: false,
      };
      parameters.attackDirection = {
        name: "attackDirection",
        type: "INTEGER",
        value: 0,
      };
    }

    if (hasBlockOverhead) {
      combatStates.push({
        name: "BlockOverhead",
        speed: 1,
        loop: false,
      });
    }

    if (hasBlockLeft) {
      combatStates.push({
        name: "BlockLeft",
        speed: 1,
        loop: false,
      });
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

    // Keep the Combat layer unmasked so Hips -> Spine -> Head/arms evaluate in
    // the same hierarchy as the authored combat motion. Instead, remove leg
    // curves, imported scale curves, and Hips translation from Combat tracks.
    // Base locomotion therefore keeps the grounded pelvis position and leg
    // chains while Combat preserves authored pelvis rotation and upper body.
    combatLayer.assignAnimation(
      "CombatIdle",
      this.createCombatTrack(this.idle.resource),
    );

    for (const attack of availableAttacks) {
      combatLayer.assignAnimation(
        attack.state,
        this.createCombatTrack(attack.asset.resource),
      );
    }

    if (hasBlockOverhead) {
      combatLayer.assignAnimation(
        "BlockOverhead",
        this.createCombatTrack(this.blockOverhead.resource),
      );
    }

    if (hasBlockLeft) {
      combatLayer.assignAnimation(
        "BlockLeft",
        this.createCombatTrack(this.blockLeft.resource),
      );
    }

    combatLayer.mask = null;
    combatLayer.weight = 0;
    layer.weight = 1;

    if (!combatLayer.playable) {
      throw new Error(
        "LocomotionAnimator Combat layer is not playable after assigning its tracks.",
      );
    }

    console.log(
      `[Anim] Combat layer playable: true (${COMBAT_TRACK_VERSION})`,
    );
  }

  createCombatTrack(track) {
    const curves = [];

    for (const curve of track.curves ?? []) {
      const sourcePaths = curve.paths ?? [];
      const paths = sourcePaths.filter(
        (path) => !this.shouldExcludeCombatPath(path),
      );

      if (paths.length === 0) {
        continue;
      }

      if (paths.length === sourcePaths.length) {
        curves.push(curve);
      } else {
        curves.push(
          new AnimCurve(paths, curve.input, curve.output, curve.interpolation),
        );
      }
    }

    return new AnimTrack(
      `${track.name}-combat`,
      track.duration,
      track.inputs,
      track.outputs,
      curves,
      new AnimEvents(track.events ?? []),
    );
  }

  shouldExcludeCombatPath(path) {
    if (typeof path === "string") {
      const parts = path.split("/");
      const property = parts.at(-1);
      const targetsHips = parts.includes("mixamorig:Hips");

      return (
        property === "localScale" ||
        (targetsHips && property === "localPosition") ||
        parts.some((part) => COMBAT_LEG_BONES.has(part))
      );
    }

    const entityPath = Array.isArray(path?.entityPath) ? path.entityPath : [];
    const propertyPath = Array.isArray(path?.propertyPath)
      ? path.propertyPath
      : [];
    const targetsHips = entityPath.includes("mixamorig:Hips");

    return (
      propertyPath.includes("localScale") ||
      (targetsHips && propertyPath.includes("localPosition")) ||
      entityPath.some((part) => COMBAT_LEG_BONES.has(part))
    );
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
