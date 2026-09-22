// Invoke npm's JavaScript entry with Node, avoiding Windows .cmd shell handling.
export function npmCommand(args, env = process.env, node = process.execPath) {
  if (!env.npm_execpath) throw new Error("Run this gate with npm run release:gate so npm_execpath is available.");
  return [node, [env.npm_execpath, ...args]];
}
