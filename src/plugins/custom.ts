import { Input, Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";
import { runInherited } from "../core/shell.ts";
import { header, menu, warn } from "../core/ui.ts";
import type { MenuItem, Plugin } from "../core/types.ts";

type CustomCommand = { name: string; command: string };

const dir = `${Deno.env.get("HOME") ?? ""}/.config/gas`;
const file = `${dir}/commands.json`;

function loadCommands(): CustomCommand[] {
  try {
    return JSON.parse(Deno.readTextFileSync(file)) as CustomCommand[];
  } catch {
    return [];
  }
}

function saveCommands(commands: CustomCommand[]) {
  Deno.mkdirSync(dir, { recursive: true });
  Deno.writeTextFileSync(file, JSON.stringify(commands, null, 2) + "\n");
}

async function runCommand(cmd: CustomCommand) {
  header(cmd.name);
  console.log(colors.dim(`  $ ${cmd.command}\n`));
  await runInherited("sh", ["-c", cmd.command]);
}

async function addCommand() {
  header("Add custom command");

  const name = (await Input.prompt({
    message: "Name (shown in the menu)",
    validate: (v: string) => v.trim().length > 0 || "Name is required",
  })).trim();

  const command = (await Input.prompt({
    message: "Shell command",
    validate: (v: string) => v.trim().length > 0 || "Command is required",
  })).trim();

  const commands = loadCommands().filter(c => c.name !== name); // replace on same name
  commands.push({ name, command });
  saveCommands(commands);
}

async function removeCommand() {
  header("Remove custom command");

  const commands = loadCommands();
  if (commands.length === 0) {
    warn("No custom commands saved.");
    return;
  }

  const selected = await Select.prompt({
    message: "Remove which command?",
    options: [
      ...commands.map(c => ({ name: `${c.name} ${colors.dim(`— ${c.command}`)}`, value: c.name })),
      { name: colors.dim("← Back"), value: "back" },
    ],
  });

  if (selected === "back") return;
  saveCommands(commands.filter(c => c.name !== selected));
}

function buildItems(): MenuItem[] {
  const saved: MenuItem[] = loadCommands().map(cmd => ({
    name: `${cmd.name} ${colors.dim(`— ${cmd.command}`)}`,
    run: () => runCommand(cmd),
  }));

  return [
    ...saved,
    { name: colors.green("+ Add command"), run: addCommand },
    { name: colors.red("- Remove command"), run: removeCommand },
  ];
}

export const customPlugin: Plugin = {
  name: "Custom Commands",
  run: () => menu("Custom Commands", buildItems),
};
