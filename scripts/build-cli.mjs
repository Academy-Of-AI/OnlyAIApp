#!/usr/bin/env node
/**
 * Generate cli/engine.mjs from the SSOT (lib/pilot/drift-rules.mjs) so the CLI
 * runs the SAME rules + audit engine LOCALLY (code never leaves the user's
 * machine) without a committed copy that could drift. Runs in dev and
 * automatically via the cli package's `prepublishOnly`. cli/engine.mjs is
 * gitignored — it's a build artifact, regenerated from the one source.
 */
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "lib", "pilot", "drift-rules.mjs");
const dest = join(root, "cli", "engine.mjs");
copyFileSync(src, dest);
console.log("built cli/engine.mjs from lib/pilot/drift-rules.mjs");
