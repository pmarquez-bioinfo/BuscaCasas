import { BaseScraper } from '../utils/scraper-base.js';
import { Property } from '../types/property.js';

export class MercadoLibreScraper extends BaseScraper {
  private baseUrl = 'https://listado.mercadolibre.com.uy';

  // Generate search URL for MercadoLibre Uruguay real estate
  generateSearchUrl(filters: {
    department?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    currency?: 'UYU' | 'USD';
  } = {}) {
    const params = new URLSearchParams();

    // Property type mapping
    if (filters.propertyType) {
      const typeMap: Record<string, string> = {
        'casa': 'MUY1459',
        'apartamento': 'MUY1458',
        'ph': 'MUY1460',
        'terreno': 'MUY1461'
      };
      if (typeMap[filters.propertyType]) {
        params.set('category', typeMap[filters.propertyType]);
      }
    }

    // Price range
    if (filters.minPrice) {
      params.set('price', `${filters.minPrice}-*`);
    }
    if (filters.maxPrice) {
      if (filters.minPrice) {
        params.set('price', `${filters.minPrice}-${filters.maxPrice}`);
      } else {
        params.set('price', `*-${filters.maxPrice}`);
      }
    }

    // Currency
    if (filters.currency) {
      params.set('currency', filters.currency);
    }

    // Department (location)
    if (filters.department) {
      // This might need adjustment based on ML's location IDs
      params.set('state', filters.department);
    }

    const queryString = params.toString();
    return queryString ? `${this.baseUrl}/inmuebles/_NoIndex_True?${queryString}` : `${this.baseUrl}/inmuebles/_NoIndex_True`;
  }

  async scrapeProperties(searchUrl?: string, maxPages = 3): Promise<Partial<Property>[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    const url = searchUrl || this.generateSearchUrl();
    console.log(`Scraping MercadoLibre: ${url}`);

    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await this.sleep(2000);

    const properties: Partial<Property>[] = [];
    let currentPage = 1;

    while (currentPage <= maxPages) {
      console.log(`Scraping page ${currentPage}...`);

      // Extract properties from current page
      const pageProperties = await this.extractPropertiesFromPage();
      properties.push(...pageProperties);

      console.log(`Found ${pageProperties.length} properties on page ${currentPage}`);

      // Try to go to next page
      if (currentPage < maxPages) {
        const hasNextPage = await this.goToNextPage();
        if (!hasNextPage) {
          console.log('No more pages available');
          break;
        }
        currentPage++;
        await this.sleep();
      } else {
        break;
      }
    }

    console.log(`Total properties scraped: ${properties.length}`);
    return properties;
  }

