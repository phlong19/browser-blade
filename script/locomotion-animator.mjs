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
   * @title Walk Forward
   * @type {Asset}
   * @resource animation
   */
  walkForward;

  /**
   * @attribute
   * @title Run Forward
   * @type {Asset}
   * @resource animation
   */
  runForward;

  /**
   * @attribute
   * @title Walk Backward
   * @type {Asset}
   * @resource animation
   */
  walkBackward;

  /**
   * @attribute
   * @title Run Backward
   * @type {Asset}
   * @resource animation
   */
  runBackward;

  /**
   * @attribute
   * @title Strafe Left Slow
   * @type {Asset}
   * @resource animation
   */
  strafeLeftSlow;

  /**
   * @attribute
   * @title Strafe Left Fast
   * @type {Asset}
   * @resource animation
   */
  strafeLeftFast;

  /**
   * @attribute
   * @title Strafe Right Slow
   * @type {Asset}
   * @resource animation
   */
  strafeRightSlow;

  /**
   * @attribute
   * @title Strafe Right Fast
   * @type {Asset}
   * @resource animation
   */
  strafeRightFast;

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
                    name: "WalkForward",
                    point: [0, 1],
                  },

                  {
                    name: "RunForward",
                    point: [0, 2],
                  },

                  {
                    name: "WalkBackward",
                    point: [0, -1],
                  },

                  {
                    name: "RunBackward",
                    point: [0, -2],
                  },

                  {
                    name: "StrafeLeftSlow",
                    point: [-1, 0],
                  },

                  {
                    name: "StrafeLeftFast",
                    point: [-2, 0],
                  },

                  {
                    name: "StrafeRightSlow",
                    point: [1, 0],
                  },

                  {
                    name: "StrafeRightFast",
                    point: [2, 0],
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

    layer.assignAnimation("Locomotion.WalkForward", this.walkForward.resource);

    layer.assignAnimation("Locomotion.RunForward", this.runForward.resource);

    layer.assignAnimation(
      "Locomotion.WalkBackward",
      this.walkBackward.resource,
    );

    layer.assignAnimation("Locomotion.RunBackward", this.runBackward.resource);

    layer.assignAnimation(
      "Locomotion.StrafeLeftSlow",
      this.strafeLeftSlow.resource,
    );

    layer.assignAnimation(
      "Locomotion.StrafeLeftFast",
      this.strafeLeftFast.resource,
    );

    layer.assignAnimation(
      "Locomotion.StrafeRightSlow",
      this.strafeRightSlow.resource,
    );

    layer.assignAnimation(
      "Locomotion.StrafeRightFast",
      this.strafeRightFast.resource,
    );

    layer.assignAnimation("Jump", this.jump.resource);
  }

  validateAssets() {
    const assets = [
      ["Idle", this.idle],
      ["Walk Forward", this.walkForward],
      ["Run Forward", this.runForward],
      ["Walk Backward", this.walkBackward],
      ["Run Backward", this.runBackward],
      ["Strafe Left Slow", this.strafeLeftSlow],
      ["Strafe Left Fast", this.strafeLeftFast],
      ["Strafe Right Slow", this.strafeRightSlow],
      ["Strafe Right Fast", this.strafeRightFast],
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
