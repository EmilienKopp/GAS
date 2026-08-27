import { Table } from "jsr:@cliffy/table@^1.0.0-rc.7";
import { Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";
import { gh, runInherited } from "../core/shell.ts";
import { header, menu, promptNumber, success, warn } from "../core/ui.ts";
import { allTime, isIgnoredAuthor } from "../core/config.ts";
import type { Plugin } from "../core/types.ts";

async function prStats() {
  header("PR Stats");

  const range = await Select.prompt({
    message: "Which PRs?",
    options: [
      { name: "All time", value: "all" },
      { name: "Latest (last 200)", value: "latest" },
      { name: "Last X days", value: "days" },
      { name: "Last X PRs", value: "count" },
      { name: colors.dim("← Back"), value: "back" },
    ],
    default: allTime ? "all" : "latest",
  });

  if (range === "back") return;

  let limit = "200";
  let label = "last 200 merged";
  const extraArgs: string[] = [];

  if (range === "all") {
    limit = "100000";
    label = "all time";
  } else if (range === "days") {
    const days = await promptNumber("How many days back?");
    if (days === null) return;
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    limit = "100000";
    label = `last ${days} days`;
    extraArgs.push("--search", `merged:>=${since}`);
  } else if (range === "count") {
    const count = await promptNumber("How many PRs?");
    if (count === null) return;
    limit = String(count);
    label = `last ${count} merged`;
  }

  header(`PR Stats (${label})`);

  const allPrs = await gh<{ author: { login: string }; createdAt: string; mergedAt: string }[]>(
    "pr", "list", "--limit", limit, "--state", "merged", "--json", "author,createdAt,mergedAt", ...extraArgs,
  );

  const prs = allPrs.filter(pr => !isIgnoredAuthor(pr.author.login));
  const ignored = allPrs.length - prs.length;
  if (ignored > 0) {
    console.log(colors.dim(`  (${ignored} PRs from ignored authors excluded)\n`));
  }

  if (prs.length === 0) {
    warn("No PRs to show.");
    return;
  }

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

async function myReviews() {
  header("My reviews");

  const prs = await gh<{ number: number; title: string; author: { login: string }; url: string }[]>(
    "pr", "list", "--state", "open", "--search", "review-requested:@me",
    "--json", "number,title,author,url",
  );

  if (prs.length === 0) {
    warn("No PRs waiting on your review. 🎉");
    return;
  }

  const selected = await Select.prompt({
    message: `${prs.length} PR(s) waiting on you`,
    options: [
      ...prs.map(pr => ({
        name: `#${pr.number} ${pr.title} ${colors.dim(`— ${pr.author.login}`)}`,
        value: String(pr.number),
      })),
      { name: colors.dim("← Back"), value: "back" },
    ],
  });

  if (selected === "back") return;

  const action = await Select.prompt({
    message: `PR #${selected}`,
    options: [
      { name: "Open in browser", value: "web" },
      { name: "Checkout", value: "checkout" },
      { name: colors.dim("← Back"), value: "back" },
    ],
  });

  if (action === "web") {
    await runInherited("gh", ["pr", "view", selected, "--web"]);
  } else if (action === "checkout") {
    const code = await runInherited("gh", ["pr", "checkout", selected]);
    if (code === 0) success(`Checked out PR #${selected}`);
  }
}

export const prPlugin: Plugin = {
  name: "Pull Requests",
  run: () =>
    menu("Pull Requests", [
      { name: "Stats", run: prStats },
      { name: "My reviews", run: myReviews },
      { name: "Checkout open PR", run: checkoutPR },
    ]),
};
