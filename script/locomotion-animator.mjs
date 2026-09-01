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

  initialize() {
    const anim = this.entity.anim;

    if (!anim) {
      throw new Error(
        "LocomotionAnimator requires an Anim Component on the same entity.",
      );
    }

    this.validateAssets();

    const stateGraph = {
      layers: [
        {
          name: "Base",

          states: [
            {
              name: "START",
            },

            {
              name: "Locomotion",
              speed: 1,
              loop: true,

              blendTree: {
                type: ANIM_BLEND_2D_DIRECTIONAL,

                // Try keeping locomotion cycles synchronized
                // while their weights are blended.
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
          ],

          transitions: [
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
          ],
        },
      ],

      parameters: {
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
      },
    };

    anim.loadStateGraph(stateGraph);

    const layer = anim.baseLayer;

    layer.assignAnimation("Locomotion.Idle", this.idle.resource);

    layer.assignAnimation("Locomotion.Walk", this.walk.resource);

    layer.assignAnimation(
      "Locomotion.WalkBackward",
      this.walkBackward.resource,
    );

    layer.assignAnimation("Locomotion.StrafeLeft", this.strafeLeft.resource);

    layer.assignAnimation("Locomotion.StrafeRight", this.strafeRight.resource);

    layer.assignAnimation("Jump", this.jump.resource);
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
}