  private async extractPropertiesFromPage(): Promise<Partial<Property>[]> {
    if (!this.page) return [];

    try {
      // Try multiple possible selectors for ML listings
      const possibleSelectors = [
        '.ui-search-result',
        '.ui-search-results__item',
        '.ui-search-item',
        '.ui-search-layout__item',
        '.ui-search-results .ui-search-layout__item',
        '[data-testid="result"]'
      ];

      let selectedSelector = null;
      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          selectedSelector = selector;
          console.log(`Using selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }

      if (!selectedSelector) {
        console.warn('No listing selectors found, trying to extract any links');
        return [];
      }

      return await this.page.evaluate((selector) => {
        const listings = document.querySelectorAll(selector);
        const properties: any[] = [];

        listings.forEach((listing) => {
          try {
            // Extract basic info - updated selectors for current ML structure
            const titleElement = listing.querySelector('a[href*="MLU"]') || listing.querySelector('.ui-search-item__title a') || listing.querySelector('h2 a');
            const title = titleElement?.textContent?.trim();
            const url = titleElement?.getAttribute('href');

            if (!title || !url) return;

            // Extract price - try multiple selectors
            let priceElement = listing.querySelector('.andes-money-amount__fraction') ||
                              listing.querySelector('.price-tag-amount') ||
                              listing.querySelector('[class*="price"]');
            let currencyElement = listing.querySelector('.andes-money-amount__currency-symbol') ||
                                 listing.querySelector('[class*="currency"]');

            const priceText = priceElement?.textContent?.trim();
            const currencyText = currencyElement?.textContent?.trim();

            let price = 0;
            let currency = 'UYU';

            if (priceText) {
              price = parseFloat(priceText.replace(/[.,]/g, ''));
            }

            if (currencyText === '$' || currencyText === 'USD') {
              currency = 'USD';
            } else if (currencyText === 'U$S') {
              currency = 'USD';
            }

            // Extract location
            const locationElement = listing.querySelector('.ui-search-item__group__element.ui-search-item__location');
            const location = locationElement?.textContent?.trim() || '';

            // Try to extract department and neighborhood
            const locationParts = location.split(',').map(part => part.trim());
            const department = locationParts[locationParts.length - 1] || 'Montevideo';
            const neighborhood = locationParts.length > 1 ? locationParts[0] : undefined;

            // Extract area information from attributes
            const attributes = listing.querySelectorAll('.ui-search-item__group__element');
            let totalArea: number | undefined;
            let bedrooms: number | undefined;
            let bathrooms: number | undefined;

            attributes.forEach(attr => {
              const text = attr.textContent?.trim() || '';

              // Look for area (m², m2)
              const areaMatch = text.match(/(\d+)\s*m[²2]/i);
              if (areaMatch && !totalArea) {
                totalArea = parseInt(areaMatch[1]);
              }

              // Look for bedrooms (dormitorios, dorm, hab)
              const bedroomMatch = text.match(/(\d+)\s*(dormitorios?|dorm|hab)/i);
              if (bedroomMatch) {
                bedrooms = parseInt(bedroomMatch[1]);
              }

              // Look for bathrooms (baños)
              const bathroomMatch = text.match(/(\d+)\s*baños?/i);
              if (bathroomMatch) {
                bathrooms = parseInt(bathroomMatch[1]);
              }
            });

            // Extract image
            const imageElement = listing.querySelector('.ui-search-result-image__element img');
            const imageUrl = imageElement?.getAttribute('src') || imageElement?.getAttribute('data-src');

            // Generate unique ID
            const sourceId = url.split('/').find(part => part.startsWith('MLU')) || url;
            const id = `ml_${sourceId}`;

            const property = {
              id,
              source: 'mercadolibre',
              sourceId,
              url: url.startsWith('http') ? url : `https://mercadolibre.com.uy${url}`,
              title,
              price,
              currency,
              department,
              neighborhood,
              totalArea,
              bedrooms,
              bathrooms,
              images: imageUrl ? [imageUrl] : [],
              thumbnailUrl: imageUrl,
              scrapedAt: Date.now(), // Use timestamp for serialization
              updatedAt: Date.now(),
              isActive: true,
              propertyType: 'apartamento' // Default, could be improved with better detection
            };

            properties.push(property);
          } catch (error) {
            console.warn('Error parsing listing:', error);
          }
        });

        return properties;
      }, selectedSelector);
    } catch (error) {
      console.error('Error extracting properties from page:', error);
      return [];
    }
  }

  private async goToNextPage(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Look for next page button
      const nextPageSelector = '.andes-pagination__button--next:not(.andes-pagination__button--disabled)';
      const nextButton = await this.page.$(nextPageSelector);

      if (nextButton) {
        await this.page.click(nextPageSelector);
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        await this.sleep();
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Error going to next page:', error);
      return false;
    }
  }
}

// Standalone function for testing
export async function scrapeMercadoLibre(maxPages = 2) {
  const scraper = new MercadoLibreScraper();

  try {
    await scraper.initialize();
    const properties = await scraper.scrapeProperties(undefined, maxPages);

    console.log(`\nMercadoLibre Results:`);
    console.log(`===================`);
    properties.forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.title}`);
      console.log(`   Price: ${prop.currency} ${prop.price?.toLocaleString()}`);
      console.log(`   Location: ${prop.neighborhood ? prop.neighborhood + ', ' : ''}${prop.department}`);
      console.log(`   Area: ${prop.totalArea || 'N/A'} m²`);
      console.log(`   Beds: ${prop.bedrooms || 'N/A'}, Baths: ${prop.bathrooms || 'N/A'}`);
      console.log(`   URL: ${prop.url}`);
      console.log('');
    });

    return properties;
  } finally {
    await scraper.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeMercadoLibre().catch(console.error);
}