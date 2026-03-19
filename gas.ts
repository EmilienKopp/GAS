#!/usr/bin/env -S deno run --allow-run --allow-env

import { Table } from "jsr:@cliffy/table@^1.0.0-rc.7";
import { Checkbox, Input, Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

async function run(cmd: string, args: string[], { silent = false } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  const result = await new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();

  const stdout = decoder.decode(result.stdout).trim();
  const stderr = decoder.decode(result.stderr).trim();

  if (!silent && result.code !== 0 && stderr) {
    console.error(colors.red(`\n  ${stderr}\n`));
  }

  return { code: result.code, stdout, stderr };
}

async function runInherited(cmd: string, args: string[]): Promise<number> {
  const { code } = await new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }).output();
  return code;
}

async function gh<T>(...args: string[]): Promise<T> {
  const { code, stdout, stderr } = await run("gh", args);
  if (code !== 0) {
    console.error(colors.red(stderr));
    Deno.exit(1);
  }
  return JSON.parse(stdout) as T;
}

function header(title: string) {
  console.log(colors.bold.cyan(`\n  ${title}\n`));
}

function success(msg: string) {
  console.log(colors.green(`\n  ✓ ${msg}\n`));
}

function warn(msg: string) {
  console.log(colors.yellow(`\n  ${msg}\n`));
}

// ---------------------------------------------------------------------------
// PR section
// ---------------------------------------------------------------------------

async function prStats() {
  header("PR Stats (last 200 merged)");

  const prs = await gh<{ author: { login: string }; createdAt: string; mergedAt: string }[]>(
    "pr", "list", "--limit", "200", "--state", "merged", "--json", "author,createdAt,mergedAt",
  );

  type AuthorStats = { count: number; totalHours: number };
  const byAuthor = new Map<string, AuthorStats>();

  for (const pr of prs) {
    const login = pr.author.login;
    const hours = (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000;
    const existing = byAuthor.get(login) ?? { count: 0, totalHours: 0 };
    byAuthor.set(login, { count: existing.count + 1, totalHours: existing.totalHours + hours });
  }

  const total = prs.length;
  const rows = [...byAuthor.entries()]
    .map(([author, { count, totalHours }]) => ({
      author,
      count,
      pct: Math.round(count * 100 / total),
      avgHours: Math.round(totalHours / count),
    }))
    .sort((a, b) => b.count - a.count);

  new Table()
    .header([colors.bold("Author"), colors.bold("PRs"), colors.bold("% of total"), colors.bold("Avg time to merge")])
    .body(rows.map(r => [r.author, String(r.count), `${r.pct}%`, `${r.avgHours}h`]))
    .border()
    .render();
}

async function checkoutPR() {
  header("Checkout open PR");

  const prs = await gh<{ number: number; title: string; author: { login: string } }[]>(
    "pr", "list", "--state", "open", "--json", "number,title,author",
  );

  if (prs.length === 0) {
    warn("No open PRs.");
    return;
  }

  const selected = await Select.prompt({
    message: "Select a PR",
    options: [
      ...prs.map(pr => ({
        name: `#${pr.number} ${pr.title} ${colors.dim(`— ${pr.author.login}`)}`,
        value: String(pr.number),
      })),
      { name: colors.dim("← Back"), value: "back" },
    ],
  });

  if (selected === "back") return;

  const code = await runInherited("gh", ["pr", "checkout", selected]);
  if (code === 0) success(`Checked out PR #${selected}`);
}

async function prMenu() {
  while (true) {
    header("Pull Requests");

    const action = await Select.prompt({
      message: "What do you want to do?",
      options: [
        { name: "Stats", value: "stats" },
        { name: "Checkout open PR", value: "checkout" },
        { name: colors.dim("← Back"), value: "back" },
      ],
    });

    if (action === "back") return;
    if (action === "stats") await prStats();
    if (action === "checkout") await checkoutPR();
  }
}

// ---------------------------------------------------------------------------
// Git section
// ---------------------------------------------------------------------------

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

async function gitMenu() {
  while (true) {
    header("Git");

    const { stdout: branch } = await run("git", ["branch", "--show-current"]);
    console.log(`  ${colors.dim("Branch:")} ${colors.yellow(branch)}\n`);

    const action = await Select.prompt({
      message: "What do you want to do?",
      options: [
        { name: "Switch branch", value: "switch" },
        { name: "Pull", value: "pull" },
        { name: "Push", value: "push" },
        { name: "Commit", value: "commit" },
        { name: colors.dim("← Back"), value: "back" },
      ],
    });

    if (action === "back") return;
    if (action === "switch") await gitSwitch();
    if (action === "pull") await gitPull();
    if (action === "push") await gitPush();
    if (action === "commit") await gitCommit();
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

while (true) {
  console.log(colors.bold.cyan("\n  GAS — Git Assistance System\n"));

  const section = await Select.prompt({
    message: "Where do you want to go?",
    options: [
      { name: "Pull Requests", value: "prs" },
      { name: "Git", value: "git" },
      { name: colors.dim("Exit"), value: "exit" },
    ],
  });

  if (section === "exit") break;
  if (section === "prs") await prMenu();
  if (section === "git") await gitMenu();
}
