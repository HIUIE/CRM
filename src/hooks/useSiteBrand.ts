import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface SiteBrand {
  siteName: string;
  siteSlogan: string;
  siteLogo: string;
  siteFavicon: string;
}

export function useSiteBrand() {
  return useQuery<SiteBrand>({
    queryKey: ['site-brand'],
    queryFn: () => apiFetch<SiteBrand>('/api/settings/basic'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: { siteName: 'SmartTrade AI CRM', siteSlogan: '', siteLogo: '/logo.png', siteFavicon: '' },
  });
}
