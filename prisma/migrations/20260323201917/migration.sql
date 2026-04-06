-- Ordem corrigida: os ALTER/CREATE desta migração referiam tabelas criadas só em migrações posteriores (20260401+).
-- O conteúdo foi movido para:
--   20260401100000_lesson_exercises (índice em CourseLessonExerciseOption)
--   20260405100000_add_question_updated_at (DROP DEFAULT em EnrollmentLessonQuestion.updatedAt)
--   20260408100000_exercise_answers_multiple_attempts (rename de índice)
SELECT 1;
