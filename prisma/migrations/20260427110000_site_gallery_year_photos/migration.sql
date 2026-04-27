CREATE TABLE IF NOT EXISTS "SiteGalleryYear" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "year" INTEGER NOT NULL,
  "title" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SiteGalleryYear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteGalleryYear_year_key" ON "SiteGalleryYear" ("year");
CREATE INDEX IF NOT EXISTS "SiteGalleryYear_year_idx" ON "SiteGalleryYear" ("year");
CREATE INDEX IF NOT EXISTS "SiteGalleryYear_isActive_idx" ON "SiteGalleryYear" ("isActive");

CREATE TABLE IF NOT EXISTS "SiteGalleryPhoto" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "yearId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "caption" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SiteGalleryPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteGalleryPhoto_yearId_order_idx" ON "SiteGalleryPhoto" ("yearId", "order");

ALTER TABLE "SiteGalleryPhoto"
  ADD CONSTRAINT "SiteGalleryPhoto_yearId_fkey"
  FOREIGN KEY ("yearId") REFERENCES "SiteGalleryYear"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

