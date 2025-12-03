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
        const containers = document.querySelectorAll('div[data-testid="facility-group-container"]');

        if (containers.length > 0) {
          containers.forEach(container => {
            const items = container.querySelectorAll('span.f6b6d2a959');
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
        }

        return result;
      });
      return facilities;
    } catch (error) {
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
        const faqsList = document.querySelector('div[data-testid="faqs-list"]');

        if (faqsList) {
          const questions = faqsList.querySelectorAll('h3[data-testid="question"]');

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
            } else {
            }
          });
        } else {
        }

        // Fallback: Try other selectors if no FAQs found
        if (result.length === 0) {
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
        }

        return result;
      });
      return faqs;
    } catch (error) {
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
      return null;
    }
  }

  /**
   * Get house rules (check-in/check-out times, policies, etc.)
   */
  async getHouseRules() {
    try {
      const houseRules = await this.page.evaluate(() => {
        const rules = {};

        // Try to find house rules section by various methods
        // Method 1: Look for section with heading "House Rules"
        const headings = Array.from(document.querySelectorAll('h2, h3, [role="heading"]'));
        const houseRulesHeading = headings.find(h =>
          h.textContent.toLowerCase().includes('house rules') ||
          h.textContent.toLowerCase().includes('policies')
        );

        let container = null;

        if (houseRulesHeading) {
          // Get the parent section
          container = houseRulesHeading.closest('section') ||
                     houseRulesHeading.closest('[data-testid*="property"]') ||
                     houseRulesHeading.parentElement;
        }

        // Method 2: Try data-testid selector
        if (!container) {
          container = document.querySelector('div[data-testid="property-section--content"]');
        }

        // Method 3: Look for container with check-in/check-out keywords
        if (!container) {
          const allDivs = document.querySelectorAll('div');
          for (const div of allDivs) {
            const text = div.textContent || '';
            if (text.includes('Check-in') && text.includes('Check-out')) {
              container = div;
              break;
            }
          }
        }

        if (!container) {
          return null;
        }

        // Find all rule sections (each has class b0400e5749)
        const sections = container.querySelectorAll('.b0400e5749');

        sections.forEach(section => {
          // Get heading/label text (before the value container)
          // The heading is typically in the first part of the section, before .c92998be48
          const valueContainer = section.querySelector('.c92998be48');
          if (!valueContainer) return;

          // Get heading text by getting all text BEFORE value container
          // We'll clone the section, remove value container, then get text
          const sectionClone = section.cloneNode(true);
          const valueContainerClone = sectionClone.querySelector('.c92998be48');
          if (valueContainerClone) {
            valueContainerClone.remove();
          }
          const headingText = sectionClone.textContent.trim();

          // Get the value from the first .b99b6ef58f
          const valueEl = valueContainer.querySelector('.b99b6ef58f');
          if (!valueEl) return;

          const value = valueEl.textContent.trim();

          // Identify rule type by exact heading text match
          if (headingText === 'Check-in') {
            rules.checkIn = value;
          } else if (headingText === 'Check-out') {
            rules.checkOut = value;
          } else if (headingText === 'Pets') {
            rules.pets = value;
          }
        });

        return Object.keys(rules).length > 0 ? rules : null;
      });

      return houseRules;
    } catch (error) {
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

      return images;
    } catch (error) {
      return [];
    }
  }

  /**
   * Crawl all hotel information
   */
  async crawlHotel(url) {
    try {

      // Initialize browser if not already done
      if (!this.browser) {
        await this.init();
      }

      // Navigate to hotel page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });

      // Wait for main content to load
      await this.sleep(2000);

      // Scroll down slowly to trigger lazy loading of all sections
      await this.autoScroll();


      // First, try to get structured data from JSON-LD schema
      const schemaData = await this.getSchemaData();
      if (schemaData) {
      } else {
      }

      // Get all information (pass schemaData to use as primary source)
      const [name, address, rating] = await Promise.all([
        this.getHotelName(schemaData),
        this.getAddress(schemaData),
        this.getRating(schemaData),
      ]);

      const about = await this.getAbout(schemaData);

      const facilities = await this.getFacilities();

      const houseRules = await this.getHouseRules();

      const faqs = await this.getFAQs();

      // Get images separately as it requires navigation
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

      return result;
    } catch (error) {
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
