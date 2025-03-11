const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Define icon sizes
const sizes = [16, 48, 128];

// Create placeholder icons with basic shape and color
async function createPlaceholderIcons() {
  console.log('Creating placeholder icons...');
  
  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#4f46e5'; // Indigo color
    ctx.fillRect(0, 0, size, size);
    
    // Draw a simple "R" for Recommendations
    ctx.fillStyle = '#ffffff'; // White
    ctx.font = `bold ${Math.floor(size * 0.7)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', size / 2, size / 2);
    
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(__dirname, `icons/icon${size}.png`), buffer);
    
    console.log(`Created icon${size}.png`);
  }
  
  console.log('All icons created successfully!');
}

// Run the icon creation
createPlaceholderIcons().catch(err => {
  console.error('Error creating icons:', err);
}); 