import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,wght@0,500;0,600;0,700;1,500;1,600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    document.body.classList.add("ln-body");
    return () => {
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
      if (obj.word) html += `<div class="word fade-up">${escapeHtml(obj.word)}</div>`;
      if (obj.level || obj.frequency) {
        html += `<div class="badges fade-up" style="animation-delay:.05s">`;
        if (obj.level) html += `<span class="badge cefr">${escapeHtml(obj.level)}</span>`;
        if (obj.frequency) html += `<span class="badge freq">${escapeHtml(obj.frequency)}</span>`;
        html += `</div>`;
      }
      return html;
    }

    function widgetHtml(icon: string, title: string, content: string, opensFirst: boolean, delay: number) {
      return `
        <div class="widget ${opensFirst ? "open" : ""}" style="animation-delay:${delay}ms">
          <div class="widget-head" data-toggle>
            <span class="widget-icon">${icon}</span>
            <span class="widget-title">${title}</span>
            <span class="widget-chevron">▾</span>
          </div>
          <div class="widget-body">
            <div class="widget-content">${content}</div>
          </div>
        </div>`;
    }

    function renderExamples(examples: any[]): string {
      if (!Array.isArray(examples) || !examples.length) return "";
      return (
        `<div class="ex-list">` +
        examples
          .map(
            (e: any) =>
              `<div class="ex-item"><div class="ex-en">${escapeHtml(e?.en || "")}</div><div class="ex-ru">${escapeHtml(e?.ru || "")}</div></div>`,
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
                      `<div class="coll-row"><span class="coll-phrase">${escapeHtml(it?.phrase || "")}</span><span class="coll-tr">${escapeHtml(it?.translation || "")}</span></div>`,
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
                <span class="ctx-title">${escapeHtml(s?.word || "")}</span>
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
                <div class="ex-en"><span class="ctx-freq">${escapeHtml(p?.frequency || "")}</span> ${escapeHtml(p?.phrase || "")}</div>
                <div class="ex-ru">${escapeHtml(p?.translation || "")}${p?.note ? ` <span class="ph-note">(${escapeHtml(p.note)})</span>` : ""}</div>
              </div>
            `,
          )
          .join("") +
        `</div>`
      );
    }

    function renderStage2(obj: any, variant: "full" | "light" = "full") {
      const isLight = variant === "light";
      // Full: всё закрыто. Light: всё открыто, кроме «Синонимы».
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

    function renderSentence(obj: any) {
      const highlights = Array.isArray(obj.highlights) ? obj.highlights : [];
      const items = highlights
        .map(
          (h: any) =>
            `<div class="sent-hl-item"><span class="sent-hl-arrow">→</span> <span class="sent-hl-item-name">${escapeHtml(h?.item || "")}</span>${h?.why ? ` — <span class="sent-hl-why">${escapeHtml(h.why)}</span>` : ""}</div>`,
        )
        .join("");
      return `
        <div class="sentence-card fade-up">
          <div class="sent-original">📝 <em>${escapeHtml(obj.sentence || "")}</em></div>
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

    function renderLight(data: any): string {
      // Legacy: stored as plain text string
      if (typeof data === "string") {
        if (!data.trim()) return "";
        return `<div class="light-block">${escapeHtml(data)}</div>`;
      }
      // New: JSON object with same schema as Full → render with same components
      if (data && typeof data === "object") {
        if (data.error) return `<div class="error">${escapeHtml(data.error)}</div>`;
        return `<div data-stage1>${renderStage1(data)}</div>${renderStage2(data, "light")}`;
      }
      return "";
    }

    function renderModeShell(obj: any, lightData: any, fullReady: boolean): string {
      const hasLight = lightData && (typeof lightData === "string" ? lightData.trim() : true);
      const lightHtml = hasLight
        ? renderLight(lightData)
        : `<div class="light-block" style="color:var(--text-muted);">…</div>`;
      const fullHtml =
        fullReady && obj
          ? `<div data-stage1>${renderStage1(obj)}</div>${renderStage2(obj)}`
          : "";
      const fullDisabled = !fullReady;
      return `
        <div class="mode-tabs">
          <button class="mode-tab active" data-mt="light" type="button">Light</button>
          <button class="mode-tab" data-mt="full" type="button"${fullDisabled ? " disabled" : ""}>
            <span>Full</span>${fullDisabled ? '<span class="mt-spin" aria-hidden="true"></span>' : ""}
          </button>
        </div>
        <div class="mode-pane" data-pane="light">${lightHtml}</div>
        <div class="mode-pane" data-pane="full" hidden>${fullHtml}</div>
      `;
    }

    function attachModeTabs(root: HTMLElement) {
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(":scope > .mode-tabs .mode-tab"));
      tabs.forEach((tab) => {
        tab.addEventListener("click", (e) => {
          e.stopPropagation();
          if (tab.disabled) return;
          const mode = tab.getAttribute("data-mt");
          tabs.forEach((x) => x.classList.toggle("active", x === tab));
          root.querySelectorAll<HTMLElement>(":scope > .mode-pane").forEach((p) => {
            p.hidden = p.getAttribute("data-pane") !== mode;
          });
        });
      });
    }

    function attachWidgetToggles(root?: HTMLElement) {
      (root || results)!.querySelectorAll("[data-toggle]").forEach((h) => {
        const el = h as HTMLElement & { __bound?: boolean };
        if (el.__bound) return;
        el.__bound = true;
        el.addEventListener("click", () => {
          el.parentElement?.classList.toggle("open");
        });
      });
    }
    function attachChips() {
      results!.querySelectorAll(".chip").forEach((c) => {
        c.addEventListener("click", () => {
          const w = c.getAttribute("data-word") || "";
          results!.classList.add("fade-out");
          setTimeout(() => {
            input!.value = w;
            results!.classList.remove("fade-out");
            run();
          }, 220);
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
      return { history: [], lang: "ru" };
    }
    function saveStore(s: any) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ history: s.history, lang: s.lang }));
      } catch {}
    }
    const store: any = loadStore();
    if (!Array.isArray(store.history)) store.history = [];
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
        foldersList = [];
        wordsList = [];
        historyList = (store.history || []).map((h: any, i: number) => ({
          id: "local-" + i,
          word: h.word,
          translation: h.translation || "",
          mode: h.mode || "word",
          breakdown: h.breakdown || null,
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

      const filtered = historyList.filter((h) => inDateRange(h.updated_at, histFilterFrom, histFilterTo));
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
        el.innerHTML = `
          <div class="empty-state" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;">
            <div class="empty-title">${escapeHtml(noPeriod)}</div>
          </div>`;
        attachHistFilter();
        return;
      }
      el.innerHTML = `<div class="lib-words">${filtered
        .map((h) => {
          const b = h.breakdown || {};
          const cefr = b.level
            ? `<span class="badge cefr">${escapeHtml(b.level)}</span>`
            : "";
          return `
            <div class="word-card" data-hid="${escapeHtml(h.id)}">
              <div class="wc-head">
                <button class="wc-trash" data-htrash="${escapeHtml(h.id)}" title="Удалить из истории">✕</button>
                <button class="wc-chevron" data-chevron aria-label="Toggle">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"></polyline></svg>
                </button>
                <div class="wc-word">${escapeHtml(h.word)}</div>
                ${h.translation ? `<div class="wc-translation">${escapeHtml(h.translation)}</div>` : ""}
                <div class="wc-meta">
                  ${cefr}
                  <span class="wc-date">${escapeHtml(fmtDateTime(h.updated_at))}</span>
                </div>
              </div>
              <div class="wc-detail"><div class="wc-detail-inner"></div></div>
            </div>`;
        })
        .join("")}</div>`;
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
          if (tgt.closest(".wc-detail")) return;
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
          let html = "";
          if (obj.mode === "context") html = renderContext(obj);
          else if (obj.mode === "sentence") html = renderSentence(obj);
          else if (obj.mode === "ru-map") html = renderRuMap(obj);
          else if (obj._light) html = renderModeShell(obj, obj._light, true);
          else html = `<div data-stage1>${renderStage1(obj)}</div>` + renderStage2(obj);
          inner.innerHTML = html;
          if (obj.word) {
            const row = document.createElement("div");
            row.className = "save-row";
            row.style.marginTop = "16px";
            if (!currentUserId) {
              row.innerHTML = `<div class="saved-folder-note">${escapeHtml(currentLang === "en" ? "Sign in to save" : "Войди, чтобы сохранять слова")}</div>`;
            } else {
              const saved = findSavedByWord(obj.word);
              if (saved) {
                row.innerHTML = `<div class="saved-folder-note">${escapeHtml(currentLang === "en" ? "Saved to:" : "Сохранено в:")} <span class="sf-name">${escapeHtml(saved.folderName)}</span></div>`;
              } else {
                row.innerHTML = `<button class="btn-save">${escapeHtml(t("save.btn"))}</button>`;
                row.querySelector("button")!.addEventListener("click", (ev) => {
                  ev.stopPropagation();
                  openFolderPickerFor(row, obj);
                });
              }
            }
            inner.appendChild(row);
          }
          attachWidgetToggles(inner);
          if (obj._light) attachModeTabs(inner);
          c.classList.add("open");
        });
      });
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
      name = (name || "").trim();
      if (!name || !currentUserId) return null;
      const existing = foldersList.find((f) => f.name === name);
      if (existing) return existing;
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
      await supabase.from("folders").delete().eq("id", id);
      foldersList = foldersList.filter((f) => f.id !== id);
      wordsList = wordsList.filter((w) => w.folder_id !== id);
    }
    async function addWordToFolder(folderId: string, word: string, breakdown: any) {
      if (!currentUserId) return null;
      const existing = wordsList.find((w) => w.folder_id === folderId && w.word === word);
      if (existing) {
        const { data } = await supabase
          .from("words")
          .update({ breakdown: JSON.stringify(breakdown) })
          .eq("id", existing.id)
          .select("id,folder_id,word,breakdown,created_at")
          .single();
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
      if (error || !data) return null;
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
      await supabase.from("words").delete().eq("id", id);
      wordsList = wordsList.filter((w) => w.id !== id);
    }
    function findSavedByWord(word: string): (WordRow & { folderName: string }) | null {
      const w = wordsList.find((x) => x.word === word);
      if (!w) return null;
      const f = foldersList.find((f) => f.id === w.folder_id);
      return { ...w, folderName: f?.name || "" };
    }

    let lastBreakdown: any = null;

    function renderSaveRow() {
      const existing = results!.querySelector(".save-row");
      if (existing) existing.remove();
      if (!lastBreakdown) return;
      const word = lastBreakdown.word;
      const row = document.createElement("div");
      row.className = "save-row fade-up";
      row.style.animationDelay = ".4s";

      if (!currentUserId) {
        row.innerHTML = `<div class="saved-folder-note">${escapeHtml(currentLang === "en" ? "Sign in to save" : "Войди, чтобы сохранять слова")}</div>`;
        results!.appendChild(row);
        return;
      }

      const savedEntry = findSavedByWord(word);
      if (savedEntry) {
        row.innerHTML = `<div class="saved-folder-note">${escapeHtml(currentLang === "en" ? "Saved to:" : "Сохранено в:")} <span class="sf-name">${escapeHtml(savedEntry.folderName)}</span></div>`;
        results!.appendChild(row);
        return;
      }

      row.innerHTML = `<button class="btn-save" id="saveBtn">${escapeHtml(t("save.btn"))}</button>`;
      results!.appendChild(row);
      row.querySelector("#saveBtn")!.addEventListener("click", (e) => {
        e.stopPropagation();
        openFolderPicker(row);
      });
    }

    function openFolderPicker(row: HTMLElement) {
      closeFolderPicker();
      const pop = document.createElement("div");
      pop.className = "folder-pop";
      pop.innerHTML = `
        <div class="folder-pop-title">${escapeHtml(t("save.title"))}</div>
        <div class="folder-pop-list" style="max-height:280px;overflow-y:auto;">
          ${
            foldersList.length
              ? foldersList
                  .map(
                    (f) =>
                      `<div class="folder-pop-item" data-folder-id="${escapeHtml(f.id)}"><span class="ic">📁</span><span>${escapeHtml(f.name)}</span></div>`,
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

    function openFolderPickerFor(row: HTMLElement, breakdown: any) {
      lastBreakdown = breakdown;
      openFolderPicker(row);
    }

    async function saveCurrentToFolder(folderId: string) {
      if (!lastBreakdown || !currentUserId) return;
      const b = lastBreakdown;
      await addWordToFolder(folderId, b.word, b);
      closeFolderPicker();
      renderSaveRow();
      renderLibrary();
      if (document.getElementById("page-history")?.classList.contains("active")) renderHistory();
    }

    let activeFolder = "__all__"; // "__all__" or folder.id
    let libFilterFrom = "";
    let libFilterTo = "";
    let histFilterFrom = "";
    let histFilterTo = "";

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
      if (!currentUserId) {
        el.innerHTML = `<div class="saved-folder-note" style="padding:14px;">${escapeHtml(currentLang === "en" ? "Sign in to view your folders" : "Войди, чтобы увидеть свои папки")}</div>`;
        return;
      }
      let html = "";
      // "All words" tab — always first, never deletable
      html += `<button class="lib-folder lib-folder--all ${activeFolder === "__all__" ? "active" : ""}" data-folder="__all__">
        <span class="ic">✶</span><span class="nm">${escapeHtml(t("lib.all"))}</span><span class="ct">${folderCount("__all__")}</span>
      </button>`;
      if (foldersList.length) {
        for (const f of foldersList) {
          html += `<button class="lib-folder ${activeFolder === f.id ? "active" : ""}" data-folder="${escapeHtml(f.id)}" data-user="1">
            <span class="ic">📁</span><span class="nm">${escapeHtml(f.name)}</span><span class="ct">${folderCount(f.id)}</span><span class="folder-del" data-del="${escapeHtml(f.id)}" title="">✕</span>
          </button>`;
        }
      }
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
      if (!currentUserId) {
        el.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔒</div>
            <div class="empty-title">${escapeHtml(currentLang === "en" ? "Sign in to see your words" : "Войди, чтобы увидеть свои слова")}</div>
            <div class="empty-sub">${escapeHtml(currentLang === "en" ? "Your saved words will appear here." : "Твои сохранённые слова появятся здесь.")}</div>
          </div>`;
        return;
      }
      const baseWords =
        activeFolder === "__all__"
          ? wordsList.slice()
          : wordsList.filter((w) => w.folder_id === activeFolder);
      const words = baseWords.filter((w) => inDateRange(w.created_at, libFilterFrom, libFilterTo));
      const hasFilter = !!(libFilterFrom || libFilterTo);

      // Inject round filter button into the page header (top-right of folders row)
      const libHeader = document.getElementById("libPageHeader");
      if (libHeader) {
        libHeader.innerHTML = `
          <div class="dfb-mobile-wrap lib-filter-wrap" id="libFilterMobileWrap" style="display:flex;">
            <button class="dfb-mobile-btn ${hasFilter ? "active" : ""}" id="libFilterMobileBtn" title="${escapeHtml(currentLang === "en" ? "Filter by date" : "Фильтр по дате")}">⚙︎</button>
          </div>`;
      }

      const attachFilter = () => {
        // Round filter button toggle (in the page header)
        const mobileWrap = document.getElementById("libFilterMobileWrap") as HTMLElement | null;
        const mobileBtn = document.getElementById("libFilterMobileBtn") as HTMLButtonElement | null;
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
              <label class="dfb-field"><span>${escapeHtml(lblFrom2)}</span><input type="date" id="libMobileFrom" value="${escapeHtml(libFilterFrom)}" /></label>
              <label class="dfb-field"><span>${escapeHtml(lblTo2)}</span><input type="date" id="libMobileTo" value="${escapeHtml(libFilterTo)}" /></label>
              <button class="dfb-reset" id="libMobileReset" ${hasFilter ? "" : "disabled"}>${escapeHtml(lblReset2)}</button>
            `;
            mobileWrap.appendChild(panel);
            mobileBtn.classList.add("active");
            panel.querySelector("#libMobileFrom")?.addEventListener("change", (ev) => { libFilterFrom = (ev.target as HTMLInputElement).value; renderLibraryWords(); });
            panel.querySelector("#libMobileTo")?.addEventListener("change", (ev) => { libFilterTo = (ev.target as HTMLInputElement).value; renderLibraryWords(); });
            panel.querySelector("#libMobileReset")?.addEventListener("click", () => { libFilterFrom = ""; libFilterTo = ""; renderLibraryWords(); });
          });
          // Close panel on outside click
          setTimeout(() => {
            document.addEventListener("click", function closePanelLib(e2) {
              if (!mobileWrap.contains(e2.target as Node)) {
                mobileWrap.querySelector(".dfb-panel")?.remove();
                mobileBtn.classList.remove("active");
                document.removeEventListener("click", closePanelLib);
              }
            });
          }, 0);
        }
      };

      if (!words.length) {
        const isEmpty = baseWords.length === 0;
        const noPeriod = currentLang === "en" ? "No words in this period" : "Нет слов за этот период";
        el.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📖</div>
            <div class="empty-title">${escapeHtml(hasFilter && !isEmpty ? noPeriod : (isEmpty ? t("empty.libAll.title") : t("empty.libFolder.title")))}</div>
            <div class="empty-sub">${escapeHtml(hasFilter && !isEmpty ? "" : (isEmpty ? t("empty.libAll.sub") : t("empty.libFolder.sub")))}</div>
          </div>`;
        attachFilter();
        return;
      }

      el.innerHTML = words
        .map((w) => {
          const b = w.breakdown || {};
          const firstCtx = (b.contexts && b.contexts[0]) || {};
          const firstEx = (firstCtx.examples && firstCtx.examples[0]) || {};
          const translation = firstCtx.title || firstEx.ru || "";
          const cefr = b.level
            ? `<span class="badge cefr">${escapeHtml(b.level)}</span>`
            : "";
          return `
            <div class="word-card" data-id="${escapeHtml(w.id)}">
              <div class="wc-head">
                <button class="wc-trash" data-trash="${escapeHtml(w.id)}" title="Удалить">✕</button>
                <button class="wc-chevron" data-chevron aria-label="Toggle">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"></polyline></svg>
                </button>
                <div class="wc-word">${escapeHtml(w.word)}</div>
                ${translation ? `<div class="wc-translation">${escapeHtml(translation)}</div>` : ""}
                <div class="wc-meta">
                  ${cefr}
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
          // Don't collapse the card when interacting with its expanded content
          if (tgt.closest(".wc-detail")) return;
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
          if (obj.mode === "context") {
            inner.innerHTML = renderContext(obj);
          } else if (obj._light) {
            inner.innerHTML = renderModeShell(obj, obj._light, true);
          } else {
            inner.innerHTML = `<div data-stage1>${renderStage1(obj)}</div>` + renderStage2(obj);
          }
          attachWidgetToggles(inner);
          if (obj._light) attachModeTabs(inner);
          c.classList.add("open");
        });
      });
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

    function switchPage(name: string) {
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      const pg = document.getElementById("page-" + name);
      if (pg) pg.classList.add("active");
      document.querySelectorAll(".side-item").forEach((tEl) => {
        tEl.classList.toggle("active", tEl.getAttribute("data-page") === name);
      });
      document.body.classList.toggle("lib-page", name === "library");
      document.body.classList.toggle("page-breakdown", name === "breakdown");
      if (name === "library") renderLibrary();
      if (name === "history") renderHistory();
      if (name === "breakdown") setTimeout(() => input!.focus(), 100);
      document.getElementById("sidebar")!.classList.remove("open");
      document.getElementById("sidebarBackdrop")!.classList.remove("open");
    }
    document.querySelectorAll(".side-item").forEach((tEl) => {
      tEl.addEventListener("click", () => {
        const p = tEl.getAttribute("data-page");
        if (p) switchPage(p);
      });
    });
    document.body.classList.add("page-breakdown");
    document.getElementById("menuTrigger")!.addEventListener("click", () => {
      document.getElementById("sidebar")!.classList.toggle("open");
      document.getElementById("sidebarBackdrop")!.classList.toggle("open");
    });
    document.getElementById("sidebarBackdrop")!.addEventListener("click", () => {
      document.getElementById("sidebar")!.classList.remove("open");
      document.getElementById("sidebarBackdrop")!.classList.remove("open");
    });

    document.getElementById("langToggle")!.addEventListener("click", () => {
      currentLang = currentLang === "ru" ? "en" : "ru";
      store.lang = currentLang;
      saveStore(store);
      applyLang();
    });
    applyLang();

    let busy = false;

    async function fetchAllText(prompt: string): Promise<string> {
      const resp = await fetch("/api/ai-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        throw new Error(text || "Anthropic API error");
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
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
      results!.innerHTML = "";
      loading!.style.display = "flex";
      searchWrap!.classList.add("compact");

      const isCyrillic = /[\u0400-\u04FF]/.test(q);
      const ctxSuffix = ctx ? `\n\nКонтекст от пользователя: ${ctx}` : "";
      const userBlock = `\n\nВвод пользователя: ${q}${ctxSuffix}`;

      // Cyrillic input → keep legacy single-request flow (RU-map, no Light/Full tabs)
      if (isCyrillic) {
        try {
          const buf = await fetchAllText(`${RU_SYSTEM_PROMPT}${userBlock}`);
          loading!.style.display = "none";
          const cleaned = buf.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          let obj: any = null;
          try { obj = JSON.parse(cleaned); } catch {
            const m = cleaned.match(/\{[\s\S]*\}/);
            if (m) { try { obj = JSON.parse(m[0]); } catch {} }
          }
          if (!obj) {
            results!.innerHTML = `<div class="error">${escapeHtml(t("err.generic"))}</div>`;
          } else if (obj.error) {
            results!.innerHTML = `<div class="error">${escapeHtml(obj.error)}</div>`;
          } else if (obj.mode === "ru-map") {
            results!.innerHTML = renderRuMap(obj);
            attachChips();
          } else {
            results!.innerHTML = `<div class="error">${escapeHtml(t("err.generic"))}</div>`;
          }
        } catch (err) {
          console.error(err);
          loading!.style.display = "none";
          results!.innerHTML = `<div class="error">${escapeHtml(t("err.generic"))}</div>`;
        } finally {
          busy = false;
          goBtn!.disabled = false;
        }
        return;
      }

      // English input → fire Light + Full in parallel
      let lightData: any = null;
      let fullObj: any = null;
      let shellRendered = false;

      const renderShell = () => {
        loading!.style.display = "none";
        results!.innerHTML = renderModeShell(fullObj, lightData, !!fullObj);
        const root = results!.querySelector(".mode-tabs")?.parentElement as HTMLElement | null;
        if (root) {
          attachModeTabs(root);
          attachWidgetToggles(root);
        }
        shellRendered = true;
      };

      const updateFullPane = () => {
        if (!fullObj) return;
        const tabs = results!.querySelectorAll<HTMLButtonElement>(".mode-tab");
        const fullPane = results!.querySelector<HTMLElement>('.mode-pane[data-pane="full"]');
        if (!fullPane) return;
        fullPane.innerHTML = `<div data-stage1>${renderStage1(fullObj)}</div>${renderStage2(fullObj)}`;
        tabs.forEach((tb) => {
          if (tb.getAttribute("data-mt") === "full") {
            tb.disabled = false;
            tb.querySelector(".mt-spin")?.remove();
          }
        });
        attachWidgetToggles(fullPane);
      };

      const lightPromise = fetchAllText(`${LIGHT_SYSTEM_PROMPT}${userBlock}`)
        .then((txt) => {
          const cleaned = (txt || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          try {
            lightData = JSON.parse(cleaned);
          } catch {
            const m = cleaned.match(/\{[\s\S]*\}/);
            if (m) { try { lightData = JSON.parse(m[0]); } catch {} }
          }
          if (!lightData) lightData = cleaned; // fallback to raw text
        })
        .catch((e) => {
          console.warn("light failed", e);
          lightData = "";
        });

      const fullPromise = fetchAllText(`${SYSTEM_PROMPT}${userBlock}`)
        .then((txt) => {
          const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          try {
            fullObj = JSON.parse(cleaned);
          } catch {
            const m = cleaned.match(/\{[\s\S]*\}/);
            if (m) { try { fullObj = JSON.parse(m[0]); } catch {} }
          }
        })
        .catch((e) => {
          console.warn("full failed", e);
        });

      try {
        // As soon as Light arrives, render the shell (Full tab still loading)
        lightPromise.then(() => {
          if (shellRendered) return;
          // If Full already arrived and is non-word mode, let the Full handler take over
          if (fullObj && (fullObj.mode === "context" || fullObj.mode === "sentence" || fullObj.mode === "ru-map" || fullObj.error)) return;
          renderShell();
        });

        await Promise.all([lightPromise, fullPromise]);
        loading!.style.display = "none";

        // Handle errors / non-word modes from Full
        if (!fullObj) {
          if (!shellRendered) {
            results!.innerHTML = `<div class="error">${escapeHtml(t("err.generic"))}</div>`;
          }
          return;
        }
        if (fullObj.error) {
          results!.innerHTML = `<div class="error">${escapeHtml(fullObj.error)}</div>`;
          return;
        }
        if (fullObj.mode === "context") {
          results!.innerHTML = renderContext(fullObj);
          attachChips();
          if (fullObj.word) addHistory({ word: fullObj.word, translation: fullObj.query || "", mode: "context" }, fullObj);
          return;
        }
        if (fullObj.mode === "ru-map") {
          results!.innerHTML = renderRuMap(fullObj);
          attachChips();
          return;
        }
        if (fullObj.mode === "sentence") {
          results!.innerHTML = renderSentence(fullObj);
          const sObj = { ...fullObj, word: fullObj.sentence, _light: lightData };
          lastBreakdown = sObj;
          addHistory({ word: fullObj.sentence, translation: fullObj.translation || "", mode: "sentence" }, sObj);
          renderSaveRow();
          return;
        }

        // Word/phrase mode → enrich with light data and finalize
        fullObj._light = lightData ?? "";

        if (!shellRendered) renderShell();
        else updateFullPane();

        lastBreakdown = fullObj;
        const existingSaved = wordsList.find((w) => w.word === fullObj.word);
        if (existingSaved && currentUserId) {
          existingSaved.breakdown = fullObj;
          supabase
            .from("words")
            .update({ breakdown: JSON.stringify(fullObj) })
            .eq("id", existingSaved.id)
            .then(() => {});
        }
        const firstCtx = (fullObj.contexts && fullObj.contexts[0]) || {};
        addHistory({ word: fullObj.word, translation: firstCtx.title || "", mode: fullObj.mode || "word" }, fullObj);
        renderSaveRow();
      } catch (err) {
        console.error(err);
        loading!.style.display = "none";
        if (!shellRendered) {
          results!.innerHTML = `<div class="error">${escapeHtml(t("err.generic"))}</div>`;
        }
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
      authSub.subscription.unsubscribe();
      delete (window as unknown as { __lnRunBreakdown?: unknown }).__lnRunBreakdown;
      delete (window as unknown as { __lnResetBreakdown?: unknown }).__lnResetBreakdown;
    };
  }, []);

  return (
    <div className="ln">
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-logo">
          <div className="brand">
            <div className="brand-name text-green-800">
              <span className="brand-word">Lev</span>
              <span className="brand-amp">&amp;</span>
              <span className="brand-word">Nikol</span>
            </div>
            <div className="brand-sub" data-i18n="brand.sub">
              Разбор английских слов
            </div>
          </div>
        </div>
        <button className="side-item active" data-page="breakdown" type="button">
          <span className="ic">🔤</span>
          <span data-i18n="nav.breakdown">Разбор</span>
        </button>
        <button className="side-item" data-page="library" type="button">
          <span className="ic">📁</span>
          <span data-i18n="nav.library">Мои слова</span>
        </button>
        <button className="side-item" data-page="history" type="button">
          <span className="ic">🕓</span>
          <span data-i18n="nav.history">История разборов</span>
        </button>
        <button className="side-item" data-page="top" type="button">
          <span className="ic">⭐</span>
          <span data-i18n="nav.top">Топ слов</span>
        </button>
        <div className="side-spacer"></div>
        <div className="side-bottom">
          <button className="lang-toggle" id="langToggle" type="button">
            <span className="ic">🌐</span>
            <span className="lang-pill">
              <span id="langRu" className="lang-opt active">
                RU
              </span>
              <span className="lang-sep">/</span>
              <span id="langEn" className="lang-opt">
                EN
              </span>
            </span>
          </button>
          <button className="side-item" data-page="account" type="button">
            <span className="ic">👤</span>
            <span data-i18n="nav.account">Аккаунт</span>
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" id="sidebarBackdrop"></div>

      <div className="wrap">
        <div className="header">
          <button className="menu-trigger" id="menuTrigger" aria-label="Меню" type="button">
            ☰
          </button>
        </div>

        <div className="page active" id="page-breakdown">
          <div className="page-inner">
            <div className="search-wrap" id="searchWrap" style={{ display: "none" }} aria-hidden="true">
              <form className="search" id="searchForm" autoComplete="off">
                <input
                  id="input"
                  type="text"
                  placeholder=""
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
                  ×
                </button>
                <button className="btn-go" id="goBtn" type="submit">
                  Разобрать →
                </button>
              </form>
              <div id="suggestBox" className="suggest-box" style={{ display: "none" }}></div>
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
                  className="context-input"
                  placeholder=""
                  autoComplete="off"
                />
              </div>
            </div>

            <div id="loading" className="loading" style={{ display: "none" }}>
              <span>Анализирую</span>
              <span className="dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>

            <div id="results" className="results"></div>

            <div className="manifesto" aria-hidden="true">
              <p>Только ты знаешь, как тебе нужно учить язык.</p>
              <p>
                Приложений сотни. Все обещают результат. Все говорят по-разному. В какой-то момент
                перестаёшь понимать — кому верить и правильно ли ты вообще всё делаешь.
              </p>
              <p>
                Lev &amp; Nikol не учит тебя. Он помогает выстроить свою структуру — встретил слово,
                разобрал. Хочешь выразить мысль — нашёл как. Только то, что нужно именно тебе.
              </p>
            </div>
          </div>
        </div>

        <div className="page" id="page-library">
          <div className="page-inner">
            <div className="lib-page-header" id="libPageHeader"></div>
            <div className="library">
              <div className="lib-folders" id="libFolders"></div>
              <div className="lib-words" id="libWords"></div>
            </div>
          </div>
        </div>

        <div className="page" id="page-history">
          <div className="page-inner">
            <div className="hist-page-header" id="histPageHeader"></div>
            <div id="historyList"></div>
          </div>
        </div>

        <div className="page" id="page-top">
          <div className="page-inner">
            <h2
              data-page-title="top.title"
              style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 20px" }}
            >
              Топ слов
            </h2>
            <div
              className="empty-state"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: 14,
              }}
            >
              <div className="empty-icon">⭐</div>
              <div className="empty-title" id="topEmptyT">
                Скоро здесь появятся подборки слов
              </div>
              <div className="empty-sub" id="topEmptyS">
                Следи за обновлениями.
              </div>
            </div>
          </div>
        </div>

        <div className="page" id="page-account">
          <div className="page-inner">
            <h2
              data-page-title="account.title"
              style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 20px" }}
            >
              Аккаунт
            </h2>
            <div
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 32,
                textAlign: "center",
                maxWidth: 380,
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  background: "var(--slate-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: 30,
                  margin: "0 auto 14px",
                }}
              >
                👤
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
    const btn = document.querySelector<HTMLButtonElement>('.side-item[data-page="main"]');
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
      <>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {session.user.email}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Ты вошёл в аккаунт
        </div>
        <button className="side-login" onClick={onLogout} style={{ cursor: "pointer" }}>
          Выйти
        </button>
      </>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 14,
    marginBottom: 10,
    fontFamily: "inherit",
  };

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); setInfo(null); }}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: mode === "login" ? "var(--text)" : "transparent",
            color: mode === "login" ? "var(--bg)" : "var(--text)",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >Вход</button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: mode === "signup" ? "var(--text)" : "transparent",
            color: mode === "signup" ? "var(--bg)" : "var(--text)",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >Регистрация</button>
      </div>
      <input
        type="email" required placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} style={inputStyle}
      />
      <input
        type="password" required minLength={6} placeholder="Пароль" value={password}
        onChange={(e) => setPassword(e.target.value)} style={inputStyle}
      />
      {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {info && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 10 }}>{info}</div>}
      <button type="submit" disabled={busy} className="side-login" style={{ cursor: busy ? "wait" : "pointer", width: "100%" }}>
        {busy ? "..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
