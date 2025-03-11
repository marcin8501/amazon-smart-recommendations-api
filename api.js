// Simple API implementation for Amazon Smart Recommendations
// This file can be deployed to Vercel as a serverless function

// Sample recommendations data
const sampleRecommendations = {
  electronics: [
    {
      title: "Enhanced Wireless Headphones Pro",
      price: 89.99,
      rating: "4.7",
      reviewCount: "2,150",
      reason: "Superior noise cancellation with longer battery life"
    },
    {
      title: "Premium Audio Buds XL",
      price: 129.99,
      rating: "4.8",
      reviewCount: "1,832",
      reason: "Audiophile-grade sound with custom EQ options"
    },
    {
      title: "Budget-Friendly Sound Pods",
      price: 49.99,
      rating: "4.3",
      reviewCount: "3,721",
      reason: "Best value option with all essential features"
    }
  ],
  books: [
    {
      title: "The Hidden Patterns",
      price: 14.99,
      rating: "4.6",
      reviewCount: "1,245",
      reason: "Readers also purchased this bestseller in the same category"
    },
    {
      title: "Beyond the Horizon: Special Edition",
      price: 24.99,
      rating: "4.9",
      reviewCount: "867",
      reason: "Premium hardcover with exclusive bonus chapter"
    },
    {
      title: "Wisdom in Plain Words",
      price: 9.99,
      rating: "4.5",
      reviewCount: "2,381",
      reason: "More affordable option with similar themes"
    }
  ],
  default: [
    {
      title: "Premium Alternative",
      price: 0, // Will be calculated based on product price
      rating: "4.7",
      reviewCount: "1,200+",
      reason: "Higher quality materials and enhanced features"
    },
    {
      title: "Best Value Option",
      price: 0, // Will be calculated based on product price
      rating: "4.4",
      reviewCount: "2,500+",
      reason: "Similar features at a better price point"
    },
    {
      title: "Most Popular Choice",
      price: 0, // Will be calculated based on product price
      rating: "4.6",
      reviewCount: "3,000+",
      reason: "Highest rated option among similar products"
    }
  ]
};

// Function to generate recommendations
function generateRecommendations(productData) {
  // Extract product information
  const { title, price, category = "" } = productData || {};
  
  // Determine which category to use for recommendations
  let categoryKey = "default";
  
  // Simple category detection based on title keywords
  const lowerTitle = (title || "").toLowerCase();
  if (lowerTitle.includes("headphone") || 
      lowerTitle.includes("earbud") || 
      lowerTitle.includes("speaker") ||
      lowerTitle.includes("computer") ||
      lowerTitle.includes("laptop") ||
      lowerTitle.includes("phone")) {
    categoryKey = "electronics";
  } else if (lowerTitle.includes("book") || 
             lowerTitle.includes("novel") ||
             lowerTitle.includes("paperback") ||
             lowerTitle.includes("hardcover")) {
    categoryKey = "books";
  }
  
  // Get recommendations for this category
  let recommendations = JSON.parse(JSON.stringify(sampleRecommendations[categoryKey]));
  
  // Adjust prices based on the product price if available
  if (price && !isNaN(parseFloat(price))) {
    const basePrice = parseFloat(price);
    
    // Set relative prices
    if (categoryKey === "default") {
      recommendations[0].price = (basePrice * 1.25).toFixed(2); // Premium option: 25% more
      recommendations[1].price = (basePrice * 0.85).toFixed(2); // Value option: 15% less
      recommendations[2].price = (basePrice * 1.05).toFixed(2); // Popular option: 5% more
    }
    
    // Add product context to titles for default category
    if (categoryKey === "default") {
      const shortTitle = title ? title.split(' ').slice(0, 3).join(' ') : "Product";
      recommendations[0].title = `Premium Alternative to ${shortTitle}`;
      recommendations[1].title = `Best Value Alternative to ${shortTitle}`;
      recommendations[2].title = `Most Popular Alternative to ${shortTitle}`;
    }
  }
  
  return recommendations;
}

// API handler for Vercel serverless function
module.exports = (req, res) => {
  // Set CORS headers to allow access from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, X-Requested-With');
  
  // Handle OPTIONS request (preflight for CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle health check
  if (req.url.includes('/health')) {
    return res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  }
  
  // Only accept POST requests for recommendations
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }
  
  try {
    // Parse the request body
    const data = req.body;
    
    // Extract product data
    const productData = data.product || {};
    
    // Generate recommendations
    const recommendations = generateRecommendations(productData);
    
    // Return recommendations
    return res.status(200).json({
      recommendations,
      timestamp: new Date().toISOString(),
      source: 'api'
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
} 