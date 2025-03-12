// Amazon Smart Recommendations API - Vercel Serverless Function
// This function acts as a proxy to the Perplexity API with enhanced features

const fetch = require('node-fetch');
// Replace the Vercel KV import with Upstash Redis
const { Redis } = require('@upstash/redis');

// Initialize Redis client with the specific environment variables provided by Upstash
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Optimized in-memory cache with size limits to control memory usage
const memCache = {
  data: {},
  maxItems: 100, // Prevent memory leaks
  
  set(key, value, ttlSeconds) {
    // Evict oldest items if we hit capacity
    if (Object.keys(this.data).length >= this.maxItems) {
      const oldestKey = Object.keys(this.data)
        .sort((a,b) => this.data[a].timestamp - this.data[b].timestamp)[0];
      console.log(`Cache full, evicting oldest item: ${oldestKey}`);
      delete this.data[oldestKey];
    }
    
    this.data[key] = {
      value,
      expiry: Date.now() + (ttlSeconds * 1000),
      timestamp: Date.now()
    };
    console.log(`Set in memory cache: ${key} (expires in ${ttlSeconds}s)`);
  },
  
  get(key) {
    const item = this.data[key];
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      console.log(`Memory cache expired for: ${key}`);
      delete this.data[key];
      return null;
    }
    
    console.log(`Memory cache hit for: ${key}`);
    return item.value;
  }
};

