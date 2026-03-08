const sharp = require('sharp');
const fs = require('fs');

const generateIcons = async () => {
  const sizes = [192, 512];
  
  for (const size of sizes) {
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 37, g: 99, b: 235, alpha: 1 } // Tailwind blue-600
      }
    })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
             <path d="M50 20 L20 80 L80 80 Z" fill="white" />
           </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toFile(`./public/icon-${size}x${size}.png`);
    
    console.log(`Generated icon-${size}x${size}.png`);
  }
};

generateIcons().catch(console.error);
