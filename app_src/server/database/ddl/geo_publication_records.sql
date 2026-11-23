-- geo_publication_records 建表 DDL
-- 执行命令：lark-cli apps +db-execute --app-id "app_17hwmq4p6qy" --sql "<ddl>" --yes
-- 执行后运行：npm run gen:db-schema 刷新 schema.ts

CREATE TABLE IF NOT EXISTS geo_publication_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(20) NOT NULL, -- article / image / video
  content_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  media_library VARCHAR(100) NOT NULL DEFAULT '',
  platform VARCHAR(50) NOT NULL,
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / published / failed
  publish_url TEXT,
  remark TEXT,
  creator_id UUID NOT NULL,
  _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_geo_publication_records_brand_id ON geo_publication_records(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_publication_records_content_type ON geo_publication_records(content_type);
CREATE INDEX IF NOT EXISTS idx_geo_publication_records_status ON geo_publication_records(status);
CREATE INDEX IF NOT EXISTS idx_geo_publication_records_platform ON geo_publication_records(platform);
CREATE INDEX IF NOT EXISTS idx_geo_publication_records_created_at ON geo_publication_records(_created_at DESC);

-- RLS
ALTER TABLE geo_publication_records ENABLE ROW LEVEL SECURITY;

-- 已有 geo_anon 用户建 policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'geo_publication_records'
      AND policyname = 'geo_publication_records_select'
  ) THEN
    CREATE POLICY geo_publication_records_select ON geo_publication_records
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'geo_publication_records'
      AND policyname = 'geo_publication_records_insert'
  ) THEN
    CREATE POLICY geo_publication_records_insert ON geo_publication_records
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'geo_publication_records'
      AND policyname = 'geo_publication_records_update'
  ) THEN
    CREATE POLICY geo_publication_records_update ON geo_publication_records
      FOR UPDATE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'geo_publication_records'
      AND policyname = 'geo_publication_records_delete'
  ) THEN
    CREATE POLICY geo_publication_records_delete ON geo_publication_records
      FOR DELETE USING (true);
  END IF;
END $$;
