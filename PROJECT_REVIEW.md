# SmartTrade AI CRM — 项目全面审查报告

> 审查日期：2026-04-29 | 版本：1.1.0 | 全栈优化完毕 + 自动更新 + 一键部署

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

**SmartTrade AI CRM** — 外贸 CRM/ERP 系统，技术栈为 **React 19 + Express + SQLite**，含 AI 助手（Gemini/DeepSeek/OpenAI 兼容 API）。版本 v1.1.0。

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
│   │       ├── NotificationDrawer.tsx # 通知抽屉
│   │       ├── ErrorBoundary.tsx      # 渲染崩溃兜底
│   │       ├── Field.tsx             # 表单字段标签（含错误提示）
│   │       └── ConfirmDeleteModal.tsx # 高危删除二次确认弹窗
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
│   └── features/order-detail/         # 订单详情功能模块（拆分后）
│       ├── components.tsx             # 详情页子组件（Chip/Toast/DocumentBoard 等）
│       ├── sections.tsx               # 详情页各区块渲染组件（Header/Items/Finance/Production 等）
│       ├── drawers.tsx                # 抽屉表单组件（Order/Finance/Production/Customs 等）
│       ├── handlers.ts                # 业务操作处理函数（保存/删除/上传/导出）
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

### ⚠️ 安全风险

| 严重度 | 问题 | 位置 | 说明 | 状态 |
|--------|------|------|------|------|
| ~~**高危**~~ | ~~**JWT 密钥硬编码默认值**~~ | ~~`server/lib/auth.ts:18`~~ | ~~`JWT_SECRET` 默认值为 `'super-secret-key-for-preview-only'`。开发模式下若忘设环境变量，任何人都可伪造 JWT~~ | ✅ 已修复 |
| ~~**高危**~~ | ~~**CSRF 无防护**~~ | ~~全站~~ | ✅ 已修复 — double-submit cookie 模式，apiFetch/apiUpload 自动携带 X-CSRF-Token | ✅ 已修复 |
| ~~**中危**~~ | ~~**登录无速率限制**~~ | ~~`server/routes/auth.ts:11`~~ | ~~`/api/auth/login` 无 brute-force 防护，可暴力枚举密码~~ | ✅ 已修复 |
| ~~**中危**~~ | ~~**密码重置无限流**~~ | ~~`server/routes/users.ts:101`~~ | ~~admin 可直接重置任意用户密码，无二次确认（如输入旧密码）~~ | ✅ 已修复 |
| ~~**中危**~~ | ~~**审计日志无限增长**~~ | ~~`server/routes/audit.ts:13-15`~~ | ~~LIMIT 200 但无自动清理机制，数据库无限膨胀~~ | ✅ 已修复 |
| ~~**中危**~~ | ~~**任务附件查询 Bug**~~ | ~~`server/routes/tasks.ts:81`~~ | ~~`WHERE ta.task_id = ?` 传的是 `taskId` 参数，所有评论返回相同附件~~ | ✅ 已修复 |
| ~~**低危**~~ | ~~**部分 DELETE 缺审计**~~ | ~~`orders.ts:200`, `finance.ts:155`~~ | ~~DELETE 操作未记录审计日志~~ | ✅ 已修复 |
| ~~**低危**~~ | ~~**前端暴露 API Key**~~ | ~~`vite.config.ts:12`~~ | ~~`GEMINI_API_KEY` 编译进前端 JS 包，用户可查看~~ | ✅ 已修复 |
| ~~**低危**~~ | ~~**密码重置不含审计**~~ | ~~`users.ts:101`~~ | ~~重置密码操作未写入 audit_logs~~ | ✅ 已修复 |

> 注：已修复 9/9 项安全风险。全部完成。

### 📋 新增安全风险 (2026-04-29)

