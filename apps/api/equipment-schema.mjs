// Migración aditiva: no modifica cuentas, sesiones ni equipos existentes.
// La asignación conserva el histórico mediante fechas; la autorización usa solo la vigente.
export async function migrateEquipment(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
      demo_key text UNIQUE, is_demo boolean NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS memberships (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL REFERENCES organizations(id),
      PRIMARY KEY(user_id, organization_id));
    CREATE TABLE IF NOT EXISTS product_models (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
      name text NOT NULL, category text NOT NULL, description text NOT NULL);
    CREATE TABLE IF NOT EXISTS product_variants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES product_models(id),
      reference text NOT NULL UNIQUE, name text NOT NULL, specifications jsonb NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS equipment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL REFERENCES product_variants(id),
      owner_organization_id uuid NOT NULL REFERENCES organizations(id), serial_number text NOT NULL UNIQUE,
      nfc_uid text UNIQUE, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS equipment_assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES equipment(id),
      client_organization_id uuid NOT NULL REFERENCES organizations(id),
      kind text NOT NULL CHECK(kind IN ('sale','rental')), starts_at timestamptz NOT NULL DEFAULT now(),
      ends_at timestamptz, CHECK(ends_at IS NULL OR ends_at > starts_at));
    CREATE INDEX IF NOT EXISTS assignments_client_idx ON equipment_assignments(client_organization_id, equipment_id);
    CREATE TABLE IF NOT EXISTS product_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_key text NOT NULL UNIQUE,
      title text NOT NULL, kind text NOT NULL CHECK(kind IN ('datasheet','manual','declaration')),
      language text NOT NULL, revision text, downloaded_on date NOT NULL,
      sha256 text NOT NULL, source_url text NOT NULL, byte_size integer NOT NULL CHECK(byte_size>0));
    CREATE TABLE IF NOT EXISTS model_documents (
      model_id uuid NOT NULL REFERENCES product_models(id), document_id uuid NOT NULL REFERENCES product_documents(id),
      PRIMARY KEY(model_id, document_id));
    GRANT SELECT ON organizations, memberships, product_models, product_variants,
      equipment, equipment_assignments, product_documents, model_documents TO jaguar_app;
  `);
}
