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
- 安全脱敏：display_id 路由与 IDOR 防护

### 订单主工作台 (Order Detail)
- **基础信息**：商品明细、总价、交期
- **生产排产**：节点追踪、质检状态机、生产日志
- **财务流水**：多币种收付款、回款进度、水单凭证
- **装箱物流**：装箱参数、货运代理、轨迹跟踪
- **报关追踪**：单据预录、放行状态
- **核心单据库**：统一凭证上传与管理

### 外贸利润核算 (Profit Module) 🆕
- **多期收款**：支持定金/尾款多笔录入，USD/CNY 币种切换
- **结汇逻辑**：银行手续费 → 平台扣费 → 汇率换算 → 人民币到账
- **退税自动化**：开票金额 × 退税率 / 1.13 自动计算
- **成本明细**：工厂采购价、国内费用、国际运费(CNY/USD切换)、报关杂费
- **风控预警**：运费倒挂警告、利润率 < 8% 红线提醒
- **收益总览**：Net USD / 总收入 / 总成本 / 净利润 / 利润率

### 合作伙伴 360° 🆕
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
- 全局悬浮 AI 助手按钮 🆕（任意页面右下角）
- **工具调用** 🆕：创建任务、查询订单、查看逾期、添加跟进
- 多模型支持（DeepSeek / OpenAI / Gemini）
- 聊天记录本地持久化

### 系统设置
- **站点品牌** 🆕：自定义站点名称、口号、Logo、Favicon
- 单据编码规则、默认币种
- **团队管理**：创建/编辑/停用账号
- **AI 配置**：提供商选择、API Key、连接测试
- **数据导出**：Excel 工作簿(12 Sheet) / 客户归档(ZIP+附件+Excel) / CSV
- **版本更新** 🆕：一键检测并自动更新系统

---

## 安全架构

| 措施 | 说明 |
|------|------|
| JWT 认证 | 24h 过期 httpOnly cookie |
| CSRF 防护 🆕 | double-submit cookie 全站保护 |
| 角色权限 | admin / staff 两级 |
| 密码加密 | bcrypt 10 轮 |
| 敏感路径保护 | 阻止直接访问 .env/.git/.db |
| 附件安全 | UUID 重命名、路径 containment |
| 前端隐私盾 | 默认掩码邮箱/电话 |
| 登录限流 | 5 次/15 分钟 |
| 审计日志 | 所有 C/U/D 记录，30 天自动清理 |
| 全局错误处理 | express-async-errors + 统一中间件 |

---

## 快速部署

### 前置要求
- Node.js ≥ 18（推荐 20 LTS）
- npm ≥ 9

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/HIUIE/CRM.git
cd CRM

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，至少修改 JWT_SECRET 和 INITIAL_ADMIN_PASSWORD

# 4. 构建前端
npm run build

# 5. 启动服务
npm start
```

默认访问：`http://localhost:3000`
管理员账号：`root` / `.env` 中的 `INITIAL_ADMIN_PASSWORD` 值

### 私有仓库更新配置
如果仓库是私有的，需要在 `.env` 中配置 GitHub Token：

```bash
# 1. 访问 https://github.com/settings/tokens → Generate new token → 勾选 repo
# 2. 复制 token 到 .env
GITHUB_TOKEN=ghp_你的token
```

配置后，设置页 → 版本更新 → 即可一键检测并更新系统。

---

## 自动更新机制 🆕

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
| `npm run dev` | 开发模式（热重载） |
| `npm run build` | 构建前端 |
| `npm start` | 生产模式 |
| `npm test` | 运行测试 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run backup` | 备份数据库和附件 |
| `npm run seed:demo` | 填充演示数据 |

---

## 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS v4 + Vite
- **后端**：Express 4 + SQLite (WAL 模式)
- **图表**：纯 SVG（无第三方图表库）
- **AI**：Google GenAI SDK / OpenAI 兼容 API / DeepSeek
- **导出**：ExcelJS (多 Sheet) / archiver (ZIP) / 纯 JS CSV
- **安全**：JWT + bcrypt + CSRF double-submit cookie + Helmet

---

## 数据备份

```bash
npm run backup
```

备份范围：SQLite 数据库 + uploads 附件目录
默认路径：`data/backups/`

---

## 健康检查

```
GET /api/health
```

返回服务状态、数据库模式、运行模式、启动时间。
