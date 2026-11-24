/* B&Q Amplitude demo — shared app code. Plain ES2017, no build step. */
(function () {
  'use strict';

  /* ============================================================
     Utilities
     ============================================================ */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var SS = {
    get: function (k, d) { try { var v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function money(n) { n = r2(n); return '£' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)); }
  function money2(n) { return '£' + r2(n).toFixed(2); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function todayKey() { return new Date().toISOString().split('T')[0].replace(/-/g, ''); }

  var PRODUCTS = window.BQ_PRODUCTS || [];
  var DEPTS = window.BQ_DEPARTMENTS || [];
  function byId(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function deptName(slug) { for (var i = 0; i < DEPTS.length; i++) if (DEPTS[i].slug === slug) return DEPTS[i].name; return slug; }
  var CALC_TYPES = { paint: 1, wallpaper: 1, flooring: 1, tiles: 1, decking: 1 };

  /* ============================================================
     Amplitude wrapper + on-page event stream (demo aid)
     ============================================================ */
  function track(name, props) {
    props = props || {};
    var res = null;
    try { if (window.amplitude && typeof amplitude.track === 'function') res = amplitude.track(name, props); }
    catch (e) { console.warn('[amplitude] track failed', e); }
    logEvent(name, props);
    return (res && res.promise) ? res.promise : Promise.resolve();
  }

  function logEvent(name, props) {
    var log = SS.get('bq_evlog', []);
    log.unshift({ n: name, p: props, t: new Date().toLocaleTimeString('en-GB') });
    SS.set('bq_evlog', log.slice(0, 40));
    renderEvLog(true);
  }

  function renderEvLog(flash) {
    var box = $('#evlog');
    if (!box) {
      box = document.createElement('div');
      box.id = 'evlog'; box.className = 'evlog';
      box.innerHTML = '<button type="button" aria-expanded="false">Amplitude events (0)</button><div class="list" hidden></div>';
      document.body.appendChild(box);
      box.firstChild.addEventListener('click', function () {
        var l = box.querySelector('.list'); l.hidden = !l.hidden;
        box.firstChild.setAttribute('aria-expanded', String(!l.hidden));
        SS.set('bq_evlog_open', !l.hidden);
      });
      if (SS.get('bq_evlog_open', false)) box.querySelector('.list').hidden = false;
    }
    var log = SS.get('bq_evlog', []);
    box.firstChild.textContent = 'Amplitude events (' + log.length + ')';
    box.querySelector('.list').innerHTML = log.length ? log.map(function (e) {
      return '<div class="ev' + (e.n === 'Calculator Item Search' ? ' friction' : '') + '"><b>' + esc(e.n) + '</b> <span style="opacity:.6">' + e.t + '</span><pre>' + esc(JSON.stringify(e.p)) + '</pre></div>';
    }).join('') : '<div class="ev">No events yet.</div>';
    if (flash) { box.firstChild.style.background = '#0B3FB0'; setTimeout(function () { box.firstChild.style.background = ''; }, 350); }
  }

  /* ============================================================
     Identity (deterministic user ID, localStorage keyed to today)
     ============================================================ */
  function generateUserId(name, demoNumber) {
    var clean = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'user';
    var today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return clean + '_' + demoNumber + '_' + today; // e.g. "joe_1_20260820"
  }
  function getUser() {
    var u = LS.get('bq_user', null);
    if (u && u.date !== todayKey()) { LS.del('bq_user'); return null; }
    return u;
  }
  function login(name, demo, club) {
    var userId = generateUserId(name, demo);
    var u = { name: name.trim(), demo: demo, userId: userId, club: !!club, date: todayKey() };
    LS.set('bq_user', u);
    try {
      amplitude.setUserId(userId);
      if (amplitude.Identify) {
        var id = new amplitude.Identify();
        id.set('name', u.name).set('demo_number', demo).set('bq_club_member', isClubMember());
        amplitude.identify(id);
      }
    } catch (e) { console.warn(e); }
    return u;
  }
  function endSession(reason) {
    var promise = track('session_ended', { basket_value: basketValue(), is_returning: isReturning() });
    return promise;
  }
  function logout() {
    endSession('sign_out').then(function () {
      try { amplitude.reset(); } catch (e) {}
      LS.del('bq_user');
      location.href = 'index.html';
    });
  }
  function isClubMember() {
    var u = getUser();
    return !!((u && u.club) || LS.get('bq_saved_payment', false));
  }
  // Returning = this browser was seen in an earlier session.
  function isReturning() {
    var r = SS.get('bq_returning', null);
    if (r === null) { r = !!LS.get('bq_seen', false); SS.set('bq_returning', r); LS.set('bq_seen', true); }
    return r;
  }

  /* ============================================================
     Basket, wishlist, totals
     ============================================================ */
  function getBasket() { return LS.get('bq_basket', []).filter(function (l) { return byId(l.id); }); }
  function saveBasket(b) { LS.set('bq_basket', b); updateBasketBadge(); }
  function basketValue() { return r2(getBasket().reduce(function (s, l) { return s + byId(l.id).price * l.qty; }, 0)); }
  function basketCount() { return getBasket().reduce(function (s, l) { return s + l.qty; }, 0); }
  function addToBasket(id, qty, source) {
    var p = byId(id); if (!p || !p.stock) return;
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var b = getBasket(); var line = b.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty += qty; else b.push({ id: id, qty: qty });
    saveBasket(b);
    track('Add to Basket', { product_id: p.id, product_category: deptName(p.dept), product_price: p.price, basket_value: basketValue(), quantity: qty, source: source });
  }
  function getVoucher() { var c = LS.get('bq_voucher', null); return c && window.BQ_VOUCHERS[c] ? { code: c, v: window.BQ_VOUCHERS[c] } : null; }
  function totals(fulfil) {
    var sub = basketValue();
    var vo = getVoucher();
    var discount = vo ? r2(sub * vo.v.offer_pct) : 0;
    var after = r2(sub - discount);
    var freeEligible = after >= 100;
    var delivery = (fulfil === 'collect' || freeEligible || sub === 0) ? 0 : 6;
    var total = r2(after + delivery);
    return { basket_value: sub, discount: discount, delivery_cost: delivery, order_total: total, vat_amount: r2(total / 6), free_delivery_eligible: freeEligible, voucher: vo };
  }
  function wishlist() { return LS.get('bq_wishlist', []); }
  function toggleWish(id) {
    var w = wishlist(); var p = byId(id); var on;
    if (w.indexOf(id) >= 0) { w = w.filter(function (x) { return x !== id; }); on = false; }
    else { w.push(id); on = true; track('Added to Wishlist', { product_id: p.id, product_category: deptName(p.dept), product_price: p.price }); toast('Added to your wish list'); }
    LS.set('bq_wishlist', w);
    return on;
  }
  function trackRecClick(p) { track('Recommended Product Clicked', { product_id: p.id, product_category: deptName(p.dept), product_price: p.price }); }
  function trackOffer(o) { track('Offer Viewed', { offer_type: o.offer_type, offer_pct: o.offer_pct, saving_amount: o.saving_amount }); }

  /* ============================================================
     Product illustrations (inline SVG, no external images)
     ============================================================ */
  var BRAND_COL = { Valspar: '#1D3E8F', Dulux: '#00539F', Crown: '#B5121B', GoodHome: '#323C41', 'Graham & Brown': '#2B2B2B', Colours: '#6A3E8E', Diall: '#FA6400', Blooma: '#3F7D3A' };
  function art(p) {
    var c = p.colour || '#ccc', b = BRAND_COL[p.brand] || '#323C41', s;
    var head = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(p.name) + '">';
    var shadow = '<ellipse cx="100" cy="182" rx="66" ry="7" fill="#000" opacity=".08"/>';
    switch (p.type) {
      case 'paint':
        var small = p.pack < 1;
        if (small) {
          s = '<rect x="78" y="96" width="44" height="78" rx="4" fill="#cfd4d6"/><rect x="78" y="110" width="44" height="46" fill="' + c + '" stroke="#e3e3e3"/><rect x="78" y="110" width="44" height="10" fill="' + b + '"/><rect x="74" y="86" width="52" height="14" rx="3" fill="' + b + '"/><text x="100" y="146" font-size="9" text-anchor="middle" fill="#323C41" font-family="Arial" font-weight="700">' + esc(p.packLabel) + '</text>';
        } else {
          var w = p.pack >= 10 ? 132 : p.pack >= 5 ? 116 : p.pack >= 2.5 ? 96 : 78;
          var hgt = p.pack >= 10 ? 132 : p.pack >= 5 ? 118 : p.pack >= 2.5 ? 100 : 82;
          var x = 100 - w / 2, y = 176 - hgt;
          s = '<path d="M' + (x + 8) + ' ' + (y + 8) + ' Q100 ' + (y - 46) + ' ' + (x + w - 8) + ' ' + (y + 8) + '" stroke="#8A9092" stroke-width="3" fill="none"/>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hgt + '" rx="5" fill="#cfd4d6"/>' +
            '<rect x="' + x + '" y="' + (y + 22) + '" width="' + w + '" height="' + (hgt - 40) + '" fill="' + c + '" stroke="#e1e1e1"/>' +
            '<rect x="' + x + '" y="' + (y + 22) + '" width="' + w + '" height="18" fill="' + b + '"/>' +
            '<text x="100" y="' + (y + 35) + '" font-size="11" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="700">' + esc(p.brand.toUpperCase()) + '</text>' +
            '<text x="100" y="' + (y + hgt - 28) + '" font-size="15" text-anchor="middle" fill="#323C41" font-family="Arial" font-weight="800">' + esc(p.packLabel) + '</text>' +
            '<ellipse cx="100" cy="' + y + '" rx="' + (w / 2) + '" ry="8" fill="#b5bbbe"/>' +
            '<rect x="' + (x + w - 30) + '" y="' + (y + 48) + '" width="20" height="20" fill="' + c + '" stroke="#999" stroke-width=".5"/>';
        }
        return head + shadow + s + '</svg>';
      case 'flooring':
        s = '';
        for (var i = 0; i < 6; i++) { s += '<rect x="' + (22 + (i % 2) * 12) + '" y="' + (40 + i * 22) + '" width="144" height="20" fill="' + c + '" stroke="rgba(0,0,0,.18)"/><path d="M' + (40 + i * 17) + ' ' + (44 + i * 22) + ' q30 4 70 0" stroke="rgba(0,0,0,.12)" fill="none"/>'; }
        return head + shadow + s + '</svg>';
      case 'tiles':
        s = '<rect x="30" y="30" width="140" height="140" fill="#e9e9e6"/>';
        for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) s += '<rect x="' + (33 + k * 46) + '" y="' + (33 + r * 46) + '" width="43" height="43" fill="' + c + '"/>';
        return head + shadow + s + '<path d="M40 60 l20 -6 M110 120 l25 4" stroke="rgba(255,255,255,.35)" stroke-width="3"/></svg>';
      case 'wallpaper':
        s = '<rect x="40" y="26" width="110" height="148" fill="#F4F1EA"/>';
        for (var j = 0; j < 9; j++) { var lx = 52 + (j % 3) * 34, ly = 40 + Math.floor(j / 3) * 46; s += '<path d="M' + lx + ' ' + (ly + 30) + ' Q' + (lx + 2) + ' ' + ly + ' ' + (lx + 20) + ' ' + (ly + 4) + ' Q' + (lx + 18) + ' ' + (ly + 26) + ' ' + lx + ' ' + (ly + 30) + 'Z" fill="' + c + '"/>'; }
        return head + shadow + s + '<rect x="150" y="26" width="18" height="148" rx="9" fill="' + c + '" opacity=".85"/><ellipse cx="159" cy="26" rx="9" ry="4" fill="#ddd"/></svg>';
      case 'decking':
        s = '';
        for (var d = 0; d < 5; d++) s += '<g transform="translate(' + (d * 8) + ',' + (d * 22) + ')"><rect x="16" y="50" width="150" height="18" fill="' + c + '" stroke="rgba(0,0,0,.25)"/><path d="M20 55 h140 M20 59 h140 M20 63 h140" stroke="rgba(0,0,0,.18)"/></g>';
        return head + shadow + s + '</svg>';
      case 'power':
        return head + shadow + '<rect x="58" y="62" width="96" height="40" rx="10" fill="' + c + '"/><rect x="150" y="74" width="30" height="14" fill="#555"/><rect x="74" y="98" width="30" height="58" rx="6" fill="#333"/><rect x="62" y="150" width="56" height="26" rx="4" fill="' + c + '"/></svg>';
      case 'light':
        return head + shadow + '<line x1="100" y1="10" x2="100" y2="70" stroke="#333" stroke-width="3"/><path d="M60 120 L80 70 L120 70 L140 120 Z" fill="' + c + '"/><circle cx="100" cy="128" r="12" fill="#FFE58A"/></svg>';
      case 'xmas':
        return head + shadow + '<path d="M100 22 L150 92 H124 L160 142 H40 L76 92 H50 Z" fill="' + c + '"/><rect x="90" y="142" width="20" height="28" fill="#6E4B2A"/><circle cx="84" cy="104" r="5" fill="#FFE500"/><circle cx="118" cy="122" r="5" fill="#D92910"/><circle cx="104" cy="66" r="5" fill="#FFE500"/></svg>';
      case 'garden':
        return head + shadow + '<rect x="40" y="96" width="120" height="16" fill="' + c + '"/><rect x="40" y="56" width="16" height="110" fill="' + c + '"/><rect x="144" y="96" width="16" height="70" fill="' + c + '"/><rect x="40" y="56" width="120" height="14" fill="' + c + '" opacity=".85"/></svg>';
      default:
        return head + shadow + '<rect x="46" y="46" width="108" height="122" fill="' + c + '" stroke="rgba(0,0,0,.15)"/><rect x="46" y="46" width="108" height="20" fill="' + b + '"/><text x="100" y="60" font-size="11" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="700">' + esc(p.brand.toUpperCase()) + '</text></svg>';
    }
  }

  /* ============================================================
     Shared UI: stars, cards, toast, modal
     ============================================================ */
  function stars(p) {
    var full = Math.round(p.rating);
    return '<span class="stars"><span class="s" aria-hidden="true">' + '★★★★★'.slice(0, full) + '<span style="color:#D6D8D9">' + '★★★★★'.slice(0, 5 - full) + '</span></span>(' + p.reviews + ')</span>';
  }
  var HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z" fill="none" stroke="#323C41" stroke-width="1.8"/></svg>';

  function card(p, opts) {
    opts = opts || {};
    var w = wishlist().indexOf(p.id) >= 0;
    return '<article class="card" data-id="' + p.id + '">' +
      '<button class="wish' + (w ? ' on' : '') + '" type="button" data-wish="' + p.id + '" aria-label="Add to wish list">' + HEART + '</button>' +
      '<a class="media" href="product.html?id=' + p.id + '" data-plink="' + p.id + '">' + art(p) + '</a>' +
      '<div class="body">' +
        (p.wasPrice ? '<span class="pill pill-red" style="align-self:flex-start">Save ' + money(p.wasPrice - p.price) + '</span>' : '') +
        '<a class="name" href="product.html?id=' + p.id + '" data-plink="' + p.id + '">' + esc(p.name) + '</a>' +
        stars(p) +
        '<div class="price">' + money(p.price) + (p.wasPrice ? '<span class="was">' + money(p.wasPrice) + '</span>' : '') + '</div>' +
        '<div class="avail">' + (p.stock ? 'Available for <b>£6 Home Delivery</b><br>Available for <b>Free Click + Collect</b>' : '<span style="color:#D92910;font-weight:700">Out of stock online</span>') + '</div>' +
        (opts.noBuy ? '' : '<button class="btn btn-buy btn-sm" type="button" data-add="' + p.id + '"' + (p.stock ? '' : ' disabled') + '>' + (p.stock ? 'Add to basket' : 'Out of stock') + '</button>') +
      '</div></article>';
  }

  // Wire wish + add buttons inside a container. source = Add to Basket source; rec = fire Recommended Product Clicked on product links.
  function wireCards(root, source, rec) {
    root.addEventListener('click', function (e) {
      var wb = e.target.closest('[data-wish]');
      if (wb) { e.preventDefault(); var on = toggleWish(wb.getAttribute('data-wish')); wb.classList.toggle('on', on); return; }
      var ab = e.target.closest('[data-add]');
      if (ab) { e.preventDefault(); addToBasket(ab.getAttribute('data-add'), 1, source); showAdded(byId(ab.getAttribute('data-add')), 1); return; }
      var pl = e.target.closest('[data-plink]');
      if (pl && rec) trackRecClick(byId(pl.getAttribute('data-plink')));
    });
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  function modal(title, html, wide) {
    closeModal();
    var back = document.createElement('div'); back.className = 'modal-back'; back.id = 'modal';
    back.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><h2>' + esc(title) + '</h2><button class="close" type="button" aria-label="Close">×</button></header><div class="content">' + html + '</div></div>';
    document.body.appendChild(back);
    back.addEventListener('click', function (e) { if (e.target === back || e.target.closest('.close')) closeModal(); });
    document.addEventListener('keydown', escClose);
    return back;
  }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() { var m = $('#modal'); if (m) m.remove(); document.removeEventListener('keydown', escClose); }

  function showAdded(p, qty) {
    var recs = (window.BQ_GOES_WITH[p.type] || window.BQ_GOES_WITH._default).map(byId).filter(function (x) { return x && x.id !== p.id; }).slice(0, 3);
    var m = modal('Added to your basket',
      '<div style="display:grid;grid-template-columns:80px 1fr;gap:12px;align-items:center"><div style="background:#F6F6F6;padding:4px">' + art(p) + '</div><div><b>' + qty + ' x ' + esc(p.name) + '</b><div class="muted small">Basket total: ' + money2(basketValue()) + '</div></div></div>' +
      '<div style="display:flex;gap:10px;margin:16px 0;flex-wrap:wrap"><a class="btn btn-buy" href="basket.html" style="flex:1">Go to basket</a><button class="btn btn-outline" type="button" data-close style="flex:1">Continue shopping</button></div>' +
      '<h3 style="font-size:15px;margin-top:8px">You might also need</h3><div class="mini-recs">' + recs.map(function (r) {
        return '<a href="product.html?id=' + r.id + '" data-rec="' + r.id + '"><div class="thumb">' + art(r) + '</div>' + esc(r.name.slice(0, 48)) + '…<br><b>' + money(r.price) + '</b></a>';
      }).join('') + '</div>');
    m.querySelector('[data-close]').addEventListener('click', closeModal);
    $$('[data-rec]', m).forEach(function (a) { a.addEventListener('click', function () { trackRecClick(byId(a.getAttribute('data-rec'))); }); });
  }

  /* ============================================================
     Login modal (name + demo number, live user ID preview)
     ============================================================ */
  function openLogin() {
    var m = modal('Sign in to B&Q',
      '<p class="muted" style="margin-top:0">Sign in to save your projects and pick up where you left off on any device.</p>' +
      '<form id="loginForm" novalidate>' +
      '<div class="field"><label for="lgName">Your name</label><input id="lgName" autocomplete="off" required placeholder="e.g. Joe"></div>' +
      '<div class="field"><label for="lgDemo">Demo number</label><input id="lgDemo" type="number" min="1" value="1" inputmode="numeric"></div>' +
      '<label class="check"><input type="checkbox" id="lgClub"> I\'m a B&amp;Q Club member</label>' +
      '<div class="small muted" style="margin-bottom:6px">Your demo user ID</div><div class="idbox" id="lgId">user_1_' + todayKey() + '</div>' +
      '<p class="small muted">Same name + number gives the same ID on any device today.</p>' +
      '<button class="btn btn-buy btn-block" type="submit">Sign in</button>' +
      '<p class="small" style="text-align:center;margin-bottom:0"><button class="link" type="button" data-close>Continue as guest</button></p></form>');
    var name = $('#lgName', m), demo = $('#lgDemo', m), out = $('#lgId', m);
    function upd() { out.textContent = generateUserId(name.value, Math.max(1, parseInt(demo.value, 10) || 1)); }
    name.addEventListener('input', upd); demo.addEventListener('input', upd); upd();
    name.focus();
    m.querySelector('[data-close]').addEventListener('click', closeModal);
    $('#loginForm', m).addEventListener('submit', function (e) {
      e.preventDefault();
      if (!name.value.trim()) { name.focus(); name.style.borderColor = '#D92910'; return; }
      var u = login(name.value, Math.max(1, parseInt(demo.value, 10) || 1), $('#lgClub', m).checked);
      closeModal(); renderHeader(); toast('Signed in as ' + u.userId);
      if (document.body.dataset.page === 'account') pages.account();
    });
  }

  /* ============================================================
     Header / footer
     ============================================================ */
  var ICON = {
    search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#323C41" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
    ideas: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.7-.7-.7-2.7z"/></svg>',
    stores: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    basket: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M3 9h18l-2 11H5z"/><path d="M8 9l4-6 4 6"/></svg>',
    collect: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    van: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    returns: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4v6h6"/><path d="M4.5 10A8 8 0 1 1 6 17"/></svg>',
    club: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="12"/><path d="M7 12h5"/></svg>'
  };

  function renderHeader() {
    var u = getUser();
    var page = document.body.dataset.page;
    var activeDept = page === 'category' ? qs('c') : (page === 'product' && byId(qs('id')) ? byId(qs('id')).dept : '');
    var acct = u
      ? '<a href="account.html">Hi, ' + esc(u.name) + '</a><span class="sep">|</span><button type="button" data-signout>Sign out</button>'
      : '<a href="account.html#wishlist">Wish list</a><span class="sep">|</span><button type="button" data-signin>Register</button><span class="sep">|</span><button type="button" data-signin>Sign in</button>';
    var el = $('#site-header');
    el.innerHTML =
      '<div class="promo-strip"><a href="category.html?c=offers">Black Friday is here! Brilliant low prices online and in store now &gt;&gt;</a></div>' +
      '<header class="site-header">' +
        '<div class="utility wrap"><nav class="left" aria-label="Utility"><a href="account.html">B&amp;Q Club</a><span class="sep">|</span><a href="404.html">Customer support</a><span class="sep">|</span><a href="404.html">Sell on diy.com</a></nav>' +
        '<nav aria-label="Account"><span class="postcode"><b>For delivery &amp; collection options</b> Enter your postcode</span><span class="sep postcode">|</span>' + acct + '</nav></div>' +
        '<div class="mainbar wrap">' +
          '<a class="logo" href="index.html" aria-label="B&amp;Q homepage">B&amp;Q</a>' +
          '<form class="search" action="search.html" method="get" role="search"><label class="sr-only" for="q">Search</label><input id="q" name="q" placeholder="Search" value="' + esc(page === 'search' ? (qs('q') || '') : '') + '" autocomplete="off"><button type="submit" aria-label="Search">' + ICON.search + '</button></form>' +
          '<nav class="icons" aria-label="Shortcuts">' +
            '<a href="index.html#project-calculator" class="hide-sm">' + ICON.ideas + '<span>Ideas &amp; Advice</span></a>' +
            '<a href="404.html" class="hide-md">' + ICON.services + '<span>Services</span></a>' +
            '<a href="404.html" class="hide-md">' + ICON.stores + '<span>Stores</span></a>' +
            '<a href="account.html">' + ICON.account + '<span>' + (u ? 'Account' : 'Sign in') + '</span></a>' +
            '<a href="basket.html">' + ICON.basket + '<span>Basket</span><b class="badge-count" id="basketCount" hidden>0</b></a>' +
          '</nav>' +
        '</div>' +
      '</header>' +
      '<nav class="deptnav" aria-label="Departments"><ul>' + DEPTS.map(function (d) {
        return '<li><a href="category.html?c=' + d.slug + '"' + (d.slug === activeDept ? ' class="active"' : '') + '>' + esc(d.name) + '</a></li>';
      }).join('') + '</ul></nav>' +
      '<div class="usp"><ul>' +
        '<li>' + ICON.collect + '<span><b>Click + Collect now in as little as 15 minutes*</b>*Restrictions apply</span></li>' +
        '<li>' + ICON.van + '<span><b>Free delivery on orders over £100</b>Selected products/locations</span></li>' +
        '<li>' + ICON.returns + '<span><b>90 day returns policy</b></span></li>' +
        '<li>' + ICON.club + '<span><b>Join B&amp;Q Club</b></span></li>' +
      '</ul></div>' +
      (!u && !SS.get('bq_nudge_closed', false) ? '<div class="nudge"><div class="wrap"><span><b>Planning a project?</b> Sign in to save your projects and pick up where you left off on any device.</span><button class="btn btn-dark btn-sm" type="button" data-signin>Sign in</button><button class="x" type="button" aria-label="Dismiss" data-nudge-x>×</button></div></div>' : '');
    $$('[data-signin]', el).forEach(function (b) { b.addEventListener('click', openLogin); });
    $$('[data-signout]', el).forEach(function (b) { b.addEventListener('click', logout); });
    var nx = $('[data-nudge-x]', el); if (nx) nx.addEventListener('click', function () { SS.set('bq_nudge_closed', true); $('.nudge').remove(); });
    updateBasketBadge();
  }
  function updateBasketBadge() {
    var b = $('#basketCount'); if (!b) return;
    var n = basketCount(); b.textContent = n; b.hidden = n === 0;
  }

  function renderFooter() {
    var el = $('#site-footer'); if (!el) return;
    el.innerHTML = '<footer class="site-footer"><div class="cols wrap">' +
      '<div><h4>Shop with us</h4><ul><li><a href="category.html?c=offers">Offers &amp; Clearance</a></li><li><a href="category.html?c=painting-decorating">Painting &amp; Decorating</a></li><li><a href="category.html?c=tiling-flooring">Tiling &amp; Flooring</a></li><li><a href="category.html?c=outdoor-garden">Outdoor &amp; Garden</a></li></ul></div>' +
      '<div><h4>Customer services</h4><ul><li><a href="404.html">Delivery &amp; Click + Collect</a></li><li><a href="404.html">90 day returns</a></li><li><a href="404.html">Track my order</a></li></ul></div>' +
      '<div><h4>B&amp;Q Club</h4><ul><li><a href="account.html">My account</a></li><li><a href="account.html#wishlist">Wish list</a></li><li><a href="account.html#orders">Order history</a></li></ul></div>' +
      '<div><h4>Demo controls</h4><div class="demo-tools"><button type="button" data-endsession>End session</button><button type="button" data-variant>Calculator: <span id="variantLbl"></span></button><button type="button" data-clearlog>Clear event log</button></div><p class="small" style="opacity:.75">Amplitude demo build. Not affiliated with the live diy.com.</p></div>' +
      '</div><div class="legal wrap"><span>© B&amp;Q Limited. Demo site for Amplitude.</span><span>Prices include VAT</span></div></footer>';
    $('#variantLbl').textContent = document.documentElement.classList.contains('calc-improved') ? 'treatment' : 'control';
    $('[data-endsession]', el).addEventListener('click', function () {
      endSession('manual').then(function () {
        try { amplitude.setSessionId(Date.now()); } catch (e) {}
        SS.set('bq_returning', null); toast('Session ended. A new session has started.');
      });
    });
    $('[data-variant]', el).addEventListener('click', function () {
      var on = !document.documentElement.classList.contains('calc-improved');
      LS.set('bq_calc_variant', on ? 'treatment' : 'control');
      location.href = location.pathname + location.search.replace(/[?&]calc_variant=[^&]*/, '').replace(/^&/, '?') + location.hash;
    });
    $('[data-clearlog]', el).addEventListener('click', function () { SS.set('bq_evlog', []); renderEvLog(); });
  }

  /* ============================================================
     Project Calculator (the friction story)
     ============================================================ */
  var CALC_COPY = {
    paint: { what: 'paint', ph: 'e.g. white matt emulsion 5L' },
    wallpaper: { what: 'wallpaper', ph: 'e.g. green leaves wallpaper' },
    flooring: { what: 'flooring', ph: 'e.g. oak laminate' },
    tiles: { what: 'tiles', ph: 'e.g. light grey porcelain tile' },
    decking: { what: 'decking', ph: 'e.g. brown deck board' }
  };
  function calcFields(type) {
    var num = function (id, label, ph) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="number" inputmode="decimal" step="0.1" min="0" placeholder="' + ph + '"></div>'; };
    if (type === 'paint') return num('cL', 'Room length (m)', '4.2') + num('cW', 'Room width (m)', '3.6') + num('cH', 'Wall height (m)', '2.4') +
      '<div class="field"><label for="cX">Coats</label><select id="cX"><option value="1">1 coat</option><option value="2" selected>2 coats</option><option value="3">3 coats</option></select></div>';
    if (type === 'wallpaper') return num('cL', 'Room length (m)', '4.2') + num('cW', 'Room width (m)', '3.6') + num('cH', 'Wall height (m)', '2.4') +
      '<div class="field"><label for="cX">Pattern repeat</label><select id="cX"><option value="0">None</option><option value="0.1" selected>Up to 10cm</option><option value="0.3">Up to 30cm</option></select></div>';
    return num('cL', (type === 'decking' ? 'Deck length (m)' : 'Room length (m)'), '4.5') + num('cW', (type === 'decking' ? 'Deck width (m)' : 'Room width (m)'), '3.8') +
      '<div class="field"><label for="cX">Waste allowance</label><select id="cX"><option value="0.05">5%</option><option value="0.1" selected>10%</option><option value="0.15">15%</option></select></div>';
  }
  function computeCalc(type) {
    var L = parseFloat($('#cL').value), W = parseFloat($('#cW').value), H = $('#cH') ? parseFloat($('#cH').value) : 1, X = parseFloat($('#cX').value);
    if (!(L > 0) || !(W > 0) || !(H > 0)) return null;
    if (type === 'paint') {
      var wall = 2 * (L + W) * H, litres = Math.round(wall * X / 13 * 10) / 10;
      return { need: litres, big: litres + ' litres', sub: X + (X === 1 ? ' coat' : ' coats') + ' · ' + wall.toFixed(1) + ' m² of wall · based on 13 m² per litre' };
    }
    if (type === 'wallpaper') {
      var per = 2 * (L + W), drop = H + 0.1 + X, perRoll = Math.max(1, Math.floor(10.05 / drop)), strips = Math.ceil(per / 0.53), rolls = Math.ceil(strips / perRoll);
      return { need: rolls, big: rolls + ' rolls', sub: per.toFixed(1) + 'm of wall · ' + strips + ' drops of ' + drop.toFixed(2) + 'm · standard 10.05m x 0.53m roll' };
    }
    var area = L * W, total = Math.round(area * (1 + X) * 10) / 10;
    return { need: total, big: total + ' m²', sub: Math.round(X * 100) + '% waste · ' + area.toFixed(1) + ' m² ' + (type === 'decking' ? 'deck' : 'floor') + ' area' };
  }

  // Deliberately weak search: keyword OR-match, sponsored other-brand first, cheapest first, the right pack pushed down.
  function calcSearch(p, term) {
    var tokens = term.toLowerCase().replace(/[^a-z0-9.² ]+/g, ' ').split(/\s+/).filter(function (t) { return t.length > 1; });
    var pool = PRODUCTS.filter(function (x) { return x.type === p.type; });
    var hits = pool.filter(function (x) {
      var hay = (x.name + ' ' + x.brand + ' ' + (x.packLabel || '')).toLowerCase();
      return tokens.some(function (t) { return hay.indexOf(t) >= 0; });
    });
    if (!hits.length) return [];
    var ideal = byId(p.calcPick);
    var sponsored = pool.filter(function (x) { return x.brand !== p.brand && x.stock; })[0];
    var rest = hits.filter(function (x) { return x !== sponsored; }).sort(function (a, b) { return a.price - b.price; });
    if (ideal && rest.indexOf(ideal) >= 0) { rest.splice(rest.indexOf(ideal), 1); rest.splice(Math.max(0, rest.length - 1), 0, ideal); }
    return (sponsored ? [{ p: sponsored, sponsored: true }] : []).concat(rest.map(function (x) { return { p: x }; }));
  }

  function renderCalc(p, mount) {
    var copy = CALC_COPY[p.type];
    mount.innerHTML =
      '<section class="calc" id="calc">' +
        '<button class="calc-toggle" type="button" aria-expanded="false" aria-controls="calcBody"><span class="ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="5" y="3" width="14" height="18"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v6"/></svg></span>' +
        '<span><b>Project Calculator <span class="tag-new">New</span></b><span class="small muted">Work out how much ' + copy.what + ' you need for your room</span></span><span class="chev" aria-hidden="true">⌄</span></button>' +
        '<div class="calc-body" id="calcBody" hidden>' +
          '<form id="calcForm" novalidate><div class="calc-fields">' + calcFields(p.type) + '</div>' +
          '<div class="calc-actions"><button class="btn btn-dark" type="submit">Calculate</button><span class="small muted">Measure in metres. Don\'t subtract doors or windows, it\'s handy to have a little extra.</span></div></form>' +
          '<div class="calc-result" id="calcResult" hidden>' +
            '<div class="small muted">You\'ll need about</div>' +
            '<div class="calc-answer"><span class="big" id="calcBig"></span><span class="sub" id="calcSub"></span></div>' +
            '<div class="calc-reco" id="calcReco" data-flag="calculator-item-search-improvement"></div>' +
            '<div class="calc-search"><label for="calcQ"><b>Find a product for your project</b></label>' +
              '<form id="calcSearchForm" style="margin-top:6px" role="search"><input id="calcQ" placeholder="' + copy.ph + '" autocomplete="off" enterkeyhint="search"><button type="submit">Search</button></form>' +
              '<div class="calc-results" id="calcResults" aria-live="polite"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    var root = $('#calc'), started = false, last = null;
    $('.calc-toggle', root).addEventListener('click', function () {
      var body = $('#calcBody'); body.hidden = !body.hidden;
      root.classList.toggle('open', !body.hidden); this.setAttribute('aria-expanded', String(!body.hidden));
      if (!body.hidden) $('#cL').focus();
    });
    $('#calcForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var res = computeCalc(p.type);
      if (!res) { $$('#calcForm input').forEach(function (i) { if (!(parseFloat(i.value) > 0)) i.style.borderColor = '#D92910'; }); return; }
      $$('#calcForm input').forEach(function (i) { i.style.borderColor = ''; });
      last = res;
      if (!started) {
        started = true;
        track('Project Calculator Started', { product_id: p.id, product_category: deptName(p.dept), product_price: p.price, basket_value: basketValue() });
      }
      $('#calcBig').textContent = res.big; $('#calcSub').textContent = res.sub;
      $('#calcResult').hidden = false;
      renderReco(p, res);
      $('#calcResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('#calcSearchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var term = $('#calcQ').value.trim(); if (!term) { $('#calcQ').focus(); return; }
      var results = calcSearch(p, term);
      var t = totals('home');
      track('Calculator Item Search', {
        search_term: term, results_count: results.length,
        product_id: p.id, product_category: deptName(p.dept),
        basket_value: t.basket_value, delivery_cost: t.delivery_cost, vat_amount: t.vat_amount, order_total: t.order_total, free_delivery_eligible: t.free_delivery_eligible
      });
      var box = $('#calcResults');
      if (!results.length) { box.innerHTML = '<div class="count">0 results for "' + esc(term) + '". Try a different search term.</div>'; return; }
      box.innerHTML = '<div class="count">' + results.length + ' results for "' + esc(term) + '"</div>' + results.map(function (r) {
        var x = r.p;
        return '<div class="calc-item"><div class="thumb">' + art(x) + '</div><div><div class="t"><a href="product.html?id=' + x.id + '">' + esc(x.name) + '</a></div><div class="meta">' +
          (r.sponsored ? '<span class="pill pill-spons">Sponsored</span>' : '') + '<span class="pill pill-grey">' + esc(x.packLabel || '') + '</span>' +
          (x.stock ? '' : '<span class="pill pill-oos">Out of stock</span>') + stars(x) + '</div></div>' +
          '<div class="buy"><div class="p">' + money(x.price) + '</div><button class="btn btn-buy btn-sm" type="button" data-cadd="' + x.id + '"' + (x.stock ? '' : ' disabled') + '>' + (x.stock ? 'Add' : 'Unavailable') + '</button></div></div>';
      }).join('');
    });
    $('#calcResults').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cadd]'); if (!b) return;
      var x = byId(b.getAttribute('data-cadd'));
      addToBasket(x.id, 1, 'calculator_search'); showAdded(x, 1);
    });
    $('#calcReco').addEventListener('click', function (e) {
      var b = e.target.closest('[data-reco-add]'); if (!b) return;
      var x = byId(b.getAttribute('data-reco-add')), q = parseInt(b.getAttribute('data-qty'), 10);
      addToBasket(x.id, q, 'calculator_recommendation'); showAdded(x, q);
    });
  }

  // Experiment treatment: one clear recommendation. Hidden unless <html> has .calc-improved.
  function renderReco(p, res) {
    var ideal = byId(p.calcPick); var el = $('#calcReco');
    if (!ideal || !ideal.pack) { el.innerHTML = ''; return; }
    var qty = Math.max(1, Math.ceil(res.need / ideal.pack - 1e-9));
    el.innerHTML = '<div class="row"><div class="thumb">' + art(ideal) + '</div><div><div class="lbl">Recommended for your project</div>' +
      '<div class="ttl">' + qty + ' x ' + esc(ideal.packLabel.split(' (')[0]) + ' ' + esc(ideal.name.replace(/, [^,]*$/, '')) + ', ' + money2(qty * ideal.price) + '</div>' +
      '<div class="small muted">Covers ' + res.big + ' · In stock for Home Delivery and Click + Collect</div></div></div>' +
      '<button class="btn btn-buy btn-block" type="button" data-reco-add="' + ideal.id + '" data-qty="' + qty + '">Add to basket</button>';
  }

  /* ============================================================
     Pages
     ============================================================ */
  var pages = {};

  pages.home = function () {
    track('Homepage Viewed', { is_returning: isReturning() });
    var chipCols = ['#111', '#D92910', '#FA6400', '#323C41', '#2E6B3A', '#C49A6C', '#1D3E8F'];
    $('#chips').innerHTML = DEPTS.slice(0, 11).map(function (d, i) {
      return '<a class="chip" href="category.html?c=' + d.slug + '"><i style="background:' + chipCols[i % chipCols.length] + '"></i>' + esc(d.name) + '</a>';
    }).join('');
    var oc = ['', 'alt', 'alt2'];
    $('#offers').innerHTML = window.BQ_OFFERS.map(function (o, i) {
      return '<div class="offer-card ' + oc[i] + '"><h3>' + esc(o.title) + '</h3><p style="margin:0">' + esc(o.blurb) + '</p><button class="btn ' + (i === 2 ? 'btn-dark' : 'btn-promo') + '" type="button" data-offer="' + o.id + '">View offer</button></div>';
    }).join('');
    $('#offers').addEventListener('click', function (e) {
      var b = e.target.closest('[data-offer]'); if (!b) return;
      var o = window.BQ_OFFERS.filter(function (x) { return x.id === b.getAttribute('data-offer'); })[0];
      trackOffer(o);
      modal(o.title, '<p>' + esc(o.blurb) + '</p>' + (o.code ? '<p>Use code <span class="idbox" style="display:inline-block;padding:4px 10px">' + o.code + '</span> in your basket.</p>' : '') +
        '<p class="small muted">Offer type: ' + o.offer_type.replace('_', ' ') + (o.offer_pct ? ' · ' + Math.round(o.offer_pct * 100) + '% off' : '') + '</p><a class="btn btn-orange" href="' + o.link + '">Shop the offer</a>');
    });
    var calcIds = ['ITEM_001', 'ITEM_020', 'ITEM_030', 'ITEM_011', 'ITEM_040'], labels = ['Paint', 'Flooring', 'Tiles', 'Wallpaper', 'Decking'];
    $('#calcTiles').innerHTML = calcIds.map(function (id, i) { return '<a href="product.html?id=' + id + '#calc"><div class="tile">' + art(byId(id)) + '</div>' + labels[i] + '</a>'; }).join('');
    var recs = ['ITEM_001', 'ITEM_052', 'ITEM_020', 'ITEM_067', 'ITEM_006', 'ITEM_040', 'ITEM_050', 'ITEM_030'].map(byId);
    var grid = $('#recs'); grid.innerHTML = recs.map(function (p) { return card(p); }).join('');
    wireCards(grid, 'homepage_recommendations', true);
  };

  function filterDept(slug) {
    if (slug === 'offers') return PRODUCTS.filter(function (p) { return p.wasPrice; });
    return PRODUCTS.filter(function (p) { return p.dept === slug; });
  }
  var TYPE_LABEL = { paint: 'Paint', wallpaper: 'Wallpaper', tool: 'Decorating tools & accessories', flooring: 'Laminate flooring', tiles: 'Tiles', decking: 'Decking', garden: 'Garden', power: 'Power tools', light: 'Lighting', bath: 'Bathroom', kitchen: 'Kitchen', home: 'Home', build: 'Building', heat: 'Heating & plumbing', xmas: 'Christmas' };

  pages.category = function () {
    var slug = qs('c') || 'painting-decorating';
    var name = deptName(slug);
    var all = filterDept(slug);
    document.title = name + ' | DIY at B&Q';
    $('#crumbs').innerHTML = '<a href="index.html">Home</a> / ' + esc(name);
    $('#catTitle').textContent = name;
    var types = all.map(function (p) { return p.type; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    $('#filters').innerHTML = '<h3>Product type</h3>' + types.map(function (t) { return '<label><input type="checkbox" value="' + t + '"> ' + (TYPE_LABEL[t] || t) + '</label>'; }).join('') +
      '<h3 style="margin-top:18px">Availability</h3><label><input type="checkbox" id="inStock"> In stock only</label>';
    function draw() {
      var picked = $$('#filters input[value]:checked').map(function (i) { return i.value; });
      var list = all.filter(function (p) { return (!picked.length || picked.indexOf(p.type) >= 0) && (!$('#inStock').checked || p.stock); });
      var sort = $('#sort').value;
      list.sort(function (a, b) { return sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : sort === 'rating' ? b.rating - a.rating : b.reviews - a.reviews; });
      $('#count').textContent = list.length + ' products';
      $('#grid').innerHTML = list.map(function (p) { return card(p); }).join('') || '<p>No products match these filters.</p>';
      return list.length;
    }
    var shown = draw();
    track('Category Browsed', { category_name: name, products_shown: shown });
    $('#filters').addEventListener('change', draw);
    $('#sort').addEventListener('change', draw);
    wireCards($('#grid'), 'category', false);
  };

  function searchCatalogue(q) {
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    return PRODUCTS.map(function (p) {
      var hay = (p.name + ' ' + p.brand + ' ' + deptName(p.dept) + ' ' + p.type + ' ' + (TYPE_LABEL[p.type] || '')).toLowerCase();
      var score = tokens.reduce(function (s, t) { return s + (hay.indexOf(t) >= 0 ? 1 : 0); }, 0);
      return { p: p, s: score };
    }).filter(function (x) { return x.s === tokens.length; }).sort(function (a, b) { return b.p.reviews - a.p.reviews; }).map(function (x) { return x.p; });
  }

  pages.search = function () {
    var q = (qs('q') || '').trim();
    var res = q ? searchCatalogue(q) : [];
    document.title = 'Search results | DIY at B&Q';
    $('#searchTitle').textContent = q ? 'Results for "' + q + '"' : 'Search';
    $('#count').textContent = res.length + ' products';
    var grid = $('#grid');
    if (res.length) { grid.innerHTML = res.map(function (p) { return card(p); }).join(''); }
    else {
      grid.innerHTML = '';
      $('#empty').hidden = false;
      var recs = ['ITEM_001', 'ITEM_052', 'ITEM_020', 'ITEM_067'].map(byId);
      $('#emptyRecs').innerHTML = recs.map(function (p) { return card(p); }).join('');
      wireCards($('#emptyRecs'), 'search_recommendations', true);
    }
    if (q) track('Product Searched', { search_term: q, results_count: res.length });
    wireCards(grid, 'search', false);
  };

  function reviewsFor(p) {
    var bank = [
      ['Great coverage', 5, 'Went on smoothly and two coats gave a really even finish. Would buy again.'],
      ['Does the job', 4, 'Good value for money. Took a little longer than expected but happy with the result.'],
      ['Worked out how much I needed', 4, 'Handy that it tells you coverage, though I still had to guess which size to buy.'],
      ['Decent', 3, 'Fine for the price. Click + Collect was quick, ready in about 20 minutes.']
    ];
    return bank.map(function (r, i) { return { title: r[0], stars: r[1], text: r[2], who: ['Sam, Leeds', 'Priya, Croydon', 'Dave, Cardiff', 'Lou, Glasgow'][i] }; });
  }

  pages.product = function () {
    var p = byId(qs('id'));
    var mount = $('#pdp');
    if (!p) { mount.innerHTML = '<h1>Sorry, we couldn\'t find that product</h1><p><a class="btn btn-orange" href="index.html">Back to homepage</a></p>'; return; }
    document.title = p.name + ' | DIY at B&Q';
    track('Product Page Viewed', { product_id: p.id, product_category: deptName(p.dept), product_price: p.price });
    var inWish = wishlist().indexOf(p.id) >= 0;
    var specs = [['Brand', p.brand], ['Product code', p.id], ['Pack size', p.packLabel || '1'], ['Department', deptName(p.dept)]];
    if (p.type === 'paint') specs.push(['Finish', p.finish || 'Matt'], ['Coverage', '13 m² per litre'], ['Drying time', '2 hours touch dry']);
    $('#crumbs').innerHTML = '<a href="index.html">Home</a> / <a href="category.html?c=' + p.dept + '">' + esc(deptName(p.dept)) + '</a> / ' + esc(TYPE_LABEL[p.type] || '');
    mount.innerHTML =
      '<div class="pdp">' +
        '<div><div class="gallery">' + art(p) + '</div></div>' +
        '<div>' +
          '<h1>' + esc(p.name) + '</h1>' +
          '<a href="#reviews" class="stars-link" style="text-decoration:none">' + stars(p) + ' <span class="small" style="text-decoration:underline">Read reviews</span></a>' +
          '<div class="price">' + money(p.price) + (p.wasPrice ? '<span class="was">' + money(p.wasPrice) + '</span>' : '') + '</div>' +
          (p.viewed ? '<div class="viewed">' + p.viewed + ' people viewed this product in the last 24 hours.</div>' : '') +
          (p.wasPrice ? '<div class="offer-pill"><span class="pill pill-red">Save ' + money(p.wasPrice - p.price) + '</span><span><b>Prices. Nailed.</b></span><button class="link" type="button" id="offerBtn" style="margin-left:auto">See offer details</button></div>' : '') +
          '<div class="fulfil"><div><b>Home Delivery</b>' + (p.stock ? '£6, free for orders over £100' : '<span style="color:#D92910">Out of stock</span>') + '</div><div><b>Click + Collect</b>' + (p.stock ? 'Free. Ready in as little as 15 minutes' : 'Unavailable') + '</div></div>' +
          '<div class="buyrow"><div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity">−</button><input id="qty" type="number" min="1" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">+</button></div>' +
            '<button class="btn btn-buy" type="button" id="addBtn"' + (p.stock ? '' : ' disabled') + '>' + (p.stock ? 'Add to basket' : 'Out of stock') + '</button>' +
            '<button class="wish-inline' + (inWish ? ' on' : '') + '" type="button" id="wishBtn" aria-label="Add to wish list">' + HEART + '</button></div>' +
          '<div id="calcMount"></div>' +
          '<div class="accordion">' +
            '<details><summary>Product details</summary><div class="inner"><p>' + esc(p.name) + '. ' + (p.type === 'paint' ? 'A durable, wipeable finish for walls and ceilings. From small updates to big transformations, it\'s an easy way to refresh any room.' : 'Quality you can rely on at a price that\'s nailed.') + '</p></div></details>' +
            '<details><summary>Specifications</summary><div class="inner"><table class="specs">' + specs.map(function (s) { return '<tr><td>' + esc(s[0]) + '</td><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</table></div></details>' +
            '<details id="reviews"><summary>Reviews (' + p.reviews + ')</summary><div class="inner"><p><b style="font-size:28px">' + p.rating.toFixed(1) + '</b> / 5 ' + stars(p) + '</p>' +
              reviewsFor(p).map(function (r) { return '<div class="review"><b>' + esc(r.title) + '</b> <span class="stars"><span class="s">' + '★★★★★'.slice(0, r.stars) + '</span></span><p style="margin:4px 0">' + esc(r.text) + '</p><span class="small muted">' + esc(r.who) + '</span></div>'; }).join('') +
            '</div></details>' +
          '</div>' +
        '</div>' +
      '</div>';
    $$('[data-q]').forEach(function (b) { b.addEventListener('click', function () { var i = $('#qty'); i.value = Math.max(1, (parseInt(i.value, 10) || 1) + parseInt(b.getAttribute('data-q'), 10)); }); });
    $('#addBtn').addEventListener('click', function () { var q = Math.max(1, parseInt($('#qty').value, 10) || 1); addToBasket(p.id, q, 'product_page'); showAdded(p, q); });
    $('#wishBtn').addEventListener('click', function () { this.classList.toggle('on', toggleWish(p.id)); });
    var reviewsRead = false;
    $('#reviews').addEventListener('toggle', function () {
      if (this.open && !reviewsRead) { reviewsRead = true; track('Reviews Read', { product_id: p.id, product_category: deptName(p.dept), rating: p.rating }); }
    });
    $('.stars-link').addEventListener('click', function (e) { e.preventDefault(); var d = $('#reviews'); d.open = true; d.scrollIntoView({ behavior: 'smooth' }); });
    if ($('#offerBtn')) $('#offerBtn').addEventListener('click', function () {
      var o = { offer_type: 'percentage_off', offer_pct: r2((p.wasPrice - p.price) / p.wasPrice), saving_amount: r2(p.wasPrice - p.price) };
      trackOffer(o);
      modal('Prices. Nailed.', '<p>We\'ve nailed down the price on this product: was ' + money(p.wasPrice) + ', now ' + money(p.price) + '.</p><p><b>You save ' + money(o.saving_amount) + ' (' + Math.round(o.offer_pct * 100) + '% off).</b></p><p class="small muted">While stocks last. Online and in store.</p>');
    });
    if (CALC_TYPES[p.type]) {
      renderCalc(p, $('#calcMount'));
      if (location.hash === '#calc') { $('.calc-toggle').click(); setTimeout(function () { $('#calc').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }
    }
    var recs = (window.BQ_GOES_WITH[p.type] || window.BQ_GOES_WITH._default).map(byId).filter(function (x) { return x && x.id !== p.id; });
    var grid = $('#recs'); grid.innerHTML = recs.map(function (r) { return card(r); }).join('');
    wireCards(grid, 'pdp_recommendations', true);
  };

  // Basket Abandoned: leaving the basket/checkout with items, via any link that isn't the next checkout step.
  function watchAbandon(allowed) {
    var fired = false;
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]'); if (!a || fired || !getBasket().length) return;
      var href = a.getAttribute('href');
      if (allowed.some(function (x) { return href.indexOf(x) === 0; }) || href.charAt(0) === '#') return;
      fired = true;
      var t = totals(LS.get('bq_fulfil', 'home'));
      track('Basket Abandoned', { basket_value: t.basket_value, delivery_cost: t.delivery_cost, vat_amount: t.vat_amount, order_total: t.order_total, free_delivery_eligible: t.free_delivery_eligible, voucher_applied: !!t.voucher });
    }, true);
  }

  function summaryHtml(fulfil, btn) {
    var t = totals(fulfil);
    return '<div class="panel summary"><h2 style="font-size:20px">Order summary</h2>' +
      '<div class="row"><span>Basket (' + basketCount() + ' items)</span><span>' + money2(t.basket_value) + '</span></div>' +
      (t.discount ? '<div class="row" style="color:#098638"><span>Voucher ' + t.voucher.code + '</span><span>−' + money2(t.discount) + '</span></div>' : '') +
      '<div class="row"><span>' + (fulfil === 'collect' ? 'Click + Collect' : 'Home Delivery') + '</span><span>' + (t.delivery_cost ? money2(t.delivery_cost) : 'Free') + '</span></div>' +
      (fulfil !== 'collect' && !t.free_delivery_eligible ? '<div class="small muted">Spend ' + money2(100 - (t.basket_value - t.discount)) + ' more for free Home Delivery</div>' : '') +
      '<div class="row total"><span>Total</span><span>' + money2(t.order_total) + '</span></div><div class="small muted">Includes VAT of ' + money2(t.vat_amount) + '</div>' +
      (btn || '') + '</div>';
  }

  pages.basket = function () {
    watchAbandon(['checkout.html', 'basket.html']);
    function draw() {
      var b = getBasket(), mount = $('#basket');
      if (!b.length) {
        mount.innerHTML = '<div class="panel" style="text-align:center;padding:40px"><h2>Your basket is empty</h2><p class="muted">Prices. Nailed. Find what you need for your next project.</p><a class="btn btn-orange" href="index.html">Start shopping</a></div>';
        return;
      }
      var vo = getVoucher();
      mount.innerHTML = '<div class="two-col"><div><h1>Your basket</h1>' + b.map(function (l) {
        var p = byId(l.id);
        return '<div class="line"><div class="thumb">' + art(p) + '</div><div><a href="product.html?id=' + p.id + '" style="font-weight:700;text-decoration:none">' + esc(p.name) + '</a><div class="small muted">' + money(p.price) + ' each · Home Delivery or Free Click + Collect</div>' +
          '<div class="controls"><div class="qty"><button type="button" data-lq="' + p.id + '" data-d="-1" aria-label="Decrease">−</button><input value="' + l.qty + '" readonly aria-label="Quantity"><button type="button" data-lq="' + p.id + '" data-d="1" aria-label="Increase">+</button></div><button class="link" type="button" data-rm="' + p.id + '">Remove</button></div></div>' +
          '<div class="lp" style="font-weight:800;font-size:18px">' + money2(p.price * l.qty) + '</div></div>';
      }).join('') + '</div><div>' +
        summaryHtml(LS.get('bq_fulfil', 'home'), '<form class="voucher" id="voucherForm"><label class="sr-only" for="voucher">Voucher code</label><input id="voucher" placeholder="Voucher code" value="' + (vo ? vo.code : '') + '" autocomplete="off"><button class="btn btn-dark btn-sm" type="submit">Apply</button></form><div id="vmsg">' + (vo ? '<span class="msg-ok">' + esc(vo.v.label) + ' applied</span>' : '<span class="small muted">Try NAILED10</span>') + '</div>' +
          '<a class="btn btn-buy btn-block" href="checkout.html" style="margin-top:14px">Checkout securely</a><a class="btn btn-outline btn-block" href="index.html" style="margin-top:10px">Continue shopping</a>') +
        '</div></div>';
    }
    draw();
    var root = $('#basket');
    root.addEventListener('click', function (e) {
      var q = e.target.closest('[data-lq]'), rm = e.target.closest('[data-rm]');
      if (!q && !rm) return;
      var id = (q || rm).getAttribute(q ? 'data-lq' : 'data-rm'), b = getBasket();
      b = b.map(function (l) { if (l.id === id && q) l.qty += parseInt(q.getAttribute('data-d'), 10); return l; }).filter(function (l) { return !(rm && l.id === id) && l.qty > 0; });
      saveBasket(b); draw();
    });
    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'voucherForm') return;
      e.preventDefault();
      var code = $('#voucher').value.trim().toUpperCase(); if (!code) return;
      var v = window.BQ_VOUCHERS[code], sub = basketValue();
      track('Voucher Code Entered', { voucher_attempted: true, voucher_applied: !!v, offer_type: v ? v.offer_type : null, offer_pct: v ? v.offer_pct : 0, saving_amount: v ? r2(sub * v.offer_pct) : 0, basket_value: sub });
      if (v) { LS.set('bq_voucher', code); draw(); toast(v.label + ' applied'); }
      else { LS.del('bq_voucher'); draw(); $('#vmsg').innerHTML = '<span class="msg-err">Sorry, "' + esc(code) + '" isn\'t a valid voucher code</span>'; $('#voucher').value = code; }
    });
  };

  var STORES = ['B&Q Wandsworth (0.8 miles)', 'B&Q New Malden (3.1 miles)', 'B&Q Sutton (5.4 miles)', 'B&Q Croydon Purley Way (6.2 miles)'];

  pages.checkout = function () {
    var mount = $('#checkout');
    if (!getBasket().length) { mount.innerHTML = '<div class="panel" style="text-align:center;padding:40px"><h2>Your basket is empty</h2><a class="btn btn-orange" href="index.html">Start shopping</a></div>'; return; }
    watchAbandon(['basket.html', 'checkout.html']);
    var u = getUser(), fulfil = LS.get('bq_fulfil', 'home');
    mount.innerHTML = '<div class="two-col"><form id="coForm" novalidate><h1>Checkout</h1>' +
      '<div class="step"><h2><span class="n">1</span>How would you like your order?</h2>' +
        '<label class="choice"><input type="radio" name="fulfil" value="home"' + (fulfil === 'home' ? ' checked' : '') + '><span><b>Home Delivery</b><br><span class="small muted">£6, free for orders over £100. Delivered in 2–5 working days.</span></span></label>' +
        '<label class="choice"><input type="radio" name="fulfil" value="collect"' + (fulfil === 'collect' ? ' checked' : '') + '><span><b>Free Click + Collect</b><br><span class="small muted">Ready in as little as 15 minutes.</span></span></label>' +
        '<div class="field" id="storeField"' + (fulfil === 'collect' ? '' : ' hidden') + '><label for="store">Collect from</label><select id="store">' + STORES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="step"><h2><span class="n">2</span>Your details</h2><div class="form-grid">' +
        '<div class="field"><label for="fn">Full name</label><input id="fn" required autocomplete="name" value="' + (u ? esc(u.name) : '') + '"></div>' +
        '<div class="field"><label for="em">Email</label><input id="em" type="email" required autocomplete="email" placeholder="you@example.com"></div>' +
        '<div class="field" id="addrField"' + (fulfil === 'home' ? '' : ' hidden') + '><label for="ad">Delivery address</label><input id="ad" autocomplete="street-address" placeholder="1 Example Road"></div>' +
        '<div class="field"><label for="pc">Postcode</label><input id="pc" autocomplete="postal-code" placeholder="SW18 1AA"></div>' +
      '</div></div>' +
      '<div class="step"><h2><span class="n">3</span>Payment</h2>' +
        '<label class="choice"><input type="radio" name="pay" value="card" checked><span><b>Card</b><br><span class="small muted">Demo checkout. No card details are collected.</span></span></label>' +
        '<label class="choice"><input type="radio" name="pay" value="paypal"><span><b>PayPal</b><br><span class="small muted">Demo checkout.</span></span></label>' +
        '<label class="check"><input type="checkbox" id="savePay"' + (LS.get('bq_saved_payment', false) ? ' checked' : '') + '> Save this payment method to my B&amp;Q Club account</label>' +
      '</div>' +
      '<div id="coErr" class="msg-err" style="margin-bottom:10px"></div>' +
      '<button class="btn btn-buy btn-block" type="submit">Place order</button>' +
      '<p class="small" style="text-align:center"><a href="basket.html">Back to basket</a></p>' +
      '</form><div id="coSummary">' + summaryHtml(fulfil) + '</div></div>';
    var form = $('#coForm');
    form.addEventListener('change', function (e) {
      if (e.target.name !== 'fulfil') return;
      fulfil = e.target.value; LS.set('bq_fulfil', fulfil);
      $('#storeField').hidden = fulfil !== 'collect'; $('#addrField').hidden = fulfil !== 'home';
      $('#coSummary').innerHTML = summaryHtml(fulfil);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!$('#fn').value.trim() || !/.+@.+\..+/.test($('#em').value)) { $('#coErr').textContent = 'Please enter your name and a valid email address.'; return; }
      if ($('#savePay').checked) LS.set('bq_saved_payment', true);
      var t = totals(fulfil);
      var key = 'bq_orders_' + ((u && u.userId) || 'guest');
      var orders = LS.get(key, []);
      var orderId = 'ORD_' + todayKey() + '_' + String(Date.now()).slice(-6);
      track('Order Completed', {
        order_id: orderId, order_total: t.order_total, is_first_order: orders.length === 0,
        basket_value: t.basket_value, delivery_cost: t.delivery_cost, vat_amount: t.vat_amount, free_delivery_eligible: t.free_delivery_eligible,
        voucher_applied: !!t.voucher, bq_club_member: isClubMember(), fulfilment_method: fulfil === 'collect' ? 'click_and_collect' : 'home_delivery'
      });
      orders.unshift({ id: orderId, total: t.order_total, items: getBasket(), fulfil: fulfil, date: new Date().toLocaleString('en-GB') });
      LS.set(key, orders);
      saveBasket([]); LS.del('bq_voucher');
      mount.innerHTML = '<div class="confirm"><div class="tick">✓</div><h1 style="margin-top:16px">Thanks, your order is confirmed</h1><p>Order number <b>' + orderId + '</b></p><p>' +
        (fulfil === 'collect' ? 'We\'ll email you when it\'s ready to collect from <b>' + esc($('#store').value) + '</b>. That\'s usually within 15 minutes.' : 'Your Home Delivery will arrive in 2–5 working days.') +
        '</p><p>Total paid <b>' + money2(t.order_total) + '</b></p><a class="btn btn-orange" href="index.html">Continue shopping</a> <a class="btn btn-outline" href="account.html#orders">View my orders</a></div>';
      window.scrollTo(0, 0);
    });
  };

  pages.account = function () {
    var u = getUser(), mount = $('#account');
    var orders = LS.get('bq_orders_' + ((u && u.userId) || 'guest'), []);
    var w = wishlist().map(byId).filter(Boolean);
    mount.innerHTML = '<h1>' + (u ? 'Hi, ' + esc(u.name) : 'My account') + '</h1>' +
      (u ? '<div class="panel" style="margin-bottom:20px"><div class="small muted">Your demo user ID</div><div class="idbox" style="margin:6px 0 12px">' + esc(u.userId) + '</div>' +
          '<p class="small" style="margin:0 0 12px">Demo number ' + u.demo + ' · B&amp;Q Club member: <b>' + (isClubMember() ? 'Yes' : 'No') + '</b></p><button class="btn btn-outline btn-sm" type="button" id="soBtn">Sign out</button></div>'
         : '<div class="panel" style="margin-bottom:20px"><p style="margin-top:0">You\'re shopping as a guest. Sign in to save your projects and pick up where you left off on any device.</p><button class="btn btn-buy" type="button" id="siBtn">Sign in</button></div>') +
      '<h2 id="wishlist">Wish list (' + w.length + ')</h2>' + (w.length ? '<div class="grid" id="wishGrid">' + w.map(function (p) { return card(p); }).join('') + '</div>' : '<p class="muted">Tap the heart on any product to save it here.</p>') +
      '<h2 id="orders" style="margin-top:28px">Order history</h2>' + (orders.length ? orders.map(function (o) {
        return '<div class="panel" style="margin-bottom:10px"><b>' + esc(o.id) + '</b> · ' + esc(o.date) + ' · ' + (o.fulfil === 'collect' ? 'Click + Collect' : 'Home Delivery') + ' · <b>' + money2(o.total) + '</b></div>';
      }).join('') : '<p class="muted">No orders yet.</p>');
    if ($('#soBtn')) $('#soBtn').addEventListener('click', logout);
    if ($('#siBtn')) $('#siBtn').addEventListener('click', openLogin);
    if ($('#wishGrid')) wireCards($('#wishGrid'), 'wishlist', false);
  };

  pages.notfound = function () {};

  /* ============================================================
     Boot
     ============================================================ */
  function boot() {
    isReturning();
    var u = getUser();
    if (u) { try { if (amplitude.getUserId && amplitude.getUserId() !== u.userId) amplitude.setUserId(u.userId); } catch (e) {} }
    renderHeader();
    renderFooter();
    renderEvLog(false);
    var page = document.body.dataset.page;
    if (pages[page]) pages[page]();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.BQ = { track: track, generateUserId: generateUserId, totals: totals };
})();
