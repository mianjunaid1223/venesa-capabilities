"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: youtube-search
 *  Search YouTube for a query and open results in browser.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");

module.exports = {
  schema: z.object({
    query: z.string().trim().min(1).describe("The search query"),
  }),
  name: "youtubeSearch",
  description:
    "Opens the YouTube search results page in the default browser for a given search query. Use when the user asks to search, find, watch, or look up anything on YouTube. Requires a non-empty search query.",
  tags: ["web", "search", "youtube", "video"],

  returnType: "action",
  marker: "announce",
  ui: null,

  examples: [
    {
      user: "search YouTube for lo-fi music",
      action: "[action: youtubeSearch, query: lo-fi music]",
    },
  ],

  async handler(params) {
    try {
      const { shell } = require("electron");
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(params.query.trim())}`;
      await shell.openExternal(url);
      return { success: true, result: `Searching YouTube for: ${params.query}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
