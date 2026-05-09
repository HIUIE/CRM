import ExcelJS from 'exceljs';
import { dbAll } from '../lib/db.js';

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } },
  border: {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  },
};

const ALT_ROW_FILL: Partial<ExcelJS.Style> = {
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
};

async function addDataSheet<T extends Record<string, unknown>>(
  wb: ExcelJS.Workbook, name: string, query: string, params: unknown[] = [],
) {
  const rows = await dbAll<T[]>(query, params);
  if (!rows.length) return;
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: 'FF0F172A' } } });
  const columns = Object.keys(rows[0]);
  ws.columns = columns.map(c => ({ header: c, key: c, width: Math.max(c.length * 2, 18) }));
  const headerRow = ws.getRow(1);
  columns.forEach((c, i) => { headerRow.getCell(i + 1).style = HEADER_STYLE; });
  rows.forEach((row, idx) => {
    const r = ws.addRow(row);
    if (idx % 2 === 1) r.eachCell(cell => { cell.style = ALT_ROW_FILL; });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
}

/** Full-system XLSX: 12 sheets */
export async function buildExcelWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartTrade AI CRM';
  wb.created = new Date();

  await addDataSheet(wb, '订单', `
    SELECT o.id, o.display_id, o.status, COALESCE(NULLIF(o.tax_mode, ''), 'A') AS tax_mode, o.total_amount, o.freight_amount, o.misc_amount,
           o.product_summary, o.delivery_date, o.created_at,
           c.name AS customer_name, c.country AS customer_country,
           u.name AS created_by
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.deleted_at IS NULL
    ORDER BY o.id ASC
  `);
  await addDataSheet(wb, '商品明细', `
    SELECT oi.*, o.display_id AS order_no FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id WHERE oi.deleted_at IS NULL AND o.deleted_at IS NULL ORDER BY oi.id ASC
  `);
  await addDataSheet(wb, '财务流水', `
    SELECT f.*, o.display_id AS order_no, c.name AS customer_name, p.name AS partner_name
    FROM finance_records f LEFT JOIN orders o ON o.id = f.order_id
    LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN partners p ON p.id = f.partner_id WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL) ORDER BY f.id ASC
  `);
  await addDataSheet(wb, '物流记录', `
    SELECT l.*, o.display_id AS order_no, c.name AS customer_name
    FROM logistics_records l LEFT JOIN orders o ON o.id = l.order_id
    LEFT JOIN customers c ON c.id = o.customer_id WHERE l.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL) ORDER BY l.id ASC
  `);
  await addDataSheet(wb, '报关记录', `
    SELECT cr.*, o.display_id AS order_no, c.name AS customer_name
    FROM customs_records cr LEFT JOIN orders o ON o.id = cr.order_id
    LEFT JOIN customers c ON c.id = o.customer_id WHERE cr.deleted_at IS NULL AND o.deleted_at IS NULL ORDER BY cr.id ASC
  `);
  await addDataSheet(wb, '进项发票', `
    SELECT ii.*, o.display_id AS order_no, c.name AS customer_name
    FROM input_invoices ii LEFT JOIN orders o ON o.id = ii.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE ii.deleted_at IS NULL AND o.deleted_at IS NULL ORDER BY ii.id ASC
  `);
  await addDataSheet(wb, '生产安排', `
    SELECT pp.*, o.display_id AS order_no, c.name AS customer_name, p.name AS partner_name
    FROM production_plans pp LEFT JOIN orders o ON o.id = pp.order_id
    LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN partners p ON p.id = pp.partner_id WHERE o.deleted_at IS NULL ORDER BY pp.id ASC
  `);
  await addDataSheet(wb, '装箱记录', `
    SELECT pr.*, o.display_id AS order_no FROM packing_records pr
    LEFT JOIN orders o ON o.id = pr.order_id WHERE o.deleted_at IS NULL ORDER BY pr.id ASC
  `);
  await addDataSheet(wb, '客户', `
    SELECT c.*, ou.name AS owner_user_name, COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN users ou ON ou.id = c.owner_user_id
    LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, ou.name
    ORDER BY c.id ASC
  `);
  await addDataSheet(wb, '客户转交记录', `
    SELECT
      ctl.*,
      c.display_id AS customer_no,
      c.name AS customer_name,
      fu.name AS from_user_name,
      tu.name AS to_user_name,
      bu.name AS transferred_by_name
    FROM customer_transfer_logs ctl
    LEFT JOIN customers c ON c.id = ctl.customer_id
    LEFT JOIN users fu ON fu.id = ctl.from_user_id
    LEFT JOIN users tu ON tu.id = ctl.to_user_id
    LEFT JOIN users bu ON bu.id = ctl.transferred_by
    WHERE c.deleted_at IS NULL
    ORDER BY ctl.transferred_at DESC, ctl.id DESC
  `);
  await addDataSheet(wb, '合作伙伴', `
    SELECT p.*, u.name AS created_by FROM partners p
    LEFT JOIN users u ON u.id = p.created_by WHERE p.deleted_at IS NULL ORDER BY p.id ASC
  `);
  await addDataSheet(wb, '任务', `
    SELECT t.*, a.name AS assignee_name, cu.name AS created_by_name FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id LEFT JOIN users cu ON cu.id = t.created_by ORDER BY t.id ASC
  `);
  await addDataSheet(wb, '客户跟进', `
    SELECT cf.*, c.name AS customer_name, u.name AS created_by_name
    FROM customer_followups cf LEFT JOIN customers c ON c.id = cf.customer_id
    LEFT JOIN users u ON u.id = cf.created_by WHERE c.deleted_at IS NULL ORDER BY cf.id ASC
  `);
  await addDataSheet(wb, '订单跟进', `
    SELECT ofu.*, o.display_id AS order_no, u.name AS created_by_name
    FROM order_follow_ups ofu LEFT JOIN orders o ON o.id = ofu.order_id
    LEFT JOIN users u ON u.id = ofu.created_by WHERE o.deleted_at IS NULL ORDER BY ofu.id ASC
  `);

  return wb;
}

