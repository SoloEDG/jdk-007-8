export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`断言失败：${message}`);
}
export function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected)
    throw new Error(
      `断言失败：${message}（实际 ${String(actual)}，期望 ${String(expected)}）`,
    );
}