// Hybrid cache helper modified to use Upstash Redis
const cache = {
  async get(key) {
    // Try memory cache first (fastest)
    const memValue = memCache.get(key);
    if (memValue) {
      return { data: memValue, source: 'memory' };
    }
    
    // Try Redis cache if memory cache misses
    try {
      const redisValue = await redis.get(key);
      if (redisValue) {
        console.log(`Redis cache hit for: ${key}`);
        
        // Parse the data if it's a string
        const parsedValue = typeof redisValue === 'string' ? JSON.parse(redisValue) : redisValue;
        
        // Backfill memory cache for future requests - with 8 minute TTL
        memCache.set(key, parsedValue, 480); // 8 minutes in memory (480 seconds)
        
        return { data: parsedValue, source: 'redis' };
      }
    } catch (error) {
      console.log(`Redis error: ${error.message}`);
      // Continue if Redis fails - we'll fall back to the API call
    }
    
    return { data: null, source: null };
  },
  
  async set(key, value, ttlSeconds) {
    // Always set memory cache with 8 minute TTL
    memCache.set(key, value, 480); // 8 minutes in memory (480 seconds)
    
    // Set Redis cache with full TTL
    try {
      // Redis needs value as a string - ensure it's always properly serialized
      const valueString = typeof value === 'string' ? value : JSON.stringify(value);
      await redis.set(key, valueString, { ex: ttlSeconds });
      console.log(`Set in Redis cache: ${key} (expires in ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.log(`Redis set error: ${error.message}`);
      return false;
    }
  }
};

// Configuration constants
const CONFIG = {
  maxPayloadSize: 100 * 1024, // 100KB max payload size
  timeoutMs: 12000, // 12 second timeout for API calls
  maxRetries: 2, // Number of retry attempts for API calls
  retryDelayMs: 300, // Milliseconds between retries
  maxOutputTokens: 500, // Reduced to 500 tokens to lower costs and improve speed
  cacheTTL: {
    'Electronics': 30 * 24 * 3600, // 30 days for Electronics
    'Books': 90 * 24 * 3600,      // 90 days for Books
    'Fashion': 60 * 24 * 3600,    // 60 days for Fashion
    'Kitchen': 45 * 24 * 3600,    // 45 days for Kitchen
    'Home': 60 * 24 * 3600,       // 60 days for Home
    'Beauty': 30 * 24 * 3600,     // 30 days for Beauty
    'Toys': 60 * 24 * 3600,       // 60 days for Toys
    'Default': 45 * 24 * 3600     // 45 days default
  }
};

// Category-specific attribute importance mapping
const CATEGORY_ATTRIBUTES = {
  'Electronics': {
    attributes: ['processor', 'memory', 'storage', 'battery life', 'display', 'camera'],
    temperature: 0.3
  },
  'Kitchen': {
    attributes: ['material', 'capacity', 'ease of cleaning', 'durability', 'warranty'],
    temperature: 0.35
  },
  'Clothing': {
    attributes: ['material', 'fit', 'durability', 'style', 'washing instructions'],
    temperature: 0.4
  },
  'Home': {
    attributes: ['size', 'material', 'style', 'assembly required', 'warranty'],
    temperature: 0.35
  },
  'Beauty': {
    attributes: ['ingredients', 'skin type', 'results', 'application', 'quantity'],
    temperature: 0.4
  },
  'Books': {
    attributes: ['genre', 'length', 'publication date', 'author background', 'series'],
    temperature: 0.45
  },
  'Toys': {
    attributes: ['age range', 'educational value', 'durability', 'battery required', 'safety'],
    temperature: 0.4
  },
  // Default category used when specific category not found
  'General': {
    attributes: ['quality', 'durability', 'features', 'ease of use', 'warranty'],
    temperature: 0.35
  }
};

// CORS headers for allowing cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Preferences, X-Requested-With',
  'Access-Control-Max-Age': '86400' // 24 hours
};

// Helper function for structured logging
const logEvent = (level, message, data = {}) => {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    };
    console.log(JSON.stringify(logEntry));
  } catch (error) {
    console.log(`Error logging [${level}] ${message}: ${error.message}`);
  }
};

// Simplified retry wrapper for API calls
const fetchWithRetry = async (url, options, retries = CONFIG.maxRetries) => {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff between retries
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelayMs * attempt));
        console.log(`Retry attempt ${attempt} of ${retries}`);
      }
      
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error;
      console.log(`API call failed (attempt ${attempt}): ${error.message}`);
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
};

// Extract keywords from product title
const extractKeywords = (title = '') => {
  if (!title) return [];
  
  // Convert to lowercase
  const text = title.toLowerCase();
  
  // Remove common words and punctuation
  const stopWords = ['and', 'the', 'is', 'in', 'for', 'with', 'on', 'at', 'from', 'to', 'of', 'a', 'an'];
  const words = text.split(/\W+/).filter(word => 
    word.length > 2 && !stopWords.includes(word)
  );
  
  // Count word occurrences
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Sort by count and take top 5 (reduced to save tokens)
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
};

// Validate the product data
const validateProductData = (product) => {
  const errors = [];
  
  if (!product) {
    return ['Product data is missing'];
  }
  
  if (!product.title || typeof product.title !== 'string' || product.title.trim() === '') {
    errors.push('Product title is required');
  }
  
  return errors;
};

// Get category-specific configuration
const getCategoryConfig = (category) => {
  if (!category || typeof category !== 'string') {
    return CATEGORY_ATTRIBUTES['General'];
  }
  
  const normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  
  // Find exact match
  const exactMatch = CATEGORY_ATTRIBUTES[normalizedCategory];
  if (exactMatch) return exactMatch;
  
  // Look for partial matches
  for (const [key, value] of Object.entries(CATEGORY_ATTRIBUTES)) {
    if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
      return value;
    }
  }
  
  // Default to general category
  return CATEGORY_ATTRIBUTES['General'];
};

// Generate cache key for a product
const getCacheKey = (product) => {
  if (!product) return null;
  
  // Use ASIN if available, otherwise use the title
  const baseKey = product.asin ? 
    `asin:${product.asin}` : 
    `title:${product.title.substring(0, 40).replace(/\s+/g, '_').toLowerCase()}`;
    
  // Add category if available for better segmentation
  if (product.category) {
    return `${baseKey}:cat:${product.category.toLowerCase().replace(/\s+/g, '_')}`;
  }
  
  return baseKey;
};

// Get cache TTL for a product category
const getCacheTTL = (category) => {
  if (!category || typeof category !== 'string') {
    return CONFIG.cacheTTL.Default;
  }
  
  const normalizedCategory = category.toLowerCase();
  
  for (const [key, value] of Object.entries(CONFIG.cacheTTL)) {
    if (normalizedCategory.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return CONFIG.cacheTTL.Default;
};

// Create a prompt based on product data
const createPrompt = (product) => {
  // Get category configuration
  const category = product.category || 'General';
  const categoryConfig = getCategoryConfig(category);
  
  // Create a more specific system prompt with examples and formatting instructions
  const systemPrompt = `You are a knowledgeable expert on consumer products. For the given product, you must recommend 3 REAL, SPECIFIC alternative products that can be purchased on Amazon RIGHT NOW.

EXTREMELY IMPORTANT INSTRUCTIONS:
1. Provide recommendations for real, purchasable products that are available on Amazon.
2. Do NOT recommend generic categories or placeholder names like "Premium Alternative" or "Best Value Option".
3. Each recommendation MUST include specific brand and model name (e.g., "Sony WH-1000XM4", "Anker Soundcore Q30").
4. Categorize alternatives as: "Better Value Alternative", "Premium Alternative", and "Most Popular Alternative".
5. Format each recommendation exactly as shown in the example below.

EXAMPLE OUTPUT FORMAT:
**Better Value Alternative:** Anker Soundcore Q30 - $59.99
* Why it's better: More affordable with 90% of the features of the original product.

**Premium Alternative:** Sony WH-1000XM4 - $299.99
* Why it's better: Superior noise cancellation and battery life.

**Most Popular Alternative:** Jabra Elite 85h - $179.99
* Why it's better: Excellent user reviews and a comfortable design.

Your recommendations MUST follow this exact format with specific product names, not generic descriptions. Users will search for these exact product names on Amazon.`;
  
  // Create detailed user prompt with specific task definition
  const userPrompt = `Product: ${product.title || 'Unknown'}
Price: ${product.price || 'Unknown'}
Brand: ${product.brand || 'Unknown'}
Category: ${category}

Task: Recommend 3 real product alternatives for the product above that are currently sold on Amazon.

Output 3 REAL PRODUCT alternatives with their EXACT names as they appear on Amazon (not generic descriptions). Include brand names, model numbers, prices, and specific reasons why each is a good alternative. Format exactly as shown in the system instructions.`;
  
  return {
    systemPrompt,
    userPrompt,
    temperature: 0.1 // Lower temperature for more factual responses
  };
};

// Clean the API response to remove thinking sections
const cleanResponse = (data) => {
  if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
    return data;
  }
  
  let content = data.choices[0].message.content;
  
  // Remove thinking sections and other verbose text
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '');
  content = content.replace(/Okay, let's tackle this query[\s\S]*?Let me structure each recommendation/g, '');
  content = content.replace(/First, I need to[\s\S]*?Let me structure/g, '');
  
  data.choices[0].message.content = content;
  return data;
};

// CORS headers helper function
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  return res;
};

// Main function handler
module.exports = async (req, res) => {
  const startTime = Date.now();
  
  // Set CORS headers for all responses
  setCorsHeaders(res);

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST requests for the API
  if (req.method !== 'POST') {
    console.log(`Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      error: 'Method not allowed. Please use POST.' 
    });
  }

  try {
    // Get the product data from the request body
    let product, apiKey;
    
    // Safely parse request body
    try {
      const { product: productData, apiKey: clientApiKey } = req.body;
      product = productData;
      apiKey = clientApiKey;
    } catch (parseError) {
      console.log(`Error parsing request body: ${parseError.message}`);
      return res.status(400).json({
        error: 'Invalid request body',
        message: parseError.message
      });
    }

    // Validate product data
    const validationErrors = validateProductData(product);
    if (validationErrors.length > 0) {
      console.log(`Validation failed: ${JSON.stringify(validationErrors)}`);
      return res.status(400).json({ 
        error: 'Invalid request', 
        messages: validationErrors 
      });
    }

    // Generate cache key
    const cacheKey = getCacheKey(product);
    console.log(`Cache key: ${cacheKey}`);
    
    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult.data) {
      const responseTime = Date.now() - startTime;
      console.log(`Cache ${cachedResult.source} hit! Response time: ${responseTime}ms`);
      
      return res.status(200).json({
        ...cachedResult.data,
        metadata: {
          ...(cachedResult.data.metadata || {}),
          cached: true,
          cacheSource: cachedResult.source,
          responseTime: `${responseTime}ms`
        }
      });
    }

    // Get API key from environment variable or client request
    apiKey = process.env.PERPLEXITY_API_KEY || apiKey;
    
    if (!apiKey) {
      console.log('API key not configured');
      return res.status(400).json({ 
        error: 'API key is required'
      });
    }

    // Create product-specific prompt
    const { systemPrompt, userPrompt, temperature } = createPrompt(product);
    
    // Prepare the request to Perplexity API
    const requestBody = {
      model: "sonar-reasoning",
      messages: [
        { 
          role: "system", 
          content: systemPrompt
        },
        { 
          role: "user", 
          content: userPrompt
        }
      ],
      temperature: temperature,
      max_tokens: CONFIG.maxOutputTokens,
      top_p: 0.85
    };

    console.log('Calling Perplexity API with request:', JSON.stringify({
      url: 'https://api.perplexity.ai/chat/completions',
      method: 'POST',
      model: requestBody.model,
      systemPrompt: systemPrompt.substring(0, 50) + '...',
      userPrompt: userPrompt,
      temperature,
      max_tokens: CONFIG.maxOutputTokens
    }));
    
    // Make the request to Perplexity API
    try {
      console.log(`Using API key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        timeout: CONFIG.timeoutMs
      });
      
      // Check for API errors
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Perplexity API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: `Error from AI service: ${response.status}`, 
          details: errorText 
        });
      }

      // Get the response data
      const rawData = await response.json();
      
      // Add detailed logging for debugging purposes
      console.log("=== PERPLEXITY RAW RESPONSE ===");
      console.log(JSON.stringify(rawData, null, 2));
      if (rawData.choices && rawData.choices[0] && rawData.choices[0].message) {
        console.log("=== PERPLEXITY MESSAGE CONTENT ===");
        console.log(rawData.choices[0].message.content);
      }
      
      // Clean the response data
      const data = cleanResponse(rawData);
      
      // Add metadata
      const apiResponseTime = Date.now() - startTime;
      const responseWithMetadata = {
        ...data,
        metadata: {
          category: product.category || 'General',
          responseTime: `${apiResponseTime}ms`,
          tokenCount: data.usage ? data.usage.total_tokens : 'unknown'
        }
      };
      
      // Convert Perplexity response to our recommendations format
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        const content = data.choices[0].message.content;
        console.log("Perplexity response content:", content);
        
        // Parse recommendations from the content
        const recommendations = parseRecommendationsFromContent(content, product);
        
        // Format response for the extension
        const formattedResponse = {
          recommendations: recommendations,
          source: "Perplexity API",
          timestamp: new Date().toISOString(),
          usingMockData: false,
          metadata: responseWithMetadata.metadata,
          usage: data.usage
        };
        
        // Cache the formatted response
        const cacheTTL = getCacheTTL(product.category);
        await cache.set(cacheKey, formattedResponse, cacheTTL);
        
        return res.status(200).json(formattedResponse);
      }
      
      // If we couldn't parse recommendations, cache the raw response
      const cacheTTL = getCacheTTL(product.category);
      await cache.set(cacheKey, responseWithMetadata, cacheTTL);
      
      console.log(`API call completed in ${apiResponseTime}ms with ${responseWithMetadata.metadata.tokenCount} tokens`);
      
      // Return the successful response
      return res.status(200).json(responseWithMetadata);
    } catch (fetchError) {
      console.log(`Fetch error: ${fetchError.message}`);
      
      // Use mock data as fallback when Perplexity API fails
      console.log("Falling back to mock recommendations data");
      const fallbackData = getFallbackRecommendations(product);
      
      return res.status(200).json({
        ...fallbackData,
        error: 'Failed to communicate with AI service, using fallback data',
        originalError: fetchError.message
      });
    }
  } catch (error) {
    console.log(`Error processing request: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
};

// Simple API endpoint for Amazon Smart Recommendations (mock data fallback)
const recommendationsData = require('../data/recommendations');

// Mock data handler - only used as a fallback if Perplexity fails
const getFallbackRecommendations = (productData) => {
  // Determine which recommendations to return based on category
  const category = (productData.category && productData.category.toLowerCase()) || 'default';
  const recommendations = recommendationsData[category] || recommendationsData.default;
  
  // Build response with source information
  return {
    recommendations: recommendations,
    source: "Amazon Smart Recommendations API (Fallback)",
    timestamp: new Date().toISOString(),
    usingMockData: true
  };
};

// Function to parse recommendations from Perplexity content
function parseRecommendationsFromContent(content, product) {
  try {
    // Default placeholder values
    const defaultImage = "https://via.placeholder.com/150";
    const defaultPrice = product.price || '0.00';
    
    // Initialize recommendations array
    const recommendations = [];
    
    // Handle paragraph-based format
    const paragraphs = content.split(/\n\n+/);
    
    // Try to find sections for each recommendation type
    const recommendationTypes = [
      { label: "Premium Alternative", search: /premium|better|higher|quality/i },
      { label: "Better Value", search: /value|budget|cheaper|affordable|cost/i },
      { label: "Most Popular", search: /popular|rated|best.?selling|customer|review/i }
    ];
    
    // Process each paragraph to find recommendations
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Skip short paragraphs
      if (paragraph.length < 15) continue;
      
      // Find which recommendation type this paragraph matches
      const matchedType = recommendationTypes.find(type => 
        type.search.test(paragraph)
      );
      
      if (!matchedType) continue;
      
      // Try to extract product details
      let title = extractProductTitle(paragraph);
      let price = extractPrice(paragraph) || defaultPrice;
      let reason = extractReason(paragraph);
      
      // Parse brand from title if possible
      let brand = null;
      if (title && title.includes(' ')) {
        // Take first word as potential brand
        brand = title.split(' ')[0];
      }
      
      // Only add if we found a title
      if (title) {
        // Create search query for potential affiliate link
        const searchQuery = encodeURIComponent(title);
        const affiliateTag = 'smartrecs-20'; // Example affiliate tag
        
        // Structure for a potential Amazon affiliate link
        const affiliateLink = `https://www.amazon.com/s?k=${searchQuery}&tag=${affiliateTag}`;
        
        recommendations.push({
          title: title,
          price: price,
          reason: reason || `${matchedType.label} for this product category`,
          rating: "4.5",
          reviewCount: "100+ reviews",
          imageUrl: defaultImage,
          type: matchedType.label,
          brand: brand,
          affiliateLink: affiliateLink
        });
      }
    }
    
    // If we haven't found 3 recommendations, look for list-based format
    if (recommendations.length < 3) {
      const listItems = content.match(/\d+\.\s+[^\n]+/g) || [];
      
      for (let i = 0; i < listItems.length && recommendations.length < 3; i++) {
        const item = listItems[i];
        
        // Try to extract product details
        let title = extractProductTitle(item);
        let price = extractPrice(content) || defaultPrice;
        let reason = extractReason(content);
        
        // Determine type based on index or content
        const type = recommendationTypes[i % recommendationTypes.length].label;
        
        // Parse brand from title if possible
        let brand = null;
        if (title && title.includes(' ')) {
          brand = title.split(' ')[0];
        }
        
        if (title) {
          // Create search query for potential affiliate link
          const searchQuery = encodeURIComponent(title);
          const affiliateTag = 'smartrecs-20'; // Example affiliate tag
          
          // Structure for a potential Amazon affiliate link
          const affiliateLink = `https://www.amazon.com/s?k=${searchQuery}&tag=${affiliateTag}`;
          
          recommendations.push({
            title: title,
            price: price,
            reason: reason || `${type} for this product category`,
            rating: "4.5",
            reviewCount: "100+ reviews",
            imageUrl: defaultImage,
            type: type,
            brand: brand,
            affiliateLink: affiliateLink
          });
        }
      }
    }
    
    return recommendations;
  } catch (error) {
    console.error("Error parsing recommendations:", error);
    return [];
  }
}

// Helper function to extract product title
function extractProductTitle(text) {
  // Look for the bolded pattern from our new output format
  const boldPatterns = [
    /\*\*Better Value Alternative:\*\*\s*(.*?)\s*-\s*\$/i,
    /\*\*Premium Alternative:\*\*\s*(.*?)\s*-\s*\$/i, 
    /\*\*Most Popular Alternative:\*\*\s*(.*?)\s*-\s*\$/i,
    /\*\*(.*?)\*\*\s*-\s*\$/i, // Generic bold pattern followed by price
    /\*\*(.*?):\*\*\s*(.*?)\s*-\s*\$/i // Bold category followed by product name and price
  ];
  
  // Check for bold format patterns first
  for (const pattern of boldPatterns) {
    const match = text.match(pattern);
    if (match) {
      // If pattern includes the category label, use the second capture group (product name)
      const title = match[2] || match[1];
      if (title && title.trim().length > 3) {
        console.log("Extracted title from bold format:", title.trim());
        return title.trim();
      }
    }
  }
  
  // First, try to find a complete product name with price pattern (fallback to previous patterns)
  const fullProductPatterns = [
    /\d+\.\s*(.*?)(?:\s*-\s*\$|\s*:\s*\$|\s*\(\$|\s+\$)/i,
    /Better Value Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i,
    /Premium Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i,
    /Most Popular Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i,
    /Popular Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i
  ];
  
  for (const pattern of fullProductPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      const title = match[1].trim();
      console.log("Extracted full product title:", title);
      return title;
    }
  }
  
  // Fallback to more general patterns if specific ones don't match
  const patterns = [
    /\d+\.\s*([^:]+):/,
    /^([^:,]+):/m,
    /^(.+?)\s*\(/m,
    /^(.+?)\s*-/m,
    /^(.+?)\s*\$/m
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      const title = match[1].trim();
      console.log("Extracted product title (fallback):", title);
      return title;
    }
  }
  
  // If no patterns matched, take the first sentence if it's not too long
  const firstSentence = text.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 3 && firstSentence.length < 100) {
    console.log("Using first sentence as title:", firstSentence.trim());
    return firstSentence.trim();
  }
  
  console.log("Could not extract title from text:", text.substring(0, 100) + "...");
  return null;
}

// Helper function to extract price
function extractPrice(text) {
  // Look for price patterns
  const priceMatch = text.match(/\$\s*(\d+(\.\d{1,2})?)/);
  if (priceMatch) {
    return priceMatch[1];
  }
  return null;
}

// Helper function to extract reason
function extractReason(text) {
  // Look for reason patterns based on the new format
  const reasonPatterns = [
    /\* Why it's better:\s*([^.]+)/i,
    /\* Why it's better:\s*(.*?)(?=\n|$)/i,
    /Why it's better:\s*([^.]+)/i,
    /Why it's better:\s*(.*?)(?=\n|$)/i,
    /key features?:\s*([^.]+)/i,
    /benefits?:\s*([^.]+)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // If no specific reason found, use the last sentence
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  if (sentences.length > 1) {
    return sentences[sentences.length - 1].trim();
  }
  
  return null;
}

// DO NOT OVERRIDE THE MAIN EXPORT - this was the problem!
// module.exports = recommendationsHandler; 