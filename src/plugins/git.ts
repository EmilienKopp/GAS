import { Checkbox, Confirm, Input, Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";
import { run, runInherited } from "../core/shell.ts";
import { header, menu, success, warn } from "../core/ui.ts";
import type { Plugin } from "../core/types.ts";

async function gitSwitch() {
  header("Switch branch");

  const { stdout } = await run("git", ["branch", "-a", "--format=%(refname:short)"]);
  const branches = stdout
    .split("\n")
    .map(b => b.trim().replace(/^origin\//, ""))
    .filter(Boolean)
    .filter((b, i, arr) => arr.indexOf(b) === i) // dedupe
    .sort();

  const selected = await Select.prompt({
    message: "Select a branch",
    search: true,
    options: [
      ...branches.map(b => ({ name: b, value: b })),
      { name: colors.dim("← Back"), value: "back" },
    ],
  });

  if (selected === "back") return;

  const code = await runInherited("git", ["switch", selected]);
  if (code === 0) success(`Switched to ${selected}`);
}

async function gitPull() {
  header("Pull");
  await runInherited("git", ["pull"]);
}

async function gitPush() {
  header("Push");
  await runInherited("git", ["push"]);
}

async function gitCommit() {
  header("Commit");

  const { stdout: statusOut } = await run("git", ["status", "--short"]);

  if (!statusOut) {
    warn("Nothing to commit.");
    return;
  }

  const files = statusOut.split("\n").filter(Boolean).map(line => ({
    status: line.slice(0, 2).trim(),
    path: line.slice(2).trimStart(),
  }));

  const staged = await Checkbox.prompt({
    message: "Select files to stage",
    options: files.map(f => ({
      name: `${f.status.padEnd(2)} ${f.path}`,
      value: f.path,
      checked: f.status !== "??", // pre-check already tracked files
    })),
  });

  if (staged.length === 0) {
    warn("No files selected.");
    return;
  }

  await run("git", ["add", "--", ...staged]);

  const message = await Input.prompt({ message: "Commit message" });

  if (!message.trim()) {
    warn("Empty message, aborting.");
    return;
  }

  const code = await runInherited("git", ["commit", "-m", message]);
  if (code === 0) success("Committed.");
}

async function gitAmend() {
  header("Amend last commit");

  const { stdout: lastMessage } = await run("git", ["log", "-1", "--pretty=%s"]);
  if (!lastMessage) {
    warn("No commit to amend.");
    return;
  }
  console.log(`  ${colors.dim("Amending:")} ${colors.yellow(lastMessage)}\n`);

  // warn if the commit is already on a remote (amending will require a force push)
  const { stdout: remoteRefs } = await run("git", ["branch", "-r", "--contains", "HEAD"], { silent: true });
  if (remoteRefs) {
    warn("This commit is already pushed. After amending you will need git push --force-with-lease.");
  }

  const { stdout: statusOut } = await run("git", ["status", "--short"]);
  if (statusOut) {
    const files = statusOut.split("\n").filter(Boolean).map(line => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(2).trimStart(),
    }));

    const staged = await Checkbox.prompt({
      message: "Select files to add to the previous commit",
      options: files.map(f => ({
        name: `${f.status.padEnd(2)} ${f.path}`,
        value: f.path,
        checked: f.status !== "??",
      })),
    });

    if (staged.length > 0) {
      await run("git", ["add", "--", ...staged]);
    }
  } else {
    console.log(colors.dim("  Working tree clean — amending message flags only.\n"));
  }

  const skipCi = await Confirm.prompt({ message: "Add [skip ci] to the commit message (skip CI)?", default: false });

  let code: number;
  if (skipCi && !lastMessage.includes("[skip ci]")) {
    // -m only replaces the subject line; use %B to keep the full body intact
    const { stdout: fullMessage } = await run("git", ["log", "-1", "--pretty=%B"]);
    code = await runInherited("git", ["commit", "--amend", "-m", `${fullMessage} [skip ci]`]);
  } else {
    code = await runInherited("git", ["commit", "--amend", "--no-edit"]);
  }

  if (code === 0) success("Amended.");
}

async function showCurrentBranch() {
  const { stdout: branch } = await run("git", ["branch", "--show-current"]);
  console.log(`  ${colors.dim("Branch:")} ${colors.yellow(branch)}\n`);
}

export const gitPlugin: Plugin = {
  name: "Git",
  run: () =>
    menu("Git", [
      { name: "Switch branch", run: gitSwitch },
      { name: "Pull", run: gitPull },
      { name: "Push", run: gitPush },
      { name: "Commit", run: gitCommit },
      { name: "Amend last commit", run: gitAmend },
    ], { banner: showCurrentBranch }),
};
