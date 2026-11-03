-- Audit 2026-11 (AUD-15): indexes for the lookups every order view and rate-limit check runs.
-- orderView() reads order_items and order_events by order_id on every order list, track poll and SSE tick;
-- POST /api/v1/incidents counts a reporter's reports in the last hour; the pending-payment sweep scans by status.
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, id);
CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter, created_ms);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_ms);
