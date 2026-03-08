"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: get-weather
 *  Open weather information for a location.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");

module.exports = {
  schema: z.object({ location: z.string().optional().describe("City or location name to check the weather for, e.g. 'London' or 'New York'. Omit to get a generic weather page.") }),
  name: "getWeather",
  description:
    "Opens a live Google weather search in the browser for a given city or location. Use when the user asks about the current weather, temperature, forecast, or conditions for any place. Accepts an optional location; defaults to generic weather if none is given.",
  tags: ["weather", "forecast"],

  returnType: "action",
  marker: "announce",

  examples: [
    {
      user: "what is the weather in London",
      action: "[action: getWeather, location: London]",
    },
  ],

  async handler(params) {
    try {
      const { shell } = require("electron");
      const location = params?.location || "";
      const query = location ? `weather ${location}` : "weather";
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await shell.openExternal(url);
      return { success: true, result: location ? `Checking weather for ${location}` : "Opening weather info" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
