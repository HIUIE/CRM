# SmartTrade AI CRM v1.1

SmartTrade AI CRM 是一个面向中小型外贸团队的一站式、AI 驱动的订单与利润管理工作台。它不仅是一个客户管理系统，更是一个涵盖生产、财务、报关、物流及深度利润核算的全流程业务闭环平台。

---

## 核心亮点 (Core Highlights)

### 1. 深度外贸利润模型
*   **汇率快照机制 (New)**：订单成交即锁定汇率，规避汇率波动对历史利润分析的影响。
*   **多期收款管理**：支持定金、尾款多笔录入，自动计算回款进度与待收余款。
*   **自动化退税核算**：基于开票金额、退税率及汇率快照，秒级生成净利润报告。
*   **风险预警引擎**：自动检测运费倒挂、利润率低于 8% 红线及逾期回款风险。

### 2. 智能化协同助手
*   **10 轮上下文记忆 (New)**：AI 助手现在具备连续对话能力，能深度理解您的业务指令。
*   **智能防重校验 (New)**：基于 Levenshtein 相似度算法，自动识别并拦截相似客户录入。
*   **多模型适配**：深度集成 DeepSeek-v3、Gemini 1.5 Pro 及 OpenAI 兼容接口。
*   **自动化工具调用**：AI 可直接帮您创建任务、查询订单状态或记录跟进。

### 3. 企业级安全加固
*   **细粒度数据隔离 (New)**：业务员 (Staff) 仅可见归属自己的客户与订单，管理员 (Admin) 掌控全局。
*   **跨模块越权防护 (New)**：AI 订单分析、批量订单状态、合作伙伴与联系人编辑均统一校验数据归属，防止越权读取或修改客户资料。
*   **配置层对称加密 (New)**：AI API Key 等敏感配置在数据库中以 AES-256-GCM 密文存储。
*   **Webhook 签名校验 (New)**：发送通知时携带 HMAC-SHA256 签名，确保第三方接收端安全。
*   **高强度身份认证**：强密码策略验证（带 UI 指示条）及 HttpOnly JWT 防盗令牌。

### 4. 业务全景画像
*   **联系人矩阵 (New)**：一个合作伙伴支持管理多个业务、财务、技术对接人。
*   **实时物流看板 (New)**：集成模拟追踪链路，支持手动刷新轨迹并展示实时动态摘要。
*   **负责人筛选 (New)**：客户档案和订单列表支持按负责人筛选，便于主管盘点团队业绩与交接风险。
*   **360° 客户全景**：聚合订单、财务、任务、跟进、联系人及所有系统活动流。

---

## 系统功能模块

*   **业务控制台 (Dashboard)**：汇总待办事项、逾期预警、财务收支及业务增长趋势。
*   **订单工作台**：涵盖商品明细、生产排产（质检机）、装箱单、报关单及核心单据库。
*   **财务管理**：多币种收付款流水、财务凭证 (水单) 管理、自动化核销联动。
*   **任务协同**：三列式 Kanban 看板，支持任务指派、附件评论及 @ 提行通知。
*   **审计日志 (Audit)**：全站操作溯源，支持自动归档逻辑 (New) 确保持久化性能。

---

## 最新迭代说明 (2026-05-10)

*   **首页效率工作台**：新增“今日风险工作台”视角，优先聚合逾期回款、临近交付、待订舱、缺单据等高优先级事项。
*   **客户与订单负责人联动**：客户档案、订单列表均支持负责人筛选；客户转交可同步未完成订单和待办任务。
*   **订单多币种结算**：创建订单支持 USD/CNY/EUR/GBP/HKD/JPY，人民币付款、不退税和视同内销订单不再被强制显示为 USD。
*   **外贸订单留痕增强**：订单详情补齐生产/QC 图片、装箱/装柜图片、报关槽位、运输附件缩略图及非图片文件类型展示。
*   **安全审计修复**：AI 订单分析、订单批量更新、合作伙伴及联系人接口已补充服务端归属校验，并加入回归测试。
*   **说明书与审计记录**：本说明书、CHANGELOG 与 `docs/security-review-2026-05-10.md` 已同步最新安全结论。

---

## 快速开始

### 1. 环境准备
*   **Node.js**: v20+
*   **PostgreSQL**: v16+

### 2. 获取代码并安装
```bash
git clone https://github.com/HIUIE/CRM.git
cd CRM
npm install
```