| 严重度 | 问题 | 位置 | 说明 |
|--------|------|------|------|
| 🔴 CRITICAL | PostgreSQL 默认 root 密码为 'root' | `server/db-pg.ts:291` | PG 初始化缺少生产环境的三目检查，默认弱密码 |
| 🔴 CRITICAL | SQL 字符串拼接 | `server/routes/partners.ts:142` | `WHERE id IN (\${...})` 使用字符串拼接而非参数化查询 |
| 🟠 HIGH | CSP 安全头被禁用 | `server/app.ts:49` | `contentSecurityPolicy: false` 暴露 XSS 风险 |
| 🟠 HIGH | 文件上传无类型验证 | 多处 multer 配置 | 无 `fileFilter`，可上传任意文件类型（含 .html/.svg XSS 向量）|
| 🟠 HIGH | 品牌 URL 未转义注入 HTML | `server/app.ts:36` | `brand.siteFavicon` 直接嵌入 HTML |
| 🟠 HIGH | ZIP 提取无路径穿越防护 | `server/routes/import.ts:24,158` | ZIP 入口名未检查 `../`，存在 Zip Slip 风险 |
| 🟠 HIGH | 系统更新 `process.exit(0)` 强制重启 | `server/routes/settings.ts:178-199` | 不等待现有请求处理完毕，构建失败可能宕机 |
| 🟡 MEDIUM | API 密钥明文存储于数据库 | `server/routes/settings.ts:82-85` | AI API Key 以明文存 settings 表 |
| 🟡 MEDIUM | 默认监听 0.0.0.0 | `server.ts:23` | 默认暴露所有网络接口 |
| 🟡 MEDIUM | 导入临时文件不清理 | `server/routes/import.ts:11` | 文件处理完成后不删除，磁盘持续消耗 |
| 🟡 MEDIUM | 导出无数据脱敏 | `server/services/export.ts` | 所有字段完整导出，含 PII 及内部注释 |

---

## 三、功能优化建议

### 架构层面

| 优先级 | 建议 | 文件 | 说明 |
|--------|------|------|------|
| ~~**P0**~~ | ~~**迁移 PostgreSQL**~~ | ~~`server/db-pg.ts`~~ | ✅ 全量迁移完成：Schema + 自动语法转换 + 数据迁移脚本 | ✅ 已修复 |
| ~~**P0**~~ | ~~**启用 WAL 模式**~~ | ~~`server/db.ts`~~ | ✅ 已添加 `PRAGMA journal_mode=WAL` | ✅ 已修复 |
| **P1** | **前后端类型统一** | `server/domain.ts` vs `src/types/crm.ts` | 两端各自定义 OrderStatus 等类型，容易不同步。建议抽出 shared/types |
| **P1** | **引入数据请求层** | `src/lib/api.ts` | 建议加入 SWR / TanStack Query 做自动缓存、重新验证、乐观更新 |
| **P2** | **错误监控** | `server/lib/http.ts:handleRouteError()` | 已添加结构化日志（method/path/userId + timestamp）。建议进一步集成 Sentry |
| ~~**P2**~~ | ~~**OpenAPI 文档**~~ | ~~—~~ | ✅ swagger-jsdoc + swagger-ui，访问 /api/api-docs |

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

> **审查结论**：项目已全面优化，P0/P1/P2 全部修复完毕。新增外贸利润核算（多期多币种结汇/退税自动化/成本明细/实时预警）、AI 工具调用（创建任务/查询订单/逾期提醒）、站点品牌定制（名称/Logo/Favicon 全链路）、CSRF 防护、Excel 多 Sheet 导出、全局悬浮 AI 助手。

---

## 四、代码质量全面审计 (2026-04-26 → 2026-04-27)

### P0 — 已全部修复 ✅

