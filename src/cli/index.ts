#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { MercadoLibreScraper } from '../scrapers/mercadolibre.js';
import { InfoCasasScraper } from '../scrapers/infocasas.js';
import { PropertyDatabase } from '../database/schema.js';
import { PropertySchema } from '../types/property.js';

// Load environment variables
config();

const program = new Command();

program
  .name('buscacasas')
  .description('Uruguay real estate aggregator CLI')
  .version('0.1.0');

// Scrape command
program
  .command('scrape')
  .description('Scrape properties from MercadoLibre and InfoCasas')
  .option('-s, --source <source>', 'Source to scrape (ml, ic, both)', 'both')
  .option('-p, --pages <pages>', 'Maximum pages to scrape', '2')
  .option('-d, --department <department>', 'Filter by department')
  .option('-t, --type <type>', 'Property type (casa, apartamento, ph, terreno)')
  .option('--min-price <price>', 'Minimum price')
  .option('--max-price <price>', 'Maximum price')
  .option('--currency <currency>', 'Currency (UYU, USD)')
  .option('--save', 'Save results to database')
  .action(async (options) => {
    console.log('🏠 Starting BuscaCasas scraper...\n');

    // Note: Advanced filtering will be implemented in future versions
    // const filters = {
    //   department: options.department,
    //   propertyType: options.type,
    //   minPrice: options.minPrice ? parseInt(options.minPrice) : undefined,
    //   maxPrice: options.maxPrice ? parseInt(options.maxPrice) : undefined,
    //   currency: options.currency as 'UYU' | 'USD'
    // };

    const maxPages = parseInt(options.pages);
    const allProperties: any[] = [];

    try {
      // Scrape MercadoLibre
      if (options.source === 'ml' || options.source === 'both') {
        console.log('🔍 Scraping MercadoLibre...');
        const mlScraper = new MercadoLibreScraper();
        await mlScraper.initialize();

        try {
          const mlProperties = await mlScraper.scrapeProperties(undefined, maxPages);
          allProperties.push(...mlProperties);
          console.log(`✅ MercadoLibre: Found ${mlProperties.length} properties\n`);
        } finally {
          await mlScraper.close();
        }
      }

      // Scrape InfoCasas
      if (options.source === 'ic' || options.source === 'both') {
        console.log('🔍 Scraping InfoCasas...');
        const icScraper = new InfoCasasScraper();
        await icScraper.initialize();

        try {
          const icProperties = await icScraper.scrapeProperties(undefined, maxPages);
          allProperties.push(...icProperties);
          console.log(`✅ InfoCasas: Found ${icProperties.length} properties\n`);
        } finally {
          await icScraper.close();
        }
      }

      // Display results
      console.log(`📊 Total properties found: ${allProperties.length}\n`);

      if (allProperties.length > 0) {
        // Show sample results
        console.log('📋 Sample Results:');
        console.log('==================');
        allProperties.slice(0, 5).forEach((prop, index) => {
          console.log(`${index + 1}. ${prop.title}`);
          console.log(`   💰 Price: ${prop.currency} ${prop.price?.toLocaleString()}`);
          console.log(`   📍 Location: ${prop.neighborhood ? prop.neighborhood + ', ' : ''}${prop.department}`);
          console.log(`   📏 Area: ${prop.totalArea || 'N/A'} m²`);
          console.log(`   🛏️  Beds: ${prop.bedrooms || 'N/A'}, 🚿 Baths: ${prop.bathrooms || 'N/A'}`);
          console.log(`   🔗 Source: ${prop.source}`);
          console.log('');
        });

        if (allProperties.length > 5) {
          console.log(`... and ${allProperties.length - 5} more properties\n`);
        }
      }

      // Save to database if requested
      if (options.save && allProperties.length > 0) {
        console.log('💾 Saving to database...');
        const db = new PropertyDatabase();

        let savedCount = 0;
        for (const property of allProperties) {
          try {
            // Validate property data
            const validatedProperty = PropertySchema.parse({
              ...property,
              publishedAt: property.publishedAt || new Date(),
              scrapedAt: property.scrapedAt || new Date(),
              updatedAt: property.updatedAt || new Date()
            });

            db.insertProperty(validatedProperty);
            savedCount++;
          } catch (error) {
            console.warn(`⚠️  Skipped invalid property: ${property.title}`, error);
          }
        }

        db.close();
        console.log(`✅ Saved ${savedCount} properties to database\n`);
      }

    } catch (error) {
      console.error('❌ Error during scraping:', error);
      process.exit(1);
    }
  });

// Search command
program
  .command('search')
  .description('Search saved properties in database')
  .option('-d, --department <department>', 'Filter by department')
  .option('-n, --neighborhood <neighborhood>', 'Filter by neighborhood')
  .option('-t, --type <type>', 'Property type')
  .option('--min-price <price>', 'Minimum price')
  .option('--max-price <price>', 'Maximum price')
  .option('-c, --currency <currency>', 'Currency (UYU, USD)')
  .option('-l, --limit <limit>', 'Maximum results to show', '10')
  .action(async (options) => {
    console.log('🔍 Searching saved properties...\n');

    const filters = {
      department: options.department,
      neighborhood: options.neighborhood,
      propertyType: options.type,
      minPrice: options.minPrice ? parseInt(options.minPrice) : undefined,
      maxPrice: options.maxPrice ? parseInt(options.maxPrice) : undefined,
      currency: options.currency
    };

    const limit = parseInt(options.limit);

    try {
      const db = new PropertyDatabase();
      const properties = db.getProperties(filters, limit);
      db.close();

      if (properties.length === 0) {
        console.log('❌ No properties found matching your criteria');
        return;
      }

      console.log(`📊 Found ${properties.length} properties:\n`);

      properties.forEach((prop: any, index: number) => {
        console.log(`${index + 1}. ${prop.title}`);
        console.log(`   💰 Price: ${prop.currency} ${prop.price?.toLocaleString()}`);
        console.log(`   📍 Location: ${prop.neighborhood ? prop.neighborhood + ', ' : ''}${prop.department}`);
        console.log(`   📏 Area: ${prop.total_area || 'N/A'} m²`);
        console.log(`   🛏️  Beds: ${prop.bedrooms || 'N/A'}, 🚿 Baths: ${prop.bathrooms || 'N/A'}`);
        console.log(`   🔗 Source: ${prop.source}`);
        console.log(`   🕒 Scraped: ${new Date(prop.scraped_at).toLocaleDateString()}`);
        console.log(`   🌐 URL: ${prop.url}`);
        console.log('');
      });

    } catch (error) {
      console.error('❌ Error searching database:', error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    console.log('📊 Database Statistics\n');

    try {
      const db = new PropertyDatabase();
      const stats = db.getStats();
      db.close();

      console.log(`📈 Total Properties: ${stats.total}\n`);

      console.log('📋 By Source:');
      stats.bySource.forEach((item: any) => {
        console.log(`   ${item.source}: ${item.count}`);
      });

      console.log('\n📍 By Department:');
      stats.byDepartment.slice(0, 10).forEach((item: any) => {
        console.log(`   ${item.department}: ${item.count}`);
      });

    } catch (error) {
      console.error('❌ Error getting statistics:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();