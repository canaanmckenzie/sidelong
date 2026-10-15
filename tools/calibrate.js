// @ts-check
/**
 * Measure real embedding similarities over the fixture deck: each fixture
 * question against every other page's question+answer vector, the same
 * comparison jev makes at submit time. Prints the cosine matrix used to
 * fit the EMB calibration in src/jev.js (floor between the strongest
 * unrelated score and the weakest related one; k so a known follow-up
 * clears 0.8 confidence). Re-run when EMBED_MODEL changes.
 *
 * Needs Ollama up:  node tools/calibrate.js [model]
 */
import { SEED } from "../src/fixtures.js";
import { cosineVec } from "../src/jev.js";

const model = process.argv[2] ?? "nomic-embed-text";
const texts = [
  ...SEED.map((p) => p.q + " " + p.a.join(" ")), // 0..n-1: pages (q+a)
  ...SEED.map((p) => p.q),                       // n..2n-1: questions alone
];

const res = await fetch("http://127.0.0.1:11434/api/embed", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model, input: texts }),
});
if (!res.ok) {
  console.error(`ollama said ${res.status} — is it running, and is "${model}" pulled?`);
  process.exit(1);
}
const { embeddings } = await res.json();

const n = SEED.length;
const names = SEED.map((p) => p.q.toLowerCase().replace(/[^a-z ]/g, "").split(" ").slice(0, 2).join("-"));
console.log(`model: ${model} (${embeddings[0].length} dims)`);
console.log("question ↓ → page (q+a vector):\n");
console.log("".padEnd(16) + names.map((s) => s.slice(0, 7).padStart(8)).join(""));
for (let qi = 0; qi < n; qi++) {
  const row = [];
  for (let pi = 0; pi < n; pi++) {
    row.push(pi === qi ? "—".padStart(8) : cosineVec(embeddings[n + qi], embeddings[pi]).toFixed(3).padStart(8));
  }
  console.log(names[qi].padEnd(16) + row.join(""));
}