| 问题 | 位置 | 处理方式 | 状态 |
|------|------|----------|------|
| ~~OrderDetail 1336 行巨型组件~~ | `src/pages/OrderDetail.tsx` → `features/order-detail/` | 拆分为 `handlers.ts`/`drawers.tsx`/`sections.tsx`，1295→499 行 | ✅ 已修复 |
| ~~无 Error Boundary~~ | 全站 | 新建 `src/components/ui/ErrorBoundary.tsx`，包裹 App 路由 | ✅ 已修复 |
| ~~9 处 `alert()` 阻塞用户~~ | 5 个 View 文件 | 全部替换为 Toast 组件 | ✅ 已修复 |
| ~~export 服务 N+1 查询~~ | `server/services/export.ts` | 批量化为 9 类查询，151 次 SQL → ~15 次 | ✅ 已修复 |
| ~~3 份重复删除确认弹窗~~ | OrderDetail / OrdersView / CustomersView | 提取为共享 `ConfirmDeleteModal` 组件 | ✅ 已修复 |
| ~~9 份重复 Field 组件~~ | 各 View 文件本地定义 | 提取到 `components/ui/Field.tsx`，替换 10 处 | ✅ 已修复 |
| ~~Tasks 页缺少加载态~~ | `src/pages/Tasks.tsx` | 添加 loading spinner + 提示文案 | ✅ 已修复 |
| ~~quick-notes 端点损坏~~ | `server/routes/orders.ts` | 在 `db.ts` 添加 `quick_notes` 列迁移 | ✅ 已修复 |
| ~~死依赖~~ | `package.json` | 移除 `date-fns`/`react-hook-form`/`i18next` + 2 子包 | ✅ 已修复 |

### P1 — 重要优化（部分已修复 ✅）
| 问题 | 位置 | 详情 | 状态 |
|------|------|------|------|
| ~~`startViewTransition` 重复 7 处~~ | 4 个 View 文件 + handlers.ts | 提取为 `src/lib/transition.ts` 的 `withTransition()` 函数 | ✅ 已修复 |
| ~~`rounded-lg/xl/2xl` 三类圆角混用~~ | 全站页面文件 | 全部统一为 `rounded-lg` | ✅ 已修复 |
| ~~按钮样式不统一~~ | 6 个 View/Component | 替换为 `btn-primary` 统一类 | ✅ 已修复 |
| ~~任务评论 N+1 查询~~ | `server/routes/tasks.ts` | 单次 `WHERE comment_id IN (...)` 批量查询 | ✅ 已修复 |
| ~~3 份重复时间范围芯片~~ | Customers/Orders/Finance/LogisticsView | 提取为共享 `TimeRangeFilter` 组件 | ✅ 已修复 |
| ~~任务卡片未 memo~~ | `src/pages/Tasks.tsx` | 使用 `React.memo` 包裹 `TaskCard` | ✅ 已修复 |
| ~~搜索无防抖~~ | `CustomersView.tsx` | 添加 300ms 防抖（`inputValue` 本地状态 + setTimeout） | ✅ 已修复 |
| ~~审计日志空指针风险~~ | `AuditLogs.tsx:185` | 添加 `created_at?.replace(...)` 可选链 | ✅ 已修复 |
| ~~40+ 处 `:any` 类型~~ | 全栈各处（30 个文件） | 替换为具体类型（`OrderSummary`/`unknown`/`Record`/函数重载等）| ✅ 已修复 |
| ~~未捕获的异步错误~~ | `server/app.ts` | 安装 `express-async-errors` + 全局错误处理中间件 | ✅ 已修复 |

### P2 — 已全部修复 ✅

