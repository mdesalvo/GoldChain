import { useGameStore } from "../../state/useGameStore.js";

function moodLabel(mood) {
  if (mood >= 85) return "Delighted";
  if (mood >= 60) return "Pleased";
  if (mood >= 40) return "Neutral";
  if (mood >= 20) return "Displeased";
  return "Furious";
}

export function Hud() {
  const coinsDelivered = useGameStore((s) => s.coinsDelivered);
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const streakSeconds = useGameStore((s) => s.streakSeconds);
  const deityMood = useGameStore((s) => s.deityMood);

  const rateOk = currentRate >= targetRate - 0.05;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        background: "rgba(0,0,0,0.55)",
        padding: "12px 16px",
        borderRadius: 8,
        minWidth: 220,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>
        TRIBUTE TO THE DEITY
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        {coinsDelivered.toFixed(0)} coins
      </div>
      <div
        style={{
          fontSize: 14,
          color: rateOk ? "#7CFC00" : "#ff5555",
          marginTop: 4,
        }}
      >
        {currentRate.toFixed(2)} / {targetRate.toFixed(2)} coins/sec
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        Streak: {streakSeconds.toFixed(0)}s
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        Deity mood:{" "}
        <strong style={{ color: rateOk ? "#ffd700" : "#ff8888" }}>
          {moodLabel(deityMood)}
        </strong>{" "}
        ({deityMood.toFixed(0)}/100)
      </div>
    </div>
  );
}
