# Redis LangCache Demo

This project demonstrates the benefits of using Redis as a cache for LLM (Large Language Model) queries and responses. It uses the @redis-ai/langcache package to cache responses from Google's Gemini API.

## Features

- Caches LLM responses in Redis to reduce API calls and latency
- Uses the cost-effective Gemini 2.5 Flash Lite model
- Tracks response times and identifies source (cache vs API)
- Web-based frontend interface for easy interaction
- User-provided credentials for API access

## Prerequisites

- Node.js 18 or higher
- Google Gemini API key
- LangCache server credentials for caching

## Setup

1. Clone or create this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. To run in development:
   ```bash
   npm run dev
   ```

## Accessing the Frontend

The application includes a user-friendly web interface:

1. After starting the server, open your browser and navigate to `http://localhost:3000`
2. You'll see a configuration page where you can enter your API credentials
3. The frontend stores your credentials in browser session storage for the duration of your session
4. After configuring credentials, you can interact with the LLM through the query interface
5. The interface displays the response, source (cache vs API), response time, and similarity scores

## Backend Functionality

### API Endpoints

- `GET /api` - API status endpoint that confirms the API is running
- `POST /api/query` - Main endpoint to process LLM queries with caching

### Query Endpoint

The main `/api/query` endpoint requires user-provided credentials:

```json
{
  "query": "Your question here",
  "credentials": {
    "geminiApiKey": "your_gemini_key",
    "langcacheServerUrl": "your_langcache_server_url",
    "langcacheCacheId": "your_langcache_cache_id",
    "langcacheApiKey": "your_langcache_api_key"
  }
}
```

Credentials must be provided with each request.

### Response Details

The API response includes:

- `query`: The original query sent
- `response`: The LLM response text
- `source`: Either 'cache' (if response was retrieved from cache) or 'api' (if generated fresh)
- `similarity`: Similarity score (0-1) of the cached query if found in cache
- `similarQueries`: Array of similar queries stored in the cache
- `responseTime`: Time taken to process the request
- `timestamp`: When the request was processed

### Caching Logic

The system uses Redis to store and retrieve LLM responses:

1. When a query arrives, the system first searches for similar queries in the cache
2. If a similar query (above 80% similarity threshold) exists, it returns the cached response
3. If no similar query is found, it generates a new response from the LLM and caches it
4. The system handles authentication failures and other cache-related errors gracefully

## How It Works

1. When a query is received, the system first checks if a similar response is already in Redis cache
2. If found in cache (with similarity above threshold), it returns the cached response immediately with source marked as 'cache'
3. If not in cache, it calls the Gemini API, stores the response in cache, and returns it with source marked as 'api'
4. Response times are tracked to demonstrate the performance benefits of caching
5. The system returns a list of similar queries to show how the cache is being used

## Performance Benefits

- Substantially faster response times for repeated or similar queries
- Reduced LLM API costs by avoiding duplicate calls
- Lower latency for cached content
- Improved user experience with consistent response times
- Ability to see similarity metrics between queries
