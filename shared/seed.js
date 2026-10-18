// DEMO SEED DATA. All businesses, prices, stock and riders are FICTIONAL and for
// demonstration only. Place/area coordinates are approximate public locations.
// Mobility points (metro, chargers, tolls, parking) are illustrative samples;
// production must load them from authorised feeds (see docs/RESEARCH.md).

export const CITIES = {
  vizag: { id: 'vizag', name: 'Visakhapatnam', state: 'Andhra Pradesh', center: { lat: 17.7231, lng: 83.3013 } },
  hyderabad: { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', center: { lat: 17.4239, lng: 78.4738 } },
};

// Localities + landmarks used by the address-intelligence engine.
export const LOCALITIES = [
  // Visakhapatnam
  { name: 'Dwaraka Nagar', city: 'vizag', pincode: '530016', lat: 17.7289, lng: 83.3050, aliases: ['dwarakanagar', 'dwaraka nagar', 'ద్వారకానగర్'] },
  { name: 'MVP Colony', city: 'vizag', pincode: '530017', lat: 17.7425, lng: 83.3360, aliases: ['mvp', 'mvp colony', 'ఎంవీపీ కాలనీ'] },
  { name: 'Gajuwaka', city: 'vizag', pincode: '530026', lat: 17.6900, lng: 83.2120, aliases: ['gajuwaka', 'గాజువాక'] },
  { name: 'Pendurthi', city: 'vizag', pincode: '531173', lat: 17.8100, lng: 83.2020, aliases: ['pendurthi', 'పెందుర్తి'] },
  { name: 'Madhurawada', city: 'vizag', pincode: '530048', lat: 17.8100, lng: 83.3700, aliases: ['madhurawada', 'మధురవాడ'] },
  { name: 'Jagadamba Junction', city: 'vizag', pincode: '530002', lat: 17.7120, lng: 83.2980, aliases: ['jagadamba', 'jagadamba centre', 'జగదాంబ'] },
  { name: 'Seethammadhara', city: 'vizag', pincode: '530013', lat: 17.7430, lng: 83.3150, aliases: ['seethammadhara', 'సీతమ్మధార'] },
  { name: 'NAD Junction', city: 'vizag', pincode: '530009', lat: 17.7390, lng: 83.2370, aliases: ['nad', 'nad kotha road', 'nad junction'] },
  { name: 'Rushikonda', city: 'vizag', pincode: '530045', lat: 17.7820, lng: 83.3850, aliases: ['rushikonda', 'రుషికొండ'] },
  // Hyderabad
  { name: 'Ameerpet', city: 'hyderabad', pincode: '500016', lat: 17.4375, lng: 78.4483, aliases: ['ameerpet', 'అమీర్‌పేట్', 'अमीरपेट'] },
  { name: 'HITEC City', city: 'hyderabad', pincode: '500081', lat: 17.4435, lng: 78.3772, aliases: ['hitech city', 'hitec city', 'madhapur', 'హైటెక్ సిటీ'] },
  { name: 'Kukatpally', city: 'hyderabad', pincode: '500072', lat: 17.4948, lng: 78.3996, aliases: ['kukatpally', 'kphb', 'కూకట్‌పల్లి'] },
  { name: 'Secunderabad', city: 'hyderabad', pincode: '500003', lat: 17.4399, lng: 78.4983, aliases: ['secunderabad', 'సికింద్రాబాద్', 'सिकंदराबाद'] },
  { name: 'Koti', city: 'hyderabad', pincode: '500095', lat: 17.3850, lng: 78.4867, aliases: ['koti', 'కోఠి'] },
  { name: 'Gachibowli', city: 'hyderabad', pincode: '500032', lat: 17.4401, lng: 78.3489, aliases: ['gachibowli', 'గచ్చిబౌలి'] },
  { name: 'Begumpet', city: 'hyderabad', pincode: '500016', lat: 17.4440, lng: 78.4670, aliases: ['begumpet', 'బేగంపేట్'] },
];

export const LANDMARKS = [
  { name: 'RTC Complex', city: 'vizag', lat: 17.7215, lng: 83.3070, aliases: ['rtc complex', 'bus stand', 'dwaraka bus station'] },
  { name: 'Visakhapatnam Railway Station', city: 'vizag', lat: 17.7215, lng: 83.2900, aliases: ['vizag railway station', 'railway station', 'vskp station'] },
  { name: 'RK Beach', city: 'vizag', lat: 17.7140, lng: 83.3230, aliases: ['rk beach', 'ramakrishna beach', 'beach road'] },
  { name: 'CMR Central Mall', city: 'vizag', lat: 17.7440, lng: 83.3350, aliases: ['cmr central', 'cmr mall'] },
  { name: 'Andhra University', city: 'vizag', lat: 17.7300, lng: 83.3200, aliases: ['andhra university', 'au', 'au campus'] },
  { name: 'Ameerpet Metro Station', city: 'hyderabad', lat: 17.4350, lng: 78.4446, aliases: ['ameerpet metro'] },
  { name: 'Charminar', city: 'hyderabad', lat: 17.3616, lng: 78.4747, aliases: ['charminar', 'చార్మినార్'] },
  { name: 'Inorbit Mall', city: 'hyderabad', lat: 17.4344, lng: 78.3866, aliases: ['inorbit', 'inorbit mall'] },
  { name: 'Secunderabad Railway Station', city: 'hyderabad', lat: 17.4337, lng: 78.5016, aliases: ['secunderabad station', 'secunderabad railway station'] },
];

let _pid = 0;
const P = (name, category, brand, price, mrp, stock, extra = {}) => ({
  id: `p${++_pid}`, name, category, brand, price, mrp, stock, unit: extra.unit || 'piece',
  wholesale_price: extra.wholesale_price ?? null, min_wholesale_qty: extra.min_wholesale_qty ?? null,
  tags: extra.tags || [],
});

export const BUSINESSES = [
  // ---- Visakhapatnam ----
  { id: 'b1', name: 'Sri Sai Electronics', type: 'shop', category: 'electronics', city: 'vizag', lat: 17.7295, lng: 83.3062, address: 'Shop 4, near RTC Complex, Dwaraka Nagar, Visakhapatnam 530016', verified: true, rating: 4.4, phone: '+91-90000-00001', hours: '10:00-21:30', delivery: true, pickup: true,
    products: [P('Samsung 43" Crystal 4K LED TV', 'tv', 'Samsung', 28990, 38900, 6, { tags: ['led tv', '4k', 'smart tv'] }), P('LG 32" HD Ready LED TV', 'tv', 'LG', 13490, 17990, 9, { tags: ['led tv', 'hd'] }), P('Mi 43" Full HD Smart LED TV', 'tv', 'Xiaomi', 22499, 29999, 0, { tags: ['led tv', 'smart tv'] }), P('Amazon Fire TV Stick (HD)', 'streaming', 'Amazon', 2999, 4999, 15, { tags: ['fire stick', 'streaming'] })] },
  { id: 'b2', name: 'Vizag Digital World', type: 'shop', category: 'electronics', city: 'vizag', lat: 17.7432, lng: 83.3348, address: 'Opp. CMR Central, MVP Colony, Visakhapatnam 530017', verified: true, rating: 4.6, phone: '+91-90000-00002', hours: '10:00-22:00', delivery: true, pickup: true,
    products: [P('Sony Bravia 43" 4K Google TV', 'tv', 'Sony', 47990, 59900, 3, { tags: ['led tv', '4k', 'smart tv'] }), P('Samsung 43" Crystal 4K LED TV', 'tv', 'Samsung', 29490, 38900, 4, { tags: ['led tv', '4k', 'smart tv'] }), P('TCL 55" 4K QLED TV', 'tv', 'TCL', 34990, 52990, 2, { tags: ['led tv', 'qled', '4k'] }), P('boAt Soundbar 120W', 'audio', 'boAt', 5999, 11990, 10, { tags: ['soundbar'] })] },
  { id: 'b3', name: 'Gajuwaka Electronics Wholesale', type: 'wholesaler', category: 'electronics', city: 'vizag', lat: 17.6912, lng: 83.2140, address: 'Main Road, Gajuwaka, Visakhapatnam 530026', verified: true, rating: 4.1, phone: '+91-90000-00003', hours: '09:30-20:00', delivery: true, pickup: true,
    products: [P('LG 32" HD Ready LED TV', 'tv', 'LG', 13990, 17990, 40, { wholesale_price: 12100, min_wholesale_qty: 5, tags: ['led tv', 'hd'] }), P('Vu 43" Full HD LED TV', 'tv', 'Vu', 18990, 25000, 25, { wholesale_price: 16800, min_wholesale_qty: 5, tags: ['led tv'] }), P('HDMI Cable 2m', 'accessory', 'Generic', 249, 499, 500, { wholesale_price: 120, min_wholesale_qty: 50, tags: ['hdmi'] })] },
  { id: 'b4', name: 'Pendurthi Mobiles & TV', type: 'shop', category: 'electronics', city: 'vizag', lat: 17.8092, lng: 83.2031, address: 'Near Natraj Theatre, Pendurthi, Visakhapatnam 531173', verified: false, rating: 4.0, phone: '+91-90000-00004', hours: '10:00-21:00', delivery: true, pickup: true,
    products: [P('LG 32" HD Ready LED TV', 'tv', 'LG', 13790, 17990, 2, { tags: ['led tv', 'hd'] }), P('Redmi Note 14 5G (8/128)', 'mobile', 'Xiaomi', 18999, 21999, 7, { tags: ['phone', 'mobile'] }), P('TV Wall Mount (32-55")', 'accessory', 'Generic', 699, 1499, 20, { tags: ['wall mount', 'tv stand'] })] },
  { id: 'b5', name: 'Fresh Basket Supermarket', type: 'shop', category: 'grocery', city: 'vizag', lat: 17.7305, lng: 83.3110, address: 'Seethammadhara Main Road, Visakhapatnam 530013', verified: true, rating: 4.3, phone: '+91-90000-00005', hours: '07:00-22:30', delivery: true, pickup: true,
    products: [P('Toned Milk 1L', 'dairy', 'Visakha Dairy', 62, 62, 80, { unit: 'pack', tags: ['milk'] }), P('Sona Masoori Rice 5kg', 'staples', 'Generic', 390, 450, 30, { unit: 'bag', tags: ['rice'] }), P('Onions 1kg', 'vegetables', 'Fresh', 38, 45, 120, { unit: 'kg', tags: ['onion', 'vegetables'] })] },
  { id: 'b6', name: 'Andhra Ruchulu Restaurant', type: 'restaurant', category: 'restaurant', city: 'vizag', lat: 17.7150, lng: 83.3210, address: 'Beach Road, near RK Beach, Visakhapatnam 530002', verified: true, rating: 4.5, phone: '+91-90000-00006', hours: '11:30-23:00', delivery: true, pickup: true,
    products: [P('Andhra Veg Meals', 'meals', 'House', 180, 180, 50, { unit: 'plate', tags: ['meals', 'veg', 'andhra'] }), P('Prawn Fry', 'seafood', 'House', 320, 320, 25, { unit: 'plate', tags: ['prawns', 'seafood'] }), P('Chicken Biryani', 'biryani', 'House', 260, 260, 40, { unit: 'plate', tags: ['biryani'] })] },
  { id: 'b7', name: 'Steel City Hardware & Paints', type: 'shop', category: 'hardware', city: 'vizag', lat: 17.7395, lng: 83.2385, address: 'NAD Kotha Road, Visakhapatnam 530009', verified: true, rating: 4.2, phone: '+91-90000-00007', hours: '09:00-20:30', delivery: true, pickup: true,
    products: [P('Asian Paints Apcolite 4L', 'paint', 'Asian Paints', 1850, 2100, 18, { unit: 'tin', tags: ['paint'] }), P('PVC Pipe 1" 3m', 'plumbing', 'Supreme', 210, 260, 200, { wholesale_price: 175, min_wholesale_qty: 25, tags: ['pipe'] })] },
  { id: 'b8', name: 'Coastal Garments Manufacturing', type: 'manufacturer', category: 'textiles', city: 'vizag', lat: 17.6950, lng: 83.2300, address: 'Autonagar Industrial Area, Visakhapatnam 530012', verified: true, rating: 4.0, phone: '+91-90000-00008', hours: '09:00-18:00', delivery: true, pickup: false,
    products: [P('Cotton T-shirts (bulk, plain)', 'apparel', 'Coastal', 199, 299, 5000, { wholesale_price: 118, min_wholesale_qty: 100, tags: ['tshirt', 'wholesale'] })] },
  { id: 'b9', name: 'MedPlus Point (Demo)', type: 'shop', category: 'pharmacy', city: 'vizag', lat: 17.8085, lng: 83.3690, address: 'Madhurawada, Visakhapatnam 530048', verified: true, rating: 4.3, phone: '+91-90000-00009', hours: '08:00-23:00', delivery: true, pickup: true,
    products: [P('Paracetamol 650mg (15 tabs)', 'medicine', 'Generic', 32, 35, 100, { unit: 'strip', tags: ['paracetamol', 'fever'] }), P('ORS Sachet', 'medicine', 'Generic', 22, 25, 150, { unit: 'sachet', tags: ['ors'] })] },
  { id: 'b10', name: 'QuickFix AC & Appliance Service', type: 'service', category: 'services', city: 'vizag', lat: 17.7270, lng: 83.3000, address: 'Dwaraka Nagar 3rd Lane, Visakhapatnam 530016', verified: false, rating: 4.1, phone: '+91-90000-00010', hours: '09:00-20:00', delivery: false, pickup: false,
    products: [P('AC General Service (split)', 'service', 'QuickFix', 599, 799, 99, { unit: 'visit', tags: ['ac service', 'repair'] }), P('TV Wall Installation', 'service', 'QuickFix', 399, 499, 99, { unit: 'visit', tags: ['tv installation'] })] },
  // ---- Hyderabad ----
  { id: 'b11', name: 'Ameerpet Electronics Hub', type: 'shop', category: 'electronics', city: 'hyderabad', lat: 17.4369, lng: 78.4475, address: 'Near Ameerpet Metro, Ameerpet, Hyderabad 500016', verified: true, rating: 4.5, phone: '+91-90000-00011', hours: '10:00-22:00', delivery: true, pickup: true,
    products: [P('Samsung 43" Crystal 4K LED TV', 'tv', 'Samsung', 28490, 38900, 8, { tags: ['led tv', '4k', 'smart tv'] }), P('OnePlus 50" 4K LED TV', 'tv', 'OnePlus', 31999, 39999, 5, { tags: ['led tv', '4k', 'smart tv'] }), P('Amazon Fire TV Stick (HD)', 'streaming', 'Amazon', 2899, 4999, 20, { tags: ['fire stick', 'streaming'] })] },
  { id: 'b12', name: 'HITEC Gadgets', type: 'shop', category: 'electronics', city: 'hyderabad', lat: 17.4440, lng: 78.3790, address: 'Madhapur Main Road, HITEC City, Hyderabad 500081', verified: true, rating: 4.3, phone: '+91-90000-00012', hours: '10:30-22:00', delivery: true, pickup: true,
    products: [P('Sony Bravia 43" 4K Google TV', 'tv', 'Sony', 46990, 59900, 2, { tags: ['led tv', '4k', 'smart tv'] }), P('LG 43" 4K UHD Smart TV', 'tv', 'LG', 30990, 42990, 6, { tags: ['led tv', '4k', 'smart tv'] })] },
  { id: 'b13', name: 'Koti Electronics Wholesale Market', type: 'wholesaler', category: 'electronics', city: 'hyderabad', lat: 17.3855, lng: 78.4860, address: 'Bank Street, Koti, Hyderabad 500095', verified: true, rating: 4.0, phone: '+91-90000-00013', hours: '10:00-20:30', delivery: true, pickup: true,
    products: [P('LG 32" HD Ready LED TV', 'tv', 'LG', 13290, 17990, 60, { wholesale_price: 11900, min_wholesale_qty: 5, tags: ['led tv', 'hd'] }), P('Vu 43" Full HD LED TV', 'tv', 'Vu', 18490, 25000, 30, { wholesale_price: 16400, min_wholesale_qty: 5, tags: ['led tv'] }), P('LED Bulb 9W (pack of 10)', 'lighting', 'Syska', 690, 1200, 300, { wholesale_price: 520, min_wholesale_qty: 20, tags: ['led bulb', 'lighting'] })] },
  { id: 'b14', name: 'Paradise-style Biryani House (Demo)', type: 'restaurant', category: 'restaurant', city: 'hyderabad', lat: 17.4410, lng: 78.4890, address: 'SD Road, Secunderabad 500003', verified: true, rating: 4.4, phone: '+91-90000-00014', hours: '11:00-23:30', delivery: true, pickup: true,
    products: [P('Hyderabadi Chicken Dum Biryani', 'biryani', 'House', 349, 349, 80, { unit: 'plate', tags: ['biryani'] }), P('Double ka Meetha', 'dessert', 'House', 120, 120, 40, { unit: 'cup', tags: ['dessert'] })] },
  { id: 'b15', name: 'Kukatpally Kirana & Daily Needs', type: 'shop', category: 'grocery', city: 'hyderabad', lat: 17.4935, lng: 78.4010, address: 'KPHB Colony, Kukatpally, Hyderabad 500072', verified: false, rating: 4.1, phone: '+91-90000-00015', hours: '06:30-22:30', delivery: true, pickup: true,
    products: [P('Toned Milk 1L', 'dairy', 'Vijaya', 60, 60, 60, { unit: 'pack', tags: ['milk'] }), P('Atta 5kg', 'staples', 'Aashirvaad', 285, 320, 25, { unit: 'bag', tags: ['atta', 'flour'] })] },
];

export const RIDERS = [
  { id: 'r1', name: 'Ravi K.', vehicle: 'bike', city: 'vizag', lat: 17.7260, lng: 83.3040, available: true },
  { id: 'r2', name: 'Suresh B.', vehicle: 'bike', city: 'vizag', lat: 17.7450, lng: 83.3300, available: true },
  { id: 'r3', name: 'Lakshmi P.', vehicle: 'ev-scooter', city: 'vizag', lat: 17.6950, lng: 83.2200, available: true },
  { id: 'r4', name: 'Appa Rao M.', vehicle: 'mini-truck', city: 'vizag', lat: 17.7000, lng: 83.2350, available: true },
  { id: 'r5', name: 'Imran S.', vehicle: 'bike', city: 'hyderabad', lat: 17.4380, lng: 78.4500, available: true },
  { id: 'r6', name: 'Priya R.', vehicle: 'ev-scooter', city: 'hyderabad', lat: 17.4450, lng: 78.3800, available: true },
  { id: 'r7', name: 'Venkat T.', vehicle: 'mini-truck', city: 'hyderabad', lat: 17.3900, lng: 78.4850, available: true },
];

export const WAREHOUSES = [
  { id: 'w1', name: 'Vizag Micro-Fulfilment Hub (Demo)', city: 'vizag', lat: 17.7350, lng: 83.2700 },
  { id: 'w2', name: 'Hyderabad West Dark Store (Demo)', city: 'hyderabad', lat: 17.4500, lng: 78.3900 },
];

// Illustrative mobility POIs (approximate). Replace with GTFS / OpenChargeMap / NHAI feeds.
export const MOBILITY = [
  { id: 'm1', kind: 'rail', name: 'Visakhapatnam Jn (VSKP)', city: 'vizag', lat: 17.7215, lng: 83.2900 },
  { id: 'm2', kind: 'bus', name: 'Dwaraka RTC Complex', city: 'vizag', lat: 17.7215, lng: 83.3070 },
  { id: 'm3', kind: 'airport', name: 'Visakhapatnam Airport (VTZ)', city: 'vizag', lat: 17.7212, lng: 83.2245 },
  { id: 'm4', kind: 'ev', name: 'EV Fast Charger (sample) – Beach Road', city: 'vizag', lat: 17.7180, lng: 83.3260, meta: '60 kW CCS2 (sample)' },
  { id: 'm5', kind: 'parking', name: 'Multi-level Parking (sample) – Jagadamba', city: 'vizag', lat: 17.7125, lng: 83.2995, meta: '₹20/hr (sample)' },
  { id: 'm6', kind: 'toll', name: 'Toll Plaza (sample) – NH16 Agnampudi', city: 'vizag', lat: 17.6850, lng: 83.1550, meta: 'Car ₹110 one way (sample)' },
  { id: 'm7', kind: 'metro', name: 'Ameerpet Metro (Red/Blue interchange)', city: 'hyderabad', lat: 17.4350, lng: 78.4446 },
  { id: 'm8', kind: 'metro', name: 'HITEC City Metro', city: 'hyderabad', lat: 17.4474, lng: 78.3815 },
  { id: 'm9', kind: 'rail', name: 'Secunderabad Jn (SC)', city: 'hyderabad', lat: 17.4337, lng: 78.5016 },
  { id: 'm10', kind: 'airport', name: 'Rajiv Gandhi Intl Airport (HYD)', city: 'hyderabad', lat: 17.2403, lng: 78.4294 },
  { id: 'm11', kind: 'ev', name: 'EV Fast Charger (sample) – Gachibowli', city: 'hyderabad', lat: 17.4400, lng: 78.3500, meta: '30 kW CCS2 (sample)' },
  { id: 'm12', kind: 'parking', name: 'Metro Parking (sample) – Ameerpet', city: 'hyderabad', lat: 17.4355, lng: 78.4440, meta: '₹30 for 4 hrs (sample)' },
  { id: 'm13', kind: 'toll', name: 'ORR Toll Plaza (sample) – Gachibowli', city: 'hyderabad', lat: 17.4220, lng: 78.3300, meta: 'Car per-km ORR toll (sample)' },
];
