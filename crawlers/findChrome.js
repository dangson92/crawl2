import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Helper to find Chrome executable path on different systems
 */

function findChromeExecutable() {
  const platform = process.platform;
  const possiblePaths = [];

  if (platform === 'win32') {
    // Windows
    possiblePaths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
    );
  } else if (platform === 'darwin') {
    // macOS
    possiblePaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(process.env.HOME || '', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    );
  } else if (platform === 'linux') {
    // Linux
    possiblePaths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      '/usr/local/bin/chrome'
    );

    // Try to find using which command
    try {
      const whichChrome = execSync('which google-chrome || which chromium-browser || which chromium', {
        encoding: 'utf8'
      }).trim();
      if (whichChrome) {
        possiblePaths.unshift(whichChrome);
      }
    } catch (e) {
      // ignore
    }
  }

  // Check each path
  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  return null;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Searching for Chrome executable...\n');
  console.log(`Platform: ${process.platform}`);

  const chromePath = findChromeExecutable();

  if (chromePath) {
    console.log(`\n✅ Chrome found at: ${chromePath}`);
    console.log('\nYou can use this path in your crawler:');
    console.log('\nconst crawler = new BookingCrawler({');
    console.log(`  executablePath: '${chromePath}',`);
    console.log('});');
  } else {
    console.log('\n❌ Chrome not found!');
    console.log('\nPlease install Google Chrome or specify the path manually.');
    console.log('\nPossible locations checked:');

    if (process.platform === 'win32') {
      console.log('  - C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
      console.log('  - C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
    } else if (process.platform === 'darwin') {
      console.log('  - /Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    } else {
      console.log('  - /usr/bin/google-chrome');
      console.log('  - /usr/bin/chromium-browser');
    }
  }
}

export default findChromeExecutable;
