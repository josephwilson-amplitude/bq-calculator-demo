/* B&Q demo catalogue — all data is hardcoded (no backend). Prices include VAT. */
window.BQ_DEPARTMENTS = [
  { slug: 'christmas', name: 'Christmas' },
  { slug: 'outdoor-garden', name: 'Outdoor & Garden' },
  { slug: 'painting-decorating', name: 'Painting & Decorating' },
  { slug: 'home-furniture', name: 'Home & Furniture' },
  { slug: 'building-hardware', name: 'Building & Hardware' },
  { slug: 'kitchen-appliances', name: 'Kitchen & Appliances' },
  { slug: 'bathroom-showers', name: 'Bathroom & Showers' },
  { slug: 'tiling-flooring', name: 'Tiling & Flooring' },
  { slug: 'lighting-electrical', name: 'Lighting & Electrical' },
  { slug: 'tools-equipment', name: 'Tools & Equipment' },
  { slug: 'heating-plumbing', name: 'Heating, Plumbing & Cooling' },
  { slug: 'offers', name: 'Offers & Clearance' }
];

/*
  type: drives the illustration and (for paint / wallpaper / flooring / tiles / decking) the Project Calculator.
  pack: amount one unit covers (litres, m², rolls, boards).
  calcPick: the correct pack the calculator *should* have linked to (used by the experiment treatment).
  stock: 0 = out of stock.
*/
window.BQ_PRODUCTS = [
  // ---------- Paint ----------
  { id: 'ITEM_001', name: 'Valspar Premium Walls & Ceilings Pure Brilliant White Matt Emulsion paint, 5L', brand: 'Valspar', dept: 'painting-decorating', type: 'paint', price: 35.00, pack: 5, packLabel: '5L', colour: '#F7F7F2', rating: 4.4, reviews: 207, stock: 42, calcPick: 'ITEM_001', viewed: 107 },
  { id: 'ITEM_002', name: 'Valspar Premium Walls & Ceilings Pure Brilliant White Matt Emulsion paint, 2.5L', brand: 'Valspar', dept: 'painting-decorating', type: 'paint', price: 21.00, pack: 2.5, packLabel: '2.5L', colour: '#F7F7F2', rating: 4.4, reviews: 207, stock: 18, calcPick: 'ITEM_001' },
  { id: 'ITEM_003', name: 'Valspar Premium Walls & Ceilings Pure Brilliant White Matt Emulsion paint, 1L', brand: 'Valspar', dept: 'painting-decorating', type: 'paint', price: 12.00, pack: 1, packLabel: '1L', colour: '#F7F7F2', rating: 4.3, reviews: 64, stock: 30, calcPick: 'ITEM_001' },
  { id: 'ITEM_004', name: 'Valspar Premium Walls & Ceilings Pure Brilliant White Silk Emulsion paint, 5L', brand: 'Valspar', dept: 'painting-decorating', type: 'paint', price: 35.00, pack: 5, packLabel: '5L', colour: '#FFFFFF', rating: 4.2, reviews: 88, stock: 12, calcPick: 'ITEM_004', finish: 'Silk' },
  { id: 'ITEM_005', name: 'Valspar Premium Walls & Ceilings Pure Brilliant White Matt Emulsion paint, 10L', brand: 'Valspar', dept: 'painting-decorating', type: 'paint', price: 58.00, pack: 10, packLabel: '10L', colour: '#F7F7F2', rating: 4.5, reviews: 41, stock: 0, calcPick: 'ITEM_001' },
  { id: 'ITEM_006', name: 'GoodHome Durable Kerala Matt Emulsion paint, 2.5L', brand: 'GoodHome', dept: 'painting-decorating', type: 'paint', price: 24.00, pack: 2.5, packLabel: '2.5L', colour: '#CDBE9F', rating: 4.6, reviews: 312, stock: 25, calcPick: 'ITEM_006', viewed: 64 },
  { id: 'ITEM_007', name: 'Dulux Easycare Washable & Tough Pure Brilliant White Matt Emulsion paint, 2.5L', brand: 'Dulux', dept: 'painting-decorating', type: 'paint', price: 32.00, wasPrice: 38.00, pack: 2.5, packLabel: '2.5L', colour: '#FBFBF8', rating: 4.5, reviews: 529, stock: 40, calcPick: 'ITEM_007' },
  { id: 'ITEM_008', name: 'Crown Walls & Ceilings Pure Brilliant White Matt Emulsion paint, 5L', brand: 'Crown', dept: 'painting-decorating', type: 'paint', price: 30.00, pack: 5, packLabel: '5L', colour: '#F5F5F0', rating: 4.1, reviews: 96, stock: 0, calcPick: 'ITEM_008' },
  { id: 'ITEM_009', name: 'Valspar Premium Walls & Ceilings Pure Brilliant White Matt Emulsion tester pot, 60ml', brand: 'Valspar', dept: 'painting-decorating', type: 'paint', price: 4.00, pack: 0.06, packLabel: '60ml', colour: '#F7F7F2', rating: 4.0, reviews: 22, stock: 80, calcPick: 'ITEM_001' },
  { id: 'ITEM_010', name: 'GoodHome Durable Lisbon Matt Emulsion paint, 2.5L', brand: 'GoodHome', dept: 'painting-decorating', type: 'paint', price: 24.00, pack: 2.5, packLabel: '2.5L', colour: '#7E9AA6', rating: 4.6, reviews: 141, stock: 9, calcPick: 'ITEM_010' },

  // ---------- Wallpaper ----------
  { id: 'ITEM_011', name: 'GoodHome Elymus Green Leaves Textured Wallpaper', brand: 'GoodHome', dept: 'painting-decorating', type: 'wallpaper', price: 20.00, pack: 1, packLabel: '1 roll (10.05m x 0.53m)', colour: '#5F7F5B', rating: 4.5, reviews: 73, stock: 30, calcPick: 'ITEM_011' },
  { id: 'ITEM_012', name: 'GoodHome Elymus Grey Leaves Textured Wallpaper', brand: 'GoodHome', dept: 'painting-decorating', type: 'wallpaper', price: 20.00, pack: 1, packLabel: '1 roll (10.05m x 0.53m)', colour: '#8A9094', rating: 4.3, reviews: 18, stock: 6, calcPick: 'ITEM_012' },
  { id: 'ITEM_013', name: 'Graham & Brown Leaves Green Smooth Wallpaper sample', brand: 'Graham & Brown', dept: 'painting-decorating', type: 'wallpaper', price: 1.00, pack: 0.05, packLabel: 'A4 sample', colour: '#6C8C5A', rating: 4.0, reviews: 4, stock: 50, calcPick: 'ITEM_013' },
  { id: 'ITEM_014', name: 'GoodHome Elymus Green Leaves Textured Wallpaper, double roll', brand: 'GoodHome', dept: 'painting-decorating', type: 'wallpaper', price: 38.00, pack: 2, packLabel: '2 rolls', colour: '#5F7F5B', rating: 4.5, reviews: 9, stock: 0, calcPick: 'ITEM_011' },

  // ---------- Decorating tools ----------
  { id: 'ITEM_015', shape: 'roller', name: 'Diall 9" Medium pile Roller & tray set', brand: 'Diall', dept: 'painting-decorating', type: 'tool', price: 8.00, colour: '#FA6400', rating: 4.4, reviews: 410, stock: 99 },
  { id: 'ITEM_016', shape: 'brush', name: 'Diall Synthetic Paint brush set, Pack of 5', brand: 'Diall', dept: 'painting-decorating', type: 'tool', price: 7.00, colour: '#323C41', rating: 4.2, reviews: 233, stock: 99 },
  { id: 'ITEM_017', shape: 'tape', name: 'Diall Low tack Masking tape (L)50m (W)25mm', brand: 'Diall', dept: 'painting-decorating', type: 'tool', price: 4.50, colour: '#E9D8A6', rating: 4.3, reviews: 156, stock: 99 },
  { id: 'ITEM_018', shape: 'sheet', name: 'Diall Polythene Dust sheet (L)3.6m (W)2.7m', brand: 'Diall', dept: 'painting-decorating', type: 'tool', price: 3.00, colour: '#BFD6E6', rating: 4.1, reviews: 98, stock: 99 },

  // ---------- Flooring ----------
  { id: 'ITEM_020', name: 'GoodHome Ostrava Natural Oak effect Laminate Flooring, 2.13m² Pack', brand: 'GoodHome', dept: 'tiling-flooring', type: 'flooring', price: 29.97, pack: 2.13, packLabel: '2.13m² pack', colour: '#C49A6C', rating: 4.5, reviews: 188, stock: 60, calcPick: 'ITEM_020', viewed: 51 },
  { id: 'ITEM_021', name: 'GoodHome Ostrava Grey Oak effect Laminate Flooring, 2.13m² Pack', brand: 'GoodHome', dept: 'tiling-flooring', type: 'flooring', price: 29.97, pack: 2.13, packLabel: '2.13m² pack', colour: '#9A9893', rating: 4.4, reviews: 77, stock: 20, calcPick: 'ITEM_021' },
  { id: 'ITEM_022', name: 'Colours Leggiero Natural Oak effect Laminate Flooring, 1.76m² Pack', brand: 'Colours', dept: 'tiling-flooring', type: 'flooring', price: 19.50, pack: 1.76, packLabel: '1.76m² pack', colour: '#CFA77A', rating: 4.0, reviews: 52, stock: 0, calcPick: 'ITEM_022' },
  { id: 'ITEM_023', name: 'GoodHome Ostrava Natural Oak effect Laminate Flooring sample', brand: 'GoodHome', dept: 'tiling-flooring', type: 'flooring', price: 2.00, pack: 0.02, packLabel: 'Sample', colour: '#C49A6C', rating: 4.1, reviews: 11, stock: 40, calcPick: 'ITEM_020' },
  { id: 'ITEM_024', name: 'Diall 3mm Fibreboard Laminate underlay, 5m² Pack', brand: 'Diall', dept: 'tiling-flooring', type: 'flooring', price: 14.00, pack: 5, packLabel: '5m² pack', colour: '#B8A27E', rating: 4.3, reviews: 120, stock: 33, calcPick: 'ITEM_024' },

  // ---------- Tiles ----------
  { id: 'ITEM_030', name: 'Cimenti Light grey Matt Concrete effect Porcelain Wall & floor Tile, Pack of 3, (L)600mm (W)600mm', brand: 'GoodHome', dept: 'tiling-flooring', type: 'tiles', price: 32.00, pack: 1.08, packLabel: '1.08m² pack', colour: '#BDBDB8', rating: 4.6, reviews: 95, stock: 48, calcPick: 'ITEM_030' },
  { id: 'ITEM_031', name: 'Cimenti Dark grey Matt Concrete effect Porcelain Wall & floor Tile, Pack of 3', brand: 'GoodHome', dept: 'tiling-flooring', type: 'tiles', price: 32.00, pack: 1.08, packLabel: '1.08m² pack', colour: '#6B6E70', rating: 4.5, reviews: 40, stock: 14, calcPick: 'ITEM_031' },
  { id: 'ITEM_032', name: 'Cimenti Light grey Matt Concrete effect Porcelain Tile, Single sample', brand: 'GoodHome', dept: 'tiling-flooring', type: 'tiles', price: 3.00, pack: 0.36, packLabel: '1 tile', colour: '#BDBDB8', rating: 4.0, reviews: 6, stock: 30, calcPick: 'ITEM_030' },
  { id: 'ITEM_033', name: 'Konkrete Grey Matt Porcelain Floor Tile, 1.44m² Pack', brand: 'Colours', dept: 'tiling-flooring', type: 'tiles', price: 27.00, pack: 1.44, packLabel: '1.44m² pack', colour: '#A9A9A4', rating: 3.9, reviews: 28, stock: 0, calcPick: 'ITEM_033' },
  { id: 'ITEM_034', shape: 'tub', name: 'GoodHome Ready mixed Grey Wall & floor Tile adhesive & grout, 15kg', brand: 'GoodHome', dept: 'tiling-flooring', type: 'tool', price: 22.00, colour: '#9EA3A6', rating: 4.4, reviews: 61, stock: 22 },

  // ---------- Decking ----------
  { id: 'ITEM_040', name: 'Blooma Ashmore Brown Softwood Deck board (L)2.4m (W)144mm (T)28mm', brand: 'Blooma', dept: 'outdoor-garden', type: 'decking', price: 13.50, pack: 0.3456, packLabel: '1 board (2.4m)', colour: '#8B5E3C', rating: 4.3, reviews: 143, stock: 200, calcPick: 'ITEM_040', viewed: 38 },
  { id: 'ITEM_041', name: 'Blooma Ashmore Green Softwood Deck board (L)3.6m (W)144mm (T)28mm', brand: 'Blooma', dept: 'outdoor-garden', type: 'decking', price: 19.00, pack: 0.5184, packLabel: '1 board (3.6m)', colour: '#7C7A4E', rating: 4.1, reviews: 35, stock: 0, calcPick: 'ITEM_041' },
  { id: 'ITEM_042', name: 'Blooma Ashmore Brown Softwood Deck board, Pack of 10', brand: 'Blooma', dept: 'outdoor-garden', type: 'decking', price: 149.00, wasPrice: 169.00, pack: 3.456, packLabel: '10 boards', colour: '#8B5E3C', rating: 4.4, reviews: 19, stock: 8, calcPick: 'ITEM_040' },
  { id: 'ITEM_043', name: 'Blooma Composite Deck board Walnut (L)2.2m (W)140mm', brand: 'Blooma', dept: 'outdoor-garden', type: 'decking', price: 32.00, pack: 0.308, packLabel: '1 board (2.2m)', colour: '#5C4033', rating: 4.6, reviews: 57, stock: 15, calcPick: 'ITEM_043' },

  // ---------- Other departments ----------
  { id: 'ITEM_050', shape: 'furniture', name: 'Verve Rattan effect 4 seater Garden furniture set', brand: 'Verve', dept: 'outdoor-garden', type: 'garden', price: 299.00, wasPrice: 349.00, colour: '#6E5A45', rating: 4.5, reviews: 88, stock: 7 },
  { id: 'ITEM_051', shape: 'mower', name: 'Verve 18V Cordless Lawnmower 33cm', brand: 'Verve', dept: 'outdoor-garden', type: 'garden', price: 129.00, colour: '#5DA130', rating: 4.3, reviews: 203, stock: 11 },
  { id: 'ITEM_052', shape: 'drill', name: 'Erbauer 18V Li-ion EXT Cordless Combi drill, 2 x 2Ah', brand: 'Erbauer', dept: 'tools-equipment', type: 'power', price: 99.00, wasPrice: 129.00, colour: '#F0A500', rating: 4.7, reviews: 1204, stock: 54, viewed: 212 },
  { id: 'ITEM_053', shape: 'jigsaw', name: 'Mac Allister 18V Cordless Jigsaw (Bare)', brand: 'Mac Allister', dept: 'tools-equipment', type: 'power', price: 39.00, colour: '#1F6FB2', rating: 4.2, reviews: 301, stock: 19 },
  { id: 'ITEM_054', shape: 'toolkit', name: 'Magnusson 101 piece Mixed Tool kit', brand: 'Magnusson', dept: 'tools-equipment', type: 'power', price: 45.00, colour: '#D92910', rating: 4.6, reviews: 412, stock: 30 },
  { id: 'ITEM_055', shape: 'pendant', name: 'GoodHome Pendant Ceiling light, Black', brand: 'GoodHome', dept: 'lighting-electrical', type: 'light', price: 25.00, colour: '#323C41', rating: 4.4, reviews: 66, stock: 25 },
  { id: 'ITEM_056', shape: 'batten', name: 'Diall LED Batten light 1500mm', brand: 'Diall', dept: 'lighting-electrical', type: 'light', price: 18.00, colour: '#E6E8E9', rating: 4.5, reviews: 140, stock: 40 },
  { id: 'ITEM_057', shape: 'vanity', name: 'Cooke & Lewis Duchesse Gloss White Freestanding Vanity unit & basin set', brand: 'Cooke & Lewis', dept: 'bathroom-showers', type: 'bath', price: 249.00, colour: '#F2F2F2', rating: 4.3, reviews: 59, stock: 5 },
  { id: 'ITEM_058', shape: 'shower', name: 'GoodHome Teesta Chrome effect Thermostatic Mixer shower', brand: 'GoodHome', dept: 'bathroom-showers', type: 'bath', price: 139.00, colour: '#B7BEC2', rating: 4.4, reviews: 92, stock: 13 },
  { id: 'ITEM_059', shape: 'door', name: 'GoodHome Garcinia Gloss White Kitchen cabinet door (W)500mm', brand: 'GoodHome', dept: 'kitchen-appliances', type: 'kitchen', price: 29.00, colour: '#F4F4F2', rating: 4.2, reviews: 84, stock: 60 },
  { id: 'ITEM_060', shape: 'microwave', name: 'Cooke & Lewis CLMW20 Freestanding Microwave, White', brand: 'Cooke & Lewis', dept: 'kitchen-appliances', type: 'kitchen', price: 59.00, colour: '#ECECEC', rating: 4.1, reviews: 133, stock: 21 },
  { id: 'ITEM_061', shape: 'mirror', name: 'GoodHome Oval Mirror (H)80cm (W)50cm', brand: 'GoodHome', dept: 'home-furniture', type: 'home', price: 45.00, colour: '#C9B48A', rating: 4.6, reviews: 47, stock: 16 },
  { id: 'ITEM_062', shape: 'shelf', name: 'GoodHome Atomia 3 Shelf Bookcase, Oak effect', brand: 'GoodHome', dept: 'home-furniture', type: 'home', price: 65.00, wasPrice: 79.00, colour: '#B08A5E', rating: 4.3, reviews: 71, stock: 9 },
  { id: 'ITEM_063', shape: 'bag', name: 'Blue Circle Multi-purpose Cement, 25kg', brand: 'Blue Circle', dept: 'building-hardware', type: 'build', price: 8.75, colour: '#9EA3A6', rating: 4.7, reviews: 510, stock: 300 },
  { id: 'ITEM_064', shape: 'screws', name: 'Diall Pozi Zinc-plated Steel Wood screw, Pack of 200', brand: 'Diall', dept: 'building-hardware', type: 'build', price: 6.00, colour: '#C0C4C6', rating: 4.5, reviews: 228, stock: 300 },
  { id: 'ITEM_065', shape: 'radiator', name: 'GoodHome 1000W Oil-filled Radiator', brand: 'GoodHome', dept: 'heating-plumbing', type: 'heat', price: 49.00, colour: '#F4F4F2', rating: 4.2, reviews: 64, stock: 18 },
  { id: 'ITEM_066', shape: 'tap', name: 'Flomasta Chrome effect Pillar tap, Pair', brand: 'Flomasta', dept: 'heating-plumbing', type: 'heat', price: 22.00, colour: '#B7BEC2', rating: 4.0, reviews: 39, stock: 26 },
  { id: 'ITEM_067', shape: 'tree', name: 'Pre-lit 6ft Hamilton Artificial Christmas tree', brand: 'B&Q', dept: 'christmas', type: 'xmas', price: 75.00, wasPrice: 100.00, colour: '#2E6B3A', rating: 4.6, reviews: 302, stock: 23 },
  { id: 'ITEM_068', shape: 'lights', name: 'Warm white 200 LED String lights', brand: 'B&Q', dept: 'christmas', type: 'xmas', price: 12.00, colour: '#F2C14E', rating: 4.4, reviews: 188, stock: 90 },
  { id: 'ITEM_069', shape: 'wreath', name: 'Red Velvet Christmas wreath, 50cm', brand: 'B&Q', dept: 'christmas', type: 'xmas', price: 18.00, colour: '#B3202E', rating: 4.5, reviews: 41, stock: 33 },
  // ---------- Popular everyday items (these are what a loose keyword search drags in) ----------
  { id: 'ITEM_070', shape: 'tube', name: 'Diall White Silicone-based Sanitary sealant, 300ml', brand: 'Diall', dept: 'building-hardware', type: 'build', price: 5.50, colour: '#FFFFFF', rating: 4.5, reviews: 1450, stock: 300 },
  { id: 'ITEM_071', shape: 'socket', name: 'LAP White 13A Switched Double Socket', brand: 'LAP', dept: 'lighting-electrical', type: 'light', price: 4.00, colour: '#FFFFFF', rating: 4.6, reviews: 980, stock: 300 },
  { id: 'ITEM_072', shape: 'toilet', name: 'Cooke & Lewis White Soft close Toilet seat', brand: 'Cooke & Lewis', dept: 'bathroom-showers', type: 'bath', price: 25.00, colour: '#FFFFFF', rating: 4.3, reviews: 744, stock: 40 },
  { id: 'ITEM_073', shape: 'worktop', name: 'GoodHome Oak effect Laminate Kitchen worktop (L)3m (D)600mm', brand: 'GoodHome', dept: 'kitchen-appliances', type: 'kitchen', price: 75.00, colour: '#C49A6C', rating: 4.4, reviews: 602, stock: 25 },
  { id: 'ITEM_074', shape: 'handle', name: 'GoodHome Matt black Lever on rose Door handle, Pair', brand: 'GoodHome', dept: 'building-hardware', type: 'build', price: 12.00, colour: '#222222', rating: 4.4, reviews: 300, stock: 80 },
  { id: 'ITEM_075', shape: 'rainhead', name: 'GoodHome Matt black Round Rain shower head, 250mm', brand: 'GoodHome', dept: 'bathroom-showers', type: 'bath', price: 39.00, colour: '#222222', rating: 4.2, reviews: 233, stock: 30 }
];

