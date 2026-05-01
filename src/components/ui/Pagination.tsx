import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-slate-300 dark:border-navy-700 bg-surface dark:bg-navy-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
        >
          上一页
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 dark:border-navy-700 bg-surface dark:bg-navy-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
        >
          下一页
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            共 <span className="font-extrabold text-primary-navy dark:text-white">{totalItems}</span> 条记录
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            每页显示
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-2 py-1 text-xs font-bold focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 dark:ring-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            
            <div className="relative inline-flex items-center px-4 py-2 text-xs font-bold text-primary-navy dark:text-white ring-1 ring-inset ring-slate-200 dark:ring-navy-700 bg-surface dark:bg-navy-900">
              {currentPage} / {totalPages || 1}
            </div>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 dark:ring-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
