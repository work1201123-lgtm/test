/*
# Add storage info and data reset functions

1. New Functions
- `get_storage_info()` — SECURITY DEFINER function that returns total database size (bytes),
  the 500MB free plan limit, and per-table row counts + sizes for the main app tables.
  Returns a JSON object with: total_bytes, limit_bytes, tables[] (name, rows, bytes, pretty_size).
- `reset_financial_data()` — SECURITY DEFINER function that deletes all financial/operational
  data (sessions, transactions, transaction_items, audit_logs, client_payments) and resets
  client balances to 0. Keeps products, stations, price_rules, workers, settings, and reminders.
  Returns a summary of what was deleted.

2. Security
- Both functions are SECURITY DEFINER so the anon-key frontend can call them via RPC.
- `reset_financial_data` is destructive by design (user-requested data reset), but only touches
  financial/operational tables — never products, stations, prices, workers, or settings.
- EXECUTE granted to anon and authenticated roles.
*/

-- Storage info function
CREATE OR REPLACE FUNCTION public.get_storage_info()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bytes bigint;
  limit_bytes bigint := 524288000; -- 500 MB in bytes
  result json;
BEGIN
  SELECT pg_database_size(current_database()) INTO total_bytes;

  SELECT json_build_object(
    'total_bytes', total_bytes,
    'limit_bytes', limit_bytes,
    'tables', json_agg(json_build_object(
      'name', t.tablename,
      'rows', c.reltuples::bigint,
      'bytes', pg_total_relation_size(c.oid),
      'pretty_size', pg_size_pretty(pg_total_relation_size(c.oid))
    ) ORDER BY pg_total_relation_size(c.oid) DESC)
  )
  INTO result
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE t.schemaname = 'public'
    AND t.tablename LIKE 'app_%'
    AND c.relkind = 'r';

  RETURN result;
END;
$$;

-- Reset financial data function
CREATE OR REPLACE FUNCTION public.reset_financial_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sessions_count int;
  transactions_count int;
  items_count int;
  logs_count int;
  payments_count int;
BEGIN
  SELECT count(*) INTO sessions_count FROM app_sessions;
  SELECT count(*) INTO transactions_count FROM app_transactions;
  SELECT count(*) INTO items_count FROM app_transaction_items;
  SELECT count(*) INTO logs_count FROM app_audit_logs;
  SELECT count(*) INTO payments_count FROM app_client_payments;

  -- Delete financial/operational data (child tables first due to FK constraints)
  DELETE FROM app_transaction_items;
  DELETE FROM app_transactions;
  DELETE FROM app_sessions;
  DELETE FROM app_audit_logs;
  DELETE FROM app_client_payments;

  -- Reset client balances to 0
  UPDATE app_clients SET balance = 0;

  -- Reset all stations to available
  UPDATE app_stations SET status = 'available' WHERE status IN ('in_use', 'paused');

  RETURN json_build_object(
    'deleted', json_build_object(
      'sessions', sessions_count,
      'transactions', transactions_count,
      'transaction_items', items_count,
      'audit_logs', logs_count,
      'client_payments', payments_count
    )
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_storage_info() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_financial_data() TO anon, authenticated;