/* What the calculator suggests alongside each type. */
window.BQ_GOES_WITH = {
  paint: ['ITEM_015', 'ITEM_016', 'ITEM_017', 'ITEM_018'],
  wallpaper: ['ITEM_015', 'ITEM_018', 'ITEM_017', 'ITEM_016'],
  flooring: ['ITEM_024', 'ITEM_064', 'ITEM_054', 'ITEM_023'],
  tiles: ['ITEM_034', 'ITEM_054', 'ITEM_032', 'ITEM_018'],
  decking: ['ITEM_064', 'ITEM_052', 'ITEM_050', 'ITEM_053'],
  _default: ['ITEM_052', 'ITEM_001', 'ITEM_020', 'ITEM_067']
};

window.BQ_OFFERS = [
  { id: 'OFFER_NAILED', title: 'Prices. Nailed.', blurb: "We've nailed down prices on hundreds of indoor and outdoor essentials.", offer_type: 'percentage_off', offer_pct: 0.10, saving_amount: 10, code: 'NAILED10', link: 'category.html?c=offers' },
  { id: 'OFFER_PAINT', title: '3 for 2 on Valspar 2.5L', blurb: 'Mix and match any Valspar Premium 2.5L tins. Cheapest one free.', offer_type: 'bundle', offer_pct: 0.33, saving_amount: 21, code: null, link: 'product.html?id=ITEM_002' },
  { id: 'OFFER_CLUB', title: 'B&Q Club: 30 days free', blurb: 'Join B&Q Club for member-only deals and a free trial of our Pro services.', offer_type: 'free_trial', offer_pct: 0, saving_amount: 0, code: 'CLUBFREE', link: 'account.html' }
];

window.BQ_VOUCHERS = {
  NAILED10: { offer_type: 'percentage_off', offer_pct: 0.10, label: '10% off your order' },
  BLACKFRIDAY: { offer_type: 'percentage_off', offer_pct: 0.15, label: '15% off Black Friday' }
};
