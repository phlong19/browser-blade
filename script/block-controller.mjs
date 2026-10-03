import { Script, Entity, Mouse, MOUSEBUTTON_RIGHT } from "playcanvas";

const BLOCKS = {
  overhead: {
    state: "BlockOverhead",
    holdProgressKey: "overheadHoldProgress",
    assetTitle: "Block Vs Overhead",
  },
  left: {
    state: "BlockLeft",
    holdProgressKey: "leftHoldProgress",
    assetTitle: "Block Vs Left",
  },
};

export class BlockController extends Script {
  static scriptName = "blockController";

  /** Entity containing the existing runtime Anim graph. @attribute @type {Entity} */
  animEntity;

  /** Normalized BlockOverhead progress at which a held RMB pins the guard pose. @attribute @type {number} */
  overheadHoldProgress = 0.9;

  /** Normalized BlockLeft progress at which a held RMB pins the guard pose. The current baked clip reaches its guard early. @attribute @type {number} */
  leftHoldProgress = 0.3;

  /** Seconds used to blend from CombatIdle into a directional block. @attribute @type {number} */
  blockBlendTime = 0.08;

  /** Seconds used to blend back to CombatIdle on RMB release. @attribute @type {number} */
  releaseBlendTime = 0.1;

  initialize() {
    this.blocking = false;
    this.blockDirection = null;
    this.blockHoldTime = null;
    this.blockInputArmed = true;
    this.returningToIdle = false;
    this.warnedMissingStates = new Set();
  }

  update() {
    const combatController = this.getCombatController();
    const layer = this.getCombatLayer(combatController);

    if (!layer) {
      return;
    }

    this.finishReturnToIdle(layer);

    const rmbHeld =
      Mouse.isPointerLocked() && this.app.mouse.isPressed(MOUSEBUTTON_RIGHT);

    if (!rmbHeld) {
      this.blockInputArmed = true;
    }

    if (this.blocking) {
      if (!rmbHeld) {
        this.endBlock(layer);
        return;
      }

      if (combatController?.state !== "idle") {
        this.yieldBlockToCombat();
        return;
      }

      this.pinCurrentBlock(layer);
      return;
    }

    const direction = combatController?.selectedDirection;
    const block = direction ? BLOCKS[direction] : null;
    const wantsBlock =
      this.blockInputArmed &&
      rmbHeld &&
      combatController?.state === "idle" &&
      Boolean(block);

    if (wantsBlock) {
      this.beginBlock(layer, direction);
      this.pinCurrentBlock(layer);
    }
  }

  getCombatController() {
    const scripts = this.entity.script;

    return scripts?.combatController ?? scripts?.get?.("combatController");
  }

  getAnim(combatController) {
    const entity =
      this.animEntity instanceof Entity
        ? this.animEntity
        : combatController?.animEntity;

    return entity?.anim ?? null;
  }

  getCombatLayer(combatController) {
    return this.getAnim(combatController)?.findAnimationLayer("Combat") ?? null;
  }

  beginBlock(layer, direction) {
    const block = BLOCKS[direction];

    if (!block) {
      return;
    }

    if (!layer.states.includes(block.state)) {
      if (!this.warnedMissingStates.has(block.state)) {
        this.warnedMissingStates.add(block.state);
        console.warn(
          `[Block] ${block.state} is unavailable. Assign ${block.assetTitle} on LocomotionAnimator.`,
        );
      }
      return;
    }

    this.blocking = true;
    this.blockDirection = direction;
    this.returningToIdle = false;
    this.blockHoldTime = null;

    layer.blendToWeight(1, this.blockBlendTime);
    this.entity.fire("combat:faceView");
    layer.transition(block.state, this.blockBlendTime);
  }

  pinCurrentBlock(layer) {
    const block = this.blockDirection ? BLOCKS[this.blockDirection] : null;

    if (!this.blocking || !block || layer.activeState !== block.state) {
      return;
    }

    const progress = layer.activeStateProgress;
    const rawHoldProgress = this[block.holdProgressKey];
    const holdProgress = Math.min(
      0.94,
      Math.max(0, Number.isFinite(rawHoldProgress) ? rawHoldProgress : 0.9),
    );

    if (this.blockHoldTime === null) {
      if (typeof progress !== "number" || progress < holdProgress) {
        return;
      }

      this.blockHoldTime = layer.activeStateCurrentTime;
    }

    layer.activeStateCurrentTime = this.blockHoldTime;
  }

  interruptBlock(reason = "interrupted") {
    if (!this.blocking) {
      return;
    }

    this.blockInputArmed = false;

    const combatController = this.getCombatController();
    const layer = this.getCombatLayer(combatController);

    this.endBlock(layer);
  }

  yieldBlockToCombat() {
    this.blocking = false;
    this.blockDirection = null;
    this.blockHoldTime = null;
    this.blockInputArmed = false;
    this.returningToIdle = false;
  }

  endBlock(layer) {
    this.blocking = false;
    this.blockDirection = null;
    this.blockHoldTime = null;

    if (layer?.states.includes("CombatIdle")) {
      this.returningToIdle = true;
      layer.transition("CombatIdle", this.releaseBlendTime);
      return;
    }

    this.returningToIdle = false;
    layer?.blendToWeight(0, this.releaseBlendTime);
  }

  finishReturnToIdle(layer) {
    if (
      !this.returningToIdle ||
      layer.activeState !== "CombatIdle" ||
      layer.transitioning
    ) {
      return;
    }

    this.returningToIdle = false;
    layer.blendToWeight(0, this.releaseBlendTime);
  }

  destroy() {
    const combatController = this.getCombatController();
    const layer = this.getCombatLayer(combatController);

    this.blocking = false;
    this.blockDirection = null;
    this.blockHoldTime = null;
    this.blockInputArmed = true;
    this.returningToIdle = false;

    if (layer?.states.includes("CombatIdle")) {
      layer.transition("CombatIdle", 0);
      layer.blendToWeight(0, 0);
    }
  }
}
