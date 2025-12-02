import BookingCrawler from './bookingCrawler.js';
import fs from 'fs';
import path from 'path';

/**
 * Example usage of BookingCrawler
 */

async function main() {
  // Chrome executable paths for different OS
  const chromePaths = {
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome', // or '/usr/bin/chromium-browser'
  };

  const platform = process.platform;
  const executablePath = chromePaths[platform] || null;

  console.log('='.repeat(60));
  console.log('Booking.com Hotel Crawler - Example Usage');
  console.log('='.repeat(60));
  console.log(`Platform: ${platform}`);
  console.log(`Chrome path: ${executablePath || 'Using bundled Chromium'}`);
  console.log('='.repeat(60));

  // Create crawler instance
  const crawler = new BookingCrawler({
    headless: false, // Set to true to run in background
    timeout: 60000, // 60 seconds timeout
    executablePath: executablePath, // Use local Chrome
    // userDataDir: '/path/to/chrome/profile', // Optional: use existing Chrome profile
  });

  try {
    // Example URL
    const hotelUrl = 'https://www.booking.com/hotel/vn/mekong-lodge.html';

    console.log('\n🚀 Starting crawl...\n');

    // Crawl hotel information
    const hotelData = await crawler.crawlHotel(hotelUrl);

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('CRAWL RESULTS');
    console.log('='.repeat(60));

    console.log('\n📌 Hotel Name:');
    console.log(hotelData.name || 'N/A');

    console.log('\n📍 Address:');
    console.log(hotelData.address || 'N/A');

    console.log('\n⭐ Rating:');
    console.log(JSON.stringify(hotelData.rating, null, 2));

    console.log('\n🏨 Facilities:');
    if (hotelData.facilities && hotelData.facilities.length > 0) {
      hotelData.facilities.forEach((facility, index) => {
        console.log(`  ${index + 1}. ${facility}`);
      });
    } else {
      console.log('  No facilities found');
    }

    console.log('\n❓ FAQs:');
    if (hotelData.faqs && hotelData.faqs.length > 0) {
      hotelData.faqs.forEach((faq, index) => {
        console.log(`  Q${index + 1}: ${faq.question}`);
        console.log(`  A${index + 1}: ${faq.answer}\n`);
      });
    } else {
      console.log('  No FAQs found');
    }

    console.log('\n📝 About:');
    if (hotelData.about) {
      console.log(hotelData.about.substring(0, 300) + '...');
    } else {
      console.log('  No description found');
    }

    console.log('\n🖼️  Images:');
    console.log(`  Total: ${hotelData.images ? hotelData.images.length : 0} images`);
    if (hotelData.images && hotelData.images.length > 0) {
      hotelData.images.slice(0, 5).forEach((img, index) => {
        console.log(`  ${index + 1}. ${img}`);
      });
      if (hotelData.images.length > 5) {
        console.log(`  ... and ${hotelData.images.length - 5} more`);
      }
    }

    console.log('\n' + '='.repeat(60));

    // Save to JSON file
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `hotel-data-${timestamp}.json`;
    const outputPath = path.join(outputDir, filename);

    fs.writeFileSync(outputPath, JSON.stringify(hotelData, null, 2), 'utf-8');

    console.log(`\n✅ Data saved to: ${outputPath}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Close browser
    await crawler.close();
    console.log('\n🔒 Browser closed');
  }
}

// Run the example
main().catch(console.error);
