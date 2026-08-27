import type { Plugin } from "../core/types.ts";
import { prPlugin } from "./pr.ts";
import { gitPlugin } from "./git.ts";
import { customPlugin } from "./custom.ts";
import { prunePlugin } from "./prune.ts";

/**
 * The main menu is built from this list. To add a feature:
 *   1. Create src/plugins/<name>.ts exporting a Plugin
 *      (a single command, or a submenu via `menu()` — see pr.ts / git.ts).
 *   2. Add it here.
 */
export const plugins: Plugin[] = [
  prPlugin,
  gitPlugin,
  customPlugin,
  prunePlugin,
];
