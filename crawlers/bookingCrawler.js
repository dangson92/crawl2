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
   * Extract JSON-LD schema data from page
   */
  async getSchemaData() {
    try {
      const schemaData = await this.page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            // Look for Hotel schema
            if (data['@type'] === 'Hotel' || data['@type'] === 'LodgingBusiness') {
              return data;
            }
            // Sometimes it's wrapped in an array or graph
            if (data['@graph']) {
              const hotelData = data['@graph'].find(item =>
                item['@type'] === 'Hotel' || item['@type'] === 'LodgingBusiness'
              );
              if (hotelData) return hotelData;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        return null;
      });
      return schemaData;
    } catch (error) {
      console.error('Error getting schema data:', error.message);
      return null;
    }
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
  async getHotelName(schemaData = null) {
    try {
      // Try to get from schema first
      if (schemaData && schemaData.name) {
        return schemaData.name;
      }

      // Fallback to DOM selectors
      const name = await this.page.evaluate(() => {
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
  async getAddress(schemaData = null) {
    try {
      // Try to get from schema first
      if (schemaData && schemaData.address) {
        const addr = schemaData.address;
        if (typeof addr === 'string') {
          return addr;
        }
        // If it's a structured address object
        if (addr.streetAddress) {
          return addr.streetAddress;
        }
      }

      // Fallback to DOM selectors
      const address = await this.page.evaluate(() => {
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
  async getRating(schemaData = null) {
    try {
      const result = {
        score: null,
        reviewCount: null,
        category: null
      };

      // Try to get from schema first
      if (schemaData && schemaData.aggregateRating) {
        const aggRating = schemaData.aggregateRating;
        if (aggRating.ratingValue) {
          result.score = parseFloat(aggRating.ratingValue);
        }
        if (aggRating.reviewCount) {
          result.reviewCount = parseInt(aggRating.reviewCount);
        }
      }

      // If we got both from schema, determine category based on score
      if (result.score) {
        if (result.score >= 9) result.category = 'Excellent';
        else if (result.score >= 8) result.category = 'Very Good';
        else if (result.score >= 7) result.category = 'Good';
        else if (result.score >= 6) result.category = 'Pleasant';
        else result.category = 'Fair';
      }

      // Fallback to DOM selectors if schema didn't provide data
      if (!result.score || !result.reviewCount) {
        const domRating = await this.page.evaluate(() => {
          const domResult = {
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
                domResult.score = parseFloat(scoreMatch[1]);
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
                domResult.reviewCount = parseInt(countMatch[1].replace(/,/g, ''));
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
              const words = ['Excellent', 'Very Good', 'Good', 'Pleasant', 'Fair', 'Review score'];
              for (const word of words) {
                if (text.includes(word)) {
                  domResult.category = word;
                  break;
                }
              }
              if (domResult.category) break;
            }
          }

          return domResult;
        });

        // Use DOM data as fallback
        if (!result.score && domRating.score) result.score = domRating.score;
        if (!result.reviewCount && domRating.reviewCount) result.reviewCount = domRating.reviewCount;
        if (!result.category && domRating.category) result.category = domRating.category;
      }

      return result;
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

        // Priority 1: Extract from facility-group-container (most specific)
        console.log('Searching for facilities with data-testid="facility-group-container"...');
        const containers = document.querySelectorAll('div[data-testid="facility-group-container"]');
        console.log(`Found ${containers.length} facility containers`);

        if (containers.length > 0) {
          containers.forEach(container => {
            const items = container.querySelectorAll('span.f6b6d2a959');
            console.log(`Container has ${items.length} facility items`);
            items.forEach(item => {
              const text = item.textContent.trim();
              if (text && !result.includes(text)) {
                result.push(text);
              }
            });
          });
        }

        // Fallback: Try other selectors if no facilities found
        if (result.length === 0) {
          console.log('No facilities found with primary selector, trying fallbacks...');
          const facilitySelectors = [
            '[data-testid="property-most-popular-facilities-wrapper"] .a815ec762e.ab06168e37',
            '.important_facility',
            '.hotel-facilities-group',
          ];

          for (const selector of facilitySelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Selector "${selector}" found ${elements.length} elements`);
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
        }

        console.log(`Total facilities extracted: ${result.length}`);
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

        // Priority 1: Extract from faqs-list (most specific)
        console.log('Searching for FAQs with data-testid="faqs-list"...');
        const faqsList = document.querySelector('div[data-testid="faqs-list"]');

        if (faqsList) {
          console.log('Found FAQs list container');
          const questions = faqsList.querySelectorAll('h3[data-testid="question"]');
          console.log(`Found ${questions.length} FAQ questions`);

          questions.forEach((questionEl, idx) => {
            const question = questionEl.textContent.trim();
            // Try multiple parent selectors
            let answerEl = questionEl.closest('.e5e285812b')?.querySelector('div[data-testid="answer"]');

            // If not found, try other parent containers
            if (!answerEl) {
              answerEl = questionEl.parentElement?.querySelector('div[data-testid="answer"]');
            }
            if (!answerEl) {
              answerEl = questionEl.parentElement?.parentElement?.querySelector('div[data-testid="answer"]');
            }

            if (answerEl) {
              result.push({
                question: question,
                answer: answerEl.textContent.trim()
              });
              console.log(`FAQ ${idx + 1}: ${question.substring(0, 50)}...`);
            } else {
              console.log(`FAQ ${idx + 1}: Found question but no answer - ${question.substring(0, 50)}...`);
            }
          });
        } else {
          console.log('FAQs list container not found');
        }

        // Fallback: Try other selectors if no FAQs found
        if (result.length === 0) {
          console.log('No FAQs found with primary selector, trying fallbacks...');
          const faqSelectors = [
            '[data-testid="faq-item"]',
            '.faq-item',
            '.hp-faq-item',
          ];

          for (const selector of faqSelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Selector "${selector}" found ${elements.length} elements`);
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
        }

        console.log(`Total FAQs extracted: ${result.length}`);
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
  async getAbout(schemaData = null) {
    try {
      // Priority 1: Get from specific data-testid attribute (most reliable)
      const aboutFromTestId = await this.page.evaluate(() => {
        const element = document.querySelector('p[data-testid="property-description"]');
        if (element) {
          return element.innerHTML.trim(); // Use innerHTML to preserve formatting like <b> tags
        }
        return null;
      });

      if (aboutFromTestId) {
        return aboutFromTestId;
      }

      // Priority 2: Get from schema
      if (schemaData && schemaData.description) {
        return schemaData.description;
      }

      // Priority 3: Fallback to other DOM selectors
      const about = await this.page.evaluate(() => {
        const selectors = [
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
   * Get house rules (check-in/check-out times, policies, etc.)
   */
  async getHouseRules() {
    try {
      const houseRules = await this.page.evaluate(() => {
        console.log('Searching for house rules with data-testid="property-section--content"...');
        const container = document.querySelector('div[data-testid="property-section--content"]');

        if (!container) {
          console.log('House rules container not found');
          return null;
        }

        console.log('Found house rules container');
        const rules = {};

        // Extract check-in time
        const checkInBlock = Array.from(container.querySelectorAll('.e7addce19e')).find(el =>
          el.textContent.includes('Check-in')
        );
        if (checkInBlock) {
          const timeEl = checkInBlock.closest('.b0400e5749')?.querySelector('.b99b6ef58f');
          if (timeEl) {
            rules.checkIn = timeEl.textContent.trim();
          }
        }

        // Extract check-out time
        const checkOutBlock = Array.from(container.querySelectorAll('.e7addce19e')).find(el =>
          el.textContent.includes('Check-out')
        );
        if (checkOutBlock) {
          const timeEl = checkOutBlock.closest('.b0400e5749')?.querySelector('.b99b6ef58f');
          if (timeEl) {
            rules.checkOut = timeEl.textContent.trim();
          }
        }

        // Extract cancellation policy
        const cancellationBlock = Array.from(container.querySelectorAll('.e7addce19e')).find(el =>
          el.textContent.includes('Cancellation')
        );
        if (cancellationBlock) {
          const policyEl = cancellationBlock.closest('.b0400e5749')?.querySelector('.b99b6ef58f');
          if (policyEl) {
            rules.cancellationPolicy = policyEl.textContent.trim();
          }
        }

        // Extract child policies
        const childPoliciesBlock = container.querySelector('[data-test-id="child-policies-block"]');
        if (childPoliciesBlock) {
          const childPolicies = [];
          childPoliciesBlock.querySelectorAll('p').forEach(p => {
            const text = p.textContent.trim();
            if (text) childPolicies.push(text);
          });
          if (childPolicies.length > 0) {
            rules.childPolicies = childPolicies;
          }
        }

        // Extract age restriction
        const ageBlock = Array.from(container.querySelectorAll('.e7addce19e')).find(el =>
          el.textContent.includes('Age restriction')
        );
        if (ageBlock) {
          const ageEl = ageBlock.closest('.b0400e5749')?.querySelector('.b99b6ef58f');
          if (ageEl) {
            rules.ageRestriction = ageEl.textContent.trim();
          }
        }

        // Extract pets policy
        const petsBlock = Array.from(container.querySelectorAll('.e7addce19e')).find(el =>
          el.textContent.includes('Pets')
        );
        if (petsBlock) {
          const petsEl = petsBlock.closest('.b0400e5749')?.querySelector('.b99b6ef58f');
          if (petsEl) {
            rules.pets = petsEl.textContent.trim();
          }
        }

        // Extract accepted payment cards
        const cardsBlock = Array.from(container.querySelectorAll('.e7addce19e')).find(el =>
          el.textContent.includes('Cards accepted')
        );
        if (cardsBlock) {
          const cardsContainer = cardsBlock.closest('.b0400e5749')?.querySelector('.c2a3382bac');
          if (cardsContainer) {
            const cards = [];
            cardsContainer.querySelectorAll('img').forEach(img => {
              if (img.alt && img.alt !== 'loading') {
                cards.push(img.alt);
              }
            });
            if (cards.length > 0) {
              rules.acceptedCards = cards;
            }
            // Check for cash policy
            const cashText = cardsContainer.querySelector('.f323fd7e96');
            if (cashText) {
              rules.cashPolicy = cashText.textContent.trim();
            }
          }
        }

        console.log('Extracted house rules:', {
          hasCheckIn: !!rules.checkIn,
          hasCheckOut: !!rules.checkOut,
          hasCancellation: !!rules.cancellationPolicy,
          hasPets: !!rules.pets,
          cardsCount: rules.acceptedCards?.length || 0
        });

        return Object.keys(rules).length > 0 ? rules : null;
      });

      return houseRules;
    } catch (error) {
      console.error('Error getting house rules:', error.message);
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

        // Priority 1: Look for picture elements with lazy-image-image
        const pictureElements = document.querySelectorAll('picture[data-testid="lazy-image-image"]');
        if (pictureElements.length > 0) {
          pictureElements.forEach(picture => {
            const img = picture.querySelector('img');
            if (img) {
              const src = img.src || img.dataset.src || img.getAttribute('data-lazy-src');
              if (src && !result.includes(src) && src.startsWith('http')) {
                result.push(src);
              }
            }
          });
        }

        // Priority 2: If no picture elements found, try other selectors
        if (result.length === 0) {
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
        }

        // Priority 3: Fallback - get from main page
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

      // Scroll down slowly to trigger lazy loading of all sections
      console.log('Scrolling page to load all content...');
      await this.autoScroll();

      console.log('Extracting hotel information...');

      // First, try to get structured data from JSON-LD schema
      console.log('Extracting JSON-LD schema data...');
      const schemaData = await this.getSchemaData();
      if (schemaData) {
        console.log('Found JSON-LD schema data');
      } else {
        console.log('No JSON-LD schema found, will use DOM selectors');
      }

      // Get all information (pass schemaData to use as primary source)
      console.log('Extracting name, address, rating...');
      const [name, address, rating] = await Promise.all([
        this.getHotelName(schemaData),
        this.getAddress(schemaData),
        this.getRating(schemaData),
      ]);

      console.log('Extracting about section...');
      const about = await this.getAbout(schemaData);

      console.log('Extracting facilities...');
      const facilities = await this.getFacilities();
      console.log(`Found ${facilities?.length || 0} facilities`);

      console.log('Extracting house rules...');
      const houseRules = await this.getHouseRules();

      console.log('Extracting FAQs...');
      const faqs = await this.getFAQs();
      console.log(`Found ${faqs?.length || 0} FAQs`);

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
        houseRules,
        images,
        crawledAt: new Date().toISOString(),
      };

      console.log('Crawl completed successfully!');
      console.log('Summary:', {
        name,
        facilitiesCount: facilities?.length || 0,
        faqsCount: faqs?.length || 0,
        hasHouseRules: !!houseRules,
        imagesCount: images?.length || 0
      });
      return result;
    } catch (error) {
      console.error('Error crawling hotel:', error.message);
      throw error;
    }
  }

  /**
   * Auto scroll page to load lazy content
   */
  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Scroll back to top
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.sleep(1000);
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
