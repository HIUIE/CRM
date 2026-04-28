import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // 30s 内认为数据新鲜，不重复请求
      retry: 1,                    // 失败自动重试 1 次
      refetchOnWindowFocus: false, // 不因窗口焦点切换而刷新
    },
  },
});
