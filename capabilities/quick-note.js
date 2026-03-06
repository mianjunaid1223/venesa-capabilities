"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: quick-note
 *  Capture and retrieve quick notes by voice or text.
 *  Persistent via local file storage.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");

module.exports = {
  name: "quickNote",
  description:
    "Persistently saves and retrieves short text notes using the memory system. Supports five operations: add (save a new note), list (show all notes), search (find notes by keyword), delete (remove a note by index), clear (wipe all notes). Use whenever the user wants to save, recall, find, or delete a note or reminder.",
  tags: ["note", "memo", "reminder", "save", "write"],

  returnType: "memory",
  marker: "silently",
  ui: null,

  schema: z.object({
    operation: z
      .enum(["add", "list", "search", "delete", "clear"])
      .describe("Operation to perform: 'add' to save a new note, 'list' to show all notes, 'search' to find notes by keyword, 'delete' to remove a note by index, 'clear' to wipe all notes."),
    text: z.string().optional().describe("Note text for 'add', or search keyword for 'search'."),
    index: z.number().int().optional().describe("Zero-based index of the note to delete. Required for 'delete'."),
  }),

  examples: [
    {
      user: "save a note buy groceries",
      action: "[action: quickNote, operation: add, text: buy groceries]",
    },

    { user: "show my notes", action: "[action: quickNote, operation: list]" },
  ],

  async handler(params) {
    try {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");

      const NOTES_FILE = path.join(os.homedir(), ".venesa", "quick-notes.json");

      function getNotes() {
        try {
          if (!fs.existsSync(NOTES_FILE)) return [];
          return JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
        } catch {
          return [];
        }
      }

      function saveNotes(notes) {
        try {
          const dir = path.dirname(NOTES_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), "utf8");
          return true;
        } catch {
          return false;
        }
      }

      const { operation, text, index } = params;
      const notes = getNotes();

    switch (operation) {
      case "add": {
        if (!text) return { success: false, error: "Note text required." };
        notes.unshift({
          text,
          created: new Date().toISOString(),
          id: Date.now(),
        });
        const saved = saveNotes(notes);
        if (!saved) return { success: false, error: "Failed to save note." };
        return { success: true, total: notes.length };
      }

      case "list": {
        if (notes.length === 0) return { success: true, empty: true, notes: [] };
        const items = notes.map((n, i) => ({
          index: i,
          text: n.text,
          date: new Date(n.created).toLocaleDateString(),
        }));
        return { success: true, notes: items, total: items.length };
      }

      case "search": {
        if (!text) return { success: false, error: "Search text required." };
        const lower = text.toLowerCase();
        const results = [];
        for (let i = 0; i < notes.length; i++) {
          const safeText =
            typeof notes[i].text === "string"
              ? notes[i].text
              : String(notes[i].text || "");
          if (safeText.toLowerCase().includes(lower)) {
            results.push({
              index: i,
              text: safeText,
              date: new Date(notes[i].created).toLocaleDateString(),
            });
          }
        }
        return { success: true, results, total: results.length };
      }

      case "delete": {
        if (
          index === undefined ||
          index === null ||
          typeof index !== "number"
        ) {
          return { success: false, error: "Explicit numeric index required for delete." };
        }
        if (index < 0 || index >= notes.length) {
          return { success: false, error: `No note at index ${index}.` };
        }
        const removed = notes.splice(index, 1)[0];
        const saved = saveNotes(notes);
        if (!saved)
          return { success: false, error: "Failed to save after delete." };
        return { success: true, deleted: removed.text };
      }

      case "clear": {
        const saved = saveNotes([]);
        if (!saved)
          return { success: false, error: "Failed to clear notes." };
        return { success: true, message: "All notes cleared." };
      }

      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
  },
};
