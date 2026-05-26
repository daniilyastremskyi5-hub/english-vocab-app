import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { speakText } from "@/lib/speakText";
import { 
  getTranslationFromBreakdown,
  tryRepairJson,
  parsePillarMarkdown
} from "@/lib/breakdownRenderers";

export const Route = createFileRoute("/training")({
  component: TrainingComponent,
});

// ─────────────────────────────────────────────────────────────────────────
// Word Selection Card — self-contained with independent tab expansion state
// ─────────────────────────────────────────────────────────────────────────
const PILLAR_ICONS: Record<string, string> = {
  translation: "📝",
  meanings: "💡",
  family: "🔸",
  alternatives: "⇄",
  phrases: "📦",
  grammar: "📐",
  pitfalls: "⚠️",
  analysis: "🔍",
  breakdown: "🔍",
  summary: "📋",
  recommendations: "🚀",
};

interface WordSelectionCardProps {
  word: {
    id: string;
    word: string;
    breakdown: any;
    created_at: string;
    folder_id: string;
  };
  folder?: { id: string; name: string };
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onSpeak: (e: React.MouseEvent, word: string) => void;
}

function WordSelectionCard({
  word: w,
  folder,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onSpeak,
}: WordSelectionCardProps) {
  const trans = getTranslationFromBreakdown(w.breakdown) || "";

  // Build valid pillars list (non-empty content)
  const pillars: Array<{ key: string; label: string; content: string }> =
    w.breakdown && Array.isArray(w.breakdown.pillars)
      ? w.breakdown.pillars.filter(
          (p: any) => p && p.key && p.label && p.content && p.content.trim() !== ""
        )
      : [];

  const [activeTab, setActiveTab] = useState<string>(
    pillars.length > 0 ? pillars[0].key : "translation"
  );

  // When pillars become available, reset to first tab if current is gone
  const activePillar =
    pillars.find((p) => p.key === activeTab) ||
    (pillars.length > 0 ? pillars[0] : null);

  const dateLabel = new Date(w.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      onClick={(e) => onToggleSelect(w.id, e)}
      className={`word-card glass-card ${isSelected ? "selected" : ""} ${
        isExpanded ? "open" : ""
      }`}
    >
      <div className="wc-head" style={{ paddingLeft: "32px" }}>
        {/* Absolute checkbox */}
        <div
          className="tr-checkbox"
          style={{ position: "absolute", top: "2px", left: "0px", zIndex: 10 }}
        >
          {isSelected && (
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              check
            </span>
          )}
        </div>

        {/* Chevron — always show so card is always expandable */}
        <button
          className="wc-chevron"
          onClick={(e) => onToggleExpand(w.id, e)}
          style={{ display: "flex" }}
          aria-label="Развернуть"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            expand_more
          </span>
        </button>

        <div
          className="wc-word-row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            paddingRight: "56px",
          }}
        >
          <div className="wc-word">{w.word}</div>
          {folder && (
            <span
              className="wc-folder-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.45)",
                color: "var(--ll-on-surface-variant)",
                border: "1px solid rgba(255, 255, 255, 0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {folder.name}
            </span>
          )}
          <button
            className="sound-btn"
            onClick={(e) => onSpeak(e, w.word)}
            title="Прослушать"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ll-outline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              borderRadius: "50%",
              transition: "all 0.2s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              volume_up
            </span>
          </button>
        </div>

        {trans && <div className="wc-translation">{trans}</div>}

        <div className="wc-meta">
          <span className="wc-date">{dateLabel}</span>
        </div>
      </div>

      {/* Expanded details — premium multi-tab pillar breakdown */}
      <div className="wc-detail">
        <div className="wc-detail-inner">
          {isExpanded && pillars.length > 0 && (
            <>
              {/* Tab row — only show when multiple pillars */}
              {pillars.length > 1 && (
                <div
                  className="pillars-tabs-row no-scrollbar"
                  style={{ marginBottom: 12 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {pillars.map((p) => (
                    <button
                      key={p.key}
                      className={`pillar-tab ${
                        activeTab === p.key ? "active" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(p.key);
                      }}
                    >
                      <span className="pillar-icon">
                        {PILLAR_ICONS[p.key] ?? "🔹"}
                      </span>
                      <span className="pillar-label">{p.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Content window */}
              {activePillar && (
                <div
                  className="pillar-content-window"
                  onClick={(e) => e.stopPropagation()}
                  dangerouslySetInnerHTML={{
                    __html: parsePillarMarkdown(activePillar.content),
                  }}
                />
              )}
            </>
          )}

          {/* Fallback for words without a parsed breakdown yet */}
          {isExpanded && pillars.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: "var(--ll-outline)",
                padding: "8px 0",
                fontStyle: "italic",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Разбор ещё не загружен. Нажмите на слово на главной странице, чтобы его разобрать.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper: safe parse breakdown
function safeParseBreakdown(b: any): any {
  if (!b) return {};
  if (typeof b === "object") return b;
  try {
    return JSON.parse(b);
  } catch {
    return {};
  }
}

// Local storage helpers for guest mode
const LS_KEY = "wordbreaker.v1";
function loadStore(): any {
  if (typeof window === "undefined") return { history: [], words: [], folders: [], lang: "ru" };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { history: [], words: [], folders: [], lang: "ru" };
}

function saveStore(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ 
      history: s.history, 
      words: s.words, 
      folders: s.folders, 
      lang: s.lang 
    }));
  } catch {}
}

// Check if full breakdown loaded
function isFullBreakdownLoaded(breakdown: any): boolean {
  if (!breakdown) return false;
  return !!(breakdown._light && breakdown.breakdown);
}

// Retrieve a pillar content (from full JSON blocks or light JSON pillars)
function getPillarContent(breakdownObj: any, key: string): string | null {
  if (!breakdownObj) return null;
  
  // Check combined breakdown.breakdown.blocks first
  if (breakdownObj.breakdown && Array.isArray(breakdownObj.breakdown.blocks)) {
    const titleMap: Record<string, string> = {
      family: "Семейство",
      alternatives: "Альтернативы",
      phrases: "Готовые фразы"
    };
    const targetTitle = titleMap[key];
    if (targetTitle) {
      const block = breakdownObj.breakdown.blocks.find(
        (b: any) => b.title && b.title.toLowerCase().trim() === targetTitle.toLowerCase()
      );
      if (block && block.content) {
        return block.content;
      }
    }
  }

  // Fallback to light pillars
  const light = breakdownObj._light || breakdownObj;
  if (light && Array.isArray(light.pillars)) {
    const pillar = light.pillars.find((p: any) => p.key === key);
    if (pillar && pillar.content) {
      return pillar.content;
    }
  }

  return null;
}

// Parser: translation card
interface ParsedTranslation {
  translation: string;
  ruExamples: string[];
  enExamples: string[];
  note: string;
}
function parseTranslationCard(content: string, word: string): ParsedTranslation {
  const lines = content.split("\n");
  const ruExamples: string[] = [];
  const enExamples: string[] = [];
  let note = "";
  let translation = "";

  if (lines[0]) {
    const parts = lines[0].split(/(?:—|–|-)/);
    if (parts.length > 1) {
      translation = parts.slice(1).join("—").replace(/\.$/, "").trim();
    } else {
      translation = lines[0].trim();
    }
  }

  const exampleRegex = /\*(.*?)\*\s*(?:—|–|-)\s*(.*)/;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const match = line.match(exampleRegex);
    if (match) {
      enExamples.push(match[1].trim());
      ruExamples.push(match[2].replace(/\.$/, "").trim());
    } else {
      if (!line.startsWith("#") && !line.startsWith("`")) {
        note += (note ? " " : "") + line;
      }
    }
  }

  return { translation, ruExamples, enExamples, note };
}

// Parser: meanings cards
interface ParsedMeaning {
  context: string;
  translation: string;
  ruExamples: string[];
  enExamples: string[];
}
function parseMeaningsCards(content: string): ParsedMeaning[] {
  const cards: ParsedMeaning[] = [];
  if (!content) return cards;

  // Split by bold context definitions
  const sections = content.split(/\n(?=\*\*)/);
  
  for (let section of sections) {
    section = section.trim();
    if (!section) continue;

    const headerMatch = section.match(/^\*\*(.*?)\*\*/);
    if (headerMatch) {
      const context = headerMatch[1].trim();
      const rest = section.substring(headerMatch[0].length).trim();
      
      const ruExamples: string[] = [];
      const enExamples: string[] = [];
      
      // Inline matches for lookups like *stand your ground* (стоять на своём)
      const inlineExRegex = /(?:`|\*)([A-Za-z\s'!\?\-\.,]+)(?:`|\*)\s*\((.*?)\)/g;
      let inlineMatch;
      while ((inlineMatch = inlineExRegex.exec(section)) !== null) {
        enExamples.push(inlineMatch[1].trim());
        ruExamples.push(inlineMatch[2].trim());
      }
      
      // Lines split fallback
      const lines = rest.split("\n");
      const firstLine = lines[0].replace(/^(?:\s*—\s*|\s*-\s*)/, "").trim();
      let translation = "";
      
      if (enExamples.length === 0) {
        translation = firstLine;
      } else {
        translation = enExamples.join(", ");
      }
      
      cards.push({ context, translation, ruExamples, enExamples });
    }
  }

  // Fallback meanings as single card
  if (cards.length === 0) {
    const { translation, ruExamples, enExamples, note } = parseTranslationCard(content, "Значения");
    cards.push({
      context: "Дополнительные значения",
      translation: translation || "Значения",
      ruExamples: ruExamples.length ? ruExamples : [note],
      enExamples: enExamples.length ? enExamples : ["Meanings Details"]
    });
  }

  return cards;
}

// Parser: chips extractor
interface ChipItem {
  english: string;
  russian: string;
}
function parseChipItems(text: string): ChipItem[] {
  const results: ChipItem[] = [];
  if (!text) return results;

  const lines = text.split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Exact backtick pattern
    const match = line.match(/(?:`|\*)([A-Za-z\s'!\?\-\.,\(\)]+)(?:`|\*)\s*(?:—|–|-|\(|\s)\s*([^.*#]+)/);
    if (match) {
      const english = match[1].trim();
      let russian = match[2].trim();
      russian = russian.replace(/^\(|\)$/g, "").replace(/\.$/, "").trim();
      if (english && russian && !english.includes("\n") && !russian.includes("\n")) {
        results.push({ english, russian });
        continue;
      }
    }

    // Text prefix match fallback
    const fallbackMatch = line.match(/^([A-Za-z\s'!\?\-\.,\(\)]{2,30})\s*(?:—|–|-|\(|\s)\s*([^.()]+)/);
    if (fallbackMatch) {
      const english = fallbackMatch[1].trim();
      let russian = fallbackMatch[2].trim();
      russian = russian.replace(/^\(|\)$/g, "").replace(/\.$/, "").trim();
      if (english && russian && !english.toLowerCase().startsWith("example") && !english.includes("\n") && !russian.includes("\n")) {
        results.push({ english, russian });
      }
    }
  }
  return results;
}

interface WordRow {
  id: string;
  folder_id: string;
  word: string;
  breakdown: any;
  created_at: string;
}

interface TrainingFolder {
  id: string;
  name: string;
  created_at: string;
}

interface TrainingSession {
  id: string;
  words: string[];
  mode: string;
  created_at: string;
  folder_id: string | null;
}

interface CardDeckItem {
  id: string;
  type: "flip" | "chips" | "end";
  title: string;
  frontContext?: string;
  frontTranslate?: string;
  frontNotes?: string;
  ruExamples?: string[];
  enExamples?: string[];
  chips?: ChipItem[];
}

export function TrainingComponent() {
  const [session, setSession] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Navigation sidebar helper functions
  const toggleSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar && backdrop) {
      const open = sidebar.classList.toggle("open");
      backdrop.classList.toggle("open");
      document.body.classList.toggle("sidebar-open", open);
    }
  };

  const closeSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar && backdrop) {
      sidebar.classList.remove("open");
      backdrop.classList.remove("open");
      document.body.classList.remove("sidebar-open");
      setIsHistoryCardOpen(false);
    }
  };

  const [isHistoryCardOpen, setIsHistoryCardOpen] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<{
    projects: boolean;
    history: boolean;
  }>({
    projects: false,
    history: true
  });
  const [pastChats, setPastChats] = useState<Array<{ id: string; title: string; messages: Array<any> }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("ln_chat_history");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter(chat =>
              chat.messages && chat.messages.some((m: any) => m.role === "assistant" && m.type !== "breakdown")
            );
          }
        }
      } catch (e) {
        console.error("Error reading chat history:", e);
      }
    }
    return [];
  });

  // Click outside history popups
  useEffect(() => {
    if (!isHistoryCardOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".history-card-container")) {
        setIsHistoryCardOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isHistoryCardOpen]);
  
  // Library folders and words
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [words, setWords] = useState<WordRow[]>([]);
  
  // Training system folders and history (closed/isolated)
  const [trainingFolders, setTrainingFolders] = useState<TrainingFolder[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [activeTrainingFolder, setActiveTrainingFolder] = useState<string>("__all__");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [sessionToMove, setSessionToMove] = useState<string | null>(null);
  
  // Overlay & active selection
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [activeScreen, setActiveScreen] = useState<"selection" | "mode_select" | "loading" | "training">("selection");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, word: "" });
  
  // Search / filters for the overlay (mimicking "Мои слова")
  const [activeFolderFilter, setActiveFolderFilter] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortType, setSortType] = useState<"date" | "alpha">("date");
  const [expandedWordCards, setExpandedWordCards] = useState<Set<string>>(new Set());

  // Word selection filters
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  
  // Active Training session
  const [trainingWords, setTrainingWords] = useState<WordRow[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [wordCards, setWordCards] = useState<CardDeckItem[]>([]);
  
  // Flip states
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [flippedChips, setFlippedChips] = useState<Set<number>>(new Set());

  // Load user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCurrentUserId(data.session?.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fetch all database tables
  const loadData = async () => {
    if (currentUserId) {
      const [foldersRes, wordsRes, trFoldersRes, trSessionsRes] = await Promise.all([
        supabase.from("folders").select("id,name,created_at").order("created_at", { ascending: true }),
        supabase.from("words").select("id,folder_id,word,breakdown,created_at").order("created_at", { ascending: false }),
        (supabase as any).from("training_folders").select("id,name,created_at").order("created_at", { ascending: true }),
        (supabase as any).from("training_sessions").select("id,created_at,words,mode,folder_id").order("created_at", { ascending: false })
      ]);

      setFolders((foldersRes.data || []).map((f: any) => ({ id: f.id, name: f.name })));
      
      // Filter words strictly matching mode: "word" & canonical !== null, ignoring digests & sentences
      const rawWords = wordsRes.data || [];
      const parsedWords = rawWords.map((w: any) => ({
        id: w.id,
        folder_id: w.folder_id || "__all__",
        word: w.word,
        created_at: w.created_at,
        breakdown: safeParseBreakdown(w.breakdown)
      })).filter((w: any) => {
        const b = w.breakdown || {};
        const mode = b.mode || "";
        const canonical = b.canonical || null;
        if (mode === "digest" || b.mode === "context" || b.mode === "ru-map" || b.mode === "sentence") return false;
        
        const isWordMode = (mode === "word" || b.pillars || b.canonical);
        const hasCanonical = !!(canonical || w.word);
        return isWordMode && hasCanonical;
      });
      setWords(parsedWords);

      setTrainingFolders((trFoldersRes.data || []).map((tf: any) => ({
        id: tf.id,
        name: tf.name,
        created_at: tf.created_at
      })));

      setTrainingSessions((trSessionsRes.data || []).map((ts: any) => ({
        id: ts.id,
        words: ts.words || [],
        mode: ts.mode || "cards",
        created_at: ts.created_at,
        folder_id: ts.folder_id
      })));

    } else {
      // Guest local fallback loading
      const store = loadStore();
      setFolders((store.folders || []).map((f: any) => ({ id: f.id, name: f.name })));
      
      const rawLocalWords = store.words || [];
      const parsedLocalWords = rawLocalWords.map((w: any, i: number) => ({
        id: "local-w-" + i,
        folder_id: w.folder_id || "__all__",
        word: w.word,
        created_at: w.at || new Date().toISOString(),
        breakdown: safeParseBreakdown(w.breakdown)
      })).filter((w: any) => {
        const b = w.breakdown || {};
        const mode = b.mode || "";
        const canonical = b.canonical || null;
        if (mode === "digest" || b.mode === "context" || b.mode === "ru-map" || b.mode === "sentence") return false;
        
        const isWordMode = (mode === "word" || b.pillars || b.canonical);
        const hasCanonical = !!(canonical || w.word);
        return isWordMode && hasCanonical;
      });
      setWords(parsedLocalWords);
      setTrainingFolders([]);
      setTrainingSessions([]);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUserId]);

  // Create training folder
  const handleCreateTrainingFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !currentUserId) return;
    try {
      const { data, error } = await (supabase as any)
        .from("training_folders")
        .insert({
          user_id: currentUserId,
          name: newFolderName.trim()
        })
        .select()
        .single();
      if (!error && data) {
        setTrainingFolders(prev => [...prev, data as TrainingFolder]);
        setNewFolderName("");
        setIsCreatingFolder(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete training folder
  const handleDeleteTrainingFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!currentUserId) return;
    try {
      await (supabase as any).from("training_folders").delete().eq("id", id);
      setTrainingFolders(prev => prev.filter(f => f.id !== id));
      if (activeTrainingFolder === id) {
        setActiveTrainingFolder("__all__");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete training session
  const handleDeleteTrainingSession = async (id: string) => {
    if (!currentUserId) return;
    try {
      await (supabase as any).from("training_sessions").delete().eq("id", id);
      setTrainingSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Move training session to folder
  const handleMoveSession = async (sessionId: string, folderId: string | null) => {
    if (!currentUserId) return;
    try {
      await (supabase as any)
        .from("training_sessions")
        .update({ folder_id: folderId })
        .eq("id", sessionId);
      setTrainingSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folder_id: folderId } : s));
      setSessionToMove(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Library folder counters in overlay
  const getOverlayFolderCount = (folderId: string) => {
    if (folderId === "__all__") return words.length;
    return words.filter((w) => w.folder_id === folderId).length;
  };

  // Re-run session directly from history
  const handleRerunSession = (sessionWords: string[]) => {
    // Find the words rows matching names in the session
    const list = words.filter(w => sessionWords.some(sw => sw.toLowerCase() === w.word.toLowerCase()));
    if (list.length === 0) return;
    
    const ids = new Set(list.map(w => w.id));
    setSelectedWords(ids);
    setActiveScreen("mode_select");
  };

  // Sync / Full breakdown fetch loader
  const startTrainingCards = async () => {
    setActiveScreen("loading");
    const selectedList = words.filter(w => selectedWords.has(w.id));
    setTrainingWords(selectedList);
    
    const totalToLoad = selectedList.length;
    let currentIdx = 0;
    const updatedList: WordRow[] = [];

    for (const wordRow of selectedList) {
      currentIdx++;
      setLoadingProgress({ current: currentIdx, total: totalToLoad, word: wordRow.word });

      let combined = wordRow.breakdown;
      
      // Load full JSON if not cached
      if (!isFullBreakdownLoaded(combined)) {
        try {
          const lightDataObj = combined.pillars ? combined : {
            mode: "word",
            canonical: wordRow.word,
            pillars: []
          };
          const canonical = lightDataObj.canonical || wordRow.word;
          const pos = lightDataObj.pos || "";
          const type = lightDataObj.type || "";

          const resp = await fetch("/api/ai-breakdown", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canonical, pos, type, mode: "full" }),
          });

          if (resp.ok && resp.body) {
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              accumulated += decoder.decode(value, { stream: true });
            }

            const cleaned = accumulated.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
            let fullObj;
            try {
              fullObj = JSON.parse(cleaned);
            } catch (err) {
              fullObj = tryRepairJson(cleaned);
            }

            combined = { _light: lightDataObj, breakdown: fullObj };

            // Update Database Cache
            if (currentUserId) {
              await supabase.from("words").update({ breakdown: JSON.stringify(combined) }).eq("id", wordRow.id);
            } else {
              const store = loadStore();
              store.words = store.words.map((w: any) =>
                w.word.toLowerCase() === canonical.toLowerCase() ? { ...w, breakdown: combined } : w
              );
              saveStore(store);
            }
          }
        } catch (err) {
          console.warn("Failed caching full breakdown for: " + wordRow.word, err);
        }
      }

      updatedList.push({
        ...wordRow,
        breakdown: combined
      });
    }

    // Save session in database history if logged in
    if (currentUserId) {
      try {
        const { data, error } = await (supabase as any)
          .from("training_sessions")
          .insert({
            user_id: currentUserId,
            words: selectedList.map(w => w.word),
            mode: "cards",
            folder_id: activeTrainingFolder === "__all__" ? null : activeTrainingFolder
          })
          .select()
          .single();
        if (!error && data) {
          setTrainingSessions(prev => [data as TrainingSession, ...prev]);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setTrainingWords(updatedList);
    setCurrentWordIdx(0);
    buildDeckForWord(updatedList[0]);
    setActiveScreen("training");
  };

  // Build interactive cards array for the current word index
  const buildDeckForWord = (wordRow: WordRow, originalOrder = true) => {
    if (!wordRow) return;
    const b = wordRow.breakdown;
    const generated: CardDeckItem[] = [];

    // 1. Translation card (Type 1)
    const transText = getPillarContent(b, "translation");
    if (transText) {
      const parsed = parseTranslationCard(transText, wordRow.word);
      generated.push({
        id: "trans-" + wordRow.id,
        type: "flip",
        title: "Перевод",
        frontContext: "Перевод & Базовое значение",
        frontTranslate: parsed.translation,
        frontNotes: parsed.note,
        ruExamples: parsed.ruExamples,
        enExamples: parsed.enExamples
      });
    } else {
      const directTrans = getTranslationFromBreakdown(b) || "Перевод";
      generated.push({
        id: "trans-fallback-" + wordRow.id,
        type: "flip",
        title: "Перевод",
        frontContext: "Перевод",
        frontTranslate: directTrans,
        ruExamples: [],
        enExamples: []
      });
    }

    // 2. Meanings card (Type 1)
    const meaningsText = getPillarContent(b, "meanings");
    if (meaningsText) {
      const parsedMeanings = parseMeaningsCards(meaningsText);
      parsedMeanings.forEach((m, idx) => {
        generated.push({
          id: `meaning-${idx}-${wordRow.id}`,
          type: "flip",
          title: "Значение",
          frontContext: m.context,
          frontTranslate: m.translation,
          ruExamples: m.ruExamples,
          enExamples: m.enExamples
        });
      });
    }

    // 3. Family card (Type 2)
    const familyText = getPillarContent(b, "family");
    if (familyText) {
      const chips = parseChipItems(familyText);
      if (chips.length > 0) {
        generated.push({
          id: "family-" + wordRow.id,
          type: "chips",
          title: "Семейство слов",
          chips
        });
      }
    }

    // 4. Alternatives card (Type 2)
    const altText = getPillarContent(b, "alternatives");
    if (altText) {
      const chips = parseChipItems(altText);
      if (chips.length > 0) {
        generated.push({
          id: "alt-" + wordRow.id,
          type: "chips",
          title: "Альтернативы",
          chips
        });
      }
    }

    // 5. Phrases card (Type 2)
    const phrasesText = getPillarContent(b, "phrases");
    if (phrasesText) {
      const chips = parseChipItems(phrasesText);
      if (chips.length > 0) {
        generated.push({
          id: "phrases-" + wordRow.id,
          type: "chips",
          title: "Готовые фразы",
          chips
        });
      }
    }

    if (!originalOrder) {
      const transCard = generated[0];
      const rest = generated.slice(1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      setWordCards([transCard, ...rest, { id: "end-" + wordRow.id, type: "end", title: "Конец" }]);
    } else {
      setWordCards([...generated, { id: "end-" + wordRow.id, type: "end", title: "Конец" }]);
    }
    
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setFlippedChips(new Set());
  };

  const nextCard = () => {
    if (currentCardIdx < wordCards.length - 1) {
      setCurrentCardIdx(prev => prev + 1);
      setIsCardFlipped(false);
      setFlippedChips(new Set());
    }
  };

  const prevCard = () => {
    if (currentCardIdx > 0) {
      setCurrentCardIdx(prev => prev - 1);
      setIsCardFlipped(false);
      setFlippedChips(new Set());
    }
  };

  const nextWord = () => {
    if (currentWordIdx < trainingWords.length - 1) {
      const nextIdx = currentWordIdx + 1;
      setCurrentWordIdx(nextIdx);
      buildDeckForWord(trainingWords[nextIdx]);
    }
  };

  const prevWord = () => {
    if (currentWordIdx > 0) {
      const prevIdx = currentWordIdx - 1;
      setCurrentWordIdx(prevIdx);
      buildDeckForWord(trainingWords[prevIdx]);
    }
  };

  // Helper: check if a date is within selected range
  const inDateRange = (dateStr: string, from: string, to: string) => {
    if (!dateStr) return true;
    const d = new Date(dateStr).getTime();
    if (from) {
      const f = new Date(from).getTime();
      if (d < f) return false;
    }
    if (to) {
      const t = new Date(to).getTime() + 86400000; // include full day
      if (d > t) return false;
    }
    return true;
  };

  // Filter overlay words (Reuses logic of My Words)
  const filteredWords = words
    .filter((w) => activeFolderFilter === "__all__" || w.folder_id === activeFolderFilter)
    .filter((w) => inDateRange(w.created_at, filterFrom, filterTo))
    .filter((w) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const wordMatch = w.word && w.word.toLowerCase().includes(q);
      const directTrans = getTranslationFromBreakdown(w.breakdown) || "";
      return wordMatch || directTrans.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortType === "alpha") {
        return a.word.localeCompare(b.word);
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const toggleSelectWord = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".sound-btn") || target.closest(".wc-trash") || target.closest(".wc-chevron") || target.closest(".wc-detail")) {
      return;
    }
    const next = new Set(selectedWords);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedWords(next);
  };

  const toggleCardExpansion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedWordCards);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedWordCards(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedWords);
    filteredWords.forEach(w => next.add(w.id));
    setSelectedWords(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedWords);
    filteredWords.forEach(w => next.delete(w.id));
    setSelectedWords(next);
  };

  const getCurrentWordTranslation = () => {
    const w = trainingWords[currentWordIdx];
    if (!w) return "";
    return getTranslationFromBreakdown(w.breakdown) || w.word;
  };

  const handleSpeak = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    speakText(text);
  };

  const formatSessionDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "";
    }
  };

  // Active training sessions filtered by training folder
  const filteredSessions = trainingSessions.filter(s => {
    if (activeTrainingFolder === "__all__") return true;
    return s.folder_id === activeTrainingFolder;
  });

  return (
    <div className="ln">
      {/* Scoped CSS for isolation */}
      <style>{`
        .tr-hero-card {
          width: 100%;
          padding: 40px 32px;
          margin-bottom: 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          border-radius: 28px !important;
        }
        .tr-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
          width: 100%;
          align-items: start;
        }
        @media (max-width: 768px) {
          .tr-grid {
            grid-template-columns: 1fr;
          }
        }
        .tr-session-card {
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.15);
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          transition: all 0.2s ease;
        }
        .tr-session-card:hover {
          transform: translateY(-2px);
          border-color: rgba(48,89,185,0.25);
        }
        .tr-session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tr-session-word-badge {
          display: inline-block;
          font-size: 12px;
          background: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.7);
          padding: 2px 8px;
          border-radius: 6px;
          color: var(--ll-on-surface-variant);
          margin-right: 6px;
          margin-bottom: 6px;
        }
        .lib-folder {
          position: relative;
        }
        .tr-folder-delete {
          position: absolute;
          top: 8px;
          right: 12px;
          opacity: 0;
          transition: opacity 0.2s;
          color: var(--ll-outline);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        .lib-folder:hover .tr-folder-delete {
          opacity: 1;
        }
        .tr-folder-delete:hover {
          color: var(--rose) !important;
        }
        .tr-session-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 12px;
        }
        .tr-action-link {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--ll-primary);
          font-weight: 700;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .tr-action-link:hover {
          text-decoration: underline;
        }
        .tr-folder-select-dropdown {
          position: absolute;
          bottom: 40px; right: 20px;
          background: var(--popover);
          border: 1px solid rgba(255,255,255,0.25);
          box-shadow: 0 10px 24px rgba(0,0,0,0.15);
          border-radius: 12px;
          padding: 8px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 160px;
          backdrop-filter: blur(16px);
        }
        .tr-dropdown-item {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text);
          text-align: left;
          width: 100%;
        }
        .tr-dropdown-item:hover {
          background: rgba(48,89,185,0.08);
          color: var(--ll-primary);
        }
        .tr-overlay-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(16, 22, 35, 0.45);
          backdrop-filter: blur(24px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .tr-overlay-panel {
          width: 100%;
          max-width: 900px;
          height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.25);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.15);
        }
        .tr-overlay-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .tr-overlay-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.15);
        }
        .tr-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid var(--ll-outline);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: bold;
          font-size: 13px;
          margin-right: 12px;
          transition: all 0.15s;
        }
        .word-card.selected .tr-checkbox {
          background: var(--ll-primary);
          border-color: var(--ll-primary);
        }
      `}</style>

      {/* Atmospheric Parallax Orbs from __root */}
      <div className="ln-orb" style={{ top: -150, left: -150 }} />
      <div className="ln-orb" style={{ bottom: -250, right: -150 }} />

      {/* ── Navigation Drawer ── */}
      <aside className="sidebar glass-panel" id="sidebar">
        {/* Top Anchor: История чатов */}
        <div className="side-top history-card-container" style={{ position: "relative", marginBottom: "16px" }}>
          <button
            className={`side-item ${isHistoryCardOpen ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsHistoryCardOpen(prev => !prev);
            }}
            type="button"
          >
            <span className="ic material-symbols-outlined">history</span>
            <span>История чатов</span>
            <span 
              className="material-symbols-outlined"
              style={{ 
                marginLeft: "auto",
                fontSize: "18px",
                transform: isHistoryCardOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                color: "var(--ll-outline)"
              }}
            >
              expand_more
            </span>
          </button>

          {isHistoryCardOpen && (
            <div className="history-popup-card">
              {/* Раздел: Проекты */}
              <div className="card-section">
                <button
                  type="button"
                  className="history-popup-projects-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAccordion(prev => ({ ...prev, projects: !prev.projects }));
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--ll-outline)" }}>workspaces</span>
                  <span>Проекты</span>
                  <span className="chat-overlay-badge" style={{ marginLeft: "auto" }}>Скоро</span>
                  <span 
                    className="material-symbols-outlined"
                    style={{ 
                      fontSize: "16px",
                      transform: activeAccordion.projects ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                      color: "var(--ll-outline)"
                    }}
                  >
                    expand_more
                  </span>
                </button>
                <div 
                  style={{
                    maxHeight: activeAccordion.projects ? "80px" : "0px",
                    overflow: "hidden",
                    transition: "max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                >
                  <div className="history-popup-projects-content">
                    Проектов пока нет
                  </div>
                </div>
              </div>

              {/* Разделитель */}
              <div className="history-popup-card-divider" />

              {/* Раздел: Чаты */}
              <div className="card-section" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="history-popup-section-title">
                  <span>Чаты</span>
                </div>
                <div className="history-popup-chat-list">
                  {pastChats.length === 0 ? (
                    <div style={{ padding: "8px 12px", fontSize: "13px", color: "var(--ll-outline)", fontStyle: "italic" }}>
                      История пуста
                    </div>
                  ) : (
                    pastChats.slice(0, 25).map((chat) => {
                      const getChatDateString = (chatId: string) => {
                        try {
                          const tsStr = chat.id.replace("chat_", "");
                          const ts = parseInt(tsStr, 10);
                          if (!isNaN(ts)) {
                            const date = new Date(ts);
                            return date.toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit"
                            });
                          }
                        } catch (e) {}
                        return "";
                      };
                      
                      return (
                        <Link
                          key={chat.id}
                          to="/"
                          search={{ page: "breakdown", chatId: chat.id }}
                          onClick={closeSidebar}
                          className="side-sub-item-chat"
                          style={{ paddingLeft: "12px", display: "flex", alignItems: "center", width: "100%", textDecoration: "none" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", opacity: 0.7, marginRight: "8px" }}>chat_bubble</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "8px" }}>
                            {chat.title}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--ll-outline)", opacity: 0.8, marginLeft: "auto", flexShrink: 0 }}>
                            {getChatDateString(chat.id)}
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle centered items */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center" }}>
          <Link to="/" search={{ page: "breakdown" }} onClick={closeSidebar} className="side-item" style={{ textDecoration: "none" }}>
            <span className="ic material-symbols-outlined">chat_bubble</span>
            <span>Чат</span>
          </Link>
          <Link to="/" search={{ page: "library" }} onClick={closeSidebar} className="side-item" style={{ textDecoration: "none" }}>
            <span className="ic material-symbols-outlined">book</span>
            <span>Мои слова</span>
          </Link>
          <Link to="/" search={{ page: "history" }} onClick={closeSidebar} className="side-item" style={{ textDecoration: "none" }}>
            <span className="ic material-symbols-outlined">history</span>
            <span>История разборов</span>
          </Link>
          <Link to="/" search={{ page: "top" }} onClick={closeSidebar} className="side-item" style={{ textDecoration: "none" }}>
            <span className="ic material-symbols-outlined">workspace_premium</span>
            <span>Топ слов</span>
          </Link>
          <Link to="/training" onClick={closeSidebar} className="side-item active" style={{ textDecoration: "none" }}>
            <span className="ic material-symbols-outlined">school</span>
            <span>Тренировка</span>
          </Link>
        </nav>

        {/* Bottom Anchor: Аккаунт */}
        <div className="side-bottom">
          <Link to="/" search={{ page: "account" }} onClick={closeSidebar} className="side-item" style={{ textDecoration: "none" }}>
            <span className="ic material-symbols-outlined">account_circle</span>
            <span>Аккаунт</span>
          </Link>
        </div>
      </aside>
      <div className="sidebar-backdrop" id="sidebarBackdrop" onClick={closeSidebar}></div>

      {/* Floating App Bar with hamburger trigger */}
      <div className="app-bar">
        <button 
          className="menu-trigger glass-button" 
          id="menuTrigger" 
          aria-label="Меню" 
          type="button" 
          onClick={toggleSidebar}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      {/* Main Panel Spacer & content */}
      <div className="wrap">
        <div className="header" />
        
        <div className="training-container" style={{ maxWidth: "1000px" }}>

          {/* ──────────────── SCREEN 1: DASHBOARD MAIN SCREEN ──────────────── */}
          {activeScreen === "selection" && !isOverlayOpen && (
            <div style={{ width: "100%" }} className="fade-up scale-fade-in">
              
              {/* Hero Banner CTA */}
              <div className="tr-hero-card glass-card">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm mx-auto">
                  <span className="material-symbols-outlined" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>
                    school
                  </span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                  Тренировка словаря
                </h1>
                <p style={{ color: "var(--ll-on-surface-variant)", fontSize: 13, lineHeight: 1.5, margin: 0, maxWidth: 440 }}>
                  Закрепляй выученные слова в игровой форме! Полноценные интерактивные флеш-карточки по всем твоим папкам.
                </p>
                <button 
                  onClick={() => setIsOverlayOpen(true)}
                  className="btn-go success"
                  style={{ background: "var(--ll-primary)", color: "#fff", cursor: "pointer", padding: "12px 36px", borderRadius: "999px", fontWeight: 700, fontSize: 14, border: "none", boxShadow: "0 8px 24px rgba(48, 89, 185, 0.25)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6, fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                  Тренироваться
                </button>
              </div>

              {/* Training Folders & History Sections */}
              <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                
                {/* Training Folders */}
                <h3 className="section-label" style={{ marginBottom: "12px" }}>Папки тренировок</h3>
                
                <div className="lib-folders no-scrollbar" style={{ padding: "10px 4px", margin: "-10px -4px 18px -4px", borderBottom: "none" }}>
                  <button 
                    onClick={() => setActiveTrainingFolder("__all__")}
                    className={`lib-folder glass-card lib-folder--all ${activeTrainingFolder === "__all__" ? "active" : ""}`}
                  >
                    <div className="ic-wrap"><span className="material-symbols-outlined">bookmarks</span></div>
                    <span className="nm">Все сессии</span>
                    <span className="ct">{trainingSessions.length}</span>
                  </button>

                  {trainingFolders.map(tf => {
                    const count = trainingSessions.filter(s => s.folder_id === tf.id).length;
                    return (
                      <button 
                        key={tf.id}
                        onClick={() => setActiveTrainingFolder(tf.id)}
                        className={`lib-folder glass-card ${activeTrainingFolder === tf.id ? "active" : ""}`}
                      >
                        <div className="ic-wrap"><span className="material-symbols-outlined">folder</span></div>
                        <span className="nm">{tf.name}</span>
                        <span className="ct">{count}</span>
                        {currentUserId && (
                          <span 
                            className="folder-del tr-folder-delete" 
                            onClick={(e) => handleDeleteTrainingFolder(e, tf.id)}
                            title="Удалить папку"
                          >
                            ×
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {currentUserId ? (
                    <>
                      {isCreatingFolder ? (
                        <div className="lib-folder glass-card" style={{ padding: "16px", minWidth: "150px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <form onSubmit={handleCreateTrainingFolder} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                            <input 
                              type="text" 
                              autoFocus
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              placeholder="Название..."
                              style={{ 
                                fontSize: 13, 
                                padding: "6px 10px", 
                                background: "rgba(255,255,255,0.5)", 
                                border: "1px solid rgba(48,89,185,0.15)",
                                borderRadius: "10px",
                                color: "var(--text)",
                                width: "100%",
                                textAlign: "center",
                                outline: "none"
                              }}
                              onBlur={() => {
                                setTimeout(() => setIsCreatingFolder(false), 200);
                              }}
                            />
                          </form>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsCreatingFolder(true)}
                          className="lib-folder-add-card glass-card"
                        >
                          <div className="ic-wrap"><span className="material-symbols-outlined">add</span></div>
                          <span className="nm">Новая папка</span>
                        </button>
                      )}
                    </>
                  ) : null}
                </div>

                {/* Training Sessions History */}
                <div>
                  <h3 className="section-label" style={{ marginBottom: "16px" }}>История тренировок</h3>
                  
                  {!currentUserId ? (
                    // Guest state invite
                    <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
                      <div className="reh-emoji" style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
                      <div className="reh-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>История доступна в аккаунте</div>
                      <div className="reh-sub" style={{ fontSize: 13, color: "var(--ll-on-surface-variant)", lineHeight: 1.5, marginBottom: 20 }}>
                        Войдите или зарегистрируйтесь, чтобы сохранять сессии, отслеживать статистику по дням и распределять тренировки по папкам.
                      </div>
                      <Link 
                        to="/" 
                        className="glass-button" 
                        style={{ display: "inline-flex", padding: "10px 24px", borderRadius: 9999, textDecoration: "none", fontWeight: 700, color: "var(--ll-primary)" }}
                      >
                        Войти в аккаунт
                      </Link>
                    </div>
                  ) : filteredSessions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📊</div>
                      <div className="empty-title">
                        {activeTrainingFolder === "__all__" ? "История пуста" : "В этой папке пока нет тренировок"}
                      </div>
                      <div className="empty-sub">
                        После того как ты пройдешь карточки тренировки, статистика твоей сессии автоматически появится здесь.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {filteredSessions.map(s => {
                        const folder = trainingFolders.find(f => f.id === s.folder_id);
                        return (
                          <div key={s.id} className="tr-session-card glass-card">
                            
                            <div className="tr-session-header">
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="material-symbols-outlined" style={{ color: "var(--ll-primary)", fontSize: 20 }}>history_edu</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ll-outline)" }}>
                                  {formatSessionDate(s.created_at)}
                                </span>
                                {folder && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", color: "var(--ll-primary)", padding: "1px 6px", borderRadius: 4 }}>
                                    {folder.name}
                                  </span>
                                )}
                              </div>
                              
                              <button 
                                onClick={() => handleDeleteTrainingSession(s.id)}
                                className="sound-btn"
                                style={{ background: "transparent", border: "none", color: "var(--ll-outline)", cursor: "pointer", display: "flex", padding: 4 }}
                                title="Удалить из истории"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                              </button>
                            </div>

                            {/* Session words */}
                            <div style={{ padding: "4px 0" }}>
                              {s.words.slice(0, 10).map((w, idx) => (
                                <span key={idx} className="tr-session-word-badge">{w}</span>
                              ))}
                              {s.words.length > 10 && (
                                <span style={{ fontSize: 12, color: "var(--ll-outline)", fontWeight: 700 }}>
                                  + ещё {s.words.length - 10}
                                </span>
                              )}
                            </div>

                            {/* Session action links */}
                            <div className="tr-session-actions">
                              <button 
                                onClick={() => handleRerunSession(s.words)}
                                className="tr-action-link"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>replay</span>
                                Повторить
                              </button>

                              <button 
                                onClick={() => setSessionToMove(prev => prev === s.id ? null : s.id)}
                                className="tr-action-link"
                                style={{ color: "var(--ll-outline)" }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>folder_open</span>
                                Папка
                              </button>

                              {/* Dropdown list for changing folder */}
                              {sessionToMove === s.id && (
                                <div className="tr-folder-select-dropdown">
                                  <button 
                                    className="tr-dropdown-item" 
                                    onClick={() => handleMoveSession(s.id, null)}
                                    style={{ fontStyle: "italic", color: "var(--ll-outline)" }}
                                  >
                                    Без папки
                                  </button>
                                  {trainingFolders.map(tf => (
                                    <button 
                                      key={tf.id}
                                      className="tr-dropdown-item" 
                                      onClick={() => handleMoveSession(s.id, tf.id)}
                                    >
                                      {tf.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

          {activeScreen === "selection" && isOverlayOpen && (
            <div style={{ width: "100%", paddingBottom: "120px" }} className="fade-up scale-fade-in">
              
              {/* Header row mirroring "My Words" but adding close button */}
              <div className="lib-page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 className="section-label" style={{ margin: 0 }}>Выбор слов для тренировки</h2>
                
                {/* Close Button separating clearly from title */}
                <button 
                  onClick={() => setIsOverlayOpen(false)}
                  className="glass-button"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 9999, fontWeight: 700, fontSize: 13, border: "1px solid rgba(255,255,255,0.3)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  <span>Закрыть</span>
                </button>
              </div>

              <div className="library">
                
                {/* Scrollable Folder selection row */}
                <div className="lib-folders no-scrollbar" style={{ padding: "10px 4px", margin: "-10px -4px 18px -4px", borderBottom: "none" }}>
                  <button 
                    onClick={() => setActiveFolderFilter("__all__")}
                    className={`lib-folder glass-card lib-folder--all ${activeFolderFilter === "__all__" ? "active" : ""}`}
                  >
                    <div className="ic-wrap"><span className="material-symbols-outlined">bookmarks</span></div>
                    <span className="nm">Все слова</span>
                    <span className="ct">{getOverlayFolderCount("__all__")}</span>
                  </button>
                  {folders.map(f => (
                    <button 
                      key={f.id}
                      onClick={() => setActiveFolderFilter(f.id)}
                      className={`lib-folder glass-card ${activeFolderFilter === f.id ? "active" : ""}`}
                    >
                      <div className="ic-wrap"><span className="material-symbols-outlined">folder</span></div>
                      <span className="nm">{f.name}</span>
                      <span className="ct">{getOverlayFolderCount(f.id)}</span>
                    </button>
                  ))}
                </div>

                {/* Sub-Header matching "My Words" header and layout */}
                <div className="lib-words-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", marginBottom: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.15)", paddingTop: "20px" }}>
                  <h2 className="section-label" style={{ margin: 0 }}>
                    {activeFolderFilter === "__all__" ? "Недавние слова" : (folders.find(f => f.id === activeFolderFilter)?.name || "Недавние слова")}
                  </h2>
                  
                  {/* Action Filters: Search & Sort & Date Range Filter Panel */}
                  <div className="lib-actions-wrap" style={{ display: "flex", gap: "12px", alignItems: "center", position: "relative" }}>
                    
                    {/* Inline Search inside sub-header */}
                    <div className="glass-input" style={{ display: "flex", alignItems: "center", padding: "6px 14px", borderRadius: "12px", height: "36px", width: "220px" }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--ll-outline)", fontSize: 16, marginRight: 6 }}>search</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск..."
                        style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", width: "100%", fontSize: 13 }}
                      />
                    </div>

                    {/* Date filter dropdown panel trigger */}
                    <button 
                      onClick={() => setIsFilterPanelOpen(prev => !prev)}
                      className={`lib-action-btn ${(filterFrom || filterTo) ? "active" : ""}`} 
                      title="Фильтр по дате"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
                    </button>

                    {/* Alphabetical sort button */}
                    <button 
                      onClick={() => setSortType(prev => prev === "alpha" ? "date" : "alpha")}
                      className={`lib-action-btn ${sortType === "alpha" ? "active" : ""}`} 
                      title="Сортировка по алфавиту"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>sort_by_alpha</span>
                    </button>

                    {/* Date Filter Panel Dropdown */}
                    {isFilterPanelOpen && (
                      <div className="dfb-panel" style={{ right: 0, top: "40px" }}>
                        <label className="dfb-field">
                          <span>С</span>
                          <input 
                            type="date" 
                            value={filterFrom} 
                            onChange={(e) => setFilterFrom(e.target.value)} 
                          />
                        </label>
                        <label className="dfb-field">
                          <span>ПО</span>
                          <input 
                            type="date" 
                            value={filterTo} 
                            onChange={(e) => setFilterTo(e.target.value)} 
                          />
                        </label>
                        <button 
                          className="dfb-reset" 
                          disabled={!(filterFrom || filterTo)} 
                          onClick={() => {
                            setFilterFrom("");
                            setFilterTo("");
                            setIsFilterPanelOpen(false);
                          }}
                        >
                          Сбросить
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bulk Select Toggles */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingBottom: 10 }}>
                  <button 
                    onClick={selectAllFiltered}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ll-primary)", fontWeight: 700, fontSize: 12 }}
                  >
                    Выбрать все
                  </button>
                  <button 
                    onClick={deselectAllFiltered}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ll-outline)", fontWeight: 700, fontSize: 12 }}
                  >
                    Снять выбор
                  </button>
                </div>

                {/* lib-words grid matching index.tsx 1-to-1 */}
                <div className="lib-words">
                  {filteredWords.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📖</div>
                      <div className="empty-title">Ничего не найдено</div>
                      <div className="empty-sub">Измени поисковый запрос или фильтры.</div>
                    </div>
                  ) : (
                    filteredWords.map((w) => (
                      <WordSelectionCard
                        key={w.id}
                        word={w}
                        folder={folders.find(f => f.id === w.folder_id)}
                        isSelected={selectedWords.has(w.id)}
                        isExpanded={expandedWordCards.has(w.id)}
                        onToggleSelect={toggleSelectWord}
                        onToggleExpand={toggleCardExpansion}
                        onSpeak={handleSpeak}
                      />
                    ))
                  )}
                </div>

              </div>

              {/* Sticky Glassmorphic Float Bottom Action Bar */}
              <div className="glass-panel" style={{ 
                position: "fixed", 
                bottom: "24px", 
                left: "50%", 
                transform: "translateX(-50%)", 
                width: "calc(100% - 48px)", 
                maxWidth: "600px", 
                padding: "16px 24px", 
                borderRadius: "20px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                zIndex: 100,
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                border: "1px solid rgba(255,255,255,0.2)"
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                  Выбрано слов: <span style={{ color: "var(--ll-primary)", fontSize: 16 }}>{selectedWords.size}</span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button 
                    onClick={() => setIsOverlayOpen(false)}
                    className="glass-button"
                    style={{ padding: "8px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13 }}
                  >
                    Отмена
                  </button>
                  <button 
                    disabled={selectedWords.size === 0}
                    onClick={() => {
                      setIsOverlayOpen(false);
                      setActiveScreen("mode_select");
                    }}
                    className="btn-go success"
                    style={{ 
                      padding: "8px 24px", 
                      borderRadius: "999px", 
                      fontWeight: 700, 
                      fontSize: 13, 
                      background: selectedWords.size === 0 ? "rgba(255,255,255,0.15)" : "var(--ll-primary)", 
                      color: selectedWords.size === 0 ? "rgba(255,255,255,0.4)" : "#fff", 
                      border: "none", 
                      cursor: selectedWords.size === 0 ? "not-allowed" : "pointer" 
                    }}
                  >
                    ОК
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ──────────────── SCREEN 2: MODE SELECT SCREEN ──────────────── */}
          {activeScreen === "mode_select" && (
            <div className="training-setup-card glass-card fade-up scale-fade-in">
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                Выбери режим тренировки
              </h2>
              <p style={{ color: "var(--ll-on-surface-variant)", fontSize: 13, marginBottom: 28 }}>
                Выбрано слов для тренировки: <strong>{selectedWords.size}</strong>.
              </p>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button 
                  onClick={startTrainingCards}
                  className="glass-card"
                  style={{ width: "100%", maxWidth: "340px", padding: "28px 24px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)", display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", transition: "all 0.2s ease" }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(48,89,185,0.08)", border: "1px solid rgba(48,89,185,0.15)", display: "flex", alignItems: "center", justifyItems: "center", color: "var(--ll-primary)", marginBottom: 16 }}>
                    <span className="material-symbols-outlined" style={{ margin: "auto", fontSize: 28 }}>style</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Карточки</span>
                  <span style={{ fontSize: 12, color: "var(--ll-on-surface-variant)", lineHeight: 1.5, textAlign: "center" }}>
                    Изучай слова в режиме флеш-карт: базовые переводы, значения контекстов, семейство и фразы.
                  </span>
                </button>
              </div>

              <div style={{ marginTop: 32 }}>
                <button 
                  onClick={() => setActiveScreen("selection")}
                  style={{ background: "transparent", border: "none", color: "var(--ll-outline)", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Назад к выбору слов
                </button>
              </div>
            </div>
          )}

          {/* ──────────────── SCREEN 2 (SYNCING): DYNAMIC LOADING LOADER ──────────────── */}
          {activeScreen === "loading" && (
            <div className="training-setup-card glass-card fade-up scale-fade-in" style={{ padding: "50px 32px" }}>
              <div 
                className="mt-spin" 
                style={{ 
                  margin: "0 auto 24px auto", 
                  width: "56px", 
                  height: "56px", 
                  borderRadius: "50%", 
                  border: "3px solid var(--ll-primary)", 
                  borderTopColor: "transparent", 
                  animation: "ln-spin 0.8s linear infinite" 
                }} 
              />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                Подготовка тренировки...
              </h2>
              <p style={{ color: "var(--ll-on-surface-variant)", fontSize: 13, marginBottom: 20 }}>
                Загрузка полных разборов и синхронизация:
              </p>
              
              <div style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--ll-outline)", marginBottom: 6 }}>
                  <span>Слово: <strong style={{ color: "var(--ll-primary)" }}>{loadingProgress.word}</strong></span>
                  <span>{loadingProgress.current} из {loadingProgress.total}</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "rgba(48,89,185,0.1)", borderRadius: 99, overflow: "hidden" }}>
                  <div 
                    style={{ 
                      width: `${loadingProgress.total > 0 ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%`, 
                      height: "100%", 
                      background: "var(--ll-primary)", 
                      borderRadius: 99, 
                      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
                    }} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── SCREEN 3: ACTIVE TRAINING SCREEN ──────────────── */}
          {activeScreen === "training" && trainingWords[currentWordIdx] && (
            <div className="training-active-container fade-up">
              
              <div className="training-top-bar glass-panel">
                <button 
                  onClick={prevWord}
                  disabled={currentWordIdx === 0}
                  className="top-bar-btn"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                  <span>пред. слово</span>
                </button>

                <div className="top-bar-center">
                  <span className="top-bar-translation">{getCurrentWordTranslation()}</span>
                  <span className="top-bar-counter">Слово {currentWordIdx + 1} из {trainingWords.length}</span>
                </div>

                <button 
                  onClick={nextWord}
                  disabled={currentWordIdx === trainingWords.length - 1}
                  className="top-bar-btn"
                  style={{ justifyContent: "flex-end" }}
                >
                  <span>след. слово</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </button>
              </div>

              {/* CARD DECK VIEWPORT */}
              <div className="training-card-perspective scale-fade-in" key={trainingWords[currentWordIdx].id + "-" + currentCardIdx}>
                {wordCards[currentCardIdx] && (
                  <>
                    {/* ───── 3D FLIP CARD (Type 1) ───── */}
                    {wordCards[currentCardIdx].type === "flip" && (
                      <div 
                        onClick={() => setIsCardFlipped(prev => !prev)}
                        className={`training-card-inner ${isCardFlipped ? "flipped" : ""}`}
                      >
                        {/* Front Side (Russian) */}
                        <div className="training-card-front">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-primary)", background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", padding: "2px 10px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {wordCards[currentCardIdx].title}
                            </span>
                            <span className="material-symbols-outlined" style={{ color: "var(--ll-outline)", opacity: 0.6 }}>flip_camera_android</span>
                          </div>

                          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 0" }}>
                            <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 16 }}>
                              {wordCards[currentCardIdx].frontContext}
                            </h3>
                            
                            {wordCards[currentCardIdx].frontTranslate && (
                              <p style={{ fontSize: 16, color: "var(--ll-primary)", fontWeight: 500, marginBottom: 20 }}>
                                {wordCards[currentCardIdx].frontTranslate}
                              </p>
                            )}

                            {wordCards[currentCardIdx].ruExamples && wordCards[currentCardIdx].ruExamples!.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase" }}>Примеры:</span>
                                {wordCards[currentCardIdx].ruExamples!.map((ex, idx) => (
                                  <div key={idx} style={{ fontSize: 14, color: "var(--ll-on-surface-variant)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                                    <span>•</span>
                                    <span>{ex}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: "center", fontSize: 11, color: "var(--ll-outline)", fontWeight: 700 }}>
                            Кликни на карточку, чтобы перевернуть
                          </div>
                        </div>

                        {/* Back Side (English) */}
                        <div className="training-card-back">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-primary)", background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", padding: "2px 10px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              English
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button 
                                onClick={(e) => handleSpeak(e, trainingWords[currentWordIdx].word)}
                                className="sound-btn" 
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ll-outline)", display: "flex", padding: 2 }}
                                title="Прослушать слово"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>volume_up</span>
                              </button>
                              <span className="material-symbols-outlined" style={{ color: "var(--ll-outline)", opacity: 0.6 }}>flip_camera_android</span>
                            </div>
                          </div>

                          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 0" }}>
                            <h2 style={{ fontSize: 30, fontWeight: 700, color: "var(--ll-primary)", letterSpacing: "-0.02em", marginBottom: 20 }}>
                              {trainingWords[currentWordIdx].word}
                            </h2>

                            {/* English Examples */}
                            {wordCards[currentCardIdx].enExamples && wordCards[currentCardIdx].enExamples!.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase" }}>In Context:</span>
                                {wordCards[currentCardIdx].enExamples!.map((ex, idx) => (
                                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                    <span style={{ fontSize: 14, color: "var(--text)", fontStyle: "italic", lineHeight: 1.4 }}>
                                      {ex}
                                    </span>
                                    <button 
                                      onClick={(e) => handleSpeak(e, ex)}
                                      className="sound-btn" 
                                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ll-outline)", display: "flex", padding: 2 }}
                                      title="Прослушать"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>volume_up</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {wordCards[currentCardIdx].frontNotes && (
                              <div style={{ fontSize: 12, color: "var(--ll-outline)", marginTop: 16, fontStyle: "italic" }}>
                                {wordCards[currentCardIdx].frontNotes}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: "center", fontSize: 11, color: "var(--ll-outline)", fontWeight: 700 }}>
                            Кликни на карточку, чтобы вернуть перевод
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ───── CHIP CARD (Type 2 - Individual Flipping Chips) ───── */}
                    {wordCards[currentCardIdx].type === "chips" && (
                      <div className="training-card-front" style={{ cursor: "default" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-primary)", background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", padding: "2px 10px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {wordCards[currentCardIdx].title}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--ll-outline)", fontWeight: 700 }}>
                            Тапни на чип, чтобы перевернуть
                          </span>
                        </div>

                        <div className="chip-grid">
                          {wordCards[currentCardIdx].chips && wordCards[currentCardIdx].chips!.map((chip, idx) => {
                            const isFlipped = flippedChips.has(idx);
                            
                            return (
                              <div 
                                key={idx}
                                onClick={() => {
                                  const next = new Set(flippedChips);
                                  if (next.has(idx)) next.delete(idx);
                                  else next.add(idx);
                                  setFlippedChips(next);
                                }}
                                className="chip-card-item"
                              >
                                <div className={`chip-inner ${isFlipped ? "flipped" : ""}`}>
                                  {/* Front side (Russian name) */}
                                  <div className="chip-front">
                                    {chip.russian}
                                  </div>
                                  
                                  {/* Back side (English term) */}
                                  <div className="chip-back">
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span>{chip.english}</span>
                                      <span 
                                        className="material-symbols-outlined" 
                                        style={{ fontSize: 14, cursor: "pointer" }}
                                        onClick={(e) => handleSpeak(e, chip.english)}
                                      >
                                        volume_up
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ textAlign: "center", fontSize: 11, color: "var(--ll-outline)", fontWeight: 700 }}>
                          Чипы открываются независимо
                        </div>
                      </div>
                    )}

                    {/* ───── COMPLETION / END CARD VIEW ───── */}
                    {wordCards[currentCardIdx].type === "end" && (
                      <div className="training-card-front" style={{ cursor: "default", background: "linear-gradient(135deg, rgba(240,248,255,0.85) 0%, rgba(220,235,255,0.85) 100%)" }}>
                        <div className="end-card-layout">
                          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyItems: "center", color: "#10b981", marginBottom: 8 }}>
                            <span className="material-symbols-outlined" style={{ margin: "auto", fontSize: 32 }}>check_circle</span>
                          </div>
                          
                          <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                            Карточки слова изучены!
                          </h3>
                          <p style={{ color: "var(--ll-on-surface-variant)", fontSize: 13, maxWidth: 360, lineHeight: 1.5, marginBottom: 12 }}>
                            Вы просмотрели все <strong style={{ color: "var(--ll-primary)" }}>{wordCards.length - 1}</strong> карточки для слова <strong>{trainingWords[currentWordIdx].word}</strong>.
                          </p>

                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                            <button 
                              onClick={() => buildDeckForWord(trainingWords[currentWordIdx], false)}
                              className="glass-button"
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13 }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shuffle</span>
                              Перемешать
                            </button>
                            <button 
                              onClick={() => buildDeckForWord(trainingWords[currentWordIdx], true)}
                              className="btn-go success"
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13, background: "var(--ll-primary)", color: "#fff", border: "none", cursor: "pointer" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
                              Начать заново
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* CARD DECK CONTROLLER (Dot indicators & arrows) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", alignItems: "center" }}>
                
                <div className="nav-dots">
                  {wordCards.map((c, idx) => (
                    <div 
                      key={c.id}
                      onClick={() => {
                        setCurrentCardIdx(idx);
                        setIsCardFlipped(false);
                        setFlippedChips(new Set());
                      }}
                      className={`nav-dot ${idx === currentCardIdx ? "active" : ""}`}
                      title={c.title}
                    />
                  ))}
                </div>

                <div className="deck-navigation-arrows">
                  <button 
                    onClick={prevCard}
                    disabled={currentCardIdx === 0}
                    className="nav-arrow-btn"
                    title="Предыдущая карточка"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  
                  <button 
                    onClick={nextCard}
                    disabled={currentCardIdx === wordCards.length - 1}
                    className="nav-arrow-btn"
                    title="Следующая карточка"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>

              </div>

              {/* Quit Training Button */}
              <div style={{ marginTop: 24 }}>
                <button 
                  onClick={() => {
                    setActiveScreen("selection");
                    setSelectedWords(new Set());
                    loadData();
                  }}
                  className="glass-button"
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 24px", borderRadius: "999px", fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                  Завершить тренировку
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
