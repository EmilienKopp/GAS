#!/usr/bin/env -S deno run --allow-run --allow-env --allow-read --allow-write

import { menu } from "./src/core/ui.ts";
import { plugins } from "./src/plugins/index.ts";

await menu("GAS — Git Assistance System", plugins, { exitLabel: "Exit" });
