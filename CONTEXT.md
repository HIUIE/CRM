# SmartTrade CRM Domain Context

## Project Overview
SmartTrade AI CRM is a foreign-trade management system (ERP/CRM) designed for professional foreign trade companies. It handles the end-to-end lifecycle of orders, from inquiry to final logistics and audit.

## Core Concepts (Glossary)

- **Order (订单)**: The central entity representing a business transaction. Includes items, pricing, and lifecycle stages.
- **Order Detail (订单详情)**: The dense workflow view for managing an order. Split into sections like Finance, Logistics, Customs, etc.
- **Partner (合作伙伴)**: Entities that provide services like logistics, customs clearance, or factories.
- **Customer (客户)**: The buyers who place orders.
- **Finance (财务)**: Management of receipts (收款) and payments (付款), categorized by deposits (定金), balance (尾款), freight (运费), etc.
- **Logistics (物流)**: Tracking the physical movement of goods, including domestic and international segments.
- **Customs (报关)**: The process of declaring goods to customs, involving documents like invoices and packing lists.
- **Task (任务)**: Actionable items assigned to staff members related to specific orders or customers.

## Technical Context
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS.
- **Backend**: Express.js, Node.js.
- **Persistence**: PostgreSQL (via `pg` and migrations).
- **Communication**: Socket.IO for real-time notifications.
- **Infrastructure**: Docker & Docker Compose.
