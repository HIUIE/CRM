/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutDashboard, FileText, DollarSign, Truck, PackageSearch, Bot, Settings, Search, Plus, Globe } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="bg-slate-50 min-h-screen w-full flex text-slate-800 font-sans p-4 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border border-slate-200 rounded-2xl flex flex-col p-4 mr-4 shadow-sm relative z-20">
        <div className="flex items-center mb-8 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-[0_2px_10px_rgba(37,99,235,0.3)]">ST</div>
          <span className="text-xl font-bold tracking-tight text-slate-800">SmartTrade AI</span>
        </div>
        <nav className="flex-1 space-y-1">
          <ul className="space-y-1">
            <NavItem icon={<LayoutDashboard />} label="控制台 (Dashboard)" id="dashboard" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavItem icon={<FileText />} label="订单工作台 (Orders)" id="orders" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavItem icon={<DollarSign />} label="收款管理 (Finance)" id="finance" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavItem icon={<Truck />} label="物流打包 (Logistics)" id="logistics" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavItem icon={<PackageSearch />} label="供应商与采购" id="suppliers" activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="my-4 border-t border-slate-100 mx-2"></div>
            <NavItem icon={<Bot />} label="AI 智能助手" id="ai" activeTab={activeTab} setActiveTab={setActiveTab} customClass="text-indigo-600 hover:bg-indigo-50" />
            <NavItem icon={<Settings />} label="系统设置" id="settings" activeTab={activeTab} setActiveTab={setActiveTab} />
          </ul>
        </nav>
        
        {/* Helper Widget */}
        <div className="bg-slate-900 text-white p-4 rounded-xl mt-auto relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-xl -translate-y-10 translate-x-10"></div>
          <p className="text-xs text-slate-400 mb-2 flex items-center relative z-10"><Bot className="w-3 h-3 mr-1"/> AI 助手建议</p>
          <p className="text-sm italic relative z-10">"检测到订单 #8911 的货代费率高于平均值 12%，建议重新询价。"</p>
          <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 transition-colors py-2 rounded-lg text-xs font-semibold relative z-10">查看建议</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-transparent">
        {/* Header */}
        <header className="h-16 bg-transparent flex items-center justify-between px-2 z-10 w-full mb-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            {activeTab === 'dashboard' && '订单工作台'}
            {activeTab === 'orders' && '订单与报价管理'}
            {activeTab === 'finance' && '收付款与发票中心'}
            {activeTab === 'logistics' && '物流与打包信息'}
            {activeTab === 'ai' && 'AI 智能订单处理'}
            {/* fallback */}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索订单、客户..." 
                className="pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-64 transition-shadow"
              />
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)]">
              <Plus className="w-4 h-4 mr-2" />
              新建订单
            </button>
          </div>
        </header>

        {/* Dashboard Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'ai' && <AIAssistantView />}
          {(activeTab !== 'dashboard' && activeTab !== 'ai') && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="font-medium">模块正在开发中...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, id, activeTab, setActiveTab, customClass = '' }: { icon: React.ReactNode, label: string, id: string, activeTab: string, setActiveTab: (id: string) => void, customClass?: string }) {
  const isActive = activeTab === id;
  return (
    <li>
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center p-2 rounded-xl text-sm font-medium transition-colors ${
          isActive 
            ? 'bg-blue-50 text-blue-600' 
            : 'text-slate-500 hover:bg-slate-50'
        } ${customClass}`}
      >
        <span className="w-5 h-5 mr-3 flex items-center justify-center">{icon}</span>
        {label}
      </button>
    </li>
  );
}

function DashboardView() {
  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-4 h-[calc(100vh-120px)] min-h-[736px] w-full max-w-[1400px]">
      {/* Stat 1 */}
      <div className="col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">待结汇当月收款金额 (USD)</h3>
        <div>
          <span className="text-3xl font-bold text-slate-800">$124.5k</span>
          <span className="ml-2 text-xs text-green-500 font-medium tracking-wide">↑ 12.5%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full w-[72%]"></div>
        </div>
      </div>

      {/* Stat 2 */}
      <div className="col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">待付供应商欠款 (CNY)</h3>
        <div>
          <span className="text-3xl font-bold text-slate-800">¥34.2w</span>
          <span className="ml-2 text-xs text-red-400 font-medium tracking-wide">+3 单未付</span>
        </div>
        <div className="flex space-x-1 mt-4 h-1.5 w-full">
          <div className="h-full flex-1 bg-red-400 rounded-full"></div>
          <div className="h-full flex-[1.5] bg-red-400 rounded-full"></div>
          <div className="h-full flex-[2] bg-slate-100 rounded-full"></div>
        </div>
      </div>

      {/* AI CTA Widget */}
      <div className="col-span-2 bg-indigo-600 p-5 rounded-2xl text-white flex justify-between items-center group relative overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-indigo-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <div className="max-w-[240px] relative z-10">
          <div className="flex items-center mb-1">
            <h3 className="font-bold text-lg tracking-tight">AI 智能报价助手</h3>
          </div>
          <p className="text-indigo-100 text-xs leading-relaxed">一键上传客户需求，跨长篇邮件/PDF，AI 自动提取核算成本并生成多语报价单。</p>
        </div>
        <button className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg group-hover:bg-indigo-50 transition-colors relative z-10">
          开始解构数据
        </button>
      </div>

      {/* Table Widget */}
      <div className="col-span-3 row-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="font-bold text-slate-800">近期活跃订单追踪</h2>
          <div className="flex space-x-2">
            <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-1.5 rounded cursor-pointer hover:bg-slate-200 transition-colors tracking-wide">全部状态</span>
            <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-1.5 rounded cursor-pointer hover:bg-slate-200 transition-colors tracking-wide">高级筛选</span>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto min-h-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 sticky top-0 border-b border-slate-100 backdrop-blur-sm z-10">
              <tr className="text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-[25%]">订单/客户</th>
                <th className="p-4 font-semibold w-[25%]">财务节点</th>
                <th className="p-4 font-semibold w-[30%]">供应商 & 发货</th>
                <th className="p-4 font-semibold w-[20%]">流程状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors">#ORD-2024-001</div>
                  <div className="text-xs text-slate-400 mt-0.5">TechCorp Global (USA)</div>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                    <span className="text-xs font-medium text-slate-700">已收 30% 定金</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">预收款单 #RCP-881</div>
                </td>
                <td className="p-4">
                  <div className="text-xs text-slate-700">宁波远洋制造厂</div>
                  <div className="text-xs text-blue-500 font-medium mt-1">集装箱: 万海航运 (在途)</div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-yellow-50 text-yellow-600 border border-yellow-100/50 rounded-md text-xs font-medium flex inline-block w-max">等待客户尾款</span>
                </td>
              </tr>
              <tr className="bg-slate-50/30 hover:bg-slate-50/80 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors">#ORD-2024-005</div>
                  <div className="text-xs text-slate-400 mt-0.5">London Retail Ltd (UK)</div>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"></span>
                    <span className="text-xs font-medium text-slate-700">未收付款信息</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">-</div>
                </td>
                <td className="p-4">
                  <div className="text-xs text-slate-700">上海嘉兴进出口</div>
                  <div className="text-xs text-slate-500 mt-1">打包要求: 240 CTNS (加固)</div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100/50 rounded-md text-xs font-medium inline-block w-max">工厂生产中</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors">#ORD-2023-982</div>
                  <div className="text-xs text-slate-400 mt-0.5">Dubai Traders LLC</div>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    <span className="text-xs font-medium text-slate-700">全款已清</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-xs text-slate-700">温州小商品一厂</div>
                  <div className="text-xs text-green-600 font-medium mt-1">客户确认已收货</div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200/50 rounded-md text-xs font-medium inline-block w-max">已归档闭单</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-auto p-3.5 bg-slate-50/50 text-center border-t border-slate-100">
          <span className="text-xs text-slate-500 cursor-pointer hover:text-indigo-600 font-medium tracking-wide transition-colors">查看系统中所有 128 个未完结订单 →</span>
        </div>
      </div>

      {/* Side Widgets */}
      <div className="col-span-1 row-span-2 flex flex-col gap-4">
        {/* Todo List */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">待办事项 (5)</h3>
          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            <div className="group flex items-start p-2.5 bg-slate-50/80 rounded-xl border-l-[3px] border-red-400 hover:bg-slate-100 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0 mr-3">
                <div className="text-xs font-semibold text-slate-800 truncate mb-0.5 group-hover:text-red-500 transition-colors">确认 #005 打包清单</div>
                <div className="text-[10px] text-slate-500 truncate">London Retail 要求加固防水</div>
              </div>
              <div className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded whitespace-nowrap">2h</div>
            </div>
            
            <div className="group flex items-start p-2.5 bg-slate-50/80 rounded-xl border-l-[3px] border-blue-400 hover:bg-slate-100 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0 mr-3">
                <div className="text-xs font-semibold text-slate-800 truncate mb-0.5 group-hover:text-blue-600 transition-colors">上传货代水单费用</div>
                <div className="text-[10px] text-slate-500 truncate">ORD-2024-001 海运费</div>
              </div>
              <div className="text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm">4h</div>
            </div>

            <div className="group flex items-start p-2.5 bg-slate-50/80 rounded-xl border-l-[3px] border-green-400 hover:bg-slate-100 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0 mr-3">
                <div className="text-xs font-semibold text-slate-800 truncate mb-0.5 group-hover:text-green-600 transition-colors">审核新生成报价单</div>
                <div className="text-[10px] text-slate-500 truncate">QT-2883 (法国客户)</div>
              </div>
              <div className="text-[10px] font-medium text-slate-400 whitespace-nowrap">明日</div>
            </div>
          </div>
        </div>
        
        {/* Logistics Mini Dashboard */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm flex-1 flex flex-col relative overflow-hidden group min-h-0">
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-700 translate-y-10 -translate-x-10 pointer-events-none"></div>
          <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider relative z-10 flex justify-between items-center">
            核心物流看板
            <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded tracking-wide">LIVE</span>
          </h3>
          <div className="flex flex-col flex-1 justify-between relative z-10 mt-1">
             <div>
               <div className="flex items-baseline space-x-2">
                 <span className="text-3xl font-bold text-white tracking-tight">12</span>
                 <span className="text-xs text-slate-400 font-medium">在途集装箱总数</span>
               </div>
             </div>
             
             <div className="mt-4">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 font-medium px-1">
                  <span>备货区</span>
                  <span>海上</span>
                  <span>到港</span>
                  <span>清关</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                   <div className="h-6 bg-blue-500/20 rounded shadow-inner" title="备货"></div>
                   <div className="h-6 bg-blue-500/40 rounded shadow-inner relative overflow-hidden" title="海运中">
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                   </div>
                   <div className="h-6 bg-blue-500/80 rounded shadow-[0_0_10px_rgba(59,130,246,0.3)] border border-blue-400/30" title="即将到港"></div>
                   <div className="h-6 bg-blue-500/20 rounded shadow-inner" title="清关中"></div>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">本周预计有 <span className="text-slate-200 font-bold">3 个</span> 货柜抵达洛杉矶长滩港，需跟进货代。</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIAssistantView() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 w-20 h-20 bg-indigo-50 mx-auto rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
          <Bot className="w-10 h-10 text-indigo-600" />
        </div>
        
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 mb-3">AI 外贸智能引擎</h2>
        <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
          将杂乱的 WhatsApp 聊天记录、客户邮件长文、或 PDF 文件粘贴到下方。AI 将自动分析并创建结构化订单数据。
        </p>

        <div className="relative max-w-2xl mx-auto shadow-sm rounded-xl mb-4 group ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 bg-white hover:ring-slate-300 transition-shadow">
           <textarea 
             placeholder="例如：客户 Amsource 昨天邮件说要 3000个A款不锈钢杯子，发到洛杉矶，指定货代是东方国际，FOB宁波，预计下周一付30%定金，要求加固包装..."
             className="w-full h-48 p-5 bg-transparent rounded-xl focus:outline-none resize-none text-slate-700 placeholder:text-slate-300 leading-relaxed custom-scrollbar"
             spellCheck={false}
           ></textarea>
           
           <div className="absolute bottom-3 left-3 flex space-x-2">
             <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center text-xs font-semibold">
               <FileText className="w-4 h-4 mr-1.5" /> 上传 PDF/水单
             </button>
           </div>
        </div>
        
        <div className="max-w-2xl mx-auto flex justify-end">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center transition-transform active:scale-95 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)]">
            <Bot className="w-5 h-5 mr-2" />
            一键智能生成
          </button>
        </div>
      </div>
    </div>
  );
}
