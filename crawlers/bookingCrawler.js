import puppeteer from 'puppeteer';

/**
 * Booking.com Hotel Crawler
 * Crawls hotel information from Booking.com
 */

class BookingCrawler {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Default true
      timeout: options.timeout || 30000,
      executablePath: options.executablePath || null, // Path to Chrome executable
      userDataDir: options.userDataDir || null, // Chrome user data directory
      ...options
    };
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser and page
   */
  async init() {
    const launchOptions = {
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ],
    };

    // If executablePath is provided, use local Chrome
    if (this.options.executablePath) {
      launchOptions.executablePath = this.options.executablePath;
    }

    // If userDataDir is provided, use existing Chrome profile
    if (this.options.userDataDir) {
      launchOptions.userDataDir = this.options.userDataDir;
    }

    this.browser = await puppeteer.launch(launchOptions);
    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Set user agent to avoid bot detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  /**
   * Sleep/wait helper function
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for element with timeout
   */
  async waitForElement(selector, timeout = this.options.timeout) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.log(`Element not found: ${selector}`);
      return false;
    }
  }

  /**
   * Get hotel name
   */
  async getHotelName() {
    try {
      const name = await this.page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          'h2.pp-header__title',
          'h2[data-testid="property-name"]',
          '.hp__hotel-name',
          'h2.hp-hotel-name',
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.textContent.trim();
          }
        }
        return null;
      });
      return name;
    } catch (error) {
      console.error('Error getting hotel name:', error.message);
      return null;
    }
  }

  /**
   * Get hotel address
   */
  async getAddress() {
    try {
      const address = await this.page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          '[data-testid="address"]',
          '.hp_address_subtitle',
          '.address',
          'span.hp_address_subtitle',
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.textContent.trim();
          }
        }
        return null;
      });
      return address;
    } catch (error) {
      console.error('Error getting address:', error.message);
      return null;
    }
  }

  /**
   * Get hotel rating
   */
  async getRating() {
    try {
      const rating = await this.page.evaluate(() => {
        const result = {
          score: null,
          reviewCount: null,
          category: null
        };

        // Try to get score
        const scoreSelectors = [
          '[data-testid="review-score-component"] div[aria-label]',
          '.b5cd09854e.d10a6220b4',
          '.a3b8729ab1.d86cee9b25',
        ];

        for (const selector of scoreSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent.trim();
            const scoreMatch = text.match(/(\d+\.?\d*)/);
            if (scoreMatch) {
              result.score = parseFloat(scoreMatch[1]);
              break;
            }
          }
        }

        // Try to get review count
        const reviewSelectors = [
          '[data-testid="review-score-component"]',
          '.d8eab2cf7f.c90c0a70d3',
        ];

        for (const selector of reviewSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent;
            const countMatch = text.match(/(\d{1,3}(,\d{3})*)/);
            if (countMatch) {
              result.reviewCount = parseInt(countMatch[1].replace(/,/g, ''));
              break;
            }
          }
        }

        // Try to get category
        const categorySelectors = [
          '[data-testid="review-score-component"]',
        ];

        for (const selector of categorySelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent;
            // Extract words like "Excellent", "Very Good", etc.
            const words = ['Excellent', 'Very Good', 'Good', 'Pleasant', 'Fair', 'Review score'];
            for (const word of words) {
              if (text.includes(word)) {
                result.category = word;
                break;
              }
            }
            if (result.category) break;
          }
        }

        return result;
      });
      return rating;
    } catch (error) {
      console.error('Error getting rating:', error.message);
      return null;
    }
  }

  /**
   * Get facilities
   */
  async getFacilities() {
    try {
      const facilities = await this.page.evaluate(() => {
        const result = [];

        // Try different selectors for facilities
        const facilitySelectors = [
          '[data-testid="property-most-popular-facilities-wrapper"] .a815ec762e.ab06168e37',
          '.important_facility',
          '.hotel-facilities-group',
        ];

        for (const selector of facilitySelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const text = el.textContent.trim();
              if (text && !result.includes(text)) {
                result.push(text);
              }
            });
            break;
          }
        }

        return result;
      });
      return facilities;
    } catch (error) {
      console.error('Error getting facilities:', error.message);
      return [];
    }
  }

  /**
   * Get FAQs
   */
  async getFAQs() {
    try {
      const faqs = await this.page.evaluate(() => {
        const result = [];

        // Try to find FAQ section
        const faqSelectors = [
          '[data-testid="faq-item"]',
          '.faq-item',
          '.hp-faq-item',
        ];

        for (const selector of faqSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const question = el.querySelector('button, .faq-question, h3');
              const answer = el.querySelector('.faq-answer, [data-testid="faq-answer"], p');

              if (question && answer) {
                result.push({
                  question: question.textContent.trim(),
                  answer: answer.textContent.trim()
                });
              }
            });
            break;
          }
        }

        return result;
      });
      return faqs;
    } catch (error) {
      console.error('Error getting FAQs:', error.message);
      return [];
    }
  }

  /**
   * Get about/description
   */
  async getAbout() {
    try {
      const about = await this.page.evaluate(() => {
        const selectors = [
          '[data-testid="property-description"]',
          '#property_description_content',
          '.hp-description',
          '.hotel-description',
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.textContent.trim();
          }
        }
        return null;
      });
      return about;
    } catch (error) {
      console.error('Error getting about:', error.message);
      return null;
    }
  }

  /**
   * Get images from gallery popup
   */
  async getImages(url) {
    try {
      // Navigate to URL with photosGallery parameter
      const galleryUrl = url.includes('?')
        ? `${url}&activeTab=photosGallery`
        : `${url}?activeTab=photosGallery`;

      console.log('Navigating to gallery:', galleryUrl);
      await this.page.goto(galleryUrl, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });

      // Wait for gallery popup to appear
      await this.sleep(3000); // Wait 3 seconds for popup

      const images = await this.page.evaluate(() => {
        const result = [];

        // Try different selectors for gallery images
        const imageSelectors = [
          '[data-testid="gallery-image"] img',
          '.bh-photo-grid-item img',
          '.hotel-photo-carousel img',
          '.photo-gallery img',
          'img[data-testid="image"]',
          '.gallery-image img',
        ];

        for (const selector of imageSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(img => {
              const src = img.src || img.dataset.src || img.getAttribute('data-lazy-src');
              if (src && !result.includes(src) && src.startsWith('http')) {
                result.push(src);
              }
            });
            if (result.length > 0) break;
          }
        }

        // If no images found in gallery, try to get from main page
        if (result.length === 0) {
          const allImages = document.querySelectorAll('img');
          allImages.forEach(img => {
            const src = img.src || img.dataset.src;
            if (src && src.includes('booking.com') && src.includes('photo') && !result.includes(src)) {
              result.push(src);
            }
          });
        }

        return result;
      });

      console.log(`Found ${images.length} images`);
      return images;
    } catch (error) {
      console.error('Error getting images:', error.message);
      return [];
    }
  }

  /**
   * Crawl all hotel information
   */
  async crawlHotel(url) {
    try {
      console.log('Starting crawl for:', url);

      // Initialize browser if not already done
      if (!this.browser) {
        await this.init();
      }

      // Navigate to hotel page
      console.log('Navigating to hotel page...');
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });

      // Wait for main content to load
      await this.sleep(2000);

      console.log('Extracting hotel information...');

      // Get all information
      const [name, address, rating, facilities, faqs, about] = await Promise.all([
        this.getHotelName(),
        this.getAddress(),
        this.getRating(),
        this.getFacilities(),
        this.getFAQs(),
        this.getAbout(),
      ]);

      // Get images separately as it requires navigation
      console.log('Extracting images...');
      const images = await this.getImages(url);

      const result = {
        url,
        name,
        address,
        rating,
        facilities,
        faqs,
        about,
        images,
        crawledAt: new Date().toISOString(),
      };

      console.log('Crawl completed successfully!');
      return result;
    } catch (error) {
      console.error('Error crawling hotel:', error.message);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

export default BookingCrawler;
