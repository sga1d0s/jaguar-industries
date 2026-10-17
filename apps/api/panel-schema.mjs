// Permiso independiente de las membresías de cliente. La API solo puede leerlo;
// conceder acceso al panel exige ejecutar la tarea de administración del NAS.
export async function migratePanel(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_operators (
      user_id uuid PRIMARY KEY REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'client'
      CHECK (kind IN ('client','jaguar'));
    UPDATE organizations SET kind='jaguar' WHERE demo_key='jaguar-demo-owner';
    INSERT INTO organizations(name,kind)
      SELECT 'Industrias Jaguar','jaguar' WHERE NOT EXISTS
      (SELECT 1 FROM organizations WHERE kind='jaguar' AND NOT is_demo);
    CREATE TABLE IF NOT EXISTS panel_audit (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL,
      target_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    GRANT SELECT ON panel_operators, panel_audit TO jaguar_app;
    GRANT INSERT ON panel_audit TO jaguar_app;
    GRANT USAGE ON SEQUENCE panel_audit_id_seq TO jaguar_app;
    GRANT INSERT ON organizations,product_models,product_variants,equipment,equipment_assignments TO jaguar_app;
    GRANT UPDATE(owner_organization_id) ON equipment TO jaguar_app;
    GRANT UPDATE(ends_at) ON equipment_assignments TO jaguar_app;
  `);
}
