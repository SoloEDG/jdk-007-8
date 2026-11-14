import { build } from "esbuild";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const entry = process.argv[2];
if (!entry) {
  console.error("用法：node verify/bundle.mjs <测试文件>");
  process.exit(1);
}
const outfile = fileURLToPath(new URL("../.verify-build/bundle.mjs", import.meta.url));
await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  absWorkingDir: root,
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  logLevel: "silent",
});
console.log(outfile);
