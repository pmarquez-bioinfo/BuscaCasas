import express from 'express';
import cors from 'cors';
import { PropertyDatabase } from '../database/schema.js';
import { MercadoLibreScraper } from '../scrapers/mercadolibre.js';
import { InfoCasasScraper } from '../scrapers/infocasas.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Database instance
const db = new PropertyDatabase();

// API Routes

// Get all properties with filters
app.get('/api/properties', (req, res) => {
  try {
    const {
      department,
      neighborhood,
      propertyType,
      minPrice,
      maxPrice,
      currency,
      minBedrooms,
      maxBedrooms,
      operation,
      limit = '50',
      offset = '0'
    } = req.query;

    const filters = {
      department: department as string,
      neighborhood: neighborhood as string,
      propertyType: propertyType as string,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      currency: currency as string,
      minBedrooms: minBedrooms ? parseInt(minBedrooms as string) : undefined,
      maxBedrooms: maxBedrooms ? parseInt(maxBedrooms as string) : undefined,
      operation: operation as string
    };

    const properties = db.getProperties(
      filters,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    // Convert database format to frontend format
    const formattedProperties = properties.map((prop: any) => ({
      id: prop.id,
      source: prop.source,
      sourceId: prop.source_id,
      url: prop.url,
      title: prop.title,
      description: prop.description,
      propertyType: prop.property_type,
      department: prop.department,
      neighborhood: prop.neighborhood,
      address: prop.address,
      price: prop.price,
      currency: prop.currency,
      pricePerM2: prop.price_per_m2,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      totalArea: prop.total_area,
      builtArea: prop.built_area,
      garages: prop.garages,
      hasBalcony: prop.has_balcony,
      hasParrillero: prop.has_parrillero,
      hasPortero: prop.has_portero,
      hasElevator: prop.has_elevator,
      hasPool: prop.has_pool,
      hasGym: prop.has_gym,
      images: JSON.parse(prop.images || '[]'),
      thumbnailUrl: prop.thumbnail_url,
      contactPhone: prop.contact_phone,
      contactEmail: prop.contact_email,
      realEstateAgency: prop.real_estate_agency,
      publishedAt: prop.published_at,
      scrapedAt: prop.scraped_at,
      updatedAt: prop.updated_at,
      isActive: prop.is_active
    }));

    res.json({
      properties: formattedProperties,
      total: formattedProperties.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get property by ID
app.get('/api/properties/:id', (req, res) => {
  try {
    const property = db.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Trigger scraping
app.post('/api/scrape', async (req, res) => {
  try {
    const {
      source = 'both',
      pages = 2,
      filters = {}
    } = req.body;
    const allProperties: any[] = [];

    let status = {
      mercadolibre: { status: 'skipped', count: 0, error: null },
      infocasas: { status: 'skipped', count: 0, error: null }
    };

    // Scrape MercadoLibre
    if (source === 'ml' || source === 'both') {
      try {
        status.mercadolibre.status = 'running';
        const mlScraper = new MercadoLibreScraper();
        await mlScraper.initialize();

        // Generate search URL with filters
        const searchUrl = mlScraper.generateSearchUrl({
          department: filters.department,
          propertyType: filters.propertyType,
          minPrice: filters.minPrice ? parseInt(filters.minPrice) : undefined,
          maxPrice: filters.maxPrice ? parseInt(filters.maxPrice) : undefined,
          currency: filters.currency,
          operation: filters.operation,
          minBedrooms: filters.minBedrooms ? parseInt(filters.minBedrooms) : undefined
        });

        const mlProperties = await mlScraper.scrapeProperties(searchUrl, pages);
        allProperties.push(...mlProperties);
        await mlScraper.close();

        status.mercadolibre.status = 'completed';
        status.mercadolibre.count = mlProperties.length;
      } catch (error) {
        status.mercadolibre.status = 'error';
        status.mercadolibre.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Scrape InfoCasas
    if (source === 'ic' || source === 'both') {
      try {
        status.infocasas.status = 'running';
        const icScraper = new InfoCasasScraper();
        await icScraper.initialize();

        // Generate search URL with filters
        const searchUrl = icScraper.generateSearchUrl({
          department: filters.department,
          propertyType: filters.propertyType,
          minPrice: filters.minPrice ? parseInt(filters.minPrice) : undefined,
          maxPrice: filters.maxPrice ? parseInt(filters.maxPrice) : undefined,
          currency: filters.currency,
          operation: filters.operation,
          minBedrooms: filters.minBedrooms ? parseInt(filters.minBedrooms) : undefined
        });

        const icProperties = await icScraper.scrapeProperties(searchUrl, pages);
        allProperties.push(...icProperties);
        await icScraper.close();

        status.infocasas.status = 'completed';
        status.infocasas.count = icProperties.length;
      } catch (error) {
        status.infocasas.status = 'error';
        status.infocasas.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Save to database
    let savedCount = 0;
    for (const property of allProperties) {
      try {
        const validatedProperty = {
          ...property,
          publishedAt: property.publishedAt ? new Date(property.publishedAt) : new Date(),
          scrapedAt: new Date(property.scrapedAt || Date.now()),
          updatedAt: new Date(property.updatedAt || Date.now())
        };

        db.insertProperty(validatedProperty);
        savedCount++;
      } catch (error) {
        console.warn(`Skipped invalid property: ${property.title}`, error);
      }
    }

    res.json({
      status,
      totalFound: allProperties.length,
      totalSaved: savedCount,
      properties: allProperties.slice(0, 5) // Return first 5 as preview
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: 'Scraping failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Serve the main app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🏠 BuscaCasas server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
});