### 3. 数据库初始化 (PostgreSQL)
在启动应用前，您需要确保 PostgreSQL 数据库已创建且账号权限正确。

#### **方案 A：使用默认账号 (快速开始)**
如果您的本地 PostgreSQL 使用默认设置，请在 `.env` 中使用：
*   `PG_USER=postgres`
*   `PG_PASSWORD=您的安装密码`

#### **方案 B：创建专用账号与数据库 (生产推荐)**
请打开终端运行以下 SQL 命令（或使用 pgAdmin 可视化工具）：

```sql
-- 1. 创建专用业务账号
CREATE ROLE bancycrm WITH LOGIN PASSWORD '您的自定义强密码';

-- 2. 创建所属数据库
CREATE DATABASE bancycrm OWNER bancycrm;

-- 3. (可选) 如果连接报错，授予该账号对数据库的全部权限
GRANT ALL PRIVILEGES ON DATABASE bancycrm TO bancycrm;
```

### 4. 配置文件
复制 `.env.example` 为 `.env`，并根据上方创建的数据库信息进行修改：
```ini
# 安全：至少 32 位随机字符串，可用 openssl rand -base64 48 生成
JWT_SECRET=your_32_char_random_secret

# 安全：用于加密 API Key 等敏感配置（必须配置）
DB_ENCRYPTION_KEY=your_32_char_encryption_key

# 初始管理员密码（启动时自动设置 root 账号）
INITIAL_ADMIN_PASSWORD=your_strong_password_here

PG_USER=your_pg_user
PG_PASSWORD=your_pg_password
```

### 5. 构建并启动
```bash
# 构建前端并启动（推荐生产使用）
npm run build
npm start

# 或者开发模式（Vite 热更新）
npm run dev
```

> **注意**：数据库迁移（建表、索引）在应用启动时**自动**执行，无需手动运行迁移命令。

### 6. 初始登录
*   **访问地址**: `http://localhost:3000`
*   **用户名**: `root`
*   **密码**: 由 `.env` 中 `INITIAL_ADMIN_PASSWORD` 决定（登录后请在设置中修改）

> **安全警告**：`INITIAL_ADMIN_PASSWORD` 是首次初始化 root 账号的唯一凭证。如果 `.env` 中未设置此值，开发环境将自动生成随机密码（打印在控制台），**生产环境将拒绝启动**。

---

## 技术栈 (Tech Stack)

*   **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite
*   **Backend**: Express 5 (Async Error Handling)
*   **Database**: PostgreSQL 16 (With Composite Indexing)
*   **State Management**: TanStack React Query v5
*   **Encryption**: AES-256-GCM + bcrypt + HMAC
*   **Deployment**: Support PM2 / Docker Compose / Electron DMG

---

## 跨平台构建注意

Vite 8 使用 `rolldown` 作为打包器，它依赖当前平台的 native binding。
如果您的开发机（如 macOS）与部署服务器（如 Linux）架构不同，**请在目标平台上重新执行 `npm install`**：

```bash
# 在部署服务器上（不要直接拷贝 node_modules 过来）
rm -rf node_modules package-lock.json
npm install
```

否则会看到类似 `Cannot find native binding` 的错误。

---

## 维护与备份

### 自动备份
在 **系统设置 -> 系统与维护 -> 数据管理** 中开启自动备份。系统将按设定的频率生成加密 ZIP 包到指定物理路径。

### 日志归档
定期使用 **审计日志归档** 功能，将 365 天前的旧日志移动到归档表，以优化主库的索引查询性能。

---

## 安全合规提示

1.  **严禁提交 `.env`**: 请确保真实密钥不进入版本控制系统。
2.  **HTTPS 部署**: 在公网环境部署时，建议使用 Nginx 反向代理并配置 SSL 证书。
3.  **Cookie 安全**: 公网 HTTPS 部署请设置 `COOKIE_SECURE=true`，确保登录 Cookie 与 CSRF Cookie 只在安全连接中传输。
4.  **数据归属权**: 系统默认启用负责人隔离制，管理员可在设置中调整成员角色；涉及客户、订单、AI 分析、批量操作、合作伙伴等接口均应保留后端权限校验。
5.  **备份加密**: 系统迁移与灾备包应使用高强度密码加密，导出文件不要通过公开网盘或群聊明文传输。
6.  **root 账号**: 初始化后请立即在设置页修改密码。生产环境强制要求通过 `INITIAL_ADMIN_PASSWORD` 设置初始密码。
