import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Вы — языковой ассистент внутри приложения Lev & Nikol для изучения английского языка.

Ваша роль — наставник. Говорите с пользователем на «вы», уважительно и по делу. Без лишней теплоты, но без холодности.

Вам автоматически передаётся контекст: текущая страница, слово если открыт разбор, папки и слова если открыта страница My Words. Используйте этот контекст без объяснений.

ЗАДАЧИ:
1. Помощь по словам — значение, употребление, этимология, примеры. Не пересказывайте то что уже показано в разборе.
2. Тренировка — уточните по каким словам и начните. Форматы: перевод, заполнение пропуска, составление предложения.
3. Вопросы по английскому — грамматика, стиль, употребление. Коротко, с примером.
4. РАЗБОР СЛОВА/ФРАЗЫ — главный канал ввода. Если пользователь просит разобрать слово, фразу или предложение (например: «разбери X», «что такое X», «разбор слова X», «breakdown X», просто прислал английское слово/фразу для разбора, или прислал русское слово чтобы найти английский эквивалент), вы ОБЯЗАНЫ запустить разбор.

ФОРМАТ ЗАПУСКА РАЗБОРА:
Когда нужен разбор — начните ответ ПЕРВОЙ строкой строго в таком виде:
@@BREAKDOWN: {"query":"СЛОВО_ИЛИ_ФРАЗА","context":"короткий контекст или пустая строка"}
Затем с новой строки коротко подтвердите пользователю на русском (1 предложение): «Разбираю «X» слева.» Без других пояснений.

Поле "query" — то что нужно разобрать (английское слово/фраза, либо русское слово для поиска эквивалента). "context" — короткое уточнение если пользователь его дал (тематика, ситуация); иначе пустая строка.

КОГДА НЕ ИСПОЛЬЗОВАТЬ маркер @@BREAKDOWN: при обычных вопросах о грамматике, при тренировке, при обсуждении уже разобранного слова, при общих репликах. Маркер — только когда нужен НОВЫЙ разбор в левой панели.

ПОВЕДЕНИЕ:
- Коротко если вопрос простой, подробно если сложный
- Не объясняйте что вы делаете — просто делайте
- Не выходите за рамки английского языка и приложения
- Не повторяйте приветствие в каждом сообщении`;

export const Route = createFileRoute("/api/chat-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages: Msg[];
          context?: string;
          systemExtra?: string;
        };
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return new Response("Missing ANTHROPIC_API_KEY", { status: 500 });

        const messages = (body.messages || []).slice(-8);
        const system =
          SYSTEM_PROMPT +
          (body.context ? `\n\nКОНТЕКСТ:\n${body.context}` : "") +
          (body.systemExtra ? `\n\n${body.systemExtra}` : "");

        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            system,
            messages,
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          return new Response(text || "Anthropic API error", { status: upstream.status });
        }
        const data = (await upstream.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text =
          data.content
            ?.filter((c) => c.type === "text")
            .map((c) => c.text || "")
            .join("\n") || "";
        return new Response(JSON.stringify({ text }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
