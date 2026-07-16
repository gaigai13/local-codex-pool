import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const secrets = JSON.parse(await readFile(path.join(root, ".local", "secrets.json"), "utf8"));
const slash = (value) => value.replaceAll("\\", "/");

const importsDir = path.join(root, ".local", "imports");
const managerDir = path.join(root, "manager-data");
const cpampDir = path.join(root, "runtime", "cpamp", "cpa-manager-plus_v1.11.2_windows_amd64");
await Promise.all([mkdir(importsDir, { recursive: true }), mkdir(managerDir, { recursive: true }), mkdir(cpampDir, { recursive: true })]);

for (const item of secrets.exports) {
  const name = path.basename(item.name);
  await writeFile(path.join(importsDir, name), `${JSON.stringify(item.data, null, 2)}\n`, { mode: 0o600 });
}

const cpaConfig = `host: "127.0.0.1"
port: 8317
remote-management:
  allow-remote: false
  secret-key: "${secrets.management_key}"
  disable-control-panel: false
auth-dir: "${slash(path.join(root, "auths"))}"
api-keys:
  - "${secrets.api_key}"
debug: false
logging-to-file: true
usage-statistics-enabled: true
passthrough-headers: true
request-retry: 3
max-retry-credentials: 3
max-retry-interval: 30
disable-cooling: false
save-cooldown-status: true
routing:
  strategy: "round-robin"
  session-affinity: false
streaming:
  keepalive-seconds: 15
  bootstrap-retries: 1
`;
await writeFile(path.join(root, "cpa-config.yaml"), cpaConfig, { mode: 0o600 });
await writeFile(path.join(managerDir, "cpa-management-key.txt"), `${secrets.management_key}\n`, { mode: 0o600 });
await writeFile(path.join(managerDir, "cpamp-admin-key.txt"), `${secrets.admin_key}\n`, { mode: 0o600 });

const managerConfig = {
  httpAddr: "127.0.0.1:18317",
  dataDir: slash(managerDir),
  cpaUpstreamUrl: "http://127.0.0.1:8317",
  managementKeyFile: slash(path.join(managerDir, "cpa-management-key.txt")),
  adminKeyFile: slash(path.join(managerDir, "cpamp-admin-key.txt")),
  collectorMode: "http",
  pollIntervalMs: 500,
  quotaCooldownEnabled: true,
  accountActionsEnabled: true,
  accountActionsAutoDisable: false,
};
await writeFile(path.join(cpampDir, "config.json"), `${JSON.stringify(managerConfig, null, 2)}\n`, { mode: 0o600 });
console.log("Generated machine-local configuration");
