import { EVENT_COLORS } from "../api.js";
import { EVENT_LABELS } from "../uiText.js";

export default function EventBadge({ ev }) {
  if (!ev || !ev.event_type) return null;
  const color = EVENT_COLORS[ev.event_type] || "#94a3b8";
  const flags = [];
  if (ev.directed_at_self) flags.push("hướng đến bạn");
  if (ev.intentional) flags.push("có chủ ý");
  const flagStr = flags.length ? " - " + flags.join(" - ") : "";
  const sev = (ev.severity ?? 0).toFixed(2);
  return (
    <span className="ev">
      <span className="ev-dot" style={{ background: color }} />
      {EVENT_LABELS[ev.event_type] || ev.event_type} - mức độ {sev}{flagStr}
    </span>
  );
}
