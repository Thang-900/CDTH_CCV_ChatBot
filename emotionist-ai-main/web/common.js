// -- Shared helpers for both views -------------------------------------------
const EMOTION_COLORS = {
  Joy: "#f59e0b", Hope: "#10b981", Satisfaction: "#84cc16", Relief: "#06b6d4",
  HappyFor: "#f97316", Pride: "#d97706", Admiration: "#0891b2", Love: "#ec4899",
  Gratification: "#f59e0b", Gratitude: "#059669", Trust: "#14b8a6", Surprise: "#a78bfa",
  Anticipation: "#8b5cf6", Distress: "#ef4444", Fear: "#6366f1", FearsConfirmed: "#dc2626",
  Disappointment: "#8b5cf6", Pity: "#94a3b8", Gloating: "#a16207", Resentment: "#b91c1c",
  Shame: "#7c3aed", Reproach: "#9f1239", Hate: "#94a3b8", Remorse: "#6d28d9",
  Anger: "#dc2626", Sadness: "#64748b", Disgust: "#a8a29e", Envy: "#4d7c0f",
  Guilt: "#64748b", Contempt: "#818cf8",
};
const EVENT_COLORS = {
  compliment: "#10b981", achievement: "#f59e0b", good_news: "#84cc16",
  agreement: "#06b6d4", praise_of_other: "#0891b2", insult: "#dc2626",
  threat: "#6366f1", bad_news: "#ef4444", failure: "#7c3aed",
  disagreement: "#f97316", blame_of_other: "#b91c1c", neutral: "#94a3b8",
};
const PERSONALITY_LABELS = {
  neurotic: "Dễ bất ổn", average: "Cân bằng", resilient: "Kiên cường",
};
const LEVEL_LABELS = {
  "very high": "Rất cao", high: "Cao", moderate: "Trung bình",
  low: "Thấp", "very low": "Rất thấp",
};
const EMOTION_LABELS = {
  Joy: "Vui vẻ", Hope: "Hy vọng", Satisfaction: "Hài lòng", Relief: "Nhẹ nhõm",
  HappyFor: "Vui cho người khác", Pride: "Tự hào", Admiration: "Ngưỡng mộ",
  Love: "Yêu mến", Gratification: "Thỏa mãn", Gratitude: "Biết ơn",
  Trust: "Tin tưởng", Surprise: "Ngạc nhiên", Anticipation: "Mong đợi",
  Distress: "Đau khổ", Fear: "Sợ hãi", FearsConfirmed: "Nỗi sợ thành sự thật",
  Disappointment: "Thất vọng", Pity: "Thương hại", Gloating: "Hả hê",
  Resentment: "Oán giận", Shame: "Xấu hổ", Reproach: "Trách móc",
  Hate: "Căm ghét", Remorse: "Hối hận", Anger: "Tức giận", Sadness: "Buồn bã",
  Disgust: "Ghê tởm", Envy: "Ghen tị", Guilt: "Tội lỗi", Contempt: "Khinh miệt",
};
const EVENT_LABELS = {
  compliment: "Lời khen", achievement: "Thành tựu", good_news: "Tin vui",
  agreement: "Đồng tình", praise_of_other: "Khen người khác", insult: "Xúc phạm",
  threat: "Đe dọa", bad_news: "Tin xấu", failure: "Thất bại",
  disagreement: "Bất đồng", blame_of_other: "Đổ lỗi cho người khác", neutral: "Trung tính",
};
const PARAM_LABELS = {
  aggression: "Hung hăng", openness: "Cởi mở", creativity: "Sáng tạo",
  confidence: "Tự tin", cooperation: "Hợp tác",
};
const CATEGORY_LABELS = {
  customer_support: "Chăm sóc khách hàng", hr: "Nhân sự", onboarding: "Hướng dẫn hội nhập",
};
const BACKEND_LABELS = {
  embeddings: "Tìm kiếm ngữ nghĩa", keyword: "Tìm kiếm từ khóa", none: "Chưa có",
};
const label = (labels, value) => labels[value] || value;

const $ = (id) => document.getElementById(id);

const SESSION_STORAGE_KEY = "emotionist.session_id";

function chatSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

async function api(path, body) {
  const isChatApi = path.startsWith("/api/chat/");
  const isChatState = path === "/api/chat/state";
  const sessionId = isChatApi ? chatSessionId() : null;

  if (isChatState) {
    path += `?session_id=${encodeURIComponent(sessionId)}`;
  } else if (isChatApi && body) {
    body = { ...body, session_id: sessionId };
  }

  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return data;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderEmotions(el, emotions) {
  if (!emotions || !emotions.length) {
    el.innerHTML = '<div class="calm">- bình tĩnh -</div>';
    return;
  }
  el.innerHTML = emotions
    .map((e) => {
      const pct = Math.round(e.intensity * 100);
      const color = EMOTION_COLORS[e.name] || "#94a3b8";
      return `<div class="emo-row">
        <span class="emo-name">${escapeHtml(label(EMOTION_LABELS, e.name))}</span>
        <div class="bar-track"><div class="bar-fill" style="background:${color}"></div></div>
        <span class="emo-pct">${pct}%</span>
      </div>`;
    })
    .join("");
  requestAnimationFrame(() => {
    el.querySelectorAll(".emo-row").forEach((row, i) => {
      row.querySelector(".bar-fill").style.width = Math.round(emotions[i].intensity * 100) + "%";
    });
  });
}

function renderParams(el, params) {
  const order = ["aggression", "openness", "creativity", "confidence", "cooperation"];
  el.innerHTML = order
    .map((k) => {
      const lvl = params[k].level;
      const cls = "lv-" + lvl.replace(/\s+/g, "-");
      return `<div class="chip ${cls}"><span class="lbl">${PARAM_LABELS[k]}</span><span class="val">${label(LEVEL_LABELS, lvl)}</span></div>`;
    })
    .join("");
}

function eventBadge(ev) {
  if (!ev || !ev.event_type) return "";
  const color = EVENT_COLORS[ev.event_type] || "#94a3b8";
  const flags = [];
  if (ev.directed_at_self) flags.push("hướng đến bạn");
  if (ev.intentional) flags.push("có chủ ý");
  const flagStr = flags.length ? " - " + flags.join(" - ") : "";
  const sev = (ev.severity ?? 0).toFixed(2);
  return `<span class="ev"><span class="ev-dot" style="background:${color}"></span>${escapeHtml(label(EVENT_LABELS, ev.event_type))} - mức độ ${sev}${flagStr}</span>`;
}
