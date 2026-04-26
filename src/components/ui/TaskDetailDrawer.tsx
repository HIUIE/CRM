import React, { useEffect, useState, useRef } from 'react';
import { apiFetch, apiUpload, getErrorMessage } from '../../lib/api';
import { Drawer } from './Drawer';
import { Chip, Toast, AttachmentEditor, StatusFileRow, PreviewModal } from '../../features/order-detail/components';
import {
  Clock, User, Package, Calendar, AlertCircle, MessageSquare,
  Send, CheckCircle2, ChevronRight, History, Trash2, Edit3, X, Paperclip, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MentionTextarea } from './MentionTextarea';
import type { AttachmentMeta } from '../../features/order-detail/types';

interface TaskComment {
  id: number;
  content: string;
  creator_name: string;
  created_at: string;
  attachments?: AttachmentMeta[];
}

interface TaskDetail {
  id: number;
  title: string;
  assignee_id: number;
  assignee_name: string;
  due_date: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'todo' | 'in_progress' | 'done';
  entity_type?: string;
  entity_id?: string;
  description?: string;
  created_at: string;
  comments: TaskComment[];
}

interface TaskDetailDrawerProps {
  taskId: number | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function TaskDetailDrawer({ taskId, onClose, onUpdate }: TaskDetailDrawerProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentMeta | null>(null);
  const navigate = useNavigate();

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await apiFetch<TaskDetail>(`/api/tasks/${taskId}`);
      setTask(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) loadTask();
    else {
      setTask(null);
      setCommentInput('');
      setNewFiles([]);
    }
  }, [taskId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    try {
      await apiFetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setTask({ ...task, status: newStatus as any });
      onUpdate();
      setToast('状态已更新');
      setTimeout(() => setToast(''), 2000);
    } catch (e) {}
  };

