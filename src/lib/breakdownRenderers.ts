// breakdownRenderers.ts
// Pure DOM formatting helpers and HTML string renderers extracted from index.tsx

export function escapeHtml(s: unknown): string {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

export function parseMarkdown(text: string): string {
  if (!text) return "";

  // Split on double newlines into paragraphs; single newlines treated as <br> within a para
  const rawParas = text.split(/\n{2,}/);

  const processedParas = rawParas.map((para) => {
    // Detect blockquote / example block (lines starting with "> ")
    const lines = para.split("\n");
    const isExampleBlock = lines.every((l) => l.trimStart().startsWith(">"));
    if (isExampleBlock) {
      const innerLines = lines.map((l) => l.trimStart().replace(/^>\s?/, ""));
      const innerHtml = innerLines
        .map((l) => {
          let h = escapeHtml(l);
          h = h.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          h = h.replace(/__(.*?)__/g, "<strong>$1</strong>");
          h = h.replace(/\*(.*?)\*/g, "<em>$1</em>");
          h = h.replace(/_(.*?)_/g, "<em>$1</em>");
          h = h.replace(/`(.*?)`/g, '<span class="en-chip">$1</span>');
          return `<p>${h}</p>`;
        })
        .join("");
      return `<div class="md-example-block">${innerHtml}</div>`;
    }

    // Normal paragraph
    let html = escapeHtml(para);
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/_(.*?)_/g, "<em>$1</em>");
    // Backtick text → inline glass pill chip
    html = html.replace(/`(.*?)`/g, '<span class="en-chip">$1</span>');
    // Single newlines within a paragraph → <br>
    html = html.replace(/\n/g, "<br>");
    // Verdict block: a line starting with ВЕРДИКТ[:]
    html = html.replace(
      /(<br>|^)ВЕРДИКТ[:\s]*([\s\S]*?)(?=<br>|$)/gi,
      (_m: string, pre: string, content: string) => {
        const clean = content.replace(/^[\s:]+/, "").trim();
        return `${pre}<span class="verdict-block"><span class="verdict-badge">ВЕРДИКТ</span><span class="verdict-text">${clean}</span></span>`;
      }
    );
    return `<p>${html}</p>`;
  });

  return processedParas.join("");
}

export function star(n: number): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += i < n ? "★" : '<span class="empty">★</span>';
  return s;
}

export function renderSoundButton(text?: string): string {
  if (!text) return "";
  return `<button class="sound-btn" data-text="${escapeHtml(text)}" title="Listen" aria-label="Listen"><span class="material-symbols-outlined" style="font-size:18px;line-height:1;">volume_up</span></button>`;
}

