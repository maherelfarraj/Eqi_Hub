import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./LessonsPage.tsx", import.meta.url),
  "utf8",
);

test("lessons page normalizes the initial query state before rendering", () => {
  assert.match(source, /const lessonItems = lessons\.data \?\? \[\];/);
  assert.match(source, /lessonItems\.forEach\(\(lesson\) =>/);
  assert.match(source, /lessonItems\.length === 0/);
  assert.doesNotMatch(source, /lessons\.data\.forEach/);
});
