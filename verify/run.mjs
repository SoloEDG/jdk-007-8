// 轻量测试入口：用项目已有的 esbuild 打包每个 *.test.ts 后用 Node 运行。
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const tests = [
  "follow-logic.test.ts",
  "follow-model.test.ts",
  "validation.test.ts",
];
let failed = 0;
for (const test of tests) {
  const bundle = spawnSync(
    process.execPath,
    [here + "bundle.mjs", here + test],
    { encoding: "utf8" },
  );
  if (bundle.status !== 0) {
    console.error(bundle.stdout, bundle.stderr);
    failed++;
    continue;
  }
  const out = bundle.stdout.trim();
  const run = spawnSync(process.execPath, [out], { encoding: "utf8" });
  if (run.status !== 0) {
    console.error(`✘ ${test}\n`, run.stdout, run.stderr);
    failed++;
  } else {
    console.log(`✓ ${test}: ${run.stdout.trim()}`);
  }
}
process.exit(failed ? 1 : 0);
