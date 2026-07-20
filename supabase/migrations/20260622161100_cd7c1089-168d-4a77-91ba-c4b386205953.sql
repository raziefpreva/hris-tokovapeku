DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transaksi_ceklist_harian'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transaksi_ceklist_harian';
  END IF;
END $$;
ALTER TABLE public.transaksi_ceklist_harian REPLICA IDENTITY FULL;