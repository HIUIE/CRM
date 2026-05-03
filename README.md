# SmartTrade AI CRM

SmartTrade AI CRM 是一个面向小团队协作的外贸订单与利润管理工作台，适合 2-10 人在单机或局域网环境中共享使用。

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
| SQL 注入防护 | 全参数化查询 |
| CSV 公式注入防护 | 导出值自动添加 TAB 前缀 |
| 输入校验 | 所有字段 maxLength 限制、枚举白名单 |
| PII 脱敏 | AI 调用前递归脱敏姓名/电话/邮箱/地址 |
| 全局错误处理 | Express 5 异步错误中间件 |

---

## 使用方式

三种使用场景，按需选择：

---

### 日常开发（浏览器访问，最方便）

如果你在本地开发/使用，**不需要打包 DMG**，直接用浏览器就行：

```bash
# 1. 只需一次安装
git clone https://github.com/HIUIE/CRM.git
cd CRM
npm install

# 2. 开发模式（改代码自动热重载）
npm run dev

# 3. 或者稳定使用（构建一次，长期跑）
npm run build
npm start
```

浏览器打开 `http://localhost:3000`。更新代码后重新 `npm run build`，刷新页面即可。

默认账号：`root` / `root`

---

### 场景 A：DMG 桌面应用（macOS，零配置，给别人用）

如果你拿到的是一个 `.dmg` 文件（如 `SmartTrade CRM-1.0.4-arm64.dmg`）：

**1. 安装**

双击 `.dmg` → 将 `SmartTrade CRM.app` 拖入 `Applications` 文件夹 → 双击打开。

首次打开时 macOS 可能提示"无法验证开发者"：

```
系统设置 → 隐私与安全性 → 仍要打开
```

**2. 登录**

打开后自动弹出登录页。默认账号：

| 用户名 | 密码 |
|--------|------|
| `root` | `root` |

> 首次登录后建议立即修改密码：设置 → 团队管理 → 重置密码。

**3. 数据存储位置**

所有数据（数据库 + 上传附件）自动存放在：

```
~/Library/Application Support/SmartTrade CRM/
└── data/backups/     # 自动备份目录
└── uploads/          # 上传的附件
```

**4. 备份**

直接复制 `~/Library/Application Support/SmartTrade CRM/` 整个文件夹即可完整备份。

**5. 多人共用**

如果需要团队共用，将 DMG 安装到一台 Mac 上，然后：

- 系统设置 → 共享 → 打开"远程登录"或部署到服务器
- 或者参考下方「场景 B」部署到服务器，团队成员浏览器访问

> **如何自己构建 DMG：** 克隆项目后执行 `npm install && npm run electron:build`，输出在 `release/` 目录。

---

### 场景 B：服务器部署（多人协作，浏览器访问）

适合部署到一台服务器上，团队成员通过浏览器访问。

#### 方式 B1：Docker（推荐，一条命令启动）

**前提：** 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（本地）或 Docker Engine（服务器）。

```bash
# 1. 克隆项目
git clone https://github.com/HIUIE/CRM.git
cd CRM

# 2. 配置环境变量
cp .env.example .env
```

编辑 `.env`，修改以下三项：

```ini
JWT_SECRET=改成随机长字符串至少32位
INITIAL_ADMIN_PASSWORD=设置你的管理员密码
PG_PASSWORD=设置数据库密码
```

```bash
# 3. 启动
docker compose up -d
```

首次启动会自动下载镜像（约 1-3 分钟），之后秒开。

访问：`http://<服务器IP>:3000`

---

#### 方式 B2：本地 Node.js + PostgreSQL

**前提：** Node.js ≥ 20、PostgreSQL ≥ 16。

```bash
# 1. 克隆并安装
git clone https://github.com/HIUIE/CRM.git
cd CRM
npm install

# 2. 安装并启动 PostgreSQL
# macOS:
brew install postgresql@16
brew services start postgresql@16
createdb smarttrade_crm

# Linux:
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb smarttrade_crm

# Windows:
# 下载 https://www.postgresql.org/download/windows/
# 安装后在 SQL Shell 执行: CREATE DATABASE smarttrade_crm;

# 3. 配置环境变量
cp .env.example .env
# 修改 JWT_SECRET、INITIAL_ADMIN_PASSWORD、PG_PASSWORD

# 4. 构建前端并启动
npm run build
npm start
```

