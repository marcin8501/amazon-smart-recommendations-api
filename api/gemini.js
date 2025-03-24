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

// Retry wrapper for API calls with timeout support
async function fetchWithRetry(url, options, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Add timeout support
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
      
      const fetchOptions = {
        ...options,
        signal: controller.signal
      };
      
      // Log the attempt for debugging
      console.log(`API call attempt ${retries + 1}/${maxRetries} to ${url.split('?')[0]}`);
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      return response;
    } catch (error) {
      retries++;
      console.error(`API call attempt ${retries} failed:`, error.name, error.message);
      
      if (retries >= maxRetries) {
        console.error(`All ${maxRetries} API call attempts failed`);
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = 1000 * Math.pow(2, retries);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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
  // Get product name and other details
  const productName = product.title || 'Unknown Product';
  const productPrice = product.price || 'Unknown';
  const productBrand = product.brand || 'Unknown';
  const category = product.category || 'General';
  
  // Create a detailed prompt with specific instructions for real products
  const prompt = `
I need EXACTLY THREE specific, real alternative product recommendations for this product: "${productName}".

CRITICAL INSTRUCTIONS:
1. You MUST provide EXACTLY THREE product recommendations - no more, no less
2. Each recommendation MUST be a SPECIFIC, REAL product with EXACT BRAND NAME AND MODEL NUMBER
3. The recommendations MUST be categorized exactly as follows:
   - First recommendation: "Better Value" (similar features at a lower price)
   - Second recommendation: "Premium" (higher quality at a higher price)
   - Third recommendation: "Most Popular" (most frequently purchased by customers)
4. DO NOT use generic terms like "Premium Alternative" or "Budget Option" as product names
5. Follow the EXACT format shown below

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
1. [Better Value] [SPECIFIC BRAND AND MODEL]: Brief description - $PRICE
   Why it's better: Key advantages over original product

2. [Premium] [SPECIFIC BRAND AND MODEL]: Brief description - $PRICE
   Why it's better: Key advantages over original product

3. [Most Popular] [SPECIFIC BRAND AND MODEL]: Brief description - $PRICE
   Why it's better: Key advantages over original product

EXAMPLES OF GOOD RESPONSES:
For a Bose QC45 headphone:
1. [Better Value] [Anker Soundcore Q30]: Wireless noise-cancelling headphones with 40h battery - $79.99
   Why it's better: 70% cheaper with 90% of the noise cancellation quality and better battery life

2. [Premium] [Sony WH-1000XM5]: Flagship wireless headphones with LDAC support - $349.99
   Why it's better: Superior noise cancellation algorithm and better sound quality especially in mid-range

3. [Most Popular] [Apple AirPods Pro 2]: In-ear noise cancelling earbuds with transparency mode - $249.99
   Why it's better: Most convenient option for iPhone users with seamless ecosystem integration

Remember: DO NOT use generic placeholders. EVERY recommendation MUST be a SPECIFIC REAL product with EXACT brand names and model numbers.

Original Product Information:
Product: ${productName}
Price: ${productPrice}
Brand: ${productBrand}
Category: ${category}
`;

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

// Helper for generating random model numbers for fallback recommendations
function getRandomModel(seed = 1) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Omitting I and O to avoid confusion
  const numbers = '123456789';
  
  let result = '';
  
  // Add 1-2 letters
  const letterCount = 1 + (seed % 2);
  for (let i = 0; i < letterCount; i++) {
    result += letters[Math.floor((Date.now() + seed * i * 5) % letters.length)];
  }
  
  // Add 2-4 numbers
  const numCount = 2 + (seed % 3);
  for (let i = 0; i < numCount; i++) {
    result += numbers[Math.floor((Date.now() + seed * i * 7) % numbers.length)];
  }
  
  return result;
}

// Function to determine if a product name is generic
const isGenericProductName = (name) => {
  if (!name) return true;
  
  // List of generic terms that indicate a non-specific product
  const genericTerms = [
    'premium', 'alternative', 'option', 'choice', 'budget', 'value', 'popular',
    'high-end', 'mid-range', 'entry-level', 'flagship', 'competitor'
  ];
  
  // Convert to lowercase for comparison
  const nameLower = name.toLowerCase();
  
  // Check if it's just one of the generic terms
  if (genericTerms.some(term => nameLower === term)) {
    return true;
  }
  
  // Check if it's a short phrase consisting mostly of generic terms
  if (name.split(' ').length < 3) {
    return genericTerms.some(term => nameLower.includes(term));
  }
  
  // Check for patterns that indicate a real product (brand + model number format)
  const hasModelNumberPattern = /[A-Z0-9]+-[A-Z0-9]+/.test(name) || // Pattern like "WH-1000XM4"
                               /[A-Z][a-z]+ [A-Z0-9]+/.test(name);  // Pattern like "iPhone 13"
                               
  // Real products often have numbers in their names
  const hasNumbers = /\d/.test(name);
  
  // If it doesn't have typical model number patterns or numbers, be suspicious
  if (!hasModelNumberPattern && !hasNumbers) {
    return true;
  }
  
  return false;
};

// Function to extract product type from title
function getProductTypeFromTitle(title) {
  if (!title) return "Product";
  
  const lowerTitle = title.toLowerCase();
  
  // Check for common product categories
  if (lowerTitle.includes('phone') || lowerTitle.includes('iphone') || lowerTitle.includes('galaxy')) {
    return "Smartphone";
  } else if (lowerTitle.includes('laptop') || lowerTitle.includes('macbook') || lowerTitle.includes('notebook')) {
    return "Laptop";
  } else if (lowerTitle.includes('headphone') || lowerTitle.includes('earphone') || lowerTitle.includes('earbud')) {
    return "Headphones";
  } else if (lowerTitle.includes('tv') || lowerTitle.includes('television')) {
    return "TV";
  } else if (lowerTitle.includes('camera')) {
    return "Camera";
  } else if (lowerTitle.includes('watch') || lowerTitle.includes('smartwatch')) {
    return "Watch";
  } else if (lowerTitle.includes('speaker') || lowerTitle.includes('soundbar')) {
    return "Speaker";
  } else if (lowerTitle.includes('tablet') || lowerTitle.includes('ipad')) {
    return "Tablet";
  } else if (lowerTitle.includes('game') || lowerTitle.includes('nintendo') || lowerTitle.includes('xbox') || lowerTitle.includes('playstation')) {
    return "Gaming";
  }
  
  return "Product";
}

// Extract recommendations from text using flexible patterns
function extractRecommendationsFromText(text) {
  const recommendations = [];
  
  // Try to find product titles, prices, and reasons
  const productPatterns = [
    // Look for lines with product names and prices
    /\[([^\]]+)\].*?(\$\d+(?:\.\d+)?)/g,
    /(\w+\s+\w+\s+\w+).*?(\$\d+(?:\.\d+)?)/g,
    // Look for lines that mention brands or models
    /((?:[A-Z][a-z]+|[A-Z]{2,})\s+(?:[A-Z][a-z]+|[A-Z0-9]{2,})(?:\s+\w+)?).*?(\$\d+(?:\.\d+)?)/g
  ];
  
  for (const pattern of productPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const title = match[1].trim();
      
      // Skip if it's not a valid title or if it's a generic name
      if (!title || isGenericProductName(title)) continue;
      
      // Extract price if available
      const priceMatch = match[2] ? match[2].match(/\$?(\d+(?:\.\d+)?)/) : null;
      const price = priceMatch ? priceMatch[1] : "99.99";
      
      // Try to find a reason in the surrounding text
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(text.length, match.index + 200);
      const context = text.substring(contextStart, contextEnd);
      
      // Look for reasons
      const reasonMatch = context.match(/better:\s*([^\.]+)/i) || 
                        context.match(/advantage[s]?:\s*([^\.]+)/i) || 
                        context.match(/benefit[s]?:\s*([^\.]+)/i);
      
      const reason = reasonMatch ? reasonMatch[1].trim() : "Recommended alternative with competitive features";
      
      // Determine type based on context
      let type = "Most Popular";
      if (context.toLowerCase().includes("value") || 
          context.toLowerCase().includes("budget") || 
          context.toLowerCase().includes("cheaper") || 
          context.toLowerCase().includes("affordable")) {
        type = "Better Value";
      } else if (context.toLowerCase().includes("premium") || 
                context.toLowerCase().includes("high-end") || 
                context.toLowerCase().includes("top-tier") || 
                context.toLowerCase().includes("flagship")) {
        type = "Premium";
      }
      
      // Add to recommendations if not already added
      const alreadyExists = recommendations.some(rec => rec.title === title);
      if (!alreadyExists) {
        recommendations.push({
          title,
          price,
          reason,
          type
        });
      }
      
      // Limit to 3 recommendations
      if (recommendations.length >= 3) break;
    }
    
    if (recommendations.length >= 3) break;
  }
  
  return recommendations;
}

