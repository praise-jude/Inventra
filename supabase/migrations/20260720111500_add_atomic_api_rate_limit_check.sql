-- SECURITY FIX: the app-layer rate limiter (count api_key_requests, then
-- insert) had a real check-then-act race under concurrent requests —
-- confirmed live: 70 requests fired via Promise.all all returned 200, zero
-- 429s, because each request's count query ran before any of the other
-- 69 requests' inserts had committed. pg_advisory_xact_lock serializes
-- concurrent calls for the SAME api_key_id (hashed to a lock key) so the
-- count-then-insert becomes atomic per key, while different keys never
-- block each other. The lock is transaction-scoped and releases
-- automatically when this function's implicit transaction ends.
create or replace function check_and_log_api_request(
  p_api_key_id uuid,
  p_method text,
  p_path text,
  p_window_seconds int default 60,
  p_max_requests int default 60
) returns boolean
language plpgsql as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_api_key_id::text));

  select count(*) into v_count
  from api_key_requests
  where api_key_id = p_api_key_id
    and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_max_requests then
    return false;
  end if;

  insert into api_key_requests (api_key_id, method, path) values (p_api_key_id, p_method, p_path);
  return true;
end;
$$;
