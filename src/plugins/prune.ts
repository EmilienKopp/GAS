import { Checkbox, Confirm, Input } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";
import { run } from "../core/shell.ts";
import { header, success, warn } from "../core/ui.ts";
import type { Plugin } from "../core/types.ts";

const PROTECTED = ["main", "master", "develop"];

async function localPrune() {
  header("Local prune");

  const pattern = (await Input.prompt({
    message: "Branch pattern (substring or regex, e.g. feature/)",
    validate: (v: string) => v.trim().length > 0 || "Pattern is required",
  })).trim();

  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    warn("Invalid regex.");
    return;
  }

  const { stdout: current } = await run("git", ["branch", "--show-current"]);
  const { stdout } = await run("git", ["branch", "--format=%(refname:short)"]);

  const matched = stdout
    .split("\n")
    .map(b => b.trim())
    .filter(Boolean)
    .filter(b => re.test(b))
    .filter(b => b !== current && !PROTECTED.includes(b));

  if (matched.length === 0) {
    warn(`No local branches match "${pattern}" (current and ${PROTECTED.join("/")} are always excluded).`);
    return;
  }

  const selected = await Checkbox.prompt({
    message: `${matched.length} branch(es) matched — select which to delete`,
    options: matched.map(b => ({ name: b, value: b, checked: true })),
  });

  if (selected.length === 0) {
    warn("Nothing selected.");
    return;
  }

  console.log(colors.yellow(`\n  About to soft-delete (git branch -d) ${selected.length} branch(es):\n`));
  for (const b of selected) console.log(`    ${colors.red(b)}`);
  console.log();

  const sure = await Confirm.prompt({ message: "Delete these branches?", default: false });
  if (!sure) {
    warn("Aborted.");
    return;
  }

  const typed = await Input.prompt({ message: `Type ${colors.bold("DELETE")} to confirm` });
  if (typed.trim() !== "DELETE") {
    warn("Aborted (confirmation text did not match).");
    return;
  }

  let deleted = 0;
  const failed: string[] = [];

  for (const branch of selected) {
    const { code } = await run("git", ["branch", "-d", branch], { silent: true });
    if (code === 0) {
      deleted++;
      console.log(colors.green(`  ✓ deleted ${branch}`));
    } else {
      failed.push(branch);
      console.log(colors.yellow(`  ✗ kept ${branch} (not fully merged)`));
    }
  }

  if (deleted > 0) success(`Deleted ${deleted} branch(es).`);
  if (failed.length > 0) {
    warn(`${failed.length} branch(es) kept because they are not fully merged.\n  Delete manually with git branch -D if you are sure.`);
  }
}

export const prunePlugin: Plugin = {
  name: "Local prune",
  run: localPrune,
};
