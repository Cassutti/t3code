/**
 * Points the T3 acpRegistry ZCode instance at the patched adapter
 * (USERPROFILE/zcode-acp-patched, override with ADAPTER_DIR). The instance is
 * matched dynamically: driver acpRegistry + id/config containing "zcode".
 * Run with T3 Code closed; backs up settings.json once.
 */
const fs = require("node:fs");
const path = require("node:path");

const SETTINGS = path.join(
  process.env.T3_USERDATA ?? path.join(require("node:os").homedir(), ".t3", "userdata"),
  "settings.json",
);
const ADAPTER_DIR =
  process.env.ADAPTER_DIR ?? path.join(require("node:os").homedir(), "zcode-acp-patched");
const CLI = path.join(ADAPTER_DIR, "dist", "cli.js");
const NODE_EXE = process.execPath;

if (!fs.existsSync(CLI)) {
  console.error(`patched adapter not found at ${CLI} — build the zcode-acp fork first`);
  process.exit(1);
}
const raw = fs.readFileSync(SETTINGS, "utf8");
const settings = JSON.parse(raw);
settings.providerInstances = settings.providerInstances ?? {};

const isZcode = (id, inst) =>
  id.toLowerCase().includes("zcode") ||
  JSON.stringify(inst?.config ?? {})
    .toLowerCase()
    .includes("zcode-acp") ||
  JSON.stringify(inst?.config ?? {})
    .toLowerCase()
    .includes("zcode-acp-patched");

let instanceId = null;
for (const [id, inst] of Object.entries(settings.providerInstances)) {
  if (inst?.driver === "acpRegistry" && isZcode(id, inst)) {
    instanceId = id;
    break;
  }
}
if (instanceId === null) {
  instanceId = "acpRegistry_zcode";
  settings.providerInstances[instanceId] = {
    instanceId: "acpRegistry_zcode",
    driver: "acpRegistry",
    displayName: "ZCode",
    enabled: true,
    config: {},
  };
  console.log(`no zcode ACP instance found — created ${instanceId}`);
}

const BACKUP = SETTINGS + ".pre-zcode-patch.bak";
if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, raw);

const instance = settings.providerInstances[instanceId];
instance.enabled = true;
instance.config = instance.config ?? {};
instance.config.enabled = true;
instance.config.source = "local";
instance.config.commandPath = NODE_EXE;
instance.config.commandArgs = [CLI, "server"];
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + "\n");
console.log(`settings.json updated: ${instanceId} -> ${CLI} server`);
console.log(`backup: ${BACKUP}`);
