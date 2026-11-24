# B&Q Project Calculator: Amplitude demo site

A static, multi-page copy of a diy.com shopping journey, built to tell one story: **the new Project
Calculator works out how much you need, but makes shoppers search for the product themselves, and they drop off.**

Plain HTML, CSS and vanilla JS. There is no build step and no backend. Catalogue data is in `assets/js/catalogue.js`;
basket, login and wishlist state live in `localStorage`. Brand research is in [`brand.md`](brand.md).

## Pages

| Page | What it does |
|---|---|
| `index.html` | Homepage: offers, Project Calculator promo, recommendations |
| `category.html?c=<dept>` | Department listing with filters and sort |
| `search.html?q=<term>` | Header search results |
| `product.html?id=ITEM_001` | Product page. Paint, wallpaper, flooring, tiles and decking products include the **Project Calculator** |
| `basket.html` | Basket with voucher codes (`NAILED10`, `BLACKFRIDAY`) |
| `checkout.html` | Home Delivery (£6, free over £100) or free Click + Collect |
| `account.html` | Demo user ID, wish list, order history, sign out |
| `404.html` | Branded fallback |

## Demo script (the funnel)

1. Homepage → **Homepage Viewed**
2. "Try it on paint" → product page → **Product Page Viewed**
3. Open Project Calculator, enter 4.2 × 3.6 × 2.4, Calculate → **Project Calculator Started**
4. Search "white matt emulsion 5L" in the calculator → **Calculator Item Search**. This is the friction. The search:
   - knows nothing about the calculation, so the 5.8 litres just worked out is ignored
   - searches the whole catalogue with loose keyword matching, so "white" returns Christmas lights, a microwave and a vanity unit, and "matt" returns tiles
   - silently drops sizes, so "5L" alone returns nothing
   - pins a sponsored Dulux tin first, then ranks by popularity
   - shows 5 results at a time with names cut off and no pack size, so the Valspar 1L, 2.5L and 5L tins look the same
   - puts the right tin (Valspar 5L) last: result 18 of 18, behind three "Show more results" clicks
   - adds one tin per "Add", whatever quantity you need

   In a replay you'll see repeated searches, "Show more" clicks and shoppers giving up or adding one wrong-size tin.
5. Add something → **Add to Basket** (`source` = `calculator_search`, `calculator_recommendation`, `product_page`, `category`, `search`, …)
6. Basket → Checkout → Place order → **Order Completed**

Supporting events: Product Searched (header search), Category Browsed (department page), Added to Wishlist (heart),
Recommended Product Clicked ("Recommended for you", "You might also need", and the added-to-basket modal),
Offer Viewed ("View offer" on the homepage, "See offer details" on reduced products), Reviews Read (opening Reviews),
Voucher Code Entered (basket), Basket Abandoned (leaving basket or checkout with items via any non-checkout link),
session_ended (Sign out, or "End session" in the footer).

The blue **Amplitude events** button (bottom right) shows every event as it fires, which is handy on a shared screen.

## Identity

Sign in takes a name and a demo number. User ID = `name_demo_YYYYMMDD` (e.g. `joe_1_20261124`), shown live in the
modal and on the account page. Sign out fires `session_ended` then `amplitude.reset()`.

## Web Experiment: `calculator-item-search-improvement`

The treatment (a single "Recommended for your project: 3 x 5L Valspar …, £105.00" card with Add to basket) is
already in the DOM after Calculate, as `.calc-reco`. It is hidden by CSS unless `<html>` has the `calc-improved` class.

To serve it from the Web Experiment visual editor, in the **treatment** variant add custom CSS:

```css
.calc-reco { display: block !important; }
```

or custom JS: `document.documentElement.classList.add('calc-improved');`

To preview without the experiment, use `?calc_variant=treatment` (sticky in localStorage), `?calc_variant=control`,
or the "Calculator: control/treatment" toggle in the footer.
