import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:e2e"]],
  ["node", ["scripts/security-static.mjs"]],
  ["npm", ["audit", "--offline", "--omit=dev", "--audit-level=high"]],
  ["npm", ["run", "release:artifacts"]],
];
for (const [command, args] of commands) {
  console.log(`\n[release gate] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("\nPGPlan Insight release gate: PASS");
