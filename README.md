# SmartTrade AI CRM

SmartTrade AI CRM 是一个面向小团队协作的外贸订单与利润管理工作台，适合 2-10 人在单机或局域网环境中共享使用。支持 **macOS 桌面应用**（双击即用）和 **服务器部署**（Docker / 本地 PostgreSQL）。

核心业务链路：

- 客户 → 订单 → 生产 → 财务 → 报关 → 物流 → **利润核算**

---

## 系统功能结构

### 业务控制台 (Dashboard)
- 全局数据面板（订单数、收付款金额、订单状态分布）
- 今日待办与阻点预警（逾期未收款、缺失报关单、缺物流单）
- 业务流转动态追踪与快捷操作入口

### 客户 360° 全景
- 客户档案（ISO 3166 国家选择器、国旗显示）
- 联系人矩阵、跟进记录流、系统动态
- 安全脱敏：display_id 路由与 IDOR 防护

### 订单主工作台 (Order Detail)
- **基础信息**：商品明细、总价、交期
- **生产排产**：节点追踪、质检状态机、生产日志
- **财务流水**：多币种收付款、回款进度、水单凭证
- **装箱物流**：装箱参数、货运代理、轨迹跟踪
- **报关追踪**：单据预录、放行状态
- **核心单据库**：统一凭证上传与管理

### 外贸利润核算 (Profit Module)
- **多期收款**：支持定金/尾款多笔录入，USD/CNY 币种切换
- **结汇逻辑**：银行手续费 → 平台扣费 → 汇率换算 → 人民币到账
- **退税自动化**：开票金额 × 退税率 / 1.13 自动计算
- **成本明细**：工厂采购价、国内费用、国际运费(CNY/USD切换)、报关杂费
- **风控预警**：运费倒挂警告、利润率 < 8% 红线提醒
- **收益总览**：Net USD / 总收入 / 总成本 / 净利润 / 利润率

### 合作伙伴 360°
- 伙伴画像卡片、合作概览（月度订单数）
- 关联订单、财务流水双标签查看

### 财务流水
- 多币种收付款汇总、分页、时间筛选

### 物流打包
- 国内/国际段物流记录跟踪

### 团队协同看板 (Tasks)
- 三列看板（待处理 / 进行中 / 已完成）
- 任务指派、优先级、评论与附件

### AI 助手
- 全局悬浮 AI 助手按钮（任意页面右下角）
- **工具调用**：创建任务、查询订单、查看逾期、添加跟进
- 多模型支持（DeepSeek / OpenAI / Gemini）
- 聊天记录本地持久化

### 系统设置
- **站点品牌**：自定义站点名称、口号、Logo、Favicon
- 单据编码规则、默认币种
- **团队管理**：创建/编辑/停用账号
- **AI 配置**：提供商选择、API Key、连接测试
- **数据导出**：Excel 工作簿(12 Sheet) / 客户归档(ZIP+附件+Excel) / CSV
- **版本更新**：一键检测并自动更新系统

---

## 安全架构

| 措施 | 说明 |
|------|------|
| JWT 认证 | 24h 过期 httpOnly cookie |
| CSRF 防护 | double-submit cookie 全站保护 |
| 角色权限 | admin / staff 两级 |
| 密码加密 | bcrypt 10 轮 |
| 敏感路径保护 | 阻止直接访问 .env/.git/.db |
| 附件安全 | UUID 重命名、路径 containment、MIME 白名单 |
| 前端隐私盾 | 默认掩码邮箱/电话 |
| 登录限流 | 5 次/15 分钟 |
| 审计日志 | 所有 C/U/D 记录，30 天自动清理 |
| SQL 注入防护 | 全参数化查询（PG $N / SQLite ?） |
| CSV 公式注入防护 | 导出值自动添加 TAB 前缀 |
| 输入校验 | 所有字段 maxLength 限制、枚举白名单 |
| PII 脱敏 | AI 调用前递归脱敏姓名/电话/邮箱/地址 |
| 全局错误处理 | Express 5 Native Async + 统一中间件 |

---

## 快速部署

### 方式一：macOS 桌面应用（推荐，零配置）

双击即用，无需安装 Node.js、PostgreSQL 或任何运行环境。

```bash
# 1. 克隆项目
git clone https://github.com/HIUIE/CRM.git
cd CRM

# 2. 安装依赖
npm install

# 3. 打包 macOS 应用
npm run build
npm run electron:build
```

