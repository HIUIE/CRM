# SmartTrade AI CRM — 项目全面审查报告

> 审查日期：2026-04-25 | 版本：1.0.5

---

## 目录

1. [项目完整说明书](#一项目完整说明书)
   - [目录结构速查](#目录结构速查)
   - [文件职责对照表](#文件职责对照表)
   - [如何修改常见业务逻辑](#如何修改常见业务逻辑)
2. [安全审计](#二安全审计)
   - [已加固的安全措施](#-已加固的安全措施优秀)
   - [安全风险（需修复）](#-安全风险需修复)
   - [建议修复](#建议修复)
3. [功能优化建议](#三功能优化建议)
   - [架构层面](#架构层面)
   - [代码质量](#代码质量)
   - [业务功能](#业务功能)
   - [性能](#性能)
   - [测试](#测试)

---

## 一、项目完整说明书

### 概述

**SmartTrade AI CRM** — 外贸 CRM/ERP 系统，技术栈为 **React 19 + Express + SQLite**，含 AI 助手（Gemini/DeepSeek/OpenAI 兼容 API）。版本 v1.0.5。

### 目录结构速查

```
/CRM
├── server.ts                          # 服务端入口，启动 HTTP
├── package.json                       # 依赖与脚本
├── tsconfig.json                      # TypeScript 配置
├── vite.config.ts                     # Vite 构建配置
├── .env.example                       # 环境变量模板
│
├── server/                            # ===== 后端全部代码 =====
│   ├── app.ts                         # Express 应用组装（中间件/Vite/静态文件）
│   ├── db.ts                          # SQLite 初始化、建表迁移、种子用户
│   ├── domain.ts                      # 领域常量与状态机枚举类型
│   ├── paths.ts                       # PROJECT_ROOT / UPLOADS_DIR 路径配置
│   ├── api.ts                         # 路由枢纽（挂载所有子路由 + /health）
│   │
│   ├── lib/                           # 工具库
│   │   ├── auth.ts                    # JWT 签发/验证、requireAuth、requireAdmin
│   │   ├── http.ts                    # fail() 统一错误响应、handleRouteError()
│   │   ├── files.ts                   # 附件路径安全校验、URL 构建
│   │   ├── values.ts                  # 类型安全输入读取（readString/readNumber 等）
│   │   ├── security.ts                # 敏感路径拦截、生产存储目录断言
│   │   ├── sanitizer.ts               # AI 脱敏网关（PII 清洗引擎）
│   │   ├── audit.ts                   # 审计日志写入（含自动脱敏）
│   │   ├── notifications.ts           # 系统通知 / @提及通知
│   │   └── zip.ts                     # 纯 JS ZIP 流写入器（零依赖）
│   │
│   ├── routes/                        # ===== HTTP 路由处理器 =====
│   │   ├── auth.ts                    # POST /login, POST /logout, GET /me
│   │   ├── orders.ts                  # 订单 CRUD + 生产/装箱/快捷备注
│   │   ├── customers.ts               # 客户 CRUD + 跟进记录 + 审计日志
│   │   ├── finance.ts                 # 财务 CRUD + 附件绑定
│   │   ├── logistics.ts               # 物流 CRUD + 附件上传/删除
│   │   ├── customs.ts                 # 报关 CRUD + 附件上传
│   │   ├── partners.ts                # 伙伴 CRUD
│   │   ├── tasks.ts                   # 任务 CRUD + 评论 + @提及 + 通知
│   │   ├── notifications.ts           # 通知列表/未读数/标记已读
│   │   ├── dashboard.ts               # 首页控制台聚合数据
│   │   ├── users.ts                   # 用户管理（仅 admin）
│   │   ├── settings.ts                # AI 设置/单据编码/数据导出
│   │   ├── files.ts                   # 附件下载（受 requireAuth 保护）
│   │   ├── audit.ts                   # 审计日志查询（仅 admin）
│   │   ├── ai.ts                      # AI 聊天/订单解析/订单分析
│   │   └── attachments.ts             # 附件上传（multer 6 文件限制）
│   │
│   └── services/                      # ===== 业务逻辑层 =====
│       ├── payloads.ts                # 所有实体请求体校验与类型转换
│       ├── order-detail.ts            # 订单详情聚合查询（N 表 JOIN）
│       ├── entities.ts                # 实体存在性检查
│       ├── attachments.ts             # 附件批量查询/绑定/删除
│       ├── settings.ts                # settings 表 CRUD 封装
│       ├── ai.ts                      # AI provider 路由、prompt 构建、API 调用
│       ├── export.ts                  # ZIP+CSV 全量导出、单客户归档
│       └── json.ts                    # 鲁棒 JSON 解析（清理 Markdown 干扰）
│
├── src/                               # ===== 前端全部代码 =====
│   ├── main.tsx                       # React 入口
│   ├── App.tsx                        # 路由定义 + VersionGuard
│   ├── index.css                      # Tailwind CSS v4 样式
│   │
│   ├── context/AuthContext.tsx         # 认证上下文（登录/登出/用户状态）
│   │
│   ├── types/                         # TypeScript 类型定义
│   │   ├── auth.ts                    # AuthUser / UserRole
│   │   ├── crm.ts                     # 业务实体类型（订单/客户/财务等）
│   │   └── api.ts                     # API 错误载荷
│   │
│   ├── lib/                           # 前端工具
│   │   ├── api.ts                     # fetch 封装（自动 cookie/上传进度）
│   │   ├── countries.ts               # ISO 3166 国家字典（中英双语）
│   │   ├── date.ts                    # dayjs 日期格式化（UTC+8 北京时间）
│   │   └── privacy.ts                 # 前端隐私盾（邮箱/电话掩码）
│   │
│   ├── components/                    # 页面级视图组件
│   │   ├── CustomersView.tsx          # 客户列表
│   │   ├── OrdersView.tsx             # 订单列表
│   │   ├── FinanceView.tsx            # 财务列表
│   │   ├── LogisticsView.tsx          # 物流列表
│   │   ├── PartnersView.tsx           # 伙伴列表
│   │   ├── VersionGuard.tsx           # 版本热更新检测
│   │   ├── layout/MainLayout.tsx      # 主布局（侧边栏/Header）
│   │   └── ui/                        # 通用 UI 组件
│   │       ├── Combobox.tsx           # 异步搜索下拉框
│   │       ├── CommandPalette.tsx     # ⌘K 全局命令面板
│   │       ├── Drawer.tsx             # 右侧滑抽屉（含防手滑 Dirty 检测）
│   │       ├── Pagination.tsx         # 分页器
│   │       ├── Tooltip.tsx            # Portal 逃逸 + 碰撞检测 Tooltip
│   │       ├── CountrySelect.tsx      # 国家/地区选择器
│   │       ├── CountryDisplay.tsx     # 国家渲染组件（国旗+双语）
│   │       ├── MentionTextarea.tsx    # @提及输入框
│   │       ├── ContactCreateDrawer.tsx # 联系人创建抽屉
│   │       ├── FinanceCreateDrawer.tsx # 财务录入抽屉
│   │       ├── OrderCreateDrawer.tsx  # 订单创建抽屉
│   │       ├── TaskDrawer.tsx         # 任务创建抽屉
│   │       ├── TaskDetailDrawer.tsx   # 任务详情抽屉
│   │       └── NotificationDrawer.tsx # 通知抽屉
│   │
│   ├── pages/                         # 页面级组件
│   │   ├── Dashboard.tsx              # 首页控制台（含待办/动态/状态分布）
│   │   ├── OrderDetail.tsx            # 订单详情工作台
│   │   ├── CustomerDetail.tsx         # 客户 360° 画像
│   │   ├── Login.tsx                  # 登录页
│   │   ├── Settings.tsx               # 系统设置（常规/团队/AI Tab）
│   │   ├── Tasks.tsx                  # 任务看板
│   │   ├── AIAssistant.tsx            # AI 对话助手
│   │   ├── AuditLogs.tsx              # 审计日志（仅 admin）
│   │   └── HelpCenter.tsx             # 帮助中心
│   │
│   └── features/order-detail/         # 订单详情功能模块
│       ├── components.tsx             # 详情页子组件
│       ├── types.ts                   # 详情页专用类型
│       └── utils.ts                   # 详情页工具函数
│
├── scripts/                           # 工具脚本
│   ├── backup.ts                      # 数据库 + 上传文件备份
│   ├── seed-demo.ts                   # 演示数据填充
│   └── smoke-ui.ts                    # 冒烟测试（检查渲染）
│
├── tests/
│   └── core.test.ts                   # 单元/集成测试覆盖：
│                                      #   - requireAuth 用户状态
│                                      #   - requireAdmin 权限拦截
│                                      #   - 用户管理 CRUD
│                                      #   - 业务校验（生产/财务 payload）
│                                      #   - buildOrderDetail 聚合查询
│                                      #   - 管理员导出 ZIP + 文件
│                                      #   - 文件下载鉴权 + 路径穿越防御
│                                      #   - 敏感路径拦截
│                                      #   - 存储目录生产断言
│
├── uploads/                           # 上传文件目录（按 customer_{id}/order_{id} 组织）
├── dist/                              # 前端构建产物
│
├── database.sqlite                    # 旧数据库（开发用）
├── erp_database_v2.sqlite             # 主数据库
│
├── AI_CONTEXT.md                      # AI 上下文知识库（供 AI 助手了解项目）
├── DEPLOYMENT_GUIDE.md                # 部署指南
├── README.md                          # 项目自述文件
└── CHANGELOG.md                       # 版本日志（55 轮迭代记录）
```

### 文件职责对照表

| 文件 | 职责 | 依赖关系 |
|------|------|----------|
| `server.ts` | 入口，启动 HTTP 监听 | app.ts, db.ts |
| `server/app.ts` | Express 配置，挂载中间件（helmet/json/cookie）和路由 | api.ts, security.ts |
| `server/db.ts` | SQLite 连接、15 张表创建、30+ 列迁移、种子用户 | sqlite3, bcryptjs |
| `server/domain.ts` | 状态机枚举常量（订单/财务/物流等 9 种状态机） | 零依赖 |
| `server/api.ts` | 路由枢纽：挂载 auth → requireAuth → 15 个业务子路由 | 全部 routes |
| `server/lib/auth.ts` | JWT 签发验证、cookie 管理、requireAuth/requireAdmin 中间件 | jsonwebtoken |
| `server/lib/security.ts` | 敏感路径阻断（.env/.git/.db）、生产目录断言 | paths.ts |
| `server/lib/sanitizer.ts` | PII 脱敏引擎（递归清洗 name/email/phone/address/id_card） | 零依赖 |
| `server/lib/audit.ts` | 审计日志写入，脱敏后存储 | db.ts, sanitizer.ts |
| `server/lib/http.ts` | 统一错误响应 fail()、handleRouteError()、AppError 类 | 零依赖 |
| `server/lib/values.ts` | 安全类型转换（readString/readNumber/readOptionalDate） | 零依赖 |
| `server/lib/files.ts` | 附件路径 containment 校验、URL 构建、文件名消毒 | paths.ts |
| `server/lib/zip.ts` | ZIP 流写入器，纯 JS 无依赖 | 零依赖 |
| `server/lib/notifications.ts` | 系统通知 @提及 创建 | db.ts |
| `server/services/payloads.ts` | 8 个 read*Payload 函数，校验全部业务入参 | domain.ts, entities.ts |
| `server/services/order-detail.ts` | 订单详情聚合：订单+客户+商品+财务+物流+报关+生产+装箱 | db.ts, attachments.ts |
| `server/services/entities.ts` | ensureOrderExists / ensurePartnerExists | db.ts |
| `server/services/attachments.ts` | 附件批量查/绑定/物理文件删除 | db.ts, files.ts |
| `server/services/ai.ts` | Gemini/DeepSeek/OpenAI API 调用、Prompt 构建、JSON 解析 | sanitizer.ts, json.ts |
| `server/services/export.ts` | ZIP+CSV 全量导出、单客户归档（含附件打包）| db.ts, zip.ts, order-detail.ts |
| `server/services/settings.ts` | settings 表 CRUD | db.ts |
| `src/App.tsx` | 前端路由定义，Suspense+懒加载，角色路由守卫 | 全部 pages |
| `src/context/AuthContext.tsx` | 认证上下文（登录状态全局管理）| api.ts |
| `src/lib/privacy.ts` | 前端隐私盾掩码（邮箱 `sa***@domain.com`、电话 `138****8888`）| 零依赖 |
| `src/lib/api.ts` | fetch 封装，含自动携带 cookie 和上传进度监听 | 零依赖 |
| `tests/core.test.ts` | 9 个测试用例覆盖认证/权限/校验/详情/导出/文件安全/路径阻断 | 全部 server 模块 |

### 如何修改常见业务逻辑

| 需求 | 修改位置 | 说明 |
|------|----------|------|
| **添加数据库字段** | `server/db.ts` → `runMigrations()` 末尾加 `ensureColumn()` + 对应 services/payloads/前端类型 | 确保向后兼容 |
| **修改路由逻辑** | `server/routes/` 对应文件 | 每个文件是独立 Express Router |
| **添加新路由** | `server/routes/` 新建文件 → `server/api.ts` 挂载 | 统一在 `requireAuth` 之后 |
| **修改校验逻辑** | `server/services/payloads.ts` → 对应 `read*Payload` 函数 | 所有入参校验集中管理 |
| **修改 AI 功能** | `server/routes/ai.ts`（端点）、`server/services/ai.ts`（prompt/API） | |
| **修改状态机（新增状态）** | `server/domain.ts` 枚举 + `db.ts` 迁移 + `order-detail.ts` 汇总逻辑 | |
| **修改前端页面** | `src/pages/` 或 `src/components/` 对应文件 | 页面在 pages/，表格视图在 components/ |
| **修改前端 API 调用** | `src/lib/api.ts`（基础封装）+ 对应页面组件 | |
| **修改导出功能** | `server/services/export.ts`（ZIP+CSV 生成逻辑）| |
| **添加 UI 组件** | `src/components/ui/` 新建组件 | |
| **修改隐私脱敏规则** | `server/lib/sanitizer.ts`（后端 AI 脱敏）、`src/lib/privacy.ts`（前端 UI 掩码）| |

---

## 二、安全审计

### ✅ 已加固的安全措施（优秀）

| 类别 | 措施 | 位置 |
|------|------|------|
| **认证** | JWT 24h 过期，httpOnly cookie，sameSite 策略 | `auth.ts` |
| **权限** | requireAdmin 二次拦截，前端路由角色守卫 | `auth.ts`, `App.tsx` |
| **账号管理** | 登录时检查 active 状态，停用直接清除 cookie + 拒绝 | `auth.ts` |
| **路径保护** | 阻断 `/.env`/`.git`/`*.sqlite`/`*.pem`/`*.key` 直接访问 | `security.ts` |
| **安全头** | Helmet 关闭 X-Powered-By，限制嵌入策略 | `app.ts` |
| **密码存储** | bcrypt 10 轮哈希 | `db.ts`, `users.ts` |
| **附件安全** | 随机 UUID 重命名、路径 containment 检查、受鉴权保护 | `files.ts` |
| **生产断言** | DB/Uploads 不在 dist/public 内才能启动 | `security.ts` |
| **AI 脱敏** | `sanitizeForAI()` 递归清洗 name/email/phone/address 等 PII | `sanitizer.ts` |
| **审计脱敏** | 审计日志快照存储前也经脱敏处理，防"倒查" | `audit.ts` |
| **前端隐私** | 默认掩码显示邮箱/电话，点击眼睛解锁 | `privacy.ts` |
| **root 保护** | 禁止停用 root 账号 | `users.ts:87` |
| **唯一约束** | 订单号 display_id 应用层检查 + DB UNIQUE 双保险 | `orders.ts` |
| **health 信息** | `/api/health` 不暴露物理路径 | `api.ts` |

### ⚠️ 安全风险（需修复）

| 严重度 | 问题 | 位置 | 说明 |
|--------|------|------|------|
| **高危** | **JWT 密钥硬编码默认值** | `server/lib/auth.ts:18` | `JWT_SECRET` 默认值为 `'super-secret-key-for-preview-only'`。开发模式下若忘设环境变量，任何人都可伪造 JWT |
| **高危** | **CSRF 无防护** | 全站 | 全部使用 cookie 认证但无 CSRF token。sameSite:'lax' 对 POST/DELETE 保护不足 |
| **中危** | **登录无速率限制** | `server/routes/auth.ts:11` | `/api/auth/login` 无 brute-force 防护，可暴力枚举密码 |
| **中危** | **密码重置无限流** | `server/routes/users.ts:101` | admin 可直接重置任意用户密码，无二次确认（如输入旧密码）|
| **中危** | **审计日志无限增长** | `server/routes/audit.ts:13-15` | LIMIT 200 但无自动清理机制，数据库无限膨胀 |
| **中危** | **任务附件查询 Bug** | `server/routes/tasks.ts:81` | `WHERE ta.task_id = ?` 传的是 `taskId` 参数，所有评论返回相同附件 |
| **低危** | **部分 DELETE 缺审计** | `orders.ts:200`, `finance.ts:155` | DELETE 操作未记录审计日志 |
| **低危** | **前端暴露 API Key** | `vite.config.ts:12` | `GEMINI_API_KEY` 编译进前端 JS 包，用户可查看 |
| **低危** | **密码重置不含审计** | `users.ts:101` | 重置密码操作未写入 audit_logs |

### 建议修复

1. **JWT_SECRET**：开发环境也强制要求环境变量，去掉默认值。修改 `auth.ts:18`
2. **添加 CSRF 保护**：使用 `csurf` 中间件或 Double Submit Cookie 模式
3. **登录限流**：使用 `express-rate-limit` 对 `/api/auth/login` 限制为 10 次/分钟/IP
4. **审计表自动清理**：在 `audit.ts:logAction()` 中添加行数检查，超过 10000 行时删除最旧的 1000 条
5. **修复任务附件 Bug**：tasks.ts:81 `WHERE ta.task_id = ?` 应改为按 comment 关联或将参数改为 `commentId`
6. **前端敏感 key**：移除 `vite.config.ts` 中 `process.env.GEMINI_API_KEY` 暴露（或加 `JSON.stringify("")`）
7. **密码重置审计**：添加 `logAction({ action: 'UPDATE', entityType: 'USER' })`

---

## 三、功能优化建议

### 架构层面

| 优先级 | 建议 | 文件 | 说明 |
|--------|------|------|------|
| **P0** | **迁移 PostgreSQL** | `server/db.ts` | SQLite 不支持并发写入，多用户同时操作会锁库。SQLite 在千级订单后可预见性能问题 |
| **P0** | **启用 WAL 模式** | `server/db.ts` | 如果暂不迁 Postgres，至少开启 `PRAGMA journal_mode=WAL` |
| **P1** | **前后端类型统一** | `server/domain.ts` vs `src/types/crm.ts` | 两端各自定义 OrderStatus 等类型，容易不同步。建议抽出 shared/types |
| **P1** | **引入数据请求层** | `src/lib/api.ts` | 建议加入 SWR / TanStack Query 做自动缓存、重新验证、乐观更新 |
| **P2** | **错误监控** | `server/lib/http.ts:handleRouteError()` | 目前仅 `console.error`，建议集成 Sentry |
| **P2** | **OpenAPI 文档** | — | 15+ 个子路由无 API 文档，不利于前端对接和调试 |

### 代码质量

| 优先级 | 建议 | 文件：行号 | 说明 |
|--------|------|------------|------|
| **P1** | **事务助手函数** | `orders.ts`, `finance.ts` 等多处 | 手动 BEGIN/COMMIT/ROLLBACK 散落各处，有遗漏风险。建议封装 `withTransaction(callback)` |
| **P1** | **req.user 类型统一** | 多处 `(req as any).user` | 应当统一使用 `AuthedRequest`，而非到处 `as any` |
| **P2** | **流水号硬编码限制** | `orders.ts:28-29` | `slice(-2)` 限死日流水 ≤ 99 单，建议改为动态长度 |
| **P2** | **重复逻辑** | `logistics.ts:235` vs `attachments.ts:45` | 两个 route 都有独立附件上传逻辑，建议复用 |
| **P2** | **魔数常量** | 多处 `const salt = 10` | bcrypt salt rounds 等应提为常量 |
| **P2** | **未捕获的异步错误** | 各 route | Express 5 自动处理但 v4 需要 `express-async-errors` 或手动 catch |

### 业务功能

| 优先级 | 建议 | 说明 |
|--------|------|------|
| **P0** | **自动备份调度** | 已有 `scripts/backup.ts` 但无自动定时任务 |
| **P1** | **批量操作** | 不支持批量删除订单、批量更新状态 |
| **P1** | **消息推送** | 目前通知仅限系统内，建议配邮件/企业微信/Slack 通知 |
| **P1** | **细粒度权限** | 目前仅 admin/staff，建议扩展支持模块级权限（财务/物流/产品）|
| **P1** | **搜索全文索引** | 当前 `LIKE %...%` 搜索，建议给 display_id/product_summary/name 加 FTS5 索引 |
| **P2** | **软删除** | 目前硬删除数据不可恢复，建议加 `deleted_at` 字段 |
| **P2** | **操作撤销** | 支持回滚最近的操作 |
| **P2** | **统计报表** | 建议增加月度/季度/年度财务报表和客户分析 |
| **P2** | **移动端适配** | 当前 UI 定位桌面，手机浏览器体验较差 |

### 性能

| 优先级 | 问题 | 位置 | 说明 |
|--------|------|------|------|
| **P1** | **订单详情 N+1 查询** | `order-detail.ts` | 每次调用触发 10+ 条独立 SQL，建议合并为 3-4 个 JOIN 查询 |
| **P1** | **Dashboard 无缓存** | `dashboard.ts` | 聚合查询每次请求都重新计算，建议 30s 内存缓存 |
| **P2** | **列表无分页** | `orders.ts:48`、`finance.ts:13` 等 | 所有数据一次性返回，数据量大时内存暴涨 |
| **P2** | **客户详情聚合** | `customers.ts:58-143` | 7 条独立 SQL 查询客户全部关联数据 |

### 测试

| 优先级 | 建议 | 说明 |
|--------|------|------|
| **P1** | **添加前端测试** | 目前仅 `tests/core.test.ts` 后端测试（9 个用例）|
| **P1** | **边界测试覆盖** | 恶意文件类型、超大 payload（≥50MB）、并发修改 |
| **P2** | **E2E 测试** | Playwright / Cypress 测试完整业务流程 |
| **P2** | **性能基准测试** | 100 并发请求下仪表盘/订单详情的响应时间 |

---

## 附录：数据库 Schema 概览（15 张表）

| 表名 | 用途 | 核心字段 |
|------|------|----------|
| `users` | 用户（admin/staff） | username, password(bcrypt), role, active |
| `settings` | 键值配置 | key, value |
| `customers` | 客户档案 | display_id(CUST-YYYY-NNNNNN), name, country, contact |
| `customer_contacts` | 客户联系人 | customer_id, name, email, contact, is_primary |
| `customer_followups` | 客户跟进记录 | customer_id, content, channel, created_by_name |
| `orders` | 订单 | display_id(ORD-YYYY-NNNNNN 或 CQBX-YYYY-MMDDXX), status, total_amount |
| `order_items` | 订单商品明细 | order_id, product_name, quantity, unit_price, subtotal |
| `partners` | 伙伴（工厂/货代/报关行） | name, partner_type, country, contact |
| `finance_records` | 财务收支记录 | order_id, type(receipt/payment), amount, currency, status |
| `logistics_records` | 物流运输记录 | order_id, carrier, tracking_no, status, segment_type |
| `customs_records` | 报关记录 | order_id(UNIQUE), status, broker_name, declaration_no |
| `production_plans` | 生产排产计划 | order_id(UNIQUE), partner_id, production_status, inspection_status |
| `production_logs` | 生产进度日志 | plan_id, content |
| `packing_records` | 装箱记录 | order_id, package_count, gross_weight, net_weight |
| `attachments` | 附件 | entity_type+entity_id(多态关联), file_name, stored_name, file_path |
| `audit_logs` | 审计日志 | user_id, action_type(C/U/D), entity_type, old/new_value(JSON) |
| `tasks` | 任务 | title, assignee_id, due_date, priority(P0/P1/P2), status |
| `task_comments` | 任务评论 | task_id, content, created_by |
| `task_attachments` | 任务-附件关联 | task_id, attachment_id |
| `notifications` | 系统通知 | user_id, title, message, link, is_read |

---

> **审查结论**：项目代码质量较高，安全方面已有 PII 脱敏、鉴权、路径防护等多项最佳实践。最优先修复 **JWT 默认密钥**（高危）和 **SQLite 并发问题**（影响生产可用性），功能优化建议按 P0→P2 优先级逐步推进。
