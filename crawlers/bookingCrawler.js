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
   * Get location details (city, region, country)
   */
  async getLocationDetails(schemaData = null) {
    try {
      const location = {
        cityName: null,
        regionName: null,
        countryName: null
      };

      // Try to get from embedded JSON data first (most reliable)
      const jsonLocation = await this.page.evaluate(() => {
        const jsonData = {
          cityName: null,
          regionName: null,
          countryName: null
        };

        // Method 1: Check window object for booking data first (most reliable)
        if (window.b_hotel_data) {
          const hotelData = window.b_hotel_data;
          if (hotelData.city_name) {
            jsonData.cityName = hotelData.city_name;
          }
          if (hotelData.region_name) {
            jsonData.regionName = hotelData.region_name;
          }
          if (hotelData.country_name) {
            jsonData.countryName = hotelData.country_name;
          }

          // If we got all data from window object, return immediately
          if (jsonData.cityName && jsonData.countryName) {
            return jsonData;
          }
        }

        // Method 2: Look for complete location object in script tags
        const scripts = document.querySelectorAll('script:not([src])');
        for (const script of scripts) {
          try {
            const content = script.textContent;

            // Only search in scripts that contain location fields
            if (content.includes('city_name') && content.includes('country_name')) {
              // Try to find a complete object with all location fields together
              // Use a more flexible regex that can match nested objects
              const lines = content.split('\n');

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Look for lines that might start a location object
                if (line.includes('city_name') || line.includes('country_name')) {
                  // Try to find the containing object by looking around this line
                  let startIdx = i - 5 > 0 ? i - 5 : 0;
                  let endIdx = i + 5 < lines.length ? i + 5 : lines.length;

                  const contextLines = lines.slice(startIdx, endIdx).join('\n');

                  // Look for objects that have multiple location fields
                  if (contextLines.includes('city_name') &&
                      contextLines.includes('country_name')) {

                    // Try to extract values using regex
                    const cityMatch = contextLines.match(/"city_name"\s*:\s*"([^"]+)"/);
                    const countryMatch = contextLines.match(/"country_name"\s*:\s*"([^"]+)"/);
                    const regionMatch = contextLines.match(/"region_name"\s*:\s*"([^"]+)"/);

                    // Only accept if we found at least city and country in the same context
                    if (cityMatch && countryMatch && !jsonData.cityName) {
                      jsonData.cityName = cityMatch[1];
                      jsonData.countryName = countryMatch[1];
                      if (regionMatch) {
                        jsonData.regionName = regionMatch[1];
                      }

                      // Found valid location data, return it
                      return jsonData;
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Continue to next script
          }
        }

        return jsonData;
      });

      // Use JSON data as primary source
      if (jsonLocation.cityName) {
        location.cityName = jsonLocation.cityName;
      }
      if (jsonLocation.regionName) {
        location.regionName = jsonLocation.regionName;
      }
      if (jsonLocation.countryName) {
        location.countryName = jsonLocation.countryName;
      }

      // Fallback to schema data if JSON didn't have it
      if (!location.cityName || !location.regionName || !location.countryName) {
        if (schemaData && schemaData.address) {
          const addr = schemaData.address;
          if (addr.addressLocality && !location.cityName) {
            location.cityName = addr.addressLocality;
          }
          if (addr.addressRegion && !location.regionName) {
            location.regionName = addr.addressRegion;
          }
          if (addr.addressCountry && !location.countryName) {
            if (typeof addr.addressCountry === 'string') {
              location.countryName = addr.addressCountry;
            } else if (addr.addressCountry.name) {
              location.countryName = addr.addressCountry.name;
            }
          }
        }
      }

      return location;
    } catch (error) {
      return {
        cityName: null,
        regionName: null,
        countryName: null
      };
    }
  }

  /**
   * Get hotel star rating (hotel classification, not review rating)
   */
  async getRating(schemaData = null) {
    try {
      // Try to get from DOM - look for rating elements
      const rating = await this.page.evaluate(() => {
        // Look for elements with data-testid="quality-rating" or "rating-squares"
        const ratingSelectors = [
          '[data-testid="quality-rating"]',
          '[data-testid="rating-squares"]',
          '[data-testid="rating-stars"]',
          '[aria-label*="out of 5"]',
        ];

        for (const selector of ratingSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            // Try to get from aria-label or text content
            const ariaLabel = element.getAttribute('aria-label');
            const text = ariaLabel || element.textContent;

            // Match patterns like "3 out of 5 quality rating" or "4 out of 5 stars"
            const match = text.match(/(\d+)\s*out\s*of\s*\d+/i);
            if (match) {
              return parseFloat(match[1]);
            }
          }
        }

        // Fallback: look for star rating in structured data
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            if (data.starRating && data.starRating.ratingValue) {
              return parseFloat(data.starRating.ratingValue);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        return null;
      });

      return rating;
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
   * Get hotel area information (nearby places, restaurants, attractions, etc.)
   */
  async getHotelAreaInfo() {
    try {
      const areaInfo = await this.page.evaluate(() => {
        const result = [];

        // Find the location block container
        const locationContainer = document.querySelector('div[data-testid="location-block-container"]');
        if (!locationContainer) {
          return result;
        }

        // Find all poi-block elements (each represents a category)
        const poiBlocks = locationContainer.querySelectorAll('div[data-testid="poi-block"]');

        poiBlocks.forEach(block => {
          // Get category name from h3
          const categoryElement = block.querySelector('h3');
          if (!categoryElement) return;

          const category = categoryElement.textContent.trim();

          // Get all items in this category
          const itemsList = block.querySelector('ul[data-testid="poi-block-list"]');
          if (!itemsList) return;

          const items = [];
          const listItems = itemsList.querySelectorAll('li');

          listItems.forEach(li => {
            // Get the name and distance
            const nameElement = li.querySelector('.aa225776f2.ca9d921c46, .d1bc97eb82');
            const distanceElement = li.querySelector('.b99b6ef58f.fb14de7f14.a0a56631d6');

            if (nameElement && distanceElement) {
              // Check if there's a type label (like "Restaurant", "Cafe/Bar", etc.)
              const typeElement = li.querySelector('.ea6d30da3a');
              const type = typeElement ? typeElement.textContent.trim() : null;

              // Get the full name text, excluding the type label if present
              let name = nameElement.textContent.trim();
              if (type && name.startsWith(type)) {
                name = name.substring(type.length).trim();
              }

              items.push({
                name: name,
                distance: distanceElement.textContent.trim(),
                ...(type && { type: type })
              });
            }
          });

          if (items.length > 0) {
            result.push({
              category: category,
              items: items
            });
          }
        });

        return result;
      });

      return areaInfo;
    } catch (error) {
      return [];
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
      const [name, address, rating, locationDetails] = await Promise.all([
        this.getHotelName(schemaData),
        this.getAddress(schemaData),
        this.getRating(schemaData),
        this.getLocationDetails(schemaData),
      ]);

      const about = await this.getAbout(schemaData);

      const facilities = await this.getFacilities();

      const houseRules = await this.getHouseRules();

      const faqs = await this.getFAQs();

      const hotelAreaInfo = await this.getHotelAreaInfo();

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
        cityName: locationDetails.cityName,
        regionName: locationDetails.regionName,
        countryName: locationDetails.countryName,
        hotelAreaInfo,
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
