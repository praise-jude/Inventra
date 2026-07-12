-- See note in 20260711191212_create_fraudshield_tables.sql — recreated
-- verbatim purely to reconcile migration history; removed in full by the
-- migration that follows this one.
drop policy if exists "fs_audit_select_org" on public.fraudshield_audit_logs;
create policy "fs_audit_select_org" on public.fraudshield_audit_logs
  for select to authenticated using (
    org_id = fraudshield_current_org() and fraudshield_current_role() in ('owner','administrator','auditor','compliance_officer')
  );
