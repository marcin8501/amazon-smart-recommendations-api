// Amazon Smart Recommendations API - Vercel Serverless Function
// This function acts as a proxy to the Perplexity API for security reasons

const fetch = require('node-fetch');

// CORS headers for allowing cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Main function handler
module.exports = async (req, res) => {
  // Set CORS headers for all responses
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST requests for the API
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    // Get the product data from the request body
    const { product, apiKey: clientApiKey } = req.body;

    // Validate request body
    if (!product || !product.title) {
      return res.status(400).json({ 
        error: 'Invalid request. Product data with at least a title is required.' 
      });
    }

    // Get API key from environment variable, client request, or use a default for testing
    // IMPORTANT: Replace this with your actual API key or use env variables in production
    const apiKey = process.env.PERPLEXITY_API_KEY || clientApiKey || 'YOUR_PERPLEXITY_API_KEY_HERE';
    
    if (apiKey === 'YOUR_PERPLEXITY_API_KEY_HERE') {
      console.warn('Using placeholder API key. Replace with your actual Perplexity API key.');
    }

    // Prepare the request to Perplexity API
    const requestBody = {
      model: "sonar-reasoning",
      messages: [
        { 
          role: "system", 
          content: `You are a specialized Amazon product recommendation assistant. Your task is to recommend 3 alternative products to the one being viewed, each with distinct advantages:
          1. Better Value Alternative: A product with similar features but better price-to-quality ratio
          2. Premium Option: A higher-quality alternative with enhanced features
          3. Popular Choice: The most highly-rated or bestselling alternative in this category
          
          For each recommendation, provide:
          - A descriptive title (max 50 chars)
          - Estimated price (if unknown, make a reasonable estimate)
          - A brief explanation of why it's better (1-2 sentences)
          - What specific features or aspects make it worth considering` 
        },
        { 
          role: "user", 
          content: `I'm looking at this product on Amazon:
          
          Title: ${product.title || 'Unknown product'}
          Price: $${product.price || 'Unknown'}
          Category: ${product.category || "General"}
          ASIN: ${product.asin || "Unknown"}
          
          Please recommend 3 alternative products that shoppers might prefer, following your instructions. Focus on factual information and balanced comparisons.`
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
      top_p: 0.9
    };

    // Make the request to Perplexity API
    console.log('Calling Perplexity API...');
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Check for Perplexity API errors
    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      return res.status(perplexityResponse.status).json({ 
        error: `Error from AI service: ${perplexityResponse.status}`, 
        details: errorText 
      });
    }

    // Get the response data
    const data = await perplexityResponse.json();
    
    // Return the successful response
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}; 