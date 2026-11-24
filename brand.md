# B&Q brand notes (from www.diy.com, captured 24 Nov 2026)

Source: live diy.com homepage and a search results page, rendered in Chrome. Colour values are
computed CSS read from the live DOM, not guesses.

## Palette

| Role | Hex | Where it appears on diy.com |
|---|---|---|
| Header / text charcoal | `#323C41` | Utility bar and main header background; body text colour. Most-used colour on the page |
| Nav bar slate | `#464F54` | Department nav row under the header |
| B&Q orange (brand) | `#FA6400` / `#FF6600` | Logo tile, icons, promo CTAs ("Shop all Black Friday deals" is white with orange text), cookie buttons |
| Add to basket green | `#098638` | **Primary commerce CTA**: every "Add to basket" button |
| Promo yellow | `#FFE500` | Top announcement strip (Black Friday banner) |
| Sale red | `#D92910` | Price-drop and saving labels |
| Mid grey (secondary text) | `#676E72` | Prices on cards, meta text |
| Border grey | `#D6D8D9` | Dividers, input borders |
| Light grey surface | `#EFF0F0` | USP strip, section backgrounds |
| Background | `#FFFFFF` | Page |

Primary CTA = green `#098638` (Add to basket, checkout). Orange is brand and promo, not the buy button.

## Type

- Real site uses **GoodHome** (Kingfisher's proprietary typeface) for headings and body, with Inter loaded too.
- Demo uses **Figtree** (Google Fonts), the closest free match to GoodHome's rounded geometric
  sans, with fallback `"Figtree", "Inter", Arial, sans-serif`.
- Headings are bold and fairly large ("Find what you need" sits at about 30px). Body is 14–16px.

## Logo

Orange square tile with a white bold "B&Q" wordmark, top left of the charcoal header, next to a
wide search box. The demo recreates it as a CSS tile, with no image asset.

## Buttons

- **Square corners** (border-radius 0) everywhere.
- Solid fill, bold weight (700), white text. Padding around 12px 28px; Add to basket buttons are full width on cards.
- Variants: green fill (buy), white with orange text (promo), charcoal fill (secondary).
- Hover: the demo darkens the fill slightly (inferred, since hover states could not be read from a static capture).

## Navigation

1. Yellow announcement strip: one underlined link.
2. Charcoal utility row: B&Q Club | Customer support | Sell on diy.com, then on the right: postcode for delivery and collection, Wish list | Register | Sign in.
3. Charcoal main row: logo, large search box, then icon links: Hello B&Q, Ideas & Advice, Services, Stores, Basket.
4. Slate department nav: Christmas, Outdoor & Garden, Painting & Decorating, Home & Furniture,
   Building & Hardware, Kitchen & Appliances, Bathroom & Showers, Tiling & Flooring,
   Lighting & Electrical, Tools & Equipment, Heating, Plumbing & Cooling, Offers & Clearance.
5. Light grey USP strip: Click + Collect in as little as 15 minutes, Free delivery on over 2 million products, 90 day returns policy, Join B&Q Club.

There is no sticky buy CTA on the homepage. The header is not sticky.

## Density

**Information-dense.** Retail-catalogue density: the header has four stacked bars, cards carry ratings,
review counts, "X people viewed this", and delivery and collection availability lines. There is little decorative
whitespace, so the demo matches that.

## Tone (real phrases)

- "Prices. Nailed."
- "We've nailed down prices on hundreds of indoor and outdoor essentials"
- "From small updates to big transformations, if they can do it, now you can too."
- "Click + Collect now in as little as 15 minutes"
- Delivery copy on cards: "Available for £6 Home Delivery", "Free for orders over £100", "Available for Free Click + Collect"

The register is plain, punchy and practical, with DIY puns ("nailed") and second person. The demo copy follows it.

## Commerce facts reused in the demo

- Home Delivery £6, free on orders over £100. Click + Collect is free.
- Prices include VAT (UK retail). `vat_amount` is reported as the VAT included in the total (total ÷ 6).
- Own brands used in the catalogue: GoodHome, Erbauer, Blooma, Verve, Diall, Colours, Cooke & Lewis, Mac Allister. Third-party brands: Valspar (B&Q's paint partner), Dulux, Crown.

## Inferred / not captured

- Hover states and focus rings (inferred).
- Product imagery is drawn as inline SVG illustrations rather than hot-linked B&Q photography.
