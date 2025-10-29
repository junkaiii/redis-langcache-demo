
import express, { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLangCache } from './config/redis';

interface Credentials {
  geminiApiKey?: string;
  langcacheServerUrl?: string;
  langcacheCacheId?: string;
  langcacheApiKey?: string;
}

interface QueryRequestBody {
  query: string;
  credentials?: Credentials;
}

interface SearchResult {
  id: string;
  prompt: string;
  response: string;
  attributes: object;
  similarity: number;
  searchStrategy: string;
}

const app = express();
const PORT = 3000;
const SIMILARITY_THRESHOLD = 0.8;
const MODEL_NAME = 'gemini-2.5-flash-lite';

app.use(express.json());
app.use(express.static('public'));

const createCacheAndModel = (credentials?: Credentials) => {
  if (credentials?.langcacheCacheId) {
    if (!credentials.geminiApiKey && !credentials.langcacheCacheId) {
      throw new Error('Either Gemini API Key or LangCache configuration is required');
    }

    const redisCache = createLangCache({
      serverURL: credentials.langcacheServerUrl || 'https://aws-us-east-1.langcache.redis.io',
      cacheId: credentials.langcacheCacheId,
      apiKey: credentials.langcacheApiKey || '',
    });

    const genAI = new GoogleGenerativeAI(credentials.geminiApiKey || '');
    return { redisCache, genAI };
  } else {
    throw new Error('Credentials are required for API access');
  }
};

const handleCacheOperation = async (operation: () => Promise<any>, operationType: 'search' | 'set') => {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Cache ${operationType} error:`, error);
    
    if (error?.status === 403 || (error?.message && error.message.includes('403'))) {
      throw new Error(`Authentication failed: ${operationType === 'search' 
        ? 'Invalid LangCache API key or unauthorized access.' 
        : 'Unable to store response in cache.'}`);
    }
    
    throw error;
  }
};

const apiRouter = express.Router();

apiRouter.get('/', (_req: Request, res: Response): void => {
  res.json({ message: 'Redis LLM Cache API is running!' });
});

apiRouter.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, credentials }: QueryRequestBody = req.body;
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const startTime = Date.now();
    
    const { redisCache, genAI } = createCacheAndModel(credentials);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    let cachedEntry: SearchResult | null = null;
    let foundInCache = false;
    let similarityScore = 0;
    let searchResultsData: SearchResult[] = [];

    const searchResults = await handleCacheOperation(
      () => redisCache.search({ prompt: query }),
      'search'
    );
    
    searchResultsData = searchResults.data || [];

    if (searchResultsData.length > 0) {
      const bestResult = searchResultsData[0];
      if (bestResult && bestResult.similarity >= SIMILARITY_THRESHOLD) {
        cachedEntry = bestResult;
        foundInCache = true;
        similarityScore = bestResult.similarity;
      }
    }

    let response: string;
    let source: 'cache' | 'api';

    if (foundInCache && cachedEntry?.response) {
      response = cachedEntry.response;
      source = 'cache';
    } else {
      const result = await model.generateContent(query);
      response = await result.response.text();

      await handleCacheOperation(
        () => redisCache.set({ prompt: query, response }),
        'set'
      );

      source = 'api';
    }

    res.json({
      query,
      response,
      source,
      similarity: similarityScore,
      similarQueries: searchResultsData,
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('Error processing query:', error);
    
    if (error?.message?.includes('Authentication failed')) {
      res.status(403).json({ error: error.message });
    } else if (error?.message?.includes('required')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.use('/api', apiRouter);

const startServer = async () => {
  try {
    console.log('LangCache service initialized');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Gemini model being used: ${MODEL_NAME}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;