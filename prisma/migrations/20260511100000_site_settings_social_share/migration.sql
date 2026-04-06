-- Campos para pré-visualização ao compartilhar o site (Open Graph / WhatsApp / redes).
ALTER TABLE "SiteSettings" ADD COLUMN "socialShareTitle" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "socialShareDescription" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "socialShareImageUrl" TEXT;
