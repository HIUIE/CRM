import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isDirty?: boolean;
  width?: string;
}

export function Drawer({ isOpen, onClose, title, children, footer, isDirty = false, width = 'max-w-[760px]' }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
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

  if (!isOpen || typeof document === 'undefined') return null;

  const drawerNode = (
    <div data-modal-layer="true" className="fixed inset-0 z-[650] flex h-dvh justify-end overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleOverlayClick}
      />
      <div
        ref={drawerRef}
        className={`relative z-10 w-full ${width} h-dvh max-h-dvh min-h-0 overflow-hidden bg-white dark:bg-navy-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-drawer`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 shrink-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-primary-navy dark:text-white">{title}</h2>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-[0_-12px_24px_rgba(15,23,42,0.04)]">
            {footer}
          </div>
        )}
      </div>
      <ConfirmDeleteModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
        title="放弃未保存修改"
        warning="当前抽屉中还有未保存内容，确认放弃这些修改并关闭吗？"
        entityLabel="确认文本"
        entityId="放弃修改"
        isDeleting={false}
        showCopy={false}
      />
    </div>
  );

  return createPortal(drawerNode, document.body);
}
