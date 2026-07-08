-- ============================================================================
-- Inventra — POS & receipt printing integrations
-- Extends the existing generic integrations (provider/status toggle) system
-- with three new providers: online POS, offline POS, and receipt printing.
-- Backfills default 'not_connected' rows for existing orgs and extends
-- handle_new_user() so new orgs get them seeded too.
-- ============================================================================

alter type integration_provider add value 'pos_online';
alter type integration_provider add value 'pos_offline';
alter type integration_provider add value 'receipt_printing';
