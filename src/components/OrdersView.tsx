import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText, Anchor, Settings, Trash2, Truck, CreditCard } from 'lucide-react';

interface Order {
  id: number;
  display_id: string;
  customer_id: number;
  status: string;
  total_amount: number;
  details: string;
  customer_name?: string;
  customer_country?: string;
  created_at: string;
}

interface Customer {
  id: number;
  name: string;
}

export default function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    customerId: '',
    details: '',
    totalAmount: 0
  });

  const fetchData = async () => {
    try {
      const [orderRes, customerRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/customers')
      ]);
      const oData = await orderRes.json();
      const cData = await customerRes.json();
      setOrders(oData);
      setCustomers(cData);
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
    if (!formData.customerId) return alert("请选择一位客户");
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '保存失败');
      }
      setShowForm(false);
      setFormData({ customerId: '', details: '', totalAmount: 0 });
      fetchData();
    } catch (err: any) {
      alert(err.message || '保存失败，请检查客户是否已存入');
      console.error('Save failed', err);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (err) {
      console.error('Update failed');
    }
  };

  const statusMap: Record<string, { label: string, color: string }> = {
    'draft': { label: '草稿订单', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    'confirmed': { label: '已确认(待付款)', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    'production': { label: '生产中', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
    'shipped': { label: '已发货', color: 'bg-green-50 text-green-600 border-green-200' },
    'completed': { label: '交易完成', color: 'bg-slate-800 text-white border-slate-900' }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">订单工作台</h2>
          <p className="text-sm text-slate-500 mt-1">管理客户订单列表与履约流程</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
        >
          {showForm ? '取消创建' : <><Plus className="w-4 h-4 mr-2" /> 新建业务订单</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">新建草稿订单</h3>
          {customers.length === 0 ? (
            <div className="text-red-500 text-sm font-medium py-4">请先到 CRM 模块添加至少一位客户，然后再建立订单。</div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">绑定客户 *</label>
                <select 
                  required value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})} 
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- 请选择要下单的客户 --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">预期订单总额 (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input required type="number" step="0.01" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: Number(e.target.value)})} className="w-full pl-8 p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0.00" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">订单要求及采购详情 *</label>
                <textarea required value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className="w-full h-24 p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" placeholder="记录购买的商品、规格、供应商备注等..."></textarea>
              </div>
              <div className="col-span-2 flex justify-end mt-2">
                <button type="submit" className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors">生成订单号</button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">正在加载订单流水...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
           <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-500 font-medium">暂无订单数据。点击右上角新建订单。</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
           <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
              <tr className="text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-[20%]">业务编号</th>
                <th className="p-4 font-semibold w-[20%]">客户信息</th>
                <th className="p-4 font-semibold w-[30%]">订单标的</th>
                <th className="p-4 font-semibold w-[15%]">当前状态</th>
                <th className="p-4 font-semibold w-[15%]">流转控制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-slate-800 tracking-tight">{o.display_id}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{new Date(o.created_at).toLocaleDateString()} 创建</div>
                  </td>
                  <td className="p-4">
                    {o.customer_name ? (
                      <>
                        <div className="font-semibold text-slate-700">{o.customer_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{o.customer_country}</div>
                      </>
                    ) : (
                      <div className="text-red-400 text-xs line-through">客户档案已删</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-slate-600 truncate max-w-[200px]" title={o.details}>{o.details}</div>
                    <div className="text-sm font-bold text-green-600 mt-1">${(o.total_amount || 0).toLocaleString()}</div>
                  </td>
                  <td className="p-4">
                     <span className={`px-2.5 py-1 text-[11px] font-bold border rounded-md uppercase tracking-wider flex inline-block w-max ${statusMap[o.status || 'draft']?.color || 'bg-slate-100'}`}>
                       {statusMap[o.status || 'draft']?.label || o.status}
                     </span>
                  </td>
                  <td className="p-4">
                    <select 
                      value={o.status || 'draft'} 
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="p-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="draft">待确认</option>
                      <option value="confirmed">转为确认 (等钱)</option>
                      <option value="production">下发工厂生产</option>
                      <option value="shipped">出海发货</option>
                      <option value="completed">归档完毕</option>
                    </select>
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
