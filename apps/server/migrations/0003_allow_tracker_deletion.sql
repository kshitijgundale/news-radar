-- State versions remain immutable through updates, while deletes caused by
-- removing their owning tracker are allowed to cascade.
DROP TRIGGER state_versions_immutable ON state_versions;

CREATE TRIGGER state_versions_immutable
  BEFORE UPDATE ON state_versions
  FOR EACH ROW EXECUTE FUNCTION reject_state_version_mutation();
