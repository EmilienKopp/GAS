/**
 * Everything shown in a menu is a MenuItem: a label and something to run.
 * A Plugin is just a top-level MenuItem. To add a new command, create a
 * MenuItem (or a whole submenu via `menu()`) and register it in
 * src/plugins/index.ts.
 */
export interface MenuItem {
  /** Label shown in the menu. */
  name: string;
  run(): Promise<void>;
}

export type Plugin = MenuItem;