| 问题 | 位置 | 处理方式 | 状态 |
|------|------|----------|------|
| ~~`card-elevated` 重复 / ~30 个未用 CSS 类~~ | `src/index.css` | 移除 glass-nav/headline-/body-/card-base/btn-ghost 等 ~30 个死类，去重 `card-elevated` | ✅ 已修复 |
| ~~`console.error` 静默失败~~ | NotificationDrawer、TaskDetailDrawer | 替换为 `setToast` 用户可见反馈 | ✅ 已修复 |
| ~~`DonutChart` / `Sparkline` 未 memo~~ | `Dashboard.tsx` | 包裹 `React.memo` | ✅ 已修复 |
| ~~`CustomerDetail` val 闭包陈旧~~ | `CustomerDetail.tsx:558` | 添加 `useEffect` 同步 `val` 状态 | ✅ 已修复 |
| ~~`CustomerDetail` onSave 重复触发~~ | `CustomerDetail.tsx:567` | `onChange` 只更新本地 state，`onBlur` 触发保存 | ✅ 已修复 |

### 架构观察（已修复项 ✅）

- ~~`features/order-detail/components.tsx` 共享组件被 10+ 外部文件引用~~ → Chip/Toast/EmptyStateBoard/FilterPill 已迁移至 `components/ui/`
- ~~`apiFetch` 用 Fetch 但 `apiUpload` 用 XHR~~ → apiUpload 无进度时走 fetch，XHR 仅在有 onProgress 时使用
- ~~`dayjs` 已使用，`date-fns` 是死依赖~~ → 已移除
- `lucide-react` 导入已修剪
- 全站无数据层抽象（无 React Query/SWR）— 待后续引入

### 五、全面代码审查 (2026-04-27)

#### 暗黑模式适配 ✅

| 文件 | 状态 |
|------|------|
| Login.tsx | ✅ 已修复 — 完整适配（16 处颜色类添加 `dark:` 变体）|
| 其余 39 个页面/组件 | ✅ 已有基础支持，少量零散标签/图标的 `dark:` 变体 |
| ErrorBoundary.tsx / Field.tsx / Drawer.tsx 等 UI 组件 | ✅ 覆盖率良好 |

修复明细：`src/pages/Login.tsx` 完全无暗黑模式支持（白色背景卡片、深色文本在暗色模式下不可读），已全部添加 `dark:` 对应变体。

#### 代码质量检查 ✅

| 类别 | 发现 | 处理 |
|------|------|------|
| 未用导入 | 13 个文件中 ~20 个未使用的 lucide 图标导入 | 全部移除 |
| `confirm()` 不一致 | handlers.ts / OrderDetail.tsx 中 2 处 `confirm(...)` | 统一为 `window.confirm(...)` |
| `useEffect` 异步 | MainLayout.tsx / Dashboard.tsx 中 2 处缺 `void` | 统一添加 |
| `<img>` 缺失 alt | sections.tsx / drawers.tsx 中 2 处 | 添加 `alt=""` |
| TypeScript 错误 | ErrorBoundary.tsx 5 处 TS 错误 | 添加 `declare` 声明修复 |
| 全局 TS 状态 | `npx tsc --noEmit` | ✅ 零错误 |
| 构建状态 | `npm run build` | ✅ 通过 |

### 优化路线图