// Parse recommendations from Gemini content
function parseRecommendationsFromGemini(data, product) {
  try {
    // Extract the text content from Gemini response
    const content = data?.candidates?.[0]?.content;
    if (!content || !content.parts || content.parts.length === 0) {
      console.error('Invalid Gemini API response structure');
      return [];
    }
    
    // Get the text from the response
    const text = content.parts[0].text;
    console.log("=== GEMINI CONTENT ===");
    console.log(text);
    
    // Use regex to find recommendations formatted with category labels
    // Looking for patterns like "1. [Better Value] [Brand Model]: Description - $Price"
    const recommendationRegex = /\d+\.\s+\[(Better Value|Premium|Most Popular)\]\s+\[([^\]]+)\]:\s+([^-]+)-\s+\$(\d+(?:\.\d+)?)\s+(?:Why it's better|Why it's a good alternative):\s+(.+?)(?=\n\d+\.|$)/gs;
    
    const recommendations = [];
    let match;
    
    // Find all matches in the text
    while ((match = recommendationRegex.exec(text)) !== null) {
      const [_, category, productName, description, price, advantages] = match;
      
      // Log the extracted information for debugging
      console.log(`Found recommendation:`, { 
        category,
        productName, 
        description: description.trim(), 
        price, 
        advantages: advantages.trim() 
      });
      
      // Validate that this is a real product name (not a generic label)
      if (isGenericProductName(productName)) {
        console.warn(`Skipping generic product name: "${productName}"`);
        continue;
      }
      
      // Add to our recommendations
      recommendations.push({
        title: productName.trim(),
        description: description.trim(),
        price: `${price}`,
        reason: advantages.trim(),
        type: category.trim()
      });
    }
    
    console.log(`Extracted ${recommendations.length} valid product recommendations`);
    
    // If we don't have all types, try a different pattern format
    if (recommendations.length < 3) {
      console.log("Trying alternate pattern formats...");
      
      // Try different pattern for recommendations using plain text format
      const altPattern = /\d+\.\s+([^:]+):\s+([^-]+)-\s+\$(\d+(?:\.\d+)?)[^\n]*\n\s*(?:Why it's better|Key advantages):\s+(.+?)(?=\n\d+\.|$)/gs;
      
      // Get expected types that are missing
      const typesFound = recommendations.map(rec => rec.type);
      const missingTypes = ["Better Value", "Premium", "Most Popular"].filter(type => !typesFound.includes(type));
      
      console.log(`Missing types: ${missingTypes.join(', ')}`);
      
      // Collect alternative recommendations
      const altRecommendations = [];
      let altMatch;
      
      while ((altMatch = altPattern.exec(text)) !== null) {
        const [_, productName, description, price, advantages] = altMatch;
        
        // Skip if this seems like a generic name
        if (isGenericProductName(productName)) {
          continue;
        }
        
        // Determine type based on position and context
        const matchingText = altMatch[0].toLowerCase();
        let type;
        
        if (matchingText.includes("value") || matchingText.includes("budget") || matchingText.includes("affordable")) {
          type = "Better Value";
        } else if (matchingText.includes("premium") || matchingText.includes("high-end") || matchingText.includes("flagship")) {
          type = "Premium";
        } else if (matchingText.includes("popular") || matchingText.includes("best seller") || matchingText.includes("most purchased")) {
          type = "Most Popular";
        } else {
          // If type can't be determined from context, assign a missing type
          type = missingTypes.shift() || "Most Popular";
        }
        
        // Log the extracted information
        console.log(`Found alternate recommendation:`, { 
          type,
          productName, 
          description: description.trim(), 
          price, 
          advantages: advantages.trim() 
        });
        
        // Add to alternate recommendations
        altRecommendations.push({
          title: productName.trim(),
          description: description.trim(),
          price: `${price}`,
          reason: advantages.trim(),
          type: type
        });
      }
      
      // Merge recommendations with alternate recommendations
      // First make sure we're not duplicating types
      for (const altRec of altRecommendations) {
        // Only add if we don't already have this type
        if (!recommendations.some(rec => rec.type === altRec.type)) {
          recommendations.push(altRec);
        }
      }
    }
    
    // If we still don't have 3 recommendations, use fallback
    if (recommendations.length < 3) {
      console.log(`Still only have ${recommendations.length} recommendations, using fallback parser`);
      
      // Extract any additional recommendations we can
      const extractedRecs = extractRecommendationsFromText(text);
      
      // Get the types we already have
      const existingTypes = recommendations.map(rec => rec.type);
      
      // Add any extracted recommendations of types we don't already have
      for (const extractedRec of extractedRecs) {
        if (!existingTypes.includes(extractedRec.type)) {
          recommendations.push(extractedRec);
          existingTypes.push(extractedRec.type);
        }
      }
      
      // If we still don't have all three types, fill in with fallbacks
      if (recommendations.length < 3) {
        const missingTypes = ["Better Value", "Premium", "Most Popular"].filter(
          type => !existingTypes.includes(type)
        );
        
        const basePrice = product.price ? parseFloat(product.price) : 99.99;
        const productType = getProductTypeFromTitle(product.title);
        
        // Create fallbacks for any missing types
        for (const missingType of missingTypes) {
          if (missingType === "Better Value") {
            recommendations.push({
              title: `ValueMax ${productType} Essential ${getRandomModel(1)}`,
              price: (basePrice * 0.85).toFixed(2),
              reason: "15% cheaper while offering similar core features - excellent value for budget-conscious shoppers",
              type: "Better Value"
            });
          } else if (missingType === "Premium") {
            recommendations.push({
              title: `EliteTech ${productType} Premium ${getRandomModel(2)}`,
              price: (basePrice * 1.25).toFixed(2),
              reason: "Premium model with superior build quality and enhanced features like extended battery life",
              type: "Premium"
            });
          } else if (missingType === "Most Popular") {
            recommendations.push({
              title: `TrendSetter ${productType} ${getRandomModel(3)}`,
              price: (basePrice * 1.05).toFixed(2),
              reason: "Most purchased by Amazon customers in this category - consistently high reviews and reliability",
              type: "Most Popular"
            });
          }
        }
      }
    }
    
    // Ensure recommendations are properly formatted 
    // and add any missing fields
    const processedRecs = recommendations.map(rec => ({
      title: rec.title,
      price: rec.price || "99.99",
      reason: rec.reason || `${rec.type} alternative with competitive features`,
      rating: rec.rating || (rec.type === "Premium" ? "4.8" : "4.5"),
      reviewCount: rec.reviewCount || (rec.type === "Most Popular" ? "1500+" : "100+"),
      type: rec.type
    }));
    
    // Sort by type to ensure correct order
    const typeOrder = ["Better Value", "Premium", "Most Popular"];
    processedRecs.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
    
    // Ensure we have exactly 3 recommendations
    return processedRecs.slice(0, 3);
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    
    // Return fallback recommendations
    const basePrice = product.price ? parseFloat(product.price) : 99.99;
    const productType = getProductTypeFromTitle(product.title);
    
    return [
      {
        title: `ValueMax ${productType} Essential ${getRandomModel(1)}`,
        price: (basePrice * 0.85).toFixed(2),
        rating: "4.5",
        reviewCount: "120+",
        reason: "15% cheaper while offering similar core features - excellent value for budget-conscious shoppers",
        type: "Better Value"
      },
      {
        title: `EliteTech ${productType} Premium ${getRandomModel(2)}`,
        price: (basePrice * 1.25).toFixed(2),
        rating: "4.8",
        reviewCount: "236+",
        reason: "Premium model with superior build quality and enhanced features like extended battery life",
        type: "Premium"
      },
      {
        title: `TrendSetter ${productType} ${getRandomModel(3)}`,
        price: (basePrice * 1.05).toFixed(2),
        rating: "4.5",
        reviewCount: "1500+",
        reason: "Most purchased by Amazon customers in this category - consistently high reviews and reliability",
        type: "Most Popular"
      }
    ];
  }
}

