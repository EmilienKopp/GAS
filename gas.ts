#!/usr/bin/env -S deno run --allow-run --allow-env

import { Table } from "jsr:@cliffy/table@^1.0.0-rc.7";
import { Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";

async function gh(...args: string[]): Promise<unknown> {
  const cmd = new Deno.Command("gh", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    console.error(new TextDecoder().decode(stderr));
    Deno.exit(1);
  }

  return JSON.parse(new TextDecoder().decode(stdout));
}

async function showStats() {
  console.log(colors.bold.cyan("\n  PR Stats (last 200 merged)\n"));

  const prs = await gh(
    "pr", "list",
    "--limit", "200",
    "--state", "merged",
    "--json", "author,createdAt,mergedAt",
  ) as { author: { login: string }; createdAt: string; mergedAt: string }[];

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
    .header([
      colors.bold("Author"),
      colors.bold("PRs"),
      colors.bold("% of total"),
      colors.bold("Avg time to merge"),
    ])
    .body(rows.map(r => [
      r.author,
      String(r.count),
      `${r.pct}%`,
      `${r.avgHours}h`,
    ]))
    .border()
    .render();
}

async function checkoutPR() {
  console.log(colors.bold.cyan("\n  Open PRs\n"));

  const prs = await gh(
    "pr", "list",
    "--state", "open",
    "--json", "number,title,author,createdAt",
  ) as { number: number; title: string; author: { login: string }; createdAt: string }[];

  if (prs.length === 0) {
    console.log(colors.yellow("  No open PRs.\n"));
    return;
  }

  const selected = await Select.prompt({
    message: "Select a PR to check out",
    options: [
      ...prs.map(pr => ({
        name: `#${pr.number} ${pr.title} ${colors.dim(`— ${pr.author.login}`)}`,
        value: String(pr.number),
      })),
      { name: colors.dim("Skip"), value: "skip" },
    ],
  });

  if (selected === "skip") return;

  const checkout = new Deno.Command("gh", {
    args: ["pr", "checkout", selected],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await checkout.output();
  if (code === 0) {
    console.log(colors.green(`\n  Checked out PR #${selected}\n`));
  }
}

await showStats();
await checkoutPR();
