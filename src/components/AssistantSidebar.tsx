import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    __lnRunBreakdown?: (q: string, ctx?: string) => void;
    __lnResetBreakdown?: () => void;
  }
}
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "normal" | "summary";
};

type Folder = { id: string; name: string };
type WordRow = { id: string; word: string };

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getPageInfo() {
  if (typeof window === "undefined")
    return { pageName: "", currentWord: "", breakdownText: "", isLibrary: false };
  const path = window.location.pathname;
  const active = document.querySelector(".side-item.active");
  const navLabel = (active?.textContent || "").trim();
  const results = document.getElementById("results");
  const breakdownText = (results?.textContent || "").trim().replace(/\s+/g, " ");
  const wordEl = results?.querySelector(".word");
  const currentWord =
    (wordEl?.textContent || "").replace(/^[^A-Za-zА-Яа-я]+/, "").trim() ||
    (document.getElementById("input") as HTMLInputElement | null)?.value?.trim() ||
    "";
  const pageName = navLabel || path || "Главная";
  const isLibrary = /мои\s*слова|my\s*words|library/i.test(navLabel);
  return { pageName, currentWord, breakdownText, isLibrary };
}

export function AssistantSidebar() {
  const [open, setOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [savePanelFor, setSavePanelFor] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [words, setWords] = useState<WordRow[]>([]);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileDraft, setMobileDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("assistant_open") : null;
    if (v === "0") setOpen(false);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("assistant_open", open ? "1" : "0");
    document.body.classList.toggle("assistant-open", open && !isMobile);
    document.body.classList.toggle("assistant-mobile", isMobile);
  }, [open, isMobile]);

  useEffect(() => {
    const sync = (uid: string | null) => {
      setUserId(uid);
      if (uid) loadLibrary(uid);
    };
    supabase.auth.getSession().then(({ data }) => sync(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      sync(s?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadLibrary(uid: string) {
    const [f, w] = await Promise.all([
      supabase.from("folders").select("id,name").eq("user_id", uid).order("created_at"),
      supabase.from("words").select("id,word").eq("user_id", uid).order("created_at"),
    ]);
    setFolders((f.data || []) as Folder[]);
    setWords((w.data || []) as WordRow[]);
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, sending]);

  function buildContext(): string {
    const info = getPageInfo();
    const parts = [`Текущая страница: ${info.pageName}`];
    if (info.currentWord) parts.push(`Текущее слово: ${info.currentWord}`);
    if (info.breakdownText)
      parts.push(`Разбор на экране: ${info.breakdownText.slice(0, 1500)}`);
    if (info.isLibrary || /My Words|Мои слова/i.test(info.pageName)) {
      if (folders.length)
        parts.push(`Папки: ${folders.map((f) => f.name).join(", ")}`);
      if (words.length)
        parts.push(`Слова: ${words.slice(0, 100).map((w) => w.word).join(", ")}`);
    }
    return parts.join("\n");
  }

  async function callClaude(history: Msg[], systemExtra?: string): Promise<string> {
    // Anthropic requires the conversation to start with a user message.
    let trimmed = history.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const firstUser = trimmed.findIndex((m) => m.role === "user");
    if (firstUser > 0) trimmed = trimmed.slice(firstUser);
    if (trimmed.length === 0 || trimmed[0].role !== "user") return "Не удалось получить ответ.";
    const res = await fetch("/api/chat-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: trimmed,
        context: buildContext(),
        systemExtra,
      }),
    });
    if (!res.ok) return "Не удалось получить ответ.";
    const json = (await res.json()) as { text?: string };
    return json.text || "Не удалось получить ответ.";
  }

  function handleBreakdownMarker(reply: string): { displayed: string } {
    // First line may be: @@BREAKDOWN: {"query":"...","context":"..."}
    const m = reply.match(/^\s*@@BREAKDOWN:\s*(\{[\s\S]*?\})\s*\n?/);
    if (!m) return { displayed: reply };
    try {
      const payload = JSON.parse(m[1]) as { query?: string; context?: string };
      const q = (payload.query || "").trim();
      if (q && typeof window !== "undefined" && window.__lnRunBreakdown) {
        window.__lnRunBreakdown(q, payload.context || "");
      }
    } catch {
      /* ignore malformed marker */
    }
    const stripped = reply.slice(m[0].length).trim();
    return { displayed: stripped || "Разбираю слева." };
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    const userMsg: Msg = { id: uid(), role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const reply = await callClaude(next);
      const { displayed } = handleBreakdownMarker(reply);
      setMessages([...next, { id: uid(), role: "assistant", content: displayed }]);
    } catch {
      setMessages([
        ...next,
        { id: uid(), role: "assistant", content: "Ошибка соединения." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function makeSummary() {
    if (sending || messages.length === 0) return;
    setSending(true);
    try {
      // Build a transcript and send it as a single user message so Anthropic
      // gets a valid conversation (must start AND end with a user message).
      const transcript = messages
        .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
        .join("\n\n");
      const summaryRequest: Msg = {
        id: uid(),
        role: "user",
        content:
          "Сделай краткое резюме на русском языке на основе следующего диалога. " +
          "3–6 предложений: ключевые вопросы пользователя и основные выводы/ответы. " +
          "Только текст резюме, без вступлений.\n\n--- ДИАЛОГ ---\n" +
          transcript,
      };
      const text = await callClaude([summaryRequest]);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: text, kind: "summary" },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function refineSummary(summaryId: string) {
    const correction = draft.trim();
    if (!correction || sending) return;
    const userMsg: Msg = { id: uid(), role: "user", content: correction };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const text = await callClaude(
        next,
        "Обновите последнее резюме с учётом правок пользователя. Верните только обновлённое резюме, без вступлений.",
      );
      setMessages((prev) => {
        const arr = [...prev];
        const idx = arr.findIndex((m) => m.id === summaryId);
        const newSummary: Msg = {
          id: uid(),
          role: "assistant",
          content: text,
          kind: "summary",
        };
        if (idx >= 0) arr.splice(idx + 1, 0, newSummary);
        else arr.push(newSummary);
        return arr;
      });
      setEditingSummaryId(null);
    } finally {
      setSending(false);
    }
  }

  // Save panel state per summary
  const [saveSeparate, setSaveSeparate] = useState(false);
  const [saveAttach, setSaveAttach] = useState(false);
  const [folderChoice, setFolderChoice] = useState<string>("");
  const [wordSearch, setWordSearch] = useState("");
  const [wordChoice, setWordChoice] = useState<string>("");

  const pageInfo = useMemo(getPageInfo, [savePanelFor, messages.length]);
  const suggestedWord = useMemo(() => {
    if (!pageInfo.currentWord) return null;
    const lc = pageInfo.currentWord.toLowerCase();
    return words.find((w) => w.word.toLowerCase() === lc) || null;
  }, [pageInfo.currentWord, words]);

  function openSavePanel(id: string) {
    setSavePanelFor(id);
    setSaveSeparate(false);
    setSaveAttach(false);
    setFolderChoice(folders[0]?.id || "");
    setWordChoice(suggestedWord?.id || "");
    setWordSearch(suggestedWord?.word || "");
  }

  async function doSave(summaryId: string) {
    if (!userId) {
      alert("Войдите, чтобы сохранить.");
      return;
    }
    const summary = messages.find((m) => m.id === summaryId);
    if (!summary) return;
    const inserts: { user_id: string; target_type: string; target_id: string; content: string }[] = [];
    if (saveSeparate && folderChoice) {
      inserts.push({
        user_id: userId,
        target_type: "folder",
        target_id: folderChoice,
        content: summary.content,
      });
    }
    if (saveAttach && wordChoice) {
      inserts.push({
        user_id: userId,
        target_type: "word",
        target_id: wordChoice,
        content: summary.content,
      });
    }
    if (inserts.length === 0) {
      alert("Выберите хотя бы один вариант.");
      return;
    }
    const { error } = await supabase.from("assistant_notes").insert(inserts);
    if (error) {
      alert("Ошибка сохранения: " + error.message);
      return;
    }
    setSavePanelFor(null);
    setSavedToast("Сохранено ✓");
    setTimeout(() => setSavedToast(null), 2000);
  }

  const filteredWords = wordSearch
    ? words.filter((w) => w.word.toLowerCase().includes(wordSearch.toLowerCase()))
    : words;

  function submitMobileBreakdown(e?: FormEvent) {
    if (e) e.preventDefault();
    const q = mobileDraft.trim();
    if (!q) return;
    if (typeof window !== "undefined" && window.__lnRunBreakdown) {
      window.__lnRunBreakdown(q, "");
    }
    setMobileDraft("");
  }

  function resetAll() {
    setMessages([]);
    setMobileDraft("");
    setDraft("");
    setSavePanelFor(null);
    setEditingSummaryId(null);
    if (typeof window !== "undefined" && window.__lnResetBreakdown) {
      window.__lnResetBreakdown();
    }
  }

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className="m-newchat"
          onClick={resetAll}
          aria-label="Новый разбор"
          title="Новый разбор"
        >
          ✏️
        </button>

        <form className="m-composer" onSubmit={submitMobileBreakdown} style={{ display: mobileSheetOpen ? "none" : "flex" }}>
          <button
            type="button"
            className="m-composer-chat"
            onClick={() => setMobileSheetOpen(true)}
            aria-label="Открыть чат"
          >
            💬
          </button>
          <input
            type="text"
            className="m-composer-input"
            placeholder="Разбери слово или фразу..."
            value={mobileDraft}
            onChange={(e) => setMobileDraft(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="m-composer-send"
            aria-label="Отправить"
            disabled={!mobileDraft.trim()}
          >
            ↑
          </button>
        </form>

        {mobileSheetOpen && (
          <div className="m-sheet-backdrop" onClick={() => setMobileSheetOpen(false)}>
            <div
              className="m-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="m-sheet-handle"
                onClick={() => setMobileSheetOpen(false)}
              />
              <div className="m-sheet-head">
                <span className="assistant-title">Ассистент</span>
                <button
                  type="button"
                  className="assistant-close"
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="assistant-messages" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="assistant-empty-center">
                    Задайте вопрос ассистенту по текущему слову или грамматике.
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`assistant-msg assistant-msg-${m.role}`}>
                    <div
                      className={`assistant-msg-bubble ${
                        m.kind === "summary" ? "assistant-msg-summary" : ""
                      }`}
                    >
                      {m.kind === "summary" && (
                        <div className="assistant-summary-label">📝 Резюме</div>
                      )}
                      {m.content}
                    </div>
                    {m.kind === "summary" && (
                      <div className="assistant-summary-actions">
                        <button type="button" onClick={() => openSavePanel(m.id)}>
                          Сохранить в My Words
                        </button>
                      </div>
                    )}
                    {m.kind === "summary" && savePanelFor === m.id && (
                      <div className="assistant-save-panel">
                        <label className="assistant-check">
                          <input
                            type="checkbox"
                            checked={saveSeparate}
                            onChange={(e) => setSaveSeparate(e.target.checked)}
                          />
                          Сохранить в папку
                        </label>
                        {saveSeparate && (
                          <select
                            className="assistant-select"
                            value={folderChoice}
                            onChange={(e) => setFolderChoice(e.target.value)}
                          >
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <label className="assistant-check">
                          <input
                            type="checkbox"
                            checked={saveAttach}
                            onChange={(e) => setSaveAttach(e.target.checked)}
                          />
                          Прикрепить к слову
                        </label>
                        {saveAttach && (
                          <>
                            {suggestedWord && (
                              <button
                                type="button"
                                className="assistant-suggest"
                                onClick={() => {
                                  setWordChoice(suggestedWord.id);
                                  setWordSearch(suggestedWord.word);
                                }}
                              >
                                Текущее: {suggestedWord.word}
                              </button>
                            )}
                            <input
                              type="text"
                              className="assistant-input-text"
                              placeholder="Поиск слова…"
                              value={wordSearch}
                              onChange={(e) => setWordSearch(e.target.value)}
                            />
                            <ul className="assistant-word-list">
                              {filteredWords.slice(0, 20).map((w) => (
                                <li key={w.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWordChoice(w.id);
                                      setWordSearch(w.word);
                                    }}
                                    style={{
                                      background:
                                        wordChoice === w.id ? "#e5e7eb" : "transparent",
                                    }}
                                  >
                                    {w.word}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        <div className="assistant-save-actions">
                          <button
                            type="button"
                            className="assistant-save-confirm"
                            onClick={() => doSave(m.id)}
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="assistant-msg assistant-msg-assistant">
                    <div className="assistant-msg-bubble assistant-typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                {savedToast && <div className="assistant-toast">{savedToast}</div>}
              </div>
              <div className="assistant-resume-bar">
                <button
                  type="button"
                  className="assistant-resume-btn"
                  onClick={makeSummary}
                  disabled={sending || messages.length === 0}
                >
                  📝 Сделать резюме
                </button>
              </div>
              <form
                className="assistant-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Спросите ассистента…"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button type="submit" disabled={sending || !draft.trim()}>
                  ➤
                </button>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="assistant-fab"
        aria-label="Открыть ассистента"
      >
        💬 Ваш личный ассистент
      </button>
    );
  }

  return (
    <aside className="assistant-sidebar">
      <header className="assistant-head">
        <div className="assistant-head-left">
          <span className="assistant-title">Ассистент</span>
          <button
            type="button"
            className="assistant-info-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Подсказка"
          >
            !
          </button>
          {showInfo && (
            <div className="assistant-info-pop" onClick={() => setShowInfo(false)}>
              Задавайте вопросы по текущему слову, просите о тренировке или задайте
              любой вопрос по английскому языку. Когда закончите — нажмите «Сделать
              резюме».
            </div>
          )}
        </div>
        <button
          type="button"
          className="assistant-close"
          onClick={() => setOpen(false)}
          aria-label="Свернуть"
        >
          ×
        </button>
      </header>

      <div className="assistant-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="assistant-empty-center">
            Вы можете спросить что-то о слове которое сейчас разбираете, попросить
            потренировать вас по словам из любой папки или задать вопрос по
            грамматике и употреблению.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`assistant-msg assistant-msg-${m.role}`}>
            <div
              className={`assistant-msg-bubble ${
                m.kind === "summary" ? "assistant-msg-summary" : ""
              }`}
            >
              {m.kind === "summary" && (
                <div className="assistant-summary-label">📝 Резюме</div>
              )}
              {m.content}
            </div>
            {m.kind === "summary" && (
              <div className="assistant-summary-actions">
                <button
                  type="button"
                  onClick={() =>
                    setEditingSummaryId(editingSummaryId === m.id ? null : m.id)
                  }
                >
                  Редактировать
                </button>
                <button type="button" onClick={() => openSavePanel(m.id)}>
                  Сохранить
                </button>
              </div>
            )}
            {m.kind === "summary" && editingSummaryId === m.id && (
              <div className="assistant-edit-hint">
                Введите правки в поле ниже и отправьте — резюме будет обновлено.
              </div>
            )}
            {m.kind === "summary" && savePanelFor === m.id && (
              <div className="assistant-save-panel">
                <label className="assistant-check">
                  <input
                    type="checkbox"
                    checked={saveSeparate}
                    onChange={(e) => setSaveSeparate(e.target.checked)}
                  />
                  Сохранить отдельно
                </label>
                {saveSeparate && (
                  <select
                    className="assistant-select"
                    value={folderChoice}
                    onChange={(e) => setFolderChoice(e.target.value)}
                  >
                    <option value="">— выберите папку —</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="assistant-check">
                  <input
                    type="checkbox"
                    checked={saveAttach}
                    onChange={(e) => setSaveAttach(e.target.checked)}
                  />
                  Прикрепить к слову
                </label>
                {saveAttach && (
                  <>
                    <input
                      type="text"
                      className="assistant-input-text"
                      placeholder="Поиск слова…"
                      value={wordSearch}
                      onChange={(e) => {
                        setWordSearch(e.target.value);
                        setWordChoice("");
                      }}
                    />
                    {suggestedWord && !wordChoice && (
                      <button
                        type="button"
                        className="assistant-suggest"
                        onClick={() => {
                          setWordChoice(suggestedWord.id);
                          setWordSearch(suggestedWord.word);
                        }}
                      >
                        Текущее: {suggestedWord.word}
                      </button>
                    )}
                    {wordSearch && !wordChoice && (
                      <ul className="assistant-word-list">
                        {filteredWords.slice(0, 8).map((w) => (
                          <li key={w.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setWordChoice(w.id);
                                setWordSearch(w.word);
                              }}
                            >
                              {w.word}
                            </button>
                          </li>
                        ))}
                        {filteredWords.length === 0 && (
                          <li className="assistant-empty">Ничего не найдено</li>
                        )}
                      </ul>
                    )}
                    {wordChoice && (
                      <div className="assistant-pick-tag">Выбрано: {wordSearch}</div>
                    )}
                  </>
                )}
                <div className="assistant-save-actions">
                  <button
                    type="button"
                    className="assistant-link"
                    onClick={() => setSavePanelFor(null)}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="assistant-save-confirm"
                    onClick={() => doSave(m.id)}
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="assistant-msg assistant-msg-assistant">
            <div className="assistant-msg-bubble assistant-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        {savedToast && <div className="assistant-toast">{savedToast}</div>}
      </div>

      <div className="assistant-resume-bar">
        <button
          type="button"
          className="assistant-resume-btn"
          onClick={makeSummary}
          disabled={sending || messages.length === 0}
        >
          📝 Сделать резюме
        </button>
      </div>

      <form
        className="assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (editingSummaryId) refineSummary(editingSummaryId);
          else send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            editingSummaryId ? "Опишите правки к резюме…" : "Спросите ассистента…"
          }
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (editingSummaryId) refineSummary(editingSummaryId);
              else send();
            }
          }}
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          ➤
        </button>
      </form>
    </aside>
  );
}
