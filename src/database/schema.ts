import Database from 'better-sqlite3';

export class PropertyDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.DATABASE_PATH || './data/buscacasas.db';
    this.db = new Database(path);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create properties table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,

        -- Basic info
        title TEXT NOT NULL,
        description TEXT,
        property_type TEXT NOT NULL,

        -- Location
        department TEXT NOT NULL,
        neighborhood TEXT,
        address TEXT,

        -- Price
        price REAL NOT NULL,
        currency TEXT NOT NULL,
        price_per_m2 REAL,

        -- Details
        bedrooms INTEGER,
        bathrooms INTEGER,
        total_area REAL,
        built_area REAL,
        garages INTEGER,

        -- Features
        has_balcony BOOLEAN,
        has_parrillero BOOLEAN,
        has_portero BOOLEAN,
        has_elevator BOOLEAN,
        has_pool BOOLEAN,
        has_gym BOOLEAN,

        -- Images (JSON array)
        images TEXT DEFAULT '[]',
        thumbnail_url TEXT,

        -- Contact
        contact_phone TEXT,
        contact_email TEXT,
        real_estate_agency TEXT,

        -- Metadata
        published_at DATETIME,
        scraped_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,

        UNIQUE(source, source_id)
      );
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_properties_department ON properties(department);
      CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood);
      CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
      CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
      CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
      CREATE INDEX IF NOT EXISTS idx_properties_source ON properties(source);
      CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);
      CREATE INDEX IF NOT EXISTS idx_properties_scraped_at ON properties(scraped_at);
    `);

    // Create search history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filters TEXT NOT NULL, -- JSON
        results_count INTEGER,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create favorites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT NOT NULL,
        notes TEXT,
        added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id),
        UNIQUE(property_id)
      );
    `);
  }

  // Property operations
  insertProperty(property: any) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO properties (
        id, source, source_id, url, title, description, property_type,
        department, neighborhood, address, price, currency, price_per_m2,
        bedrooms, bathrooms, total_area, built_area, garages,
        has_balcony, has_parrillero, has_portero, has_elevator, has_pool, has_gym,
        images, thumbnail_url, contact_phone, contact_email, real_estate_agency,
        published_at, scraped_at, updated_at, is_active
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    return stmt.run(
      property.id,
      property.source,
      property.sourceId,
      property.url,
      property.title,
      property.description,
      property.propertyType,
      property.department,
      property.neighborhood,
      property.address,
      property.price,
      property.currency,
      property.pricePerM2,
      property.bedrooms,
      property.bathrooms,
      property.totalArea,
      property.builtArea,
      property.garages,
      property.hasBalcony,
      property.hasParrillero,
      property.hasPortero,
      property.hasElevator,
      property.hasPool,
      property.hasGym,
      JSON.stringify(property.images || []),
      property.thumbnailUrl,
      property.contactPhone,
      property.contactEmail,
      property.realEstateAgency,
      property.publishedAt?.toISOString(),
      property.scrapedAt.toISOString(),
      property.updatedAt.toISOString(),
      property.isActive ? 1 : 0
    );
  }

  getProperties(filters: any = {}, limit = 50, offset = 0) {
    let query = 'SELECT * FROM properties WHERE is_active = 1';
    const params: any[] = [];

    if (filters.department) {
      query += ' AND department = ?';
      params.push(filters.department);
    }

    if (filters.neighborhood) {
      query += ' AND neighborhood = ?';
      params.push(filters.neighborhood);
    }

    if (filters.propertyType) {
      query += ' AND property_type = ?';
      params.push(filters.propertyType);
    }

    if (filters.minPrice) {
      query += ' AND price >= ?';
      params.push(filters.minPrice);
    }

    if (filters.maxPrice) {
      query += ' AND price <= ?';
      params.push(filters.maxPrice);
    }

    if (filters.currency) {
      query += ' AND currency = ?';
      params.push(filters.currency);
    }

    if (filters.minBedrooms) {
      query += ' AND bedrooms >= ?';
      params.push(filters.minBedrooms);
    }

    query += ' ORDER BY scraped_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getPropertyById(id: string) {
    const stmt = this.db.prepare('SELECT * FROM properties WHERE id = ?');
    return stmt.get(id);
  }

  markPropertyInactive(id: string) {
    const stmt = this.db.prepare('UPDATE properties SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(id);
  }

  getStats() {
    const totalProps = this.db.prepare('SELECT COUNT(*) as count FROM properties WHERE is_active = 1').get() as { count: number };
    const bySource = this.db.prepare('SELECT source, COUNT(*) as count FROM properties WHERE is_active = 1 GROUP BY source').all();
    const byDepartment = this.db.prepare('SELECT department, COUNT(*) as count FROM properties WHERE is_active = 1 GROUP BY department ORDER BY count DESC').all();

    return {
      total: totalProps.count,
      bySource,
      byDepartment
    };
  }

  close() {
    this.db.close();
  }
}