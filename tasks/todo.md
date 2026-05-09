# SmartTrade ERP CRM - 待办任务清单 (Todo List)

## 任务一：数据库模式扩展与阿里订单号支持 (已完成)
- [x] 1. 数据库 schema 扩展
- [x] 2. 数据库启动自愈 DDL 检查
- [x] 3. 后端服务逻辑及 Payload 验证
- [x] 4. 前端列表、详情及阿里订单号 Tag 显示

## 任务二：阿里订单号快捷复制与创建/编辑双向表单集成 (已完成)
- [x] 1. 一键复制微交互及状态提示
- [x] 2. 双端录入表单修改

## 任务三：端到端加密（E2EE）安全灾备备份与恢复 (已完成)
### 目标与验收标准 (Acceptance Criteria)
- [x] 1. **纯客户端安全沙箱**：解密密码绝不传输到后端服务器，所有加解密逻辑均在浏览器本地安全沙箱（Web Crypto API）中执行，确保服务器对密码“完全盲存”。
- [x] 2. **安全的备份导出加密**：
  - 用户在 settings 页面选择导出“系统迁移与灾备包（restorable-backup）”时，弹出提示框要求输入解密密码（支持二次输入确认以防打错）。
  - 下载文件自动包装为 `.zip.enc` 加密安全包，而非原有的未加密 ZIP。
  - 文件结构安全：必须包含特征魔数（Magic Header）、抗爆破加盐哈希（Salt）以及 AES-GCM 高强度认证标签。
- [x] 3. **无缝的备份恢复解密**：
  - 用户上传灾备包时，系统自动通过二进制幻数（Magic Header）识别是否为端到端加密包。
  - 若为加密包，以精美交互弹窗引导用户输入解密密码；
  - 浏览器在内存中实时解密并校验数据。若密码错误，友好提示并允许重新输入。
  - 解密成功后，自动组装为标准的 ZIP 二进制对象并流式传输至后端服务器原有的 preview/import 接口，实现旧版无缝融合。
- [x] 4. **完全向后兼容**：
  - 如果用户上传旧版本未加密的标准 `.zip` 备份文件，系统应该跳过解密直接执行原有的导入校验流程，不造成任何业务阻断。

### 核心技术方案设计
#### 1. 加密包二进制报文协议 (Custom Secure Envelope)
```
+-------------------+--------------------+--------------------+----------------------------------+
| Magic Header      | Salt (PBKDF2)      | IV (AES-GCM)       | Encrypted Payload (Ciphertext)   |
| "STE2EE\x01"      | 16 bytes           | 12 bytes           | Variable length                  |
| (7 bytes)         |                    |                    | (Includes 16-byte GCM Auth Tag)  |
+-------------------+--------------------+--------------------+----------------------------------+
```
- **Magic Header**：固定为 7 字节字符串 `STE2EE\x01`，用以绝对区分普通 ZIP 备份和加密备份。
- **Salt**：16 字节随机二进制，用作 PBKDF2 对密码进行哈希迭代时引入的盐分，抵御彩虹表爆破攻击。
- **IV (Initialization Vector)**：12 字节随机二进制，保证即使密码和内容完全相同，每次加密出来的密文也截然不同。
- **Ciphertext**：使用 `AES-GCM-256` 进行强认证加密。

#### 2. 加密密钥派生 (PBKDF2 DERIVATION)
使用浏览器原生 Web Crypto API 实现高强度派生：
- 哈希函数：`SHA-256`
- 迭代次数：`100,000` 次（防算力穷举）
- 派生算法：`PBKDF2` -> 生成 256 位 `AES-GCM` 密钥

### 具体开发步骤
- [x] **步骤 1**：创建客户端加密核心库 [src/lib/backup-crypto.ts](file:///Users/carlosfu/Projects/CRM/src/lib/backup-crypto.ts)，实现 PBKDF2 密钥派生、`encryptBackup`、`decryptBackup` 核心方法。
- [x] **步骤 2**：编写 [src/lib/__tests__/backup-crypto.test.ts](file:///Users/carlosfu/Projects/CRM/src/lib/__tests__/backup-crypto.test.ts) 单测，模拟密钥派生及加解密往返，并在本地 Vitest 运行验证。
- [x] **步骤 3**：改造 [src/pages/settings/DataTab.tsx](file:///Users/carlosfu/Projects/CRM/src/pages/settings/DataTab.tsx) 的“数据导出”区块：
  - 引入密码输入/确认 Dialog 状态。
  - 将原有的 `fetchExportBlob` 下载流程拦截，传入 `encryptBackup` 生成加密包，再执行本地下载。
- [x] **步骤 4**：改造 [src/pages/settings/DataTab.tsx](file:///Users/carlosfu/Projects/CRM/src/pages/settings/DataTab.tsx) 的“数据恢复”区块：
  - 在选择文件后，读取前 7 字节检查 Magic Header。
  - 如果匹配，弹出精美解密密码输入弹窗。
  - 本地调用 `decryptBackup`。若成功解密，生成标准的 JS `File` 对象，覆盖 file 状态，使其无缝触发后端预览、恢复操作；若失败，给出清晰红色报错。

---

## 验证与合规测试 (Validation)
- [x] **全站类型检查**：在工作空间根目录下运行 `npx tsc --noEmit`，未发现任何 TypeScript 错误，静态编译成功，`Exit code: 0`。
- [x] **Vitest 单元测试**：运行 `npx vitest run src/lib/__tests__/backup-crypto.test.ts` 以确保算法层 100% 稳固。
- [x] **打包构建验证**：运行 `npm run build` 确保前端构建产物顺利通过，无副作用。
