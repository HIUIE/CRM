import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isDirty?: boolean;
}

export function Drawer({ isOpen, onClose, title, children, footer, isDirty = false }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty]);

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm('内容尚未保存，确定要放弃修改吗？')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Auto-focus first input
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const firstInput = drawerRef.current.querySelector('input, textarea, select') as HTMLElement;
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex justify-end">
      <div 
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleOverlayClick}
      />
      <div 
        ref={drawerRef}
        className="relative z-10 w-full max-w-md h-full bg-white dark:bg-navy-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 shrink-0">
          <h2 className="text-[15px] font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">{title}</h2>
          <button 
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 p-6 border-t border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
