import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { speakText } from "@/lib/speakText";
import "../lev-nikol.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lev & Nikol — разбор английских слов" },
      {
        name: "description",
        content:
          "Lev & Nikol — мгновенный разбор английских слов и фраз: значения, коллокации, грамматика, синонимы.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    document.body.classList.add("ln-body");
    const handleSoundClick = (e: MouseEvent) => {
      const btn = (e.target as Element).closest(".sound-btn");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const text = btn.getAttribute("data-text");
        if (text) {
          speakText(text);
        }
      }
    };
    document.body.addEventListener("click", handleSoundClick);

    return () => {
      document.body.removeEventListener("click", handleSoundClick);
      document.body.classList.remove("ln-body", "lib-page");
    };
  }, []);

  useEffect(() => {
    // Direct port of the original IIFE.
    const form = document.getElementById("searchForm") as HTMLFormElement | null;
    const input = document.getElementById("input") as HTMLInputElement | null;
    const goBtn = document.getElementById("goBtn") as HTMLButtonElement | null;
    const loading = document.getElementById("loading") as HTMLElement | null;
    const results = document.getElementById("results") as HTMLElement | null;
    const searchWrap = document.getElementById("searchWrap") as HTMLElement | null;
    if (!form || !input || !goBtn || !loading || !results || !searchWrap) return;

    const SYSTEM_PROMPT = `Ты — преподаватель английского языка для русскоязычных учеников.

На любое слово, выражение или фразу выдаёшь структурированный разбор СТРОГО в виде JSON-объекта по схеме ниже. Никаких вступлений, мета-комментариев, markdown-обёрток (\`\`\`). Только чистый JSON-объект.

СХЕМА:
{
  "word": "string — само слово/фраза (с исправлением опечаток)",
  "level": "A1 | A2 | B1 | B2 | C1 | C2",
  "frequency": "очень частое | частое | среднее | редкое",
  "contexts": [
    {
      "title": "название контекста употребления",
      "frequency": "🔥 | 📊 | ❄️",
      "examples": [ { "en": "english sentence", "ru": "русский перевод" } ],
      "active": true,
      "tip": "если active=false — на что заменить; иначе короткий совет или пустая строка"
    }
  ],
  "collocations": [
    {
      "category": "название категории (или контекст, к которому привязана) или 'общие'",
      "frequency": "🔥 | 📊 | ❄️",
      "items": [ { "phrase": "word combo", "translation": "перевод" } ]
    }
  ],
  "grammar": [
    {
      "construction": "название конструкции (например: think about / think of)",
      "frequency": "🔥 | 📊 | ❄️",
      "note": "короткое пояснение что меняет",
      "examples": [ { "en": "english", "ru": "русский" } ],
      "active": true,
      "tip": "если passive — на что заменить; иначе пусто"
    }
  ],
  "synonyms": [
    {
      "word": "synonym",
      "frequency": "🔥 | 📊 | ❄️",
      "nuance": "чем отличается и где используется",
      "examples": [ { "en": "english", "ru": "русский" } ],
      "active": true,
      "tip": "если passive — на что заменить; иначе пусто"
    }
  ],
  "phrases": [
    {
      "phrase": "фраза или идиома",
      "translation": "перевод",
      "note": "короткое пояснение когда используется",
      "frequency": "🔥 | 📊"
    }
  ],
  "summary": "Итог: 3–5 предложений. Что активно использовать, что пассивно и на что заменить, насколько слово важное и где встречается (разговор / тексты / бизнес)."
}

ПРАВИЛА:
1. Только чистый JSON. Никаких \`\`\`json, никаких комментариев вне JSON.
2. Контексты идут от самого частого к редкому.
3. Для frequency="🔥" в контекстах/грамматике/синонимах давай ~5 примеров; для "📊" или "❄️" — 3 примера.
4. Все примеры естественные, разговорные, не учебные. Перевод смысловой.
5. Если синонимы не несут реальной ценности — верни пустой массив "synonyms": [].
6. Блок "phrases" присутствует всегда. Если уникальных идиом нет — верни один элемент: { "phrase": "—", "translation": "Отдельных устойчивых выражений нет — всё уже покрыто в контекстах и коллокациях", "note": "", "frequency": "📊" }
7. Если коллокации привязаны к контекстам — используй category = название контекста. Если общие — category = "общие".
8. В коллокациях не повторяй главный глагол внутри одной категории — пиши только сочетающееся слово (например для pick up: "/ trash", "/ keys").
9. Если ввод с опечаткой — исправь в "word" и разбирай правильную форму.
10. Если ввод не на английском — верни { "error": "Введи слово или фразу на английском." }
11. Если слово простое (A1–A2) — сокращай содержание, схему сохраняй.
12. Если блок не несёт ценности — оставь массив пустым (кроме phrases).
13. Никакой воды. Разбор должен читаться за один взгляд.

РЕЖИМ ПРЕДЛОЖЕНИЯ:
Если ввод — это полное предложение (а не отдельное слово, идиома, коллокация или короткая устойчивая фраза), НЕ выдавай ошибку и НЕ используй основную схему. Верни строго такой JSON:
{
  "mode": "sentence",
  "sentence": "оригинальное предложение",
  "translation": "смысловой перевод на русский (не дословный)",
  "comment": "1–3 предложения о стиле, регистре, грамматических особенностях",
  "highlights": [
    { "item": "слово или фраза", "why": "почему полезно, в какой связке работает" }
  ],
  "advice": "одно предложение — как использовать этот материал для изучения"
}
Правила режима предложения:
- Только чистый JSON, никаких других полей.
- Короткая устойчивая фраза/коллокация/идиома (например "pick up", "as soon as possible") — НЕ предложение, разбирай по основной схеме.

Правила блока "highlights" (Что стоит разобрать):
- Максимум 4 пункта.
- Порядок строго такой:
  1. Сначала ВСЕ фразовые глаголы (verb + particle: dip down, figure out, come across, get away with, look up to и т.д.). Они ОБЯЗАТЕЛЬНЫ, даже если кажутся простыми — русскоязычные ученики их почти всегда упускают.
  2. Потом идиомы и устойчивые выражения (break the ice, on the fly, out of the blue).
  3. Потом нетипичные грамматические конструкции (инверсия, условные, редкие времена, необычный порядок слов).
  4. В конце — отдельные слова, если есть что-то полезное по лексике.
- Ничего нетипичного для учебного английского не пропускать: разговорные сокращения, нестандартные коллокации, регистр — отмечать.
- Если фразовых глаголов в предложении нет — начинай со следующих по приоритету категорий.`;

    const LIGHT_SYSTEM_PROMPT = `Ты — преподаватель английского языка для русскоязычных учеников.

На любое слово или фразу выдаёшь КОРОТКИЙ практичный разбор СТРОГО в виде чистого JSON-объекта (без markdown, без \`\`\`, без вступлений).

СХЕМА (подмножество полной схемы):
{
  "word": "string — слово/фраза с исправлением опечаток",
  "level": "A1 | A2 | B1 | B2 | C1 | C2",
  "frequency": "очень частое | частое | среднее | редкое",
  "contexts": [
    {
      "title": "название самого частого контекста",
      "frequency": "🔥",
      "examples": [ { "en": "english", "ru": "русский" }, { "en": "english", "ru": "русский" } ],
      "active": true,
      "tip": ""
    }
  ],
  "synonyms": [
    {
      "word": "самый частый синоним",
      "frequency": "🔥",
      "nuance": "одна фраза — чем отличается",
      "examples": [ { "en": "english", "ru": "русский" }, { "en": "english", "ru": "русский" } ],
      "active": true,
      "tip": ""
    }
  ],
  "summary": "Итог: 2–3 предложения — что активно использовать и главная ловушка"
}

ПРАВИЛА:
1. Только чистый JSON, никаких других полей, никаких \`\`\`.
2. ТОЛЬКО самые частые контексты — frequency должна быть "🔥". Средние/редкие пропускай.
3. На каждый контекст ровно 2 примера.
4. Контекст всегда 1, максимум 2 (только если оба реально 🔥).
5. Синонимов 0 или 1 (только если реально полезный 🔥). Если нет — верни "synonyms": [].
6. Примеры естественные, разговорные. Перевод смысловой.
7. Если пользователь указал контекст — учитывай его при выборе примеров.
8. Если ввод не на английском или бессмыслен — верни { "error": "Введи слово или фразу на английском." }`;

    const RU_SYSTEM_PROMPT = `Пользователь ввёл русское слово, фразу или описание смысла. Выдай мини-карту английских вариантов СТРОГО в виде чистого JSON-объекта (без markdown, без \`\`\`, без вступлений).

СХЕМА:
{
  "mode": "ru-map",
  "query": "русская фраза пользователя как есть",
  "options": [
    { "en": "английский вариант", "note": "контекст, тон, нюанс — коротко" }
  ],
  "start": { "en": "самый полезный вариант из options", "why": "одно предложение почему именно с него стоит начать" }
}

ПРАВИЛА:
1. Только чистый JSON.
2. options: 4–6 вариантов, отсортированы от самого частого/нейтрального к более редкому/специфичному.
3. note короткий: где, в каком регистре, разговорное/формальное/сленг и т.п.
4. start.en должен совпадать с одним из options[].en.
5. Никаких других полей, никакой воды.`;

    function star(n: number) {
      let s = "";
      for (let i = 0; i < 3; i++) s += i < n ? "★" : '<span class="empty">★</span>';
      return s;
    }
    function escapeHtml(s: unknown) {
      return String(s || "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
      );
    }

    function renderSoundButton(text?: string) {
      if (!text) return "";
      return `<button class="sound-btn" data-text="${escapeHtml(text)}" title="Listen" aria-label="Listen"><span class="material-symbols-outlined" style="font-size:18px;line-height:1;">volume_up</span></button>`;
    }

    function getCardWidgetState(word: string, widgetTitle: string, defaultState: boolean): boolean {
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

    function saveCardWidgetState(word: string, widgetTitle: string, isOpen: boolean) {
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

    function tryExtract(buffer: string): { full: boolean; obj: any } {
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

    function renderStage1(obj: any) {
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

    function parseMarkdown(text: string): string {
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

    function parsePillarMarkdown(text: string): string {
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

    function parseInlineMarkdown(text: string): string {
      let html = escapeHtml(text);

      // Parse inline tags in backticks -> .en-chip
      html = html.replace(/`(.*?)`/g, '<span class="en-chip">$1</span>');

      // Parse English examples + Russian translation
      // Match *English example* followed by translation text until the next asterisk
      html = html.replace(/\*([A-Za-z0-9\s'’,\.\!\?\-\"\;\:\(\)]+)\*([^\*]*)/g, (match, en, tr) => {
        return `<em class="en-example">${en}</em><span class="en-example-translation">${tr}</span>`;
      });

      // General fallback bold and italics (if they weren't captured by block-level rules)
      html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

      return html;
    }


    function tryRepairJson(str: string): any {
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

    function widgetHtml(icon: string, title: string, content: string, isOpen: boolean, delay: number, isLoading?: boolean) {
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

    function getCachedType(word: string): "Light" | "Разбор" | null {
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

    function renderRecommendationCard(item: any): string {
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


    function renderExamples(examples: any[]): string {
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

    function renderTip(active: boolean | undefined, tip: string | undefined): string {
      const isActive = active !== false;
      const mark = isActive ? "✅" : "⚠️";
      const label = isActive ? "Активно используй" : "Знай пассивно";
      const extra = tip ? ` — ${escapeHtml(tip)}` : "";
      return `<div class="usage-tip ${isActive ? "active" : "passive"}">${mark} ${label}${extra}</div>`;
    }

    function renderContextsBlock(contexts: any[]): string {
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

    function renderCollocationsBlock(items: any[]): string {
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

    function renderGrammarBlock(items: any[]): string {
      return items
        .map(
          (g: any) => `
            <div class="ctx-block">
              <div class="ctx-head">
                <span class="ctx-freq">${escapeHtml(g?.frequency || "")}</span>
                <span class="ctx-title">${escapeHtml(g?.construction || "")}</span>
              </div>
              ${g?.note ? `<div class="ctx-note">${escapeHtml(g.note)}</div>` : ""}
              ${renderExamples(g?.examples || [])}
              ${renderTip(g?.active, g?.tip)}
            </div>
          `,
        )
        .join("");
    }

    function renderSynonymsBlock(items: any[]): string {
      return items
        .map(
          (s: any) => `
            <div class="ctx-block">
              <div class="ctx-head">
                <span class="ctx-freq">${escapeHtml(s?.frequency || "")}</span>
                <span class="ctx-title">${escapeHtml(s?.word || "")} ${renderSoundButton(s?.word)}</span>
              </div>
              ${s?.nuance ? `<div class="ctx-note">${escapeHtml(s.nuance)}</div>` : ""}
              ${renderExamples(s?.examples || [])}
              ${renderTip(s?.active, s?.tip)}
            </div>
          `,
        )
        .join("");
    }

    function renderPhrasesBlock(items: any[]): string {
      return (
        `<div class="ex-list">` +
        items
          .map(
            (p: any) => `
              <div class="ex-item">
                <div class="ex-en"><span class="ctx-freq">${escapeHtml(p?.frequency || "")}</span> ${escapeHtml(p?.phrase || "")} ${renderSoundButton(p?.phrase)}</div>
                <div class="ex-ru">${escapeHtml(p?.translation || "")}${p?.note ? ` <span class="ph-note">(${escapeHtml(p.note)})</span>` : ""}</div>
              </div>
            `,
          )
          .join("") +
        `</div>`
      );
    }

    function getBlockIcon(title: string): string {
      const t = title.toLowerCase();
      if (t.includes("что это") || t.includes("описание")) return "💡";
      if (t.includes("второе") || t.includes("второй")) return "🔄";
      if (t.includes("предлог") || t.includes("оттенки")) return "🎨";
      if (t.includes("после")) return "👉";
      if (t.includes("живой") || t.includes("речи") || t.includes("примеры")) return "💬";
      if (t.includes("грамматика")) return "📐";
      if (t.includes("фразы") || t.includes("обороты")) return "📦";
      if (t.includes("путают")) return "🔍";
      if (t.includes("грабли")) return "⚠️";
      if (t.includes("картины") || t.includes("большая")) return "🖼️";
      return "🔹";
    }

    function renderFullSkeletonOpen(idx: number = 0) {
      return `
        <div data-skeleton="${idx}" class="skeleton-widget wave-skeleton glass-card" style="animation: none; opacity: 1;">
          <div class="full-skel-open">
            <div class="skel-head">
              <div class="skel-icon"></div>
              <div class="skeleton-line" style="width: 38%;"></div>
            </div>
            <div class="skel-content">
              <div class="skeleton-line long" style="width: 92%;"></div>
              <div class="skeleton-line short" style="width: 70%;"></div>
              <div class="skeleton-line long" style="width: 85%;"></div>
              <div class="skeleton-line short" style="width: 55%;"></div>
            </div>
          </div>
        </div>`;
    }

    function renderFullSkeletonClosed(idx: number = 0) {
      const widths = [33, 45, 27, 40, 52, 36];
      const w = widths[idx % widths.length];
      return `
        <div data-skeleton="${idx}" class="skeleton-widget wave-skeleton glass-card" style="animation: none; opacity: 1;">
          <div class="full-skel-closed">
            <div class="skel-head">
              <div class="skel-icon"></div>
              <div class="skeleton-line" style="width: ${w}%;"></div>
            </div>
          </div>
        </div>`;
    }

    function renderStage2(obj: any, variant: "full" | "light" = "full", isStreaming: boolean = false) {
      const TOTAL_SKELETONS = 7;

      if (obj && Array.isArray(obj.blocks)) {
        // New block-based Full Breakdown format
        const blocks = obj.blocks;

        if (isStreaming) {
          // Determine how many blocks are "complete":
          // block[i] is complete if block[i+1] exists (next block started) or stream is finished
          // Since isStreaming=true here, we only consider blocks complete when next exists
          const completedCount = blocks.length > 0 ? blocks.length - 1 : 0;
          
          const slots: string[] = [];

          // Render completed real blocks
          for (let i = 0; i < completedCount; i++) {
            const block = blocks[i];
            const icon = getBlockIcon(block.title);
            const title = block.title || "";
            const content = parseMarkdown(block.content || "");
            const word = obj?.word || obj?.canonical || "";
            const isOpen = getCardWidgetState(word, title, false);
            slots.push(`<div class="skel-fade-in">${widgetHtml(icon, title, content, isOpen, 0, false)}</div>`);
          }

          // The last block in array is still streaming — show next skeleton for it
          // Remaining skeletons count
          const remaining = Math.max(0, TOTAL_SKELETONS - completedCount);

          for (let j = 0; j < remaining; j++) {
            // The first skeleton slot: open if no real blocks yet, else closed
            if (j === 0 && completedCount === 0) {
              slots.push(renderFullSkeletonOpen());
            } else {
              slots.push(renderFullSkeletonClosed(completedCount + j));
            }
          }


          return `<div class="widgets">${slots.join("")}</div>`;
        }

        // Not streaming — render all blocks
        const widgets: string[] = [];
        blocks.forEach((block: any, i: number) => {
          const icon = getBlockIcon(block.title);
          const title = block.title || "";
          const content = parseMarkdown(block.content || "");
          const word = obj?.word || obj?.canonical || "";
          const isOpen = getCardWidgetState(word, title, false);
          widgets.push(widgetHtml(icon, title, content, isOpen, i * 100, false));
        });

        let html = `<div class="widgets">${widgets.join("")}</div>`;

        // Actionable recommendation chips at the bottom
        if (Array.isArray(obj.recommendations) && obj.recommendations.length) {
          const recsHtml = obj.recommendations.map((item: any) => renderRecommendationCard(item)).join("");

          html += `
            <div class="recommendations-section fade-up" style="margin-top: 24px;">
              <div class="rec-title" style="font-weight: 600; margin-bottom: 12px; color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em;">Что разобрать дальше:</div>
              <div class="rec-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${recsHtml}
              </div>
            </div>
          `;
        }

        return html;
      }

      // No blocks yet (streaming initial state or non-block format)
      if (isStreaming) {
        // Show 7 skeletons: 1 open + 6 closed
        const skels: string[] = [];
        skels.push(renderFullSkeletonOpen());
        for (let i = 1; i < TOTAL_SKELETONS; i++) {
          skels.push(renderFullSkeletonClosed(i));
        }
        return `<div class="widgets">${skels.join("")}</div>`;
      }

      // Legacy fallback: widgets-based rendering
      const isLight = variant === "light";
      const openDefault = isLight;
      const openSynonyms = false;
      const widgets: { icon: string; title: string; content: string; open: boolean }[] = [];
      if (Array.isArray(obj.contexts) && obj.contexts.length) {
        widgets.push({
          icon: "🎯",
          title: "Контексты употребления",
          content: renderContextsBlock(obj.contexts),
          open: openDefault,
        });
      }
      if (Array.isArray(obj.collocations) && obj.collocations.length) {
        widgets.push({
          icon: "🔗",
          title: "Коллокации",
          content: renderCollocationsBlock(obj.collocations),
          open: openDefault,
        });
      }
      if (Array.isArray(obj.grammar) && obj.grammar.length) {
        widgets.push({
          icon: "📐",
          title: "Грамматика",
          content: renderGrammarBlock(obj.grammar),
          open: openDefault,
        });
      }
      if (Array.isArray(obj.synonyms) && obj.synonyms.length) {
        widgets.push({
          icon: "🔄",
          title: "Синонимы / альтернативы",
          content: renderSynonymsBlock(obj.synonyms),
          open: openSynonyms,
        });
      }
      if (Array.isArray(obj.phrases) && obj.phrases.length) {
        widgets.push({
          icon: "💬",
          title: "Живые фразы и идиомы",
          content: renderPhrasesBlock(obj.phrases),
          open: openDefault,
        });
      }
      if (obj.summary) {
        widgets.push({
          icon: "💡",
          title: "Итог",
          content: `<div class="summary-text">${escapeHtml(obj.summary)}</div>`,
          open: openDefault,
        });
      }
      let html = `<div class="widgets">`;
      widgets.forEach((w, i) => {
        html += widgetHtml(w.icon, w.title, w.content, w.open, i * 100);
      });
      html += `</div>`;
      return html;
    }

    function renderSentence(obj: any, isStreaming: boolean = false) {
      const isNew = obj && (
        (obj.translation && typeof obj.translation === "object") ||
        (obj.wave !== undefined) ||
        (obj.recommendations !== undefined) ||
        (isStreaming && !obj.highlights && !obj.comment)
      );

      if (isNew) {
        const originalText = obj.sentence || obj.word || (document.getElementById("wordInput") as HTMLInputElement | null)?.value || "";
        
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
        
        let waveHtml = "";
        if (obj.wave) {
          const waveTitle = obj.wave.title || "Что в этом предложении";
          const waveContent = parseMarkdown(obj.wave.content || "");
          const isOpen = getCardWidgetState(originalText, waveTitle, true);
          waveHtml = widgetHtml("💡", waveTitle, waveContent, isOpen, 100, isStreaming && !obj.wave.content);
        } else if (isStreaming) {
          waveHtml = `
            <div class="widget open skeleton-widget wave-skeleton" style="animation-delay: 100ms; min-height: 180px; margin-top: 16px;">
              <div class="widget-head" style="cursor: default;">
                <div class="skeleton-line title" style="margin-bottom: 0; width: 45%;"></div>
              </div>
              <div class="widget-body" style="grid-template-rows: 1fr;">
                <div class="widget-content">
                  <div class="widget-content-inner" style="padding-top: 14px;">
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line short"></div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
        
        let recsHtml = "";
        if (Array.isArray(obj.recommendations) && obj.recommendations.length) {
          const cardsHtml = obj.recommendations.map((item: any) => renderRecommendationCard(item)).join("");
          recsHtml = `
            <div class="wave3-section fade-up" style="margin-top: 28px;">
              <div class="rec-title" style="font-weight: 600; margin-bottom: 12px; color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em;">Что разобрать дальше:</div>
              <div class="rec-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${cardsHtml}
              </div>
            </div>
          `;
        } else if (isStreaming) {
          recsHtml = `
            <div class="skeleton-widget wave-skeleton wave3-skeleton" style="animation-delay: 200ms; margin-top: 28px; padding: 16px; min-height: 100px;">
              <div class="skeleton-line title" style="width: 40%; height: 18px; margin-bottom: 16px;"></div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div class="skeleton-line short" style="height: 32px; border-radius: 999px;"></div>
              </div>
            </div>
          `;
        }
        
        return `
          <div class="sentence-breakdown-container fade-up">
            <div class="translation-card fade-up glass-card" style="margin-bottom: 24px; padding: 20px; border-radius: 16px; border: 1px solid var(--border); background: var(--bg-elev); backdrop-filter: blur(20px);">
              <div class="sent-original" style="font-size: 20px; margin-bottom: 12px;"><em>${escapeHtml(originalText)}</em></div>
              ${mainTranslationHtml}
              ${variantsHtml}
            </div>
            
            <div class="widgets">
              ${waveHtml}
            </div>
            
            ${recsHtml}
          </div>
        `;
      }

      const highlights = Array.isArray(obj.highlights) ? obj.highlights : [];
      const items = highlights
        .map(
          (h: any) =>
            `<div class="sent-hl-item"><span class="sent-hl-arrow">→</span> <span class="sent-hl-item-name">${escapeHtml(h?.item || "")}</span>${h?.why ? ` — <span class="sent-hl-why">${escapeHtml(h.why)}</span>` : ""}</div>`,
        )
        .join("");
      return `
        <div class="sentence-card fade-up">
          <div class="sent-original"><em>${escapeHtml(obj.sentence || "")}</em></div>
          ${obj.translation ? `<div class="sent-row"><span class="sent-label">Перевод:</span> ${escapeHtml(obj.translation)}</div>` : ""}
          ${obj.comment ? `<div class="sent-row"><span class="sent-label">Комментарий:</span> ${escapeHtml(obj.comment)}</div>` : ""}
          ${items ? `<div class="sent-section"><div class="sent-label">Что стоит разобрать:</div>${items}</div>` : ""}
          ${obj.advice ? `<div class="sent-row sent-advice"><span class="sent-label">Совет:</span> ${escapeHtml(obj.advice)}</div>` : ""}
        </div>
      `;
    }

    function renderRuMap(obj: any) {
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

    function renderContext(obj: any) {
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

    function getWordFromBreakdown(b: any): string {
      if (!b) return "";
      if (b.word) return b.word;
      if (b.canonical) return b.canonical;
      if (b._light && b._light.canonical) return b._light.canonical;
      if (b._light && b._light.word) return b._light.word;
      if (b.breakdown && b.breakdown.word) return b.breakdown.word;
      if (b.breakdown && b.breakdown.canonical) return b.breakdown.canonical;
      return "";
    }

    function getTranslationFromBreakdown(b: any): string {
      if (!b) return "";
      const light = b._light || null;
      const full = b.breakdown || null;
      
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

    function getPosFromBreakdown(b: any): string {
      if (!b) return "";
      const light = b._light || null;
      const full = b.breakdown || null;
      if (b.pos) return b.pos;
      if (light && light.pos) return light.pos;
      if (full && full.pos) return full.pos;
      return "";
    }

    function wrapHtmlInWordCard(innerHtml: string, b: any, word: string, isLoading: boolean = false): string {
      const translation = getTranslationFromBreakdown(b);
      const pos = getPosFromBreakdown(b);
      const currentLang = store.lang || "ru";
      
      return `
        <div class="word-card glass-card open fade-up ${isLoading ? "wc-loading" : ""}" style="cursor: default; width: 100%;">
          ${isLoading ? "" : `
          <div class="wc-head">
            <div class="wc-word-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 56px;">
              <div class="wc-word">${escapeHtml(word)}</div>
              <button class="sound-btn" data-text="${escapeHtml(word)}" title="${escapeHtml(currentLang === "en" ? "Listen" : "Прослушать")}" style="background: transparent; border: none; cursor: pointer; color: var(--ll-outline); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: all 0.2s ease;">
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

    let activeTab = "translation";

    function renderPillBreakdown(data: any, isLoading: boolean = false): string {
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

      // Check input note
      let inputNoteHtml = "";
      if (data.input_note) {
        inputNoteHtml = `
          <div class="input-note-alert fade-up" style="margin-bottom: 16px;">
            💡 <em>${escapeHtml(data.input_note)}</em>
          </div>
        `;
      }

      // Key to Icon mapping
      const mapKeyToIcon = (key: string): string => {
        switch (key) {
          case "translation": return "📝";
          case "meanings": return "💡";
          case "family": return "🔸";
          case "alternatives": return "⇄";
          case "phrases": return "📦";
          case "grammar": return "📐";
          case "pitfalls": return "⚠️";
          default: return "🔹";
        }
      };

      // Ensure activeTab is present in pillars, else fall back to first one
      const hasActive = data.pillars.some((p: any) => p.key === activeTab);
      if (!hasActive && data.pillars.length > 0) {
        activeTab = data.pillars[0].key;
      }

      // Render actual tabs with sequential cascade delays
      const tabsHtml = data.pillars.map((p: any, idx: number) => {
        const icon = mapKeyToIcon(p.key);
        const isActive = p.key === activeTab;
        const delay = idx * 100; // 100ms cascade delay
        return `
          <button class="pillar-tab ${isActive ? "active" : ""}" data-key="${escapeHtml(p.key)}" style="animation-delay: ${delay}ms;">
            <span class="pillar-icon">${icon}</span>
            <span class="pillar-label">${escapeHtml(p.label)}</span>
          </button>
        `;
      }).join("");

      // Render content of active tab
      const activePillar = data.pillars.find((p: any) => p.key === activeTab) || data.pillars[0];
      const parsedContent = parsePillarMarkdown(activePillar?.content || "");

      const contentHtml = `
        <div class="pillar-content-window">
          ${parsedContent}
        </div>
      `;

      return `
        ${inputNoteHtml}
        <div class="pillars-tabs-row no-scrollbar">
          ${tabsHtml}
        </div>
        ${contentHtml}
      `;
    }

    function updatePillBreakdownDOM(wrap: HTMLElement, data: any, isStreaming: boolean) {
      if (!wrap) return;

      // 1. If we have a valid word_card parent and are no longer loading, transition to loaded state
      const card = wrap.closest(".word-card") as HTMLElement | null;
      if (card && data && Array.isArray(data.pillars) && data.pillars.length > 0) {
        if (card.classList.contains("wc-loading")) {
          card.classList.remove("wc-loading");
          
          // Prepend wc-head if it doesn't exist
          let head = card.querySelector(".wc-head") as HTMLElement | null;
          if (!head) {
            head = document.createElement("div");
            head.className = "wc-head";
            card.insertBefore(head, card.firstChild);
          }
          
          const word = getWordFromBreakdown(data) || (document.getElementById("input") as HTMLInputElement | null)?.value || "";
          const translation = getTranslationFromBreakdown(data);
          const currentLang = store.lang || "ru";
          
          head.innerHTML = `
            <div class="wc-word-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 56px;">
              <div class="wc-word">${escapeHtml(word)}</div>
              <button class="sound-btn" data-text="${escapeHtml(word)}" title="${escapeHtml(currentLang === "en" ? "Listen" : "Прослушать")}" style="background: transparent; border: none; cursor: pointer; color: var(--ll-outline); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: all 0.2s ease;">
                <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
              </button>
            </div>
            ${translation ? `<div class="wc-translation">${escapeHtml(translation)}</div>` : ""}
          `;
          
          // Bind sound button listener
          const soundBtn = head.querySelector(".sound-btn");
          if (soundBtn) {
            soundBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              const txt = soundBtn.getAttribute("data-text");
              if (txt && typeof window !== "undefined" && "speechSynthesis" in window) {
                const utter = new SpeechSynthesisUtterance(txt);
                utter.lang = "en-US";
                window.speechSynthesis.speak(utter);
              }
            });
          }
        } else {
          // If head already exists, update translation dynamically as it streams in!
          const head = card.querySelector(".wc-head") as HTMLElement | null;
          if (head) {
            const translation = getTranslationFromBreakdown(data);
            let transDiv = head.querySelector(".wc-translation") as HTMLElement | null;
            if (translation) {
              if (!transDiv) {
                transDiv = document.createElement("div");
                transDiv.className = "wc-translation";
                head.appendChild(transDiv);
              }
              transDiv.textContent = translation;
            }
          }
        }
        
        // Remove style constraints on wc-detail/wc-detail-inner
        const detail = card.querySelector(".wc-detail") as HTMLElement | null;
        if (detail) detail.removeAttribute("style");
        const inner = card.querySelector(".wc-detail-inner") as HTMLElement | null;
        if (inner) inner.removeAttribute("style");
      }

      // 2. Render input_note if present and not already displayed
      if (data && data.input_note) {
        let noteDiv = wrap.querySelector(".input-note-alert") as HTMLElement | null;
        if (!noteDiv) {
          noteDiv = document.createElement("div");
          noteDiv.className = "input-note-alert fade-up";
          noteDiv.style.marginBottom = "16px";
          wrap.insertBefore(noteDiv, wrap.firstChild);
        }
        noteDiv.innerHTML = `💡 <em>${escapeHtml(data.input_note)}</em>`;
      }

      // 3. Keep data-word-json updated
      wrap.setAttribute("data-word-json", JSON.stringify(data));

      // 4. Update the pillars-tabs-row!
      let tabsRow = wrap.querySelector(".pillars-tabs-row") as HTMLElement | null;
      if (!tabsRow) {
        tabsRow = document.createElement("div");
        tabsRow.className = "pillars-tabs-row no-scrollbar";
        // Insert after input-note-alert, or at the start
        const noteDiv = wrap.querySelector(".input-note-alert");
        if (noteDiv && noteDiv.nextSibling) {
          wrap.insertBefore(tabsRow, noteDiv.nextSibling);
        } else if (noteDiv) {
          wrap.appendChild(tabsRow);
        } else {
          wrap.insertBefore(tabsRow, wrap.firstChild);
        }
      }

      const mapKeyToIcon = (key: string): string => {
        switch (key) {
          case "translation": return "📝";
          case "meanings": return "💡";
          case "family": return "🔸";
          case "alternatives": return "⇄";
          case "phrases": return "📦";
          case "grammar": return "📐";
          case "pitfalls": return "⚠️";
          default: return "🔹";
        }
      };

      const newPillars = (data && Array.isArray(data.pillars)) ? data.pillars : [];
      
      // Select the active tab if not set
      if (newPillars.length > 0 && !newPillars.some((p: any) => p.key === activeTab)) {
        activeTab = newPillars[0].key || "translation";
      }

      // We reconcile the existing children in tabsRow to avoid resetting scroll position!
      const existingButtons = Array.from(tabsRow.querySelectorAll(".pillar-tab:not(.skeleton-pill)")) as HTMLButtonElement[];
      
      // Remove any existing buttons that are no longer in the new data
      existingButtons.forEach(btn => {
        const key = btn.getAttribute("data-key");
        if (!newPillars.some((p: any) => p.key === key)) {
          btn.remove();
        }
      });

      // Update or insert buttons in order
      newPillars.forEach((p: any, idx: number) => {
        if (!p.key || !p.label) return; // Skip incomplete pillars
        
        let btn = tabsRow!.querySelector(`.pillar-tab[data-key="${p.key}"]`) as HTMLButtonElement | null;
        const icon = mapKeyToIcon(p.key);
        const isActive = p.key === activeTab;

        if (!btn) {
          // Create new button
          btn = document.createElement("button");
          btn.className = `pillar-tab ${isActive ? "active" : ""}`;
          btn.setAttribute("data-key", p.key);
          btn.style.animationDelay = `${idx * 100}ms`;
          btn.innerHTML = `
            <span class="pillar-icon">${icon}</span>
            <span class="pillar-label">${escapeHtml(p.label)}</span>
          `;
          // Insert it before the first skeleton button, or at the end
          const firstSkeleton = tabsRow!.querySelector(".skeleton-pill");
          if (firstSkeleton) {
            tabsRow!.insertBefore(btn, firstSkeleton);
          } else {
            tabsRow!.appendChild(btn);
          }
        } else {
          // Update existing button state
          if (isActive && !btn.classList.contains("active")) {
            btn.classList.add("active");
          } else if (!isActive && btn.classList.contains("active")) {
            btn.classList.remove("active");
          }
          const labelSpan = btn.querySelector(".pillar-label");
          if (labelSpan && labelSpan.textContent !== p.label) {
            labelSpan.textContent = p.label;
          }
        }
      });

      // Manage skeletons during streaming
      let skeletonPills = Array.from(tabsRow.querySelectorAll(".skeleton-pill")) as HTMLElement[];
      if (isStreaming) {
        // Ensure we always have e.g. 3 skeletons visible at the end
        const neededSkeletons = 3;
        if (skeletonPills.length < neededSkeletons) {
          const diff = neededSkeletons - skeletonPills.length;
          for (let i = 0; i < diff; i++) {
            const sk = document.createElement("div");
            sk.className = "pillar-tab skeleton-pill";
            sk.style.width = `${80 + Math.random() * 20}px`;
            sk.style.height = "38px";
            sk.style.borderRadius = "9999px";
            sk.style.background = "rgba(255,255,255,0.4)";
            sk.style.border = "1px solid rgba(255,255,255,0.5)";
            sk.style.animation = "pulse 1.5s infinite";
            sk.style.animationDelay = `${(newPillars.length + i) * 0.15}s`;
            tabsRow.appendChild(sk);
          }
        }
      } else {
        // Remove all skeletons once streaming is done!
        skeletonPills.forEach(sk => sk.remove());
      }

      // Re-bind listeners for any newly created buttons
      attachTabListeners(wrap, data);

      // 5. Update the content window!
      let contentWin = wrap.querySelector(".pillar-content-window") as HTMLElement | null;
      if (!contentWin) {
        contentWin = document.createElement("div");
        contentWin.className = "pillar-content-window";
        wrap.appendChild(contentWin);
      }

      const activePillar = newPillars.find((p: any) => p.key === activeTab);
      if (activePillar) {
        const parsedContent = parsePillarMarkdown(activePillar.content || "");
        if (contentWin.innerHTML !== parsedContent) {
          contentWin.innerHTML = parsedContent;
          attachChips(contentWin);
        }
        
        // Remove any style constraints (like pulsing skeleton height)
        contentWin.removeAttribute("style");
      } else {
        // If no active pillar is parsed yet, render the content skeleton window
        if (!contentWin.querySelector(".skeleton-line")) {
          contentWin.style.animation = "pulse 1.5s infinite";
          contentWin.style.minHeight = "180px";
          contentWin.innerHTML = `
            <div class="skeleton-line long" style="height: 14px; margin-bottom: 12px; width: 90%;"></div>
            <div class="skeleton-line long" style="height: 14px; margin-bottom: 12px; width: 85%;"></div>
            <div class="skeleton-line short" style="height: 14px; margin-bottom: 12px; width: 60%;"></div>
          `;
        }
      }
    }

    function attachTabListeners(container: HTMLElement, data: any) {
      if (!container) return;
      container.querySelectorAll(".pillar-tab").forEach(tab => {
        const el = tab as HTMLButtonElement & { __boundTab?: boolean };
        if (el.__boundTab) return;
        el.__boundTab = true;

        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const key = el.getAttribute("data-key");
          if (key) {
            activeTab = key;
            const wrap = el.closest(".breakdown-wrap") as HTMLElement | null || container.querySelector(".breakdown-wrap") as HTMLElement | null || (container.classList.contains("breakdown-wrap") ? container : null);
            if (wrap) {
              const rawJson = wrap.getAttribute("data-word-json") || JSON.stringify(data);
              if (rawJson) {
                try {
                  const obj = JSON.parse(rawJson);
                  const parsedData = obj.pillars ? obj : (obj._light && obj._light.pillars ? obj._light : obj);
                  updatePillBreakdownDOM(wrap, parsedData, false);
                } catch (err) {
                  console.error("Failed to parse word JSON in tab click:", err);
                }
              }
            }
          }
        });
      });
    }

    function renderUnifiedBreakdown(obj: any, wrapInCard: boolean = false): string {
      if (!obj) return "";
      if (obj.mode === "context") {
        return renderContext(obj);
      }
      if (obj.mode === "sentence") {
        return renderSentence(obj);
      }
      if (obj.mode === "ru-map") {
        return renderRuMap(obj);
      }
      
      const data = obj.pillars ? obj : (obj._light && obj._light.pillars ? obj._light : obj);
      let innerHtml = "";
      
      if (Array.isArray(data.pillars)) {
        innerHtml = `<div class="breakdown-wrap" data-word-json="${escapeHtml(JSON.stringify(obj))}">${renderPillBreakdown(data, false)}</div>`;
      } else {
        // Fallback for old cached data structures (just wave1 and wave2)
        innerHtml = `<div class="breakdown-wrap">${renderStage1(obj) + renderStage2(obj)}</div>`;
      }

      if (wrapInCard && obj.mode !== "sentence" && obj.mode !== "context" && obj.mode !== "ru-map") {
        const word = getWordFromBreakdown(obj) || (document.getElementById("input") as HTMLInputElement | null)?.value || "";
        return wrapHtmlInWordCard(innerHtml, obj, word);
      }
      
      return innerHtml;
    }

    function renderLightSkeleton(): string {
      return `
        <div class="widgets">
          <div data-skeleton="wave1" class="widget open skeleton-widget wave-skeleton" style="animation-delay: 0ms; min-height: 180px;">
            <div class="widget-head" style="cursor: default;">
              <div class="skeleton-line title" style="margin-bottom: 0; width: 30%;"></div>
            </div>
            <div class="widget-body" style="grid-template-rows: 1fr;">
              <div class="widget-content">
                <div class="widget-content-inner" style="padding-top: 14px;">
                  <div class="skeleton-line long"></div>
                  <div class="skeleton-line short"></div>
                  <div class="skeleton-line long"></div>
                </div>
              </div>
            </div>
          </div>
          <div data-skeleton="wave2" class="widget open skeleton-widget wave-skeleton" style="animation-delay: 100ms; min-height: 240px;">
            <div class="widget-head" style="cursor: default;">
              <div class="skeleton-line title" style="margin-bottom: 0; width: 45%;"></div>
            </div>
            <div class="widget-body" style="grid-template-rows: 1fr;">
              <div class="widget-content">
                <div class="widget-content-inner" style="padding-top: 14px;">
                  <div class="skeleton-line long"></div>
                  <div class="skeleton-line long"></div>
                  <div class="skeleton-line short"></div>
                  <div class="skeleton-line long"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div data-skeleton="wave3" class="skeleton-widget wave-skeleton wave3-skeleton" style="animation-delay: 200ms; margin-top: 24px; padding: 16px; min-height: 100px;">
          <div class="skeleton-line title" style="width: 50%; height: 18px; margin-bottom: 16px;"></div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="skeleton-line short" style="height: 32px; border-radius: 999px;"></div>
            <div class="skeleton-line long" style="height: 32px; border-radius: 999px;"></div>
          </div>
        </div>
      `;
    }

    function renderLight(data: any, isStreaming: boolean = false, isFullLoaded: boolean = false): string {
      // Legacy: stored as plain text string
      if (typeof data === "string") {
        if (!data.trim()) return "";
        if (data.trim().startsWith("{")) {
          return renderLightSkeleton();
        }
        return `<div class="light-block">${parseMarkdown(data)}</div>`;
      }
      
      if (!data) {
        return renderLightSkeleton();
      }

      if (data && typeof data === "object") {
        if (data.error) return `<div class="error">${escapeHtml(data.error)}</div>`;

        // Sentence mode
        if (data.mode === "sentence") {
          return renderSentence(data, isStreaming);
        }

        // Correction mode
        if (data.mode === "correction" || (data.message && data.suggestions)) {
          const suggestionsHtml = Array.isArray(data.suggestions) && data.suggestions.length
            ? `
              <div class="suggest-title" style="margin-top: 16px; font-weight: 600; color: var(--text-muted); font-size: 0.9rem;">Возможно, ты имел в виду:</div>
              <div class="chips" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                ${data.suggestions.map((s: string) => `<button class="chip" data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
              </div>
            `
            : "";
          return `
            <div class="correction-card fade-up">
              <div class="correction-message">${parseMarkdown(data.message || "")}</div>
              ${suggestionsHtml}
            </div>
          `;
        }

        // Word or Sentence mode
        const isFinished = !isStreaming;
        let html = "";
        
        // Render input note if present
        const isInputNoteReady = isStreaming ? (isFinished || !!data.wave1) : true;
        if (data.input_note && isInputNoteReady) {
          html += `
            <div class="input-note-alert fade-up" style="margin-bottom: 16px; padding: 12px 16px; background: rgba(255,193,7,0.1); border-left: 4px solid var(--accent); border-radius: 4px; font-size: 0.95rem; line-height: 1.5;">
              💡 <em>${escapeHtml(data.input_note)}</em>
            </div>
          `;
        }

        const widgets: string[] = [];
        
        const isWave1Ready = isStreaming ? (isFinished || !!data.wave2) : true;
        if (isWave1Ready && data.wave1) {
          const title = data.wave1.title || "Что ты ввёл";
          const content = parseMarkdown(data.wave1.content || "");
          const word = data.canonical || data.word || "";
          const isOpen = getCardWidgetState(word, title, true);
          widgets.push(widgetHtml("📝", title, content, isOpen, 0, false));
        } else {
          widgets.push(`
            <div class="widget open skeleton-widget wave-skeleton" style="animation-delay: 0ms; min-height: 180px;">
              <div class="widget-head" style="cursor: default;">
                <div class="skeleton-line title" style="margin-bottom: 0; width: 30%;"></div>
              </div>
              <div class="widget-body" style="grid-template-rows: 1fr;">
                <div class="widget-content">
                  <div class="widget-content-inner" style="padding-top: 14px;">
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line long"></div>
                  </div>
                </div>
              </div>
            </div>
          `);
        }

        const isWave2Ready = isStreaming ? (isFinished || !!data.wave3 || !!data.deep_dive) : true;
        if (isWave2Ready && data.wave2) {
          const title = data.wave2.title || "Что это вообще";
          const content = parseMarkdown(data.wave2.content || "");
          const word = data.canonical || data.word || "";
          const isOpen = getCardWidgetState(word, title, false);
          widgets.push(widgetHtml("💡", title, content, isOpen, 100, false));
        } else {
          widgets.push(`
            <div class="widget open skeleton-widget wave-skeleton" style="animation-delay: 100ms; min-height: 240px;">
              <div class="widget-head" style="cursor: default;">
                <div class="skeleton-line title" style="margin-bottom: 0; width: 45%;"></div>
              </div>
              <div class="widget-body" style="grid-template-rows: 1fr;">
                <div class="widget-content">
                  <div class="widget-content-inner" style="padding-top: 14px;">
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line long"></div>
                  </div>
                </div>
              </div>
            </div>
          `);
        }

        html += `<div class="widgets">${widgets.join("")}</div>`;

        // Modern Unified Layout: check data mode
        if (data.mode === "word") {
          // Backward compatibility check
          if (!data.deep_dive) {
            data.deep_dive = {
              recommended: true,
              label: `Разобрать подробнее: ${data.canonical || ""}`,
              hint: "Узнать подробности, готовую грамматику и частые грабли."
            };
          }

          const isDeepDiveReady = isStreaming ? (isFinished || !!data.deep_dive) : true;
          if (isDeepDiveReady && data.deep_dive) {
            const recommendedBadgeHtml = data.deep_dive.recommended
              ? `<span class="badge recommended-badge" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 999px; background: rgba(var(--ll-primary-rgb, 48, 89, 185), 0.08); color: var(--ll-primary); border: 1px solid rgba(var(--ll-primary-rgb, 48, 89, 185), 0.18); backdrop-filter: blur(8px);">Стоит открыть</span>`
              : `<span class="badge recommended-badge" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.08); backdrop-filter: blur(8px);">Обзора достаточно</span>`;

            let btnHtml = "";
            if (isFullLoaded) {
              btnHtml = `
                <button class="btn-go deep-dive-btn success" style="width: 100%; justify-content: center; height: 42px; font-size: 14px; font-weight: 500; transition: all 0.2s; background: rgba(16, 185, 129, 0.08) !important; color: #10b981 !important; border: 1px solid rgba(16, 185, 129, 0.2) !important; backdrop-filter: blur(10px); border-radius: 10px; cursor: default;" disabled>
                  ✓ Разбор открыт
                </button>
              `;
            } else {
              btnHtml = `
                <button class="btn-go deep-dive-btn" style="width: 100%; justify-content: center; height: 42px; font-size: 14px; font-weight: 500; transition: all 0.2s; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(12px); border-radius: 10px; color: var(--text);" data-canonical="${escapeHtml(data.canonical || "")}">
                  ${escapeHtml(data.deep_dive.label || "Разобрать подробнее")}
                </button>
              `;
            }

            html += `
              <div class="deep-dive-card fade-up glass-card" style="margin-top: 28px; padding: 24px; border-radius: 16px; border: 1px solid var(--border); background: var(--bg-elev); backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24); transition: all 0.3s ease; display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                  <div class="deep-dive-title" style="font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted);">Глубокий разбор</div>
                  ${recommendedBadgeHtml}
                </div>
                <div>
                  <div class="deep-dive-hint" style="font-size: 14px; color: var(--text-dim); line-height: 1.5;">
                    ${escapeHtml(data.deep_dive.hint || "")}
                  </div>
                </div>
                <div style="margin-top: 4px;">
                  ${btnHtml}
                </div>
              </div>
              ${isFullLoaded ? "" : '<div class="full-continuation-container"></div>'}
            `;
          } else {
            // Skeleton for deep_dive card
            html += `
              <div data-skeleton="deep_dive" class="skeleton-widget wave-skeleton deep-dive-skeleton" style="animation-delay: 200ms; margin-top: 28px; padding: 24px; min-height: 180px; border-radius: 16px; border: 1px solid var(--border); background: var(--bg-elev);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                  <div class="skeleton-line title" style="width: 20%; height: 12px; margin-bottom: 0;"></div>
                  <div class="skeleton-line title" style="width: 30%; height: 18px; margin-bottom: 0; border-radius: 999px;"></div>
                </div>
                <div class="skeleton-line title" style="width: 45%; height: 22px; margin-bottom: 12px;"></div>
                <div class="skeleton-line long" style="height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton-line short" style="height: 14px; margin-bottom: 20px;"></div>
                <div class="skeleton-line long" style="height: 46px; border-radius: 8px; margin-bottom: 0;"></div>
              </div>
              <div class="full-continuation-container"></div>
            `;
          }
        } else {
          // Legacy/Sentence mode Wave 3 behavior
          const isWave3Ready = isStreaming ? isFinished : true;
          if (isWave3Ready && Array.isArray(data.wave3) && data.wave3.length) {
            const cardsHtml = data.wave3.map((item: any) => renderRecommendationCard(item)).join("");
            
            html += `
              <div class="wave3-section fade-up" style="margin-top: 24px;">
                <div class="rec-title" style="font-weight: 600; margin-bottom: 12px; color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em;">Что разобрать дальше:</div>
                <div class="rec-list" style="display: flex; flex-direction: column; gap: 12px;">
                  ${cardsHtml}
                </div>
              </div>
            `;
          } else {
            html += `
              <div class="skeleton-widget wave-skeleton wave3-skeleton" style="animation-delay: 200ms; margin-top: 24px; padding: 16px; min-height: 100px;">
                <div class="skeleton-line title" style="width: 50%; height: 18px; margin-bottom: 16px;"></div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="skeleton-line short" style="height: 32px; border-radius: 999px;"></div>
                  <div class="skeleton-line long" style="height: 32px; border-radius: 999px;"></div>
                </div>
              </div>
            `;
          }
        }

        return html;
      }
      return "";
    }

    function renderLightContent(lightData: any, isStreaming: boolean = false, wrapInCard: boolean = false): string {
      const hasLight = isStreaming || (lightData && (typeof lightData === "string" ? lightData.trim() : true));
      const innerHtml = hasLight
        ? renderLight(lightData, isStreaming)
        : `<div class="light-block" style="color:var(--text-muted);">…</div>`;
        
      if (wrapInCard) {
        const word = (lightData && typeof lightData === "object" ? (lightData.canonical || lightData.word) : "") 
                     || (document.getElementById("input") as HTMLInputElement | null)?.value 
                     || "";
        const isLoading = !lightData || typeof lightData !== "object" || (!lightData.canonical && !lightData.word);
        return wrapHtmlInWordCard(innerHtml, { _light: lightData }, word, isLoading);
      }
      return innerHtml;
    }


    function attachWidgetToggles(root?: HTMLElement) {
      (root || results)!.querySelectorAll("[data-toggle]").forEach((h) => {
        const el = h as HTMLElement & { __bound?: boolean };
        if (el.__bound) return;
        el.__bound = true;
        el.addEventListener("click", () => {
          el.parentElement?.classList.toggle("open");
          
          // Track and save the state of this widget
          const wordCard = el.closest(".word-card");
          let activeWord = "";
          if (wordCard) {
            const wordEl = wordCard.querySelector(".wc-word");
            if (wordEl) {
              const clone = wordEl.cloneNode(true) as HTMLElement;
              clone.querySelectorAll(".badge").forEach((b) => b.remove());
              activeWord = clone.textContent?.trim() || "";
            }
          }
          if (!activeWord) {
            activeWord = (lastBreakdown ? getWordFromBreakdown(lastBreakdown) : "").trim();
          }
          
          if (activeWord) {
            const title = el.querySelector(".widget-title")?.textContent?.trim() || "";
            const isOpen = el.parentElement?.classList.contains("open") || false;
            saveCardWidgetState(activeWord, title, isOpen);
          }
        });
      });
    }
    function attachChips(container: HTMLElement = results!) {
      if (!container) return;
      container.querySelectorAll(".chip").forEach((c) => {
        const el = c as HTMLButtonElement & { __bound?: boolean };
        if (el.__bound) return;
        el.__bound = true;
        el.addEventListener("click", () => {
          const canonical = el.getAttribute("data-canonical") || "";
          if (canonical) {
            // Wave 3 recommendation chip — go to standard search run() first!
            switchPage("breakdown");
            results!.classList.add("fade-out");
            setTimeout(() => {
              input!.value = canonical;
              results!.classList.remove("fade-out");
              run();
            }, 220);
            return;
          }
          const w = el.getAttribute("data-word") || "";
          if (w) {
            switchPage("breakdown");
            results!.classList.add("fade-out");
            setTimeout(() => {
              input!.value = w;
              results!.classList.remove("fade-out");
              run();
            }, 220);
          }
        });
      });

      container.querySelectorAll(".recommendation-card").forEach((c) => {
        const el = c as HTMLElement & { __bound?: boolean };
        if (el.__bound) return;
        el.__bound = true;
        el.addEventListener("click", () => {
          const canonical = el.getAttribute("data-canonical") || "";
          if (canonical) {
            switchPage("breakdown");
            results!.classList.add("fade-out");
            setTimeout(() => {
              input!.value = canonical;
              const ctxEl = document.getElementById("contextInput") as HTMLInputElement | null;
              if (ctxEl) ctxEl.value = "";
              results!.classList.remove("fade-out");
              run();
            }, 220);
          }
        });
      });
    }

    async function lazyLoadFullBreakdown(canonical: string, btn: HTMLButtonElement) {
      if (busy) return;
      busy = true;

      btn.disabled = true;
      const originalLabel = btn.innerHTML;
      btn.innerHTML = `<span class="mt-spin" style="margin-right: 8px; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid currentColor; border-top-color: transparent; display: inline-block; animation: ln-spin 0.7s linear infinite;" aria-hidden="true"></span> Загрузка...`;

      const root = btn.closest(".word-card") || document.getElementById("results");
      if (!root) {
        busy = false;
        btn.innerHTML = originalLabel;
        btn.disabled = false;
        return;
      }

      const container = root.querySelector(".full-continuation-container") as HTMLElement | null;
      if (!container) {
        busy = false;
        btn.innerHTML = originalLabel;
        btn.disabled = false;
        return;
      }

      container.classList.add("active");
      container.style.marginTop = "24px";

      const TOTAL_LAZY_SKELETONS = 5;
      const skels: string[] = [];
      skels.push(renderFullSkeletonOpen(0));
      for (let i = 1; i < TOTAL_LAZY_SKELETONS; i++) {
        skels.push(renderFullSkeletonClosed(i));
      }
      container.innerHTML = `<div class="widgets">${skels.join("")}</div>`;

      // Retrieve the Light data (either from active lastLightData or from the cached history/library record)
      let lightDataObj = lastLightData;
      if (!lightDataObj || lightDataObj.canonical?.toLowerCase() !== canonical.toLowerCase()) {
        const cached = historyList.find(h => h.word.toLowerCase() === canonical.toLowerCase() && h.breakdown && h.breakdown._light)
                    || wordsList.find(w => w.word.toLowerCase() === canonical.toLowerCase() && w.breakdown && w.breakdown._light);
        if (cached && cached.breakdown) {
          lightDataObj = cached.breakdown._light;
        }
      }
      
      if (!lightDataObj) {
        lightDataObj = {
          mode: "word",
          canonical: canonical,
          wave1: { title: "📝 Что ты ввёл", content: "..." },
          wave2: { title: "💡 Что это вообще", content: "..." }
        };
      }

      const pos = (lightDataObj?.canonical?.toLowerCase() === canonical.toLowerCase() ? lightDataObj?.pos : "") || "";
      const type = (lightDataObj?.canonical?.toLowerCase() === canonical.toLowerCase() ? lightDataObj?.type : "") || "";

      let fullObj: any = null;

      try {
        await fetchStream({ canonical, pos, type, mode: "full" }, (accumulated, isFinished) => {
          const cleaned = accumulated.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          let parsed = null;
          try { parsed = tryRepairJson(cleaned); } catch {}
          fullObj = parsed ?? cleaned;

          if (fullObj && typeof fullObj === "object" && Array.isArray(fullObj.blocks)) {
            const completedCount = isFinished ? fullObj.blocks.length : Math.max(0, fullObj.blocks.length - 1);
            
            let widgetsWrap = container.querySelector(".widgets") as HTMLElement | null;
            if (!widgetsWrap) {
              container.innerHTML = `<div class="widgets"></div>`;
              widgetsWrap = container.querySelector(".widgets")!;
            }

            for (let i = 0; i < completedCount; i++) {
              let blockNode = widgetsWrap.querySelector(`[data-block-idx="${i}"]`) as HTMLElement | null;
              if (!blockNode) {
                const skeletonN = widgetsWrap.querySelector(`[data-skeleton="${i}"]`);
                if (skeletonN) {
                  const block = fullObj.blocks[i];
                  const icon = getBlockIcon(block.title);
                  const title = block.title || "";
                  const content = parseMarkdown(block.content || "");
                  const isOpen = getCardWidgetState(canonical, title, false);
                  const blockHtml = `<div class="skel-fade-in" data-block-idx="${i}">${widgetHtml(icon, title, content, isOpen, 0, false)}</div>`;

                  const tempDiv = document.createElement("div");
                  tempDiv.innerHTML = blockHtml;
                  const realNode = tempDiv.firstElementChild!;
                  skeletonN.replaceWith(realNode);
                  attachWidgetToggles(realNode as HTMLElement);
                }
              }
            }

            if (isFinished) {
              widgetsWrap.querySelectorAll("[data-skeleton]").forEach((el) => el.remove());
            }
          }
        });

        if (fullObj && typeof fullObj === "object") {
          btn.className = "btn-go deep-dive-btn success";
          btn.style.background = "rgba(16, 185, 129, 0.15) !important";
          btn.style.color = "#10b981 !important";
          btn.style.border = "1px solid rgba(16, 185, 129, 0.3) !important";
          btn.style.cursor = "default";
          btn.innerHTML = "✓ Разбор открыт";
          btn.disabled = true;

          const combined = { _light: lightDataObj, breakdown: fullObj };
          const trans = lightDataObj?.wave1?.content ? lightDataObj.wave1.content.split("\n")[0] : "";
          await addHistory({ word: canonical, translation: trans, mode: "full_json" }, combined);
          
          const existingSaved = wordsList.find((w) => w.word.toLowerCase() === canonical.toLowerCase());
          if (existingSaved) {
            existingSaved.breakdown = combined;
            if (currentUserId) {
              await supabase.from("words").update({ breakdown: JSON.stringify(combined) }).eq("id", existingSaved.id);
            } else {
              store.words = store.words.map((w: any) =>
                w.word.toLowerCase() === canonical.toLowerCase() ? { ...w, breakdown: combined } : w
              );
              saveStore(store);
            }
          }

          if (root === document.getElementById("results")) {
            lastBreakdown = combined;
            renderSaveRow();
          }

          setTimeout(() => {
            container.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        } else {
          btn.innerHTML = originalLabel;
          btn.disabled = false;
        }
      } catch (err) {
        console.warn("Lazy load Full breakdown failed:", err);
        btn.innerHTML = originalLabel;
        btn.disabled = false;
      } finally {
        busy = false;
      }
    }

    function attachDeepDiveHandlers(root?: HTMLElement) {
      const container = root || results;
      container!.querySelectorAll(".deep-dive-btn").forEach((btn) => {
        const el = btn as HTMLButtonElement & { __bound?: boolean };
        if (el.__bound) return;
        el.__bound = true;
        el.addEventListener("click", () => {
          const canonical = el.getAttribute("data-canonical") || "";
          if (canonical) {
            lazyLoadFullBreakdown(canonical, el);
          }
        });
      });
    }

    // ===== Storage (history + lang in localStorage; folders/words in Supabase) =====
    const LS_KEY = "wordbreaker.v1";
    function loadStore(): any {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return { history: [], words: [], folders: [], lang: "ru" };
    }
    function saveStore(s: any) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ 
          history: s.history, 
          words: s.words, 
          folders: s.folders, 
          lang: s.lang 
        }));
      } catch {}
    }
    const store: any = loadStore();
    if (!Array.isArray(store.history)) store.history = [];
    if (!Array.isArray(store.words)) store.words = [];
    if (!Array.isArray(store.folders)) store.folders = [];
    if (!store.lang) store.lang = "ru";
    let currentLang: "ru" | "en" = store.lang;

    // ===== Cloud state =====
    let currentUserId: string | null = null;
    type Folder = { id: string; name: string };
    type WordRow = {
      id: string;
      folder_id: string;
      word: string;
      breakdown: any;
      created_at: string;
    };
    type HistoryRow = {
      id: string;
      word: string;
      translation: string;
      mode: string;
      breakdown: any;
      updated_at: string;
    };
    let foldersList: Folder[] = [];
    let wordsList: WordRow[] = [];
    let historyList: HistoryRow[] = [];

    function safeParseBreakdown(b: any): any {
      if (!b) return {};
      if (typeof b === "object") return b;
      try {
        return JSON.parse(b);
      } catch {
        return {};
      }
    }

    async function loadCloudData() {
      if (!currentUserId) {
        foldersList = (store.folders || []).map((f: any) => ({ id: f.id, name: f.name }));
        wordsList = (store.words || []).map((w: any, i: number) => ({
          id: "local-w-" + i,
          folder_id: w.folder_id || "__all__",
          word: w.word,
          created_at: w.at || new Date().toISOString(),
          breakdown: safeParseBreakdown(w.breakdown),
        }));
        historyList = (store.history || []).map((h: any, i: number) => ({
          id: "local-h-" + i,
          word: h.word,
          translation: h.translation || "",
          mode: h.mode || "word",
          breakdown: h.breakdown ? safeParseBreakdown(h.breakdown) : null,
          updated_at: h.at || new Date().toISOString(),
        }));
        return;
      }
      const [foldersRes, wordsRes, historyRes] = await Promise.all([
        supabase.from("folders").select("id,name,created_at").order("created_at", { ascending: true }),
        supabase
          .from("words")
          .select("id,folder_id,word,breakdown,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("history")
          .select("id,word,translation,mode,breakdown,updated_at")
          .order("updated_at", { ascending: false })
          .limit(200),
      ]);
      foldersList = (foldersRes.data || []).map((f: any) => ({ id: f.id, name: f.name }));
      wordsList = (wordsRes.data || []).map((w: any) => ({
        id: w.id,
        folder_id: w.folder_id,
        word: w.word,
        created_at: w.created_at,
        breakdown: safeParseBreakdown(w.breakdown),
      }));
      historyList = (historyRes.data || []).map((h: any) => ({
        id: h.id,
        word: h.word,
        translation: h.translation || "",
        mode: h.mode || "word",
        breakdown: safeParseBreakdown(h.breakdown),
        updated_at: h.updated_at,
      }));
    }

    // ===== i18n =====
    const I18N: Record<string, Record<string, string>> = {
      ru: {
        "nav.breakdown": "Разбор",
        "nav.library": "Мои слова",
        "nav.history": "История разборов",
        "nav.top": "Топ слов",
        "nav.account": "Аккаунт",
        "brand.sub": "Разбор английских слов",
        "search.placeholder": "Введи слово или фразу на английском…",
        "search.btn": "Разобрать →",
        "search.analyzing": "Анализирую",
        "save.btn": "Сохранить →",
        "save.done": "Сохранено ✓",
        "save.title": "В какую папку сохранить?",
        "save.new": "＋ Новая папка",
        "save.newPlaceholder": "Название папки",
        "lib.all": "Все слова",
        "lib.newFolder": "+ Новая папка",
        "empty.libAll.title": "Здесь будут твои слова",
        "empty.libAll.sub": "Разбери первое слово и сохрани его — оно появится здесь.",
        "empty.libFolder.title": "В этой папке пока пусто",
        "empty.libFolder.sub": "Сохрани сюда что-нибудь со страницы разбора.",
        "history.title": "История разборов",
        "empty.history.title": "История пуста",
        "empty.history.sub": "Каждый разбор автоматически появится здесь.",
        "top.title": "Топ слов",
        "empty.top.title": "Скоро здесь появятся подборки слов",
        "empty.top.sub": "Следи за обновлениями.",
        "account.title": "Аккаунт",
        "account.guest": "Гость",
        "account.sub": "Войди, чтобы синхронизировать слова между устройствами",
        "account.btn": "Войти / Зарегистрироваться",
        "err.generic": "Что-то пошло не так. Попробуй ещё раз.",
        "err.input": "Введи слово или фразу на английском",
        "badge.light": "Light",
        "badge.full": "Разбор",
        "badge.sentence": "Фраза",
      },
      en: {
        "nav.breakdown": "Breakdown",
        "nav.library": "My words",
        "nav.history": "History",
        "nav.top": "Top words",
        "nav.account": "Account",
        "brand.sub": "English word breakdowns",
        "search.placeholder": "Type an English word or phrase…",
        "search.btn": "Break down →",
        "search.analyzing": "Analyzing",
        "save.btn": "Save →",
        "save.done": "Saved ✓",
        "save.title": "Save to which folder?",
        "save.new": "＋ New folder",
        "save.newPlaceholder": "Folder name",
        "lib.all": "All words",
        "lib.newFolder": "+ New folder",
        "empty.libAll.title": "Your words will appear here",
        "empty.libAll.sub": "Break down your first word and save it — it’ll show up here.",
        "empty.libFolder.title": "This folder is empty",
        "empty.libFolder.sub": "Save something here from the breakdown page.",
        "history.title": "History",
        "empty.history.title": "No history yet",
        "empty.history.sub": "Every breakdown shows up here automatically.",
        "top.title": "Top words",
        "empty.top.title": "Curated word lists are coming soon",
        "empty.top.sub": "Stay tuned.",
        "account.title": "Account",
        "account.guest": "Guest",
        "account.sub": "Sign in to sync your words across devices",
        "account.btn": "Sign in / Sign up",
        "err.generic": "Something went wrong. Try again.",
        "err.input": "Type an English word or phrase",
        "badge.light": "Light",
        "badge.full": "Breakdown",
        "badge.sentence": "Phrase",
      },
    };
    function t(k: string) {
      return (I18N[currentLang] && I18N[currentLang][k]) || I18N.ru[k] || k;
    }

    function applyLang() {
      document.documentElement.lang = currentLang;
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const k = el.getAttribute("data-i18n");
        if (k) (el as HTMLElement).textContent = t(k);
      });
      if (input) input.placeholder = t("search.placeholder");
      const searchInp = document.getElementById("appBarSearchInput") as HTMLInputElement | null;
      if (searchInp) {
        searchInp.placeholder = currentLang === "en" ? "Search..." : "Поиск...";
      }
      if (goBtn) goBtn.textContent = t("search.btn");
      const loadingSpan = document.querySelector("#loading > span:first-child");
      if (loadingSpan) (loadingSpan as HTMLElement).textContent = t("search.analyzing");
      document.getElementById("langRu")?.classList.toggle("active", currentLang === "ru");
      document.getElementById("langEn")?.classList.toggle("active", currentLang === "en");
      document.querySelectorAll("[data-page-title]").forEach((h) => {
        const k = h.getAttribute("data-page-title")!;
        (h as HTMLElement).textContent = t(k);
      });
      const accGuest = document.getElementById("accGuest");
      if (accGuest) accGuest.textContent = t("account.guest");
      const accSub = document.getElementById("accSub");
      if (accSub) accSub.textContent = t("account.sub");
      const accBtn = document.getElementById("accBtn");
      if (accBtn) accBtn.textContent = t("account.btn");
      const topT = document.getElementById("topEmptyT");
      if (topT) topT.textContent = t("empty.top.title");
      const topS = document.getElementById("topEmptyS");
      if (topS) topS.textContent = t("empty.top.sub");
      if (document.getElementById("page-library")?.classList.contains("active")) renderLibrary();
      if (document.getElementById("page-history")?.classList.contains("active")) renderHistory();
      renderSaveRow();
    }

    async function addHistory(entry: { word: string; translation?: string; mode?: string }, breakdown: any) {
      const word = entry.word;
      const translation = entry.translation || "";
      const mode = entry.mode || "word";
      const nowIso = new Date().toISOString();

      historyList = historyList.filter((h) => h.word !== word);
      const cacheRow: HistoryRow = {
        id: "tmp-" + nowIso,
        word,
        translation,
        mode,
        breakdown,
        updated_at: nowIso,
      };
      historyList.unshift(cacheRow);
      if (historyList.length > 200) historyList = historyList.slice(0, 200);

      if (!currentUserId) {
        store.history = store.history.filter((h: any) => h.word !== word);
        store.history.unshift({ word, translation, mode, breakdown, at: nowIso });
        if (store.history.length > 200) store.history = store.history.slice(0, 200);
        saveStore(store);
        if (document.getElementById("page-history")?.classList.contains("active")) renderHistory();
        return;
      }

      try {
        const { data, error } = await supabase
          .from("history")
          .upsert(
            {
              user_id: currentUserId,
              word,
              translation,
              mode,
              breakdown: JSON.stringify(breakdown ?? {}),
              updated_at: nowIso,
            },
            { onConflict: "user_id,word" },
          )
          .select("id,word,translation,mode,breakdown,updated_at")
          .single();
        if (!error && data) {
          cacheRow.id = data.id;
          cacheRow.updated_at = data.updated_at || nowIso;
        }
      } catch (e) {
        console.warn("history upsert failed", e);
      }
      if (document.getElementById("page-history")?.classList.contains("active")) renderHistory();
    }
    function fmtDateTime(iso: string) {
      if (!iso) return "";
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return d.getDate() + " " + months[d.getMonth()] + ", " + hh + ":" + mm;
      } catch {
        return iso;
      }
    }
    async function removeHistoryById(id: string) {
      historyList = historyList.filter((h) => h.id !== id);
      if (currentUserId && !id.startsWith("tmp-") && !id.startsWith("local-")) {
        await supabase.from("history").delete().eq("id", id);
      } else if (!currentUserId) {
        store.history = historyList.map((h) => ({
          word: h.word,
          translation: h.translation,
          mode: h.mode,
          breakdown: h.breakdown,
          at: h.updated_at,
        }));
        saveStore(store);
      }
    }
    function renderHistory() {
      const el = document.getElementById("historyList");
      if (!el) return;
      if (!historyList.length) {
        el.innerHTML = `
          <div class="empty-state" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;">
            <div class="empty-icon">🕓</div>
            <div class="empty-title">${escapeHtml(t("empty.history.title"))}</div>
            <div class="empty-sub">${escapeHtml(t("empty.history.sub"))}</div>
          </div>`;
        return;
      }
      // Inject round filter button into the page header (top-right)
      const histHeader = document.getElementById("histPageHeader");
      if (histHeader) {
        const hasHistFilterForBtn = !!(histFilterFrom || histFilterTo);
        histHeader.innerHTML = `
          <div class="dfb-mobile-wrap hist-filter-wrap" id="histFilterMobileWrap" style="display:flex;">
            <button class="dfb-mobile-btn ${hasHistFilterForBtn ? "active" : ""}" id="histFilterMobileBtn" title="${escapeHtml(currentLang === "en" ? "Filter by date" : "Фильтр по дате")}">⚙︎</button>
          </div>`;
      }

      let filtered = historyList.filter((h) => inDateRange(h.updated_at, histFilterFrom, histFilterTo));
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        filtered = filtered.filter((h) => {
          const wordMatch = h.word && h.word.toLowerCase().includes(q);
          let translation = h.translation || "";
          if (h.breakdown && !translation) {
            const b = h.breakdown as any;
            const bTrans = b.translation;
            if (bTrans) {
              if (typeof bTrans === "object") {
                translation = bTrans.main || "";
              } else {
                translation = String(bTrans);
              }
            }
          }
          const transMatch = String(translation).toLowerCase().includes(q);
          return wordMatch || transMatch;
        });
      }
      const hasHistFilter = !!(histFilterFrom || histFilterTo);
      const attachHistFilter = () => {
        // Mobile round button toggle (in the page header)
        const mobileWrap = document.getElementById("histFilterMobileWrap") as HTMLElement | null;
        const mobileBtn = document.getElementById("histFilterMobileBtn") as HTMLButtonElement | null;
        if (mobileBtn && mobileWrap) {
          mobileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            let panel = mobileWrap.querySelector(".dfb-panel") as HTMLElement | null;
            if (panel) { panel.remove(); mobileBtn.classList.remove("active"); return; }
            const lblFrom2 = currentLang === "en" ? "from" : "с";
            const lblTo2 = currentLang === "en" ? "to" : "по";
            const lblReset2 = currentLang === "en" ? "Reset" : "Сбросить";
            panel = document.createElement("div");
            panel.className = "dfb-panel";
            panel.innerHTML = `
              <label class="dfb-field"><span>${escapeHtml(lblFrom2)}</span><input type="date" id="histMobileFrom" value="${escapeHtml(histFilterFrom)}" /></label>
              <label class="dfb-field"><span>${escapeHtml(lblTo2)}</span><input type="date" id="histMobileTo" value="${escapeHtml(histFilterTo)}" /></label>
              <button class="dfb-reset" id="histMobileReset" ${hasHistFilter ? "" : "disabled"}>${escapeHtml(lblReset2)}</button>
            `;
            mobileWrap.appendChild(panel);
            mobileBtn.classList.add("active");
            panel.querySelector("#histMobileFrom")?.addEventListener("change", (ev) => { histFilterFrom = (ev.target as HTMLInputElement).value; renderHistory(); });
            panel.querySelector("#histMobileTo")?.addEventListener("change", (ev) => { histFilterTo = (ev.target as HTMLInputElement).value; renderHistory(); });
            panel.querySelector("#histMobileReset")?.addEventListener("click", () => { histFilterFrom = ""; histFilterTo = ""; renderHistory(); });
          });
          // Close panel on outside click
          setTimeout(() => {
            document.addEventListener("click", function closePanelHist(e2) {
              if (!mobileWrap.contains(e2.target as Node)) {
                mobileWrap.querySelector(".dfb-panel")?.remove();
                mobileBtn.classList.remove("active");
                document.removeEventListener("click", closePanelHist);
              }
            });
          }, 0);
        }
      };

      if (!filtered.length) {
        const noPeriod = currentLang === "en" ? "No words in this period" : "Нет слов за этот период";
        const noResults = currentLang === "en" ? "No results found" : "Ничего не найдено";
        const title = historySearchQuery.trim() ? noResults : noPeriod;
        el.innerHTML = `
          <div class="empty-state" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;">
            <div class="empty-title">${escapeHtml(title)}</div>
          </div>`;
        attachHistFilter();
        return;
      }

      function fmtGroupDate(iso: string) {
        if (!iso) return "";
        try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return iso;
          if (currentLang === "en") {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
          } else {
            const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
            return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
          }
        } catch {
          return iso;
        }
      }

      function getGroupHeader(isoString: string): string {
        if (!isoString) return currentLang === "en" ? "Unknown Date" : "Неизвестная дата";
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const now = new Date();
        const dStr = d.toDateString();
        const nowStr = now.toDateString();
        
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const yestStr = yesterday.toDateString();
        
        if (dStr === nowStr) {
          return currentLang === "en" ? "Today" : "Сегодня";
        } else if (dStr === yestStr) {
          return currentLang === "en" ? "Yesterday" : "Вчера";
        } else {
          return fmtGroupDate(isoString);
        }
      }

      const groups: { header: string; items: typeof filtered }[] = [];
      filtered.forEach((h) => {
        const header = getGroupHeader(h.updated_at);
        let group = groups.find((g) => g.header === header);
        if (!group) {
          group = { header, items: [] };
          groups.push(group);
        }
        group.items.push(h);
      });

      el.innerHTML = groups
        .map((group) => {
          const itemsHtml = group.items.map((h) => {
            const b = h.breakdown || {};
            const translation = h.translation || getTranslationFromBreakdown(b);

            return `
              <div class="word-card glass-card" data-hid="${escapeHtml(h.id)}">
                <div class="wc-head">
                  <button class="wc-trash" data-htrash="${escapeHtml(h.id)}" title="Удалить из истории"><span class="material-symbols-outlined" style="font-size:14px;">close</span></button>
                  <button class="wc-chevron" data-chevron aria-label="Toggle">
                    <span class="material-symbols-outlined" style="font-size:16px;">expand_more</span>
                  </button>
                  <div class="wc-word-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 56px;">
                    <div class="wc-word">${escapeHtml(h.word)}</div>
                    <button class="sound-btn" data-text="${escapeHtml(h.word)}" title="${escapeHtml(currentLang === "en" ? "Listen" : "Прослушать")}" style="background: transparent; border: none; cursor: pointer; color: var(--ll-outline); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: all 0.2s ease;">
                      <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
                    </button>
                  </div>
                  ${translation ? `<div class="wc-translation">${escapeHtml(translation)}</div>` : ""}
                  <div class="wc-meta">
                    <span class="wc-date">${escapeHtml(fmtDateTime(h.updated_at))}</span>
                  </div>
                </div>
                <div class="wc-detail"><div class="wc-detail-inner"></div></div>
              </div>`;
          }).join("");

          return `
            <div class="history-group" style="margin-bottom: 24px;">
              <div class="history-group-header" style="font-size: 11px; font-weight: 700; color: var(--ll-outline); margin: 24px 0 12px 4px; text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 8px; user-select: none;">
                <span class="material-symbols-outlined" style="font-size: 16px;">calendar_today</span>
                <span>${escapeHtml(group.header)}</span>
              </div>
              <div class="lib-words">
                ${itemsHtml}
              </div>
            </div>
          `;
        })
        .join("");

      attachHistFilter();

      el.querySelectorAll("[data-htrash]").forEach((b) => {
        b.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = (b as HTMLElement).getAttribute("data-htrash") || "";
          await removeHistoryById(id);
          renderHistory();
        });
      });
      el.querySelectorAll(".word-card").forEach((c) => {
        c.addEventListener("click", (e) => {
          const tgt = e.target as HTMLElement;
          if (tgt.closest(".wc-trash")) return;
          if (tgt.closest(".sound-btn")) return;
          if (tgt.closest(".wc-detail")) return;

          const sBar = document.getElementById("appBarSearch");
          if (sBar && sBar.classList.contains("expanded")) {
            const id = c.getAttribute("data-hid");
            if (id) {
              cardIdToOpenAfterRender = id;
            }
            collapseSearchBar();
            return;
          }

          const id = c.getAttribute("data-hid") || "";
          const isOpen = c.classList.contains("open");
          el.querySelectorAll(".word-card.open").forEach((o) => {
            if (o !== c) {
              o.classList.remove("open");
              const inner = o.querySelector(".wc-detail-inner");
              if (inner) inner.innerHTML = "";
            }
          });
          if (isOpen) {
            c.classList.remove("open");
            const inner = c.querySelector(".wc-detail-inner");
            if (inner) inner.innerHTML = "";
            return;
          }
          const entry = historyList.find((x) => x.id === id);
          if (!entry || !entry.breakdown) return;
          const obj = entry.breakdown;
          const inner = c.querySelector(".wc-detail-inner") as HTMLElement;
          inner.innerHTML = renderUnifiedBreakdown(obj);
          const word = entry.word || getWordFromBreakdown(obj);
          if (word) {
            const row = document.createElement("div");
            row.className = "save-row";
            row.style.marginTop = "16px";
            const saved = findSavedByWord(word);
            if (saved) {
              row.innerHTML = `<div class="saved-folder-note">${escapeHtml(currentLang === "en" ? "Saved to:" : "Сохранено в:")} <span class="sf-name">${escapeHtml(saved.folderName)}</span></div>`;
            } else {
              row.innerHTML = `<button class="btn-save glass-button">${escapeHtml(t("save.btn"))}</button>`;
              row.querySelector("button")!.addEventListener("click", (ev) => {
                ev.stopPropagation();
                openFolderPickerFor(row, obj, word);
              });
            }
            inner.appendChild(row);
          }
          attachWidgetToggles(inner);
          attachTabListeners(inner, obj);
          attachChips(inner);
          c.classList.add("open");
        });
      });

      // Click simulation for restoring clicked card after search collapse
      if (cardIdToOpenAfterRender) {
        const targetCard = el.querySelector(`.word-card[data-hid="${cardIdToOpenAfterRender}"]`) as HTMLElement | null;
        if (targetCard) {
          cardIdToOpenAfterRender = null;
          targetCard.click();
        }
      }
    }

    function todayISO() {
      return new Date().toISOString().slice(0, 10);
    }
    function fmtDate(iso: string) {
      if (!iso) return "";
      try {
        const d = new Date(iso);
        const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
        return d.getDate() + " " + months[d.getMonth()];
      } catch {
        return iso;
      }
    }
    async function addFolder(name: string): Promise<Folder | null> {
      if (!name) return null;
      const existing = foldersList.find((f) => f.name === name);
      if (existing) return existing;
      if (!currentUserId) {
        const id = "loc-f-" + Date.now();
        const f = { id, name };
        foldersList.push(f);
        store.folders.push(f);
        saveStore(store);
        return f;
      }
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: currentUserId, name })
        .select("id,name")
        .single();
      if (error || !data) return null;
      foldersList.push({ id: data.id, name: data.name });
      return { id: data.id, name: data.name };
    }
    async function removeFolderById(id: string) {
      if (currentUserId && !id.startsWith("loc-f-")) {
        await supabase.from("folders").delete().eq("id", id);
      } else {
        store.folders = store.folders.filter((f: any) => f.id !== id);
        store.words = store.words.filter((w: any) => w.folder_id !== id);
        saveStore(store);
      }
      foldersList = foldersList.filter((f) => f.id !== id);
      wordsList = wordsList.filter((w) => w.folder_id !== id);
    }
    async function addWordToFolder(folderId: string, word: string, breakdown: any) {
      const existing = wordsList.find((w) => w.folder_id === folderId && w.word === word);
      if (!currentUserId) {
        if (existing) {
          existing.breakdown = breakdown;
          store.words = store.words.map((w: any) => 
            (w.word === word && w.folder_id === folderId) ? { ...w, breakdown } : w
          );
        } else {
          const entry: WordRow = {
            id: "loc-w-" + Date.now(),
            folder_id: folderId,
            word,
            created_at: new Date().toISOString(),
            breakdown,
          };
          wordsList.unshift(entry);
          store.words.unshift({
            folder_id: folderId,
            word,
            breakdown,
            at: entry.created_at
          });
        }
        saveStore(store);
        return existing || wordsList[0];
      }
      if (existing) {
        const { data, error } = await supabase
          .from("words")
          .update({ breakdown: JSON.stringify(breakdown) })
          .eq("id", existing.id)
          .select("id,folder_id,word,breakdown,created_at")
          .single();
        if (error) {
          console.error("Error updating word in folder in Supabase:", error);
        }
        if (data) existing.breakdown = breakdown;
        return existing;
      }
      const { data, error } = await supabase
        .from("words")
        .insert({
          user_id: currentUserId,
          folder_id: folderId,
          word,
          breakdown: JSON.stringify(breakdown),
        })
        .select("id,folder_id,word,breakdown,created_at")
        .single();
      if (error || !data) {
        if (error) {
          console.error("Error inserting word into folder in Supabase:", error);
        }
        return null;
      }
      const entry: WordRow = {
        id: data.id,
        folder_id: data.folder_id,
        word: data.word,
        created_at: data.created_at,
        breakdown,
      };
      wordsList.unshift(entry);
      return entry;
    }
    async function removeWordById(id: string) {
      if (currentUserId && !id.startsWith("loc-w-")) {
        await supabase.from("words").delete().eq("id", id);
      } else {
        const wordToRem = wordsList.find(w => w.id === id);
        if (wordToRem) {
          store.words = store.words.filter((w: any) => !(w.word === wordToRem.word && w.folder_id === wordToRem.folder_id));
          saveStore(store);
        }
      }
      wordsList = wordsList.filter((w) => w.id !== id);
    }
    function findSavedByWord(word: string): (WordRow & { folderName: string }) | null {
      if (!word) return null;
      const normalized = word.trim().toLowerCase();
      const w = wordsList.find((x) => x.word.trim().toLowerCase() === normalized);
      if (!w) return null;
      if (w.folder_id === "__all__") return { ...w, folderName: t("lib.all") };
      const f = foldersList.find((f) => f.id === w.folder_id);
      return { ...w, folderName: f?.name || t("lib.all") };
    }
    let lastBreakdown: any = null;
    let lastBreakdownWord: string = "";
    let lastLightData: any = null;

    function renderSaveRow() {
      const existing = results!.querySelector(".save-row");
      if (existing) existing.remove();
      if (!lastBreakdown) return;
      const word = getWordFromBreakdown(lastBreakdown);
      if (!word) return;
      const row = document.createElement("div");
      row.className = "save-row fade-up";
      row.style.animationDelay = ".4s";


      const savedEntry = findSavedByWord(word);
      if (savedEntry) {
        row.innerHTML = `<div class="saved-folder-note">${escapeHtml(currentLang === "en" ? "Saved to:" : "Сохранено в:")} <span class="sf-name">${escapeHtml(savedEntry.folderName)}</span></div>`;
        results!.appendChild(row);
        return;
      }

      row.innerHTML = `<button class="btn-save glass-button" id="saveBtn">${escapeHtml(t("save.btn"))}</button>`;
      results!.appendChild(row);
      row.querySelector("#saveBtn")!.addEventListener("click", (e) => {
        e.stopPropagation();
        lastBreakdownWord = word;
        openFolderPicker(row);
      });
    }

    function openFolderPicker(row: HTMLElement) {
      closeFolderPicker();
      const pop = document.createElement("div");
      pop.className = "folder-pop glass-card";
      pop.innerHTML = `
        <div class="folder-pop-title">${escapeHtml(t("save.title"))}</div>
        <div class="folder-pop-list" style="max-height:280px;overflow-y:auto;">
          ${
            foldersList.length
              ? foldersList
                  .map(
                    (f) =>
                      `<div class="folder-pop-item" data-folder-id="${escapeHtml(f.id)}"><span class="ic material-symbols-outlined" style="font-size:16px;">folder</span><span>${escapeHtml(f.name)}</span></div>`,
                  )
                  .join("")
              : `<div class="saved-folder-note" style="padding:8px 4px;">${escapeHtml(currentLang === "en" ? "No folders yet — create one below" : "Папок пока нет — создай ниже")}</div>`
          }
        </div>
        <div class="folder-pop-divider"></div>
        <button class="folder-pop-add" id="popAdd">${escapeHtml(t("save.new"))}</button>
        <div class="folder-pop-new" id="popNew" style="display:none;">
          <input type="text" placeholder="${escapeHtml(t("save.newPlaceholder"))}" id="popNewInput" />
          <button id="popNewBtn">OK</button>
        </div>
      `;
      row.appendChild(pop);
      requestAnimationFrame(() => pop.classList.add("open"));

      pop.querySelectorAll(".folder-pop-item").forEach((it) => {
        it.addEventListener("click", () => {
          const id = it.getAttribute("data-folder-id") || "";
          if (id) saveCurrentToFolder(id);
        });
      });
      const popAdd = pop.querySelector("#popAdd") as HTMLElement;
      const popNew = pop.querySelector("#popNew") as HTMLElement;
      const popNewInput = pop.querySelector("#popNewInput") as HTMLInputElement;
      const popNewBtn = pop.querySelector("#popNewBtn") as HTMLElement;
      popAdd.addEventListener("click", () => {
        popAdd.style.display = "none";
        popNew.style.display = "flex";
        popNewInput.focus();
      });
      async function commitNew() {
        const v = popNewInput.value.trim();
        if (!v) return;
        const f = await addFolder(v);
        if (f) await saveCurrentToFolder(f.id);
      }
      popNewBtn.addEventListener("click", () => {
        commitNew();
      });
      popNewInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitNew();
        }
        if (e.key === "Escape") closeFolderPicker();
      });

      setTimeout(() => {
        document.addEventListener("click", onDocClickClose, { once: false });
      }, 0);
    }
    function onDocClickClose(e: MouseEvent) {
      const pop = document.querySelector(".folder-pop");
      if (!pop) {
        document.removeEventListener("click", onDocClickClose);
        return;
      }
      if (pop.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest("#saveBtn")) return;
      closeFolderPicker();
    }
    function closeFolderPicker() {
      document.removeEventListener("click", onDocClickClose);
      document.querySelectorAll(".folder-pop").forEach((p) => p.remove());
    }

    function openFolderPickerFor(row: HTMLElement, breakdown: any, word: string) {
      lastBreakdown = breakdown;
      lastBreakdownWord = word;
      openFolderPicker(row);
    }

    async function saveCurrentToFolder(folderId: string) {
      if (!lastBreakdown) return;
      const b = lastBreakdown;
      const word = lastBreakdownWord || getWordFromBreakdown(b);
      if (!word) return;
      await addWordToFolder(folderId, word, b);
      closeFolderPicker();
      renderSaveRow();
      renderLibrary();
      if (document.getElementById("page-history")?.classList.contains("active")) renderHistory();
    }

    let activeFolder = "__all__"; // "__all__" or folder.id
    let libSortType = "date"; // "date" or "alpha"
    let libFilterFrom = "";
    let libFilterTo = "";
    let histFilterFrom = "";
    let histFilterTo = "";
    let librarySearchQuery = "";
    let historySearchQuery = "";
    let cardIdToOpenAfterRender: string | null = null;

    function inDateRange(iso: string, from: string, to: string): boolean {
      if (!iso) return !from && !to;
      const d = iso.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
    function dateFilterBarHtml(idPrefix: string, from: string, to: string): string {
      const lblFrom = currentLang === "en" ? "from" : "с";
      const lblTo = currentLang === "en" ? "to" : "по";
      const lblReset = currentLang === "en" ? "Reset" : "Сбросить";
      const hasFilter = !!(from || to);
      // Full bar (desktop)
      const fullBar = `
        <div class="date-filter-bar">
          <label class="dfb-field"><span>${lblFrom}</span><input type="date" id="${idPrefix}From" value="${escapeHtml(from)}" /></label>
          <label class="dfb-field"><span>${lblTo}</span><input type="date" id="${idPrefix}To" value="${escapeHtml(to)}" /></label>
          <button class="dfb-reset" id="${idPrefix}Reset" ${hasFilter ? "" : "disabled"}>${lblReset}</button>
        </div>`;
      // Mobile: round button + panel (hidden on desktop via CSS)
      const mobileBtn = `
        <div class="dfb-mobile-wrap" id="${idPrefix}MobileWrap">
          <button class="dfb-mobile-btn ${hasFilter ? "active" : ""}" id="${idPrefix}MobileBtn" title="${escapeHtml(currentLang === "en" ? "Filter by date" : "Фильтр по дате")}">⚙︎</button>
        </div>`;
      return fullBar + mobileBtn;
    }


    function folderCount(folderId: string) {
      if (folderId === "__all__") return wordsList.length;
      return wordsList.filter((w) => w.folder_id === folderId).length;
    }
    function renderLibraryFolders() {
      const el = document.getElementById("libFolders");
      if (!el) return;
      let html = "";
      // "All words" tab — always first, never deletable
      html += `<button class="lib-folder glass-card lib-folder--all ${activeFolder === "__all__" ? "active" : ""}" data-folder="__all__">
        <div class="ic-wrap"><span class="material-symbols-outlined">bookmarks</span></div><span class="nm">${escapeHtml(t("lib.all"))}</span><span class="ct">${folderCount("__all__")}</span>
      </button>`;

      if (foldersList.length) {
        for (const f of foldersList) {
          html += `<button class="lib-folder glass-card ${activeFolder === f.id ? "active" : ""}" data-folder="${escapeHtml(f.id)}" data-user="1">
            <div class="ic-wrap"><span class="material-symbols-outlined">folder</span></div><span class="nm">${escapeHtml(f.name)}</span><span class="ct">${folderCount(f.id)}</span><span class="folder-del" data-del="${escapeHtml(f.id)}" title="">×</span>
          </button>`;
        }
      }

      // "+" card button — last folder, styled cleanly via CSS
      html += `<button class="lib-folder-add-card glass-card" id="libAddFolderCardBtn" title="${escapeHtml(currentLang === "en" ? "New folder" : "Новая папка")}">
        <div class="ic-wrap"><span class="material-symbols-outlined">add</span></div><span class="nm">${escapeHtml(currentLang === "en" ? "New Folder" : "Папка")}</span>
      </button>`;
      // Desktop: show the "+ New folder" text input at the bottom of the sidebar
      html += `
        <div class="lib-folder-divider lib-folder-divider--desktop"></div>
        <div class="lib-folder-new">
          <input type="text" id="libNewFolder" placeholder="${escapeHtml(t("lib.newFolder"))}" />
        </div>
      `;
      // "+" round button — on mobile replaces the text input; uses prompt() for simplicity
      html += `<button class="lib-folder-add-btn" id="libAddFolderBtn" title="${escapeHtml(currentLang === "en" ? "New folder" : "Новая папка")}">＋</button>`;
      el.innerHTML = html;

      // Folder chip click / delete
      el.querySelectorAll(".lib-folder").forEach((b) => {
        b.addEventListener("click", async (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains("folder-del")) {
            e.stopPropagation();
            const id = target.getAttribute("data-del") || "";
            await removeFolderById(id);
            if (activeFolder === id) activeFolder = "__all__";
            renderLibrary();
            return;
          }
          const newFolder = b.getAttribute("data-folder") || "__all__";
          if (newFolder !== activeFolder) { libFilterFrom = ""; libFilterTo = ""; }
          activeFolder = newFolder;
          renderLibrary();
        });
      });

      // Add folder via the horizontal "+" button next to All Words
      const addCardBtn = el.querySelector("#libAddFolderCardBtn");
      addCardBtn?.addEventListener("click", async () => {
        const placeholder = currentLang === "en" ? "Folder name" : "Название папки";
        const v = window.prompt(placeholder, "");
        if (!v || !v.trim()) return;
        const f = await addFolder(v.trim());
        if (f) {
          activeFolder = f.id;
          renderLibrary();
        }
      });

      // Desktop input (Enter to confirm)
      const inp = el.querySelector("#libNewFolder") as HTMLInputElement | null;
      if (inp) {
        inp.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = inp.value.trim();
            if (!v) return;
            const f = await addFolder(v);
            if (f) {
              activeFolder = f.id;
              renderLibrary();
            } else {
              inp.value = "";
            }
          }
        });
      }

      // "+" round button — prompt for folder name (works on both mobile and desktop)
      const addBtn = el.querySelector("#libAddFolderBtn") as HTMLButtonElement | null;
      addBtn?.addEventListener("click", async () => {
        const placeholder = currentLang === "en" ? "Folder name" : "Название папки";
        const v = window.prompt(placeholder, "");
        if (!v || !v.trim()) return;
        const f = await addFolder(v.trim());
        if (f) { activeFolder = f.id; renderLibrary(); }
      });
    }

    function renderLibraryWords() {
      const el = document.getElementById("libWords");
      if (!el) return;

      // Update section header to active folder's name or default
      const titleEl = document.getElementById("libWordsTitle");
      if (titleEl) {
        if (activeFolder === "__all__") {
          titleEl.textContent = currentLang === "en" ? "Recent words" : "Недавние слова";
        } else {
          const folder = foldersList.find((f) => f.id === activeFolder);
          titleEl.textContent = folder ? folder.name : (currentLang === "en" ? "Recent words" : "Недавние слова");
        }
      }

      const baseWords =
        activeFolder === "__all__"
          ? wordsList.slice()
          : wordsList.filter((w) => w.folder_id === activeFolder);
      
      // Filter words by date range
      let words = baseWords.filter((w) => inDateRange(w.created_at, libFilterFrom, libFilterTo));
      const hasFilter = !!(libFilterFrom || libFilterTo);

      // Filter words by search query
      if (librarySearchQuery.trim()) {
        const q = librarySearchQuery.toLowerCase().trim();
        words = words.filter((w) => {
          const wordMatch = w.word && w.word.toLowerCase().includes(q);
          const b = w.breakdown || {};
          let translation = b.translation || "";
          if (typeof translation === "object") translation = translation.main || "";
          const transMatch = String(translation).toLowerCase().includes(q);
          return wordMatch || transMatch;
        });
      }

      // Sort words by alphabetical or date order
      if (libSortType === "alpha") {
        words.sort((a, b) => a.word.localeCompare(b.word));
      } else {
        words.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      }

      // Inject action buttons into the page header
      const libHeader = document.getElementById("libPageHeader");
      if (libHeader) {
        libHeader.innerHTML = `
          <div class="lib-actions-wrap" id="libActionsWrap" style="display: flex; gap: 12px; align-items: center; position: relative;">
            <button class="lib-action-btn ${hasFilter ? "active" : ""}" id="libFilterBtn" title="${escapeHtml(currentLang === "en" ? "Filter by date" : "Фильтр по дате")}">
              <span class="material-symbols-outlined" style="font-size: 20px;">filter_list</span>
            </button>
            <button class="lib-action-btn ${libSortType === "alpha" ? "active" : ""}" id="libSortBtn" title="${escapeHtml(currentLang === "en" ? "Sort alphabetically" : "Сортировка по алфавиту")}">
              <span class="material-symbols-outlined" style="font-size: 20px;">sort_by_alpha</span>
            </button>
          </div>`;
      }

      const attachFilter = () => {
        const wrap = document.getElementById("libActionsWrap") as HTMLElement | null;
        const filterBtn = document.getElementById("libFilterBtn") as HTMLButtonElement | null;
        const sortBtn = document.getElementById("libSortBtn") as HTMLButtonElement | null;

        if (sortBtn) {
          sortBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            libSortType = libSortType === "alpha" ? "date" : "alpha";
            renderLibraryWords();
          });
        }

        if (filterBtn && wrap) {
          filterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            let panel = wrap.querySelector(".dfb-panel") as HTMLElement | null;
            if (panel) { panel.remove(); filterBtn.classList.remove("active"); return; }
            const lblFrom2 = currentLang === "en" ? "from" : "с";
            const lblTo2 = currentLang === "en" ? "to" : "по";
            const lblReset2 = currentLang === "en" ? "Reset" : "Сбросить";
            panel = document.createElement("div");
            panel.className = "dfb-panel";
            panel.innerHTML = `
              <label class="dfb-field"><span>${escapeHtml(lblFrom2)}</span><input type="date" id="libMobileFrom" value="${escapeHtml(libFilterFrom)}" /></label>
              <label class="dfb-field"><span>${escapeHtml(lblTo2)}</span><input type="date" id="libMobileTo" value="${escapeHtml(libFilterTo)}" /></label>
              <button class="dfb-reset" id="libMobileReset" ${hasFilter ? "" : "disabled"}>${escapeHtml(lblReset2)}</button>
            `;
            wrap.appendChild(panel);
            filterBtn.classList.add("active");
            panel.querySelector("#libMobileFrom")?.addEventListener("change", (ev) => { libFilterFrom = (ev.target as HTMLInputElement).value; renderLibraryWords(); });
            panel.querySelector("#libMobileTo")?.addEventListener("change", (ev) => { libFilterTo = (ev.target as HTMLInputElement).value; renderLibraryWords(); });
            panel.querySelector("#libMobileReset")?.addEventListener("click", () => { libFilterFrom = ""; libFilterTo = ""; renderLibraryWords(); });
          });
          
          // Close panel on outside click
          setTimeout(() => {
            document.addEventListener("click", function closePanelLib(e2) {
              if (wrap && !wrap.contains(e2.target as Node)) {
                wrap.querySelector(".dfb-panel")?.remove();
                filterBtn.classList.remove("active");
                document.removeEventListener("click", closePanelLib);
              }
            });
          }, 0);
        }
      };

      if (!words.length) {
        const isEmpty = baseWords.length === 0;
        const noPeriod = currentLang === "en" ? "No words in this period" : "Нет слов за этот период";
        const noResults = currentLang === "en" ? "No results found" : "Ничего не найдено";
        const noResultsSub = currentLang === "en" ? "Try checking the spelling or query" : "Попробуй изменить поисковый запрос";
        
        let emptyTitle = (isEmpty ? t("empty.libAll.title") : t("empty.libFolder.title"));
        let emptySub = (isEmpty ? t("empty.libAll.sub") : t("empty.libFolder.sub"));
        
        if (librarySearchQuery.trim()) {
          emptyTitle = noResults;
          emptySub = noResultsSub;
        } else if (hasFilter && !isEmpty) {
          emptyTitle = noPeriod;
          emptySub = "";
        }

        el.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📖</div>
            <div class="empty-title">${escapeHtml(emptyTitle)}</div>
            <div class="empty-sub">${escapeHtml(emptySub)}</div>
          </div>`;
        attachFilter();
        return;
      }

      el.innerHTML = words
        .map((w) => {
          const b = w.breakdown || {};
          const light = b._light || null;
          const full = b.breakdown || null;

          const translation = getTranslationFromBreakdown(b);

          const folder = foldersList.find((f) => f.id === w.folder_id);
          const folderName = folder ? folder.name : "";

          return `
            <div class="word-card glass-card" data-id="${escapeHtml(w.id)}">
              <div class="wc-head">
                <button class="wc-trash" data-trash="${escapeHtml(w.id)}" title="Удалить"><span class="material-symbols-outlined" style="font-size:14px;">close</span></button>
                <button class="wc-chevron" data-chevron aria-label="Toggle">
                  <span class="material-symbols-outlined" style="font-size:16px;">expand_more</span>
                </button>
                <div class="wc-word-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 56px;">
                  <div class="wc-word">${escapeHtml(w.word)}</div>
                  ${folderName ? `<span class="wc-folder-badge" style="display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.45); color: var(--ll-on-surface-variant); border: 1px solid rgba(255, 255, 255, 0.7); text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(folderName)}</span>` : ""}
                  <button class="sound-btn" data-text="${escapeHtml(w.word)}" title="${escapeHtml(currentLang === "en" ? "Listen" : "Прослушать")}" style="background: transparent; border: none; cursor: pointer; color: var(--ll-outline); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: all 0.2s ease;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
                  </button>
                </div>
                ${translation ? `<div class="wc-translation">${escapeHtml(translation)}</div>` : ""}
                <div class="wc-meta">
                  <span class="wc-date">${escapeHtml(fmtDate(w.created_at))}</span>
                </div>
              </div>
              <div class="wc-detail"><div class="wc-detail-inner" data-detail-for="${escapeHtml(w.id)}"></div></div>
            </div>
          `;
        })
        .join("");
      attachFilter();

      el.querySelectorAll(".wc-trash").forEach((b) => {
        b.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = (b as HTMLElement).getAttribute("data-trash") || "";
          await removeWordById(id);
          renderLibrary();
          renderSaveRow();
        });
      });
      
      el.querySelectorAll(".word-card").forEach((c) => {
        c.addEventListener("click", (e) => {
          const tgt = e.target as HTMLElement;
          if (tgt.closest(".wc-trash")) return;
          if (tgt.closest(".sound-btn")) return;
          // Don't collapse the card when interacting with its expanded content
          if (tgt.closest(".wc-detail")) return;

          const sBar = document.getElementById("appBarSearch");
          if (sBar && sBar.classList.contains("expanded")) {
            const id = c.getAttribute("data-id");
            if (id) {
              cardIdToOpenAfterRender = id;
            }
            collapseSearchBar();
            return;
          }

          const id = c.getAttribute("data-id") || "";
          const isOpen = c.classList.contains("open");
          el.querySelectorAll(".word-card.open").forEach((o) => {
            if (o !== c) {
              o.classList.remove("open");
              const inner = o.querySelector(".wc-detail-inner");
              if (inner) inner.innerHTML = "";
            }
          });
          if (isOpen) {
            c.classList.remove("open");
            const inner = c.querySelector(".wc-detail-inner");
            if (inner) inner.innerHTML = "";
            return;
          }
          const saved = wordsList.find((x) => x.id === id);
          if (!saved || !saved.breakdown) return;
          const obj = saved.breakdown;
          const inner = c.querySelector(".wc-detail-inner") as HTMLElement;
          inner.innerHTML = renderUnifiedBreakdown(obj);
          attachWidgetToggles(inner);
          attachTabListeners(inner, obj);
          attachChips(inner);
          c.classList.add("open");
        });
      });

      // Click simulation for restoring clicked card after search collapse
      if (cardIdToOpenAfterRender) {
        const targetCard = el.querySelector(`.word-card[data-id="${cardIdToOpenAfterRender}"]`) as HTMLElement | null;
        if (targetCard) {
          cardIdToOpenAfterRender = null;
          targetCard.click();
        }
      }
    }


    function renderLibrary() {
      renderLibraryFolders();
      renderLibraryWords();
    }

    async function refreshCloudAndRender() {
      await loadCloudData();
      if (document.getElementById("page-library")?.classList.contains("active")) renderLibrary();
      if (document.getElementById("page-history")?.classList.contains("active")) renderHistory();
      renderSaveRow();
    }

    function expandSearchBar() {
      const searchBar = document.getElementById("appBarSearch");
      const searchInput = document.getElementById("appBarSearchInput") as HTMLInputElement | null;
      if (searchBar) {
        searchBar.classList.add("expanded");
      }
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }

    function collapseSearchBar() {
      const searchBar = document.getElementById("appBarSearch");
      const searchInput = document.getElementById("appBarSearchInput") as HTMLInputElement | null;
      if (searchBar) {
        searchBar.classList.remove("expanded");
      }
      if (searchInput) {
        searchInput.value = "";
        searchInput.blur();
      }
      librarySearchQuery = "";
      historySearchQuery = "";
      
      const isLibActive = document.getElementById("page-library")?.classList.contains("active");
      const isHistActive = document.getElementById("page-history")?.classList.contains("active");
      if (isLibActive) renderLibraryWords();
      if (isHistActive) renderHistory();
    }

    function switchPage(name: string) {
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      const pg = document.getElementById("page-" + name);
      if (pg) pg.classList.add("active");
      document.querySelectorAll(".side-item").forEach((tEl) => {
        tEl.classList.toggle("active", tEl.getAttribute("data-page") === name);
      });
      document.body.classList.toggle("lib-page", name === "library");
      document.body.classList.toggle("page-breakdown", name === "breakdown");

      // Update app-bar search visibility
      const searchBar = document.getElementById("appBarSearch");
      if (searchBar) {
        if (name === "library" || name === "history") {
          searchBar.style.display = "flex";
        } else {
          searchBar.style.display = "none";
          if (searchBar.classList.contains("expanded")) {
            collapseSearchBar();
          }
        }
      }

      if (name === "library") renderLibrary();
      if (name === "history") renderHistory();
      if (name === "breakdown") setTimeout(() => input!.focus(), 100);
      document.getElementById("sidebar")!.classList.remove("open");
      document.getElementById("sidebarBackdrop")!.classList.remove("open");
      document.body.classList.remove("sidebar-open");
    }
    document.querySelectorAll(".side-item").forEach((tEl) => {
      tEl.addEventListener("click", () => {
        const p = tEl.getAttribute("data-page");
        if (p) switchPage(p);
      });
    });
    document.body.classList.add("page-breakdown");
    document.getElementById("menuTrigger")!.addEventListener("click", () => {
      const open = document.getElementById("sidebar")!.classList.toggle("open");
      document.getElementById("sidebarBackdrop")!.classList.toggle("open");
      document.body.classList.toggle("sidebar-open", open);
    });
    document.getElementById("sidebarBackdrop")!.addEventListener("click", () => {
      document.getElementById("sidebar")!.classList.remove("open");
      document.getElementById("sidebarBackdrop")!.classList.remove("open");
      document.body.classList.remove("sidebar-open");
    });

    // Wire up Animated Search Bar event listeners
    const searchBar = document.getElementById("appBarSearch");
    const searchInput = document.getElementById("appBarSearchInput") as HTMLInputElement | null;
    
    if (searchBar) {
      searchBar.addEventListener("click", (e) => {
        if (!searchBar.classList.contains("expanded")) {
          e.stopPropagation();
          expandSearchBar();
        }
      });
    }
    
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const val = (e.target as HTMLInputElement).value;
        const isLibActive = document.getElementById("page-library")?.classList.contains("active");
        const isHistActive = document.getElementById("page-history")?.classList.contains("active");
        
        if (isLibActive) {
          librarySearchQuery = val;
          renderLibraryWords();
        } else if (isHistActive) {
          historySearchQuery = val;
          renderHistory();
        }
      });
      
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          collapseSearchBar();
        }
      });
    }

    const onDocClickCloseSearch = (e: MouseEvent) => {
      const sBar = document.getElementById("appBarSearch");
      if (!sBar || !sBar.classList.contains("expanded")) return;
      const target = e.target as HTMLElement;
      if (!sBar.contains(target)) {
        collapseSearchBar();
      }
    };
    document.addEventListener("click", onDocClickCloseSearch);

    document.getElementById("langToggle")?.addEventListener("click", () => {
      currentLang = currentLang === "ru" ? "en" : "ru";
      store.lang = currentLang;
      saveStore(store);
      applyLang();
    });
    applyLang();

    let busy = false;

    async function fetchStream(
      payload: { input?: string; mode: "light" | "full" | "sentence"; canonical?: string; pos?: string; type?: string },
      onChunk: (text: string, isFinished: boolean) => void
    ): Promise<string> {
      const resp = await fetch("/api/ai-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        throw new Error(text || "AI breakdown error");
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onChunk(buf, true);
          break;
        }
        buf += decoder.decode(value, { stream: true });
        onChunk(buf, false);
      }
      return buf;
    }

    async function run() {
      const q = (input!.value || "").trim();
      const ctxEl = document.getElementById("contextInput") as HTMLInputElement | null;
      const ctx = (ctxEl?.value || "").trim();
      if (!q) {
        goBtn!.classList.remove("shake");
        void goBtn!.offsetWidth;
        goBtn!.classList.add("shake");
        input!.focus();
        return;
      }
      if (busy) return;
      busy = true;
      goBtn!.disabled = true;
      
      let lightData: any = null;

      loading!.style.display = "none";
      // Show tabs skeleton inside wrapped card
      results!.innerHTML = wrapHtmlInWordCard(`<div class="breakdown-wrap wc-loading" data-word-json="">${renderPillBreakdown(null, true)}</div>`, null, q, true);
      searchWrap!.classList.add("compact");

      try {
        let activeTabSet = false;
        let finalData: any = null;

        await fetchStream({ input: q, mode: "light" }, (accumulated, isFinished) => {
          const cleaned = accumulated.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          let parsed = null;
          try {
            parsed = tryRepairJson(cleaned);
          } catch {}

          if (parsed && typeof parsed === "object") {
            // 1. Correction mode
            if (parsed.mode === "correction" || (parsed.message && parsed.suggestions)) {
              if (isFinished) {
                const suggestionsHtml = Array.isArray(parsed.suggestions) && parsed.suggestions.length
                  ? `
                    <div class="suggest-title" style="margin-top: 16px; font-weight: 600; color: var(--text-muted); font-size: 0.9rem;">Возможно, ты имел в виду:</div>
                    <div class="chips" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                      ${parsed.suggestions.map((s: string) => `<button class="chip" data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
                    </div>
                  `
                  : "";
                results!.innerHTML = `
                  <div class="correction-card fade-up">
                    <div class="correction-message">${parseMarkdown(parsed.message || "")}</div>
                    ${suggestionsHtml}
                  </div>
                `;
                attachChips();
                busy = false;
                goBtn!.disabled = false;
              }
              return;
            }

            // 2. Sentence mode (keep standard streaming flow for sentences)
            if (parsed.mode === "sentence") {
              if (isFinished) {
                parsed.sentence = parsed.sentence || q;
                results!.innerHTML = renderSentence(parsed, false);
                attachWidgetToggles(results!);
                attachChips();
                lastBreakdown = parsed;

                const mainTrans = parsed.translation?.main || "";
                addHistory({ word: q, translation: mainTrans, mode: "sentence" }, parsed).then(() => {
                  renderSaveRow();
                });
                busy = false;
                goBtn!.disabled = false;
              }
              return;
            }

            // 3. Standard Word Mode
            if (parsed.pillars && Array.isArray(parsed.pillars) && parsed.pillars.length > 0) {
              finalData = parsed;
              const wrap = results!.querySelector(".breakdown-wrap") as HTMLElement | null;
              if (wrap) {
                if (!activeTabSet) {
                  activeTab = parsed.pillars[0].key || "translation";
                  activeTabSet = true;
                }
                updatePillBreakdownDOM(wrap, parsed, !isFinished);
              }
            }
          }

          if (isFinished && finalData) {
            const { canonical } = finalData;
            if (canonical) {
              const trans = getTranslationFromBreakdown(finalData);
              lastLightData = finalData;
              lastBreakdown = finalData;

              const wrap = results!.querySelector(".breakdown-wrap") as HTMLElement | null;
              if (wrap) {
                updatePillBreakdownDOM(wrap, finalData, false);
              }

              // Only add if not already in history
              const alreadyInHistory = historyList.some(h => h.word.toLowerCase() === canonical.toLowerCase());
              if (!alreadyInHistory) {
                addHistory({ word: canonical, translation: trans, mode: "word" }, finalData).then(() => {
                  renderSaveRow();
                });
              } else {
                renderSaveRow();
              }
            }
            busy = false;
            goBtn!.disabled = false;
          }
        });
      } catch (err) {
        console.error("Word breakdown failed:", err);
        results!.innerHTML = `<div class="error">${escapeHtml(t("err.generic"))}</div>`;
      } finally {
        busy = false;
        goBtn!.disabled = false;
      }
    }

    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      run();
    };
    form.addEventListener("submit", onSubmit);

    // Expose breakdown trigger so the AI assistant can call it from the chat sidebar.
    const runFromAssistant = (q: string, ctx?: string) => {
      if (!q) return;
      input.value = q;
      const ctxEl = document.getElementById("contextInput") as HTMLInputElement | null;
      if (ctxEl) ctxEl.value = ctx || "";
      // Make sure we're on the breakdown page so #results is visible.
      const breakdownNav = document.querySelector<HTMLElement>('.side-item[data-page="breakdown"]');
      if (breakdownNav && !document.getElementById("page-breakdown")?.classList.contains("active")) {
        breakdownNav.click();
      }
      run();
    };
    (window as unknown as { __lnRunBreakdown?: (q: string, ctx?: string) => void }).__lnRunBreakdown =
      runFromAssistant;

    const resetBreakdown = () => {
      input.value = "";
      const ctxEl = document.getElementById("contextInput") as HTMLInputElement | null;
      if (ctxEl) ctxEl.value = "";
      results.innerHTML =
        `<div class="results-empty-hint">` +
        `<div class="reh-emoji">💬</div>` +
        `<div class="reh-title">Спросите ассистента справа</div>` +
        `<div class="reh-sub">Например: «разбери слово serendipity» или «разбери фразу на английском».</div>` +
        `</div>`;
    };
    (window as unknown as { __lnResetBreakdown?: () => void }).__lnResetBreakdown = resetBreakdown;

    // Render an empty-state hint on first load so the page isn't blank.
    if (!results.innerHTML.trim()) {
      results.innerHTML =
        `<div class="results-empty-hint">` +
        `<div class="reh-emoji">💬</div>` +
        `<div class="reh-title">Спросите ассистента справа</div>` +
        `<div class="reh-sub">Например: «разбери слово serendipity» или «разбери фразу на английском».</div>` +
        `</div>`;
    }

    // ===== Spell suggestions (Datamuse) =====
    const suggestBox = document.getElementById("suggestBox") as HTMLDivElement | null;
    let suggestTimer: ReturnType<typeof setTimeout> | null = null;
    let suggestSeq = 0;
    const closeSuggest = () => {
      if (suggestBox) {
        suggestBox.style.display = "none";
        suggestBox.innerHTML = "";
      }
    };
    const renderSuggest = (items: string[]) => {
      if (!suggestBox) return;
      if (!items.length) return closeSuggest();
      suggestBox.innerHTML =
        `<div class="suggest-title-row">Возможно, вы имели в виду:</div>` +
        items
          .map(
            (w) =>
              `<div class="suggest-item" data-w="${escapeHtml(w)}">${escapeHtml(w)}</div>`,
          )
          .join("");
      suggestBox.style.display = "block";
      suggestBox.querySelectorAll<HTMLDivElement>(".suggest-item").forEach((el) => {
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const w = el.getAttribute("data-w") || "";
          input!.value = w;
          closeSuggest();
          input!.focus();
        });
      });
    };
    const clearBtn = document.getElementById("inputClearBtn") as HTMLButtonElement | null;
    const updateClearBtn = () => {
      if (!clearBtn) return;
      clearBtn.style.display = (input!.value || "").length > 0 ? "" : "none";
    };
    updateClearBtn();
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        input!.value = "";
        updateClearBtn();
        closeSuggest();
        input!.focus();
      });
    }
    input.addEventListener("input", () => {
      updateClearBtn();
      const q = (input!.value || "").trim();
      if (suggestTimer) clearTimeout(suggestTimer);
      if (q.length < 3 || /\s/.test(q)) {
        closeSuggest();
        return;
      }
      const seq = ++suggestSeq;
      suggestTimer = setTimeout(async () => {
        try {
          const r = await fetch(
            `https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=5`,
          );
          if (!r.ok) return;
          const data: Array<{ word: string }> = await r.json();
          if (seq !== suggestSeq) return;
          if (!data.length) return closeSuggest();
          const top = data[0].word.toLowerCase();
          if (top === q.toLowerCase()) return closeSuggest();
          renderSuggest(data.map((d) => d.word));
        } catch {}
      }, 400);
    });
    document.addEventListener("mousedown", (e) => {
      const target = e.target as Node;
      if (suggestBox && !suggestBox.contains(target) && target !== input) {
        closeSuggest();
      }
    });
    input.addEventListener("focus", () => {
      // re-trigger on focus only if user has typed something new — leave closed by default
    });
    form.addEventListener("submit", () => closeSuggest());

    // ===== Context info tooltip =====
    const ctxBtn = document.getElementById("contextInfoBtn");
    const ctxTip = document.getElementById("contextTooltip");
    if (ctxBtn && ctxTip) {
      ctxBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        ctxTip.classList.toggle("show");
      });
      document.addEventListener("mousedown", (e) => {
        const t = e.target as Node;
        if (!ctxTip.contains(t) && t !== ctxBtn) ctxTip.classList.remove("show");
      });
    }


    // ===== Auth wiring =====
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, sess) => {
      const newUid = sess?.user?.id ?? null;
      if (newUid !== currentUserId) {
        currentUserId = newUid;
        activeFolder = "__all__";
        refreshCloudAndRender();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      currentUserId = data.session?.user?.id ?? null;
      refreshCloudAndRender();
    });

    return () => {
      form.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onDocClickClose);
      document.removeEventListener("click", onDocClickCloseSearch);
      authSub.subscription.unsubscribe();
      delete (window as unknown as { __lnRunBreakdown?: unknown }).__lnRunBreakdown;
      delete (window as unknown as { __lnResetBreakdown?: unknown }).__lnResetBreakdown;
    };
  }, []);

  return (
    <div className="ln">
      {/* ── Floating App Bar ── */}
      <div className="app-bar">
        <button className="menu-trigger glass-button" id="menuTrigger" aria-label="Меню" type="button">
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Animated Search Bar */}
        <div className="app-bar-search" id="appBarSearch" style={{ display: "none" }}>
          <input
            type="text"
            id="appBarSearchInput"
            placeholder="Поиск..."
            autoComplete="off"
            spellCheck={false}
          />
          <div className="search-icon" id="appBarSearchIcon">
            <span className="material-symbols-outlined">search</span>
          </div>
        </div>
      </div>

      {/* ── Navigation Drawer ── */}
      <aside className="sidebar glass-panel" id="sidebar">
        <nav>
          <button className="side-item active" data-page="breakdown" type="button">
            <span className="ic material-symbols-outlined">translate</span>
            <span data-i18n="nav.breakdown">Разбор слова</span>
          </button>
          <button className="side-item" data-page="library" type="button">
            <span className="ic material-symbols-outlined">book</span>
            <span data-i18n="nav.library">Мои слова</span>
          </button>
          <button className="side-item" data-page="history" type="button">
            <span className="ic material-symbols-outlined">history</span>
            <span data-i18n="nav.history">История</span>
          </button>
          <button className="side-item" data-page="top" type="button">
            <span className="ic material-symbols-outlined">workspace_premium</span>
            <span data-i18n="nav.top">Топ слов</span>
          </button>
        </nav>
        <div className="side-bottom">
          <button className="side-item" data-page="account" type="button">
            <span className="ic material-symbols-outlined">account_circle</span>
            <span data-i18n="nav.account">Аккаунт</span>
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" id="sidebarBackdrop"></div>

      <div className="wrap">
        {/* ── Spacer for fixed app bar ── */}
        <div className="header" />

        {/* ── Breakdown Page ── */}
        <div className="page active" id="page-breakdown">
          <div className="page-inner">
            <div className="search-wrap glass-input" id="searchWrap" style={{ display: "none" }} aria-hidden="true">
              <form className="search" id="searchForm" autoComplete="off">
                <input
                  id="input"
                  type="text"
                  placeholder="Введи слово или фразу…"
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <button
                  type="button"
                  id="inputClearBtn"
                  className="input-clear-btn"
                  aria-label="Очистить"
                  style={{ display: "none" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
                <button className="btn-go glass-button" id="goBtn" type="submit" aria-label="Разобрать">
                  <span className="material-symbols-outlined">send</span>
                </button>
              </form>
              <div id="suggestBox" className="suggest-box glass-card" style={{ display: "none" }}></div>
              <div className="context-field">
                <label htmlFor="contextInput" className="context-label">
                  Контекст
                  <button
                    type="button"
                    id="contextInfoBtn"
                    className="context-info-btn"
                    aria-label="Подсказка"
                  >
                    ⓘ
                  </button>
                  <span id="contextTooltip" className="context-tooltip" role="tooltip"></span>
                </label>
                <input
                  id="contextInput"
                  type="text"
                  className="context-input glass-input"
                  placeholder="Например: деловая переписка"
                  autoComplete="off"
                />
              </div>
            </div>

            <div id="loading" className="loading" style={{ display: "none" }}>
              <span style={{ color: "var(--ll-outline)", fontSize: 14 }}>Анализирую</span>
              <span className="dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>

            <div id="results" className="results"></div>
          </div>
        </div>

        {/* ── Library Page ── */}
        <div className="page" id="page-library">
          <div className="page-inner">
            <div className="lib-page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 className="section-label" style={{ margin: 0 }} data-i18n="lib.folders">Папки</h2>
            </div>
            <div className="library">
              <div className="lib-folders no-scrollbar" id="libFolders"></div>
              
              <div className="lib-words-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", marginBottom: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.15)", paddingTop: "20px" }}>
                <h2 className="section-label" id="libWordsTitle" style={{ margin: 0 }} data-i18n="lib.recentWords">Недавние слова</h2>
                <div id="libPageHeader"></div>
              </div>
              <div className="lib-words" id="libWords"></div>
            </div>
          </div>
        </div>

        {/* ── History Page ── */}
        <div className="page" id="page-history">
          <div className="page-inner">
            <div className="hist-page-header" id="histPageHeader"></div>
            <div id="historyList"></div>
          </div>
        </div>

        {/* ── Top Page ── */}
        <div className="page" id="page-top">
          <div className="page-inner">
            <div className="empty-state">
              <div className="empty-icon">✦</div>
              <div className="empty-title" id="topEmptyT">Скоро здесь появятся подборки слов</div>
              <div className="empty-sub" id="topEmptyS">Следи за обновлениями.</div>
            </div>
          </div>
        </div>

        {/* ── Account Page ── */}
        <div className="page" id="page-account">
          <div className="page-inner" style={{ paddingTop: 24 }}>
            <div className="account-card glass-card fade-up" style={{ padding: "40px 32px" }}>
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm mx-auto mb-6">
                <span className="material-symbols-outlined" style={{ fontSize: 42, fontVariationSettings: "'FILL' 1" }}>
                  account_circle
                </span>
              </div>
              <AuthPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const goHome = () => {
    const btn = document.querySelector<HTMLButtonElement>('.side-item[data-page="breakdown"]');
    btn?.click();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setInfo("Проверь почту — мы отправили письмо для подтверждения.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    goHome();
  };

  if (!ready) return null;

  if (session) {
    return (
      <div className="profile-info">
        <div className="profile-email">
          {session.user.email}
        </div>
        <div className="profile-sub">
          Вы вошли в свой аккаунт
        </div>
        <button className="auth-logout-btn" onClick={onLogout} style={{ cursor: "pointer" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          Выйти
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="auth-toggle-group">
        <button
          type="button"
          className={`auth-toggle-btn ${mode === "login" ? "active" : ""}`}
          onClick={() => { setMode("login"); setError(null); setInfo(null); }}
        >
          Вход
        </button>
        <button
          type="button"
          className={`auth-toggle-btn ${mode === "signup" ? "active" : ""}`}
          onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
        >
          Регистрация
        </button>
      </div>

      <div className="auth-input-group">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
          autoComplete="email"
        />
      </div>

      <div className="auth-input-group">
        <input
          type="password"
          required
          minLength={6}
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>

      {error && <div className="auth-error">{error}</div>}
      {info && <div className="auth-info">{info}</div>}

      <button type="submit" disabled={busy} className="auth-submit-btn" style={{ cursor: busy ? "wait" : "pointer" }}>
        {busy ? (
          <span className="mt-spin" style={{ width: 14, height: 14 }}></span>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {mode === "login" ? "login" : "person_add"}
            </span>
            {mode === "login" ? "Войти" : "Зарегистрироваться"}
          </>
        )}
      </button>
    </form>
  );
}
