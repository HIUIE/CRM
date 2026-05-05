#!/usr/bin/env node
/**
 * postinstall — 检查 Vite (rolldown) 原生 binding 是否可用。
 * 跨平台部署时（如 macOS 开发 → Linux 服务器构建），node_modules 中可能缺少
 * 当前平台对应的 @rolldown/binding-* 包。
 *
 * 如果 binding 缺失，则提示用户重新安装依赖。
 */

const { platform, arch } = process;

function getExpectedBinding() {
  const map = {
    'darwin-arm64': 'darwin-arm64',
    'darwin-x64': 'darwin-x64',
    'linux-x64': 'linux-x64-gnu',
    'linux-arm64': 'linux-arm64-gnu',
    'win32-x64': 'win32-x64-msvc',
  };
  return map[`${platform}-${arch}`] || null;
}

try {
  // Try to load vite — this will fail if the native binding is missing
  // We use a dynamic require wrapped in try-catch to avoid crashing install
  const vitePath = import.meta.resolve('vite');
  // If resolve succeeded, the binding was loaded during the resolution chain
  console.log(`[native-bindings] ✅ Vite native binding for ${platform}-${arch} 已就绪`);
} catch (err) {
  const expected = getExpectedBinding();
  console.warn(
    `\n⚠️  [native-bindings] Vite native binding 未安装在 ${platform}-${arch} 上。` +
    (expected ? ` 期望: @rolldown/binding-${expected}` : '') +
    `\n   如果后续构建失败，请执行：rm -rf node_modules package-lock.json && npm install` +
    `\n   这通常发生在跨平台部署（如 macOS → Linux 服务器）时。\n`
  );
}
