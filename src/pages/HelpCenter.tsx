import React from 'react';
import {
  MessageCircle,
  ShieldCheck,
  Zap,
  FileText,
  Bot,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function HelpCenterPage() {
  const sections = [
    {
      title: '新手快速入门',
      icon: <Zap className="text-tertiary-sage dark:text-emerald-400" size={24} />,
      links: ['如何创建第一个客户？', '如何录入订单明细？', '单据流水号规则说明', '财务记账的基本流程']
    },
    {
      title: '业务模块详解',
      icon: <FileText className="text-blue-500 dark:text-blue-400" size={24} />,
      links: ['报关资料自动化上传指南', '装箱单分拆录入技巧', '物流轨迹实时同步逻辑', '生产进度节点看板说明']
    },
    {
      title: 'AI 引擎与配置',
      icon: <Bot className="text-primary-navy dark:text-white" size={24} />,
      links: ['AI 向导的指令输入技巧', '如何配置自己的 API 密钥？', '导出全量业务归档数据', '团队角色权限管理说明']
    }
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-lg bg-primary-navy dark:bg-navy-900 px-8 py-16 text-white shadow-2xl transition-colors">
        <div className="absolute right-0 top-0 h-96 w-96 -translate-y-48 translate-x-32 rounded-full bg-white/5 blur-[100px]" />
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight uppercase">SmartTrade 帮助中心</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300 dark:text-slate-400 font-medium leading-relaxed">
            为您提供专业、详尽的 CRM 系统使用指南，助力团队高效流转每一笔外贸订单。
          </p>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section, idx) => (
          <div key={idx} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm transition-all hover:shadow-md">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50 dark:bg-navy-950 shadow-inner">
              {section.icon}
            </div>
            <h2 className="mb-6 text-xl font-bold text-primary-navy dark:text-white uppercase tracking-tight">{section.title}</h2>
            <ul className="space-y-4">
              {section.links.map((link, lIdx) => (
                <li key={lIdx}>
                  <button className="group flex w-full items-center justify-between text-left text-sm font-bold text-secondary-slate dark:text-slate-400 hover:text-primary-navy dark:hover:text-white transition-colors">
                    <span>{link}</span>
                    <ChevronRight size={14} className="opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm transition-colors">
          <div className="mb-6 flex items-center gap-3">
            <MessageCircle className="text-tertiary-sage dark:text-emerald-400" size={20} />
            <h2 className="text-lg font-bold text-primary-navy dark:text-white uppercase tracking-tight">联系技术支持</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 font-medium mb-8">
            如果您在使用过程中遇到 Bug 或有新的功能建议，欢迎随时联系系统管理员或开发者进行反馈。
          </p>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-100 dark:border-navy-800">
                <div>
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">开发者邮箱</div>
                   <div className="text-sm font-bold text-primary-navy dark:text-white data-field">support@smarttrade.ai</div>
                </div>
                <ExternalLink size={16} className="text-slate-300 dark:text-slate-600" />
             </div>
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-100 dark:border-navy-800">
                <div>
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">内部协作群</div>
                   <div className="text-sm font-bold text-primary-navy dark:text-white">SmartTrade 研发部</div>
                </div>
                <ExternalLink size={16} className="text-slate-300 dark:text-slate-600" />
             </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm transition-colors">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="text-blue-500 dark:text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-primary-navy dark:text-white uppercase tracking-tight">安全与合规</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 font-medium mb-8">
            系统严格遵守企业级数据加密规范，所有附件均存储在受保护的隔离目录，确保您的商业机密万无一失。
          </p>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 p-5 border border-emerald-100 dark:border-emerald-900/30">
             <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 mb-3">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">已启用 TLS 传输加密</span>
             </div>
             <p className="text-xs text-emerald-800/70 dark:text-emerald-500/70 leading-relaxed font-medium">所有与 AI 引擎的交互均通过加密通道传输，系统不存储您的 API 访问详情。</p>
          </div>
        </section>
      </div>
    </div>
  );
}