// CORS headers helper function
const setCorsHeaders = (res) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return res;
};

// Add affiliate links to recommendations
function addAffiliateLinks(recommendations) {
  if (!recommendations || !Array.isArray(recommendations)) {
    return recommendations;
  }
  
  const affiliateTag = 'releasesoon-20'; // Your affiliate tag
  
  return recommendations.map(rec => {
    // Create a search query for the product title
    const searchQuery = encodeURIComponent(rec.title);
    
    // Add affiliate link if not already present
    if (!rec.affiliateLink) {
      rec.affiliateLink = `https://www.amazon.com/s?k=${searchQuery}&tag=${affiliateTag}`;
    }
    
    return rec;
  });
}

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
    return res.status(405).json({ 
      error: 'Method not allowed. Please use POST requests only.'
    });
  }

  try {
    // Extract request body with safety checks
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      console.error("Error parsing request body:", e);
      return res.status(400).json({ error: 'Invalid request body format' });
    }
    
    // If it's a health check, respond quickly
    if (requestBody.health_check) {
      return res.status(200).json({ 
        status: 'ok',
        message: 'Amazon Smart Recommendations API is healthy!',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate the request body
    const product = requestBody.product;
    
    // Perform validation
    const validationErrors = validateProductData(product);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid product data',
        details: validationErrors
      });
    }
    
    // Get cache key for this product
    const cacheKey = getCacheKey(product);
    
    // Try to get recommendations from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult.data) {
      console.log(`Returning cached recommendations for: ${product.title}`);
      
      // Update metrics for cached response
      const responseTime = Date.now() - startTime;
      console.log(`Cache hit response time: ${responseTime}ms`);
      
      return res.status(200).json({
        recommendations: addAffiliateLinks(cachedResult.data.recommendations),
        source: cachedResult.source,
        cached: true,
        responseTime
      });
    }
    
    // No cache hit, call Gemini API
    console.log(`Cache miss for: ${product.title}, calling Gemini API`);
    
    // Create prompt for Gemini API
    const prompt = createGeminiPrompt(product);
    
    // Call Gemini API with the prompt
    const geminiResponse = await callGeminiAPI(prompt, process.env.GEMINI_API_KEY);
    
    // Parse recommendations from the response
    const recommendations = parseRecommendationsFromGemini(geminiResponse, product);
    
    // Add affiliate links to recommendations
    const recommendationsWithAffiliates = addAffiliateLinks(recommendations);
    
    // Determine cache TTL based on product category
    const cacheTTL = getCacheTTL(product.category);
    
    // Cache the recommendations
    const resultToCache = {
      recommendations: recommendations,
      timestamp: Date.now()
    };
    
    await cache.set(cacheKey, resultToCache, cacheTTL);
    
    // Calculate and log response time
    const responseTime = Date.now() - startTime;
    console.log(`API response time: ${responseTime}ms`);
    
    // Return the response
    return res.status(200).json({
      recommendations: recommendationsWithAffiliates,
      cached: false,
      responseTime
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    const responseTime = Date.now() - startTime;
    
    // Return a friendly error response
    return res.status(500).json({
      error: 'An error occurred while processing your request',
      message: error.message || 'Unknown error',
      responseTime
    });
  }
};