访问：`http://localhost:3000`

---

#### 服务器持久化运行

本地 `npm start` 关掉终端就停了。生产环境建议用 **pm2** 保活：

```bash
npm install -g pm2
pm2 start "npm start" --name smarttrade-crm
pm2 save
pm2 startup          # 设置开机自启
```

或者 **systemd**（Linux）：

```ini
# /etc/systemd/system/smarttrade-crm.service
[Unit]
Description=SmartTrade CRM
After=network.target postgresql.service

[Service]
Type=simple
User=www
WorkingDirectory=/opt/crm
Environment=NODE_ENV=production
# PostgreSQL is required
ExecStart=/usr/bin/node --import tsx server.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now smarttrade-crm
```

#### 服务端默认账号

| 用户名 | 密码 |
|--------|------|
| `root` | `.env` 中 `INITIAL_ADMIN_PASSWORD` 的值 |

---

### 数据库模式说明

| 模式 | 设置 | 数据库文件 | 适用场景 |
|------|------|-----------|---------|
| PostgreSQL | 默认 | 外部 PG 数据库 | 服务器部署、团队协作 |

---

## 局域网访问

服务器启动后，团队成员在同一网络下通过浏览器访问：

```
http://<服务器局域网IP>:3000
```

例如：`http://192.168.1.100:3000`

> 服务器 IP 查看方式：macOS 在「系统设置 → 网络」、Linux 执行 `ip addr`、Windows 执行 `ipconfig`。

如果无法访问，检查防火墙是否放行了 3000 端口。

---

## 更新系统

### 浏览器 / 服务器模式

代码更新后：

```bash
git pull
npm install
npm run build
```

如果用了 pm2：`pm2 restart smarttrade-crm`

### DMG 桌面版

代码更新后重新打包：

```bash
git pull
npm install
npm run electron:build
```

把新的 `.dmg` 发给用户安装即可替换旧版。数据在 `~/Library/Application Support/SmartTrade CRM/`，与 `.app` 分开存储，升级不影响数据。

### 服务器版自动更新（仅 PostgreSQL 部署）

系统设置页 → 版本更新 → 一键检测并更新。

如果仓库是私有的，需要在 `.env` 中配置 GitHub Token：

```bash
GITHUB_TOKEN=ghp_你的token
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（修改代码自动热重载） |
| `npm run build` | 构建前端生产包 |
| `npm start` | 启动服务（需 PostgreSQL） |
| `npm test` | 后端测试 |
| `npm run test:frontend` | 前端测试 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run electron:build` | 打包 macOS DMG 安装包 |
| `npm run electron:dev` | Electron 桌面开发模式 |
| `npm run seed:demo` | 填充演示数据 |

---

## 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS v4 + Vite
- **后端**：Express 5
- **数据库**：PostgreSQL 16
- **桌面应用**：Electron（macOS DMG）
- **页面过渡**：View Transitions API
- **数据层**：TanStack React Query
- **AI**：Google GenAI / OpenAI 兼容 / DeepSeek
- **导出**：ExcelJS / archiver ZIP / 纯 JS CSV
- **安全**：JWT + bcrypt + CSRF + Helmet + CSP

---

## DMG 打包故障排除

如果 `npm run electron:build` 报错 `all goroutines are asleep - deadlock!`，说明上次中断留下了损坏的缓存：

```bash
rm -rf ~/Library/Caches/electron ~/Library/Caches/electron-builder release/
npm run electron:build
```

---

## 数据备份

```bash
# 通过系统内置的自动备份功能备份数据
cp -r data/ ~/Desktop/CRM-备份/

# DMG 桌面版：
cp -r ~/Library/Application\ Support/SmartTrade\ CRM ~/Desktop/CRM-备份/

# 服务器版（PostgreSQL）：
npm run backup    # 备份到 data/backups/
```

---

## 健康检查

```
GET /api/health
```

返回服务状态、数据库类型、运行模式、启动时间。
