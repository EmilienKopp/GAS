import { Input, Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";
import type { MenuItem } from "./types.ts";

export function header(title: string) {
  console.log(colors.bold.cyan(`\n  ${title}\n`));
}

export function success(msg: string) {
  console.log(colors.green(`\n  ✓ ${msg}\n`));
}

export function warn(msg: string) {
  console.log(colors.yellow(`\n  ${msg}\n`));
}

export async function promptNumber(message: string): Promise<number | null> {
  const raw = await Input.prompt({
    message,
    validate: (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0 || "Enter a positive number",
  });
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface MenuOptions {
  /** Label of the item that leaves this menu. Defaults to "← Back". */
  exitLabel?: string;
  /** Printed under the header on every pass (e.g. current branch). */
  banner?: () => Promise<void> | void;
}

/**
 * Loop a select menu over items until the exit option is chosen.
 * Turns a list of MenuItems into a submenu; nest freely.
 * Pass a function for items that change between passes (e.g. saved commands).
 */
export async function menu(
  title: string,
  itemsOrFn: MenuItem[] | (() => MenuItem[] | Promise<MenuItem[]>),
  opts: MenuOptions = {},
) {
  const { exitLabel = "← Back", banner } = opts;

  while (true) {
    header(title);
    await banner?.();

    const items = typeof itemsOrFn === "function" ? await itemsOrFn() : itemsOrFn;

    const selected = await Select.prompt({
      message: "What do you want to do?",
      options: [
        ...items.map((item, i) => ({ name: item.name, value: String(i) })),
        { name: colors.dim(exitLabel), value: "exit" },
      ],
    });

    if (selected === "exit") return;
    await items[Number(selected)].run();
  }
}
