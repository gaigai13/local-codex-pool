import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scrypt = promisify(scryptCallback);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const password = process.env.CPA_BUNDLE_PASSWORD;
const [command, inputArg, outputArg] = process.argv.slice(2);

if (!password) throw new Error("CPA_BUNDLE_PASSWORD is required");

async function deriveKey(passwordValue, salt) {
  return scrypt(passwordValue, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

async function collectSecrets() {
  const exports = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    try {
      const data = JSON.parse(await readFile(path.join(root, entry.name), "utf8"));
      if (data?.type === "sub2api-data" && Array.isArray(data.accounts)) exports.push({ name: entry.name, data });
    } catch {
      // Ignore unrelated JSON files.
    }
  }
  if (!exports.length) throw new Error("No Sub2API export JSON found in project root");

  const yaml = await readFile(path.join(root, "cpa-config.yaml"), "utf8");
  const managementKey = (await readFile(path.join(root, "manager-data", "cpa-management-key.txt"), "utf8")).trim();
  const apiKey = yaml.match(/api-keys:\s*\r?\n\s*-\s*["']([^"']+)["']/)?.[1];
  const adminKey = (await readFile(path.join(root, "manager-data", "cpamp-admin-key.txt"), "utf8")).trim();
  if (!managementKey || !apiKey || !adminKey) throw new Error("Failed to read current API/management/admin keys");
  return { version: 1, api_key: apiKey, management_key: managementKey, admin_key: adminKey, exports };
}

async function encrypt(outputPath) {
  const plaintext = Buffer.from(JSON.stringify(await collectSecrets()), "utf8");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = {
    version: 1,
    cipher: "aes-256-gcm",
    kdf: "scrypt-N32768-r8-p1",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  await writeFile(outputPath, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });
  console.log(`Encrypted ${envelope.cipher} bundle written to ${outputPath}`);
}

async function decrypt(inputPath, outputPath) {
  const envelope = JSON.parse(await readFile(inputPath, "utf8"));
  if (envelope.version !== 1 || envelope.cipher !== "aes-256-gcm") throw new Error("Unsupported encrypted bundle format");
  const salt = Buffer.from(envelope.salt, "base64");
  const key = await deriveKey(password, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  const data = JSON.parse(plaintext.toString("utf8"));
  if (!data.api_key || !data.management_key || !data.admin_key || !Array.isArray(data.exports)) throw new Error("Invalid decrypted bundle");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  console.log(`Decrypted secrets written to ${outputPath}`);
}

if (command === "encrypt") await encrypt(path.resolve(root, inputArg ?? "secrets.enc"));
else if (command === "decrypt" && inputArg && outputArg) await decrypt(path.resolve(root, inputArg), path.resolve(root, outputArg));
else throw new Error("Usage: node scripts/secrets.mjs encrypt [output] | decrypt <input> <output>");
