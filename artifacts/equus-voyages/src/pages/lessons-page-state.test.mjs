import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./LessonsPage.tsx", import.meta.url),
  "utf8",
);

test("lessons page normalizes the initial query state before rendering", () => {
  assert.match(source, /const lessonItems = lessons\.data \?\? \[\];/);
  assert.match(source, /const trainerItems = trainers\.data \?\? \[\];/);
  assert.match(source, /const horseItems = horses\.data \?\? \[\];/);
  assert.match(source, /lessonItems\.forEach\(\(lesson\) =>/);
  assert.match(source, /lessonItems\.length === 0/);
  assert.match(source, /trainerItems\.map\(\(trainer\) =>/);
  assert.match(source, /horseItems\.map\(\(horse\) =>/);
  assert.doesNotMatch(source, /lessons\.data\.forEach/);
  assert.doesNotMatch(source, /trainers\.data\.(?:map|length)/);
  assert.doesNotMatch(source, /horses\.data\.map/);
});
