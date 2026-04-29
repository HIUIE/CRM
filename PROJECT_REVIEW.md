# SmartTrade AI CRM 项目审计报告

审计日期：2026-04-29

本报告基于当前工作区代码、现有测试、构建结果和运行脚本整理。仓库当前有未提交改动，本次审计只给出结论，不回滚任何现有变更。

## 结论摘要

项目已经具备完整的 CRM 主链路，当前最危险的权限、事务、品牌注入和前端请求链路问题都已经收掉，测试与构建也恢复到了通过状态。

目前剩余的主要问题已经从“上线阻断级”收敛到两类：

1. 自动更新已经改成后台任务加状态查询，并把最近一次状态、命令输出和最近几次历史归档落盘；但仍然是单进程内执行，跨进程协同和更长周期的历史检索还有提升空间。
2. 前端包体偏大、数据库双栈兼容层仍在，后续维护和首屏性能还有优化空间。

本轮继续修复后，`/api-docs`、生产 `CSP`、导入临时文件目录、CSV 解析、健康检查数据库类型、设置页更新 CSRF 调用都已与代码现状对齐。

## 一、安全审计

### 已修复

#### 1. 任务详情/评论/修改的对象级授权缺失

- 已修复位置：`server/routes/tasks.ts:16-25`, `server/routes/tasks.ts:72-77`, `server/routes/tasks.ts:137-145`
- 结果：任务详情、评论、状态变更、元数据修改现在都要求当前用户是管理员、负责人或创建人。
- 验证：`tests/core.test.ts` 已新增越权回归测试并通过。

#### 2. 品牌设置持久化 XSS

- 已修复位置：`server/lib/brand.ts:1-31`, `server/app.ts:29-45`, `server/routes/settings.ts:44-54`
- 结果：
  - 品牌文案保存时做归一化
  - 品牌资源 URL 只接受根路径或 `http/https`
  - 首页注入 `<title>` 与 `<link rel="icon">` 时做 HTML escape

#### 3. SVG 品牌上传扩大 XSS 攻击面

- 已修复位置：`server/routes/settings.ts:28-32`
- 结果：品牌上传已移除 `image/svg+xml`，当前仅允许 `png/jpg/gif/webp/ico`。

#### 4. API 文档已收口

- 已修复位置：`server/api.ts:61-66`
- 结果：`/api/api-docs` 现在位于认证链路之后，且仅在非生产环境挂载，并附加 `requireAdmin`。

#### 5. 生产环境 CSP 已启用

- 已修复位置：`server/app.ts:65-76`
- 结果：
  - 开发环境仍允许关闭 CSP，避免影响本地 Vite 开发
  - 生产环境启用最小可用 CSP，限制脚本来源为 `'self'`
  - 保留样式内联白名单，并明确 `img-src` / `connect-src` 约束

### 已有加固点

- JWT 必填，未配置会在启动时报错：`server/lib/auth.ts:16-19`
- 全站写操作已挂 CSRF 中间件：`server/api.ts:56-57`
- 登录有限流雏形：`server/routes/auth.ts:8-31`
- 附件下载有路径约束：`server/routes/files.ts:11-47`, `server/lib/files.ts:17-39`
- 敏感路径探测被拦截：`server/lib/security.ts:17-33`

## 二、功能审计

### 已修复

#### 1. PostgreSQL 事务实现无效

- 已修复位置：`server/lib/db.ts:50-164`
- 结果：
  - 新增 `withTransaction(...)`
  - PostgreSQL 事务现在绑定同一个 `client`
  - SQLite 测试路径仍保持兼容
- 已切换调用点：
  - `server/routes/tasks.ts:145-182`
  - `server/routes/import.ts:107-148`, `server/routes/import.ts:159-202`
  - `server/routes/orders.ts` 的创建、更新、删除关键写链路

#### 2. 设置页“一键更新”前端调用缺少 CSRF 头

- 已修复位置：`src/pages/Settings.tsx:151-160`
- 结果：设置页更新接口已经改为走 `apiFetch(...)`，现在会自动携带 `X-CSRF-Token`。

#### 3. 健康检查数据库类型已修正

- 已修复位置：`server/api.ts:29-36`
- 结果：`/api/health` 现在会按实际驱动返回 `postgresql` 或 `sqlite(test)`。

### 中优先级

#### 4. 导入临时文件目录与清理链路已对齐

- 已修复位置：`server/routes/import.ts:17`, `server/routes/import.ts:92`, `server/routes/import.ts:155-162`, `server/app.ts:49-61`
- 结果：
  - 上传与执行统一使用 `UPLOADS_DIR/temp`
  - 应用启动会清空遗留临时文件
  - 导入执行结束后会在 `finally` 中删除临时文件

