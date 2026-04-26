# SmartTrade ERP — CLAUDE.md

## 项目概要

SmartTrade ERP 是一个 AI 驱动的外贸管理系统，包含订单、财务、物流、客户、合作伙伴等模块。

- 技术栈：React + TypeScript + Vite + Tailwind CSS
- 入口：`src/main.tsx`
- 路由定义：`src/App.tsx`
- 认证：`src/context/AuthContext.tsx`
- API 封装：`src/lib/api.ts`
- 类型定义：`src/types/`
- 页面：`src/pages/`
- 公共组件：`src/components/`

## 必需行为

### 每次会话启动时自动执行

1. **运行 self-improving-agent 技能** — 调用 `/self-improving-agent` 技能来加载之前的学到的经验、错误记录和功能需求。
2. **检查 `.learnings/ERRORS.md`** — 避免重复之前的错误。
3. **检查 `.learnings/LEARNINGS.md`** — 加载高优先级的经验教训。
4. **加载 gemini.md 记忆** — 读取 `gemini.md` 中的用户和项目记忆。

### 持续记录

在工作过程中，当遇到以下情况时自动记录到 `.learnings/`：

- 用户纠正你的回答 → 记录到 `LEARNINGS.md` (correction)
- 发现了之前不知道的信息 → 记录到 `LEARNINGS.md` (knowledge_gap)
- 发现了更好的做法 → 记录到 `LEARNINGS.md` (best_practice)
- 命令或 API 调用失败 → 记录到 `ERRORS.md`
- 用户请求了不支持的功能 → 记录到 `FEATURE_REQUESTS.md`

### 经验提升

当某个经验出现 3 次以上且跨多个任务时，将其提升为 gemini.md 永久记忆。

## 核心开发原则 (Core Principles)

### 1. 尊重原始内容 (Respect Existing Content)
- **精准修改**：除非必要，否则严禁重写整个文件。优先使用局部替换（replace），仅针对任务相关的代码行进行修改。
- **防止功能丢失**：严禁在修复 bug 时随意删除或简化现有的复杂业务逻辑（如 AI 分析、特殊过滤器等）。
- **注释保留**：必须保留所有现有的 JSDoc、注释和文档说明。

### 2. 代码质量保障
- **修改即验证**：每次修改大文件或复杂逻辑后，必须运行 `npx tsc --noEmit` 或相关 lint 命令确保代码未损坏。
- **拒绝占位符**：严禁使用 `console.log` 或 TODO 注释替代复杂的业务逻辑实现。

## 核心开发原则 (Core Principles)

### 1. 尊重原始内容 (Respect Existing Content)
- **精准修改**：除非必要，否则严禁重写整个文件。优先使用局部替换（replace），仅针对任务相关的代码行进行修改。
- **防止功能丢失**：严禁在修复 bug 时随意删除或简化现有的复杂业务逻辑（如 AI 分析、特殊过滤器等）。
- **注释保留**：必须保留所有现有的 JSDoc、注释和文档说明。

### 2. 代码质量保障
- **修改即验证**：每次修改大文件或复杂逻辑后，必须运行 `npx tsc --noEmit` 或相关 lint 命令确保代码未损坏。
- **拒绝占位符**：严禁使用 `console.log` 或 TODO 注释替代复杂的业务逻辑实现。