输出文件：`release/SmartTrade CRM-1.0.4-arm64.dmg`

安装后打开 `.dmg`，将 `SmartTrade CRM.app` 拖入 `Applications` 文件夹即可。首次启动会自动创建 SQLite 数据库，数据存储在：

```
~/Library/Application Support/SmartTrade CRM/
├── data/
│   └── crm.db              # SQLite 数据库
└── uploads/                # 上传附件
```

默认管理员账号：`root` / `root`

> 开发模式：`npm run electron:dev`（带热重载的 Electron 窗口）

---

### 方式二：Docker 部署（Windows/macOS/Linux 通用）

**前提：** 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
git clone https://github.com/HIUIE/CRM.git
cd CRM

# 配置环境变量
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET（随机字符串）、INITIAL_ADMIN_PASSWORD

# 一键启动
docker compose up -d
```

> 首次启动需要下载镜像，耗时 1-3 分钟。

默认访问：`http://localhost:3000`
管理员账号：`root` / `.env` 中的 `INITIAL_ADMIN_PASSWORD`

---

### 方式三：本地部署（PostgreSQL）

#### 前置要求
- Node.js ≥ 20 LTS
- PostgreSQL ≥ 16

#### 安装步骤

```bash
git clone https://github.com/HIUIE/CRM.git
cd CRM
npm install

# 创建数据库（选择一种方式）
# macOS:   brew install postgresql@16 && brew services start postgresql@16 && createdb smarttrade_crm
# Linux:   sudo apt install postgresql && sudo -u postgres createdb smarttrade_crm
# Windows: 下载安装包 https://www.postgresql.org/download/windows/ 后执行 CREATE DATABASE smarttrade_crm;

# 配置环境变量
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET、INITIAL_ADMIN_PASSWORD、PG_PASSWORD

# 构建并启动
npm run build
DB_DRIVER=pg npm start
```

默认访问：`http://localhost:3000`

---

### 数据库模式切换

系统支持两种数据库后端，通过 `DB_DRIVER` 环境变量切换：

| 模式 | 环境变量 | 适用场景 |
|------|---------|---------|
| SQLite | `DB_DRIVER=sqlite`（默认） | 桌面应用、单机部署、零配置 |
| PostgreSQL | `DB_DRIVER=pg` | 服务器部署、多用户、Docker |

---

### 私有仓库更新配置

如果仓库是私有的，需要在 `.env` 中配置 GitHub Token：

```bash
# 访问 https://github.com/settings/tokens → Generate new token → 勾选 repo
GITHUB_TOKEN=ghp_你的token
```

配置后，设置页 → 版本更新 → 即可一键检测并更新系统。

---

## 自动更新机制

系统内置了完整的自动更新链路：

1. **检测更新**：每 60 秒自动检测 GitHub 是否有新提交
2. **通知用户**：发现新版时右下角弹出蓝色提示
3. **一键更新**：管理员在设置页点击「一键更新系统」
4. **自动执行**：git pull → npm install → npm run build → 服务重启
5. **全员同步**：重启后所有在线用户收到刷新提示

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（Vite HMR 热重载） |
| `npm run build` | 构建前端 |
| `npm start` | 生产模式（PostgreSQL） |
| `npm test` | 后端测试 |
| `npm run test:frontend` | 前端测试 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run seed:demo` | 填充演示数据 |
| `npm run electron:dev` | Electron 开发模式 |
| `npm run electron:build` | 打包 macOS .app |

---

## 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS v4 + Vite
- **后端**：Express 5 + PostgreSQL 16 / SQLite (better-sqlite3)
- **数据层**：`@tanstack/react-query`（自动缓存 + 乐观更新）
- **桌面应用**：Electron（macOS .app 打包）
- **动画**：View Transitions API（页面切换淡入淡出）
- **图标**：Lucide React
- **AI**：Google GenAI SDK / OpenAI 兼容 API / DeepSeek
- **导出**：ExcelJS (多 Sheet) / archiver (ZIP) / 纯 JS CSV
- **安全**：JWT + bcrypt + CSRF double-submit cookie + Helmet + CSP

---

## 数据备份

```bash
npm run backup
```

备份范围：数据库 + uploads 附件目录
默认路径：`data/backups/`

---

## 健康检查

```
GET /api/health
```

返回服务状态、数据库模式、运行模式、启动时间。