export function getCardWidgetState(word: string, widgetTitle: string, defaultState: boolean): boolean {
  if (!word) return defaultState;
  try {
    const key = `card_state:${word.toLowerCase().trim()}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && widgetTitle in parsed) {
        return !!parsed[widgetTitle];
      }
    }
  } catch (e) {
    console.error("Error reading card widget state:", e);
  }
  return defaultState;
}

export function saveCardWidgetState(word: string, widgetTitle: string, isOpen: boolean) {
  if (!word) return;
  try {
    const key = `card_state:${word.toLowerCase().trim()}`;
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[widgetTitle] = isOpen;
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch (e) {
    console.error("Error saving card widget state:", e);
  }
}

export function tryExtract(buffer: string): { full: boolean; obj: any } {
  try {
    const obj = JSON.parse(buffer);
    return { full: true, obj };
  } catch {
    const out: any = {};
    const wordMatch = buffer.match(/"word"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (wordMatch) {
      try {
        out.word = JSON.parse('"' + wordMatch[1] + '"');
      } catch {}
    }
    const levelMatch = buffer.match(/"level"\s*:\s*"([^"]+)"/);
    if (levelMatch) out.level = levelMatch[1];
    const freqMatch = buffer.match(/"frequency"\s*:\s*"([^"]+)"/);
    if (freqMatch) out.frequency = freqMatch[1];
    const errMatch = buffer.match(/"error"\s*:\s*"([^"]+)"/);
    if (errMatch) out.error = errMatch[1];
    return { full: false, obj: out };
  }
}

export function renderStage1(obj: any): string {
  let html = "";
  if (obj.word) html += `<div class="word-chip-wrap fade-up"><span class="word-chip glass-card">${escapeHtml(obj.word)}</span>${renderSoundButton(obj.word)}</div>`;
  if (obj.level || obj.frequency) {
    html += `<div class="badges fade-up" style="animation-delay:.05s">`;
    if (obj.level) html += `<span class="badge cefr">${escapeHtml(obj.level)}</span>`;
    if (obj.frequency) html += `<span class="badge freq">${escapeHtml(obj.frequency)}</span>`;
    html += `</div>`;
  }
  return html;
}

export function parsePillarMarkdown(text: string): string {
  if (!text) return "";

  // Split into paragraphs by double newlines
  const rawParas = text.split(/\n{2,}/);

  const processedParas = rawParas.map((para, paraIndex, arr) => {
    let trimmed = para.trim();
    if (!trimmed) return "";

    // 1. Contextual warning/precaution box: starts with ** and containing "не путай" in the bold part
    const warningRegex = /^\*\*(не\s+пута[й|т]е?.*?)\*\*(.*)$/i;
    const warningMatch = trimmed.match(warningRegex);
    if (warningMatch) {
      const boldText = warningMatch[1];
      const restText = warningMatch[2];
      return `
        <div class="warning-box">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <strong>${parseInlineMarkdown(boldText)}</strong>${parseInlineMarkdown(restText)}
          </div>
        </div>
      `;
    }

    // 2. Frequency Verdict: LAST paragraph, if entirely wrapped in **...**
    if (paraIndex === arr.length - 1 && trimmed.startsWith("**") && trimmed.endsWith("**")) {
      const boldContent = trimmed.slice(2, -2);
      return `
        <div class="verdict-box">
          <span class="verdict-icon">💡</span>
          <span class="verdict-text">${parseInlineMarkdown(boldContent)}</span>
        </div>
      `;
    }

    // 3. Muted Frequency Label: paragraph entirely wrapped in *...* (but not **)
    if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
      const italicContent = trimmed.slice(1, -1);
      return `
        <p class="muted-italic"><em>${parseInlineMarkdown(italicContent)}</em></p>
      `;
    }

    // 4. Regular paragraph
    const parsedHtml = parseInlineMarkdown(trimmed);
    const withBrs = parsedHtml.replace(/\n/g, "<br>");
    return `<p class="pillar-para">${withBrs}</p>`;
  });

  return processedParas.filter(p => p !== "").join("");
}

export function parseInlineMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Parse inline tags in backticks -> .en-chip
  html = html.replace(/`(.*?)`/g, '<span class="en-chip">$1</span>');

  // Parse English examples + Russian translation
  // Match *English example* followed by translation text until the next asterisk
  html = html.replace(/\*([A-Za-z0-9\s'’,\.\!\?\-\"\;\:\(\)]+)\*([^\*]*)/g, (_match, en, tr) => {
    return `<em class="en-example">${en}</em><span class="en-example-translation">${tr}</span>`;
  });

  // General fallback bold and italics (if they weren't captured by block-level rules)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  return html;
}

export function tryRepairJson(str: string): any {
  const trimmed = str.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}

  let stack: string[] = [];
  let inString = false;
  let isEscape = false;
  let repaired = "";

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    repaired += char;

    if (inString) {
      if (isEscape) {
        isEscape = false;
      } else if (char === "\\") {
        isEscape = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        stack.push("}");
      } else if (char === "[") {
        stack.push("]");
      } else if (char === "}" || char === "]") {
        stack.pop();
      }
    }
  }

  if (inString) {
    if (isEscape) repaired = repaired.slice(0, -1);
    repaired += '"';
  }

  for (let i = stack.length - 1; i >= 0; i--) {
    repaired = repaired.trim();
    if (repaired.endsWith(",")) {
      repaired = repaired.slice(0, -1);
    }
    if (repaired.endsWith(":")) {
      repaired += "null";
    }
    repaired += stack[i];
  }

  try {
    return JSON.parse(repaired);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return null;
  }
}

export function widgetHtml(
  icon: string,
  title: string,
  content: string,
  isOpen: boolean,
  delay: number,
  isLoading?: boolean
): string {
  const spinner = isLoading ? '<span class="mt-spin" style="margin-left:8px; width:14px; height:14px; display:inline-block;" aria-hidden="true"></span>' : '';
  return `
    <div class="widget glass-card ${isOpen ? "open" : ""}" style="animation-delay:${delay}ms">
      <div class="widget-head" data-toggle>
        <span class="widget-icon">${icon}</span>
        <span class="widget-title" style="display:flex;align-items:center;">${title}${spinner}</span>
        <span class="widget-chevron"><span class="material-symbols-outlined">expand_more</span></span>
      </div>
      <div class="widget-body">
        <div class="widget-content"><div class="widget-content-inner">${content}</div></div>
      </div>
    </div>`;
}

export function getCachedType(word: string, wordsList: any[], historyList: any[]): "Light" | "Разбор" | null {
  if (!word) return null;
  const normalized = word.toLowerCase();
  
  // Check library (wordsList)
  const saved = wordsList.find(w => w.word.toLowerCase() === normalized && w.breakdown);
  if (saved) {
    if (saved.breakdown.blocks) return "Разбор";
    if (saved.breakdown._light || saved.breakdown.wave1) return "Light";
  }
  
  // Check history (historyList)
  const hist = historyList.find(h => h.word.toLowerCase() === normalized && h.breakdown);
  if (hist) {
    if (hist.breakdown.blocks) return "Разбор";
    if (hist.breakdown._light || hist.breakdown.wave1) return "Light";
  }
  
  return null;
}

export function renderRecommendationCard(item: any, wordsList: any[], historyList: any[]): string {
  const canonical = item.canonical || "";
  const hint = item.hint || "";
  // All recommendation cards now automatically lead to Full Breakdown ("Разбор")
  const cachedType = "Разбор";
  const badgeHtml = `<span class="badge freq" style="font-size: 11px; padding: 2px 8px; border-radius: 999px;">${escapeHtml(cachedType)}</span>`;
    
  return `
    <div class="recommendation-card fade-up" data-canonical="${escapeHtml(canonical)}">
      <div class="rc-head" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
        <div class="rc-word" style="font-size: 16px; font-weight: 700; color: var(--text); font-family: inherit;">${escapeHtml(canonical)}</div>
        ${badgeHtml}
      </div>
      ${hint ? `<div class="rc-hint" style="font-size: 14px; color: var(--text-dim); line-height: 1.4; margin-top: 4px;">${escapeHtml(hint)}</div>` : ""}
    </div>
  `;
}

export function renderExamples(examples: any[]): string {
  if (!Array.isArray(examples) || !examples.length) return "";
  return (
    `<div class="ex-list">` +
    examples
      .map(
        (e: any) =>
          `<div class="ex-item"><div class="ex-en"><em>${escapeHtml(e?.en || "")}</em> ${renderSoundButton(e?.en)}</div><div class="ex-ru">${escapeHtml(e?.ru || "")}</div></div>`,
      )
      .join("") +
    `</div>`
  );
}

export function renderTip(active: boolean | undefined, tip: string | undefined): string {
  const isActive = active !== false;
  const mark = isActive ? "✅" : "⚠️";
  const label = isActive ? "Активно используй" : "Знай пассивно";
  const extra = tip ? ` — ${escapeHtml(tip)}` : "";
  return `<div class="usage-tip ${isActive ? "active" : "passive"}">${mark} ${label}${extra}</div>`;
}

export function renderContextsBlock(contexts: any[]): string {
  return contexts
    .map(
      (c: any) => `
        <div class="ctx-block">
          <div class="ctx-head">
            <span class="ctx-freq">${escapeHtml(c?.frequency || "")}</span>
            <span class="ctx-title">${escapeHtml(c?.title || "")}</span>
          </div>
          ${renderExamples(c?.examples || [])}
          ${renderTip(c?.active, c?.tip)}
        </div>
      `,
    )
    .join("");
}

export function renderCollocationsBlock(items: any[]): string {
  return items
    .map(
      (g: any) => `
        <div class="ctx-block">
          <div class="ctx-head">
            <span class="ctx-freq">${escapeHtml(g?.frequency || "")}</span>
            <span class="ctx-title">${escapeHtml(g?.category || "")}</span>
          </div>
          <div class="coll-items">
            ${(g?.items || [])
              .map(
                (it: any) =>
                  `<div class="coll-row"><span class="coll-phrase">${escapeHtml(it?.phrase || "")} ${renderSoundButton(it?.phrase)}</span><span class="coll-tr">${escapeHtml(it?.translation || "")}</span></div>`,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

export function getWordFromBreakdown(b: any): string {
  if (!b) return "";
  if (b.mode === "digest" && b.title) return b.title;
  if (b.word) return b.word;
  if (b.canonical) return b.canonical;
  if (b._light && b._light.canonical) return b._light.canonical;
  if (b._light && b._light.word) return b._light.word;
  if (b.breakdown && b.breakdown.word) return b.breakdown.word;
  if (b.breakdown && b.breakdown.canonical) return b.breakdown.canonical;
  return "";
}

export function getDigestPreview(content: string): string {
  if (!content) return "";
  let clean = content
    .replace(/[\*\`\_]/g, "") // remove formatting
    .replace(/\n+/g, " ")     // newlines to space
    .replace(/\s+/g, " ")     // collapse spaces
    .trim();
  
  if (clean.length <= 120) return clean;
  let sub = clean.slice(0, 120);
  const lastSpace = sub.lastIndexOf(" ");
  if (lastSpace > 0) {
    sub = sub.slice(0, lastSpace);
  }
  return sub + "…";
}

export function getTranslationFromBreakdown(b: any): string {
  if (!b) return "";
  const light = b._light || null;
  const full = b.breakdown || null;

  const mode = b.mode || (light && light.mode) || (full && full.mode);
  if (mode === "digest") {
    const pillars = b.pillars || (light && light.pillars) || (full && full.pillars);
    if (Array.isArray(pillars)) {
      const summaryPillar = pillars.find((p: any) => p.key === "summary");
      if (summaryPillar && summaryPillar.content) {
        return getDigestPreview(summaryPillar.content);
      }
    }
  }
  
  function cleanTranslation(str: string): string {
    if (!str) return "";
    let res = str.trim();
    if (res.includes(" — ")) {
      const parts = res.split(" — ");
      if (parts[1]) res = parts[1];
    } else if (res.includes(" - ")) {
      const parts = res.split(" - ");
      if (parts[1]) res = parts[1];
    }
    res = res.replace(/[\*\`\_]/g, "").trim();
    return res;
  }

  // Check new pillars structure first
  const pillars = b.pillars || (light && light.pillars) || (full && full.pillars);
  if (Array.isArray(pillars)) {
    const transPillar = pillars.find((p: any) => p.key === "translation");
    if (transPillar && transPillar.content) {
      const firstLine = transPillar.content.split("\n")[0] || "";
      return cleanTranslation(firstLine);
    }
  }

  let translation = "";
  if (b.translation) {
    translation = typeof b.translation === "object" ? b.translation.main : b.translation;
  }
  if (!translation && light && light.translation) {
    translation = typeof light.translation === "object" ? light.translation.main : light.translation;
  }
  if (!translation && full && full.translation) {
    translation = typeof full.translation === "object" ? full.translation.main : full.translation;
  }
  if (!translation && light && light.wave1 && light.wave1.content) {
    const firstLine = light.wave1.content.split("\n")[0] || "";
    translation = cleanTranslation(firstLine);
  }
  if (!translation && full && Array.isArray(full.contexts) && full.contexts.length) {
    const firstCtx = full.contexts[0] || {};
    const firstEx = (firstCtx.examples && firstCtx.examples[0]) || {};
    translation = firstCtx.title || firstEx.ru || "";
  }
  if (!translation && Array.isArray(b.contexts) && b.contexts.length) {
    const firstCtx = b.contexts[0] || {};
    const firstEx = (firstCtx.examples && firstCtx.examples[0]) || {};
    translation = firstCtx.title || firstEx.ru || "";
  }
  if (!translation && b.summary) {
    translation = b.summary;
  }
  if (!translation && full && full.summary) {
    translation = full.summary;
  }
  return String(translation || "").trim();
}

export function getPosFromBreakdown(b: any): string {
  if (!b) return "";
  const light = b._light || null;
  const full = b.breakdown || null;
  if (b.pos) return b.pos;
  if (light && light.pos) return light.pos;
  if (full && full.pos) return full.pos;
  return "";
}

export function wrapHtmlInWordCard(innerHtml: string, b: any, word: string, isLoading: boolean = false, lang: string = "ru"): string {
  const translation = getTranslationFromBreakdown(b);
  
  return `
    <div class="word-card glass-card open fade-up ${isLoading ? "wc-loading" : ""}" style="cursor: default; width: 100%;">
      ${isLoading ? "" : `
      <div class="wc-head">
        <div class="wc-word-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 56px;">
          <div class="wc-word">${escapeHtml(word)}</div>
          <button class="sound-btn" data-text="${escapeHtml(word)}" title="${escapeHtml(lang === "en" ? "Listen" : "Прослушать")}" style="background: transparent; border: none; cursor: pointer; color: var(--ll-outline); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: all 0.2s ease;">
            <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
          </button>
        </div>
        ${translation ? `<div class="wc-translation">${escapeHtml(translation)}</div>` : ""}
      </div>
      `}
      <div class="wc-detail" style="${isLoading ? "margin-top: 0;" : ""}">
        <div class="wc-detail-inner" style="${isLoading ? "border-top: none; margin-top: 0; padding-top: 0;" : ""}">
          ${innerHtml}
        </div>
      </div>
    </div>
  `;
}

export function renderPillBreakdown(data: any, isLoading: boolean = false): string {
  if (isLoading || !data || !Array.isArray(data.pillars)) {
    // Render horizontal tabs skeleton
    const tabSkeletons = [80, 100, 90, 85].map((w, idx) => `
      <div class="pillar-tab skeleton-pill" style="width: ${w}px; height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.4); animation: pulse 1.5s infinite; animation-delay: ${idx * 0.15}s; border: 1px solid rgba(255,255,255,0.5);"></div>
    `).join("");

    // Render content window skeleton
    const contentSkeleton = `
      <div class="pillar-content-window" style="animation: pulse 1.5s infinite; min-height: 180px;">
        <div class="skeleton-line long" style="height: 14px; margin-bottom: 12px; width: 90%;"></div>
        <div class="skeleton-line long" style="height: 14px; margin-bottom: 12px; width: 85%;"></div>
        <div class="skeleton-line short" style="height: 14px; margin-bottom: 12px; width: 60%;"></div>
      </div>
    `;

    return `
      <div class="pillars-tabs-row no-scrollbar">
        ${tabSkeletons}
      </div>
      ${contentSkeleton}
    `;
  }

  return ""; // Dynamic update done in updatePillBreakdownDOM
}

export function renderSentence(obj: any, isStreaming: boolean = false, wordsList: any[] = [], historyList: any[] = []): string {
  if (!obj) return "";
  
  const originalText = obj.sentence || obj.word || "";
  
  let mainTranslationHtml = "";
  let variantsHtml = "";
  
  if (obj.translation && typeof obj.translation === "object") {
    if (obj.translation.main) {
      mainTranslationHtml = `<div class="sent-main-translation" style="font-size: 16px; font-weight: 500; color: var(--text); font-family: inherit; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;">${escapeHtml(obj.translation.main)}</div>`;
    } else if (isStreaming) {
      mainTranslationHtml = `<div class="skeleton-line title" style="width: 60%; height: 22px; margin-bottom: 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;"></div>`;
    }
    
    if (Array.isArray(obj.translation.variants) && obj.translation.variants.length) {
      const listItems = obj.translation.variants.map((v: string) => `<li style="font-size: 15px; color: var(--text-dim); line-height: 1.4;">${escapeHtml(v)}</li>`).join("");
      variantsHtml = `
        <div class="sent-variants" style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
          <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px;">
            ${listItems}
          </ul>
        </div>
      `;
    }
  } else if (isStreaming) {
    mainTranslationHtml = `<div class="skeleton-line title" style="width: 60%; height: 22px; margin-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 12px;"></div><div class="skeleton-line long" style="height: 14px; width: 80%;"></div>`;
  }
  
  const innerPillHtml = `<div class="breakdown-wrap" data-word-json="${escapeHtml(JSON.stringify(obj))}">${renderPillBreakdown(obj, isStreaming)}</div>`;
  
  return `
    <div class="sentence-breakdown-container fade-up" style="width: 100%;">
      <div class="word-card glass-card open fade-up" style="cursor: default; width: 100%;">
        <div class="wc-head">
          <div class="wc-word-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 56px;">
            <div class="wc-word" style="font-size: 20px; font-weight: 700; line-height: 1.3;">${escapeHtml(originalText)}</div>
            <button class="sound-btn" data-text="${escapeHtml(originalText)}" title="Прослушать" style="background: transparent; border: none; cursor: pointer; color: var(--ll-outline); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: all 0.2s ease;">
              <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
            </button>
          </div>
          ${mainTranslationHtml}
          ${variantsHtml}
        </div>
        <div class="wc-detail" style="margin-top: 16px;">
          <div class="wc-detail-inner" style="padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);">
            ${innerPillHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderRuMap(obj: any): string {
  const options = Array.isArray(obj.options) ? obj.options : [];
  const items = options
    .map(
      (o: any) =>
        `<div class="rumap-item"><button class="chip rumap-en" data-word="${escapeHtml(o?.en || "")}">${escapeHtml(o?.en || "")}</button>${o?.note ? ` <span class="rumap-note">— ${escapeHtml(o.note)}</span>` : ""}</div>`,
    )
    .join("");
  const start = obj.start || {};
  return `
    <div class="sentence-card fade-up">
      <div class="sent-original">🔎 <em>${escapeHtml(obj.query || "")}</em></div>
      <div class="sent-row" style="color:var(--text-muted);">Это можно выразить несколькими способами:</div>
      <div class="rumap-list">${items}</div>
      ${start.en ? `<div class="sent-row sent-advice"><span class="sent-label">💡 С чего начать:</span> <button class="chip rumap-en" data-word="${escapeHtml(start.en)}">${escapeHtml(start.en)}</button>${start.why ? ` — ${escapeHtml(start.why)}` : ""}</div>` : ""}
    </div>
  `;
}

export function renderContext(obj: any): string {
  const u = obj.usage || {};
  let chips = "";
  if (Array.isArray(obj.suggest)) {
    chips = obj.suggest
      .map((w: any) => `<button class="chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`)
      .join("");
  }
  return `
    <div class="context fade-up">
      <div class="original">${escapeHtml(obj.original || "")}</div>
      <div class="arrow">↓</div>
      <div class="translation">${escapeHtml(obj.translation || "")}</div>
      <div class="usage">
        <span style="color:var(--text-muted);">Так говорят:</span>
        ${u.level ? `<span class="badge freq">${escapeHtml(u.level)}</span>` : ""}
        ${u.comment ? `<span class="comment">— ${escapeHtml(u.comment)}</span>` : ""}
      </div>
      ${
        chips
          ? `
        <div class="suggest-title">Стоит разобрать отдельно →</div>
        <div class="chips">${chips}</div>
      `
          : ""
      }
    </div>
  `;
}
