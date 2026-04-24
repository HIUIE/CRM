import React from 'react';
import { BookOpenText, HardDriveDownload, LayoutTemplate, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HelpCenterPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">帮助中心</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              这里先提供团队日常使用最常见的说明：从哪建单、去哪里录入收款、怎样查看物流、以及局域网部署后的基础维护方式。
            </p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            返回订单列表
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <HelpCard
          icon={<LayoutTemplate className="h-5 w-5 text-blue-600" />}
          title="日常操作主入口"
          items={[
            '客户档案：先建客户，再从订单页创建订单。',
            '订单详情：产品、收款、生产、报关、物流都从同一张订单工作台维护。',
            '财务与物流列表页：用于集中筛选、复核与追踪，不建议作为首录入口。',
          ]}
        />
        <HelpCard
          icon={<BookOpenText className="h-5 w-5 text-blue-600" />}
          title="推荐使用流程"
          items={[
            '1. 管理员创建客户与合作伙伴。',
            '2. 业务员进入订单列表新建订单，再进入详情页补充明细。',
            '3. 在订单页录入收款、生产安排、报关与物流，独立列表页会自动同步。',
          ]}
        />
        <HelpCard
          icon={<HardDriveDownload className="h-5 w-5 text-blue-600" />}
          title="局域网部署与备份"
          items={[
            '数据库默认使用项目内的 SQLite 文件，可通过 CRM_DB_PATH 指向固定路径。',
            '附件统一保存在 uploads/ 目录，备份时请和数据库文件一起保存。',
            '建议为每位团队成员创建独立账号，不共用管理员账号。',
          ]}
        />
        <HelpCard
          icon={<ShieldCheck className="h-5 w-5 text-blue-600" />}
          title="权限说明"
          items={[
            'admin：管理系统设置、AI 配置、团队账号和关键删除动作。',
            'staff：维护客户、订单、财务、报关和物流数据，但不能进入系统设置。',
            '如果账号被停用，请联系管理员在系统设置里重新启用。',
          ]}
        />
      </div>
    </div>
  );
}

function HelpCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">{icon}</div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
