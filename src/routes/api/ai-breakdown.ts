import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { LIGHT_BREAKDOWN_PROMPT, FULL_BREAKDOWN_PROMPT, SENTENCE_BREAKDOWN_PROMPT } from "./-prompts";

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

export const Route = createFileRoute("/api/ai-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let { input, mode, canonical, pos, type } = (await request.json()) as { 
          input?: string; 
          mode: "light" | "full" | "sentence";
          canonical?: string;
          pos?: string;
          type?: string;
        };
        
        mode = mode || "light";
        const model = mode === "sentence" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";
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
            
            // If full breakdown also exists, return a unified structure containing both!
            if (breakdownRow.full) {
              console.log(`[AI-Breakdown] Cache HIT for "${rawInput}" (resolved: "${breakdownRow.canonical}"). Returning both light and full breakdowns.`);
              return new Response(JSON.stringify({ _light: cachedJson, breakdown: breakdownRow.full }), { headers });
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
              let accumulatedText = "";
              
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
                        accumulatedText += json.delta.text;
                        controller.enqueue(encoder.encode(json.delta.text));
                      }
                    } catch {}
                  }
                }
              } catch (err) {
                controller.error(err);
                return;
              }

              if (accumulatedText && supabaseClient) {
                try {
                  const parsedLight = cleanAndParseJson(accumulatedText);
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

                    // 2. Also upsert canonical mapping (canon -> canon) if different to ensure direct searches hit cache
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
                    
                    // Upsert into word_breakdowns (since full is omitted, PostgreSQL DO UPDATE will leave it intact)
                    const { error: breakdownErr } = await supabaseClient
                      .from("word_breakdowns")
                      .upsert(updatePayload);
                    
                    if (breakdownErr) {
                      console.error(`[AI-Breakdown] [DATABASE ERROR] Failed to save light_json to word_breakdowns for canonical: "${canon}", rawInput: "${rawInput}". Error:`, breakdownErr);
                    } else {
                      console.log(`[AI-Breakdown] [SUCCESS] Saved light_json to word_breakdowns for canonical "${canon}".`);
                    }
                  } else {
                    console.log(`[AI-Breakdown] Claude response is not a word mode. Mode: "${parsedLight.mode || ''}". Skip database caching.`);
                  }
                } catch (err) {
                  console.error(`[AI-Breakdown] [ERROR] Exception parsing/caching light breakdown for rawInput "${rawInput}":`, err);
                }
              }
              controller.close();
            }
          });

          return new Response(stream, { headers });

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

          return new Response(stream, { headers });

        } else if (mode === "full") {
          if (!canonical) {
            return new Response("Missing canonical for full mode.", { status: 400 });
          }
          const canonKey = canonical.trim();
          // pos and type are optional — enrich the prompt when present
          pos = pos || "";
          type = type || "";

          let breakdownRow: any = null;
          if (supabaseClient) {
            try {
              const { data, error } = await supabaseClient
                .from("word_breakdowns")
                .select("*")
                .eq("canonical", canonKey)
                .single();
              if (error && error.code !== "PGRST116") {
                console.error("Error checking existing word_breakdowns for full mode cache:", error);
              }
              if (!error && data) {
                breakdownRow = data;
              }
            } catch (e) {
              console.error("Error reading cache:", e);
            }
          }

          if (breakdownRow && breakdownRow.full) {
            return new Response(JSON.stringify(breakdownRow.full), { headers });
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
                  text: FULL_BREAKDOWN_PROMPT,
                  cache_control: { type: "ephemeral", ttl: "1h" },
                },
              ],
              messages: [
                {
                  role: "user",
                  content: JSON.stringify({ canonical: canonKey, pos, type }),
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
              let accumulatedText = "";
              
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
                        accumulatedText += json.delta.text;
                        controller.enqueue(encoder.encode(json.delta.text));
                      }
                    } catch {}
                  }
                }
              } catch (err) {
                console.error("Error during upstream Claude stream reading (full mode):", err);
                controller.error(err);
                return;
              }

              if (accumulatedText && supabaseClient) {
                try {
                  const parsedFull = cleanAndParseJson(accumulatedText);
                  const updatePayload: any = {
                    canonical: canonKey,
                    updated_at: new Date().toISOString(),
                    full: parsedFull
                  };
                  
                  const { error: breakdownErr } = await supabaseClient.from("word_breakdowns").upsert(updatePayload);
                  if (breakdownErr) {
                    console.error(`[AI-Breakdown] [DATABASE ERROR] Failed to save full_json to word_breakdowns for canonical "${canonKey}". Error details:`, breakdownErr);
                  } else {
                    console.log(`[AI-Breakdown] [SUCCESS] Saved full_json to word_breakdowns for canonical "${canonKey}".`);
                  }
                } catch (err) {
                  console.error(`[AI-Breakdown] [ERROR] Exception parsing/caching full breakdown for canonical "${canonKey}":`, err);
                }
              }
              controller.close();
            }
          });

          return new Response(stream, { headers });
        }
        
        return new Response("Unknown mode", { status: 400 });
      },
    },
  },
});
