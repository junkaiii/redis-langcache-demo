import { LangCache } from '@redis-ai/langcache';

interface LangCacheConfig {
  serverURL: string;
  cacheId: string;
  apiKey: string;
}

export const createLangCache = ({ serverURL, cacheId, apiKey }: LangCacheConfig): LangCache => 
  new LangCache({ serverURL, cacheId, apiKey });