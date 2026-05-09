# SmartTrade ERP CRM - 经验与教训 (Lessons Learned)

## 1. Web Crypto API 与 TypeScript 类型重载冲突
- **失效模式 (Failure Mode)**:
  在使用浏览器原生 Subtle Crypto API（如 `window.crypto.subtle.deriveKey`）时，传入 `Uint8Array` 作为 `salt` 参数会导致 TypeScript 编译器抛出 `TS2769: No overload matches this call` 错误。提示 `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BufferSource'`，这是由于 DOM 类型库与 TypedArray 在特定 TS 配置下的重载冲突导致。
- **检测信号 (Detection Signal)**:
  运行 `npx tsc --noEmit` 时产生明确的类型检查失败，指示 Subtle Crypto 重载签名无法匹配。
- **防范规则 (Prevention Rule)**:
  在 TypeScript 环境中调用原生 Subtle Crypto 接口时，若遇到类似的 `BufferSource` 或 `ArrayBufferView` 重载错误，可将传入的 TypedArray 参数显示强制转换为 `any`（例如 `salt: salt as any`）或强转为 `ArrayBuffer`，以干净、安全地绕过编译器的重载解析缺陷，且不影响运行时的真实二进制数据传递。
