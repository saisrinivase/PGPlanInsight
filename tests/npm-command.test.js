import { expect, test } from "vitest";
import { npmCommand } from "../scripts/npm-command.mjs";

test("Windows paths with spaces remain separate arguments without a shell", () => {
  expect(npmCommand(["run", "build"], { npm_execpath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" }, "C:\\Program Files\\nodejs\\node.exe"))
    .toEqual(["C:\\Program Files\\nodejs\\node.exe", ["C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js", "run", "build"]]);
});
test("POSIX and audit invocation use the same npm entry", () => {
  expect(npmCommand(["audit", "--json"], { npm_execpath: "/usr/lib/npm/bin/npm-cli.js" }, "/usr/bin/node"))
    .toEqual(["/usr/bin/node", ["/usr/lib/npm/bin/npm-cli.js", "audit", "--json"]]);
});
test("missing npm entry fails with an actionable error", () => {
  expect(() => npmCommand([], {})).toThrow("npm run release:gate");
});
