import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, component, hook, english, arabic] = await Promise.all([
  readFile(new URL("./LessonsPage.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../components/LessonDevelopment.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../hooks/use-lessons.ts", import.meta.url), "utf8"),
  readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
  readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
]);

test("lesson closeout is available only to development staff", () => {
  for (const role of [
    "coach",
    "academy_admin",
    "stable_manager",
    "platform_admin",
  ]) {
    assert.match(page, new RegExp(`"${role}"`));
  }
  assert.match(page, /lesson\.developmentReport\?\.status !== "approved"/);
  assert.match(
    page,
    /\["confirmed", "completed"\]\.includes\(lesson\.status\)/,
  );
});

test("rider reflections require an approved report owned by the rider", () => {
  assert.match(
    component,
    /report\.status === "approved" && user\?\.id === lesson\.riderId/,
  );
  assert.match(hook, /\.from\("lesson_development_reflections"\)/);
  assert.match(hook, /visible_to_guardian: visibleToGuardian/);
});

test("development data uses guarded save and approval RPCs", () => {
  assert.match(hook, /"save_lesson_development_report"/);
  assert.match(hook, /"approve_lesson_development_report"/);
  assert.match(hook, /\.from\("rider_competency_evidence"\)/);
  assert.match(hook, /\.from\("rider_competency_catalog"\)/);
  assert.doesNotMatch(hook, /\.from\("lesson_development_private_notes"\)/);
  assert.doesNotMatch(hook, /\.from\("lesson_development_report_history"\)/);
});

test("approval requires a meaningful summary, next focus, and evidence", () => {
  assert.match(component, /draft\.summary\.trim\(\)\.length >= 10/);
  assert.match(component, /draft\.nextFocus\.trim\(\)\.length >= 3/);
  assert.match(component, /selectedCompetencies\.length > 0/);
});

test("rider-development copy exists in English and Arabic", () => {
  const en = JSON.parse(english);
  const ar = JSON.parse(arabic);
  assert.equal(en.translation.lessons.development.title, "Rider development");
  assert.equal(ar.translation.lessons.development.title, "تطور الفارس");
  assert.ok(en.translation.lessons.development.privateNoteHelp);
  assert.ok(ar.translation.lessons.development.privateNoteHelp);
});
