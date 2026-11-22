import { EMOTION_COLORS } from "../api.js";
import { EMOTION_LABELS } from "../uiText.js";

export default function EmotionBars({ emotions }) {
  if (!emotions || !emotions.length) {
    return <div className="calm">- bình tĩnh -</div>;
  }
  return (
    <>
      {emotions.map((e) => {
        const pct = Math.round(e.intensity * 100);
        const color = EMOTION_COLORS[e.name] || "#94a3b8";
        return (
          <div className="emo-row" key={e.name}>
            <span className="emo-name">{EMOTION_LABELS[e.name] || e.name}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ background: color, width: pct + "%" }} />
            </div>
            <span className="emo-pct">{pct}%</span>
          </div>
        );
      })}
    </>
  );
}
