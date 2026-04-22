import React, { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Wallet, ArrowDownRight, ArrowUpRight, CheckCircle2, Copy } from 'lucide-react';

interface FinanceRecord {
  id: number;
  order_id: number;
  type: string;
  amount: number;
  target: string;
  status: string;
  remark: string;
  order_display_id?: string;
  customer_name?: string;
  created_at: string;
}

interface Order {
  id: number;
  display_id: string;
  customer_name: string;
}

export default function FinanceView() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    orderId: '',
    type: 'receipt',
    amount: 0,
    target: '',
    status: 'pending',
    remark: ''
  });

  const fetchData = async () => {
    try {
      const [finRes, ordRes] = await Promise.all([
        fetch('/api/finance'),
        fetch('/api/orders')
      ]);
      const fData = await finRes.json();
      const oData = await ordRes.json();
      setRecords(fData);
      setOrders(oData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orderId) return alert("请选择关联的业务订单");
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, orderId: Number(formData.orderId) })
      });
      if (!res.ok) throw new Error('保存失败');
      setShowForm(false);
      setFormData({ orderId: '', type: 'receipt', amount: 0, target: '', status: 'pending', remark: '' });
      fetchData();
    } catch (err) {
      alert('保存失败，请重试');
    }
  };

  const deleteRecord = async (id: number) => {
    if (!confirm('确实要删除这条流水（财务核算不逆转）吗？')) return;
    try {
      await fetch(`/api/finance/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { }
  };

  const totalReceipts = records.filter(r => r.type === 'receipt' && r.status === 'completed').reduce((sum, r) => sum + r.amount, 0);
  const totalPayments = records.filter(r => r.type === 'payment' && r.status === 'completed').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">收款与费用核算 (Finance)</h2>
          <p className="text-sm text-slate-500 mt-1">管理客户进账汇款与给工厂/货代出账流水</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
        >
          {showForm ? '取消记账' : <><Plus className="w-4 h-4 mr-2" /> 记录新流水</>}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
           <h3 className="text-xs font-semibold text-slate-400 mb-1 flex items-center"><ArrowDownRight className="w-4 h-4 mr-1 text-green-500"/> 已完成总收款 (业务收入)</h3>
           <div className="text-2xl font-bold text-slate-800">${totalReceipts.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
           <h3 className="text-xs font-semibold text-slate-400 mb-1 flex items-center"><ArrowUpRight className="w-4 h-4 mr-1 text-red-500"/> 已完成总付款 (业务支出)</h3>
           <div className="text-2xl font-bold text-slate-800">¥{totalPayments.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm text-white">
           <h3 className="text-xs font-semibold text-slate-400 mb-1 flex items-center"><Wallet className="w-4 h-4 mr-1 text-blue-400"/> 待核销总条目</h3>
           <div className="text-2xl font-bold">{records.filter(r => r.status === 'pending').length} 笔</div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">登记财务流水</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">关联订单 *</label>
              <select required value={formData.orderId} onChange={e => setFormData({...formData, orderId: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">-- 选择业务 --</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.display_id} - {o.customer_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">账单类型 *</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="receipt">客户打款（收款 USD等）</option>
                <option value="payment">支付工厂/货代（付款 CNY等）</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">流水金额 *</label>
              <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0.00" />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-600 mb-1">打款方/收款方名称</label>
               <input value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如：Apple Inc 或 义乌小商品厂" />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-600 mb-1">当前状态</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                 <option value="pending">待核实到账 / 待付</option>
                 <option value="completed">已入账 / 已付清</option>
               </select>
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-600 mb-1">内部备注</label>
               <input value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="水单号、水单截图链接等..." />
            </div>
            <div className="col-span-1 lg:col-span-3 flex justify-end mt-2">
              <button type="submit" className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors">归档财务账</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">核算读取中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
           <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-500 font-medium">暂无财务数据，创建第一笔流水。</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
           <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
              <tr className="text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-[15%]">资金流向</th>
                <th className="p-4 font-semibold w-[20%]">关联订单</th>
                <th className="p-4 font-semibold w-[25%]">主体方与备注</th>
                <th className="p-4 font-semibold w-[20%]">金额 & 核算状态</th>
                <th className="p-4 font-semibold w-[20%]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    {r.type === 'receipt' ? (
                       <span className="flex items-center text-green-600 font-bold text-xs"><ArrowDownRight className="w-4 h-4 mr-1"/>收款入账</span>
                    ) : (
                       <span className="flex items-center text-red-500 font-bold text-xs"><ArrowUpRight className="w-4 h-4 mr-1"/>付款支出</span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    {r.order_display_id ? (
                      <div>
                        <div className="font-bold text-slate-700 hover:text-blue-600 cursor-pointer">{r.order_display_id}</div>
                        <div className="text-[10px] text-slate-500">{r.customer_name}</div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs italic">无业务单据</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{r.target || '-'}</div>
                    <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={r.remark}>{r.remark || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div className={`font-bold text-lg ${r.type === 'receipt' ? 'text-green-600' : 'text-red-500'}`}>
                      {r.type === 'receipt' ? '+' : '-'}{r.amount.toLocaleString()}
                    </div>
                    {r.status === 'completed' ? (
                      <span className="flex items-center text-[10px] text-slate-600 mt-1"><CheckCircle2 className="w-3 h-3 text-green-500 mr-1"/> 已登账</span>
                    ) : (
                      <span className="flex items-center text-[10px] text-yellow-600 mt-1"><Copy className="w-3 h-3 text-yellow-500 mr-1"/> 待确认到账口径</span>
                    )}
                  </td>
                  <td className="p-4">
                     <button onClick={() => deleteRecord(r.id)} className="text-xs font-semibold text-red-500 hover:underline">删除平账</button>
                  </td>
                </tr>
              ))}
            </tbody>
           </table>
        </div>
      )}
    </div>
  );
}
