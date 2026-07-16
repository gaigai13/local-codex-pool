import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [url, output, expectedRaw] = process.argv.slice(2);
const expected = expectedRaw?.toLowerCase();
if (!url || !output || !/^[a-f0-9]{64}$/.test(expected ?? "")) throw new Error("Usage: node download.mjs <url> <output> <sha256>");

async function validExisting() {
  try {
    const data = await readFile(output);
    return createHash("sha256").update(data).digest("hex") === expected;
  } catch {
    return false;
  }
}

if (!(await validExisting())) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      const actual = createHash("sha256").update(data).digest("hex");
      if (actual !== expected) throw new Error(`SHA256 mismatch: ${actual}`);
      await writeFile(output, data);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  if (lastError) throw lastError;
}

console.log(`Verified ${path.basename(output)}`);
