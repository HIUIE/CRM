import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[]) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page is valid when items or page size change
  const validCurrentPage = Math.min(currentPage, totalPages);

  const currentItems = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, validCurrentPage, pageSize]);

  return {
    currentPage: validCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setCurrentPage(1); // Reset to first page on size change
    }
  };
}