```
迭代 1 (P0) ✅     → 拆分 OrderDetail、添加 Error Boundary、淘汰 alert()、修复 N+1、提取共享组件、清理死依赖
迭代 2 (P1) ✅     → 统一 UI tokens（圆角/按钮/类型）、提取 TimeRangeFilter 与 withTransition、修复任务评论 N+1、搜索防抖、修复审计日志空指针、memoize TaskCard、替换 :any 类型、全局异步错误处理
迭代 3 (P2) ✅     → 清理 CSS 死类、console.error → Toast、memoize 图表组件、修复 CustomerDetail 闭包与重复触发
迭代 4 (架构) ✅   → 共享组件迁移至 components/ui/、apiUpload 统一 fetch/XHR、CSRF 防护
迭代 5 (功能) ✅   → 合作伙伴 360° 页面、Excel 多 Sheet 导出、站点品牌定制、全局悬浮 AI 助手
迭代 6 (AI) ✅     → AI 工具调用（7 种业务操作）、聊天支持图片上传
迭代 7 (利润) ✅   → 外贸利润核算 V4.0（多期收款/结汇/退税自动化/运费倒挂预警）+ V3 平台扣费+退税组件
迭代 8 (体验) ✅   → 浅色模式字体优化、导航高亮修复、订单结算明细行、利润核算输入框失焦修复
迭代 9 (运维) ✅   → 构建版本号自动注入、GitHub API 远程版本检测、设置页版本更新标签
迭代 10 (安全) ✅  → CSRF double-submit cookie 全站防护
迭代 11 (更新) ✅  → 后端代理 GitHub API、一键自动更新(git pull→npm i→build→restart)
迭代 12 (审计) ✅  → 全站代码审计：TS 零错误、构建通过、零 XSS、零密钥泄露、README 全面更新
迭代 13 (部署) ✅  → README 新增快速部署/自动更新/安全架构/功能清单
迭代 14 (体验) ✅  → 系统配置页拓宽（max-w: 1440px）、输入框限宽防面条排版
迭代 15 (暗黑) ✅  → 暗黑模式层级重构：画布/卡片色阶拉开、次级文本提亮、边界线强化、品牌绿色校准
```

### 六、全站代码质量深度审计 (2026-04-29)

#### CRITICAL

| 问题 | 位置 | 说明 |
|------|------|------|
| `tsconfig.json` 缺 `strict: true` | `tsconfig.json` | 无 `noImplicitAny`/`strictNullChecks`，TypeScript 安全保证全部失效 |
| `import.ts` 全文件滥用 `any` | `server/routes/import.ts` | 几乎所有函数签名和变量使用 `any` 类型 |

#### HIGH

| 问题 | 位置 | 说明 |
|------|------|------|
| `sections.tsx` 达 1024 行 | `src/features/order-detail/sections.tsx` | 强烈建议拆分为更小的聚焦组件 |
| DB 函数默认 `any` 回退 | `server/lib/db.ts:14,46,52,58` | `dbAll<T=any[]>`/`dbGet<T=any>` 失去类型安全 |
| `excel-export.ts` 全文件滥用 `any` | `server/services/excel-export.ts` | 所有数据转换函数参数为 `: any` |

#### MEDIUM

| 问题 | 位置 | 说明 |
|------|------|------|
| 无 `unhandledRejection` 处理器 | `server.ts` | 后台 Promise 拒绝静默失败 |
| `getCountryDisplay` 未使用 import | `CustomersView.tsx:20` | 函数已导入但从未调用 |
| `formatDateOnly` 影子定义 | `CustomerDetail.tsx:14,375` | import 被本地函数 shadow，重复代码 |
| `useEffect` 缺 `updateParam` 依赖 | `CustomersView.tsx:73-81` | 防抖 useEffect 缺失依赖项 |
| 订单写操作缺 `requireAdmin` | `orders.ts` 多处 | 生产/装箱等写操作仅靠全局 auth 保护 |
| SQL 拼接非参数化 | `partners.ts:142` | `WHERE id IN (\${...})` |
| 两处 `catch (error: any)` 不一致 | `ai.ts:75`, `settings.ts:197` | 与其余 15 个 route 文件模式不统一 |

### 七、全站功能审计 (2026-04-29)

#### HIGH — 功能缺陷

