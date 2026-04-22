import React, { useState, useEffect } from 'react';
import { Plus, Truck, PackageCheck, Route, Ship } from 'lucide-react';

interface LogisticsRecord {
  id: number;
  order_id: number;
  tracking_no: string;
  carrier: string;
  packing_details: string;
  status: string;
  order_display_id?: string;
  order_status?: string;
  customer_name?: string;
  created_at: string;
}

interface Order {
  id: number;
  display_id: string;
  customer_name: string;
}

export default function LogisticsView() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    orderId: '',
    trackingNo: '',
    carrier: '',
    packingDetails: '',
    status: 'preparing'
  });

  const fetchData = async () => {
    try {
      const [logRes, ordRes] = await Promise.all([
        fetch('/api/logistics'),
        fetch('/api/orders')
      ]);
      const lData = await logRes.json();
      const oData = await ordRes.json();
      setRecords(lData);
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
    if (!formData.orderId) return alert("请选择关联订单");
    try {
      const res = await fetch('/api/logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, orderId: Number(formData.orderId) })
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setFormData({ orderId: '', trackingNo: '', carrier: '', packingDetails: '', status: 'preparing' });
      fetchData();
    } catch (err) {
      alert('保存失败');
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await fetch(`/api/logistics/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (err) { }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">物流打包看板 (Logistics)</h2>
          <p className="text-sm text-slate-500 mt-1">集装箱装柜、报关与快递运单追踪</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
        >
          {showForm ? '取消发运记录' : <><Plus className="w-4 h-4 mr-2" /> 新增发货记录</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center"><PackageCheck className="w-4 h-4 mr-2"/> 预报关发运装箱</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">选择待发货订单 *</label>
              <select required value={formData.orderId} onChange={e => setFormData({...formData, orderId: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">-- 选择订单 --</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.display_id} - {o.customer_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">物流公司 / 船东大票 *</label>
              <input required value={formData.carrier} onChange={e => setFormData({...formData, carrier: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: COSCO, Maersk 或 DHL" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">运单号 / 提单号</label>
              <input value={formData.trackingNo} onChange={e => setFormData({...formData, trackingNo: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="例如: MSCU1234567..." />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-600 mb-1">物流追踪状态</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                 <option value="preparing">备货中 / 订舱中</option>
                 <option value="shipped">已开船 / 运输中</option>
                 <option value="arrived">已到港 / 签收</option>
               </select>
            </div>
            <div className="col-span-2">
               <label className="block text-xs font-bold text-slate-600 mb-1">装箱包材与毛重明细 *</label>
               <input required value={formData.packingDetails} onChange={e => setFormData({...formData, packingDetails: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: 1x40HQ, 300 CTNS, 4500 KGS, 木托盘加固" />
            </div>
            <div className="col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors">锁定发货信息</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">正在同步舱单...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
           <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-500 font-medium">没有物流运输条目，去录入一单发货吧。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {records.map(r => (
            <div key={r.id} className="bg-white border flex flex-col border-slate-200 rounded-2xl p-5 shadow-sm group">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                 <div>
                   <h3 className="font-black text-slate-800 tracking-tight flex items-center hover:text-blue-600 cursor-pointer transition-colors">
                     {r.order_display_id} 
                   </h3>
                   <p className="text-xs text-slate-500 mt-1">{r.customer_name}</p>
                 </div>
                 <div className="text-center">
                   <select 
                     value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                     className={`text-xs font-bold rounded ring-1 ring-inset ${
                       r.status === 'preparing' ? 'bg-orange-50 text-orange-600 ring-orange-200' : 
                       r.status === 'shipped' ? 'bg-blue-50 text-blue-600 ring-blue-200' :
                       'bg-green-50 text-green-600 ring-green-200'
                     } px-2 py-1 focus:outline-none`}
                   >
                     <option value="preparing">备货配舱</option>
                     <option value="shipped">头程在途</option>
                     <option value="arrived">海外到港</option>
                   </select>
                 </div>
              </div>
              
              <div className="space-y-3 flex-1">
                 <div className="flex">
                   <Ship className="w-4 h-4 text-slate-400 mr-2 mt-0.5" />
                   <div>
                     <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">承运货代 / 船东</p>
                     <p className="text-sm font-medium text-slate-700 mt-0.5">{r.carrier}</p>
                   </div>
                 </div>
                 <div className="flex">
                   <Route className="w-4 h-4 text-slate-400 mr-2 mt-0.5" />
                   <div>
                     <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">提单号/追踪号</p>
                     <p className="text-sm font-bold text-slate-800 mt-0.5 font-mono">{r.tracking_no || '暂未出号'}</p>
                   </div>
                 </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                 <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">包装明细 (Packing List)</p>
                 <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">{r.packing_details}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
