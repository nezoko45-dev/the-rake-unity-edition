# The Rake — Unity Edition

Unity 6 prototype package for a first-person Rake survival scene.

## Included

- `RakeAI.cs` — self-contained A* grid pathfinding, random CharacterController target selection, chase/retreat states, 8-unit attacks, player damage, player charge/parry combat, and Animator hooks.
- `RakePlayerController.cs` — capsule CharacterController movement, sprint, jump, mouse-look camera, health, and charge attack.
- `RakeWorldClock.cs` — day/night clock using `clockTime`; daytime sends the Rake back to its initial spawn.
- `RakeAStarGrid.cs` — runtime walkable grid and A* path solver.
- `RakeForestGenerator.cs` — creates terrain-like ground and distributes tree obstacles/placeholders in the demo scene.
- `RakeDemoBootstrap.cs` — one-click editor/runtime setup for the demo scene.

## Setup

1. Open the project in Unity 6.
2. Open `Assets/Scenes/RakeDemo.unity` after running **Tools > The Rake > Create Demo Scene**.
3. Put the Rake model under a GameObject with `RakeAI`, `Animator`, and a `CapsuleCollider`.
4. Assign animation clips named `idle`, `walk`, `attack`, `parry`, and `death` to the Animator Controller when available.
5. Players use a `CharacterController`; the Rake automatically finds active objects with that component.
6. The demo clock uses `clockTime` from 0–24. Daytime makes the Rake retreat to its recorded spawn.

The scripts intentionally avoid a third-party A* dependency so the repository can be opened without installing an external pathfinding package.
