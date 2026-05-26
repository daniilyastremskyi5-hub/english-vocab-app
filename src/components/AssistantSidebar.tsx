import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";

export function AssistantSidebar() {
  const location = useLocation();
  if (location.pathname === "/training") return null;
  const [draft, setDraft] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
  const [auxiliaryText, setAuxiliaryText] = useState("");

  const actionItems = [
    { id: "digest", label: "Создать конспект", icon: "description" }
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);

    const handleStartSelection = () => {
      setIsSelectionMode(true);
      setSelectedCount(0);
      setAuxiliaryText("");
    };

    const handleCancelSelection = () => {
      setIsSelectionMode(false);
      setSelectedCount(0);
      setAuxiliaryText("");
    };

    const handleCountChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>;
      setSelectedCount(customEvent.detail.count);
    };

    window.addEventListener("ln-start-selection-mode", handleStartSelection);
    window.addEventListener("ln-cancel-selection-mode", handleCancelSelection);
    window.addEventListener("ln-selection-count-changed", handleCountChange);

    return () => {
      mql.removeEventListener("change", sync);
      window.removeEventListener("ln-start-selection-mode", handleStartSelection);
      window.removeEventListener("ln-cancel-selection-mode", handleCancelSelection);
      window.removeEventListener("ln-selection-count-changed", handleCountChange);
    };
  }, []);

  // Handle outside clicks to close Action Panel
  useEffect(() => {
    if (!isActionPanelOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".m-plus-menu-container")) {
        setIsActionPanelOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isActionPanelOpen]);

  function toggleActionPanel(e: React.MouseEvent) {
    e.stopPropagation();
    setIsActionPanelOpen(prev => !prev);
  }

  function handleActionClick(id: string) {
    setIsActionPanelOpen(false);
    if (id === "digest") {
      window.dispatchEvent(new CustomEvent("ln-start-selection-mode"));
    }
  }

  function handleCancelSelection() {
    window.dispatchEvent(new CustomEvent("ln-cancel-selection-mode"));
  }

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

  function handleSubmitDigest(e: FormEvent) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("ln-submit-digest", {
      detail: { auxiliaryText }
    }));
  }

  return (
    <div className="m-composer-wrap">
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[440px] px-4 z-50 transition-all duration-300">
        {isSelectionMode ? (
          /* Selection Mode / Digest Panel Composer */
          <div className="flex flex-col gap-3 w-full bg-[#f4f7fe]/95 backdrop-blur-xl border border-[#3059b9]/15 rounded-3xl p-4 shadow-2xl transition-all duration-300">
            {/* Top Selection Info Bar */}
            <div className="flex items-center justify-between px-2">
              <span className="font-semibold text-primary font-body-md" style={{ color: "var(--ll-primary)" }}>
                Выбрано реплик: <span className="bg-[#3059b9]/10 text-[#3059b9] px-2.5 py-0.5 rounded-full text-xs font-bold ml-1">{selectedCount}</span>
              </span>
              <button
                type="button"
                onClick={handleCancelSelection}
                className="text-on-surface-variant/60 hover:text-error hover:bg-error/10 p-1 rounded-full transition-all active:scale-90 flex items-center justify-center cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                aria-label="Отмена"
              >
                <span className="material-symbols-outlined text-lg" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            
            {/* Auxiliary text input & Send */}
            <form className="flex items-center gap-3" onSubmit={handleSubmitDigest}>
              <div className="glass-input flex-1 flex items-center pl-5 pr-2 py-1.5 rounded-full bg-[#e0eaff]/30 focus-within:bg-white/60 focus-within:shadow-md transition-all border border-transparent focus-within:border-[#3059b9]/10">
                <input
                  type="text"
                  className="bg-transparent border-none focus:ring-0 flex-1 font-body-md text-on-surface placeholder-on-surface-variant/40 outline-none p-0 h-10 text-[15px]"
                  placeholder="На чём сделать упор? (Опционально)"
                  value={auxiliaryText}
                  onChange={(e) => setAuxiliaryText(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ border: "none", outline: "none", boxShadow: "none" }}
                />
              </div>
              
              {/* Send/Submit Button */}
              <button
                type="submit"
                disabled={selectedCount === 0}
                className="glass-button w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ cursor: selectedCount === 0 ? "not-allowed" : "pointer" }}
                aria-label="Отправить"
              >
                <span className="material-symbols-outlined text-xl">send</span>
              </button>
            </form>
          </div>
        ) : (
          /* Normal Message Input Composer */
          <div className="flex items-center gap-3 w-full">
            {/* Extensible Action Menu Container */}
            <div className="m-plus-menu-container relative shrink-0">
              {/* Active Plus Action Button */}
              <button
                type="button"
                onClick={toggleActionPanel}
                className="glass-button w-12 h-12 rounded-full flex items-center justify-center text-primary shrink-0 transition-all active:scale-95 cursor-pointer"
                aria-label="Добавить"
              >
                <span 
                  className="material-symbols-outlined text-xl transition-transform duration-200"
                  style={{ transform: isActionPanelOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                >
                  add
                </span>
              </button>

              {/* Extensible Action Dropdown Panel */}
              {isActionPanelOpen && (
                <div
                  className="absolute bottom-16 left-0 bg-white/95 backdrop-blur-2xl border border-primary/10 rounded-2xl p-1.5 shadow-xl z-50 flex flex-col gap-0.5 w-48 animate-fade-in"
                  style={{
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.05)",
                    border: "1px solid rgba(48, 89, 185, 0.12)"
                  }}
                >
                  {actionItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleActionClick(item.id)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-[#3059b9]/5 transition-all text-left w-full active:scale-[0.98] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-primary text-[19px]" style={{ color: "var(--ll-primary)" }}>
                        {item.icon}
                      </span>
                      <span className="font-body-md font-medium text-xs text-[#3a4454]">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Glass Input Container */}
            <form
              className="glass-input flex-1 flex items-center pl-6 pr-2 py-2 rounded-full transition-all focus-within:shadow-xl focus-within:bg-white/60 focus-within:border-primary/20 bg-[#e0eaff]/40"
              onSubmit={submitMobileBreakdown}
            >
              <input
                type="text"
                className="bg-transparent border-none focus:ring-0 flex-1 font-body-md text-on-surface placeholder-on-surface-variant/50 outline-none p-0 h-10 text-[15px]"
                placeholder="Спроси меня о чём угодно..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                style={{ border: "none", outline: "none", boxShadow: "none" }}
              />
              {/* Send Button */}
              <button
                type="submit"
                disabled={!draft.trim()}
                className="glass-button w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ cursor: !draft.trim() ? "not-allowed" : "pointer" }}
                aria-label="Отправить"
              >
                <span className="material-symbols-outlined text-xl">send</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
