# SmartTrade CRM 深度安全审计报告

**日期**: 2026-05-05  
**审计范围**: 全栈代码审计 — 认证、授权、数据隔离、加密、输入验证、文件安全、API 权限  
**审计人**: Claude (Deep Security Review, Phase 2)

---

## 结论概览

| 严重度 | 数量 | 立即修复 | 建议修复 |
|--------|------|----------|----------|
| **P1 - 高危** | 2 | 是 | 是 |
| **P2 - 中危** | 2 | 推荐 | 是 |
| **P3 - 低危** | 3 | 可选 | 推荐 |

---

## P1 - 高危漏洞

### 1.1 文件下载 IDOR — `canAccessEntity` 永远返回 `true`

**文件**: `server/routes/files.ts:8-15`

```typescript
function canAccessEntity(user: AuthedRequest['user'], entityType: string, entityId: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return true;  // <-- 所有 staff 用户都能下载任意附件
}
```

**问题**: 该函数对所有已认证的非管理员用户返回 `true`，意味着任何 staff 用户只要知道附件的 ID 和 storedName，即可下载**不属于自己客户/订单**的附件。系统中已通过 `getDataScopeConstraint()` 在业务查询层实施了数据隔离，但文件服务层完全绕过了这一机制。

**利用条件**: 攻击者需要知道 attachment ID（自增整数，可遍历）和 storedName（UUID，不可预测）。但即使 storedName 不可预测，IDOR 本身是一个架构缺陷。

**修复方案**: 根据 entity_type 查表验证用户是否有权访问关联实体。对于不同实体类型使用对应的 scope 约束。

### 1.2 AES-256-GCM 加密回退到硬编码默认密钥

**文件**: `server/lib/security.ts:9-13`

```typescript
const DEFAULT_KEY = 'smart-trade-erp-default-secret-key-32';
function getEncryptionKey() {
  const key = process.env.DB_ENCRYPTION_KEY || DEFAULT_KEY;
  return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}
```

**问题**: 如果生产环境未设置 `DB_ENCRYPTION_KEY` 环境变量，加密模块静默使用源码中硬编码的默认密钥。该默认密钥公开在 GitHub 仓库中，任何知晓该密钥的人可解密数据库中 `ai_api_key` 和 `webhook_secret` 的密文。

**影响范围**: `/server/services/settings.ts:4` — `SENSITIVE_KEYS = new Set(['ai_api_key', 'webhook_secret'])` 使用此加密方式存储。

**修复方案**: 
1. 在 `server.ts` 启动时强制检查 `DB_ENCRYPTION_KEY` 是否设置（类似 `requireProductionEnv()` 的模式）
2. 生产环境拒绝启动并给出明确错误提示

---

## P2 - 中危漏洞

### 2.1 伙伴详情查询绕过数据隔离

**文件**: `server/routes/partners.ts:126-154`

```typescript
const productionOrders = await dbAll(`
  SELECT o.id, o.display_id, o.status, o.total_amount, o.product_summary, o.created_at, ...
  FROM production_plans pp
  JOIN orders o ON o.id = pp.order_id
  WHERE pp.partner_id = ?
  ORDER BY datetime(pp.created_at) DESC
`, [partnerId]);
```

**问题**: 当 staff 用户查看一个有权访问的伙伴（partner）时，关联的订单（productionOrders）、财务记录（financeRecords）、物流记录（logisticsRecords）的查询**没有应用数据范围约束**。如果多个不同归属的订单关联到同一个合作伙伴，staff 用户可以通过此接口看到不属于自己的订单明细。

虽然入口 `GET /partners/:id` 本身有 `getDataScopeConstraint` 保护（用户必须先能访问该伙伴），但一旦进入详情，相关的跨实体查询未做二次过滤。

**修复方案**: 在详情查询中加入 scope 约束，或在获取关联订单时通过 created_by 做过滤。

### 2.2 ZIP 导入无幻数校验

**文件**: `server/routes/import.ts:35-47`

问题：上传导入功能的 MIME + 扩展名校验之后，没有像 `attachments.ts` 那样做 magic byte 验证。虽然 ZIP 炸弹有保护（`MAX_ZIP_ENTRIES=5000`, `MAX_ZIP_UNCOMPRESSED_SIZE=2GB`），但恶意的 ZIP 文件可以通过 MIME 检查后进入解析流程。攻击者可能利用畸形 ZIP 触发 AdmZip 解析器中的拒绝服务或远程代码执行漏洞。

