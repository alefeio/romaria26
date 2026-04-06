-- AlterTable: adiciona updatedAt em EnrollmentLessonQuestion (edição de comentário)
ALTER TABLE "EnrollmentLessonQuestion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EnrollmentLessonQuestion" ALTER COLUMN "updatedAt" DROP DEFAULT;
