import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { MonkeyPopulation } from "./components/MonkeyPopulation.jsx";

export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [15, 15, 15], fov: 50 }}
      style={{ width: "100vw", height: "100vh" }}
    >
      <Sky sunPosition={[10, 20, 10]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.2}
        castShadow
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#3a5f3a" />
      </mesh>

      <MonkeyPopulation />

      <OrbitControls maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}
