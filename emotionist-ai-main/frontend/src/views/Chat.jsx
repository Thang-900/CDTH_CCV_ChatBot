import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import EmotionBars from "../components/EmotionBars.jsx";
import ParamChips from "../components/ParamChips.jsx";
import EventBadge from "../components/EventBadge.jsx";
import {
  BACKEND_LABELS, CATEGORY_LABELS, EMOTION_LABELS, PERSONALITY_LABELS, displayLabel,
} from "../uiText.js";

const DEFAULT_PERSONA = "Bạn là Morgan, một người điềm đạm đang trò chuyện.";

export default function Chat() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [spOpen, setSpOpen] = useState(false);

  // custom-agent config (advanced)
  const [cfg, setCfg] = useState({
    name: "Morgan", personality: "average", reactivity: 1.0,
    persona: DEFAULT_PERSONA, seed: "None", seedInt: 0.5,
  });

  const chatRef = useRef(null);
  useEffect(() => { api("/api/chat/state").then(setState); }, []);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [state, busy]);

  function customBody() {
    return {
      scenario_id: null,
      name: cfg.name || "Morgan",
      personality: cfg.personality,
      reactivity: parseFloat(cfg.reactivity),
      persona: cfg.persona,
      seed_emotion: cfg.seed && cfg.seed !== "None" ? cfg.seed : null,
      seed_intensity: parseFloat(cfg.seedInt),
    };
  }

  // One reset that respects the active mode (scenario preset vs custom).
  async function resetAgent({ scenario_id, custom }) {
    if (busy || !state) return;
    setBusy(true);
    try {
      const body = { model_id: state.model_id };
      if (scenario_id) body.scenario_id = scenario_id;
      else if (custom) Object.assign(body, customBody());
      else if (state.scenario_id) body.scenario_id = state.scenario_id;
      else Object.assign(body, customBody());
      const s = await api("/api/chat/reset", body);
      if (s.error) { alert(s.error); return; }
      setState(s);
    } catch (e) { alert("Yêu cầu không thành công: " + e); }
    finally { setBusy(false); }
  }

  async function changeModel(model_id) {
    if (busy || !state) return;
    setBusy(true);
    try {
      const body = { model_id };
      if (state.scenario_id) body.scenario_id = state.scenario_id;
      else Object.assign(body, customBody());
      const s = await api("/api/chat/reset", body);
      if (s.error) { alert(s.error); return; }
      setState(s);
    } catch (e) { alert("Yêu cầu không thành công: " + e); }
    finally { setBusy(false); }
  }

  async function setLanguage(lang) {
    if (busy || !state || state.language === lang) return;
    setBusy(true);
    try {
      const s = await api("/api/chat/language", { language: lang });
      if (s.error) { alert(s.error); return; }
      setState(s);
    } catch (e) { alert("Yêu cầu không thành công: " + e); }
    finally { setBusy(false); }
  }

  async function sendMessage() {
    const v = msg.trim();
    if (!v || busy) return;
    setMsg(""); setBusy(true);
    try {
      const s = await api("/api/chat/send", { message: v });
      if (s.error) { alert(s.error); return; }
      setState(s);
    } catch (e) { alert("Yêu cầu không thành công: " + e); }
    finally { setBusy(false); }
  }

  if (!state) return <section className="stage chat-stage"><div className="empty">Đang tải...</div></section>;

  const a = state.agent;
  const rx = state.reactivity_ref;
  const md = state.models.find((m) => m.id === state.model_id);
  const activeScenario = state.scenarios.find((s) => s.id === state.scenario_id);

  return (
    <section className="stage chat-stage">
      {/* Config */}
      <aside className="panel">
        <div className="micro-label">Kịch bản thực hành</div>
        <div className="scenario-cards">
          {state.scenarios.map((s) => (
            <button key={s.id} type="button" disabled={busy}
              className={"scn-card" + (state.scenario_id === s.id ? " active" : "")}
              onClick={() => resetAgent({ scenario_id: s.id })}>
              <span className="scn-cat">{displayLabel(CATEGORY_LABELS, s.category)}</span>
              <span className="scn-name">{s.display_name}</span>
              <span className="scn-sit">{s.situation}</span>
            </button>
          ))}
          <button type="button" disabled={busy}
            className={"scn-card scn-custom" + (!state.scenario_id ? " active" : "")}
            onClick={() => resetAgent({ custom: true })}>
            <span className="scn-cat">Tùy chỉnh</span>
            <span className="scn-name">Nhân vật tùy chỉnh</span>
            <span className="scn-sit">Tạo nhân vật của riêng bạn bên dưới.</span>
          </button>
        </div>

        <div className="micro-label">Mô hình AI</div>
        <label className="field"><span className="micro">Nhà cung cấp mô hình</span>
          <select value={state.model_id} disabled={busy} onChange={(e) => changeModel(e.target.value)}>
            {state.models.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available}>
                {m.available ? m.label : `${m.label} (chưa cấu hình khóa API)`}
              </option>
            ))}
          </select>
          <span className="hint">{md ? md.note : ""}</span>
        </label>

        <div className="micro-label">Ngôn ngữ phản hồi</div>
        <div className="lang-toggle">
          <button type="button" disabled={busy}
            className={"lang-btn" + (state.language === "vi" ? " active" : "")}
            onClick={() => setLanguage("vi")}>Tiếng Việt</button>
          <button type="button" disabled={busy}
            className={"lang-btn" + (state.language === "en" ? " active" : "")}
            onClick={() => setLanguage("en")}>Tiếng Anh</button>
        </div>
        <span className="hint">Bạn có thể đổi ngôn ngữ phản hồi ngay trong cuộc trò chuyện; một số mô hình chạy trên máy hoạt động tốt hơn với tiếng Anh.</span>

        <div className="micro-label">Nhân vật tùy chỉnh <span className="micro" style={{ opacity: 0.6 }}>(nâng cao)</span></div>
        <label className="field"><span className="micro">Tên</span>
          <input type="text" value={cfg.name} autoComplete="off"
                 onChange={(e) => setCfg({ ...cfg, name: e.target.value })} />
        </label>
        <label className="field"><span className="micro">Tính cách</span>
          <select value={cfg.personality} onChange={(e) => setCfg({ ...cfg, personality: e.target.value })}>
            {state.personalities.map((p) => <option key={p} value={p}>{displayLabel(PERSONALITY_LABELS, p)}</option>)}
          </select>
        </label>
        <label className="field"><span className="micro">Mức độ phản ứng <em>{parseFloat(cfg.reactivity).toFixed(2)}</em></span>
          <input type="range" min="0.3" max="2.0" step="0.05" value={cfg.reactivity}
                 onChange={(e) => setCfg({ ...cfg, reactivity: e.target.value })} />
          <span className="hint">Kiên cường {rx.resilient} - Cân bằng {rx.average} - Dễ bất ổn {rx.neurotic}</span>
        </label>
        <label className="field"><span className="micro">Mô tả nhân vật</span>
          <textarea rows="3" value={cfg.persona} onChange={(e) => setCfg({ ...cfg, persona: e.target.value })} />
        </label>

        <div className="micro-label">Cảm xúc ban đầu</div>
        <div className="seed-row">
          <select value={cfg.seed} onChange={(e) => setCfg({ ...cfg, seed: e.target.value })}>
            <option value="None">Không có</option>
            {state.seed_options.map((s) => <option key={s} value={s}>{displayLabel(EMOTION_LABELS, s)}</option>)}
          </select>
          <input type="range" min="0.1" max="1.0" step="0.05" value={cfg.seedInt}
                 onChange={(e) => setCfg({ ...cfg, seedInt: e.target.value })} />
        </div>

        <button className="btn btn-primary apply-btn" disabled={busy}
                onClick={() => resetAgent({ custom: true })}>Áp dụng nhân vật tùy chỉnh</button>
      </aside>

      {/* Conversation */}
      <div className="conv">
        <div className="conv-head">
          <span className="micro">Cuộc trò chuyện</span>
          <span className="pill">{a.name}</span>
        </div>
        {activeScenario && activeScenario.your_role && (
          <div className="role-cue">
            <div className="role-cue-line">
              <span className="role-cue-tag">Vai của bạn</span>
              {activeScenario.your_role}
            </div>
            <div className="role-cue-line">
              <span className="role-cue-tag alt">AI đóng vai</span>
              {activeScenario.display_name} - {activeScenario.situation}
            </div>
          </div>
        )}
        <div className="chat" ref={chatRef}>
          {(!state.messages || !state.messages.length) && !busy ? (
            <div className="empty">Hãy bắt đầu trò chuyện - gửi lời đầu tiên bạn muốn nói với nhân vật.</div>
          ) : (
            state.messages.map((m, i) =>
              m.role === "user" ? (
                <div className="msg sam" key={i}>
                  <div className="bubble">{m.text}</div>
                  <div className="meta">Bạn</div>
                </div>
              ) : (
                <div className="msg alex" key={i}>
                  <div className="bubble">{m.text}</div>
                  <div className="meta">Nhân vật đối thoại</div>
                  <EventBadge ev={m.event} />
                </div>
              )
            )
          )}
          {busy && (
            <div className="msg alex">
              <div className="bubble"><span className="thinking"><span></span><span></span><span></span></span></div>
              <div className="meta">Nhân vật đang suy nghĩ</div>
            </div>
          )}
        </div>
        <div className="inject">
          <input type="text" placeholder="Nhập lời nhắn..." value={msg} disabled={busy}
                 autoComplete="off" onChange={(e) => setMsg(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
          <button className="btn btn-primary" disabled={busy} onClick={sendMessage}>Gửi</button>
        </div>
      </div>

      {/* Live state */}
      <aside className="panel">
        <div className="panel-head">
          <div className="agent-name">{a.name}</div>
          <span className={"badge badge-" + a.personality}>{displayLabel(PERSONALITY_LABELS, a.personality)}</span>
        </div>
        <div className="micro-label">Cảm xúc hiện tại</div>
        <div className="emotions"><EmotionBars emotions={a.emotions} /></div>
        <hr />
        <div className="micro-label">Hồ sơ hành vi</div>
        <div className="params"><ParamChips params={a.params} /></div>
        <hr />
        <div className="sysprompt-head">
          <span className="micro-label" style={{ margin: 0 }}>Chỉ dẫn kỹ thuật dành cho AI</span>
          <button className="mini-btn" onClick={() => setSpOpen(!spOpen)}>{spOpen ? "Ẩn" : "Hiện"}</button>
        </div>
        {spOpen && <pre className="sysprompt">{a.system_prompt}</pre>}
        <hr />
        <div className="micro-label">
          Ngữ cảnh được truy xuất (RAG) <span className="micro" style={{ opacity: 0.6 }}>
            {state.retrieval_backend ? "- " + displayLabel(BACKEND_LABELS, state.retrieval_backend) : ""}</span>
        </div>
        <div className="retrieved">
          {!state.retrieved || !state.retrieved.length ? (
            <div className="calm">- chưa có nội dung được truy xuất -</div>
          ) : (
            state.retrieved.map((h, i) => (
              <div className="rag-row" key={i}><span className="rag-score">{h.score}</span>{h.text}</div>
            ))
          )}
        </div>
        <div className="decay">Hệ số suy giảm λ {a.decay} - mức phản ứng {a.reactivity}</div>
      </aside>
    </section>
  );
}
