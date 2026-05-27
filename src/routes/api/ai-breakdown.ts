import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { LIGHT_BREAKDOWN_PROMPT, FULL_BREAKDOWN_PROMPT, SENTENCE_BREAKDOWN_PROMPT, CHAT_PROMPT, DIGEST_PROMPT, CARDS_PROMPT } from "./-prompts";

const MODELS = {
  sonnet: "claude-sonnet-4-6",
  haikuChat: "claude-haiku-4-5",
  haikuCards: "claude-haiku-4-5-20251001"
};

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  // Strip markdown code blocks if present (e.g. ```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // If standard parsing fails, try to extract first outer JSON object
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonCandidate = cleaned.slice(startIdx, endIdx + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (innerErr) {
        console.error("Failed to parse extracted JSON candidate:", innerErr, "Original text snippet:", cleaned.slice(0, 100));
      }
    }
    throw err;
  }
}

function prepareDigestMessages(selectedMessages: Array<{ role: "user" | "assistant"; content: string }>, auxiliaryText?: string) {
  let transcript = selectedMessages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n");
  if (auxiliaryText && auxiliaryText.trim()) {
    transcript += `\n\n[Вспомогательный текст от пользователя для фокуса конспекта]:\n"${auxiliaryText.trim()}"`;
  }
  return [
    {
      role: "user" as const,
      content: transcript || "Собери конспект."
    }
  ];
}

