import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, Plus, User, Calendar,
  Package, MessageSquare, Paperclip
} from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Chip from '../components/ui/Chip';
import Toast from '../components/ui/Toast';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useNavigateWithTransition } from '../lib/transition';
import { lazyRetry } from '../lib/lazyRetry';

const TaskDrawer = lazy(lazyRetry(() => import('../components/ui/TaskDrawer').then(m => ({ default: m.TaskDrawer }))));
const TaskDetailDrawer = lazy(lazyRetry(() => import('../components/ui/TaskDetailDrawer').then(m => ({ default: m.TaskDetailDrawer }))));


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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const viewMode = (searchParams.get('view') as ViewMode) || 'assigned';

  const { data: tasks = [], isLoading: loading } = useQuery<Task[]>({
    queryKey: ['tasks', viewMode],
    queryFn: () => apiFetch<Task[]>(`/api/tasks?view=${viewMode}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: number; newStatus: ColumnKey }) =>
      apiFetch(`/api/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }),
    onMutate: async ({ taskId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', viewMode] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', viewMode]);
      queryClient.setQueryData<Task[]>(['tasks', viewMode], (old) =>
        old?.map(t => t.id === taskId ? { ...t, status: newStatus } : t) || []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', viewMode], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', viewMode] });
    },
  });

  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId) setSelectedTaskId(Number(detailId));
  }, [searchParams]);

  const updateView = (mode: ViewMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', mode);
    setSearchParams(next);
  };

  const columns: { key: ColumnKey; label: string; dot: string }[] = [
    { key: 'todo', label: '待处理 (To Do)', dot: 'bg-slate-400' },
    { key: 'in_progress', label: '进行中 (In Progress)', dot: 'bg-sky-500' },
    { key: 'done', label: '已完成 (Done)', dot: 'bg-emerald-500' }
  ];

  const updateTaskStatus = (taskId: number, newStatus: ColumnKey) => {
    statusMutation.mutate({ taskId, newStatus });
    setToast('状态已流转');
    setTimeout(() => setToast(''), 2000);
  };

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-extrabold text-primary-navy dark:text-white tracking-tight">团队协同看板</h1>
          <button
            onClick={() => setShowCreateDrawer(true)}
            className="btn-primary text-xs px-5 py-2"
          >
            <Plus size={14} /> 指派新任务
          </button>
        </div>

        <div className="flex items-center justify-center mt-4">
           <div className="flex p-1 bg-slate-100 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-800 shadow-inner overflow-hidden w-full max-w-md">
              <ViewToggle active={viewMode === 'assigned'} label="我负责的" onClick={() => updateView('assigned')} />
              <ViewToggle active={viewMode === 'delegated'} label="我派发的" onClick={() => updateView('delegated')} />
              {(user?.role === 'admin') && <ViewToggle active={viewMode === 'all'} label="全局视图" onClick={() => updateView('all')} />}
           </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-32 col-span-full">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-navy border-t-transparent dark:border-tertiary-sage dark:border-t-transparent" />
            <div className="text-[11px] font-bold text-slate-400 tracking-tight animate-pulse">正在加载任务...</div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {columns.map(col => (
             <div key={col.key} className="flex flex-col rounded-lg border border-slate-200 bg-surface shadow-sm dark:border-navy-800 dark:bg-navy-900">
                <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b border-slate-200 px-5 py-4 dark:border-navy-800">
                   <h3 className="flex items-center gap-2 text-xs font-extrabold tracking-tight text-slate-900 dark:text-white">
                      <div className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
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
                        />
                      ))}
                   </AnimatePresence>
                   {tasks.filter(t => t.status === col.key).length === 0 && (
                     <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-navy-800">
                        <CheckCircle2 size={32} strokeWidth={1} />
                        <div className="mt-2 text-xs font-bold tracking-tight">无此状态任务</div>
                     </div>
                   )}
                </div>
             </div>
           ))}
        </div>
      )}

      <Suspense fallback={null}>
        <TaskDrawer
          isOpen={showCreateDrawer} 
          onClose={() => setShowCreateDrawer(false)} 
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
        />

        <TaskDetailDrawer
          taskId={selectedTaskId}
          onClose={() => {
             setSelectedTaskId(null);
             const next = new URLSearchParams(searchParams);
             next.delete('detail');
             setSearchParams(next);
          }}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
        />
      </Suspense>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function ViewToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold tracking-tight transition-all ${active ? 'bg-surface dark:bg-navy-800 text-primary-navy dark:text-tertiary-sage shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
    >
      {label}
    </button>
  );
}

interface TaskCardProps {
  task: Task;
  onSelect: () => void;
}

const TaskCard = React.memo(({ task, onSelect }: TaskCardProps) => {
  const navigate = useNavigateWithTransition();
  const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'done';
  const priorityMeta = task.priority === 'P0'
    ? { label: 'P0', className: 'border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300' }
    : task.priority === 'P1'
      ? { label: 'P1', className: 'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300' }
      : { label: 'P2', className: 'border-sky-100 bg-sky-50 text-sky-600 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300' };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onSelect}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-surface p-4 shadow-sm transition-all hover:shadow-md dark:border-navy-800 dark:bg-navy-900"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
         <h4 className="line-clamp-2 text-sm font-extrabold leading-tight text-primary-navy transition-colors group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-300">{task.title}</h4>
         <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${priorityMeta.className}`}>{priorityMeta.label}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
         {task.entity_id && (
           <div
             onClick={(e) => { e.stopPropagation(); navigate(task.entity_type === 'ORDER' ? `/orders/${String(task.entity_id).toLowerCase()}?section=tasks` : `/customers/detail/${String(task.entity_id).toLowerCase()}`); }}
             className="flex items-center gap-1 rounded border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-600 transition-colors hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300"
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

      <div className="flex items-center justify-between border-t border-slate-50 pt-3 dark:border-navy-800">
         <div className={`flex items-center gap-1.5 text-xs font-bold tracking-tight ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Clock size={12} />
            {task.due_date.slice(5)}
         </div>
         <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-primary-navy dark:text-white text-xs font-bold border border-slate-200 dark:border-navy-700 shadow-sm" title={`负责人: ${task.assignee_name}`}>
               {task.assignee_name.charAt(0).toUpperCase()}
            </div>
         </div>
      </div>
    </motion.div>
  );
});
