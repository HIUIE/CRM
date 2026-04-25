# SmartTrade AI CRM

SmartTrade AI CRM 是一个面向小团队协作的外贸订单与流程工作台，适合 2-5 人在单机或局域网环境中共享使用。当前版本把重点收敛在一条稳定主链上：

- 客户
- 订单
- 生产安排
- 财务
- 报关
- 物流

AI 保留为辅助能力，只负责把文本整理成订单草稿，以及辅助做订单风险诊断，不作为日常业务主流程的依赖。

## 系统功能结构

本项目以订单为核心，向外辐射各类外贸业务节点，形成闭环工作台：

1. **业务控制台 (Dashboard)**
   - 全局数据面板（订单数、收付款金额、订单状态分布）
   - 今日待办与阻点预警（逾期未收款、缺失报关单、缺物流单）
   - 业务流转动态追踪与快捷操作入口
2. **客户 360° 全景 (CRM & 360 Profile)**
   - 客户档案：基于 ISO 3166 标准的国家/地区选择器（带国旗 emoji）
   - **联系人矩阵**: 维护企业内部关键对接人的层级与权限
   - **跟进记录**: 社交媒体风格的跟进流记录，追踪客户全生命周期互动
   - **安全脱敏**: 基于 `display_id` (如 CUST-2026-XXXXXX) 的 URL 路由与 IDOR 防护
   - 合作伙伴：合作厂商、货代、报关行等供应链节点管理
3. **订单主工作台 (Order Workspace)**
   - **基础订单**: 商品明细、HS 编码、总价与交期
   - **生产排产**: 生产节点追踪（待产/排产/生产中/完工）、质检状态机、生产日志与关联工厂
   - **财务流水**: 多币种收付款记录、分类账务、回款进度条及水单凭证归档
   - **装箱与物流**: 装箱参数计算、货运代理指派、运输轨迹跟踪（国内/国际）及运单存档
   - **报关追踪**: 报关单据预录、放行状态追踪
4. **智能化辅助 (AI Assistant)**
   - 非结构化业务文本智能解析，一键生成订单草稿
   - 订单全案健康诊断与风险阻点分析
5. **系统与安全**
   - 基于角色的访问控制（管理员/普通业务员）
   - 本地沙箱化的鉴权附件存储，避免机密文件泄露

## 当前技术栈

- 前端：React 19 + Vite + Tailwind CSS
- 后端：Express
- 数据库：SQLite
- 认证：JWT + HttpOnly Cookie
- 存储：本地目录附件，统一经鉴权文件接口访问
- AI：Gemini / DeepSeek

## 团队协作模型

- 角色：
  - `admin`
  - `staff`
- `admin` 可以：
  - 管理系统设置
  - 管理 AI 配置
  - 管理团队账号
  - 删除关键业务记录
- `staff` 可以：
  - 查看和编辑业务数据
  - 使用订单工作台维护主链业务
  - 不能进入系统设置
  - 不能删除关键记录

首次部署仍会自动创建初始化管理员 `root`，生产环境必须通过 `INITIAL_ADMIN_PASSWORD` 指定临时密码。上线后请立即创建个人管理员账号，并修改或停用默认账号。

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

默认访问地址：

