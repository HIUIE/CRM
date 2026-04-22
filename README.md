# SmartTrade AI CRM

这是一个面向外贸内用场景的单人版 CRM / 订单工作台 MVP。当前版本把重点收敛在四条主业务链上：

- 客户档案
- 订单流转
- 收付款流水
- 物流与打包记录

AI 页面仍然保留，但它现在是辅助能力，不再阻塞核心业务流程。

## 当前技术栈

- 前端：React 19 + Vite + Tailwind CSS
- 后端：Express
- 数据库：SQLite
- 认证：JWT + HttpOnly Cookie
- AI：Google Gemini（Beta）

## 当前可用范围

### 已完成的 MVP 能力

- `root / root` 登录
- 客户新增、编辑、查看关联订单
- 订单新增、编辑、状态流转
- 财务流水新增、编辑、删除，支持 `USD / CNY`
- 物流记录新增、编辑
- Dashboard 基于真实数据库数据展示
- 订单页查看关联财务和物流信息

### 暂未作为第一阶段目标的能力

- 多人协作与 RBAC
- 报表导出
- 全局搜索
- 多语言
- AI 自动建单闭环

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

默认账号：

- 用户名：`root`
- 密码：`root`

## 常用命令

```bash
npm run dev
npm run lint
npm run build
```

## 数据库说明

系统当前使用的数据库文件是项目根目录下的：

- `erp_database_v2.sqlite`

启动时服务端会打印实际使用的数据库路径。当前版本采用增量迁移方式：

- 不清库
- 会自动补齐缺失字段
- 会为旧财务记录回填默认币种

## AI 说明

AI 解析依赖 Gemini API Key。你可以登录后在“系统与 AI 配置”页面中配置。

如果没有配置 AI Key：

- CRM 主流程仍可正常使用
- AI 页面会显示友好提示

## 备注

仓库里如果还保留一些早期生成的说明文档或测试脚本，它们不属于当前 MVP 的正式运行入口。以 `server.ts`、`server/` 和 `src/` 下的代码为准。