#### 5. CSV 导入不再走手写 `split(',')`

- 已修复位置：`server/routes/import.ts:213-239`
- 结果：备份导入现在通过 `ExcelJS` 的 CSV 读取能力解析，带逗号和引号的数据不再靠手写拆分。

#### 6. 自动更新已改为后台任务，并支持状态、日志和最近历史持久化

- 位置：`server/routes/settings.ts`, `src/pages/Settings.tsx:100-189`
- 现状：
  - `POST /system/update` 现在只负责启动后台任务，前端通过状态接口轮询进度
  - 更新进行中会返回 `409 SYSTEM_UPDATE_IN_PROGRESS`
  - 状态和最近一次结果会写入磁盘，服务重启后仍可读取
  - 每一步命令的最近输出也会被裁剪后持久化，前端可直接查看
  - 最近几次更新会按时间倒序归档，可在前端查看
  - 失败信息会保留并返回给前端
  - 成功后仍通过 `process.exit(0)` 触发重启
- 影响：前端阻塞和并发踩踏问题已明显改善，最近状态、命令输出和近期历史都能恢复；但仍缺少跨实例协调、更长周期的日志检索和外部 supervisor 级别的托管。
- 建议：下一步把更新记录接入可检索存储，或交给外部 supervisor / 独立 worker 托管。

### 验证结果

- `npm run lint`：通过
- `npm test`：通过
- `npm run build`：通过，但仍有大 chunk 警告

## 三、优化审计

### 性能

#### 1. `OrderDetail` 主 chunk 已显著收敛

- 已修复位置：`src/pages/OrderDetail.tsx`, `src/features/order-detail/sections-primary.tsx`, `src/features/order-detail/handlers.ts`
- 结果：
  - 首屏必需的头部和商品区已独立到主 chunk
  - 文档、财务、利润、生产、报关、装箱、物流、任务等板块改为延迟 chunk
  - PDF 导出依赖改为按需动态加载
- 当前构建结果：
  - `dist/assets/OrderDetail-*.js` 约 `36 kB`
  - 延迟加载的 `dist/assets/sections-*.js` 约 `48 kB`
  - 延迟加载的 `dist/assets/pdfExport-*.js` 约 `594 kB`
- 影响：订单详情首屏加载成本已明显下降，之前的主 chunk 超限 warning 已消失。

#### 2. `Tasks` 页面体积仍偏大

- 构建结果：`dist/assets/Tasks-*.js` 约 `139 kB`
- 建议：将评论抽屉、上传、通知逻辑从主屏拆出去。

### 可维护性

#### 3. 代码库仍有“双数据库世界”

- 位置：`server.ts`, `server/db-pg.ts`, `server/db.ts`, `server/lib/db.ts`
- 现状：生产入口走 PostgreSQL，但测试和一部分历史逻辑仍深度依赖 SQLite 语法，再通过 `pgParams()` 做字符串替换兼容。
- 风险：行为差异很难靠测试发现，后续每个查询都要担心两套数据库语义。
- 建议：
  - 明确“测试也跑 PostgreSQL”还是“正式回归 SQLite”。
  - 如果继续用 PostgreSQL，逐步去掉 SQL 字符串兼容层。

#### 4. 文档和代码现状明显脱节

- 位置：`README.md`, 旧版 `PROJECT_REVIEW.md`
- 现状：文档声称“安全/自动更新/审计等已全部完备”，但当前代码和测试并不支持这个结论。
- 建议：文档改为“当前状态 + 已知限制 + 部署前检查表”，避免误导上线判断。

### 测试

#### 5. 关键高风险面仍有测试缺口

- 缺口：
  - PostgreSQL 实连接事务一致性
  - 导入临时文件清理的端到端覆盖
  - 品牌设置的注入/XSS 防护
  - 自动更新更长周期的历史检索与告警
- 已补回归：
  - 任务越权访问
  - 设置页更新并发互斥
  - 自动更新后台任务、状态查询与重启后恢复
- 建议：继续围绕高风险写链路补最小回归测试，优先级高于新增功能测试。

## 四、建议执行顺序

### P1

1. 给自动更新补更长周期的历史检索、告警和跨进程恢复策略。
2. 给品牌设置、导入清理和 PostgreSQL 事务补端到端测试。

### P2

1. 拆分 `OrderDetail` 和 `Tasks` 大 chunk。
2. 清理 SQLite/PG 双栈兼容层。

## 五、总体评价

这是一个已经能跑主业务的项目，不是半成品。当前最危险的权限、事务、品牌注入和接口暴露问题已经收掉，测试和构建也都恢复到了可用状态。

如果按上面的 P1/P2 继续推进，这个项目会从“核心风险已控”进入“可持续部署和维护”的阶段。
