import { useEffect, useState, type FormEvent } from "react";

export function AssistantSidebar() {
  const [draft, setDraft] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  function submitMobileBreakdown(e?: FormEvent) {
    if (e) e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    const win = window as any;
    if (typeof window !== "undefined" && win.__lnRunBreakdown) {
      win.__lnRunBreakdown(q, "");
    }
    setDraft("");
  }



  return (
    <div className="m-composer-wrap">
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[440px] px-4 z-50 transition-all duration-300">
        <div className="flex items-center gap-3 w-full">
          {/* Chat Toggle Button (completely dead) */}
          <button
            type="button"
            className="glass-button w-12 h-12 rounded-full flex items-center justify-center text-primary shrink-0 transition-all cursor-default"
            aria-label="Чат"
          >
            <span className="material-symbols-outlined text-xl">
              forum
            </span>
          </button>

          {/* Floating Glass Input Container */}
          <form
            className="glass-input flex-1 flex items-center pl-6 pr-2 py-2 rounded-full transition-all focus-within:shadow-xl focus-within:bg-white/60 focus-within:border-primary/20 bg-[#e0eaff]/40"
            onSubmit={submitMobileBreakdown}
          >
            <input
              type="text"
              className="bg-transparent border-none focus:ring-0 flex-1 font-body-md text-on-surface placeholder-on-surface-variant/50 outline-none p-0 h-10"
              placeholder="Спроси меня о чём угодно..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {/* Send Button */}
            <button
              type="submit"
              disabled={!draft.trim()}
              className="glass-button w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Отправить"
            >
              <span className="material-symbols-outlined text-xl">
                send
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
