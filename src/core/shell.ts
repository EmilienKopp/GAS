import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";

const decoder = new TextDecoder();

export async function run(
  cmd: string,
  args: string[],
  { silent = false } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
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

export async function runInherited(cmd: string, args: string[]): Promise<number> {
  const { code } = await new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }).output();
  return code;
}

export async function gh<T>(...args: string[]): Promise<T> {
  const { code, stdout, stderr } = await run("gh", args);
  if (code !== 0) {
    console.error(colors.red(stderr));
    Deno.exit(1);
  }
  return JSON.parse(stdout) as T;
}
