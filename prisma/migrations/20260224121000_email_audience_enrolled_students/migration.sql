-- No-op: o valor ENROLLED_STUDENTS passou a fazer parte do CREATE TYPE em
-- 20260502100000_add_email_campaigns_module (ordem cronológica correta).
-- Bancos que já aplicaram a versão antiga (ALTER) já possuem o valor no enum.
SELECT 1;
