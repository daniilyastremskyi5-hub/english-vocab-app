import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt } = (await request.json()) as { prompt: string };
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response("Missing ANTHROPIC_API_KEY", { status: 500 });
        }

        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            stream: true,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text();
          return new Response(text || "Anthropic API error", {
            status: upstream.status || 500,
          });
        }

        const stream = new ReadableStream({
          async start(controller) {
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (!data) continue;
                  try {
                    const json = JSON.parse(data);
                    if (
                      json?.type === "content_block_delta" &&
                      json?.delta?.type === "text_delta" &&
                      json?.delta?.text
                    ) {
                      controller.enqueue(encoder.encode(json.delta.text));
                    }
                  } catch {
                    // ignore partial json
                  }
                }
              }
            } catch (err) {
              controller.error(err);
              return;
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