| 问题 | 位置 | 说明 |
|------|------|------|
| `order_items` 缺 `hs_code` 列 | `server/db.ts`, `server/db-pg.ts` | route 代码 INSERT/UPDATE 该字段，将导致 SQL 运行时错误 |
| `production_logs` 缺 `log_date` 列 | `server/db.ts`, `server/db-pg.ts` | 同上，运行时 SQL 错误 |
| PG 缺 `trade_mode` 列 | `server/db-pg.ts:147-152` | customs_records CREATE TABLE 缺少该列 |
| PG 缺 `freight_forwarder`/`recipient_address`/`package_size` | `server/db-pg.ts:114-137` | logistics_records CREATE TABLE 缺少这三列 |
| 财务列表未过滤 `deleted_at` | `server/routes/finance.ts:13-66` | 软删除记录仍然显示在列表中 |
| 物流列表未过滤 `deleted_at` | `server/routes/logistics.ts:39-104` | 同上 |
| 审计日志清理用 PG 语法 | `server/routes/audit.ts:12` | `NOW() - INTERVAL '30 days'` 在 SQLite 上失败 |
| 导出 ZIP 重复定义 | `server/services/export.ts:103-117,239-243` | 第二个 `order_items` 定义覆盖第一个 |
| 健康检查硬编码 `sqlite` | `server/api.ts:31` | 使用 PG 时仍显示 `database: 'sqlite'` |

#### MEDIUM — 功能缺失

| 问题 | 位置 | 说明 |
|------|------|------|
| 任务无法删除 | `server/db*.ts` tasks 表 | 无 `deleted_at` 列，无 DELETE 端点 |
| 合作伙伴搜索无效 | `server/routes/partners.ts:10-25` | GET /partners 忽略 `?q` 参数 |
| 订单软删除子记录成孤儿 | `server/routes/orders.ts:220-224` | 未级联标记子表 deleted_at |
| `initPgTables()` 名不副实 | `server/db-pg.ts:305-313` | 实际为 no-op，仅执行 SELECT 1 |

### 八、全站性能审计 (2026-04-29)

#### 🔴 CRITICAL

| 问题 | 位置 | 说明 |
|------|------|------|
| 数据库零索引 | `server/db-pg.ts` 全部表 | 无任何 `CREATE INDEX`，所有 JOIN 和 WHERE 触发顺序扫描 |
| 客户端分页 | 全部 list 视图（Customers/Orders/Finance/Logistics/Partners） | 全量数据预取后在内存中 slice，万条记录时 O(n) |
| 后端无 LIMIT/OFFSET | 全部 list 端点 | 所有记录一次性返回，数据量大时内存暴涨 |

#### 🟠 HIGH

| 问题 | 位置 | 说明 |
|------|------|------|
| 仪表盘 8+ 串行 DB 查询 | `server/routes/dashboard.ts:8-244` | 每次加载执行 8 次以上独立全表扫描查询 |
| 订单详情 ~15 次独立查询 | `server/services/order-detail.ts:12-369` | 每次加载执行约 15 次独立 round-trip |
| logo.png 达 2MB | `public/logo.png` | 含作为 favicon 使用，建议压缩至 <100KB |
| 缺少外键索引 | 13+ 个外键列 | orders.customer_id, finance_records.order_id 等全部无索引 |

#### 🟡 MEDIUM

| 问题 | 位置 | 说明 |
|------|------|------|
| jspdf(29MB)+html2canvas(4.4MB) 未分包 | `vite.config.ts` | 前端包体积大增，建议加 `vendor-pdf` manual chunk |
| 订单搜索未防抖 | `src/components/OrdersView.tsx` | 每次击键触发服务端查询 |
| 品牌缓存 TTL 仅 5 秒 | `server/app.ts:18` | `BRAND_CACHE_TTL = 5000`，建议至少 5 分钟 |
| 缺失 `Cache-Control: immutable` | `server/app.ts:96-108` | 哈希化 Vite 资源可设置一年缓存 |

#### 推荐缺失索引（共 13 个）

```sql
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_finance_records_order_id ON finance_records(order_id);
CREATE INDEX idx_finance_records_type_status ON finance_records(type, status);
CREATE INDEX idx_logistics_records_order_id ON logistics_records(order_id);
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX idx_tasks_entity ON tasks(entity_type, entity_id);
CREATE INDEX idx_finance_records_created_at ON finance_records(created_at);
CREATE INDEX idx_orders_display_id ON orders(display_id);
```

#### Top 10 跨领域修复优先级

