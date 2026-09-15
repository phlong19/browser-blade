# Browser Blade Runtime Asset Contract

**Status:** Draft v0.1  
**Scope:** Runtime asset identity, replacement, loading, save compatibility, and authoring/runtime boundaries.

---

## 1. Purpose

Browser Blade must support fast MVP development without making temporary assets expensive to replace later.

The core rule is:

> Gameplay code and save data reference stable logical asset IDs, never implementation filenames.

A placeholder asset, integration asset, and final production asset may all implement the same logical ID over time.

Example:

```text
character.human.male.base
```

may initially point to:

```text
assets/characters/male/male_integration_v01.glb
```

and later point to:

```text
assets/characters/male/male_production_v07.glb
```

Gameplay systems should not need to change when that implementation changes.

---

## 2. Stable Logical IDs

Logical IDs are the public identity of runtime content.

Examples:

```text
character.human.male.base
character.human.female.base

clothing.male.underwear.basic
clothing.female.underwear.basic

weapon.sword.basic
weapon.bow.basic

building.house.small
prop.barrel.basic
```

Logical IDs should be treated similarly to database primary keys or public API identifiers.

Once gameplay or save data depends on an ID, it should not be renamed casually.

---

## 3. Filenames Are Implementation Details

Runtime code must not depend directly on filenames.

Bad:

```js
loadModel("assets/characters/male/male_v03.glb");
```

Good:

```js
const asset = AssetRegistry.get("character.human.male.base");
loadModel(asset.model);
```

The asset registry is responsible for resolving logical IDs to current implementation files.

---

## 4. Save Data Rules

Save files must store logical IDs rather than file paths.

Good:

```json
{
  "character": "character.human.male.base",
  "weapon": "weapon.sword.basic"
}
```

Bad:

```json
{
  "character": "assets/characters/male/male_v03.glb",
  "weapon": "assets/weapons/free_fab_sword.glb"
}
```

This allows assets to be renamed, replaced, optimized, or reorganized without breaking old saves.

---

## 5. Asset Registry

Browser Blade will maintain a central runtime asset registry.

Initial location:

```text
data/assets/registry.json
```

Example:

```json
{
  "character.human.male.base": {
    "type": "character",
    "stage": "integration",
    "model": "assets/characters/male/male_integration_v01.glb",
    "skeleton": "skeleton.humanoid.v1",
    "equipmentProfile": "equipment.humanoid.v1"
  },

  "character.human.female.base": {
    "type": "character",
    "stage": "integration",
    "model": "assets/characters/female/female_integration_v01.glb",
    "skeleton": "skeleton.humanoid.v1",
    "equipmentProfile": "equipment.humanoid.v1"
  },

  "clothing.male.underwear.basic": {
    "type": "clothing",
    "slot": "underwear",
    "stage": "integration",
    "model": "assets/clothing/male/underwear_basic_v01.glb"
  },

  "weapon.sword.basic": {
    "type": "weapon",
    "stage": "prototype",
    "model": "assets/weapons/swords/sword_basic_v01.glb"
  }
}
```

The registry may later be split into multiple files, but gameplay should continue to access them through one registry service.

---

## 6. Asset Maturity

Art quality is metadata, not identity.

Supported maturity stages:

```text
prototype
integration
production
polish
```

Example:

```text
character.human.male.base
```

may progress through:

```text
prototype
→ integration
→ production
→ polish
```

Do not create a new logical ID simply because the artwork improves.

Bad:

```text
character.human.male.v1
character.human.male.v2
character.human.male.final
```

Good:

```text
character.human.male.base
```

with a different implementation file and optional implementation version metadata.

---

## 7. Character Runtime Contract

Initial male runtime identity:

```text
character.human.male.base
```

Initial female runtime identity:

```text
character.human.female.base
```

Required runtime properties:

```text
type = humanoid
skeleton = skeleton.humanoid.v1
equipmentProfile = equipment.humanoid.v1
characterScale = canonical human scale
```

Exact mesh topology, textures, hair, underwear, clothing construction, materials, and LOD implementation are replaceable.

---

## 8. Humanoid Skeleton Contract

Logical skeleton ID:

```text
skeleton.humanoid.v1
```

The first rigging and animation integration pass will define the exact implementation.

Once accepted, the following should be considered stable:

- root behavior
- character orientation
- canonical scale
- bone semantic mapping
- animation expectations
- attachment mapping
- required humanoid hierarchy expectations

The mesh itself remains replaceable as long as it satisfies this skeleton contract.

---

## 9. Equipment Profile

Logical equipment profile:

```text
equipment.humanoid.v1
```

Initial stable equipment slots:

```text
head
hair
face
torso
legs
feet
hands
underwear
armor
back
waist
weaponMain
weaponOffhand
```

A production model may internally combine multiple visual pieces into one mesh.

Gameplay still uses the logical equipment slot names.

---

## 10. Attachment Points

Required logical attachment concepts:

```text
hand.main
hand.off
back
waist
head
```

