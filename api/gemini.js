// Amazon Smart Recommendations API - Google Gemini Integration
// This serverless function processes product data and returns AI-powered recommendations

const fetch = require('node-fetch');
const { Redis } = require('@upstash/redis');

// Initialize Redis client with Upstash environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// In-memory cache with size limits
const memCache = {
  data: {},
  maxItems: 100,
  
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

// Hybrid cache helper (memory + Redis)
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
        memCache.set(key, parsedValue, 480); // 8 minutes in memory
        
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
    memCache.set(key, value, 480);
    
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
  timeoutMs: 12000, // 12 second timeout
  maxRetries: 2, // Number of retry attempts
  retryDelayMs: 300, // Milliseconds between retries
  maxOutputTokens: 800, // Maximum output tokens
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

// Retry wrapper for API calls
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

// Create a prompt based on product data for Google Gemini
const createGeminiPrompt = (product) => {
  // Get category
  const category = product.category || 'General';
  
  // Create a detailed prompt with examples and formatting instructions
  const prompt = `You are a knowledgeable expert on consumer products. For the given product, you must recommend 3 REAL, SPECIFIC alternative products that can be purchased on Amazon RIGHT NOW.

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

Product: ${product.title || 'Unknown'}
Price: ${product.price || 'Unknown'}
Brand: ${product.brand || 'Unknown'}
Category: ${category}

Task: Recommend 3 real product alternatives for the product above that are currently sold on Amazon.

Output 3 REAL PRODUCT alternatives with their EXACT names as they appear on Amazon (not generic descriptions). Include brand names, model numbers, prices, and specific reasons why each is a good alternative. Format exactly as shown in the example above.

Your recommendations MUST follow this exact format with specific product names, not generic descriptions. Users will search for these exact product names on Amazon.`;

  return prompt;
};

// Call Gemini API
const callGeminiAPI = async (prompt, apiKey) => {
  if (!apiKey) {
    throw new Error('Google API key is missing');
  }

  // Gemini 1.5 Flash model 
  const model = "models/gemini-1.5-flash";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: CONFIG.maxOutputTokens,
      topP: 0.85
    }
  };

  console.log('Calling Google Gemini API with parameters:', {
    model,
    temperature: 0.1,
    maxOutputTokens: CONFIG.maxOutputTokens,
    promptLength: prompt.length
  });
  
  try {
    const response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      timeout: CONFIG.timeoutMs
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      throw new Error(`Error from Gemini API: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log("=== GEMINI RAW RESPONSE ===");
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
};

// Parse recommendations from Gemini content
function parseRecommendationsFromGemini(data, product) {
  try {
    if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Gemini API response structure');
      return [];
    }
    
    const content = data.candidates[0].content.parts[0].text;
    console.log("=== GEMINI CONTENT ===");
    console.log(content);
    
    // Default placeholder values
    const defaultImage = "https://via.placeholder.com/150";
    const defaultPrice = product.price || '0.00';
    
    // Initialize recommendations array
    const recommendations = [];
    
    // Split by double newlines to get paragraphs
    const paragraphs = content.split(/\n\n+/);
    
    // Define patterns to look for different recommendation types
    const recommendationTypes = [
      { label: "Premium Alternative", search: /premium|better|higher|quality/i },
      { label: "Better Value", search: /value|budget|cheaper|affordable|cost/i },
      { label: "Most Popular", search: /popular|rated|best.?selling|customer|review/i }
    ];
    
    // Process each paragraph
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Skip short paragraphs
      if (paragraph.length < 15) continue;
      
      // Find which recommendation type this paragraph matches
      const matchedType = recommendationTypes.find(type => 
        type.search.test(paragraph)
      );
      
      if (!matchedType) continue;
      
      // Extract product details
      let title = extractProductTitle(paragraph);
      let price = extractPrice(paragraph) || defaultPrice;
      let reason = extractReason(paragraph);
      
      // Parse brand from title if possible
      let brand = null;
      if (title && title.includes(' ')) {
        brand = title.split(' ')[0];
      }
      
      // Only add if we found a title
      if (title) {
        // Create search query for affiliate link
        const searchQuery = encodeURIComponent(title);
        const affiliateTag = 'smartrecs-20'; // Affiliate tag
        
        // Structure for Amazon affiliate link
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
    
    // If we didn't find enough recommendations, look for list-based format
    if (recommendations.length < 3) {
      const listItems = content.match(/\*\*[^*]+\*\*/g) || [];
      
      for (let i = 0; i < listItems.length && recommendations.length < 3; i++) {
        const item = listItems[i];
        
        // Find the paragraph containing this list item
        const relevantParagraph = paragraphs.find(p => p.includes(item)) || item;
        
        // Try to extract product details
        let title = extractProductTitle(relevantParagraph);
        let price = extractPrice(relevantParagraph) || defaultPrice;
        let reason = extractReason(relevantParagraph);
        
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
          const affiliateTag = 'smartrecs-20'; // Affiliate tag
          
          // Structure for Amazon affiliate link
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
  // Look for the bolded pattern from our output format
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
  
  // Try more general patterns if specific ones don't match
  const fullProductPatterns = [
    /\d+\.\s*(.*?)(?:\s*-\s*\$|\s*:\s*\$|\s*\(\$|\s+\$)/i,
    /Better Value Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i,
    /Premium Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i,
    /Most Popular Alternative:\s*(.*?)(?:\s*-\s*\$|\s+\$)/i
  ];
  
  for (const pattern of fullProductPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      const title = match[1].trim();
      console.log("Extracted full product title:", title);
      return title;
    }
  }
  
  // Fallback to simpler patterns
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
  // Look for reason patterns based on our format
  const reasonPatterns = [
    /\* Why it's better:\s*([^.]+)/i,
    /\* Why it's better:\s*(.*?)(?=\n|$)/i,
    /Why it's better:\s*([^.]+)/i,
    /Why it's better:\s*(.*?)(?=\n|$)/i,
    /key features:\s*([^.]+)/i,
    /benefits:\s*([^.]+)/i
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

// CORS headers helper function
const setCorsHeaders = (res) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return res;
};

// Main handler function
module.exports = async (req, res) => {
  const startTime = Date.now();
  
  // Set CORS headers for all responses
  setCorsHeaders(res);

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST requests
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
    apiKey = process.env.GOOGLE_API_KEY || apiKey;
    
    if (!apiKey) {
      console.log('Google API key not configured');
      return res.status(400).json({ 
        error: 'Google API key is required'
      });
    }

    // Create product-specific prompt
    const prompt = createGeminiPrompt(product);
    
    // Call Gemini API
    try {
      const geminiResponse = await callGeminiAPI(prompt, apiKey);
      
      // API response time
      const apiResponseTime = Date.now() - startTime;
      
      // Parse the recommendations from Gemini content
      const recommendations = parseRecommendationsFromGemini(geminiResponse, product);
      
      // Format response for the extension
      const formattedResponse = {
        recommendations: recommendations,
        source: "Google Gemini API",
        timestamp: new Date().toISOString(),
        usingMockData: false,
        metadata: {
          category: product.category || 'General',
          responseTime: `${apiResponseTime}ms`,
          modelName: "gemini-1.5-flash"
        }
      };
      
      // Cache the formatted response
      const cacheTTL = getCacheTTL(product.category);
      await cache.set(cacheKey, formattedResponse, cacheTTL);
      
      return res.status(200).json(formattedResponse);
    } catch (apiError) {
      console.log(`Gemini API error: ${apiError.message}`);
      
      // Use mock data as fallback when Google API fails
      console.log("Falling back to mock recommendations data");
      const fallbackData = require('../data/recommendations');
      
      // Determine which recommendations to return based on category
      const category = (product.category && product.category.toLowerCase()) || 'default';
      const recommendations = fallbackData[category] || fallbackData.default;
      
      // Format fallback response
      const fallbackResponse = {
        recommendations: recommendations,
        source: "Amazon Smart Recommendations API (Fallback)",
        timestamp: new Date().toISOString(),
        usingMockData: true,
        error: 'Failed to communicate with Google Gemini API, using fallback data',
        originalError: apiError.message
      };
      
      return res.status(200).json(fallbackResponse);
    }
  } catch (error) {
    console.log(`Error processing request: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}; 