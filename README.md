# B&Q Project Calculator: Amplitude demo site

A static, multi-page copy of a diy.com shopping journey, built to tell one story: **the new Project
Calculator works out how much you need, but doesn't link to a product. Shoppers have to search for it themselves, the search fails them, and they drop off.**

Plain HTML, CSS and vanilla JS. There is no build step and no backend. Catalogue data is in `assets/js/catalogue.js`;
basket, login, wishlist and recently-viewed state live in `localStorage`. Brand research is in [`brand.md`](brand.md).

## Pages

| Page | What it does |
|---|---|
| `index.html` | Homepage: Project Calculator entry point, Recently viewed, offers, recommendations |
| `calculator.html?type=paint` | **Standalone Project Calculator**: pick a project (paint, wallpaper, flooring, tiles, decking), measure up, calculate, then "Find a product for your project" |
| `product.html?id=ITEM_001` | Product page, used for research only (no calculator here) |
| `category.html?c=<dept>` | Department listing with filters and sort |
| `search.html?q=<term>` | Header search results (this search works properly) |
| `basket.html` | Basket with voucher codes (`NAILED10`, `BLACKFRIDAY`) |
| `checkout.html` | Home Delivery (£6, free over £100) or free Click + Collect |
| `account.html` | Demo user ID, wish list, order history, sign out |
| `404.html` | Branded fallback |

## Demo script (the funnel)

1. **Homepage**: fires Homepage Viewed.
2. **Research a product**: click the Valspar 5L tin in "Recommended for you". Fires Product Page Viewed. Browse it, read reviews, add it to your wish list.
3. **Back to the homepage**: the tin now shows under "Recently viewed". Click **Start your project** (or the "Paint a room" tile).
4. **Calculator**: enter 4.2 × 3.6 × 2.4 and click Calculate. Fires Project Calculator Started. The answer is "5.8 litres", with no product.
5. **Search for the product**: type "white matt emulsion 5L" in "Find a product for your project". Fires **Calculator Item Search**. This is the friction:
   - page 1 is sponsored Dulux, then **silicone sealant, a double socket and a toilet seat**, each with its own picture and department label
   - the search ignores what you just researched, the 5.8 litres, and the fact you're painting
   - it searches the whole catalogue with loose keyword matching ("white", "matt") and silently drops sizes ("5L")
   - names are cut off and pack sizes are hidden, so the Valspar 1L, 2.5L and 5L tins look the same
   - the tin you looked at minutes ago is **result 23 of 23, behind four "Show more results" clicks**
   - "Add" adds one tin, whatever quantity you need
6. **Add to basket**: fires Add to Basket, with `source` = `calculator_search`, `calculator_recommendation`, `product_page`, `category`, `search`, and so on.
7. **Checkout**: fires Order Completed.

In a session replay you'll see the toilet seat and sealant on screen, repeated searches, "Show more" clicks, and either a drop-off or one wrong-size tin added.
Flooring shows the same problem: "natural oak laminate" returns underlay, a kitchen worktop and a bookcase before the Ostrava pack.

Supporting events:

| Event | How to trigger it |
|---|---|
| Product Searched | Header search |
| Category Browsed | Open a department page |
| Added to Wishlist | Click the heart on a product |
| Recommended Product Clicked | "Recommended for you", "You might also need", or the added-to-basket modal |
| Offer Viewed | "View offer" on the homepage, or "See offer details" on a reduced product |
| Reviews Read | Open Reviews on a product page |
| Voucher Code Entered | Enter a code in the basket |
| Basket Abandoned | Leave the basket or checkout with items, via any non-checkout link |
| session_ended | Sign out, or "End session" in the footer |

Project Calculator Started and Calculator Item Search carry the most recently viewed product of that project type as `product_id` (null if there isn't one),
and the project's department as `product_category`.

The blue **Amplitude events** button (bottom right) shows every event as it fires.

## Identity

Sign in takes a name and a demo number. User ID = `name_demo_YYYYMMDD` (e.g. `joe_1_20261124`), shown live in the
modal and on the account page. Sign out fires `session_ended` then `amplitude.reset()`.

## Web Experiment: `calculator-item-search-improvement`

The treatment is a single card under the calculation: "Recommended for your project: 2 x 5L Valspar …, £70.00", with Add to basket.
It uses the product you researched, so the right pack in the right quantity.
It is on the page after Calculate, as `.calc-reco`, and hidden by CSS unless `<html>` has the `calc-improved` class.

In the Web Experiment visual editor, give the **treatment** variant this custom CSS:

```css
.calc-reco { display: block !important; }
```

or custom JS: `document.documentElement.classList.add('calc-improved');`

To preview without the experiment, use `?calc_variant=treatment` (sticky in localStorage), `?calc_variant=control`,
or the "Calculator: control/treatment" toggle in the footer.
