"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: currency-convert
 *  Convert amounts between currencies using live exchange rates.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
// dependencies: ['axios@1.7.9']

module.exports = {
  name: "convertCurrency",
  description:
    "Converts a monetary amount from one currency to another using live exchange rates. Use when the user asks to convert money, exchange rates, or how much something costs in a different currency. Requires an amount, a source currency code, and a target currency code.",
  tags: ["currency", "money", "finance", "convert", "exchange"],

  returnType: "data",
  marker: "silently",
  ui: null,
  dependencies: ["axios@1.7.9"],

  schema: z.object({
    amount: z.number().positive().describe("The amount of money to convert."),
    from: z
      .string()
      .trim()
      .length(3)
      .toUpperCase()
      .describe("Source currency code, e.g. USD, EUR, GBP."),
    to: z
      .string()
      .trim()
      .length(3)
      .toUpperCase()
      .describe("Target currency code, e.g. EUR, JPY, PKR."),
  }),

  examples: [
    {
      user: "convert 100 USD to EUR",
      action: "[action: convertCurrency, amount: 100, from: USD, to: EUR]",
    },
    {
      user: "how much is 50 pounds in dollars",
      action: "[action: convertCurrency, amount: 50, from: GBP, to: USD]",
    },
    {
      user: "what is the PKR to dollar rate",
      action: "[action: convertCurrency, amount: 1, from: PKR, to: USD]",
    },
  ],

  async handler({ amount, from, to }) {
    try {
      const axios = require("axios");

      const response = await axios.get(
        `https://open.er-api.com/v6/latest/${from.toUpperCase()}`,
        { timeout: 8000 },
      );

      const data = response.data;

      if (data.result === "error") {
        return {
          success: false,
          error:
            data["error-type"] === "unsupported-code"
              ? `"${from.toUpperCase()}" is not a supported currency code.`
              : `Exchange rate API error: ${data["error-type"]}`,
        };
      }

      const toUpper = to.toUpperCase();
      const rate = data.rates?.[toUpper];

      if (rate === undefined) {
        return {
          success: false,
          error: `"${toUpper}" is not a supported currency code.`,
        };
      }

      const converted = amount * rate;
      const rateDisplay =
        rate < 0.01
          ? rate.toExponential(4)
          : rate.toLocaleString("en-US", { maximumFractionDigits: 6 });

      return {
        success: true,
        from: from.toUpperCase(),
        to: toUpper,
        amount,
        converted: parseFloat(converted.toFixed(4)),
        rate: parseFloat(rate.toFixed(6)),
        summary: `${amount} ${from.toUpperCase()} = ${converted.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${toUpper}`,
        rateInfo: `1 ${from.toUpperCase()} = ${rateDisplay} ${toUpper}`,
        updatedAt: data.time_last_update_utc,
      };
    } catch (err) {
      const isOffline =
        err.code === "ENOTFOUND" ||
        err.code === "ECONNREFUSED" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNABORTED" ||
        err.code === "ERR_NETWORK" ||
        err.message?.toLowerCase().includes("network");

      if (isOffline) {
        return {
          success: false,
          error:
            "No internet connection. Please check your connection and try again.",
        };
      }

      return { success: false, error: err.message };
    }
  },
};