Exact bone/socket implementation may be finalized during rigging integration.

Gameplay systems should reference logical attachment names rather than hardcoded model-specific object names where practical.

---

## 11. Clothing Contract

Example underwear identity:

```text
clothing.male.underwear.basic
```

The implementation may evolve from:

```text
temporary boxer mesh
→ simple braies
→ production medieval braies
→ optimized merged character mesh
```

without changing the logical identity used by gameplay.

The runtime system should care about the clothing identity and equipment slot, not the authoring history of the mesh.

---

## 12. Authoring vs Runtime Assets

Authoring files are not runtime assets.

### Authoring examples

```text
.blend
.fbx donor files
.psd
.spp
high-poly meshes
reference images
source textures
```

Recommended location:

```text
authoring/
```

Example:

```text
authoring/blender/characters/male/BrowserBlade_Male_Authoring_v02.blend
```

### Runtime examples

```text
.glb
.gltf
runtime textures
audio
animation clips
```

Recommended location:

```text
assets/
```

Example:

```text
assets/characters/male/male_integration_v01.glb
```

Runtime code should never load Blender source files directly.

---

## 13. Project Structure

Initial recommended structure:

```text
BrowserBlade/
├── docs/
│   └── architecture/
│       └── ASSET_CONTRACT.md
│
├── data/
│   └── assets/
│       └── registry.json
│
├── assets/
│   ├── characters/
│   ├── clothing/
│   ├── weapons/
│   ├── buildings/
│   ├── props/
│   └── animations/
│
├── authoring/
│   └── blender/
│       └── characters/
│
└── src/
```

This structure may evolve, but the authoring/runtime boundary and stable logical IDs should remain.

---

## 14. Gameplay Data vs Asset Data

Visual implementation data and gameplay balance data should remain separate.

Asset data:

```json
{
  "weapon.sword.basic": {
    "model": "assets/weapons/swords/sword_basic_v01.glb",
    "icon": "assets/ui/items/sword_basic.png"
  }
}
```

Gameplay data:

```json
{
  "weapon.sword.basic": {
    "damage": 32,
    "staminaCost": 18,
    "reach": 1.05,
    "animationSet": "combat.onehanded_sword"
  }
}
```

The same stable ID connects the two systems.

Changing a model must not accidentally alter gameplay balance.

---

## 15. Asset Registry API

Gameplay should access assets through one service or module.

Conceptual API:

```js
const asset = AssetRegistry.get("character.human.male.base");
```

The registry service is responsible for:

- loading asset definitions
- resolving logical IDs
- detecting missing IDs
- returning current runtime implementation metadata

Gameplay systems should avoid direct knowledge of registry file layout.

---

## 16. Replacement Test

Before large-scale content production, Browser Blade must prove that asset replacement is safe.

Test procedure:

1. Register an integration character under:

   ```text
   character.human.male.base
   ```

2. Load it through the asset registry.
3. Use it in gameplay.
4. Replace only its registry `model` path with another compatible character export.
5. Confirm that the following still work without gameplay-code changes:

   - player spawn
   - animation
   - equipment
   - interactions
   - save/load
   - character identity

If replacement causes broad code changes, the runtime abstraction should be fixed before large-scale asset production continues.

---

## 17. What Is Frozen Early

Freeze now:

- logical ID format
- asset registry concept
- authoring/runtime separation
- save files reference IDs, not paths
- basic equipment slot names

Freeze after initial rigging/animation validation:

- `skeleton.humanoid.v1`
- bone semantic mapping
- root behavior
- canonical character scale
- orientation
- attachment mapping

Do not freeze early:

- body topology
- underwear topology
- textures
- materials
- hair
- clothing meshes
- model filenames
- polygon count
- LOD strategy
- visual quality

---

## 18. MVP Rule

A temporary asset is acceptable when:

- it satisfies the runtime contract
- it can be loaded through the registry
- it does not block integration testing
- it can later be replaced without changing gameplay code

The MVP should prioritize proving systems and replacement safety rather than final art quality.

When an asset becomes expensive to perfect before its pipeline has been proven, use the minimum implementation needed to continue integration.

---

## 19. Production Principle

For each asset question, ask:

> Does this block the next integration milestone?

If yes:

- solve the minimum acceptable version
- preserve the contract
- continue development

If no:

- move the improvement into the production-art backlog
- continue building the game

---

## 20. Immediate Browser Blade Milestones

Current sequence:

```text
Asset Contract v0.1
        ↓
Create registry.json
        ↓
Implement AssetRegistry loader
        ↓
Register character.human.male.base
        ↓
Export male integration character
        ↓
Rig / animation validation
        ↓
Freeze skeleton.humanoid.v1
        ↓
Import into PlayCanvas
        ↓
Prove model replacement
        ↓
Build first playable vertical slice
        ↓
Acquire / produce assets based on real game needs
```

The current male character is an integration implementation of:

```text
character.human.male.base
```

It does not need to be the final production character before gameplay development continues.