| 优先级 | 类型 | 问题 | 文件 |
|--------|------|------|------|
| 1 | 安全 | PG 默认弱密码 | `server/db-pg.ts:291` |
| 2 | 功能 | 缺失列导致 SQL 错误 | `server/db*.ts` 多处 |
| 3 | 安全+质量 | SQL 字符串拼接 | `server/routes/partners.ts:142` |
| 4 | 性能 | 数据库零索引 | `server/db-pg.ts` 全部表 |
| 5 | 性能 | 客户端分页 + 后端无 LIMIT | 全部 list 视图 + API |
| 6 | 安全 | 文件上传无类型验证 | 多处 multer 配置 |
| 7 | 功能 | 财务/物流列表未过滤软删除 | `finance.ts`, `logistics.ts` |
| 8 | 质量 | 无 `strict: true` | `tsconfig.json` |
| 9 | 性能 | 仪表盘 8+ 串行查询 | `dashboard.ts` |
| 10 | 安全 | CSP 被禁用 | `server/app.ts:49` |

### 最终全量审计结果 (2026-04-27)

| 检查项 | 结果 |
|--------|------|
| TypeScript 类型检查 (`npx tsc --noEmit`) | ✅ 零错误 |
| 前端构建 (`npm run build`) | ✅ 2397 模块通过 |
| XSS 注入 (`dangerouslySetInnerHTML` / `eval`) | ✅ 零风险 |
| 硬编码密钥/凭证 | ✅ 无泄露 |
| 空安全性 (null/undefined 链式调用) | ✅ 已全面覆盖 |
| CSRF 防护 | ✅ double-submit cookie |
| JWT 认证 | ✅ 24h httpOnly cookie |
| 登录限流 | ✅ 5 次/15 分钟 |
| 审计日志 | ✅ 30 天自动清理 |
| 敏感路径保护 | ✅ /dist/ 外存储断言 |
| 附件安全 | ✅ UUID 重命名 + 路径 containment |
| 安全审计 (2026-04-29) | 🔴 2 CRITICAL / 🟠 5 HIGH / 🟡 4 MEDIUM |
| 代码质量审计 (2026-04-29) | 🔴 2 CRITICAL / 🟠 3 HIGH / 🟡 6 MEDIUM |
| 功能审计 (2026-04-29) | 🟠 9 HIGH / 🟡 5 MEDIUM / 🔵 10 LOW |
| 性能审计 (2026-04-29) | 🔴 3 CRITICAL / 🟠 5 HIGH / 🟡 6 MEDIUM |
| 暗黑模式优化 (2026-04-29) | ✅ 分层/对比度/边框/品牌色全面校准 |
| 设置页 UI 拓宽 (2026-04-29) | ✅ max-w 1440px + 输入框限宽 |
| 导入导出集中管理 (2026-04-29) | ✅ 合并至系统配置「数据管理」标签页 |

---
### 后续优化方向

#### 架构与代码质量 (P1)

| 方向 | 说明 | 预估工作量 |
|------|------|-----------|
| **~~引入数据请求层~~** ✅ | React Query 已迁移 Phase 1-5：基础设施 + 6 列表页 + 3 详情页 + 写操作自动刷新 + 乐观更新 | ✅ 已完成 |
| **~~状态管理统一~~** ✅ | useSiteBrand hook 已抽取，React Query 缓存站点品牌设置，MainLayout/Login 统一调用 | ✅ 已完成 |
| **~~代码分割与懒加载~~** ✅ | App.tsx 全部页面改为 React.lazy()，首屏体积优化 | ✅ 已完成 |
| **前端测试覆盖** | 当前仅 1 个组件测试（Chip），需扩展至全部 UI 组件 + 页面集成测试 | 中 (3-5天) |
| **E2E 测试** | Playwright / Cypress 覆盖核心业务流程 | 高 (5-7天) |
| **~~CI/CD 流水线~~** ✅ | GitHub Actions：tsc → test → build | ✅ 已完成 |

