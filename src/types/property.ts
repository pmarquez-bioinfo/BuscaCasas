import { z } from 'zod';

export const PropertyTypeSchema = z.enum([
  'casa',
  'apartamento',
  'ph',
  'terreno',
  'local_comercial',
  'oficina'
]);

export const CurrencySchema = z.enum(['UYU', 'USD']);

export const PropertySchema = z.object({
  id: z.string(),
  source: z.enum(['mercadolibre', 'infocasas']),
  sourceId: z.string(),
  url: z.string().url(),

  // Basic info
  title: z.string(),
  description: z.string().optional(),
  propertyType: PropertyTypeSchema,

  // Location
  department: z.string(), // Montevideo, Canelones, etc.
  neighborhood: z.string().optional(), // Pocitos, Carrasco, etc.
  address: z.string().optional(),

  // Price
  price: z.number(),
  currency: CurrencySchema,
  pricePerM2: z.number().optional(),

  // Details
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  totalArea: z.number().optional(), // m²
  builtArea: z.number().optional(), // m²
  garages: z.number().optional(),

  // Features (common in Uruguay)
  hasBalcony: z.boolean().optional(),
  hasParrillero: z.boolean().optional(), // BBQ area
  hasPortero: z.boolean().optional(), // Doorman
  hasElevator: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasGym: z.boolean().optional(),

  // Images
  images: z.array(z.string().url()).default([]),
  thumbnailUrl: z.string().url().optional(),

  // Contact
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  realEstateAgency: z.string().optional(),

  // Metadata
  publishedAt: z.date(),
  scrapedAt: z.date(),
  updatedAt: z.date(),
  isActive: z.boolean().default(true)
});

export type Property = z.infer<typeof PropertySchema>;
export type PropertyType = z.infer<typeof PropertyTypeSchema>;
export type Currency = z.infer<typeof CurrencySchema>;

export interface PropertyFilters {
  department?: string;
  neighborhood?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  currency?: Currency;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  minArea?: number;
  maxArea?: number;
  hasParrillero?: boolean;
  hasPortero?: boolean;
  hasElevator?: boolean;
  hasPool?: boolean;
}