/** Per-customer XLSX: overview + all orders as sheets */
export async function buildCustomerXlsx(customer: Record<string, unknown>, orders: any[], orderDetailsMap: Map<number, any>) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartTrade AI CRM';
  wb.created = new Date();

  // Overview sheet
  const overview = wb.addWorksheet('客户概览', { properties: { tabColor: { argb: 'FF0F172A' } } });
  overview.columns = [
    { header: '字段', key: 'field', width: 25 },
    { header: '值', key: 'value', width: 40 },
  ];
  overview.getRow(1).eachCell(c => c.style = HEADER_STYLE);
  const infoRows = [
    ['客户名称', customer.name],
    ['国家/地区', customer.country],
    ['联系方式', customer.contact],
    ['客户编号', customer.display_id],
    ['来源渠道', customer.source_channel],
    ['意向产品', customer.intent_products],
    ['客户负责人', customer.owner_user_name || customer.owner_user_id],
    ['建档时间', customer.created_at],
    ['关联订单数', String(orders.length)],
  ];
  infoRows.forEach(([field, value], idx) => {
    const r = overview.addRow({ field, value: value || '—' });
    if (idx % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  });

  // Customer contacts
  const contacts = await dbAll(`SELECT cc.*, c.name AS customer_name FROM customer_contacts cc LEFT JOIN customers c ON c.id = cc.customer_id WHERE cc.customer_id = ?`, [customer.id]);
  if (contacts.length) {
    const ws = wb.addWorksheet('联系人', { properties: { tabColor: { argb: 'FF0F172A' } } });
    const cols = Object.keys(contacts[0]);
    ws.columns = cols.map(c => ({ header: c, key: c, width: 20 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    contacts.forEach((r: any, idx: number) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  // Customer followups
  const followups = await dbAll(`SELECT cf.*, u.name AS created_by_name FROM customer_followups cf LEFT JOIN users u ON u.id = cf.created_by WHERE cf.customer_id = ? ORDER BY datetime(cf.created_at) DESC`, [customer.id]);
  if (followups.length) {
    const ws = wb.addWorksheet('跟进记录', { properties: { tabColor: { argb: 'FF0F172A' } } });
    const cols = ['content', 'channel', 'created_by_name', 'created_at'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 30 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    followups.forEach((r: any, idx: number) => {
      const row = ws.addRow({ content: r.content, channel: r.channel, created_by_name: r.created_by_name, created_at: r.created_at });
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  const transferLogs = await dbAll(`
    SELECT ctl.*, fu.name AS from_user_name, tu.name AS to_user_name, bu.name AS transferred_by_name
    FROM customer_transfer_logs ctl
    LEFT JOIN users fu ON fu.id = ctl.from_user_id
    LEFT JOIN users tu ON tu.id = ctl.to_user_id
    LEFT JOIN users bu ON bu.id = ctl.transferred_by
    WHERE ctl.customer_id = ?
    ORDER BY datetime(ctl.transferred_at) DESC, ctl.id DESC
  `, [customer.id]);
  if (transferLogs.length) {
    const ws = wb.addWorksheet('归属变更记录', { properties: { tabColor: { argb: 'FF0F172A' } } });
    const cols = Object.keys(transferLogs[0]);
    ws.columns = cols.map(c => ({ header: c, key: c, width: 22 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    transferLogs.forEach((r: any, idx: number) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  // Orders overview sheet
  if (orders.length) {
    const ws = wb.addWorksheet('订单一览', { properties: { tabColor: { argb: 'FF0F172A' } } });
    const cols = ['display_id', 'status', 'tax_mode', 'total_amount', 'product_summary', 'delivery_date', 'created_at'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 20 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    orders.forEach((o, idx) => {
      const row = ws.addRow({ display_id: o.display_id, status: o.status, tax_mode: o.tax_mode || 'A', total_amount: o.total_amount, product_summary: o.product_summary, delivery_date: o.delivery_date, created_at: o.created_at });
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: orders.length + 1, column: cols.length } };
  }

  return wb;
}

/** Per-order XLSX: all order data in one file with sheets */
export async function buildOrderXlsx(detail: any) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartTrade AI CRM';
  wb.created = new Date();

  // Order info
  const info = wb.addWorksheet('订单信息', { properties: { tabColor: { argb: 'FF0F172A' } } });
  info.columns = [{ header: '字段', key: 'field', width: 25 }, { header: '值', key: 'value', width: 50 }];
  info.getRow(1).eachCell(c => c.style = HEADER_STYLE);
  const order = detail.order || {};
  const customer = detail.customer || {};
  const infoData: [string, string][] = [
    ['订单号', order.display_id], ['状态', order.status], ['业务模式', order.tax_mode || 'A'], ['客户', customer.name],
    ['国家', customer.country], ['联系人', customer.contact], ['产品摘要', order.product_summary],
    ['总金额', `$${Number(order.total_amount).toLocaleString()}`],
    ['运费', `$${Number(order.freight_amount).toLocaleString()}`],
    ['杂费', `$${Number(order.misc_amount).toLocaleString()}`],
    ['交付日期', order.delivery_date || '—'],
    ['创建时间', order.created_at],
  ];
  infoData.forEach(([field, value], idx) => {
    const r = info.addRow({ field, value });
    if (idx % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  });

  // Items
  if (detail.items?.length) {
    const ws = wb.addWorksheet('商品明细');
    const cols = ['product_name', 'specification', 'quantity', 'unit', 'unit_price', 'subtotal'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 20 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.items.forEach((item: any, idx: number) => {
      const row = ws.addRow(item);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  // Finance
  if (detail.financeRecords?.length) {
    const ws = wb.addWorksheet('财务流水');
    const cols = ['type', 'amount', 'currency', 'status', 'recordCategory', 'target', 'partnerName', 'remark', 'createdAt'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 18 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.financeRecords.forEach((r: any, idx: number) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  // Logistics
  if (detail.logisticsRecords?.length) {
    const ws = wb.addWorksheet('物流记录');
    const cols = ['segmentType', 'carrier', 'trackingNo', 'status', 'shippingDate', 'transportMode', 'vesselVoyage', 'etd', 'eta'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 18 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.logisticsRecords.forEach((r: any, idx: number) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  // Customs
  if (detail.customs) {
    const ws = wb.addWorksheet('报关信息');
    ws.columns = [{ header: '字段', key: 'field', width: 25 }, { header: '值', key: 'value', width: 50 }];
    ws.getRow(1).eachCell(c => c.style = HEADER_STYLE);
    const c = detail.customs;
    const customsData: [string, string][] = [
      ['报关单号', c.declarationNo], ['状态', c.status], ['贸易方式', c.tradeMode],
      ['申报日期', c.declarationDate], ['放行日期', c.releaseDate], ['备注', c.remark],
    ];
    customsData.forEach(([field, value], idx) => {
      const r = ws.addRow({ field, value: value || '—' });
      if (idx % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    });
  }

  // Production
  if (detail.productionPlan) {
    const ws = wb.addWorksheet('生产安排');
    ws.columns = [{ header: '字段', key: 'field', width: 25 }, { header: '值', key: 'value', width: 50 }];
    ws.getRow(1).eachCell(c => c.style = HEADER_STYLE);
    const p = detail.productionPlan;
    const prodData: [string, string][] = [
      ['合作伙伴', p.partnerName], ['生产状态', p.productionStatus],
      ['质检状态', p.inspectionStatus], ['下单日期', p.orderDate],
      ['预计交付', p.estimatedDeliveryDate], ['备注', p.remark],
    ];
    prodData.forEach(([field, value], idx) => {
      const r = ws.addRow({ field, value: value || '—' });
      if (idx % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    });
    if (p.logs?.length) {
      const logWs = wb.addWorksheet('生产日志');
      const logCols = ['content', 'logDate', 'createdByName', 'createdAt'];
      logWs.columns = logCols.map(c => ({ header: c, key: c, width: 30 }));
      logCols.forEach((c, i) => logWs.getRow(1).getCell(i + 1).style = HEADER_STYLE);
      p.logs.forEach((log: any, idx: number) => {
        const row = logWs.addRow(log);
        if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
      });
    }
  }

  // Packing
  if (detail.packingRecords?.length) {
    const ws = wb.addWorksheet('装箱记录');
    const cols = ['packageCount', 'packageSize', 'grossWeight', 'netWeight'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 18 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.packingRecords.forEach((r: any, idx: number) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  // Order followups
  const followups = await dbAll(
    `SELECT of.*, u.name AS created_by_name FROM order_follow_ups of LEFT JOIN users u ON u.id = of.created_by WHERE of.order_id = ? ORDER BY datetime(of.created_at) DESC`,
    [order.id],
  );
  if (followups.length) {
    const ws = wb.addWorksheet('订单跟进');
    const cols = ['content', 'created_by_name', 'created_at'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: 40 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    followups.forEach((r: any, idx: number) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell(cell => { cell.style = ALT_ROW_FILL; });
    });
  }

  return wb;
}
