import { describe, expect, it } from "vitest";
import { validateJournal, type JournalDraft } from "./journal";
import { importAccountBackup, type HorizonBackup } from "./portable";
const draft: JournalDraft = {
  id: "00000000-0000-4000-8000-000000000001",
  entry_date: "2026-10-01",
  title: "",
  content: "Un moment à retenir.",
  mood: null,
  archived: false,
};
describe("journal validation", () => {
  it("allows untitled entries without a mood", () =>
    expect(() => validateJournal(draft)).not.toThrow());
  it.each(["", "   ", "\n\t"])("rejects empty writing: %j", (content) =>
    expect(() => validateJournal({ ...draft, content })).toThrow(),
  );
  it.each(["2026-02-30", "2026-13-01", "01/10/2026"])(
    "rejects invalid calendar date %s",
    (entry_date) =>
      expect(() => validateJournal({ ...draft, entry_date })).toThrow(),
  );
  it.each([0, 6, 1.5, undefined])("rejects invalid mood %s", (mood) =>
    expect(() => validateJournal({ ...draft, mood: mood as number })).toThrow(),
  );
  it("limits text size", () =>
    expect(() =>
      validateJournal({ ...draft, content: "x".repeat(100001) }),
    ).toThrow());
  it("rejects malformed backup entries before any account write", async () => {
    const backup = {
      format: "horizon-backup",
      version: 1,
      projects: [],
      tasks: [],
      taskConstraints: [],
      routines: [],
      routineExceptions: [],
      calendarSources: [],
      calendarEvents: [],
      plannedSegments: [],
      journalEntries: [{ ...draft, mood: 6 }],
    } as unknown as HorizonBackup;
    await expect(importAccountBackup("test", backup)).rejects.toThrow(
      "ressenti",
    );
  });
});