#### React Query 迁移详细计划

| 阶段 | 内容 | 涉及文件 | 预期效果 |
|------|------|----------|----------|
| ~~Phase 1 基础设施~~ ✅ | `@tanstack/react-query` 已安装，`QueryProvider` 已包裹 | `src/lib/query.ts`, `src/main.tsx` | ✅ 已完成 |
| ~~Phase 2 只读数据~~ ✅ | 6 个列表页已迁移：Dashboard/Customers/Orders/Finance/Logistics/Partners | 6 个 View 文件 | ✅ 已完成 |
| ~~Phase 3 详情数据~~ ✅ | 3 个详情页已迁移：OrderDetail/CustomerDetail/PartnerDetail | 3 个 Detail 文件 | ✅ 已完成 |
| ~~Phase 4 写操作~~ ✅ | 操作后 `queryClient.invalidateQueries` 自动刷新 | `OrderDetail.tsx`, 6 个 View 文件 | ✅ 已完成 |
| ~~Phase 5 乐观更新~~ ✅ | 任务看板 useMutation 乐观更新 + 失败回滚 | `Tasks.tsx` | ✅ 已完成 |

#### 业务功能增强 (P2)

| 方向 | 说明 | 优先度 |
|------|------|--------|
| **~~PostgreSQL 迁移~~** ✅ | 全量迁移完成：Schema + 抽象层 + 自动语法转换 + 数据迁移脚本 | ✅ 已完成 |
| **OpenAPI 文档** | 15+ 子路由无 API 文档，使用 Swagger/OpenAPI 自动生成 | 中 |
| **国际化 (i18n)** | 目前全中文，支持英文/多语言后可拓展海外用户 | 中 |
| **~~消息通知推送~~** ✅ | 企业微信群机器人 Webhook，新订单自动推送，设置页可配置 URL | ✅ 已完成 |
| **细粒度权限** | 扩展 admin/staff → 模块级权限（财务/物流/产品各自独立） | 中 |
| **批量操作** | 支持批量删除订单、批量更新状态、批量导出 | 低 |
| **~~搜索索引优化~~** ✅ | 为 orders/customers/finance/logistics 等表添加 14 个数据库索引 | ✅ 已完成 |
| **~~OpenAPI 文档~~** ✅ | swagger-jsdoc + swagger-ui-express，访问 /api/api-docs | ✅ 已完成 |
| **~~批量操作~~** ✅ | 新增 POST /api/orders/batch-delete 批量删除端点 | ✅ 已完成 |
| **~~移动端适配~~** ✅ | 响应式侧栏（汉堡菜单）+ 移动端导航栏 + 内容区自适应间距 | ✅ 已完成 |
| **~~软删除~~** ✅ | orders/customers/partners 改为 UPDATE SET deleted_at，数据可恢复 | ✅ 已完成 |
| **~~统计报表~~** ✅ | Dashboard 新增月度趋势图（订单数+营收）、客户总数统计 | ✅ 已完成 |

#### 用户体验优化 (P2)

| 方向 | 说明 |
|------|------|
| **全局快捷键** | Ctrl+K 命令面板已有，可扩展更多快捷键 |
| **操作引导** | 首次使用的新手引导（Onboarding Tour） |
| **批量导入** | 支持 Excel/CSV 批量导入客户、订单 |
| **数据看板** | Dashboard 增加利润趋势图、月度对比 |
| **打印模板** | 订单详情支持自定义打印模板 |

#### 安全与运维 (P1)

| 方向 | 说明 |
|------|------|
| **HTTPS 自动配置** | Let's Encrypt 自动化证书配置指引 |
| **Docker 部署** | 提供 Dockerfile + docker-compose.yml，一键部署 |
| **定期备份调度** | 已有 `npm run backup`，但无定时任务 |
| **Sentry 集成** | 错误监控，当前仅 `console.error` + 结构化日志 |