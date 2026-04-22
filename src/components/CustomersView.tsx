import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Building2, MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

interface Customer {
  id: number;
  name: string;
  country: string;
  contact: string;
  logistics_preference: string;
  payment_terms: string;
  created_at: string;
}

export default function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    contact: '',
    logisticsPreference: '',
    paymentTerms: ''
  });

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '保存失败');
      }
      setShowForm(false);
      setFormData({ name: '', country: '', contact: '', logisticsPreference: '', paymentTerms: '' });
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || '保存失败，请稍后重试');
      console.error('Save failed', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此客户吗？相关订单保留，但客户绑定将解除。')) return;
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      fetchCustomers();
    } catch (err) {
      console.error('Delete failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">客户关系管理 (CRM)</h2>
          <p className="text-sm text-slate-500 mt-1">管理收发货客户、合作企业及联系信息</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
        >
          {showForm ? '取消录入' : <><Plus className="w-4 h-4 mr-2" /> 新增客户</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">新增合作客户</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">企业/客户名称 *</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: TechCorp Global" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">国家/地区 *</label>
              <input required value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: United States" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">联系信息 (邮箱/电话) *</label>
              <input required value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: john@example.com, +1 555-0100" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">偏好物流 (选填)</label>
              <div className="relative">
                <input value={formData.logisticsPreference} onChange={e => setFormData({...formData, logisticsPreference: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: DHL优先 或 宁波港走海运" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">默认付款条款 (选填)</label>
              <input value={formData.paymentTerms} onChange={e => setFormData({...formData, paymentTerms: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="如: 30% T/T Advance, 70% against BL copy" />
            </div>
            <div className="col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors">保存客户档案</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">正在加载客户数据...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
           <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-500 font-medium">暂无客户数据，请先新增一个客户吧。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="编辑"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="删除"><Trash2 className="w-4 h-4" /></button>
              </div>
              
              <div className="flex items-start mb-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-lg mr-3 shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 tracking-tight leading-tight group-hover:text-blue-600 transition-colors cursor-pointer">{c.name}</h3>
                  <div className="flex items-center text-xs text-slate-500 mt-1">
                    <MapPin className="w-3 h-3 mr-1" /> {c.country}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-start text-sm">
                  <Mail className="w-4 h-4 text-slate-400 mr-2 mt-0.5" />
                  <span className="text-slate-600 break-all">{c.contact}</span>
                </div>
                
                {c.payment_terms && (
                  <div className="flex items-start text-sm">
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-medium mr-2 shrink-0">结算</span>
                    <span className="text-slate-600 text-xs mt-0.5 truncate" title={c.payment_terms}>{c.payment_terms}</span>
                  </div>
                )}
                
                {c.logistics_preference && (
                  <div className="flex items-start text-sm mt-1">
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-medium mr-2 shrink-0">物流</span>
                    <span className="text-slate-600 text-xs mt-0.5 truncate" title={c.logistics_preference}>{c.logistics_preference}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-5 text-right w-full">
                <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-end w-full group/link">
                  查看历史订单 <ExternalLink className="w-3 h-3 ml-1 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
