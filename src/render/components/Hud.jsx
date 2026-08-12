import { useGameStore } from "../../state/useGameStore.js";
import { wrathLevel } from "../../simulation/deity.js";

const MOOD_LABELS = {
  delighted: "Delighted",
  content: "Pleased",
  impatient: "Impatient",
  angry: "Angry",
  wrathful: "WRATHFUL",
};

const panel = {
  position: "absolute",
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
  background: "rgba(0,0,0,0.55)",
  padding: "12px 16px",
  borderRadius: 8,
  backdropFilter: "blur(2px)",
};

function Meter({ label, value, hue, hint }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          opacity: 0.8,
        }}
      >
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.15)",
          overflow: "hidden",
        }}
        title={hint}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            height: "100%",
            background: hue,
            transition: "width 200ms linear",
          }}
        />
      </div>
    </div>
  );
}

export function Hud() {
  const coinsDelivered = useGameStore((s) => s.coinsDelivered);
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const baseTargetRate = useGameStore((s) => s.baseTargetRate);
  const streakSeconds = useGameStore((s) => s.streakSeconds);
  const deityMood = useGameStore((s) => s.deityMood);
  const workerWellbeing = useGameStore((s) => s.workerWellbeing);
  const corruption = useGameStore((s) => s.corruption);
  const politicalStability = useGameStore((s) => s.politicalStability);
  const taxedTotal = useGameStore((s) => s.taxedTotal);
  const stolenTotal = useGameStore((s) => s.stolenTotal);
  const injuredCount = useGameStore((s) => s.injuredCount);
  const reserves = useGameStore((s) => s.reserves);
  const reserveCapacity = useGameStore((s) => s.reserveCapacity);
  const bottleneck = useGameStore((s) => s.bottleneck);
  const stages = useGameStore((s) => s.stages);
  const paused = useGameStore((s) => s.paused);
  const togglePaused = useGameStore((s) => s.togglePaused);

  const rateOk = currentRate >= targetRate - 0.05;
  const mood = wrathLevel(deityMood);

  return (
    <div style={{ ...panel, top: 16, left: 16, minWidth: 260 }}>
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
        {targetRate > baseTargetRate && (
          <span style={{ opacity: 0.6, fontSize: 11 }}> (legislated)</span>
        )}
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
        title="Coin banked between the chain and the Deity. The tribute is paid out of here, so this is how many seconds of stoppage you can absorb."
      >
        <span style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1 }}>
          RESERVE
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: reserves < targetRate * 5 ? "#ff8888" : "#e8c15a",
          }}
        >
          {reserves.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>
          / {reserveCapacity} · {(reserves / Math.max(0.01, targetRate)).toFixed(0)}s
          of cover
        </span>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        Streak: {streakSeconds.toFixed(0)}s
        {bottleneck && (
          <>
            {" · "}
            <span style={{ color: "#ffb347" }}>bottleneck: {bottleneck}</span>
          </>
        )}
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        Deity mood:{" "}
        <strong style={{ color: rateOk ? "#ffd700" : "#ff8888" }}>
          {MOOD_LABELS[mood]}
        </strong>{" "}
        ({deityMood.toFixed(0)}/100)
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <Meter
          label="Worker wellbeing"
          value={workerWellbeing}
          hue="#4dd07a"
          hint="Driven by unions, hospital coverage and how hard the chain is pushed."
        />
        <Meter
          label="Corruption"
          value={corruption}
          hue="#d0574d"
          hint="Mafiosi versus police. High corruption blunts investigations."
        />
        <Meter
          label="Political stability"
          value={politicalStability}
          hue="#8e6ad0"
          hint="Falls during strikes and raids; politicians absorb some blame."
        />
      </div>

      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10, lineHeight: 1.5 }}>
        In hospital: {injuredCount} · taxed {taxedTotal.toFixed(1)} · stolen{" "}
        {stolenTotal.toFixed(1)}
      </div>

      {stages.length > 0 && <ChainReadout stages={stages} bottleneck={bottleneck} />}

      <button
        type="button"
        onClick={togglePaused}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "5px 0",
          fontSize: 11,
          letterSpacing: 1,
          color: "#fff",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 5,
          cursor: "pointer",
        }}
      >
        {paused ? "RESUME" : "PAUSE"}
      </button>
    </div>
  );
}

/**
 * Per-stage buffer fill. This is the readout that makes backpressure
 * visible: a jam shows up as full buffers upstream of the blocked stage
 * and empty ones downstream.
 */
function ChainReadout({ stages, bottleneck }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>CHAIN</div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 34 }}>
        {stages.map(({ role, buffer, capacity, workers, total }) => {
          const fill = capacity ? Math.min(1, buffer / capacity) : 1;
          const jammed = role === bottleneck;
          return (
            <div
              key={role}
              title={`${role}: ${
                capacity ? `${buffer.toFixed(1)}/${capacity}` : "source"
              } — ${workers}/${total} able`}
              style={{ flex: 1, textAlign: "center" }}
            >
              <div
                style={{
                  height: 26,
                  display: "flex",
                  alignItems: "flex-end",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 2,
                  outline: jammed ? "1px solid #ffb347" : "none",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${fill * 100}%`,
                    background: workers === 0 ? "#d0574d" : "#e8c15a",
                    borderRadius: 2,
                  }}
                />
              </div>
              <div style={{ fontSize: 8, opacity: 0.65, marginTop: 2 }}>
                {role.slice(0, 3)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
