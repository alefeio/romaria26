import { z } from "zod";

export const packageStatusSchema = z.enum(["DRAFT", "SOON", "OPEN", "SOLD_OUT", "CLOSED"]);

const decimalLike = z.union([z.string(), z.number()]).transform((v) => String(v));

export const adminPackageCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: apenas minúsculas, números e hífens."),
  description: z.string().max(100_000).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  price: decimalLike,
  childPrice: decimalLike.optional(),
  breakfastKitAvailable: z.boolean().optional(),
  breakfastKitPrice: decimalLike.optional(),
  kitsDeliveryInfo: z.string().max(20_000).optional().nullable(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD."),
  departureTime: z.string().min(1).max(32),
  boardingLocation: z.string().min(1).max(500),
  capacity: z.number().int().min(1).max(1_000_000),
  status: packageStatusSchema.optional(),
  coverImageUrl: z.string().max(2000).optional().nullable(),
  galleryImages: z.array(z.string().max(2000)).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const adminPackageUpdateSchema = adminPackageCreateSchema.partial();

export const adminReservationStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
});
