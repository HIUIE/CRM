import ExcelJS from 'exceljs';
import { db } from '../db.js';

export async function buildExcelWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartTrade AI CRM';
  wb.created = new Date();

  const HEADER_STYLE: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  async function addSheet<T extends Record<string, unknown>>(name: string, query: string, params: unknown[] = []) {
    const rows = await db.all<T[]>(query, params);
    if (!rows.length) return;
    const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: 'FF0F172A' } } });
    const columns = Object.keys(rows[0]);
    ws.columns = columns.map(c => ({ header: c, key: c, width: Math.max(c.length * 2, 18) }));
    const headerRow = ws.getRow(1);
    columns.forEach((c, i) => { headerRow.getCell(i + 1).style = HEADER_STYLE; });
    rows.forEach(row => ws.addRow(row));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
  }

  // 1. Orders
  await addSheet('订单', `
    SELECT o.id, o.display_id, o.status, o.total_amount, o.freight_amount, o.misc_amount,
           o.product_summary, o.delivery_date, o.created_at,
           c.name AS customer_name, c.country AS customer_country,
           u.name AS created_by
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.created_by
    ORDER BY o.id ASC
  `);

  // 2. Order Items
  await addSheet('商品明细', `
    SELECT oi.*, o.display_id AS order_no
    FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id
    ORDER BY oi.id ASC
  `);

  // 3. Finance
  await addSheet('财务流水', `
    SELECT f.*, o.display_id AS order_no, c.name AS customer_name, p.name AS partner_name
    FROM finance_records f
    LEFT JOIN orders o ON o.id = f.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN partners p ON p.id = f.partner_id
    ORDER BY f.id ASC
  `);

  // 4. Logistics
  await addSheet('物流记录', `
    SELECT l.*, o.display_id AS order_no, c.name AS customer_name
    FROM logistics_records l
    LEFT JOIN orders o ON o.id = l.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    ORDER BY l.id ASC
  `);

  // 5. Customs
  await addSheet('报关记录', `
    SELECT cr.*, o.display_id AS order_no, c.name AS customer_name
    FROM customs_records cr
    LEFT JOIN orders o ON o.id = cr.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    ORDER BY cr.id ASC
  `);

  // 6. Production
  await addSheet('生产安排', `
    SELECT pp.*, o.display_id AS order_no, c.name AS customer_name, p.name AS partner_name
    FROM production_plans pp
    LEFT JOIN orders o ON o.id = pp.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN partners p ON p.id = pp.partner_id
    ORDER BY pp.id ASC
  `);

  // 7. Packing
  await addSheet('装箱记录', `
    SELECT pr.*, o.display_id AS order_no
    FROM packing_records pr
    LEFT JOIN orders o ON o.id = pr.order_id
    ORDER BY pr.id ASC
  `);

  // 8. Customers
  await addSheet('客户', `
    SELECT c.*, COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.id ASC
  `);

  // 9. Partners
  await addSheet('合作伙伴', `
    SELECT p.*, u.name AS created_by
    FROM partners p
    LEFT JOIN users u ON u.id = p.created_by
    ORDER BY p.id ASC
  `);

  // 10. Tasks
  await addSheet('任务', `
    SELECT t.*, a.name AS assignee_name, cu.name AS created_by_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users cu ON cu.id = t.created_by
    ORDER BY t.id ASC
  `);

  // 11. Customer Followups
  await addSheet('客户跟进', `
    SELECT cf.*, c.name AS customer_name, u.name AS created_by_name
    FROM customer_followups cf
    LEFT JOIN customers c ON c.id = cf.customer_id
    LEFT JOIN users u ON u.id = cf.created_by
    ORDER BY cf.id ASC
  `);

  // 12. Order Followups
  await addSheet('订单跟进', `
    SELECT ofu.*, o.display_id AS order_no, u.name AS created_by_name
    FROM order_follow_ups ofu
    LEFT JOIN orders o ON o.id = ofu.order_id
    LEFT JOIN users u ON u.id = ofu.created_by
    ORDER BY ofu.id ASC
  `);

  return wb;
}
