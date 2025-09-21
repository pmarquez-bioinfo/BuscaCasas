# 🏠 BuscaCasas

Uruguay real estate aggregator that scrapes MercadoLibre and InfoCasas to help you find your dream home.

## Features

- 🌐 **Beautiful Web Interface**: Modern, responsive UI to browse and filter properties
- 🔍 **Multi-source scraping**: Automatically scrapes properties from MercadoLibre and InfoCasas Uruguay
- 🏷️ **Smart filtering**: Filter by department, neighborhood, price range, property type, and more
- 💾 **Local database**: Save and search scraped properties locally using SQLite
- 💱 **Currency support**: Handles both UYU (Pesos) and USD pricing
- 🖥️ **CLI interface**: Easy-to-use command line interface for scraping and searching
- 📊 **Analytics**: Get insights about scraped properties and market trends
- 🎨 **Property Cards**: Beautiful cards showing property details, images, and features
- 🚀 **Real-time Scraping**: Scrape new properties directly from the web interface

## Installation

1. Clone the repository:
```bash
git clone https://github.com/pmarquez-bioinfo/BuscaCasas.git
cd BuscaCasas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment (optional):
```bash
cp .env.example .env
# Edit .env with your preferences
```

## Usage

### Web Interface (Recommended)

1. Start the web server:
```bash
npm run server
```

2. Open your browser and go to: **http://localhost:3001**

3. Use the web interface to:
   - View all scraped properties with beautiful cards
   - Filter by department, property type, price range, currency
   - See statistics and property counts
   - Click "Scrape Properties" to get new listings
   - Click "View Property" to open the original listing

### CLI Commands

#### Scrape Properties
```bash
# Scrape both MercadoLibre and InfoCasas
npm run scrape

# Scrape only MercadoLibre
npm run scrape -- --source ml

# Scrape with filters
npm run scrape -- --department Montevideo --type apartamento --max-price 200000 --currency USD --save

# Scrape multiple pages
npm run scrape -- --pages 5 --save
```

#### Search Saved Properties
```bash
# Search all saved properties
npm run search

# Search with filters
npm run search -- --department Montevideo --min-price 100000 --max-price 300000 --currency USD

# Search by neighborhood
npm run search -- --neighborhood Pocitos --type apartamento
```

#### View Statistics
```bash
npm run stats
```

### Programmatic Usage

```typescript
import { MercadoLibreScraper, InfoCasasScraper, PropertyDatabase } from './src/index.js';

// Scrape MercadoLibre
const mlScraper = new MercadoLibreScraper();
await mlScraper.initialize();
const properties = await mlScraper.scrapeProperties();
await mlScraper.close();

// Save to database
const db = new PropertyDatabase();
properties.forEach(prop => db.insertProperty(prop));
```

## Property Types

The scraper supports these Uruguay property types:
- `casa` - House
- `apartamento` - Apartment
- `ph` - Penthouse
- `terreno` - Land/Lot
- `local_comercial` - Commercial space

## Departments (Regions)

Common Uruguay departments you can filter by:
- `Montevideo`
- `Canelones`
- `Maldonado`
- `Colonia`
- `San José`
- And more...

## Project Structure

```
src/
├── scrapers/           # Web scrapers for each site
│   ├── mercadolibre.ts # MercadoLibre scraper
│   └── infocasas.ts    # InfoCasas scraper
├── database/           # Database schema and operations
│   └── schema.ts       # SQLite database setup
├── types/              # TypeScript type definitions
│   └── property.ts     # Property data types
├── utils/              # Utility functions
│   └── scraper-base.ts # Base scraper class
├── cli/                # Command line interface
│   └── index.ts        # CLI commands
└── index.ts            # Main entry point
```

## Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

## Environment Variables

Create a `.env` file with these optional settings:

```bash
# Database
DATABASE_PATH=./data/buscacasas.db

# Scraping settings
SCRAPE_DELAY_MS=3000
MAX_PAGES_PER_RUN=5
USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# Development
NODE_ENV=development
LOG_LEVEL=info
```

## Ethical Scraping

This tool implements responsible scraping practices:
- ⏱️ Respectful delays between requests (3+ seconds)
- 🤖 Human-like browser behavior to avoid detection
- 📊 Limited pages per run to avoid overwhelming servers
- 🔄 Rate limiting and error handling

## Legal Notice

This tool is for personal use and educational purposes. Users are responsible for complying with the terms of service of the websites being scraped. Always respect robots.txt and scraping policies.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Made with ❤️ for the Uruguay real estate market