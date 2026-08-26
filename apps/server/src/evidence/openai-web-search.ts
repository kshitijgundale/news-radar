import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { env } from "../lib/env.js";
import { renderSearchInput, type SearchContext } from "./search-context.js";
import {
  normalizeSourceCandidates,
  searchResultSchema,
  type SearchResult,
  type WebSearchProvider,
} from "./search-provider.js";

const searchInstructions = `
You discover web sources for Radar, a situation tracker.

Search broadly across news, official sites, government pages, company announcements,
filings, blogs, and public statements as appropriate. The original tracker request is
the permanent relevance boundary. Prefer primary and recent sources.

For RECURRING CHECK mode, prioritize information published or materially updated after
LAST SUCCESSFUL CHECK. Because web indexing may be delayed, you may also include highly
relevant results from up to two hours before that timestamp. Prefer the newest available
reporting. Do not include older background, recaps, explainers, or unchanged articles merely
to fill the result list. Return an empty sources array when no qualifying development is found.

Return source candidates, not a narrative answer. Do not include a URL unless web search
actually surfaced it. Include publication/update times only when the source supports them.
Avoid multiple URLs that are clearly mirrors of the same page. This discovery step is
best-effort and need not be exhaustive.
`.trim();

export class OpenAIWebSearchProvider implements WebSearchProvider {
  public constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async discover(context: SearchContext): Promise<SearchResult> {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: searchInstructions,
      input: renderSearchInput(context),
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      max_tool_calls: 1,
      store: false,
      text: { format: zodTextFormat(searchResultSchema, "radar_source_candidates") },
    });

    if (!response.output_parsed) {
      throw new Error("Web search completed without structured source candidates");
    }

    const sources = normalizeSourceCandidates(response.output_parsed.sources);
    console.info("[radar:web-search] source candidates", {
      mode: context.mode,
      lastSuccessfulCheck: context.searchSince,
      searchedAt: context.checkedAt,
      count: sources.length,
      sources: sources.map((source) => ({
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        publishedOrUpdatedAt: source.publishedAt,
        sourceKind: source.sourceKind,
      })),
    });

    return { sources };
  }
}

export function createWebSearchProvider(): WebSearchProvider {
  return new OpenAIWebSearchProvider(
    new OpenAI({ apiKey: env.SEARCH_API_KEY }),
    env.SEARCH_MODEL,
  );
}
