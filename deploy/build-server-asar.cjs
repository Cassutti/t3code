/**
 * Rebuilds resources/server.asar from the installed official archive with only
 * apps/server/dist overlaid by the patched build in this clone. Never deletes
 * the official web client (apps/server/dist/client) the desktop serves from it.
 * Overrides: T3_RESOURCES (resources dir), T3_OUT_DIR (output dir).
 */
const { createRequire } = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..");
const req = createRequire(path.join(REPO, "scripts", "package.json"));
const asar = req("@electron/asar");

const LOCALAPPDATA =
  process.env.LOCALAPPDATA ?? path.join(require("node:os").homedir(), "AppData", "Local");
const RES = process.env.T3_RESOURCES ?? path.join(LOCALAPPDATA, "Programs", "t3code", "resources");
const OUT = process.env.T3_OUT_DIR ?? path.join(REPO, ".deploy-out");
const NEW_DIST = path.join(REPO, "apps", "server", "dist");

const ORIGINAL = path.join(RES, "server.asar");
if (!fs.existsSync(ORIGINAL)) {
  console.error(
    `server.asar not found at ${ORIGINAL} — set T3_RESOURCES to the T3 Code resources dir`,
  );
  process.exit(1);
}
if (!fs.existsSync(path.join(NEW_DIST, "bin.mjs"))) {
  console.error(
    `patched dist not built yet: ${NEW_DIST}/bin.mjs missing (run apps/server build:bundle first)`,
  );
  process.exit(1);
}

const WORK = path.join(OUT, "server-asar-work");
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

console.log("[1/4] extracting installed official asar...");
asar.extractAll(ORIGINAL, WORK);

const distTarget = path.join(WORK, "apps", "server", "dist");
if (!fs.existsSync(path.join(distTarget, "client"))) {
  console.error("unexpected: installed archive has no apps/server/dist/client — aborting");
  process.exit(1);
}
console.log("[2/4] overlaying patched dist onto official tree (client/ and natives stay)...");
fs.cpSync(NEW_DIST, distTarget, { recursive: true, filter: (src) => !src.endsWith(".map") });

// MZ-checked .node globs, relative to the pack root (like packWindowsServerAsar).
const globs = ["**/*.dll", "**/*.exe", "**/*.so", "**/*.so.*", "**/*.dylib"];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".node")) {
      const head = Buffer.alloc(2);
      const fd = fs.openSync(full, "r");
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      if (head[0] === 0x4d && head[1] === 0x5a) {
        globs.push(
          "**/" +
            full
              .slice(WORK.length + 1)
              .split(path.sep)
              .join("/"),
        );
      }
    }
  }
};
walk(WORK);

console.log("[3/4] packing (relative cwd, " + globs.length + " unpack globs)...");
const outAsar = path.join(OUT, "server.asar");
const prevCwd = process.cwd();

async function main() {
  process.chdir(WORK);
  // dest must be relative too: asar resolves it against the (changed) cwd.
  const relDest = path.relative(WORK, outAsar);
  try {
    await asar.createPackageWithOptions(".", relDest, {
      dot: true,
      unpack: `{${globs.join(",")}}`,
    });
  } catch (error) {
    console.error("PACK FAILED:", error);
    process.exit(1);
  } finally {
    process.chdir(prevCwd);
  }

  const unpackedDir = path.join(OUT, "server.asar.unpacked");
  const countFiles = (dir) => {
    let n = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
      else n += 1;
    }
    return n;
  };
  const list = asar.listPackage(outAsar).map((f) => String(f).split(path.sep).join("/"));
  const headerFlags = (
    JSON.stringify(asar.getRawHeader(outAsar).header).match(/"unpacked":true/g) ?? []
  ).length;
  const origFlags = (
    JSON.stringify(asar.getRawHeader(ORIGINAL).header).match(/"unpacked":true/g) ?? []
  ).length;
  console.log(
    `[4/4] original=${(fs.statSync(ORIGINAL).size / 1e6).toFixed(1)}MB patched=${(fs.statSync(outAsar).size / 1e6).toFixed(1)}MB`,
  );
  console.log(
    `client=${list.some((f) => f.includes("apps/server/dist/client/")) ? "present" : "MISSING"} | unpacked files=${countFiles(unpackedDir)} | header flags=${headerFlags} (official: ${origFlags})`,
  );
  if (!list.some((f) => f.includes("apps/server/dist/client/")))
    throw new Error("web client missing from packed asar");
  if (headerFlags !== origFlags)
    throw new Error("unpacked flag count differs from the official archive");
  console.log("OK →", outAsar);
  console.log("next: run install.cmd (T3 Code must be closed)");
}

main().catch((error) => {
  console.error("UNEXPECTED:", error);
  process.exit(1);
});
