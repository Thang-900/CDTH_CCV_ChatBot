import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <>
      <div className="grain" />
      <div className="chrome" />
      <div className="glow" />

      <header className="topbar">
        <div className="hero">
          <span className="eyebrow">Mô phỏng hội thoại chuyên nghiệp</span>
          <div className="brand">EMOTIONIST<span className="dot">.AI</span></div>
          <div className="brand-sub">
            Đối tác thực hành biết <em>cảm nhận</em> - luyện tập những cuộc trò chuyện khó
            với nhân vật có cảm xúc và tâm trạng thay đổi theo cách bạn ứng xử.
          </div>
        </div>
      </header>

      <main className="wrap">
        <Outlet />
      </main>
    </>
  );
}
