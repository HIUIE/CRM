import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface SiteBrand {
  siteName: string;
  siteSlogan: string;
  siteLogo: string;
  siteFavicon: string;
}

export function useSiteBrand() {
  const query = useQuery<SiteBrand>({
    queryKey: ['site-brand'],
    queryFn: () => apiFetch<SiteBrand>('/api/settings/basic'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: { siteName: 'SmartTrade AI CRM', siteSlogan: '', siteLogo: '/logo.png', siteFavicon: '' },
  });

  useEffect(() => {
    if (query.data?.siteName) {
      document.title = query.data.siteName;
    }
    if (query.data?.siteFavicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = query.data.siteFavicon;
    }
  }, [query.data?.siteName, query.data?.siteFavicon]);

  return query;
}