export const Route = createFileRoute("/api/ai-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let { input, mode, canonical, pos, type, messages } = (await request.json()) as { 
          input?: string; 
          mode: "light" | "full" | "sentence" | "chat" | "digest" | "cards";
          canonical?: string;
          pos?: string;
          type?: string;
          messages?: Array<{ role: "user" | "assistant"; content: string }>;
        };
        
        mode = mode || "light";
        const model = mode === "chat" ? MODELS.haikuChat : MODELS.sonnet;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        console.log(`[AI-Breakdown] Request received. Mode: "${mode}", Input: "${input || ''}", Canonical: "${canonical || ''}"`);
        console.log(`[AI-Breakdown] process.env.SUPABASE_URL: "${process.env.SUPABASE_URL || ''}"`);
        console.log(`[AI-Breakdown] process.env.SUPABASE_SECRET_KEY is present: ${!!process.env.SUPABASE_SECRET_KEY}`);
        
        if (!apiKey) {
          return new Response("Missing ANTHROPIC_API_KEY", { status: 500 });
        }

        let supabaseClient: any = null;
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
          supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
        } else {
          console.warn("[AI-Breakdown] Supabase client NOT initialized - missing env vars!");
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
        };

        if (mode === "light") {
          if (!input) {
            return new Response("Missing input for light mode", { status: 400 });
          }
          const rawInput = input.trim().toLowerCase();
          
          let aliasRow: any = null;
          let breakdownRow: any = null;
          let canonicalKey: string | null = null;

          if (supabaseClient) {
            try {
              // 1. First check if there is an input alias mapped
              const { data: aData, error: aError } = await supabaseClient
                .from("input_aliases")
                .select("*")
                .eq("input", rawInput)
                .single();
              
              if (!aError && aData) {
                aliasRow = aData;
                canonicalKey = aData.canonical;
              } else if (aError && aError.code !== "PGRST116") {
                console.error(`[AI-Breakdown] Error querying input_aliases for input "${rawInput}":`, aError);
              }

              // 2. If no alias found, check if rawInput itself is a canonical word
              if (!canonicalKey) {
                const { data: checkCanon, error: checkCanonErr } = await supabaseClient
                  .from("word_breakdowns")
                  .select("canonical")
                  .eq("canonical", rawInput)
                  .single();
                if (!checkCanonErr && checkCanon) {
                  canonicalKey = checkCanon.canonical;
                } else if (checkCanonErr && checkCanonErr.code !== "PGRST116") {
                  console.error(`[AI-Breakdown] Error checking word_breakdowns by canonical fallback for "${rawInput}":`, checkCanonErr);
                }
              }

              // 3. If we resolved a canonical key, query the full record
              if (canonicalKey) {
                const { data: bData, error: bError } = await supabaseClient
                  .from("word_breakdowns")
                  .select("*")
                  .eq("canonical", canonicalKey)
                  .single();
                
                if (!bError && bData) {
                  breakdownRow = bData;
                } else if (bError && bError.code !== "PGRST116") {
                  console.error(`[AI-Breakdown] Error loading word_breakdowns for canonical "${canonicalKey}":`, bError);
                }
              }
            } catch (e) {
              console.error(`[AI-Breakdown] Exception while reading cache for "${rawInput}":`, e);
            }
          }

          if (breakdownRow && breakdownRow.light) {
            const cachedJson = breakdownRow.light;
            if (aliasRow && aliasRow.note) {
              cachedJson.input_note = aliasRow.note;
            }
            console.log(`[AI-Breakdown] Cache HIT for "${rawInput}" (resolved: "${breakdownRow.canonical}"). Returning light breakdown.`);
            return new Response(JSON.stringify(cachedJson), { headers });
          }

          const upstream = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-beta": "extended-cache-ttl-2025-04-11",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              stream: true,
              system: [
                {
                  type: "text",
                  text: LIGHT_BREAKDOWN_PROMPT,
                  cache_control: { type: "ephemeral", ttl: "1h" },
                },
              ],
              messages: [
                {
                  role: "user",
                  content: `Ввод: "${rawInput}"`,
                },
              ],
            }),
          });

          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text();
            console.error("Anthropic API error:", text);
            return new Response(text || "Anthropic API error", { status: upstream.status || 500 });
          }

          const stream = new ReadableStream({
            async start(controller) {
              const reader = upstream.body!.getReader();
              const decoder = new TextDecoder();
              const encoder = new TextEncoder();
              let buffer = "";
              let fullText = "";
              
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
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr) continue;
                    
                    try {
                      const json = JSON.parse(dataStr);
                      if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta" && json?.delta?.text) {
                        const delta = json.delta.text;
                        fullText += delta;
                        controller.enqueue(encoder.encode(delta));
                      }
                    } catch {}
                  }
                }

                // Upsert to Supabase after successful stream completion
                if (fullText && supabaseClient) {
                  try {
                    const parsedLight = cleanAndParseJson(fullText);
                    if (parsedLight.mode === "word" && parsedLight.canonical) {
                      const canon = parsedLight.canonical.trim();
                      const typ = parsedLight.type;
                      const posValue = parsedLight.pos;
                      const note = parsedLight.input_note;

                      // 1. Upsert primary mapping (rawInput -> canon)
                      const aliasPayload = {
                        input: rawInput,
                        canonical: canon,
                        type: typ || "common_verb",
                        pos: posValue || "verb",
                        note: note || null,
                        valid: true
                      };
                      const { error: aliasErr } = await supabaseClient.from("input_aliases").upsert(aliasPayload);
                      if (aliasErr) {
                        console.error(`[AI-Breakdown] [ERROR] Failed to upsert input_aliases for input "${rawInput}", canonical "${canon}":`, aliasErr);
                      }

                      // 2. Also upsert canonical mapping if different
                      const canonLower = canon.toLowerCase().trim();
                      if (rawInput !== canonLower) {
                        const canonAliasPayload = {
                          input: canonLower,
                          canonical: canon,
                          type: typ || "common_verb",
                          pos: posValue || "verb",
                          note: null,
                          valid: true
                        };
                        const { error: canonAliasErr } = await supabaseClient.from("input_aliases").upsert(canonAliasPayload);
                        if (canonAliasErr) {
                          console.error(`[AI-Breakdown] [ERROR] Failed to upsert input_aliases for canonical alias "${canonLower}", canonical "${canon}":`, canonAliasErr);
                        }
                      }

                      const sanitizedLight = { ...parsedLight, input_note: null };
                      const updatePayload: any = {
                        canonical: canon,
                        updated_at: new Date().toISOString(),
                        light: sanitizedLight
                      };
                      
                      const { error: breakdownErr } = await supabaseClient.from("word_breakdowns").upsert(updatePayload);
                      if (breakdownErr) {
                        console.error(`[AI-Breakdown] [DATABASE ERROR] Failed to save light_json to word_breakdowns:`, breakdownErr);
                      } else {
                        console.log(`[AI-Breakdown] [SUCCESS] Saved light_json to word_breakdowns for canonical "${canon}".`);
                        // Safely clear cached cards_json in a separate query to prevent blocking breakdown save
                        try {
                          await supabaseClient.from("word_breakdowns").update({ cards_json: null }).eq("canonical", canon);
                        } catch (cardsClearErr) {
                          console.warn("[AI-Breakdown] Safe cards invalidation warning:", cardsClearErr);
                        }
                      }
                    } else {
                      console.log(`[AI-Breakdown] Claude response is not a word mode. Mode: "${parsedLight.mode || ''}". Skip database caching.`);
                    }
                  } catch (err) {
                    console.error(`[AI-Breakdown] [ERROR] Exception parsing/caching light breakdown for rawInput "${rawInput}":`, err);
                  }
                }
              } catch (err) {
                controller.error(err);
                return;
              }
              controller.close();
            }
          });

          const streamHeaders: Record<string, string> = {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          };
          return new Response(stream, { headers: streamHeaders });

        } else if (mode === "sentence") {
          if (!input) {
            return new Response("Missing input for sentence mode", { status: 400 });
          }
          const rawInput = input.trim();
          console.log(`[AI-Breakdown] Running sentence mode breakdown for input: "${rawInput}"`);

          const upstream = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-beta": "extended-cache-ttl-2025-04-11",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              stream: true,
              system: [
                {
                  type: "text",
                  text: SENTENCE_BREAKDOWN_PROMPT,
                  cache_control: { type: "ephemeral", ttl: "1h" },
                },
              ],
              messages: [
                {
                  role: "user",
                  content: `Предложение: "${rawInput}"`,
                },
              ],
            }),
          });

          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text();
            console.error("Anthropic API error:", text);
            return new Response(text || "Anthropic API error", { status: upstream.status || 500 });
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
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr) continue;
                    
                    try {
                      const json = JSON.parse(dataStr);
                      if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta" && json?.delta?.text) {
                        controller.enqueue(encoder.encode(json.delta.text));
                      }
                    } catch {}
                  }
                }
              } catch (err) {
                controller.error(err);
                return;
              }
              controller.close();
            }
          });

          const streamHeaders: Record<string, string> = {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          };
          return new Response(stream, { headers: streamHeaders });
        } else if (mode === "chat") {
          if (!messages || !Array.isArray(messages)) {
            return new Response("Missing messages for chat mode", { status: 400 });
          }

          console.log(`[AI-Breakdown] Running chat mode breakdown with ${messages.length} messages.`);
          const lastUserMsg = messages[messages.length - 1]?.content || "";
          const clean = lastUserMsg.trim().toLowerCase();
          
          // Classify input
          const hasCyrillic = /[а-яА-ЯёЁ]/.test(clean);
          const hasEnglish = /[a-zA-Z]/.test(clean);

          const words = clean.split(/[\s,?!.\-\"\'\)\(\[\]]+/);
          const questionWords = [
            "what", "how", "why", "who", "which", "where", "when",
            "что", "как", "почему", "кто", "где", "когда", "зачем", "чтобы", "значит",
            "перевод", "переведи", "подскажи", "посоветуй", "расскажи", "объясни"
          ];
          const hasQuestionWord = words.some(w => questionWords.includes(w));
          const isEnglishInput = hasEnglish && !hasCyrillic && !hasQuestionWord;

          if (isEnglishInput) {
            // It is a breakdown!
            const cleanInput = lastUserMsg.trim();
            const responseHeaders: Record<string, string> = {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "x-response-type": "breakdown"
            };

            if (words.length <= 5) {
              // Word Mode Breakdown (with caching)
              const rawInput = cleanInput.toLowerCase();
              let aliasRow: any = null;
              let breakdownRow: any = null;
              let canonicalKey: string | null = null;

              if (supabaseClient) {
                try {
                  const { data: aData, error: aError } = await supabaseClient
                    .from("input_aliases")
                    .select("*")
                    .eq("input", rawInput)
                    .single();
                  
                  if (!aError && aData) {
                    aliasRow = aData;
                    canonicalKey = aData.canonical;
                  }
                  if (!canonicalKey) {
                    const { data: checkCanon, error: checkCanonErr } = await supabaseClient
                      .from("word_breakdowns")
                      .select("canonical")
                      .eq("canonical", rawInput)
                      .single();
                    if (!checkCanonErr && checkCanon) {
                      canonicalKey = checkCanon.canonical;
                    }
                  }
                  if (canonicalKey) {
                    const { data: bData, error: bError } = await supabaseClient
                      .from("word_breakdowns")
                      .select("*")
                      .eq("canonical", canonicalKey)
                      .single();
                    if (!bError && bData) {
                      breakdownRow = bData;
                    }
                  }
                } catch (e) {
                  console.error(`[AI-Breakdown] Exception while reading cache for "${rawInput}":`, e);
                }
              }

              if (breakdownRow && breakdownRow.light) {
                const cachedJson = breakdownRow.light;
                if (aliasRow && aliasRow.note) {
                  cachedJson.input_note = aliasRow.note;
                }
                console.log(`[AI-Breakdown] Chat-mode Cache HIT for "${rawInput}" (resolved: "${breakdownRow.canonical}"). Returning light breakdown.`);
                return new Response(JSON.stringify(cachedJson), { headers: { ...headers, "x-response-type": "breakdown" } });
              }

              // Cache miss - request Anthropic for Light Breakdown
              const upstream = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "x-api-key": apiKey,
                  "anthropic-version": "2023-06-01",
                  "anthropic-beta": "extended-cache-ttl-2025-04-11",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: MODELS.sonnet, // use Sonnet for breakdowns
                  max_tokens: 4096,
                  stream: true,
                  system: [
                    {
                      type: "text",
                      text: LIGHT_BREAKDOWN_PROMPT,
                      cache_control: { type: "ephemeral", ttl: "1h" },
                    },
                  ],
                  messages: [
                    {
                      role: "user",
                      content: `Ввод: "${rawInput}"`,
                    },
                  ],
                }),
              });

              if (!upstream.ok || !upstream.body) {
                const text = await upstream.text();
                return new Response(text || "Anthropic API error", { status: upstream.status || 500 });
              }

              const stream = new ReadableStream({
                async start(controller) {
                  const reader = upstream.body!.getReader();
                  const decoder = new TextDecoder();
                  const encoder = new TextEncoder();
                  let buffer = "";
                  let fullText = "";
                  
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
                        const dataStr = trimmed.slice(5).trim();
                        if (!dataStr) continue;
                        
                        try {
                          const json = JSON.parse(dataStr);
                          if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta" && json?.delta?.text) {
                            const delta = json.delta.text;
                            fullText += delta;
                            controller.enqueue(encoder.encode(delta));
                          }
                        } catch {}
                      }
                    }

                    if (fullText && supabaseClient) {
                      try {
                        const parsedLight = cleanAndParseJson(fullText);
                        if (parsedLight.mode === "word" && parsedLight.canonical) {
                          const canon = parsedLight.canonical.trim();
                          const typ = parsedLight.type;
                          const posValue = parsedLight.pos;
                          const note = parsedLight.input_note;

                          const aliasPayload = {
                            input: rawInput,
                            canonical: canon,
                            type: typ || "common_verb",
                            pos: posValue || "verb",
                            note: note || null,
                            valid: true
                          };
                          await supabaseClient.from("input_aliases").upsert(aliasPayload);

                          const canonLower = canon.toLowerCase().trim();
                          if (rawInput !== canonLower) {
                            const canonAliasPayload = {
                              input: canonLower,
                              canonical: canon,
                              type: typ || "common_verb",
                              pos: posValue || "verb",
                              note: null,
                              valid: true
                            };
                            await supabaseClient.from("input_aliases").upsert(canonAliasPayload);
                          }

                          const sanitizedLight = { ...parsedLight, input_note: null };
                          const updatePayload: any = {
                            canonical: canon,
                            updated_at: new Date().toISOString(),
                            light: sanitizedLight
                          };
                          await supabaseClient.from("word_breakdowns").upsert(updatePayload);
                        }
                      } catch (err) {
                        console.error(`[AI-Breakdown] Chat-mode caching error:`, err);
                      }
                    }
                  } catch (err) {
                    controller.error(err);
                    return;
                  }
                  controller.close();
                }
              });

              return new Response(stream, { headers: responseHeaders });

            } else {
              // Sentence Mode Breakdown (words.length > 5)
              const upstream = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "x-api-key": apiKey,
                  "anthropic-version": "2023-06-01",
                  "anthropic-beta": "extended-cache-ttl-2025-04-11",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: MODELS.sonnet, // use Sonnet for breakdowns
                  max_tokens: 4096,
                  stream: true,
                  system: [
                    {
                      type: "text",
                      text: SENTENCE_BREAKDOWN_PROMPT,
                      cache_control: { type: "ephemeral", ttl: "1h" },
                    },
                  ],
                  messages: [
                    {
                      role: "user",
                      content: `Предложение: "${cleanInput}"`,
                    },
                  ],
                }),
              });

              if (!upstream.ok || !upstream.body) {
                const text = await upstream.text();
                return new Response(text || "Anthropic API error", { status: upstream.status || 500 });
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
                        const dataStr = trimmed.slice(5).trim();
                        if (!dataStr) continue;
                        
                        try {
                          const json = JSON.parse(dataStr);
                          if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta" && json?.delta?.text) {
                            controller.enqueue(encoder.encode(json.delta.text));
                          }
                        } catch {}
                      }
                    }
                  } catch (err) {
                    controller.error(err);
                    return;
                  }
                  controller.close();
                }
              });

              return new Response(stream, { headers: responseHeaders });
            }

          } else {
            // It is a standard chat response!
            const responseHeaders: Record<string, string> = {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "x-response-type": "chat"
            };

            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "extended-cache-ttl-2025-04-11",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: MODELS.haikuChat, // use Haiku for chats
                max_tokens: 1024,
                stream: true,
                system: [
                  {
                    type: "text",
                    text: CHAT_PROMPT,
                    cache_control: { type: "ephemeral", ttl: "1h" },
                  },
                ],
                messages: messages.map(m => ({
                  role: m.role,
                  content: m.content
                })),
              }),
            });

            if (!upstream.ok || !upstream.body) {
              const text = await upstream.text();
              return new Response(text || "Anthropic API error", { status: upstream.status || 500 });
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
                      const dataStr = trimmed.slice(5).trim();
                      if (!dataStr) continue;
                      
                      try {
                        const json = JSON.parse(dataStr);
                        if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta" && json?.delta?.text) {
                          controller.enqueue(encoder.encode(json.delta.text));
                        }
                      } catch {}
                    }
                  }
                } catch (err) {
                  controller.error(err);
                  return;
                }
                controller.close();
              }
            });

            return new Response(stream, { headers: responseHeaders });
          }
        } else if (mode === "digest") {
          if (!messages || !Array.isArray(messages)) {
            return new Response("Missing messages for digest mode", { status: 400 });
          }

          console.log(`[AI-Breakdown] Running digest mode breakdown with ${messages.length} messages.`);
          const auxiliaryText = input || "";

          // Prepare transcript packed in a single user message
          const promptMessages = prepareDigestMessages(messages, auxiliaryText);

          const upstream = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-beta": "extended-cache-ttl-2025-04-11",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODELS.sonnet, // strictly use Sonnet as requested
              max_tokens: 4096,
              stream: true,
              system: [
                {
                  type: "text",
                  text: DIGEST_PROMPT,
                  cache_control: { type: "ephemeral", ttl: "1h" },
                },
              ],
              messages: promptMessages,
            }),
          });

          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text();
            console.error("Anthropic API error in digest mode:", text);
            return new Response(text || "Anthropic API error", { status: upstream.status || 500 });
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
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr) continue;
                    
                    try {
                      const json = JSON.parse(dataStr);
                      if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta" && json?.delta?.text) {
                        controller.enqueue(encoder.encode(json.delta.text));
                      }
                    } catch {}
                  }
                }
              } catch (err) {
                controller.error(err);
                return;
              }
              controller.close();
            }
          });
          const streamHeaders: Record<string, string> = {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          };
          return new Response(stream, { headers: streamHeaders });
        } else if (mode === "cards") {
          if (!canonical) {
            return new Response("Missing canonical for cards mode", { status: 400 });
          }
          const canon = canonical.trim();
          console.log(`[AI-Breakdown] Running cards mode for canonical: "${canon}"`);

          let breakdownRow: any = null;
          let cardsJsonFromCache: any = null;
          
          if (supabaseClient) {
            try {
              // try/catch wrapper on SELECT cards_json to guard against missing column
              const { data, error } = await supabaseClient
                .from("word_breakdowns")
                .select("cards_json, light")
                .eq("canonical", canon)
                .single();
              
              if (!error && data) {
                breakdownRow = data;
                if (data.cards_json) {
                  cardsJsonFromCache = data.cards_json;
                }
              } else if (error && error.code !== "PGRST116") {
                console.warn(`[AI-Breakdown] [DATABASE SELECT WARNING] Failed to select from word_breakdowns:`, error);
              }
            } catch (e) {
              console.warn(`[AI-Breakdown] [DATABASE SELECT EXCEPTION] Caught exception during SELECT:`, e);
            }
          }

          // 1. Check if cards_json is already in cache
          if (cardsJsonFromCache) {
            console.log(`[AI-Breakdown] Cache HIT (cards_json) for canonical "${canon}". Returning cached cards.`);
            return new Response(JSON.stringify(cardsJsonFromCache), { headers });
          }

          // 2. Get/generate the word breakdown (pillars)
          let pillars = breakdownRow?.light?.pillars || null;
          if (!pillars) {
            console.log(`[AI-Breakdown] Cache MISS (light breakdown) for cards of "${canon}". Generating breakdown first...`);
            
            // Call Anthropic to generate the breakdown
            const upstreamBreakdown = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: MODELS.sonnet,
                max_tokens: 4096,
                system: [
                  {
                    type: "text",
                    text: LIGHT_BREAKDOWN_PROMPT,
                  },
                ],
                messages: [
                  {
                    role: "user",
                    content: `Ввод: "${canon}"`,
                  },
                ],
              }),
            });

            if (!upstreamBreakdown.ok) {
              const errText = await upstreamBreakdown.text();
              console.error("[AI-Breakdown] Failed to generate fallback breakdown:", errText);
              return new Response(errText || "Anthropic breakdown generation error", { status: upstreamBreakdown.status });
            }

            const breakdownData = await upstreamBreakdown.json();
            const breakdownText = breakdownData.content?.[0]?.text || "";
            const parsedLight = cleanAndParseJson(breakdownText);

            if (parsedLight && parsedLight.pillars) {
              pillars = parsedLight.pillars;
              // Save generated breakdown to cache
              if (supabaseClient) {
                try {
                  const updatePayload = {
                    canonical: canon,
                    updated_at: new Date().toISOString(),
                    light: parsedLight
                  };
                  await supabaseClient.from("word_breakdowns").upsert(updatePayload);
                  
                  // Safely clear cached cards_json in a separate query
                  try {
                    await supabaseClient.from("word_breakdowns").update({ cards_json: null }).eq("canonical", canon);
                  } catch (cardsClearErr) {
                    console.warn("[AI-Breakdown] Safe cards invalidation warning in fallback:", cardsClearErr);
                  }
                  
                  // Also upsert an input alias for lowercase form
                  const canonLower = canon.toLowerCase().trim();
                  await supabaseClient.from("input_aliases").upsert({
                    input: canonLower,
                    canonical: canon,
                    type: parsedLight.type || "common_verb",
                    pos: parsedLight.pos || "verb",
                    note: null,
                    valid: true
                  });
                } catch (dbErr) {
                  console.error("[AI-Breakdown] Failed to save fallback breakdown to DB:", dbErr);
                }
              }
            } else {
              return new Response("Generated breakdown format invalid", { status: 500 });
            }
          }

          // 3. Call prompt_cards.md to package pillars into cards_json
          console.log(`[AI-Breakdown] Calling cards builder for "${canon}" with ${pillars.length} pillars...`);
          const upstreamCards = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODELS.haikuCards,
              max_tokens: 4096,
              system: [
                {
                  type: "text",
                  text: CARDS_PROMPT,
                },
              ],
              messages: [
                {
                  role: "user",
                  content: JSON.stringify({ canonical: canon, pillars }),
                },
              ],
            }),
          });

          if (!upstreamCards.ok) {
            const errText = await upstreamCards.text();
            console.error("[AI-Breakdown] Failed to generate cards:", errText);
            return new Response(errText || "Anthropic cards generation error", { status: upstreamCards.status });
          }

          const cardsData = await upstreamCards.json();
          const cardsText = cardsData.content?.[0]?.text || "";
          
          // 4. Strip JSON code fences before parsing
          let cleanedCardsText = cardsText.trim();
          cleanedCardsText = cleanedCardsText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          
          let parsedCards: any = null;
          try {
            parsedCards = JSON.parse(cleanedCardsText);
          } catch (jsonErr) {
            console.warn("[AI-Breakdown] JSON.parse failed. Retrying with first outer brackets extraction.", jsonErr);
            const startIdx = cleanedCardsText.indexOf("{");
            const endIdx = cleanedCardsText.lastIndexOf("}");
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
              parsedCards = JSON.parse(cleanedCardsText.slice(startIdx, endIdx + 1));
            } else {
              throw jsonErr;
            }
          }

          // 5. Example Validation Sanity Checks (Haiku sanity check)
          if (parsedCards && Array.isArray(parsedCards.cards)) {
            parsedCards.cards = parsedCards.cards.map((card: any) => {
              if (card.type === "meaning") {
                // Ensure examples array is non-empty and well-formed
                if (!Array.isArray(card.examples) || card.examples.length === 0) {
                  card.examples = [{ ru: "Пример перевода", en: "Example usage" }];
                } else {
                  card.examples = card.examples.map((ex: any) => ({
                    ru: ex.ru ? String(ex.ru).trim() : "Пример перевода",
                    en: ex.en ? String(ex.en).trim() : "Example usage"
                  }));
                }
              } else if (card.type === "container" && Array.isArray(card.chips)) {
                card.chips = card.chips.map((chip: any) => {
                  if (!Array.isArray(chip.examples) || chip.examples.length === 0) {
                    chip.examples = [{ ru: "Пример перевода", en: "Example usage" }];
                  } else {
                    chip.examples = chip.examples.map((ex: any) => ({
                      ru: ex.ru ? String(ex.ru).trim() : "Пример перевода",
                      en: ex.en ? String(ex.en).trim() : "Example usage"
                    }));
                  }
                  return chip;
                });
              }
              return card;
            });
          }

          // 6. Safe database Cache UPSERT
          if (supabaseClient) {
            try {
              // Wrap UPSERT in try/catch to absorb missing column errors
              const updatePayload = {
                canonical: canon,
                updated_at: new Date().toISOString(),
                cards_json: parsedCards
              };
              const { error } = await supabaseClient.from("word_breakdowns").upsert(updatePayload);
              if (error) {
                console.warn(`[AI-Breakdown] [DATABASE UPSERT WARNING] Failed to cache cards_json:`, error);
              } else {
                console.log(`[AI-Breakdown] Cache SAVE (cards_json) for canonical "${canon}" succeeded.`);
              }
            } catch (dbErr) {
              console.warn("[AI-Breakdown] [DATABASE UPSERT EXCEPTION] Caught exception during UPSERT:", dbErr);
            }
          }

          return new Response(JSON.stringify(parsedCards), { headers });
        }
        
        return new Response("Unknown mode", { status: 400 });
      },
    },
  },
});
