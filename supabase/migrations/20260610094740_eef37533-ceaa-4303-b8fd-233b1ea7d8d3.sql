
CREATE POLICY "bukti_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'bukti-tugas');
CREATE POLICY "bukti_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bukti-tugas');
CREATE POLICY "bukti_update_owner" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'bukti-tugas' AND owner = auth.uid());
CREATE POLICY "bukti_delete_owner" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'bukti-tugas' AND owner = auth.uid());
