import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { MonkeyPopulation } from "./components/MonkeyPopulation.jsx";

export function Scene() {
  return (
    <Canvas
      shadows
      // Framed to take in the whole production chain at once: the
      // pipeline is laid out left-to-right across ~48 units in
      // `stagePosition()`, with the societal roles on a back row.
      camera={{ position: [0, 16, 40], fov: 42 }}
      style={{ width: "100vw", height: "100vh" }}
    >
      <Sky sunPosition={[10, 20, 10]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 80]} />
        <meshStandardMaterial color="#3a5f3a" />
      </mesh>

      <MonkeyPopulation />

      <OrbitControls
        target={[0, 0, -3]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={12}
        maxDistance={70}
      />
    </Canvas>
  );
}
