export const allTime = Deno.args.includes("-a") || Deno.args.includes("--all-time");

type Config = { ignoreAuthors?: string[] };

function loadConfig(): Config {
  const home = Deno.env.get("HOME") ?? "";
  const candidates = [
    "gas.config.json",
    `${home}/.config/gas/config.json`,
  ];
  for (const path of candidates) {
    try {
      return JSON.parse(Deno.readTextFileSync(path)) as Config;
    } catch {
      // missing or unreadable, try next
    }
  }
  return {};
}

const config = loadConfig();

export function isIgnoredAuthor(login: string): boolean {
  return (config.ignoreAuthors ?? []).some(pattern => {
    if (pattern.includes("*")) {
      const re = new RegExp(
        `^${pattern.split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`,
        "i",
      );
      return re.test(login);
    }
    return pattern.toLowerCase() === login.toLowerCase();
  });
}
