-- Garante no banco que nunca fica zero super admin, mesmo sob concorrência:
-- duas requisições de dois super admins rebaixando um ao outro ao mesmo
-- tempo passam ambas pela checagem da aplicação (cada uma vê o outro ainda
-- como super admin), então a proteção real tem que travar no banco. O
-- advisory lock serializa as trocas que saem de "super_admin" antes de
-- contar quantos super admins restam.
CREATE OR REPLACE FUNCTION enforce_min_one_super_admin() RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
    PERFORM pg_advisory_xact_lock(872934612);
    IF NOT EXISTS (
      SELECT 1 FROM teachers WHERE role = 'super_admin' AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'Não é possível remover o último super admin do sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teachers_min_super_admin ON teachers;
CREATE TRIGGER teachers_min_super_admin
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION enforce_min_one_super_admin();