- [http://localhost:3000](http://localhost:3000)

### 3. 常用命令

```bash
npm run dev
npm run lint
npm test
npm run build
npm run start
npm run smoke:ui
npm run release:check
npm run backup
npm run seed:demo
```

## 第一版生产部署

### 1. 准备环境文件

复制 `.env.example` 为 `.env`，至少确认这些值：

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
CRM_DB_PATH=/absolute/path/to/erp_database_v2.sqlite
UPLOADS_DIR=/absolute/path/to/uploads
JWT_SECRET=replace-with-a-long-random-secret
INITIAL_ADMIN_PASSWORD=replace-with-a-temporary-root-password
COOKIE_SECURE=false
```

请确保 `CRM_DB_PATH` 和 `UPLOADS_DIR` 都位于前端静态目录 `dist/`、`public/` 之外的绝对路径，避免数据库、附件和环境文件被静态路由误暴露。

局域网 HTTP 部署时保持 `COOKIE_SECURE=false`。只有放到 HTTPS 后面时才改成 `true`。

### 2. 构建与上线前检查

```bash
npm install
npm run release:check
```

`release:check` 会执行类型检查、后端测试、前端生产构建和生产 smoke 检查。smoke 检查使用临时数据库，不会改动正式数据。

### 3. 启动生产服务

```bash
npm run start
```

启动后终端会打印本机地址、局域网访问提示、数据库路径、上传目录和运行模式。局域网成员使用部署机器的 IP 访问，例如：

```text
http://192.168.1.20:3000
```

### 4. 首次登录后

1. 使用 `root` 和 `INITIAL_ADMIN_PASSWORD` 登录。
2. 在系统设置里创建个人管理员和业务员账号。
3. 修改 root 密码，或保留 root 作为紧急账号但不要日常共用。
4. 配置 DeepSeek 或 Gemini；AI 不影响客户、订单、财务、物流主流程。

## 数据与环境变量

### 数据库

默认数据库文件：

- `erp_database_v2.sqlite`

可通过环境变量指定数据库路径：

```bash
CRM_DB_PATH=/absolute/path/to/team.sqlite
```

服务启动时会打印当前实际使用的数据库路径。

### 附件目录

开发环境下，本地附件默认保存到项目根目录下：

- `uploads/`

也可以通过环境变量指定：

```bash
UPLOADS_DIR=/absolute/path/to/uploads
```

附件不再通过静态目录公开访问。浏览器预览和下载统一走登录态保护的文件接口：

- `GET /api/files/:id/:storedName`

### 其他常用环境变量

- `CRM_DB_PATH`
- `UPLOADS_DIR`
- `JWT_SECRET`
- `INITIAL_ADMIN_PASSWORD`
- `COOKIE_SECURE`
- `HOST`
- `PORT`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`

## 健康检查

系统提供健康检查接口：

- `GET /api/health`

返回内容包含：

- 服务是否可用
- 当前数据库模式
- 运行模式
- 服务器时间

## 演示数据

如果你需要一套固定演示环境，可以执行：

```bash
npm run seed:demo
```

这会补齐一套演示客户、伙伴、订单、财务、生产、报关和物流数据，并创建一个演示业务账号：

- 用户名：`staff.demo`
- 密码：`staff123`

如果数据已存在，脚本会尽量复用，不会重复创建同一条演示订单。

## 局域网部署建议

适合 2-5 人共享使用的推荐方式：

1. 在一台固定机器上部署并保持服务常驻。
2. 数据库路径和 `uploads/` 使用固定目录，且必须放在 `dist/`、`public/` 之外。
3. 局域网成员通过部署机器的局域网 IP 访问。
4. 使用管理员账号创建团队成员，而不是共用 root。

## 备份与恢复

最小备份范围：

- SQLite 数据库文件
- `uploads/` 附件目录

建议：

- 每天至少备份一次数据库文件
- 每周备份一次附件目录
- 恢复时同时恢复数据库和附件目录，避免业务记录和附件引用不一致

执行备份：

```bash
npm run backup
```

默认备份到项目内 `backups/`，也可以指定：

```bash
BACKUP_DIR=/absolute/path/to/backups npm run backup
```

恢复步骤：

1. 停止服务。
2. 用备份里的 SQLite 文件替换 `CRM_DB_PATH` 指向的数据库。
3. 用备份里的 `uploads/` 替换当前 `UPLOADS_DIR`。
4. 重新执行 `npm run start`。
5. 打开 `GET /api/health`，确认路径和状态正常。

## 当前验收重点

当前版本重点保证：

- 团队账号可独立登录
- 订单详情页作为唯一主工作台
- 列表页与详情页口径一致
- 附件、生产、财务、报关、物流都围绕订单统一维护
- 切换 Gemini / DeepSeek 后 AI 页面仍可正常使用

## 说明

如果仓库中仍保留一些早期实验脚本或旧说明文档，它们不属于当前正式运行入口。请以以下目录为准：

- `server.ts`
- `server/`
- `src/`
- `scripts/seed-demo.ts`
- `scripts/backup.ts`
- `scripts/smoke-ui.ts`

## 系统维护与更新指南 (Maintenance & Updates)

本系统内置了前端热更新探测机制，确保在服务端版本升级时，所有在线客户端都能即时感知并引导用户刷新。

### 1. 管理员：如何发布更新 (For Admin/Developer)
当您需要将新功能或修复发布给客户时，请在服务器执行以下标准操作：

```bash
# 1. 拉取最新代码
git pull

# 2. 重新编译前端静态资源 (必须执行)
npm run build

# 3. 重启后端服务进程 (以触发版本指纹变更)
# 如果使用 pm2:
pm2 restart all
# 如果直接运行脚本:
npm start
```

### 2. 业务员：如何应用更新 (For End-Users)
系统采用 **“静默探测 + 交互刷新”** 的策略，避免强制刷新导致正在填写的表单数据丢失：

- **探测机制**：客户端每隔 60 秒会在后台自动比对服务器的“启动指纹”。
- **更新提醒**：若发现服务器已发版，系统右下角会弹出蓝色通知卡片，提示“系统已升级”。
- **操作方式**：点击卡片上的 **[一键刷新并应用]** 按钮，系统将自动重载并运行最新版本。

---

## 🤖 For AI Agents

If you are an AI assistant working on this repository, please refer to **[AI_CONTEXT.md](./AI_CONTEXT.md)** for a deep dive into the architectural patterns, database schema, identity masking logic, and technical constraints of this project. It will help you understand the "Source of Truth" and the premium minimalist design language used throughout the application.
