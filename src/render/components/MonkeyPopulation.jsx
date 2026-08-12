import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, ROLES, STATES } from "../../simulation/world.js";

// Placeholder color coding per role — swap for real materials/models later.
const ROLE_COLORS = {
  [ROLES.MINER]: "#8b5a2b",
  [ROLES.HAULER]: "#c98a3f",
  [ROLES.SMELTER]: "#e25822",
  [ROLES.GOLDSMITH]: "#ffd700",
  [ROLES.DRIVER]: "#4a90d9",
  [ROLES.BANKER]: "#2e8b57",
  [ROLES.TELLER]: "#3cb371",
  [ROLES.PAYER]: "#ffb800",
  [ROLES.UNIONIZER]: "#c0392b",
  [ROLES.POLITICIAN]: "#8e44ad",
  [ROLES.DOCTOR]: "#ffffff",
  [ROLES.NURSE]: "#f5f5f5",
  [ROLES.POLICE]: "#1c3faa",
  [ROLES.MAFIOSO]: "#222222",
};

const INJURED_TINT = new THREE.Color("#d94a4a");
const BLOCKED_TINT = new THREE.Color("#5a5a5a");

/**
 * Keeps a live list of the entities matching a query.
 *
 * The population is not fixed for the lifetime of the app — hiring,
 * casualties and future spawning all change it — so the render layer
 * subscribes to the archetype instead of snapshotting it once.
 */
function useEntities(archetype) {
  const [entities, setEntities] = useState(() => [...archetype]);

  useEffect(() => {
    const refresh = () => setEntities([...archetype]);
    // Miniplex's `subscribe` hands back the unsubscribe function.
    const unsubscribeAdded = archetype.onEntityAdded.subscribe(refresh);
    const unsubscribeRemoved = archetype.onEntityRemoved.subscribe(refresh);
    refresh();
    return () => {
      unsubscribeAdded();
      unsubscribeRemoved();
    };
  }, [archetype]);

  return entities;
}

/**
 * Renders every monkey entity as a colored capsule via a single
 * InstancedMesh, since this is a scene with potentially hundreds
 * of agents — instancing keeps draw calls flat regardless of
 * population size. Swap the geometry for a real skinned mesh once
 * character art exists; the instancing strategy stays the same.
 *
 * Reads simulation state, never writes it: the bob animation and the
 * state tints are derived from `entity.state` each frame, so the whole
 * file can be replaced without the economy noticing.
 */
export function MonkeyPopulation() {
  const meshRef = useRef();
  const archetype = useMemo(() => world.with("position", "role", "state"), []);
  const entities = useEntities(archetype);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const baseColors = useMemo(() => {
    const cache = {};
    for (const [role, hex] of Object.entries(ROLE_COLORS)) {
      cache[role] = new THREE.Color(hex);
    }
    return cache;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;

    entities.forEach((entity, i) => {
      const [x, y, z] = entity.position;

      // A small bob makes it legible at a glance who is actually
      // working. Purely cosmetic: phase is derived from the index so it
      // needs no per-entity state.
      const working = entity.state === STATES.WORKING;
      const bob = working ? Math.abs(Math.sin(t * 3 + i)) * 0.18 : 0;
      const down = entity.state === STATES.INJURED;

      dummy.position.set(x, y + (down ? 0.3 : 0.5) + bob, z);
      dummy.rotation.set(down ? Math.PI / 2 : 0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.copy(baseColors[entity.role] ?? BLOCKED_TINT);
      if (down) color.lerp(INJURED_TINT, 0.65);
      else if (entity.state === STATES.BLOCKED) color.lerp(BLOCKED_TINT, 0.6);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (entities.length === 0) return null;

  return (
    // Keyed on population size so the instance buffers are rebuilt when
    // the count changes rather than silently rendering stale instances.
    <instancedMesh
      key={entities.length}
      ref={meshRef}
      args={[null, null, entities.length]}
      castShadow
    >
      <capsuleGeometry args={[0.3, 0.6, 4, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
