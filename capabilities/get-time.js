"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: get-time
 *  Get current date and time.
 * ═══════════════════════════════════════════════════════════════
 */
const { z } = require("zod");

module.exports = {
  schema: z.object({}),
  name: "getTime",
  description:
    "Returns the current local time and full date including day of the week. Use when the user asks what time it is, today's date, what day it is, or any question about the current moment.",
  tags: ["time", "date"],

  returnType: "data",
  marker: "silently",
  ui: null,

  examples: [{ user: "what time is it", action: "[action: getTime]" }],

  async handler() {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      return { success: true, result: { time: timeStr, date: dateStr, full: `${timeStr} on ${dateStr}` } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
