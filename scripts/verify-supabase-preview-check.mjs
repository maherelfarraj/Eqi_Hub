import { evaluateSupabasePreviewCheck } from "./supabase-preview-check.mjs";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let payload;
try {
  payload = JSON.parse(input);
} catch {
  console.error("Supabase Preview check response was not valid JSON.");
  process.exit(1);
}

const result = evaluateSupabasePreviewCheck(payload);
console.log(result.code);
process.exit(result.state === "success" ? 0 : result.state === "waiting" ? 3 : 1);