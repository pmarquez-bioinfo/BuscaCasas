import { BaseScraper } from '../utils/scraper-base.js';
import { Property } from '../types/property.js';

export class InfoCasasScraper extends BaseScraper {
  private baseUrl = 'https://www.infocasas.com.uy';

  // Generate search URL for InfoCasas Uruguay
  generateSearchUrl(filters: {
    department?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    currency?: 'UYU' | 'USD';
    operation?: 'venta' | 'alquiler';
  } = {}) {
    const params = new URLSearchParams();

    // Operation type (venta = sale, alquiler = rent)
    const operation = filters.operation || 'venta';

    // Property type mapping for InfoCasas
    if (filters.propertyType) {
      const typeMap: Record<string, string> = {
        'casa': 'casa',
        'apartamento': 'apartamento',
        'ph': 'ph',
        'terreno': 'terreno',
        'local_comercial': 'local'
      };
      if (typeMap[filters.propertyType]) {
        params.set('tipo', typeMap[filters.propertyType]);
      }
    }

    // Price range
    if (filters.minPrice) {
      params.set('precio_desde', filters.minPrice.toString());
    }
    if (filters.maxPrice) {
      params.set('precio_hasta', filters.maxPrice.toString());
    }

    // Currency
    if (filters.currency) {
      params.set('moneda', filters.currency);
    }

    // Department
    if (filters.department) {
      params.set('departamento', filters.department.toLowerCase());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/${operation}`;
    return queryString ? `${url}?${queryString}` : url;
  }

  async scrapeProperties(searchUrl?: string, maxPages = 3): Promise<Partial<Property>[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    const url = searchUrl || this.generateSearchUrl();
    console.log(`Scraping InfoCasas: ${url}`);

    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await this.sleep(2000);

    const properties: Partial<Property>[] = [];
    let currentPage = 1;

    while (currentPage <= maxPages) {
      console.log(`Scraping InfoCasas page ${currentPage}...`);

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

    console.log(`Total InfoCasas properties scraped: ${properties.length}`);
    return properties;
  }

  private async extractPropertiesFromPage(): Promise<Partial<Property>[]> {
    if (!this.page) return [];

    try {
      // Wait for listings to load - InfoCasas uses different selectors
      await this.page.waitForSelector('.card-property, .property-card, .listing-item', { timeout: 10000 });

      return await this.page.evaluate(() => {
        // Try multiple selectors as InfoCasas structure might vary
        const selectors = ['.card-property', '.property-card', '.listing-item', '.property-item'];
        let listings: NodeListOf<Element> | null = null;

        for (const selector of selectors) {
          listings = document.querySelectorAll(selector);
          if (listings.length > 0) break;
        }

        if (!listings || listings.length === 0) {
          // Fallback: try to find any container with property links
          listings = document.querySelectorAll('[data-property-id], .property, .inmueble');
        }

        const properties: any[] = [];

        listings.forEach((listing) => {
          try {
            // Extract title and URL
            const titleElement = listing.querySelector('a[href*="/inmueble/"], a[href*="/propiedad/"], h3 a, .title a, .property-title a');
            const title = titleElement?.textContent?.trim() ||
                         listing.querySelector('.title, .property-title, h3, h4')?.textContent?.trim();

            let url = titleElement?.getAttribute('href');
            if (url && !url.startsWith('http')) {
              url = `https://www.infocasas.com.uy${url}`;
            }

            if (!title || !url) return;

            // Extract price
            const priceSelectors = [
              '.price', '.precio', '.property-price', '.card-price',
              '[class*="price"]', '[class*="precio"]'
            ];

            let priceElement: Element | null = null;
            for (const selector of priceSelectors) {
              priceElement = listing.querySelector(selector);
              if (priceElement) break;
            }

            let price = 0;
            let currency = 'UYU';
            const priceText = priceElement?.textContent?.trim() || '';

            if (priceText) {
              // Extract currency
              if (priceText.includes('USD') || priceText.includes('U$S') || priceText.includes('$')) {
                currency = 'USD';
              }

              // Extract numeric price
              const priceMatch = priceText.match(/[\d.,]+/);
              if (priceMatch) {
                price = parseFloat(priceMatch[0].replace(/[.,]/g, ''));
              }
            }

            // Extract location
            const locationSelectors = [
              '.location', '.ubicacion', '.property-location', '.address',
              '[class*="location"]', '[class*="ubicacion"]'
            ];

            let locationElement: Element | null = null;
            for (const selector of locationSelectors) {
              locationElement = listing.querySelector(selector);
              if (locationElement) break;
            }

            const location = locationElement?.textContent?.trim() || '';
            const locationParts = location.split(',').map(part => part.trim());
            const department = locationParts[locationParts.length - 1] || 'Montevideo';
            const neighborhood = locationParts.length > 1 ? locationParts[0] : undefined;

            // Extract property details
            const detailsText = listing.textContent || '';

            // Look for bedrooms
            let bedrooms: number | undefined;
            const bedroomMatch = detailsText.match(/(\d+)\s*(dormitorios?|dorm|hab|habitaciones?)/i);
            if (bedroomMatch) {
              bedrooms = parseInt(bedroomMatch[1]);
            }

            // Look for bathrooms
            let bathrooms: number | undefined;
            const bathroomMatch = detailsText.match(/(\d+)\s*baños?/i);
            if (bathroomMatch) {
              bathrooms = parseInt(bathroomMatch[1]);
            }

            // Look for area
            let totalArea: number | undefined;
            const areaMatch = detailsText.match(/(\d+)\s*m[²2]/i);
            if (areaMatch) {
              totalArea = parseInt(areaMatch[1]);
            }

            // Extract image
            const imageElement = listing.querySelector('img');
            const imageUrl = imageElement?.getAttribute('src') || imageElement?.getAttribute('data-src');

            // Generate unique ID
            const urlParts = url.split('/');
            const sourceId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || Math.random().toString(36).substr(2, 9);
            const id = `ic_${sourceId}`;

            // Determine property type from title or URL
            let propertyType = 'apartamento'; // default
            const typeText = (title + ' ' + url).toLowerCase();
            if (typeText.includes('casa')) propertyType = 'casa';
            else if (typeText.includes('ph')) propertyType = 'ph';
            else if (typeText.includes('terreno')) propertyType = 'terreno';
            else if (typeText.includes('local')) propertyType = 'local_comercial';

            const property = {
              id,
              source: 'infocasas',
              sourceId,
              url,
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
              propertyType,
              scrapedAt: new Date(),
              updatedAt: new Date(),
              isActive: true
            };

            properties.push(property);
          } catch (error) {
            console.warn('Error parsing InfoCasas listing:', error);
          }
        });

        return properties;
      });
    } catch (error) {
      console.error('Error extracting properties from InfoCasas page:', error);
      return [];
    }
  }

  private async goToNextPage(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Look for next page button - InfoCasas might use different selectors
      const nextPageSelectors = [
        '.pagination .next:not(.disabled)',
        '.paginacion .siguiente:not(.deshabilitado)',
        'a[aria-label="Next"]',
        '.page-next',
        '.btn-next'
      ];

      for (const selector of nextPageSelectors) {
        const nextButton = await this.page.$(selector);
        if (nextButton) {
          await this.page.click(selector);
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
          await this.sleep();
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('Error going to next page on InfoCasas:', error);
      return false;
    }
  }
}

// Standalone function for testing
export async function scrapeInfoCasas(maxPages = 2) {
  const scraper = new InfoCasasScraper();

  try {
    await scraper.initialize();
    const properties = await scraper.scrapeProperties(undefined, maxPages);

    console.log(`\nInfoCasas Results:`);
    console.log(`================`);
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
  scrapeInfoCasas().catch(console.error);
}