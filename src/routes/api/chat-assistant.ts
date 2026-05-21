import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Вы — дружелюбный преподаватель английского языка и ассистент. 
Пользователь сейчас изучает слово/фразу: [currentWord].
Вы знаете об этом контексте и можете ссылаться на него, если это уместно, но вы свободны обсуждать любую тему, которую поднимет пользователь — грамматику, другие слова, советы по изучению языка или что-либо еще.
Будьте полезны, лаконичны и поддерживайте живой диалог. Отвечайте на русском языке, если только пользователь не пишет на английском.`;

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
        const wordMatch = body.context?.match(/Текущее слово: ([^\n]+)/);
        const currentWord = wordMatch ? wordMatch[1].trim() : "текущего слова";

        const system =
          SYSTEM_PROMPT.replace(/\[currentWord\]/g, currentWord) +
          (body.context ? `\n\nКОНТЕКСТ:\n${body.context}` : "") +
          (body.systemExtra ? `\n\n${body.systemExtra}` : "");

        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "extended-cache-ttl-2025-04-11",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: [
              {
                type: "text",
                text: system,
                cache_control: { type: "ephemeral", ttl: "1h" },
              },
            ],
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
