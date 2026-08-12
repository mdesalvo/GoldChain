import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, ROLES } from "../../simulation/world.js";

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

/**
 * Renders every monkey entity as a colored capsule via a single
 * InstancedMesh, since this is a scene with potentially hundreds
 * of agents — instancing keeps draw calls flat regardless of
 * population size. Swap the geometry for a real skinned mesh once
 * character art exists; the instancing strategy stays the same.
 */
export function MonkeyPopulation() {
  const meshRef = useRef();
  const entities = useMemo(() => [...world.with("position", "role")], []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorArray = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    entities.forEach((entity, i) => {
      const [x, y, z] = entity.position;
      dummy.position.set(x, y + 0.5, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colorArray.set(ROLE_COLORS[entity.role] ?? "#999999");
      mesh.setColorAt(i, colorArray);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (entities.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, entities.length]}>
      <capsuleGeometry args={[0.3, 0.6, 4, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
