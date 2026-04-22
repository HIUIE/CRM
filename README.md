# SmartTrade AI (外贸业务与供应链管理系统)

SmartTrade AI 是一款专为现代外贸业务量身定制的 AI 系统。通过结合最新的 Web 技术生态与 LLM（大语言模型）网关架构，致力于解决传统外贸环节中信息碎片化、财务对账难、物流追踪不及时等痛点。

## 系统核心架构 (全栈)

- **前端架构**：React 19 + Tailwind CSS v4 + Vite + Lucide Icons (Bento Grid 响应式风格)
- **后端架构**：Node.js + Express (采用全栈同构模式)
- **数据库**：SQLite (纯本地化存储，零外部依赖，极易迁移至 PostgreSQL)
- **安全鉴权**：JWT (JSON Web Token) + bcrypt 密码加密，支持 RBAC（基于角色的权限控制）
- **AI 引擎**：多模型 AI 网关架构，支持任意兼容 OpenAI 格式的模型（如 DeepSeek-V3）和 Google 原生 Gemini 模型。

## 功能模块规范 (按 PRD)

1. **安全与权限系统 (RBAC)** - 预设 root 管理员。
2. **多模型 AI 网关** - 系统层面解耦 AI 提供商，自主选择并填写 API Key。
3. **客户关系管理 (CRM)** - 客户档案与历史记录追踪。（开发中）
4. **订单与收付款工作台** - 多阶段订单状态流转与财务利润核算。（开发中）
5. **物流与打包中心** - 集装箱与快递轨迹状态看板。（开发中）

---

## 💻 如何在本地测试与部署？

你完全可以将本系统导出到本地个人电脑或企业服务器上运行。整个架构不需要配置复杂的云端数据库组件，拉取代码后即可直接运行。

### 第 1 步：环境准备
确保你的电脑上已经安装了 **Node.js** (推荐 v18 或 v20 以上 LTS 版本)。
可以在命令行运行 `node -v` 检查是否已安装。

### 第 2 步：导出并解压代码
在 AI Studio 的右上角点击齿轮，选择 **Export... (导出)**。你可以将其导出为 `.zip` 下载，或者直接导出到你的 GitHub 仓库中。
将代码解压到本地文件夹。

### 第 3 步：安装依赖库
使用终端（Terminal / CMD / PowerShell）进入该代码文件夹的根目录，运行以下命令安装所有需要的系统组件：

```bash
npm install
```

### 第 4 步：环境变量 (可选)
项目中包含一个 `.env.example` 文件。如果在代码里配置了网关等需要环境变量的地方，你可以复制一份并重命名为 `.env`。由于系统具有“前端配置网关”，大部分 AI API 密钥可以直接在系统前端的 `系统与AI配置` 页面保存。

### 第 5 步：启动本地开发服务器
在控制台输入以下命令启动系统：

```bash
npm run dev
```

> **常见问题诊断 (macOS 相关)**: 
> 如果你在 macOS 安装依赖后遇到类似 `Error: Cannot find module @rollup/rollup-darwin-x64` 的报错，这是 npm 处理可选依赖（Vite/Rollup）时的已知 Bug。
> **修复方法**：在控制台中依次执行：
> 1. `rm -rf node_modules package-lock.json`
> 2. `npm cache clean --force`
> 3. `npm install --force` 或换用 `pnpm install` 
> 然后重新运行 `npm run dev` 即可。

启动成功后，终端会显示类似如下信息：
> `Database initialized.`
> `Server running on http://0.0.0.0:3000`

### 第 6 步：开始使用
打开你的浏览器，访问：[http://localhost:3000](http://localhost:3000)

**🔑 默认初始管理员账号：**
- **用户名**：`root`
- **密码**：`root`

> 登录后，系统将自动在项目根目录生成 `database.sqlite` 作为你的本体数据库文件，你所有的录入信息都会保存在此文件中（已配置忽略上传 git，保证数据隐私）。

---

## 🚀 生产环境部署建议 (进阶向)

当你在本地测试完毕，希望部署进公司的内网服务器让多名员工同时访问时：

1. **推荐构建为生产代码**：
   运行 `npm run build`，它会将 React 前端压缩并打包并放置在 `/dist` 目录中。
2. **采用进程守护 (如 PM2)**：
   如果你使用 PM2，可以通过 `NODE_ENV=production pm2 start tsx --name "smart-trade-erp" -- server.ts` 来让系统以后台模式静默运行。
3. **数据库迁移**：
   目前的数据库驱动封装在 `server/db.ts` 里。未来数据量变长庞大时，可以很轻松地将里面的 SQL 初始化脚本平替为 MySQL 或 PostgreSQL 并在 Docker 中跑起来。
