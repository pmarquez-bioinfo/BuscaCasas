import { MercadoLibreScraper } from './scrapers/mercadolibre.js';
import { InfoCasasScraper } from './scrapers/infocasas.js';
import { PropertyDatabase } from './database/schema.js';

export {
  MercadoLibreScraper,
  InfoCasasScraper,
  PropertyDatabase
};

export * from './types/property.js';

// Default export for easy testing
export default async function scrapeBoth(maxPages = 2) {
  console.log('🏠 BuscaCasas - Uruguay Real Estate Scraper');
  console.log('==========================================\n');

  const allProperties: any[] = [];

  // Scrape MercadoLibre
  console.log('🔍 Scraping MercadoLibre...');
  const mlScraper = new MercadoLibreScraper();
  await mlScraper.initialize();
  try {
    const mlProperties = await mlScraper.scrapeProperties(undefined, maxPages);
    allProperties.push(...mlProperties);
    console.log(`✅ MercadoLibre: ${mlProperties.length} properties\n`);
  } finally {
    await mlScraper.close();
  }

  // Scrape InfoCasas
  console.log('🔍 Scraping InfoCasas...');
  const icScraper = new InfoCasasScraper();
  await icScraper.initialize();
  try {
    const icProperties = await icScraper.scrapeProperties(undefined, maxPages);
    allProperties.push(...icProperties);
    console.log(`✅ InfoCasas: ${icProperties.length} properties\n`);
  } finally {
    await icScraper.close();
  }

  console.log(`📊 Total: ${allProperties.length} properties found`);
  return allProperties;
}