import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(root, "auths");
const sourceDirs = process.env.CPA_IMPORT_DIR ? [path.resolve(process.env.CPA_IMPORT_DIR)] : [root];

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return new Date(Number(payload.exp) * 1000).toISOString();
  } catch {
    return "";
  }
}

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9._+-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

await mkdir(authDir, { recursive: true });
let imported = 0;

for (const sourceDir of sourceDirs) {
  let entries = [];
  try { entries = await readdir(sourceDir, { withFileTypes: true }); } catch { continue; }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    let data;
    try {
      data = JSON.parse(await readFile(path.join(sourceDir, entry.name), "utf8"));
    } catch {
      continue;
    }
    if (data?.type !== "sub2api-data" || !Array.isArray(data.accounts)) continue;

    for (const account of data.accounts) {
      const credentials = account?.credentials ?? {};
      const accessToken = credentials.access_token;
      const accountId = credentials.chatgpt_account_id ?? account?.extra?.chatgpt_account_id;
      if (account?.platform !== "openai" || typeof accessToken !== "string" || typeof accountId !== "string") continue;

      const email = credentials.email ?? account.name ?? "codex-account";
      const suffix = createHash("sha256").update(accountId).digest("hex").slice(0, 10);
      const outputPath = path.join(authDir, `${safeName(email)}-${suffix}.json`);
      let existing = {};
      try {
        existing = JSON.parse(await readFile(outputPath, "utf8"));
      } catch {
        // First import has no existing CLIProxyAPI auth file.
      }
      const output = {
        type: "codex",
        email,
        access_token: accessToken,
        account_id: accountId,
        expired: tokenExpiry(accessToken),
        last_refresh: data.exported_at ?? new Date().toISOString(),
        plan_type: credentials.plan_type ?? account?.extra?.plan_type ?? "",
        priority: Number(account.priority) || 1,
        note: account.notes ?? `Imported from ${entry.name}`,
        disabled: existing.disabled === true,
      };
      if (typeof credentials.refresh_token === "string" && credentials.refresh_token) output.refresh_token = credentials.refresh_token;
      if (typeof credentials.id_token === "string" && credentials.id_token) output.id_token = credentials.id_token;
      await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
      imported++;
    }
  }
}

console.log(`Imported ${imported} Codex account(s) into ${authDir}`);