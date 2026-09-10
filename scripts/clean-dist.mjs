import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
console.log(`Cleaned production output: ${dist}`);
