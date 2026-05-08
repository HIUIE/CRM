# Todo List - 利润保存 Bug 修复与阿里订单号全链路打通

## 任务一：修复利润核算保存无反应且无法成功保存的问题
### 目标与验收标准 (Acceptance Criteria)
- [x] 1. 用户输入利润核算信息后点击“保存核算明细”，数据能成功保存到数据库中，抽屉能够正常关闭并提示“保存成功”。
- [x] 2. 关闭抽屉后，详情页的利润核算部分能够实时加载更新后的最新利润数据。
- [x] 3. 当抽屉没有修改时，按钮显示为“已保存”；当内容有修改时，按钮显示“保存核算明细”；点击取消或外面空白处时，如果没有修改可直接关闭，如果有修改才弹出“放弃未保存修改”的提示。

### 结果说明 (Results)
- **位置**：[orders.ts:L425-450](file:///Users/carlosfu/Projects/CRM/server/routes/orders.ts#L425-L450) 和 [orders.ts:L464-490](file:///Users/carlosfu/Projects/CRM/server/routes/orders.ts#L464-L490)
- **修改详情**：
  - 在获取利润核算数据 (`GET /:id/profit`) 和保存利润核算数据 (`POST /:id/profit`) 接口中，移除之前只允许纯数字 `orderId` 的强制类型限制（`const orderId = Number(req.params.id)`，若为字符串单号则会产生 `NaN` 并返回 `400` 错误）。
  - 改为使用已经封装好的具有多态查找和订单越权检查功能的 `checkOrderAccess(req, req.params.id)` 接口，以此来适配传入的 `id` 是真实的数字 `id` 还是字符串的订单单号 `display_id`（如 `CQBX-xxxx`）。
  - 获取到合法的 `order` 对象后，提取其真实数字自增 `order.id` 来进行 `order_profits` 的增删改查。

---

## 任务二：阿里订单号（alibaba_order_no）全链路功能开发
### 目标与验收标准 (Acceptance Criteria)
- [x] 1. **数据库 DDL 升级**：在数据库 `orders` 表中新增 `alibaba_order_no TEXT` 物理列，并支持自动化启动时校验自愈。
- [x] 2. **后端 Payload 解析与持久化**：
  - 扩展后端参数解析器（Payloads）适配，在 `readOrderPayload` 中增加对 `alibabaOrderNo` 的解析。
  - 在创建订单 (INSERT) 和更新订单 (UPDATE) 接口中，将该字段持久化写入数据库。
- [x] 3. **全局与列表穿透搜索**：在订单模糊检索的 SQL 查询中，将 `o.alibaba_order_no` 字段加入 LIKE 匹配，确保在全局搜索框及订单列表页搜索框输入阿里订单号能精准命中相关的 CRM 内部订单。
- [x] 4. **前端 TS 类型定义对齐**：
  - 更新订单详情核心类型 `OrderInfo` 增加 `alibaba_order_no?: string | null`；
  - 更新表单状态类型 `OrderFormState` 增加 `alibabaOrderNo: string`，并补全默认初始空状态以及转换映射。
- [x] 5. **详情页头部 Tag 显示与复制**：
  - 在订单详情页左上角系统订单编号 `CQBX-xx-xxxxxx` 右侧新增行内 Tag，文本内容为 `阿里订单: {Alibaba_Order_No}`。
  - 样式使用柔和、高质感的极浅橙色背景。
  - 单号右侧附带微型 [复制] 按钮，点击将单号自动复制到剪切板，并由复制按钮切换为绿色的“✔”图标（2秒后自动恢复），提升 Premium 微交互细节。
- [x] 6. **创建/编辑订单表单支持**：
  - 在订单编辑抽屉 `OrderEditForm` 的基本卡片中加入“阿里订单号”输入框。
  - 在新建订单抽屉 `OrderCreateDrawer` 的表单中加入“阿里订单号”输入框。

### 结果说明 (Results)
#### 1. 数据库物理扩充与持久化
- **DDL 升级迁移脚本**：[1778000000000_add_alibaba_order_no.js](file:///Users/carlosfu/Projects/CRM/migrations/1778000000000_add_alibaba_order_no.js)
- **启动自愈增强**：在 [server/db-pg.ts:L87](file:///Users/carlosfu/Projects/CRM/server/db-pg.ts#L87) 中添加了 `ALTER TABLE orders ADD COLUMN IF NOT EXISTS alibaba_order_no TEXT` 字段强更。
- **Payload 校验与数据转化**：修改 [server/services/payloads.ts:L120](file:///Users/carlosfu/Projects/CRM/server/services/payloads.ts#L120) 在 `readOrderPayload` 中增加 `alibabaOrderNo` 处理。
- **CRUD 写入修改**：修改 [server/routes/orders.ts](file:///Users/carlosfu/Projects/CRM/server/routes/orders.ts) (L205 和 L247)，在 INSERT 和 UPDATE 操作中加入 `alibaba_order_no`。

#### 2. 联合搜索联合匹配
- **模糊搜索路由**：修改 [server/routes/orders.ts:L87-92](file:///Users/carlosfu/Projects/CRM/server/routes/orders.ts#L87-L92)，将 SQL 的 LIKE 模糊匹配追加 `o.alibaba_order_no ILIKE $1` 联合检索逻辑。

#### 3. 前端界面、表单与 TS 类型对应
- **类型定义扩展**：[src/features/order-detail/types.ts](file:///Users/carlosfu/Projects/CRM/src/features/order-detail/types.ts) 补齐了 TS 接口类型。
- **转换映射与默认状态**：[src/features/order-detail/utils.ts](file:///Users/carlosfu/Projects/CRM/src/features/order-detail/utils.ts) 在 `EMPTY_ORDER_FORM` 中定义 `alibabaOrderNo: ''`，并在 `orderToFormState` 里建立对应属性映射。
- **极浅橙色微动 Tag 渲染与复制**：修改 [src/features/order-detail/sections-primary.tsx](file:///Users/carlosfu/Projects/CRM/src/features/order-detail/sections-primary.tsx) (L165-173)，添加了 `useState` 用于管理复制状态，引入了 `Copy` 按钮，高精度地还原了视觉设计。
- **双端录入表单**：
  - 编辑表单：修改 [src/features/order-detail/drawers.tsx](file:///Users/carlosfu/Projects/CRM/src/features/order-detail/drawers.tsx) (L47) 新增一列 `sm:grid-cols-3` 的“阿里订单号”输入框。
  - 创建表单：修改 [src/components/ui/OrderCreateDrawer.tsx](file:///Users/carlosfu/Projects/CRM/src/components/ui/OrderCreateDrawer.tsx) 在“备注”之上追加阿里单号 Field。

---

## 验证与合规测试 (Validation)
- [x] **全站类型检查**：在工作空间根目录下运行 `npx tsc --noEmit`，未发现任何 TypeScript 错误，静态编译成功，`Exit code: 0`。