  const postComment = async () => {
    if (!commentInput.trim() && newFiles.length === 0 || !task) return;
    setIsSubmitting(true);
    try {
      let attachmentIds: number[] = [];
      if (newFiles.length > 0) {
        setIsUploading(true);
        const fd = new FormData();
        newFiles.forEach(f => fd.append('files', f));
        const atts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
        attachmentIds = atts.map(a => a.id);
        setIsUploading(false);
      }

      await apiFetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ 
          content: commentInput,
          attachmentIds 
        })
      });
      
      setCommentInput('');
      setNewFiles([]);
      await loadTask();
      setToast('进展已同步');
      setTimeout(() => setToast(''), 2000);
    } catch (e) {
      alert('发送失败');
      setIsUploading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={!!taskId}
      onClose={onClose}
      title={task ? `#${task.id} 协同工作台` : '任务详情'}
      footer={
        <div className="flex justify-between items-center w-full">
           <div className="flex gap-2">
              <button 
                onClick={() => handleStatusChange(task?.status === 'done' ? 'in_progress' : 'done')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-sm ${task?.status === 'done' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}
              >
                {task?.status === 'done' ? <History size={14} /> : <CheckCircle2 size={14} />}
                {task?.status === 'done' ? '重新开启任务' : '标记任务完成'}
              </button>
           </div>
           <button onClick={onClose} className="px-6 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">关闭</button>
        </div>
      }
    >
      {loading ? (
        <div className="py-20 text-center animate-pulse text-slate-400 text-xs font-bold uppercase">正在读取进展...</div>
      ) : task ? (
        <div className="flex flex-col h-full space-y-8">
          {/* Metadata Section */}
          <section className="space-y-6 shrink-0">
            <div className="p-5 bg-slate-50 dark:bg-navy-950 rounded-2xl border border-slate-100 dark:border-navy-800">
               <h1 className="text-[15px] font-extrabold text-primary-navy dark:text-white leading-tight mb-4">{task.title}</h1>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">当前状态</label>
                    <div className="flex items-center gap-2">
                       <div className={`h-2 w-2 rounded-full ${task.status === 'done' ? 'bg-emerald-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                       <span className="text-xs font-bold text-primary-navy dark:text-white uppercase">{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">优先级</label>
                    <Chip tone={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'info'}>{task.priority}</Chip>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <InfoItem icon={<User size={14} />} label="负责人" value={task.assignee_name} />
               <InfoItem 
                 icon={<Calendar size={14} />} 
                 label="截止日期" 
                 value={task.due_date} 
                 valueClass={new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-500 font-bold' : ''} 
               />
               {task.entity_id && (
                 <div className="col-span-2">
                    <InfoItem 
                      icon={<Package size={14} />} 
                      label="关联业务单据" 
                      value={task.entity_id} 
                      onClick={() => {
                        onClose();
                        navigate(task.entity_type === 'ORDER' ? `/orders/${task.entity_id?.toLowerCase()}` : `/customers/detail/${task.entity_id?.toLowerCase()}`);
                      }}
                    />
                 </div>
               )}
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">核心任务指令</label>
               <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-slate-50/50 dark:bg-navy-950/30 p-4 rounded-xl border border-slate-100 dark:border-navy-800 italic">
                  “{task.description || '暂无详细背景描述。'}”
               </p>
            </div>
          </section>

          <div className="border-t border-slate-100 dark:border-navy-800 shrink-0" />

          {/* Comments/Followups Section */}
          <section className="flex-1 min-h-0 flex flex-col space-y-6">
             <div className="flex items-center gap-2 shrink-0">
                <MessageSquare size={16} className="text-primary-navy dark:text-tertiary-sage" />
                <h3 className="text-[13px] font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">协作进度汇报 ({task.comments.length})</h3>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                {task.comments.map(c => (
                  <div key={c.id} className="flex gap-4 group">
                     <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-[10px] font-bold border border-slate-200 dark:border-navy-700 shrink-0">
                        {c.creator_name.charAt(0)}
                     </div>
                     <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-extrabold text-primary-navy dark:text-white">{c.creator_name}</span>
                           <span className="text-[10px] font-bold text-slate-400">{c.created_at.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-950/50 p-4 rounded-xl border border-slate-100 dark:border-navy-800">
                          <p className="text-[13px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{c.content}</p>
                          {c.attachments && c.attachments.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-navy-800 space-y-1">
                               {c.attachments.map(att => (
                                 <div key={att.id}>
                                   <StatusFileRow label={att.fileName} fileName={att.fileName} status="uploaded" onPreview={() => setPreviewAttachment(att)} />
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>
                     </div>
                  </div>
                ))}
             </div>

             {/* Reply Box: Permanent at bottom */}
             <div className="shrink-0 pt-4 border-t border-slate-100 dark:border-navy-800">
                <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-lg overflow-hidden transition-all focus-within:ring-2 focus-within:ring-primary-navy/5">
                   <MentionTextarea 
                     value={commentInput}
                     onChange={setCommentInput}
                     placeholder="汇报您的处理结果，输入 @ 提及同事协同..."
                     className="w-full bg-transparent p-4 text-sm font-medium outline-none resize-none border-none min-h-[100px]"
                   />
                   
                   {newFiles.length > 0 && (
                     <div className="px-4 pb-2 flex flex-wrap gap-2">
                        {newFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-navy-950 rounded border border-slate-200 dark:border-navy-800 text-[10px] font-bold text-slate-500">
                             <Paperclip size={10} />
                             <span className="truncate max-w-[100px]">{f.name}</span>
                             <button onClick={() => setNewFiles(newFiles.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-error"><X size={12} /></button>
                          </div>
                        ))}
                     </div>
                   )}

                   <div className="px-4 py-3 bg-slate-50 dark:bg-navy-950 flex justify-between items-center border-t border-slate-100 dark:border-navy-800">
                      <div className="flex gap-2">
                         <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-xs font-bold text-slate-500 hover:text-primary-navy dark:hover:text-white cursor-pointer transition-all shadow-sm">
                            <Paperclip size={14} />
                            <span>上传交付物</span>
                            <input type="file" multiple className="hidden" onChange={e => e.target.files && setNewFiles([...newFiles, ...Array.from(e.target.files)])} />
                         </label>
                      </div>
                      <button 
                        disabled={(!commentInput.trim() && newFiles.length === 0) || isSubmitting}
                        onClick={postComment}
                        className="flex items-center gap-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest"
                      >
                        <Send size={14} /> {isSubmitting ? (isUploading ? `上传中 ${uploadProgress}%` : '发布中...') : '确认提交'}
                      </button>
                   </div>
                </div>
             </div>
          </section>
        </div>
      ) : null}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {previewAttachment && <PreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </Drawer>
  );
}

function InfoItem({ icon, label, value, valueClass = '', onClick }: { icon: React.ReactNode; label: string; value: string; valueClass?: string; onClick?: () => void }) {
  return (
    <div className={`space-y-1.5 ${onClick ? 'cursor-pointer group' : ''}`} onClick={onClick}>
       <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          {icon}
          {label}
       </div>
       <div className={`text-[13px] font-extrabold text-primary-navy dark:text-white truncate ${valueClass} ${onClick ? 'group-hover:text-blue-500 transition-colors underline decoration-slate-200 underline-offset-4' : ''}`}>
          {value || '—'}
       </div>
    </div>
  );
}
