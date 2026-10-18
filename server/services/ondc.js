// Maps MapOS search results to a Beckn/ONDC `on_search` catalog shape (retail domain).
// PROTOTYPE: real ONDC participation requires registry subscription, ed25519 request
// signing (Authorization header), gateway routing and certification. See docs/RESEARCH.md.
import crypto from 'node:crypto';
import { encodeDigipin } from '../../shared/geo.js';

export function toBecknCatalog(ctx, result) {
  return {
    context: {
      domain: ctx.domain || 'ONDC:RET14', // electronics
      action: 'on_search', version: ctx.version || '1.2.0',
      bap_id: ctx.bap_id || null, bap_uri: ctx.bap_uri || null,
      bpp_id: process.env.ONDC_BPP_ID || 'mapos.demo.bpp', bpp_uri: process.env.ONDC_BPP_URI || 'https://example.invalid/ondc',
      transaction_id: ctx.transaction_id || crypto.randomUUID(), message_id: ctx.message_id || crypto.randomUUID(),
      timestamp: new Date().toISOString(), city: ctx.city || 'std:0891', country: 'IND',
    },
    message: {
      catalog: {
        'bpp/descriptor': { name: 'India MapOS (demo seller network)' },
        'bpp/providers': result.results.map((r) => ({
          id: r.business.id,
          descriptor: { name: r.business.name },
          tags: [{ code: 'verified', list: [{ code: 'status', value: String(r.business.verified) }] }],
          locations: [{ id: `${r.business.id}-loc`, gps: `${r.business.lat},${r.business.lng}`, address: { locality: r.business.address }, digipin: encodeDigipin(r.business.lat, r.business.lng) }],
          fulfillments: [r.business.delivery && { id: 'F1', type: 'Delivery' }, r.business.pickup && { id: 'F2', type: 'Self-Pickup' }].filter(Boolean),
          items: r.products.map((p) => ({
            id: p.id, descriptor: { name: p.name }, category_id: p.category,
            price: { currency: 'INR', value: String(p.price), maximum_value: String(p.mrp || p.price) },
            quantity: { available: { count: String(Math.min(p.stock, 99)) } }, location_id: `${r.business.id}-loc`,
          })),
        })),
      },
    },
  };
}
