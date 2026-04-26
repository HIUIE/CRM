import React, { useEffect, useState, useMemo } from 'react';
import { 
  CheckCircle2, Clock, Plus, MoreHorizontal, User, Calendar, 
  Package, LayoutPanelLeft, List, ArrowRight, AlertCircle, Trash2, GripVertical, MessageSquare, Paperclip, ChevronDown
} from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Chip, Toast } from '../features/order-detail/components';
import { TaskDrawer } from '../components/ui/TaskDrawer';
import { TaskDetailDrawer } from '../components/ui/TaskDetailDrawer';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface Task {
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
  comment_count: number;
  attachment_count: number;
}

type ColumnKey = 'todo' | 'in_progress' | 'done';
type ViewMode = 'assigned' | 'delegated' | 'all';

export default function TasksView() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const viewMode = (searchParams.get('view') as ViewMode) || 'assigned';

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Task[]>(`/api/tasks?view=${viewMode}`);
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [viewMode]);

  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId) setSelectedTaskId(Number(detailId));
  }, [searchParams]);

  const updateView = (mode: ViewMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', mode);
    setSearchParams(next);
  };

  const columns: { key: ColumnKey; label: string; color: string }[] = [
    { key: 'todo', label: '待处理 (To Do)', color: 'bg-slate-100/50 dark:bg-navy-950/30' },
    { key: 'in_progress', label: '进行中 (In Progress)', color: 'bg-blue-50/20 dark:bg-blue-900/5' },
    { key: 'done', label: '已完成 (Done)', color: 'bg-emerald-50/20 dark:bg-emerald-900/5' }
  ];

  const updateTaskStatus = async (taskId: number, newStatus: ColumnKey) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      await apiFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setToast('状态已流转');
      setTimeout(() => setToast(''), 2000);
    } catch (e) {
      loadTasks();
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in duration-500">
      <section className="shrink-0 flex flex-col gap-4 p-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <LayoutPanelLeft size={20} className="text-primary-navy dark:text-tertiary-sage" />
             <h1 className="text-xl font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">团队协同看板</h1>
          </div>
          <button 
            onClick={() => setShowCreateDrawer(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage px-5 py-2 text-[11px] font-bold text-white shadow-md hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest"
          >
            <Plus size={16} /> 指派新任务
          </button>
        </div>

        {/* View Toggle Controller */}
        <div className="flex items-center justify-center">
           <div className="flex p-1 bg-slate-100 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-800 shadow-inner overflow-hidden w-full max-w-md">
              <ViewToggle active={viewMode === 'assigned'} label="我负责的" onClick={() => updateView('assigned')} />
              <ViewToggle active={viewMode === 'delegated'} label="我派发的" onClick={() => updateView('delegated')} />
              {(user?.role === 'admin') && <ViewToggle active={viewMode === 'all'} label="全局视图" onClick={() => updateView('all')} />}
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 px-1">
         {columns.map(col => (
           <div key={col.key} className={`flex flex-col rounded-xl border border-slate-200 dark:border-navy-800 ${col.color}`}>
              <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0 bg-white/60 dark:bg-navy-900/60 backdrop-blur-md rounded-t-xl">
                 <h3 className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${col.key === 'todo' ? 'bg-slate-400' : col.key === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                    {col.label}
                 </h3>
                 <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-800 text-[9px] font-bold text-slate-600 dark:text-slate-400">{tasks.filter(t => t.status === col.key).length}</span>
              </div>

              <div className="p-3 space-y-3">
                 <AnimatePresence initial={false}>
                    {tasks.filter(t => t.status === col.key).map((task) => (
                      <TaskCard 
                        key={`task-${task.id}`} 
                        task={task} 
                        onSelect={() => setSelectedTaskId(task.id)}
                        onStatusChange={updateTaskStatus} 
                      />
                    ))}
                 </AnimatePresence>
                 {tasks.filter(t => t.status === col.key).length === 0 && (
                   <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-navy-800">
                      <CheckCircle2 size={32} strokeWidth={1} />
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest">无此状态任务</div>
                   </div>
                 )}
              </div>
           </div>
         ))}
      </div>

      <TaskDrawer 
        isOpen={showCreateDrawer} 
        onClose={() => setShowCreateDrawer(false)} 
        onSuccess={loadTasks} 
      />

      <TaskDetailDrawer 
        taskId={selectedTaskId}
        onClose={() => {
           setSelectedTaskId(null);
           const next = new URLSearchParams(searchParams);
           next.delete('detail');
           setSearchParams(next);
        }}
        onUpdate={loadTasks}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function ViewToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-1.5 px-4 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-navy-800 text-primary-navy dark:text-tertiary-sage shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
    >
      {label}
    </button>
  );
}

interface TaskCardProps {
  task: Task;
  onSelect: () => void;
  onStatusChange: (taskId: number, newStatus: ColumnKey) => Promise<void>;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onSelect, onStatusChange }) => {
  const navigate = useNavigate();
  const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'done';
  const priorityColor = task.priority === 'P0' ? 'bg-red-500' : task.priority === 'P1' ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onSelect}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-800 p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
    >
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${priorityColor}`} />
      
      <div className="flex justify-between items-start mb-2 pl-2">
         <h4 className="text-[13px] font-extrabold text-primary-navy dark:text-white leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">{task.title}</h4>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 pl-2">
         {task.entity_id && (
           <div 
             onClick={(e) => { e.stopPropagation(); navigate(task.entity_type === 'ORDER' ? `/orders/${task.entity_id?.toLowerCase()}` : `/customers/detail/${task.entity_id?.toLowerCase()}`); }}
             className="flex items-center gap-1 text-[9px] font-extrabold text-blue-500 dark:text-emerald-400 bg-blue-50/50 dark:bg-emerald-900/10 px-2 py-0.5 rounded uppercase tracking-tighter hover:bg-blue-100 transition-colors"
           >
              <Package size={10} />
              {task.entity_id}
           </div>
         )}
         {task.comment_count > 0 && (
           <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
              <MessageSquare size={10} /> {task.comment_count}
           </div>
         )}
         {task.attachment_count > 0 && (
           <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
              <Paperclip size={10} /> {task.attachment_count}
           </div>
         )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-50 dark:border-navy-800 pt-3 pl-2">
         <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Clock size={12} />
            {task.due_date.slice(5)}
         </div>
         <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-primary-navy dark:text-white text-[10px] font-bold border border-slate-200 dark:border-navy-700 shadow-sm" title={`负责人: ${task.assignee_name}`}>
               {task.assignee_name.charAt(0).toUpperCase()}
            </div>
         </div>
      </div>
    </motion.div>
  );
};
