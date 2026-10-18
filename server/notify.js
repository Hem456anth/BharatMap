// Notification fan-out. Every notification is persisted (in-app inbox, /api/notifications);
// the Android app polls the feed and raises a native notification via Capacitor LocalNotifications.
// Push while the app is closed needs FCM credentials (FCM_SERVICE_ACCOUNT); see docs/DEPLOYMENT.md.
export function notify(db, userId, { kind, title, body, order_id = null }) {
  if (!userId) return;
  try {
    db.prepare('INSERT INTO notifications(user_id,kind,title,body,order_id) VALUES (?,?,?,?,?)').run(userId, kind, String(title).slice(0, 120), String(body).slice(0, 400), order_id);
  } catch (e) { console.error(JSON.stringify({ level: 'warn', msg: 'notify_failed', err: e.message })); }
}
export function notifyOrderParties(db, orderId, kind, title, body) {
  const o = db.prepare('SELECT o.customer_id, b.owner_id FROM orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=?').get(orderId);
  if (!o) return;
  notify(db, o.customer_id, { kind, title, body, order_id: orderId });
  if (o.owner_id) notify(db, o.owner_id, { kind: `seller_${kind}`, title: `${title} (${orderId})`, body, order_id: orderId });
}
