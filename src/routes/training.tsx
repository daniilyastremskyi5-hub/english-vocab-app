import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { speakText } from "@/lib/speakText";
import { toast } from "sonner";
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
  onRemove?: (wordName: string) => void;
}

function WordSelectionCard({
  word: w,
  folder,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onSpeak,
  onRemove,
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
      onClick={(e) => {
        if (onRemove) {
          onToggleExpand(w.id, e);
        } else {
          onToggleSelect(w.id, e);
        }
      }}
      className={`word-card glass-card ${isSelected ? "selected" : ""} ${
        isExpanded ? "open" : ""
      }`}
      style={{ cursor: "pointer" }}
    >
      <div className="wc-head" style={{ paddingLeft: onRemove ? "0px" : "32px" }}>
        {/* Absolute checkbox */}
        {!onRemove && (
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
        )}

        {/* Chevron — always show so card is always expandable */}
        <button
          className="wc-chevron"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(w.id, e);
          }}
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
            onClick={(e) => {
              e.stopPropagation();
              onSpeak(e, w.word);
            }}
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
          {onRemove && (
            <button
              className="sound-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(w.word);
              }}
              title="Убрать из сессии"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--rose)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                borderRadius: "50%",
                transition: "all 0.2s ease",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                delete
              </span>
            </button>
          )}
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
  scores?: Record<string, string> | null;
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
  const [activeScreen, setActiveScreen] = useState<"selection" | "mode_select" | "loading" | "training" | "session_detail">("selection");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, word: "" });
  
  // Search / filters for the overlay (mimicking "Мои слова")
  const [activeFolderFilter, setActiveFolderFilter] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
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
  
  // New Cards Training states
  const [loadedCards, setLoadedCards] = useState<Record<string, any>>({});
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [cardsOrder, setCardsOrder] = useState<any[]>([]);
  const [chipsOrder, setChipsOrder] = useState<Record<string, any[]>>({});
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [flippedChips, setFlippedChips] = useState<Record<string, boolean>>({});
  const [isShuffled, setIsShuffled] = useState(false);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [activeHistorySession, setActiveHistorySession] = useState<TrainingSession | null>(null);
  const [isAddingToSessionMode, setIsAddingToSessionMode] = useState<string | null>(null);
  
  // Card ratings states
  const [cardRatings, setCardRatings] = useState<Record<string, { value: string; pillar: string }>>({});
  const [barBlinkRed, setBarBlinkRed] = useState(false);

  // Active Training Session Database states
  const [activeTrainingSessionId, setActiveTrainingSessionId] = useState<string | null>(null);
  const [sessionScores, setSessionScores] = useState<Record<string, string>>({});
  const sessionScoresRef = useRef<Record<string, string>>({});
  const debounceTimeoutRef = useRef<any>(null);

  const syncSessionScoresToDB = async (scoresToSave?: Record<string, string>) => {
    if (!currentUserId || !activeTrainingSessionId) return;
    const scores = scoresToSave || sessionScoresRef.current;
    try {
      await (supabase as any)
        .from("training_sessions")
        .update({ scores })
        .eq("id", activeTrainingSessionId);
    } catch (err) {
      console.error("Failed to sync session scores to DB:", err);
    }
  };

  const CHIPS_PER_CARD = 4;
  const slides = React.useMemo(() => {
    const list: any[] = [];
    cardsOrder.forEach(c => {
      if (c.type === "container") {
        const chips = chipsOrder[c.id] || c.chips || [];
        if (chips.length <= CHIPS_PER_CARD) {
          list.push({
            ...c,
            chips,
            pageIdx: 0,
            totalPages: 1,
            virtualId: c.id
          });
        } else {
          const totalPages = Math.ceil(chips.length / CHIPS_PER_CARD);
          for (let p = 0; p < totalPages; p++) {
            const pageChips = chips.slice(p * CHIPS_PER_CARD, (p + 1) * CHIPS_PER_CARD);
            list.push({
              ...c,
              chips: pageChips,
              pageIdx: p,
              totalPages,
              virtualId: `${c.id}-p${p}`
            });
          }
        }
      } else {
        list.push({
          ...c,
          virtualId: c.id
        });
      }
    });
    return list;
  }, [cardsOrder, chipsOrder]);

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
        (supabase as any).from("training_sessions").select("id,created_at,words,mode,folder_id,scores").order("created_at", { ascending: false })
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
        folder_id: ts.folder_id,
        scores: ts.scores || null
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

  // Save active training session to history
  const handleSaveSession = async (chosenFolderId?: string | null) => {
    if (isSessionSaved) return;
    
    const sessionWords = trainingWords.map(w => w.word);
    if (sessionWords.length === 0) return;

    const finalFolderId = chosenFolderId !== undefined ? chosenFolderId : (activeTrainingFolder === "__all__" ? null : activeTrainingFolder);

    if (currentUserId) {
      try {
        const { data, error } = await (supabase as any)
          .from("training_sessions")
          .insert({
            user_id: currentUserId,
            words: sessionWords,
            mode: "cards",
            folder_id: finalFolderId
          })
          .select()
          .single();
        if (!error && data) {
          setTrainingSessions(prev => [data as TrainingSession, ...prev]);
          setIsSessionSaved(true);
          toast.success("Сессия успешно сохранена в историю!");
        } else {
          toast.error("Не удалось сохранить сессию. Попробуйте еще раз.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Произошла ошибка при сохранении.");
      }
    } else {
      // Guest mode alert
      toast.warning("Войдите в аккаунт, чтобы сохранять историю в облако!");
    }
  };

  const handleRemoveWordFromSession = async (sessionId: string, wordToRemove: string) => {
    const sessionToUpdate = trainingSessions.find(s => s.id === sessionId);
    if (!sessionToUpdate) return;
    const updatedWords = sessionToUpdate.words.filter(w => w.toLowerCase() !== wordToRemove.toLowerCase());
    
    if (currentUserId) {
      try {
        const { error } = await (supabase as any)
          .from("training_sessions")
          .update({ words: updatedWords })
          .eq("id", sessionId);
        if (!error) {
          setTrainingSessions(prev => prev.map(s => s.id === sessionId ? { ...s, words: updatedWords } : s));
          setActiveHistorySession(prev => prev && prev.id === sessionId ? { ...prev, words: updatedWords } : prev);
          toast.success(`Слово "${wordToRemove}" успешно удалено из сессии!`);
        } else {
          toast.error("Не удалось обновить сессию.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Произошла ошибка при обновлении.");
      }
    } else {
      toast.warning("История тренировок доступна только в аккаунте.");
    }
  };

  const handleSaveSelectedWordsToSession = async () => {
    if (!isAddingToSessionMode) return;
    const sessionId = isAddingToSessionMode;
    
    // Map selected ids back to word names
    const chosenWordNames = words
      .filter(w => selectedWords.has(w.id))
      .map(w => w.word);

    if (currentUserId) {
      try {
        const { error } = await (supabase as any)
          .from("training_sessions")
          .update({ words: chosenWordNames })
          .eq("id", sessionId);
        if (!error) {
          setTrainingSessions(prev => prev.map(s => s.id === sessionId ? { ...s, words: chosenWordNames } : s));
          
          // Sync activeHistorySession state
          const updatedSession = trainingSessions.find(s => s.id === sessionId);
          if (updatedSession) {
            setActiveHistorySession({ ...updatedSession, words: chosenWordNames });
          } else {
            setActiveHistorySession(prev => prev && prev.id === sessionId ? { ...prev, words: chosenWordNames } : prev);
          }
          toast.success("Состав сессии успешно обновлен!");
        } else {
          toast.error("Не удалось обновить сессию.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Произошла ошибка при обновлении.");
      }
    } else {
      toast.warning("История тренировок доступна только в аккаунте.");
    }

    // Reset states and return to session details screen
    setIsAddingToSessionMode(null);
    setIsOverlayOpen(false);
    setActiveScreen("session_detail");
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

  // Prefetch cards in the background
  const preFetchCards = async (word: string) => {
    if (!word || loadedCards[word]) return;
    try {
      const resp = await fetch("/api/ai-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical: word, mode: "cards" }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setLoadedCards(prev => ({ ...prev, [word]: data }));
      }
    } catch (e) {
      console.warn("Background prefetch failed for word:", word, e);
    }
  };

  // Lazy cards loader for the current word Row
  const loadWordCards = async (wordRow: WordRow) => {
    if (!wordRow) return;
    const wordKey = wordRow.word;

    // Axis 2 reset, and Reset Axis 2 and Axis 3 flips upon Axis 1 (word change)
    setCurrentCardIdx(0);
    setFlippedCards({});
    setFlippedChips({});
    setIsShuffled(false);

    // Fetch existing card ratings from Supabase if authenticated
    if (currentUserId) {
      try {
        const { data: ratingsRes } = await (supabase as any)
          .from("card_ratings")
          .select("unit_id, value, pillar")
          .eq("canonical", wordRow.word)
          .order("created_at", { ascending: true });
        
        const localRatings: Record<string, { value: string; pillar: string }> = {};
        (ratingsRes || []).forEach((r: any) => {
          localRatings[r.unit_id] = { value: r.value, pillar: r.pillar };
        });
        setCardRatings(prev => ({ ...prev, ...localRatings }));
      } catch (e) {
        console.error("Error loading card ratings: ", e);
      }
    } else {
      setCardRatings({});
    }

    if (loadedCards[wordKey]) {
      const data = loadedCards[wordKey];
      setCardsOrder(data.cards || []);
      const initialChips: Record<string, any[]> = {};
      data.cards?.forEach((c: any) => {
        if (c.type === "container" && c.chips) {
          initialChips[c.id] = c.chips;
        }
      });
      setChipsOrder(initialChips);
      return;
    }

    setIsLoadingCards(true);
    try {
      const resp = await fetch("/api/ai-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical: wordRow.word, mode: "cards" }),
      });
      if (!resp.ok) throw new Error("Failed to fetch cards");
      const data = await resp.json();
      
      setLoadedCards(prev => ({ ...prev, [wordKey]: data }));
      setCardsOrder(data.cards || []);
      
      const initialChips: Record<string, any[]> = {};
      data.cards?.forEach((c: any) => {
        if (c.type === "container" && c.chips) {
          initialChips[c.id] = c.chips;
        }
      });
      setChipsOrder(initialChips);
    } catch (err) {
      console.error("Error loading cards for: " + wordRow.word, err);
      // Fallback: create a basic meaning card using the word itself
      const fallbackData = {
        mode: "cards",
        canonical: wordRow.word,
        word_ru: `${wordRow.word} — перевод`,
        cards: [
          {
            id: `${wordRow.word}-m-fallback`,
            type: "meaning",
            front_sense: getTranslationFromBreakdown(wordRow.breakdown) || "Значение слова",
            back_term: wordRow.word,
            examples: []
          }
        ]
      };
      setLoadedCards(prev => ({ ...prev, [wordKey]: fallbackData }));
      setCardsOrder(fallbackData.cards);
    } finally {
      setIsLoadingCards(false);
    }
  };

  // Sync / Full breakdown fetch loader
  const startTrainingCards = async () => {
    const selectedList = words.filter(w => selectedWords.has(w.id));
    if (selectedList.length === 0) return;
    
    setTrainingWords(selectedList);
    setCurrentWordIdx(0);
    setActiveScreen("training");
    setIsSessionSaved(false);
    setActiveTrainingSessionId(null);
    setSessionScores({});
    sessionScoresRef.current = {};
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const sessionWords = selectedList.map(w => w.word);
    
    // Auto-create training session in DB at start
    if (currentUserId) {
      try {
        const finalFolderId = activeTrainingFolder === "__all__" ? null : activeTrainingFolder;
        const { data, error } = await (supabase as any)
          .from("training_sessions")
          .insert({
            user_id: currentUserId,
            words: sessionWords,
            mode: "cards",
            folder_id: finalFolderId,
            scores: {}
          })
          .select()
          .single();
          
        if (!error && data) {
          setActiveTrainingSessionId(data.id);
          setTrainingSessions(prev => [data as TrainingSession, ...prev]);
        } else {
          console.error("Failed to auto-create training session:", error);
        }
      } catch (err) {
        console.error("Exception auto-creating training session:", err);
      }
    }
    
    // Load the first word's cards
    await loadWordCards(selectedList[0]);

    // Pre-fetch the next word in background
    if (selectedList.length > 1) {
      preFetchCards(selectedList[1].word);
    }
  };

  // Navigations (Axis 2)
  const nextCard = () => {
    if (currentUserId && currentCardIdx < slides.length) {
      const slide = slides[currentCardIdx];
      const rating = cardRatings[slide.virtualId];
      if (!rating) {
        setBarBlinkRed(true);
        setTimeout(() => setBarBlinkRed(false), 500);
        return;
      }
    }

    if (currentCardIdx < slides.length) {
      setCurrentCardIdx(prev => prev + 1);
      // Reset flip states upon moving card (Axis 2)
      setFlippedCards({});
      setFlippedChips({});
    }
  };

  const prevCard = () => {
    if (currentCardIdx > 0) {
      setCurrentCardIdx(prev => prev - 1);
      // Reset flip states upon moving card (Axis 2)
      setFlippedCards({});
      setFlippedChips({});
    }
  };

  // Navigations (Axis 1)
  const nextWord = async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    await syncSessionScoresToDB();

    if (currentWordIdx < trainingWords.length - 1) {
      const nextIdx = currentWordIdx + 1;
      setCurrentWordIdx(nextIdx);
      loadWordCards(trainingWords[nextIdx]);
      
      // Prefetch the one after next
      if (nextIdx < trainingWords.length - 1) {
        preFetchCards(trainingWords[nextIdx + 1].word);
      }
    }
  };

  const prevWord = async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    await syncSessionScoresToDB();

    if (currentWordIdx > 0) {
      const prevIdx = currentWordIdx - 1;
      setCurrentWordIdx(prevIdx);
      loadWordCards(trainingWords[prevIdx]);
      
      // Prefetch the one before next
      if (prevIdx > 0) {
        preFetchCards(trainingWords[prevIdx - 1].word);
      }
    }
  };

  // Shuffles & Resets
  const handleShuffle = () => {
    if (cardsOrder.length === 0) return;
    
    // Shuffle cardsOrder
    const newCards = [...cardsOrder];
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }

    // Shuffle chips within each container card
    const newChips = { ...chipsOrder };
    Object.keys(newChips).forEach(cardId => {
      if (newChips[cardId]) {
        const chips = [...newChips[cardId]];
        for (let i = chips.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [chips[i], chips[j]] = [chips[j], chips[i]];
        }
        newChips[cardId] = chips;
      }
    });

    setCardsOrder(newCards);
    setChipsOrder(newChips);
    setIsShuffled(true);
    
    // Reset Axis 2 and Axis 3 flip states upon shuffling
    setFlippedCards({});
    setFlippedChips({});
    setCurrentCardIdx(0);
  };

  const handleResetOrder = () => {
    const currentWord = trainingWords[currentWordIdx];
    if (!currentWord || !loadedCards[currentWord.word]) return;
    
    const originalData = loadedCards[currentWord.word];
    setCardsOrder(originalData.cards || []);
    
    const originalChips: Record<string, any[]> = {};
    originalData.cards?.forEach((c: any) => {
      if (c.type === "container" && c.chips) {
        originalChips[c.id] = c.chips;
      }
    });
    setChipsOrder(originalChips);
    setIsShuffled(false);
    
    // Reset Axis 2 and Axis 3 flip states upon reset
    setFlippedCards({});
    setFlippedChips({});
    setCurrentCardIdx(0);
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

  const getCurrentWordRu = () => {
    const w = trainingWords[currentWordIdx];
    if (!w) return "";
    const wordKey = w.word;
    let raw = "";
    if (loadedCards[wordKey]?.word_ru) {
      raw = loadedCards[wordKey].word_ru;
    } else {
      const translation = getTranslationFromBreakdown(w.breakdown);
      raw = translation ? `${w.word} — ${translation}` : w.word;
    }

    // Extract part after dash
    let russianPart = raw;
    const parts = raw.split(/\s*[\u2014\u2013-]\s*/);
    if (parts.length > 1) {
      russianPart = parts.slice(1).join(" — ").trim();
    }

    // If there are multiple comma-separated translations and the total length is long, show at most two
    if (russianPart.length > 30) {
      const items = russianPart.split(/\s*,\s*/);
      if (items.length > 1) {
        russianPart = items.slice(0, 2).join(", ");
      }
    }

    return russianPart;
  };

  const handleSpeak = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    speakText(text);
  };

  const toggleChipFlip = (e: React.MouseEvent, chipId: string) => {
    e.stopPropagation();
    setFlippedChips(prev => ({ ...prev, [chipId]: !prev[chipId] }));
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

  // Active training sessions filtered by training folder and non-empty scores
  const filteredSessions = trainingSessions.filter(s => {
    const hasScores = s.scores && Object.keys(s.scores).length > 0;
    if (!hasScores) return false;

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
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.5) !important;
        }
        .tr-hero-card:hover {
          transform: translateY(-3px);
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(48, 89, 185, 0.3) !important;
          box-shadow: 0 20px 40px rgba(48, 89, 185, 0.08);
        }
        .tr-hero-card:active {
          transform: translateY(-1px) scale(0.99);
        }
        .tr-hero-card:hover .tr-glass-circle {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 100%);
          transform: scale(1.05) rotate(5deg);
        }
        .tr-hero-card:hover .tr-glass-cta {
          background: var(--ll-primary);
          color: #fff;
          border-color: var(--ll-primary);
          box-shadow: 0 8px 20px rgba(48, 89, 185, 0.25);
          transform: scale(1.03);
        }
        .tr-glass-cta:hover {
          background: var(--ll-primary);
          color: #fff;
          border-color: var(--ll-primary);
          box-shadow: 0 8px 20px rgba(48, 89, 185, 0.25);
          transform: scale(1.03);
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
          border-radius: 20px;
          cursor: pointer;
        }
        .tr-session-card:hover {
          transform: translateY(-2px);
          border-color: rgba(48,89,185,0.25);
          box-shadow: 0 8px 24px rgba(48, 89, 185, 0.08);
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

        /* ── NEW LIQUID GLASS TRAINING SETUP STYLES ── */
        .tr-mode-select-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
          gap: 20px;
        }
        .tr-capsule-header {
          background: var(--glass-fill);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 28px;
          padding: 24px;
          text-align: center;
          box-shadow: var(--glass-shadow);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .tr-mode-badge {
          background: rgba(48, 89, 185, 0.08);
          color: var(--ll-primary);
          border: 1px solid rgba(48, 89, 185, 0.15);
          border-radius: 99px;
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(48, 89, 185, 0.03);
        }
        .tr-mode-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }
        .tr-mode-card {
          background: var(--glass-fill);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border);
          border-radius: 28px;
          padding: 22px 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-align: left;
          text-decoration: none;
          box-shadow: var(--glass-shadow);
          position: relative;
          overflow: hidden;
          width: 100%;
          border-color: rgba(255, 255, 255, 0.5);
        }
        .tr-mode-card:hover {
          transform: translateY(-3px);
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(48, 89, 185, 0.3);
          box-shadow: 0 20px 40px rgba(48, 89, 185, 0.08);
        }
        .tr-mode-card:active {
          transform: translateY(-1px) scale(0.99);
        }
        .tr-mode-card.disabled {
          opacity: 0.55;
          cursor: not-allowed;
          pointer-events: none;
        }
        .tr-glass-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.15) 100%);
          border: 1px solid rgba(255, 255, 255, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ll-primary);
          flex-shrink: 0;
          box-shadow: inset 0 1px 3px rgba(255, 255, 255, 0.6), 0 8px 16px rgba(48, 89, 185, 0.04);
          transition: all 0.3s ease;
        }
        .tr-mode-card:hover .tr-glass-circle {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 100%);
          transform: scale(1.05) rotate(5deg);
        }
        .tr-mode-card.disabled .tr-glass-circle {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
          color: var(--ll-outline);
          box-shadow: none;
        }
        .tr-mode-card-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(48, 89, 185, 0.08);
          color: var(--ll-primary);
          padding: 3px 8px;
          border-radius: 6px;
          position: absolute;
          top: 14px;
          right: 18px;
          letter-spacing: 0.05em;
          border: 1px solid rgba(48, 89, 185, 0.12);
        }
        .tr-glass-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 99px;
          background: var(--glass-fill-strong);
          border: 1px solid var(--glass-border-btn);
          color: var(--ll-primary);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          margin-top: 6px;
          box-shadow: var(--glass-shadow-btn);
        }
        .tr-mode-card:hover .tr-glass-cta {
          background: var(--ll-primary);
          color: #fff;
          border-color: var(--ll-primary);
          box-shadow: 0 8px 20px rgba(48, 89, 185, 0.25);
          transform: scale(1.03);
        }
        .tr-back-capsule {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 12px;
          width: 100%;
        }
        .tr-back-btn {
          background: var(--glass-fill);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          padding: 10px 24px;
          color: var(--ll-outline);
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.25s ease;
          text-decoration: none;
          box-shadow: var(--glass-shadow);
        }
        .tr-back-btn:hover {
          color: var(--ll-primary);
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(48, 89, 185, 0.25);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(48, 89, 185, 0.06);
        }
        .tr-back-btn:active {
          transform: translateY(0) scale(0.97);
        }

        /* ── PREMIUM GLASS CARDS TRAINING STYLES ── */
        .training-active-container {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-sizing: border-box;
        }
        .training-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-radius: 28px !important;
          border: 1px solid var(--glass-border) !important;
          background: var(--glass-panel-fill) !important;
          box-shadow: var(--glass-shadow);
          box-sizing: border-box;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .top-bar-btn {
          background: var(--glass-fill-strong);
          border: 1px solid var(--glass-border-btn);
          border-radius: 16px;
          padding: 6px 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--ll-primary);
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: all 0.2s ease;
          box-shadow: var(--glass-shadow-btn);
        }
        .top-bar-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.85);
          transform: translateY(-1px);
        }
        .top-bar-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.95);
        }
        .top-bar-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .top-bar-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex: 1;
        }
        .top-bar-translation {
          font-size: 16px;
          font-weight: 700;
          color: var(--ll-on-surface);
          line-height: 1.25;
          margin-bottom: 2px;
        }
        .top-bar-counter {
          font-size: 10px;
          font-weight: 700;
          color: var(--ll-outline);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .training-card-perspective {
          perspective: 1200px;
          width: 100%;
          min-height: 380px;
          margin: 12px 0 0 0;
          box-sizing: border-box;
        }
        .training-card-scroll {
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          padding-right: 4px;
        }
        .training-card-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .training-card-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
        }
        .training-card-scroll::-webkit-scrollbar-thumb {
          background: rgba(48, 89, 185, 0.3);
          border-radius: 999px;
          transition: background 0.2s ease;
        }
        .training-card-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(48, 89, 185, 0.5);
        }
        .training-card-inner {
          position: relative;
          width: 100%;
          height: 380px;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
          cursor: pointer;
          box-sizing: border-box;
        }
        .training-card-inner.flipped {
          transform: rotateY(180deg);
        }
        .training-card-front, .training-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 32px;
          border: 1px solid var(--glass-border) !important;
          background: var(--glass-fill) !important;
          box-shadow: var(--glass-shadow);
          box-sizing: border-box;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        .training-card-back {
          transform: rotateY(180deg);
        }
        .chip-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          width: 100%;
          margin: 12px 0 0 0;
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .chip-grid {
            grid-template-columns: 1fr;
          }
        }
        .chip-card-perspective {
          perspective: 800px;
          height: 90px;
          width: 100%;
          box-sizing: border-box;
        }
        .chip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
          cursor: pointer;
          box-sizing: border-box;
        }
        .chip-card-inner.flipped {
          transform: rotateY(180deg);
        }
        .chip-card-front, .chip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.7) !important;
          background: rgba(255, 255, 255, 0.45) !important;
          box-shadow: 0 4px 16px rgba(48, 89, 185, 0.02);
          box-sizing: border-box;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .chip-card-back {
          transform: rotateY(180deg);
          border-color: rgba(48,89,185,0.2) !important;
          background: rgba(240, 246, 255, 0.6) !important;
        }
        .chip-term {
          font-size: 15px;
          font-weight: 700;
          color: var(--ll-primary);
          line-height: 1.25;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chip-translate {
          font-size: 12px;
          font-weight: 500;
          color: var(--ll-on-surface);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .chip-examples-badge {
          align-self: flex-start;
          font-size: 9px;
          font-weight: 700;
          color: var(--ll-outline);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(0,0,0,0.02);
          padding: 1px 6px;
          border-radius: 6px;
        }
        .training-card-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          margin-top: 12px;
          box-sizing: border-box;
        }
        .nav-btn-main {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--glass-fill-strong);
          border: 1px solid var(--glass-border-btn);
          color: var(--ll-primary);
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: var(--glass-shadow-btn);
        }
        .nav-btn-main:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.85);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(48, 89, 185, 0.08);
        }
        .nav-btn-main:active:not(:disabled) {
          transform: translateY(0) scale(0.95);
        }
        .nav-btn-main:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }
        .nav-progress-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .nav-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ll-outline-variant);
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .nav-dot.active {
          background: var(--ll-primary);
          transform: scale(1.4);
          box-shadow: 0 0 8px rgba(48,89,185,0.4);
        }
        @keyframes rating-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .rating-bar-container.blink-red {
          animation: rating-shake 0.4s ease-in-out;
          border-color: rgba(239, 68, 68, 0.6) !important;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4) !important;
        }
        .action-bar-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.4);
          color: var(--ll-primary);
        }
        .action-bar-btn.active {
          background: rgba(48,89,185,0.06);
          color: var(--ll-primary);
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
        {activeScreen === "selection" && !isOverlayOpen && (
          <button 
            className="menu-trigger glass-button" 
            id="menuTrigger" 
            aria-label="Меню" 
            type="button" 
            onClick={toggleSidebar}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}

        {activeScreen === "selection" && isOverlayOpen && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", pointerEvents: "auto" }}>
            {isSearchVisible ? (
              <div className="glass-input fade-up animate-fade-in" style={{ display: "flex", alignItems: "center", padding: "6px 14px", borderRadius: "99px", height: "48px", width: "220px", border: "1px solid var(--glass-border-btn)", backdropFilter: "blur(12px)", background: "var(--glass-fill-strong)", boxShadow: "var(--glass-shadow-btn)" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--ll-outline)", fontSize: 16, marginRight: 6 }}>search</span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск..."
                  onBlur={() => {
                    if (!searchQuery) setIsSearchVisible(false);
                  }}
                  style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", width: "100%", fontSize: 13 }}
                />
                {searchQuery && (
                  <span 
                    className="material-symbols-outlined" 
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchVisible(false);
                    }}
                    style={{ color: "var(--ll-outline)", fontSize: 16, cursor: "pointer", marginLeft: 4 }}
                  >
                    close
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsSearchVisible(true)}
                className="glass-button"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "50%", padding: 0 }}
                title="Поиск"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Panel Spacer & content */}
      <div className="wrap" style={activeScreen === "training" ? { padding: "16px var(--sp-float) 80px" } : undefined}>
        {activeScreen !== "training" && <div className="header" />}
        
        <div className="training-container" style={{ maxWidth: "1000px" }}>

          {/* ──────────────── SCREEN 1: DASHBOARD MAIN SCREEN ──────────────── */}
          {activeScreen === "selection" && !isOverlayOpen && (
            <div style={{ width: "100%" }} className="fade-up scale-fade-in">
              
              {/* Hero Banner CTA */}
              <div 
                onClick={() => setIsOverlayOpen(true)}
                className="tr-hero-card glass-card"
              >
                <div className="tr-glass-circle">
                  <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                    school
                  </span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                  Тренировка словаря
                </h1>
                <p style={{ color: "var(--ll-on-surface-variant)", fontSize: 13, lineHeight: 1.5, margin: 0, maxWidth: 440 }}>
                  Закрепляй выученные слова в игровой форме! Полноценные интерактивные флеш-карточки по всем твоим папкам.
                </p>
                <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOverlayOpen(true);
                    }}
                    className="tr-glass-cta"
                    style={{ cursor: "pointer", padding: "10px 28px", fontSize: 13, border: "1px solid var(--glass-border-btn)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>play_circle</span>
                    <span>Тренироваться</span>
                  </button>
                </div>
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
                          <div 
                            key={s.id} 
                            className="tr-session-card glass-card"
                            onClick={() => {
                              setActiveHistorySession(s);
                              setActiveScreen("session_detail");
                            }}
                          >
                            
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTrainingSession(s.id);
                                }}
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
                            <div className="tr-session-actions" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => handleRerunSession(s.words)}
                                className="tr-action-link"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>replay</span>
                                Тренировать
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
            <>
              <div style={{ width: "100%", paddingBottom: "120px" }} className="fade-up scale-fade-in">
              
              {/* Header row mirroring "My Words" but adding close button */}
              <div className="lib-page-header-row" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "16px" }}>
                <h2 className="section-label" style={{ margin: 0 }}>Выбор слов для тренировки</h2>
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
            </div>

            {/* Sticky Glassmorphic Float Bottom Action Bar */}
              <div className="glass-card" style={{ 
                position: "fixed", 
                bottom: "28px", 
                left: "50%", 
                transform: "translateX(-50%)", 
                width: "calc(100% - 64px)", 
                maxWidth: "480px", 
                padding: "10px 24px", 
                borderRadius: "999px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                zIndex: 1000,
                boxShadow: "0 16px 40px rgba(48, 89, 185, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.7)",
                background: "rgba(255, 255, 255, 0.55)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)"
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  Выбрано слов: <span style={{ color: "var(--ll-primary)", fontSize: 15 }}>{selectedWords.size}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button 
                    onClick={() => {
                      setIsOverlayOpen(false);
                      if (isAddingToSessionMode) {
                        setIsAddingToSessionMode(null);
                        setActiveScreen("session_detail");
                      }
                    }}
                    className="glass-button"
                    style={{ padding: "6px 16px", borderRadius: "999px", fontWeight: 700, fontSize: 12, height: "34px", border: "1px solid rgba(255,255,255,0.3)" }}
                  >
                    Отмена
                  </button>
                  <button 
                    disabled={selectedWords.size === 0}
                    onClick={() => {
                      if (isAddingToSessionMode) {
                        handleSaveSelectedWordsToSession();
                      } else {
                        setIsOverlayOpen(false);
                        setActiveScreen("mode_select");
                      }
                    }}
                    className="btn-go success"
                    style={{ 
                      padding: "6px 20px", 
                      borderRadius: "999px", 
                      fontWeight: 700, 
                      fontSize: 12, 
                      height: "34px",
                      background: selectedWords.size === 0 ? "rgba(255,255,255,0.15)" : "var(--ll-primary)", 
                      color: selectedWords.size === 0 ? "rgba(255,255,255,0.4)" : "#fff", 
                      border: "none", 
                      cursor: selectedWords.size === 0 ? "not-allowed" : "pointer",
                      boxShadow: selectedWords.size === 0 ? "none" : "0 4px 12px rgba(48, 89, 185, 0.2)"
                    }}
                  >
                    ОК
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ──────────────── SCREEN 2: MODE SELECT SCREEN ──────────────── */}
          {activeScreen === "mode_select" && (
            <div className="tr-mode-select-container fade-up scale-fade-in">
              {/* Header Capsule */}
              <div className="tr-capsule-header">
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                  Выбери режим тренировки
                </h2>
                <div className="tr-mode-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>spellcheck</span>
                  <span>Слов: <strong>{selectedWords.size}</strong></span>
                </div>
              </div>

              {/* Mode Options Grid */}
              <div className="tr-mode-grid">
                {/* Mode 1: Cards (Active) */}
                <div 
                  onClick={startTrainingCards}
                  className="tr-mode-card"
                >
                  <div className="tr-glass-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>style</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Карточки</span>
                    <span style={{ fontSize: 12, color: "var(--ll-on-surface-variant)", lineHeight: 1.4 }}>
                      Изучай слова в режиме флеш-карт: базовые переводы, значения контекстов, семейство и фразы.
                    </span>
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div className="tr-glass-cta">
                        <span>Начать</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mode 2: Quiz/Testing (Coming Soon) */}
                <div className="tr-mode-card disabled">
                  <div className="tr-mode-card-badge">Скоро</div>
                  <div className="tr-glass-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>quiz</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Быстрый тест</span>
                    <span style={{ fontSize: 12, color: "var(--ll-on-surface-variant)", lineHeight: 1.4 }}>
                      Проверь свои знания: соотноси переводы со словами на время и бей рекорды.
                    </span>
                  </div>
                </div>

                {/* Mode 3: Listening (Coming Soon) */}
                <div className="tr-mode-card disabled">
                  <div className="tr-mode-card-badge">Скоро</div>
                  <div className="tr-glass-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>hearing</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Аудирование</span>
                    <span style={{ fontSize: 12, color: "var(--ll-on-surface-variant)", lineHeight: 1.4 }}>
                      Восприятие на слух: слушай произношение носителей и пиши слова под диктовку.
                    </span>
                  </div>
                </div>
              </div>

              {/* Back to Word Selection Button */}
              <div className="tr-back-capsule">
                <button 
                  onClick={() => setActiveScreen("selection")}
                  className="tr-back-btn"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                  <span>Назад к выбору слов</span>
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
            <div className="training-active-container fade-up" style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%", maxWidth: "600px", margin: "0 auto" }}>
              
              <div className="training-top-bar glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "20px", background: "var(--glass-fill)", border: "1px solid var(--glass-border)", backdropFilter: "blur(20px)", boxShadow: "var(--glass-shadow)" }}>
                <button 
                  onClick={prevWord}
                  disabled={currentWordIdx === 0}
                  className="top-bar-btn"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: currentWordIdx === 0 ? "not-allowed" : "pointer", color: currentWordIdx === 0 ? "var(--ll-outline-variant)" : "var(--ll-primary)", padding: "8px 12px" }}
                  title="Предыдущее слово"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chevron_left</span>
                </button>

                <div className="top-bar-center" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flex: 1, minWidth: 0, padding: "0 10px" }}>
                  <span className="top-bar-translation" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", textAlign: "center", display: "inline-block", lineHeight: 1.25, maxWidth: "100%", wordBreak: "keep-all", overflowWrap: "break-word" }}>
                    {getCurrentWordRu()}
                  </span>
                  <span className="top-bar-counter" style={{ fontSize: 11, fontWeight: 600, color: "var(--ll-outline)", marginTop: 2 }}>
                    {currentWordIdx + 1} из {trainingWords.length}
                  </span>
                </div>

                <button 
                  onClick={nextWord}
                  disabled={currentWordIdx === trainingWords.length - 1}
                  className="top-bar-btn"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: currentWordIdx === trainingWords.length - 1 ? "not-allowed" : "pointer", color: currentWordIdx === trainingWords.length - 1 ? "var(--ll-outline-variant)" : "var(--ll-primary)", padding: "8px 12px" }}
                  title="Следующее слово"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chevron_right</span>
                </button>
              </div>

              {isLoadingCards ? (
                /* Premium Glass Skeleton Loader */
                <div className="training-card-perspective scale-fade-in" style={{ width: "100%", height: "380px", position: "relative" }}>
                  <div className="training-card-front" style={{ justifyContent: "center", alignItems: "center", display: "flex", flexDirection: "column", height: "100%" }}>
                    <div 
                      className="mt-spin" 
                      style={{ 
                        margin: "0 auto 16px auto", 
                        width: "48px", 
                        height: "48px", 
                        borderRadius: "50%", 
                        border: "3px solid var(--ll-primary)", 
                        borderTopColor: "transparent", 
                        animation: "ln-spin 0.8s linear infinite" 
                      }} 
                    />
                    <span style={{ fontSize: 14, color: "var(--ll-on-surface-variant)", fontWeight: 600 }}>
                      Сборка карточек разбора...
                    </span>
                  </div>
                </div>
              ) : (
                /* CARD DECK VIEWPORT */
                <div className="training-card-perspective scale-fade-in" key={trainingWords[currentWordIdx].id + "-" + currentCardIdx} style={{ width: "100%", minHeight: "380px" }}>
                  {currentCardIdx < slides.length ? (
                    (() => {
                      const card = slides[currentCardIdx];
                      
                      if (card.type === "meaning") {
                        const isFlipped = !!flippedCards[card.id];
                        return (
                          <div 
                            onClick={() => setFlippedCards(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                            className={`training-card-inner ${isFlipped ? "flipped" : ""}`}
                            style={{ width: "100%", height: "380px" }}
                          >
                            {/* Front Side (RU) */}
                            <div className="training-card-front" style={{ height: "100%", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-primary)", background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", padding: "4px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Значение {currentCardIdx + 1}
                                </span>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleShuffle(); }}
                                    className="sound-btn"
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: "pointer",
                                      color: "var(--ll-primary)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Перемешать порядок"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shuffle</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleResetOrder(); }}
                                    disabled={!isShuffled}
                                    className="sound-btn"
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: isShuffled ? "pointer" : "not-allowed",
                                      color: isShuffled ? "var(--ll-primary)" : "var(--ll-outline-variant)",
                                      opacity: isShuffled ? 1 : 0.5,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Сбросить порядок"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setFlippedCards(prev => ({ ...prev, [card.id]: !prev[card.id] })); }}
                                    className="sound-btn"
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: "pointer",
                                      color: "var(--ll-primary)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Перевернуть"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                                  </button>
                                </div>
                              </div>

                              <div style={{ flex: 1, display: "flex", flexDirection: "column", margin: "12px 0", minHeight: 0, overflow: "hidden" }}>
                                <div className="training-card-scroll" onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "auto 0" }}>
                                    <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", lineHeight: 1.35, marginBottom: 0 }}>
                                      {card.front_sense}
                                    </h3>
                                    
                                    {card.examples && card.examples.length > 0 && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 12 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Примеры в контексте:</span>
                                        {card.examples.map((ex: any, idx: number) => (
                                          <div key={idx} style={{ fontSize: 13, color: "var(--ll-on-surface-variant)", display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.4 }}>
                                            <span style={{ color: "var(--ll-primary)", flexShrink: 0 }}>•</span>
                                            <span>{ex.ru}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: "center", fontSize: 11, color: "var(--ll-outline)", fontWeight: 700, letterSpacing: "0.02em" }}>
                                Кликни на карточку, чтобы узнать английский перевод
                              </div>
                            </div>

                            {/* Back Side (EN) */}
                            <div className="training-card-back" style={{ height: "100%", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-primary)", background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", padding: "4px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Английский
                                </span>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={(e) => handleSpeak(e, card.back_term)}
                                    className="sound-btn" 
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: "pointer",
                                      color: "var(--ll-primary)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Прослушать слово"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>volume_up</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleShuffle(); }}
                                    className="sound-btn"
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: "pointer",
                                      color: "var(--ll-primary)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Перемешать порядок"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shuffle</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleResetOrder(); }}
                                    disabled={!isShuffled}
                                    className="sound-btn"
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: isShuffled ? "pointer" : "not-allowed",
                                      color: isShuffled ? "var(--ll-primary)" : "var(--ll-outline-variant)",
                                      opacity: isShuffled ? 1 : 0.5,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Сбросить порядок"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setFlippedCards(prev => ({ ...prev, [card.id]: !prev[card.id] })); }}
                                    className="sound-btn"
                                    style={{
                                      background: "var(--glass-fill-strong)",
                                      border: "1px solid var(--glass-border-btn)",
                                      cursor: "pointer",
                                      color: "var(--ll-primary)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      boxShadow: "var(--glass-shadow-btn)",
                                      transition: "all 0.2s ease"
                                    }}
                                    title="Перевернуть"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                                  </button>
                                </div>
                              </div>

                              <div style={{ flex: 1, display: "flex", flexDirection: "column", margin: "12px 0", minHeight: 0, overflow: "hidden" }}>
                                <div className="training-card-scroll" onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "auto 0" }}>
                                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--ll-primary)", letterSpacing: "-0.01em", marginBottom: 0, lineHeight: 1.2 }}>
                                      {card.back_term}
                                    </h2>

                                    {card.examples && card.examples.length > 0 && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 12 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase", letterSpacing: "0.05em" }}>In Context:</span>
                                        {card.examples.map((ex: any, idx: number) => (
                                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                            <span style={{ fontSize: 14, color: "var(--text)", fontStyle: "italic", lineHeight: 1.45, flex: 1 }}>
                                              {ex.en}
                                            </span>
                                            <button 
                                              onClick={(e) => handleSpeak(e, ex.en)}
                                              className="sound-btn" 
                                              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ll-outline)", display: "flex", padding: 2, flexShrink: 0 }}
                                              title="Прослушать пример"
                                            >
                                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>volume_up</span>
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: "center", fontSize: 11, color: "var(--ll-outline)", fontWeight: 700, letterSpacing: "0.02em" }}>
                                Кликни на карточку, чтобы вернуться к русскому значению
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Type is "container" (Grid of mini chips)
                        const chips = card.chips || [];
                        return (
                          <div className="training-card-front" style={{ position: "relative", cursor: "default", height: "380px", display: "flex", flexDirection: "column", padding: "24px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 12 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ll-primary)", background: "rgba(48,89,185,0.06)", border: "1px solid rgba(48,89,185,0.12)", padding: "4px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {card.title} {card.totalPages > 1 ? `${card.pageIdx + 1}/${card.totalPages}` : ""}
                              </span>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleShuffle(); }}
                                  className="sound-btn"
                                  style={{
                                    background: "var(--glass-fill-strong)",
                                    border: "1px solid var(--glass-border-btn)",
                                    cursor: "pointer",
                                    color: "var(--ll-primary)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    boxShadow: "var(--glass-shadow-btn)",
                                    transition: "all 0.2s ease"
                                  }}
                                  title="Перемешать порядок"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shuffle</span>
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleResetOrder(); }}
                                  disabled={!isShuffled}
                                  className="sound-btn"
                                  style={{
                                    background: "var(--glass-fill-strong)",
                                    border: "1px solid var(--glass-border-btn)",
                                    cursor: isShuffled ? "pointer" : "not-allowed",
                                    color: isShuffled ? "var(--ll-primary)" : "var(--ll-outline-variant)",
                                    opacity: isShuffled ? 1 : 0.5,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    boxShadow: "var(--glass-shadow-btn)",
                                    transition: "all 0.2s ease"
                                  }}
                                  title="Сбросить порядок"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
                                </button>
                              </div>
                            </div>

                            {/* Scrollable vertical stack panel for chips */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", margin: "8px 0" }}>
                              <div className="training-card-scroll" onClick={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
                                  {chips.map((chip: any) => {
                                    const isChipFlipped = !!flippedChips[chip.id];
                                    
                                    return (
                                      <div 
                                        key={chip.id}
                                        onClick={(e) => toggleChipFlip(e, chip.id)}
                                        className="chip-card-perspective"
                                        style={{ height: "68px", width: "100%" }}
                                      >
                                        <div className={`chip-card-inner ${isChipFlipped ? "flipped" : ""}`}>
                                          {/* Front side (RU) */}
                                          <div className="chip-card-front" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "8px 16px" }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>
                                              {chip.front_sense}
                                            </span>
                                          </div>
                                          
                                          {/* Back side (EN) */}
                                          <div className="chip-card-back" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "8px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%", minWidth: 0 }}>
                                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ll-primary)", wordBreak: "break-word" }} title={chip.back_term}>
                                                {chip.back_term}
                                              </span>
                                              <button 
                                                onClick={(e) => handleSpeak(e, chip.back_term)}
                                                className="sound-btn"
                                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ll-outline)", display: "flex", padding: 2, flexShrink: 0 }}
                                                title="Прослушать"
                                              >
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>volume_up</span>
                                              </button>
                                            </div>
                                            {chip.examples && chip.examples[0] && (
                                              <span style={{ fontSize: 10, color: "var(--ll-on-surface-variant)", fontStyle: "italic", marginTop: 2, display: "block", wordBreak: "break-word" }} title={chip.examples[0].en}>
                                                {chip.examples[0].en}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: "center", fontSize: 11, color: "var(--ll-outline)", fontWeight: 700, marginTop: 12, letterSpacing: "0.02em" }}>
                              Чипы открываются независимо и перетасовываются вместе с карточками
                            </div>
                          </div>
                        );
                      }
                    })()
                  ) : (
                    /* ───── COMPLETION / END CARD VIEW ───── */
                    (() => {
                      const ratedSlides = slides.filter(s => cardRatings[s.virtualId]);
                      const withScores = ratedSlides.filter(s => cardRatings[s.virtualId].value !== "skip");
                      
                      const valMap: Record<string, number> = {
                        dont_know: 0,
                        weak: 25,
                        medium: 50,
                        good: 75,
                        know: 100
                      };
                      
                      let averageScore = 0;
                      if (withScores.length > 0) {
                        const sum = withScores.reduce((acc, s) => acc + (valMap[cardRatings[s.virtualId].value] || 0), 0);
                        averageScore = Math.round(sum / withScores.length);
                      }
                      
                      const rememberedCount = ratedSlides.filter(s => {
                        const val = cardRatings[s.virtualId].value;
                        return val === "medium" || val === "good" || val === "know";
                      }).length;

                      return (
                        <div className="training-card-front" style={{ position: "relative", cursor: "default", height: "auto", padding: "32px", minHeight: "380px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                          <div className="end-card-layout" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyItems: "center", color: "#10b981", marginBottom: 16 }}>
                              <span className="material-symbols-outlined" style={{ margin: "auto", fontSize: 32 }}>check_circle</span>
                            </div>
                            
                            <p style={{ color: "var(--text)", fontSize: 15, fontWeight: 600, maxWidth: 360, lineHeight: 1.5, marginBottom: 16 }}>
                              Вы прошли все <strong style={{ color: "var(--ll-primary)" }}>{slides.length}</strong> карточек для слова <strong>{trainingWords[currentWordIdx].word}</strong>.
                            </p>

                            <div style={{ display: "flex", gap: "16px", justifyContent: "center", width: "100%", maxWidth: "360px", marginBottom: "24px" }}>
                              <div style={{ flex: 1, padding: "10px 14px", borderRadius: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Успешность</div>
                                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ll-primary)" }}>{averageScore}%</div>
                              </div>
                              <div style={{ flex: 1, padding: "10px 14px", borderRadius: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Вспомнили</div>
                                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ll-primary)" }}>{rememberedCount} / {slides.length}</div>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                              <button 
                                onClick={handleResetOrder}
                                className="glass-button"
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13, border: "1px solid rgba(255,255,255,0.3)", color: "var(--ll-primary)", background: "transparent", cursor: "pointer" }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
                                Начать заново
                              </button>
                              
                              {currentWordIdx < trainingWords.length - 1 ? (
                                <>
                                  <button 
                                    onClick={nextWord}
                                    className="btn-go success"
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13, background: "var(--ll-primary)", color: "#fff", border: "none", cursor: "pointer" }}
                                  >
                                    <span>След. слово</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                                  </button>

                                  <button 
                                    onClick={async () => {
                                      if (debounceTimeoutRef.current) {
                                        clearTimeout(debounceTimeoutRef.current);
                                      }
                                      await syncSessionScoresToDB();
                                      setActiveScreen("selection");
                                      loadData();
                                    }}
                                    className="glass-button"
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13, border: "1px solid rgba(255,255,255,0.3)", color: "var(--ll-on-surface-variant)", background: "transparent", cursor: "pointer" }}
                                  >
                                    <span>Завершить</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={async () => {
                                    if (debounceTimeoutRef.current) {
                                      clearTimeout(debounceTimeoutRef.current);
                                    }
                                    await syncSessionScoresToDB();
                                    setActiveScreen("selection");
                                    loadData();
                                  }}
                                  className="btn-go success"
                                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "999px", fontWeight: 700, fontSize: 13, background: "var(--ll-primary)", color: "#fff", border: "none", cursor: "pointer" }}
                                >
                                  <span>Завершить</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Always-visible narrow assessment bar */}
              {!isLoadingCards && slides.length > 0 && currentCardIdx < slides.length && (
                (() => {
                  const card = slides[currentCardIdx];
                  const rating = cardRatings[card?.virtualId];
                  const selectedValue = rating?.value || "";
                  
                  // Determine pillar for this card
                  let pillarName = "meanings";
                  if (card?.type === "container") {
                    const title = card.title || "";
                    if (title.includes("Семей") || title.toLowerCase().includes("family")) pillarName = "family";
                    else if (title.includes("Альтер") || title.toLowerCase().includes("alt")) pillarName = "alternatives";
                    else if (title.includes("Фраз") || title.toLowerCase().includes("phrase")) pillarName = "phrases";
                  }

                  const handleSelectRating = async (val: string) => {
                    // Update ratings state locally (guest users also do this in memory)
                    setCardRatings(prev => ({
                      ...prev,
                      [card.virtualId]: { value: val, pillar: pillarName }
                    }));

                    // Update session scores ref and state (for both guest and logged in)
                    sessionScoresRef.current = {
                      ...sessionScoresRef.current,
                      [card.virtualId]: val
                    };
                    setSessionScores(sessionScoresRef.current);

                    if (!currentUserId) return;

                    // 1. Persist/upsert rating to card_ratings
                    const canonical = trainingWords[currentWordIdx].word;
                    try {
                      await (supabase as any).from("card_ratings").upsert({
                        user_id: currentUserId,
                        canonical,
                        unit_id: card.virtualId,
                        pillar: pillarName,
                        value: val
                      }, { onConflict: "user_id,canonical,unit_id" });
                    } catch (e) {
                      console.error("Failed to save rating:", e);
                    }

                    // 2. Debounce writing the entire scores snapshot to the training_sessions table
                    if (debounceTimeoutRef.current) {
                      clearTimeout(debounceTimeoutRef.current);
                    }
                    debounceTimeoutRef.current = setTimeout(() => {
                      syncSessionScoresToDB();
                    }, 800);
                  };

                  if (!currentUserId) {
                    return (
                      <div 
                        className="rating-bar-container"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          maxWidth: "480px",
                          margin: "16px auto",
                          padding: "12px 24px",
                          borderRadius: "24px",
                          background: "var(--glass-fill)",
                          border: "1px solid var(--glass-border)",
                          boxShadow: "var(--glass-shadow)",
                          opacity: 0.8
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ll-outline)", fontSize: 13, fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
                          <span>Войдите в аккаунт, чтобы оценивать знание слов</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      className={`rating-bar-container ${barBlinkRed ? "blink-red" : ""}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        maxWidth: "480px",
                        margin: "16px auto",
                        padding: "12px",
                        borderRadius: "24px",
                        background: "var(--glass-fill)",
                        border: "1px solid var(--glass-border)",
                        boxShadow: "var(--glass-shadow)",
                        transition: "all 0.3s ease"
                      }}
                    >
                      <div 
                        style={{
                          display: "flex",
                          width: "100%",
                          height: "36px",
                          borderRadius: "18px",
                          overflow: "hidden",
                          background: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          boxSizing: "border-box"
                        }}
                      >
                        {[
                          { key: "dont_know", label: "не знаю" },
                          { key: "weak", label: "слабо" },
                          { key: "medium", label: "средне" },
                          { key: "good", label: "хорошо" },
                          { key: "know", label: "знаю" }
                        ].map((step) => {
                          const isSelected = selectedValue === step.key;
                          return (
                            <button
                              key={step.key}
                              onClick={() => handleSelectRating(step.key)}
                              style={{
                                flex: 1,
                                border: "none",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: 700,
                                color: isSelected ? "var(--ll-primary)" : "var(--ll-outline)",
                                background: isSelected ? "rgba(48, 89, 185, 0.15)" : "transparent",
                                borderRadius: isSelected ? "18px" : "0px",
                                transition: "all 0.2s ease",
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: isSelected ? "0 0 10px rgba(48, 89, 185, 0.3)" : "none"
                              }}
                              title={step.label}
                            >
                              {step.label}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => handleSelectRating("skip")}
                        style={{
                          background: selectedValue === "skip" ? "rgba(48, 89, 185, 0.15)" : "transparent",
                          border: selectedValue === "skip" ? "1px solid rgba(48, 89, 185, 0.25)" : "1px solid transparent",
                          boxShadow: selectedValue === "skip" ? "0 0 10px rgba(48, 89, 185, 0.3)" : "none",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: selectedValue === "skip" ? "var(--ll-primary)" : "var(--ll-outline)",
                          textDecoration: "none",
                          padding: "6px 16px",
                          borderRadius: "18px",
                          transition: "all 0.2s ease",
                          display: "inline-flex",
                          alignItems: "center",
                          height: "36px",
                          boxSizing: "border-box"
                        }}
                      >
                        не интересует
                      </button>
                    </div>
                  );
                })()
              )}

              {/* CARD DECK CONTROLLER (Dot indicators & arrows) */}
              {!isLoadingCards && slides.length > 0 && currentCardIdx < slides.length && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", alignItems: "center" }}>
                  
                  <div className="nav-dots" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {slides.map((s, idx) => (
                      <div 
                        key={s.virtualId}
                        onClick={() => {
                          if (currentUserId && idx > currentCardIdx) {
                            for (let checkIdx = currentCardIdx; checkIdx < idx; checkIdx++) {
                              const checkSlide = slides[checkIdx];
                              if (!cardRatings[checkSlide.virtualId]) {
                                setBarBlinkRed(true);
                                setTimeout(() => setBarBlinkRed(false), 500);
                                return;
                              }
                            }
                          }
                          setCurrentCardIdx(idx);
                          setFlippedCards({});
                          setFlippedChips({});
                        }}
                        className={`nav-dot ${idx === currentCardIdx ? "active" : ""}`}
                        style={{ width: "8px", height: "8px", borderRadius: "50%", background: idx === currentCardIdx ? "var(--ll-primary)" : "var(--ll-outline-variant)", transition: "all 0.25s ease", cursor: "pointer", transform: idx === currentCardIdx ? "scale(1.3)" : "scale(1)", boxShadow: idx === currentCardIdx ? "0 0 8px rgba(48,89,185,0.4)" : "none" }}
                        title={s.type === "meaning" ? s.front_sense : `${s.title} ${s.totalPages > 1 ? `${s.pageIdx + 1}/${s.totalPages}` : ""}`}
                      />
                    ))}
                    {/* Dot for Completion card */}
                    <div 
                      onClick={() => {
                        if (currentUserId && currentCardIdx < slides.length) {
                          for (let checkIdx = currentCardIdx; checkIdx < slides.length; checkIdx++) {
                            const checkSlide = slides[checkIdx];
                            if (!cardRatings[checkSlide.virtualId]) {
                              setBarBlinkRed(true);
                              setTimeout(() => setBarBlinkRed(false), 500);
                              return;
                            }
                          }
                        }
                        setCurrentCardIdx(slides.length);
                        setFlippedCards({});
                        setFlippedChips({});
                      }}
                      className={`nav-dot ${currentCardIdx === slides.length ? "active" : ""}`}
                      style={{ width: "8px", height: "8px", borderRadius: "50%", background: currentCardIdx === slides.length ? "var(--ll-primary)" : "var(--ll-outline-variant)", transition: "all 0.25s ease", cursor: "pointer", transform: currentCardIdx === slides.length ? "scale(1.3)" : "scale(1)", boxShadow: currentCardIdx === slides.length ? "0 0 8px rgba(48,89,185,0.4)" : "none" }}
                      title="Завершение"
                    />
                  </div>

                  <div className="deck-navigation-arrows" style={{ display: "flex", gap: "20px" }}>
                    <button 
                      onClick={prevCard}
                      disabled={currentCardIdx === 0}
                      className="nav-arrow-btn"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "50%", background: "var(--glass-fill-strong)", border: "1px solid var(--glass-border-btn)", color: "var(--ll-primary)", cursor: currentCardIdx === 0 ? "not-allowed" : "pointer", transition: "all 0.25s ease", boxShadow: "var(--glass-shadow-btn)", opacity: currentCardIdx === 0 ? 0.3 : 1 }}
                      title="Предыдущая карточка"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    
                    <button 
                      onClick={nextCard}
                      disabled={currentCardIdx === slides.length}
                      className="nav-arrow-btn"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "50%", background: "var(--glass-fill-strong)", border: "1px solid var(--glass-border-btn)", color: "var(--ll-primary)", cursor: currentCardIdx === slides.length ? "not-allowed" : "pointer", transition: "all 0.25s ease", boxShadow: "var(--glass-shadow-btn)", opacity: currentCardIdx === slides.length ? 0.3 : 1 }}
                      title="Следующая карточка"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>

                  <button 
                    onClick={async () => {
                      if (debounceTimeoutRef.current) {
                        clearTimeout(debounceTimeoutRef.current);
                      }
                      await syncSessionScoresToDB();
                      setActiveScreen("selection");
                      loadData();
                    }}
                    className="glass-button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 24px",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "1px solid var(--glass-border-btn)",
                      background: "var(--glass-fill-strong)",
                      color: "var(--ll-on-surface-variant)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      marginTop: "4px",
                      boxShadow: "var(--glass-shadow-btn)",
                      width: "100%",
                      maxWidth: "200px"
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                    Завершить
                  </button>

                </div>
              )}


              {/* Save Session Modal */}
              {isSaveModalOpen && (
                <div 
                  className="tr-overlay-backdrop"
                  onClick={() => setIsSaveModalOpen(false)}
                  style={{
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(16, 22, 35, 0.45)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    zIndex: 2000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px"
                  }}
                >
                  <div 
                    className="glass-card scale-fade-in"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      borderRadius: "24px",
                      padding: "24px",
                      background: "rgba(255, 255, 255, 0.75)",
                      border: "1px solid rgba(255, 255, 255, 0.6)",
                      boxShadow: "0 24px 48px rgba(0, 0, 0, 0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>
                        Сохранить в историю
                      </h3>
                      <button 
                        onClick={() => setIsSaveModalOpen(false)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--ll-outline)",
                          cursor: "pointer",
                          display: "flex",
                          padding: 4
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }} className="no-scrollbar">
                      {/* Without folder option */}
                      <button
                        onClick={() => {
                          handleSaveSession(null);
                          setIsSaveModalOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          width: "100%",
                          padding: "12px 16px",
                          borderRadius: "14px",
                          background: "rgba(255, 255, 255, 0.4)",
                          border: "1px solid rgba(255, 255, 255, 0.6)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(48, 89, 185, 0.08)";
                          e.currentTarget.style.borderColor = "var(--ll-primary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.6)";
                        }}
                      >
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "rgba(48, 89, 185, 0.1)",
                          color: "var(--ll-primary)"
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>public</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>Без папки</div>
                          <div style={{ fontSize: "11px", color: "var(--ll-outline)", marginTop: 2 }}>Сохранить в общую историю</div>
                        </div>
                      </button>

                      {/* Folder list */}
                      {trainingFolders.length > 0 && (
                        <>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ll-outline)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "10px", marginBottom: "4px" }}>
                            Папки тренировок
                          </div>
                          {trainingFolders.map((folder) => (
                            <button
                              key={folder.id}
                              onClick={() => {
                                handleSaveSession(folder.id);
                                setIsSaveModalOpen(false);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                width: "100%",
                                padding: "12px 16px",
                                borderRadius: "14px",
                                background: "rgba(255, 255, 255, 0.4)",
                                border: "1px solid rgba(255, 255, 255, 0.6)",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(48, 89, 185, 0.08)";
                                e.currentTarget.style.borderColor = "var(--ll-primary)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)";
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.6)";
                              }}
                            >
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                background: "rgba(48, 89, 185, 0.05)",
                                color: "var(--ll-primary)"
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>folder</span>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{folder.name}</div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

             </div>
          )}

          {/* ──────────────── SCREEN: SESSION DETAIL SCREEN ──────────────── */}
          {activeScreen === "session_detail" && activeHistorySession && (
            <div className="fade-up scale-fade-in" style={{ width: "100%", paddingBottom: "120px" }}>
              
              {/* Header row mirroring My Words page headers */}
              <div className="lib-page-header-row" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "24px" }}>
                <button
                  onClick={() => {
                    // Pre-select current session words
                    const preSelectedIds = new Set<string>();
                    activeHistorySession.words.forEach(wName => {
                      const found = words.find(w => w.word.toLowerCase() === wName.toLowerCase());
                      if (found) preSelectedIds.add(found.id);
                    });
                    setSelectedWords(preSelectedIds);
                    setIsAddingToSessionMode(activeHistorySession.id);
                    setIsOverlayOpen(true);
                    setActiveScreen("selection");
                  }}
                  className="glass-button success"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "1px solid rgba(48, 89, 185, 0.3)",
                    background: "rgba(48, 89, 185, 0.05)",
                    color: "var(--ll-primary)",
                    cursor: "pointer"
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  Добавить слова
                </button>
              </div>

              {/* Collapsed word card list */}
              <div className="library">
                <div className="lib-words">
                  {activeHistorySession.words.length === 0 ? (
                    <div className="empty-state" style={{ padding: "60px 20px" }}>
                      <div className="empty-icon">📖</div>
                      <div className="empty-title">В сессии нет слов</div>
                      <div className="empty-sub">Используйте кнопку выше, чтобы добавить слова.</div>
                    </div>
                  ) : (
                    activeHistorySession.words.map((wordName) => {
                      const found = words.find(w => w.word.toLowerCase() === wordName.toLowerCase());
                      const wRow = found || {
                        id: "temp-" + wordName,
                        word: wordName,
                        folder_id: "__all__",
                        created_at: new Date().toISOString(),
                        breakdown: { mode: "word" }
                      };
                      return (
                        <WordSelectionCard
                          key={wRow.id}
                          word={wRow}
                          folder={folders.find(f => f.id === wRow.folder_id)}
                          isSelected={false}
                          isExpanded={expandedWordCards.has(wRow.id)}
                          onToggleSelect={() => {}}
                          onToggleExpand={toggleCardExpansion}
                          onSpeak={handleSpeak}
                          onRemove={(wName) => handleRemoveWordFromSession(activeHistorySession.id, wName)}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* Floating Bottom Sticky Matte Glass Bar */}
              <div className="glass-card" style={{ 
                position: "fixed", 
                bottom: "28px", 
                left: "50%", 
                transform: "translateX(-50%)", 
                width: "calc(100% - 64px)", 
                maxWidth: "480px", 
                padding: "10px 24px", 
                borderRadius: "999px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                zIndex: 1000,
                boxShadow: "0 16px 40px rgba(48, 89, 185, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.7)",
                background: "rgba(255, 255, 255, 0.55)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)"
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  Всего: <span style={{ color: "var(--ll-primary)", fontSize: 15 }}>{activeHistorySession.words.length}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button 
                    onClick={() => {
                      setActiveScreen("selection");
                      setActiveHistorySession(null);
                    }}
                    className="glass-button"
                    style={{ 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%", 
                      border: "1px solid rgba(255,255,255,0.3)",
                      background: "rgba(255, 255, 255, 0.45)",
                      color: "var(--text)",
                      padding: 0
                    }}
                    title="Назад"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
                  </button>
                  <button 
                    disabled={activeHistorySession.words.length === 0}
                    onClick={() => {
                      const sWords = activeHistorySession.words;
                      setActiveHistorySession(null);
                      handleRerunSession(sWords);
                    }}
                    className="btn-go success"
                    style={{ 
                      padding: "6px 20px", 
                      borderRadius: "999px", 
                      fontWeight: 700, 
                      fontSize: 12, 
                      height: "34px",
                      background: activeHistorySession.words.length === 0 ? "rgba(255,255,255,0.15)" : "var(--ll-primary)", 
                      color: activeHistorySession.words.length === 0 ? "rgba(255,255,255,0.4)" : "#fff", 
                      border: "none", 
                      cursor: activeHistorySession.words.length === 0 ? "not-allowed" : "pointer",
                      boxShadow: activeHistorySession.words.length === 0 ? "none" : "0 4px 12px rgba(48, 89, 185, 0.2)"
                    }}
                  >
                    Тренировать
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