**修复方案**: 加入 ZIP 文件的幻数校验 `0x50 0x4B 0x03 0x04`。

---

## P3 - 低风险/建议项

### 3.1 `notifyOrderCreated` 传参错误

**文件**: `server/routes/orders.ts:212`

```typescript
notifyOrderCreated(displayId, String(result.payload.customerId));
```

`notifyOrderCreated` 的第二个参数期望 `customerName`（字符串），但实际传入的是 `customerId`（数字）。这导致 webhook 通知和站内推送显示客户编号而非名称。

**修复**: 改为传入客户名称或重载函数签名。

### 3.2 路由级 `requireAuth` 缺失（纵深防御）

以下路由在其定义文件中缺少 `requireAuth`，虽然 Express 父路由在 `server/api.ts` 中已全局挂载了 `requireAuth` 中间件，但从纵深防御角度应逐路由添加：

- `routes/partners.ts`: `POST /`, `PATCH /:id`, `GET /:id`
- `routes/logistics.ts`: `POST /`, `PATCH /:id`, `PATCH /:id/status`, `POST /attachments`
- `routes/customs.ts`: `POST /customs/:id/attachments`

**风险**: 如果未来重构 api.ts 中路由挂载顺序发生变化（如将某个 sub-router 移到 `requireAuth` 之前），这些路由会直接暴露。

**修复**: 在以上 handler 前添加 `requireAuth` 中间件。

### 3.3 魔术字节验证覆盖不完整

**文件**: `server/lib/files.ts:71-85`

```typescript
const MAGIC_BYTES: Record<string, number[][]> = {
  // ... 只覆盖了部分 MIME 类型
  // text/csv, text/plain 等没有定义幻数
};

export async function validateFileMagicBytes(filePath: string, claimedMimeType: string): Promise<boolean> {
  const signatures = MAGIC_BYTES[claimedMimeType];
  if (!signatures) return true; // 无定义的类型直接通过
  // ...
}
```

对于 `text/csv`, `text/plain` 等类型，因为没有定义幻数检查，直接返回 `true`。攻击者可上传一个 CSV 扩展名的 PE 可执行文件或脚本文件，通过 MIME 检查后（很多浏览器上传 CSV 时 MIME type 多变），在缺乏 magic byte 验证的情况下绕过。

---

## 已审核但未发现问题的安全领域

| 领域 | 结论 |
|------|------|
| **JWT 认证** | 24h 过期、token_version 吊销机制、DB 用户状态双重验证 ✅ |
| **CSRF 防护** | Double-submit cookie 模式，state-changing 请求强制校验 ✅ |
| **SQL 注入** | 所有查询参数化（`?` → `$1`），无拼接用户输入到 SQL 语句 ✅ |
| **密码策略** | 8位 + 大小写 + 数字 + 特殊字符，bcrypt 哈希 ✅ |
| **文件上传 MIME** | 白名单校验 + 幻数校验（部分类型）✅ |
| **路径遍历** | `resolveAttachmentAbsolutePath` + `isPathInside` 双重防护 ✅ |
| **XSS** | helmet CSP 头、Content-Disposition attachment、无 `dangerouslySetInnerHTML` ✅ |
| **RBAC** | admin/staff 角色分离，`requireAdmin` 中间件 ✅ |
| **订单数据隔离** | `getDataScopeConstraint()` + `checkOrderAccess()` 双保险 ✅ |
| **AI 数据隐私** | PII 脱敏后发送至外部 AI 提供商 ✅ |
| **Webhook 签名** | HMAC-SHA256 签名 ✅ |
| **备份安全** | 目录白名单、路径遍历防护、SHA256 校验和 ✅ |
| **日志审计** | 全员操作可追溯 ✅ |
| **用户管理** | root 防删除、最后管理员保护、自降级阻断 ✅ |

---

## 修复优先级建议

1. **立即修复 (P1)**:
   - `server/routes/files.ts:14` — `canAccessEntity` 添加真实数据隔离
   - `server/lib/security.ts:12` — 启动时强制 `DB_ENCRYPTION_KEY`

2. **尽快修复 (P2)**:
   - `server/routes/partners.ts:126-154` — 详情子查询添加 scope 过滤
   - `server/routes/import.ts:35-47` — 添加 ZIP 幻数校验

3. **可同步修复 (P3)**:
   - `server/routes/orders.ts:212` — 修复 notifyOrderCreated 参数
   - 各路由添加 `requireAuth` 纵深防御
   - 补充 `text/csv` 等类型的幻数校验（可选：前几字节检查非二进制特征）
