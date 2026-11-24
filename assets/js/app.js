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
     Each product type / shape gets a distinct, recognisable drawing so a
     broken search result (a toilet seat for "white matt emulsion") is obvious.
     ============================================================ */
  var BRAND_COL = { Valspar: '#1D3E8F', Dulux: '#00539F', Crown: '#B5121B', GoodHome: '#323C41', 'Graham & Brown': '#2B2B2B', Colours: '#6A3E8E', Diall: '#FA6400', Blooma: '#3F7D3A' };
  function svgWrap(p, inner) {
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(p.name) + '"><ellipse cx="100" cy="182" rx="66" ry="7" fill="#000" opacity=".08"/>' + inner + '</svg>';
  }
  function txt(x, y, size, fill, s) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="middle" fill="' + fill + '" font-family="Arial" font-weight="800">' + s + '</text>'; }
  var SHAPES = {
    microwave: function (c) {
      return '<rect x="22" y="54" width="156" height="104" rx="8" fill="' + c + '" stroke="#9AA0A3" stroke-width="3"/><rect x="34" y="66" width="102" height="80" rx="4" fill="#2B3135"/><rect x="42" y="74" width="52" height="26" fill="#fff" opacity=".15"/>' +
        '<rect x="144" y="68" width="24" height="12" fill="#2B3135"/><circle cx="156" cy="104" r="9" fill="#9AA0A3"/><circle cx="156" cy="132" r="9" fill="#9AA0A3"/><rect x="32" y="158" width="12" height="10" fill="#555"/><rect x="156" y="158" width="12" height="10" fill="#555"/>';
    },
    vanity: function (c) {
      return '<path d="M100 66 v-26 h18" stroke="#9AA0A3" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="32" y="62" width="136" height="18" rx="6" fill="#fff" stroke="#AAB0B3" stroke-width="2"/><ellipse cx="100" cy="70" rx="42" ry="5" fill="#D8DEE1"/>' +
        '<rect x="40" y="80" width="120" height="84" fill="' + c + '" stroke="#AAB0B3" stroke-width="2"/><line x1="100" y1="84" x2="100" y2="160" stroke="#C8CDD0" stroke-width="2"/><rect x="86" y="112" width="6" height="18" rx="3" fill="#9AA0A3"/><rect x="108" y="112" width="6" height="18" rx="3" fill="#9AA0A3"/><rect x="46" y="164" width="8" height="12" fill="#666"/><rect x="146" y="164" width="8" height="12" fill="#666"/>';
    },
    shower: function () {
      var d = ''; for (var i = 0; i < 6; i++) d += '<line x1="' + (46 + i * 8) + '" y1="62" x2="' + (40 + i * 8) + '" y2="' + (110 + (i % 2) * 14) + '" stroke="#8FC3FF" stroke-width="3" stroke-dasharray="6 6"/>';
      return '<rect x="118" y="18" width="9" height="154" rx="4" fill="#B7BEC2"/><path d="M122 34 h-46" stroke="#B7BEC2" stroke-width="8" stroke-linecap="round"/><ellipse cx="64" cy="48" rx="32" ry="11" fill="#9AA0A3"/>' + d +
        '<rect x="94" y="132" width="66" height="24" rx="12" fill="#CFD4D6" stroke="#9AA0A3" stroke-width="2"/><circle cx="104" cy="144" r="10" fill="#9AA0A3"/><circle cx="150" cy="144" r="10" fill="#9AA0A3"/>';
    },
    rainhead: function (c) {
      var d = ''; for (var i = 0; i < 7; i++) d += '<line x1="' + (52 + i * 16) + '" y1="104" x2="' + (48 + i * 16) + '" y2="' + (150 + (i % 2) * 14) + '" stroke="#8FC3FF" stroke-width="3" stroke-dasharray="6 6"/>';
      return '<rect x="95" y="14" width="10" height="54" fill="' + c + '"/><ellipse cx="100" cy="86" rx="70" ry="20" fill="' + c + '"/><ellipse cx="100" cy="92" rx="62" ry="12" fill="#555"/>' + d;
    },
    tube: function () {
      return '<path d="M88 44 L100 8 L112 44 Z" fill="#E6E8E9" stroke="#AAB0B3" stroke-width="2"/><rect x="66" y="42" width="68" height="124" rx="6" fill="#fff" stroke="#AAB0B3" stroke-width="3"/><rect x="66" y="74" width="68" height="56" fill="#1D3E8F"/>' +
        txt(100, 98, 12, '#fff', 'SILICONE') + txt(100, 116, 11, '#fff', 'SEALANT') + '<rect x="70" y="166" width="60" height="12" fill="#888"/>';
    },
    socket: function () {
      var face = function (x) {
        return '<rect x="' + x + '" y="72" width="56" height="64" rx="4" fill="#F3F3F3" stroke="#D0D4D6" stroke-width="2"/><rect x="' + (x + 22) + '" y="82" width="12" height="20" fill="#3A3F42"/><rect x="' + (x + 8) + '" y="110" width="16" height="10" fill="#3A3F42"/><rect x="' + (x + 32) + '" y="110" width="16" height="10" fill="#3A3F42"/><rect x="' + (x + 44) + '" y="76" width="8" height="12" rx="2" fill="#D92910"/>';
      };
      return '<rect x="22" y="56" width="156" height="96" rx="10" fill="#fff" stroke="#AAB0B3" stroke-width="3"/>' + face(36) + face(108);
    },
    handle: function (c) {
      return '<rect x="56" y="30" width="44" height="140" rx="22" fill="' + c + '" opacity=".9"/><circle cx="78" cy="70" r="20" fill="#444"/><rect x="72" y="60" width="112" height="20" rx="10" fill="' + c + '"/><rect x="70" y="122" width="16" height="26" rx="4" fill="#555"/>';
    },
    toilet: function () {
      return '<rect x="58" y="22" width="84" height="20" rx="8" fill="#E6E8E9" stroke="#AAB0B3" stroke-width="2"/><ellipse cx="100" cy="106" rx="60" ry="70" fill="#fff" stroke="#AAB0B3" stroke-width="4"/><ellipse cx="100" cy="114" rx="32" ry="42" fill="#E3EBEF" stroke="#C3CACD" stroke-width="2"/>';
    },
    worktop: function (c) {
      return '<path d="M14 112 L124 68 L188 88 L78 132 Z" fill="' + c + '"/><path d="M14 112 L78 132 L78 150 L14 130 Z" fill="' + c + '"/><path d="M14 112 L78 132 L78 150 L14 130 Z" fill="#000" opacity=".2"/><path d="M78 132 L188 88 L188 106 L78 150 Z" fill="#000" opacity=".1"/>' +
        '<path d="M40 104 L140 72 M60 110 L160 78 M86 116 L170 88" stroke="#000" opacity=".12" stroke-width="2"/>';
    },
    lights: function (c) {
      var s = '';
      [[0, 60], [0, 120]].forEach(function (row) {
        s += '<path d="M10 ' + row[1] + ' Q55 ' + (row[1] + 40) + ' 100 ' + row[1] + ' T190 ' + row[1] + '" stroke="#2E6B3A" stroke-width="3" fill="none"/>';
        [[28, 14], [56, 20], [100, 0], [144, -20], [172, -14]].forEach(function (b) {
          var y = row[1] + b[1] + 10;
          s += '<circle cx="' + b[0] + '" cy="' + y + '" r="16" fill="' + c + '" opacity=".3"/><circle cx="' + b[0] + '" cy="' + y + '" r="8" fill="' + c + '"/>';
        });
      });
      return s;
    },
    wreath: function (c) {
      return '<circle cx="100" cy="96" r="54" fill="none" stroke="#2E6B3A" stroke-width="30"/><circle cx="100" cy="96" r="54" fill="none" stroke="#4A9A5C" stroke-width="10" stroke-dasharray="6 10"/>' +
        '<circle cx="70" cy="60" r="5" fill="#D92910"/><circle cx="140" cy="84" r="5" fill="#D92910"/><circle cx="62" cy="120" r="5" fill="#D92910"/><path d="M100 148 l-26 26 l10 -34 z M100 148 l26 26 l-10 -34 z" fill="' + c + '"/><circle cx="100" cy="148" r="11" fill="' + c + '"/>';
    },
    tree: function (c) {
      return '<path d="M100 18 L150 90 H124 L162 144 H38 L76 90 H50 Z" fill="' + c + '"/><rect x="90" y="144" width="20" height="28" fill="#6E4B2A"/><circle cx="84" cy="104" r="6" fill="#FFE500"/><circle cx="118" cy="124" r="6" fill="#D92910"/><circle cx="104" cy="64" r="6" fill="#FFE500"/><circle cx="72" cy="132" r="6" fill="#D92910"/>';
    },
    mirror: function (c) {
      return '<ellipse cx="100" cy="96" rx="54" ry="80" fill="' + c + '"/><ellipse cx="100" cy="96" rx="45" ry="71" fill="#DCE8EE"/><path d="M76 56 l22 -14 M72 74 l38 -24" stroke="#fff" stroke-width="6" opacity=".85" stroke-linecap="round"/>';
    },
    shelf: function (c) {
      var books = function (y) { return '<rect x="62" y="' + y + '" width="10" height="34" fill="#D92910"/><rect x="74" y="' + (y + 4) + '" width="10" height="30" fill="#1D3E8F"/><rect x="86" y="' + y + '" width="8" height="34" fill="#F2C14E"/><rect x="118" y="' + (y + 14) + '" width="20" height="20" fill="#5DA130"/>'; };
      return '<rect x="50" y="16" width="100" height="160" fill="' + c + '"/><rect x="58" y="24" width="84" height="42" fill="#F3EFE8"/><rect x="58" y="74" width="84" height="42" fill="#F3EFE8"/><rect x="58" y="124" width="84" height="44" fill="#F3EFE8"/>' + books(30) + books(80);
    },
    bag: function () {
      return '<path d="M46 38 h108 l12 138 h-132 z" fill="#D9D3C7" stroke="#B9B2A3" stroke-width="3"/><rect x="58" y="70" width="84" height="56" fill="#1D3E8F"/>' + txt(100, 96, 14, '#fff', 'CEMENT') + txt(100, 116, 12, '#FFE500', '25kg');
    },
    screws: function () {
      return '<rect x="46" y="80" width="108" height="90" fill="#FA6400"/><rect x="46" y="80" width="108" height="22" fill="#323C41"/>' + txt(100, 96, 12, '#fff', 'SCREWS') +
        '<rect x="86" y="18" width="28" height="9" rx="3" fill="#9AA0A3"/><path d="M93 27 h14 l-7 44 z" fill="#B8BEC1"/><path d="M93 34 l14 4 M94 42 l12 4 M96 50 l9 3 M97 58 l7 3" stroke="#888" stroke-width="2"/>';
    },
    radiator: function (c) {
      var f = ''; for (var i = 0; i < 7; i++) f += '<rect x="' + (34 + i * 19) + '" y="44" width="15" height="112" rx="7" fill="' + c + '" stroke="#AAB0B3" stroke-width="2"/>';
      return f + '<rect x="30" y="98" width="140" height="8" fill="#DDE1E3"/><circle cx="44" cy="166" r="8" fill="#555"/><circle cx="156" cy="166" r="8" fill="#555"/><rect x="150" y="30" width="18" height="14" rx="3" fill="#323C41"/>';
    },
    tap: function (c) {
      return '<rect x="76" y="140" width="48" height="20" rx="4" fill="' + c + '" stroke="#9AA0A3" stroke-width="2"/><rect x="88" y="80" width="24" height="62" rx="6" fill="' + c + '" stroke="#9AA0A3" stroke-width="2"/><path d="M112 98 h40 v18" stroke="' + c + '" stroke-width="14" fill="none"/><path d="M112 98 h40 v18" stroke="#9AA0A3" stroke-width="2" fill="none"/>' +
        '<path d="M70 70 h60 M100 52 v28" stroke="#9AA0A3" stroke-width="10" stroke-linecap="round"/><circle cx="100" cy="72" r="8" fill="#D92910"/>';
    },
    door: function (c) {
      return '<rect x="56" y="20" width="88" height="156" fill="' + c + '" stroke="#AAB0B3" stroke-width="3"/><rect x="66" y="30" width="68" height="136" fill="none" stroke="#D0D4D6" stroke-width="2"/><rect x="126" y="78" width="7" height="44" rx="3" fill="#6B7276"/>';
    },
    pendant: function (c) {
      return '<line x1="100" y1="8" x2="100" y2="66" stroke="#333" stroke-width="3"/><path d="M56 122 L80 66 L120 66 L144 122 Z" fill="' + c + '"/><circle cx="100" cy="130" r="13" fill="#FFE58A"/><circle cx="100" cy="130" r="26" fill="#FFE58A" opacity=".3"/>';
    },
    batten: function () {
      return '<rect x="12" y="88" width="176" height="24" rx="12" fill="#fff" stroke="#AAB0B3" stroke-width="3"/><rect x="20" y="93" width="160" height="14" rx="7" fill="#FFF3B0"/><rect x="20" y="72" width="160" height="10" fill="#FFF3B0" opacity=".5"/>';
    },
    mower: function (c) {
      return '<path d="M120 112 L170 30" stroke="#333" stroke-width="7" stroke-linecap="round"/><path d="M160 30 h24" stroke="#333" stroke-width="9" stroke-linecap="round"/><path d="M30 112 Q30 84 70 84 H130 Q150 84 150 112 Z" fill="' + c + '"/><rect x="26" y="110" width="128" height="18" fill="#2E3A2E"/>' +
        '<circle cx="46" cy="142" r="18" fill="#333"/><circle cx="46" cy="142" r="7" fill="#999"/><circle cx="134" cy="142" r="18" fill="#333"/><circle cx="134" cy="142" r="7" fill="#999"/>';
    },
    drill: function (c) {
      return '<rect x="50" y="56" width="100" height="42" rx="12" fill="' + c + '"/><rect x="146" y="68" width="34" height="16" fill="#555"/><rect x="178" y="73" width="16" height="6" fill="#999"/><rect x="66" y="94" width="34" height="58" rx="6" fill="#333"/><rect x="54" y="148" width="60" height="28" rx="4" fill="' + c + '"/><rect x="54" y="160" width="60" height="16" rx="3" fill="#333"/>';
    },
    jigsaw: function (c) {
      return '<path d="M40 70 Q40 40 80 40 H140 Q160 40 160 70 V110 H40 Z" fill="' + c + '"/><rect x="72" y="54" width="56" height="20" rx="10" fill="#fff"/><rect x="32" y="110" width="140" height="14" fill="#555"/><rect x="96" y="124" width="8" height="44" fill="#BBB"/><path d="M96 130 l8 4 M96 140 l8 4 M96 150 l8 4" stroke="#777" stroke-width="2"/>';
    },
    toolkit: function (c) {
      return '<rect x="70" y="30" width="60" height="22" rx="8" fill="none" stroke="#333" stroke-width="8"/><rect x="24" y="50" width="152" height="118" rx="8" fill="' + c + '"/><rect x="24" y="96" width="152" height="8" fill="#000" opacity=".25"/><rect x="88" y="88" width="24" height="22" rx="3" fill="#C0C4C6"/>';
    },
    furniture: function (c) {
      return '<rect x="44" y="112" width="112" height="12" rx="4" fill="' + c + '"/><rect x="58" y="124" width="8" height="44" fill="' + c + '"/><rect x="134" y="124" width="8" height="44" fill="' + c + '"/>' +
        '<path d="M10 120 h40 v-30 h-34 z" fill="' + c + '" opacity=".85"/><path d="M190 120 h-40 v-30 h34 z" fill="' + c + '" opacity=".85"/><rect x="12" y="120" width="6" height="48" fill="' + c + '"/><rect x="182" y="120" width="6" height="48" fill="' + c + '"/>';
    },
    roller: function () {
      return '<rect x="40" y="40" width="110" height="34" rx="12" fill="#FFF" stroke="#AAB0B3" stroke-width="3"/><path d="M150 57 h16 v40 h-60 v26" stroke="#888" stroke-width="6" fill="none"/><rect x="98" y="122" width="16" height="54" rx="6" fill="#FA6400"/>';
    },
    brush: function () {
      return '<rect x="84" y="20" width="32" height="70" rx="8" fill="#6E4B2A"/><rect x="74" y="88" width="52" height="22" fill="#B7BEC2"/><path d="M72 110 h56 l-6 62 h-44 z" fill="#323C41"/>';
    },
    tape: function () {
      return '<circle cx="100" cy="100" r="66" fill="#E9D8A6"/><circle cx="100" cy="100" r="30" fill="#fff" stroke="#D2BE86" stroke-width="3"/><path d="M160 120 L190 170" stroke="#E9D8A6" stroke-width="26"/>';
    },
    sheet: function () {
      return '<path d="M30 60 Q100 30 170 60 L160 160 Q100 140 40 160 Z" fill="#BFD6E6" opacity=".9" stroke="#9BB8CC" stroke-width="2"/><path d="M60 70 Q80 110 70 150 M110 60 Q125 100 118 146" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>';
    },
    tub: function (c) {
      return '<path d="M44 60 h112 l-10 110 h-92 z" fill="' + c + '" stroke="#888" stroke-width="2"/><rect x="38" y="48" width="124" height="18" rx="4" fill="#6B7276"/><rect x="58" y="90" width="84" height="44" fill="#FA6400"/>' + txt(100, 110, 11, '#fff', 'ADHESIVE') + txt(100, 126, 10, '#fff', '15kg');
    }
  };

  function art(p) {
    var c = p.colour || '#ccc', b = BRAND_COL[p.brand] || '#323C41', s;
    if (p.shape && SHAPES[p.shape]) return svgWrap(p, SHAPES[p.shape](c));
    switch (p.type) {
      case 'paint':
        if (p.pack < 1) {
          s = '<rect x="78" y="96" width="44" height="78" rx="4" fill="#cfd4d6"/><rect x="78" y="110" width="44" height="46" fill="' + c + '" stroke="#e3e3e3"/><rect x="78" y="110" width="44" height="10" fill="' + b + '"/><rect x="74" y="86" width="52" height="14" rx="3" fill="' + b + '"/>' + txt(100, 146, 9, '#323C41', esc(p.packLabel));
        } else {
          var w = p.pack >= 10 ? 132 : p.pack >= 5 ? 116 : p.pack >= 2.5 ? 96 : 78;
          var hgt = p.pack >= 10 ? 132 : p.pack >= 5 ? 118 : p.pack >= 2.5 ? 100 : 82;
          var x = 100 - w / 2, y = 176 - hgt;
          s = '<path d="M' + (x + 8) + ' ' + (y + 8) + ' Q100 ' + (y - 46) + ' ' + (x + w - 8) + ' ' + (y + 8) + '" stroke="#8A9092" stroke-width="3" fill="none"/>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hgt + '" rx="5" fill="#cfd4d6"/>' +
            '<rect x="' + x + '" y="' + (y + 22) + '" width="' + w + '" height="' + (hgt - 40) + '" fill="' + c + '" stroke="#e1e1e1"/>' +
            '<rect x="' + x + '" y="' + (y + 22) + '" width="' + w + '" height="18" fill="' + b + '"/>' +
            txt(100, y + 35, 11, '#fff', esc(p.brand.toUpperCase())) + txt(100, y + hgt - 28, 15, '#323C41', esc(p.packLabel)) +
            '<ellipse cx="100" cy="' + y + '" rx="' + (w / 2) + '" ry="8" fill="#b5bbbe"/>' +
            '<rect x="' + (x + w - 30) + '" y="' + (y + 48) + '" width="20" height="20" fill="' + c + '" stroke="#999" stroke-width=".5"/>';
        }
        return svgWrap(p, s);
      case 'flooring':
        s = '';
        for (var i = 0; i < 6; i++) s += '<rect x="' + (22 + (i % 2) * 12) + '" y="' + (40 + i * 22) + '" width="144" height="20" fill="' + c + '" stroke="rgba(0,0,0,.18)"/><path d="M' + (40 + i * 17) + ' ' + (44 + i * 22) + ' q30 4 70 0" stroke="rgba(0,0,0,.12)" fill="none"/>';
        return svgWrap(p, s);
      case 'tiles':
        s = '<rect x="30" y="30" width="140" height="140" fill="#e9e9e6"/>';
        for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) s += '<rect x="' + (33 + k * 46) + '" y="' + (33 + r * 46) + '" width="43" height="43" fill="' + c + '"/>';
        return svgWrap(p, s + '<path d="M40 60 l20 -6 M110 120 l25 4" stroke="rgba(255,255,255,.35)" stroke-width="3"/>');
      case 'wallpaper':
        s = '<rect x="40" y="26" width="110" height="148" fill="#F4F1EA"/>';
        for (var j = 0; j < 9; j++) { var lx = 52 + (j % 3) * 34, ly = 40 + Math.floor(j / 3) * 46; s += '<path d="M' + lx + ' ' + (ly + 30) + ' Q' + (lx + 2) + ' ' + ly + ' ' + (lx + 20) + ' ' + (ly + 4) + ' Q' + (lx + 18) + ' ' + (ly + 26) + ' ' + lx + ' ' + (ly + 30) + 'Z" fill="' + c + '"/>'; }
        return svgWrap(p, s + '<rect x="150" y="26" width="18" height="148" rx="9" fill="' + c + '" opacity=".85"/><ellipse cx="159" cy="26" rx="9" ry="4" fill="#ddd"/>');
      case 'decking':
        s = '';
        for (var d = 0; d < 5; d++) s += '<g transform="translate(' + (d * 8) + ',' + (d * 22) + ')"><rect x="16" y="50" width="150" height="18" fill="' + c + '" stroke="rgba(0,0,0,.25)"/><path d="M20 55 h140 M20 59 h140 M20 63 h140" stroke="rgba(0,0,0,.18)"/></g>';
        return svgWrap(p, s);
      default:
        return svgWrap(p, '<rect x="46" y="46" width="108" height="122" fill="' + c + '" stroke="rgba(0,0,0,.15)"/><rect x="46" y="46" width="108" height="20" fill="' + b + '"/>' + txt(100, 60, 11, '#fff', esc(p.brand.toUpperCase())));
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
            '<a href="calculator.html" class="hide-sm">' + ICON.ideas + '<span>Project Calculator</span></a>' +
            '<a href="404.html" class="hide-md">' + ICON.services + '<span>Services</span></a>' +
            '<a href="stores.html" class="hide-md">' + ICON.stores + '<span>Stores</span></a>' +
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
     Project Calculator: standalone tool (calculator.html), reached from the homepage.
     It works out a quantity, but knows nothing about the products you've been
     researching and doesn't link to one. You have to search for it yourself.
     ============================================================ */
  var CALC_DEFS = [
    { type: 'paint', label: 'Paint a room', dept: 'painting-decorating', def: 'ITEM_001', what: 'paint', ph: 'e.g. white matt emulsion 5L' },
    { type: 'wallpaper', label: 'Wallpaper a room', dept: 'painting-decorating', def: 'ITEM_011', what: 'wallpaper', ph: 'e.g. green leaves wallpaper' },
    { type: 'flooring', label: 'Lay flooring', dept: 'tiling-flooring', def: 'ITEM_020', what: 'flooring', ph: 'e.g. natural oak laminate' },
    { type: 'tiles', label: 'Tile a floor or wall', dept: 'tiling-flooring', def: 'ITEM_030', what: 'tiles', ph: 'e.g. light grey porcelain tile' },
    { type: 'decking', label: 'Build a deck', dept: 'outdoor-garden', def: 'ITEM_040', what: 'decking', ph: 'e.g. brown softwood deck board' }
  ];
  function calcDef(type) { return CALC_DEFS.filter(function (c) { return c.type === type; })[0] || CALC_DEFS[0]; }
  function recentlyViewed() { return LS.get('bq_recent', []).map(byId).filter(Boolean); }

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

  /* The friction. This is the search B&Q shipped inside the calculator, and it is deliberately poor:
     - it knows nothing about the calculation, the project type or what you've been looking at
     - it searches the WHOLE catalogue with loose OR keyword matching ("white" -> sealant, sockets, toilet seats)
     - it drops any token containing a digit, so "5L" or "10L" are silently ignored
     - a sponsored other-brand product is always pinned first
     - ranking is by sitewide popularity, and the right pack for the job always lands last */
  var CALC_PAGE = 5;
  function calcSearch(ctx, term) {
    var tokens = term.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter(function (t) { return t.length > 2 && !/\d/.test(t); });
    if (!tokens.length) return [];
    var hits = PRODUCTS.filter(function (x) {
      var words = (x.name + ' ' + x.brand).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/);
      return tokens.some(function (t) { return words.some(function (w) { return w.indexOf(t) === 0; }); });
    });
    if (!hits.length) return [];
    var ideal = ctx.ideal;
    var sponsored = PRODUCTS.filter(function (x) { return x.type === ctx.type && x.brand !== ideal.brand && x.stock; })
      .sort(function (a, b) { return b.reviews - a.reviews; })[0];
    var rest = hits.filter(function (x) { return x !== sponsored && x !== ideal; }).sort(function (a, b) { return b.reviews - a.reviews; });
    if (hits.indexOf(ideal) >= 0) rest.push(ideal);
    return (sponsored ? [{ p: sponsored, sponsored: true }] : []).concat(rest.map(function (x) { return { p: x }; }));
  }
  function clip(s, n) { return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }

  // ctx = { type, def, context (last researched product of this type, or null), ideal (the right pack) }
  function renderCalc(ctx, mount) {
    mount.innerHTML =
      '<section class="calc open" id="calc"><div class="calc-body">' +
        '<form id="calcForm" novalidate><div class="calc-fields">' + calcFields(ctx.type) + '</div>' +
        '<div class="calc-actions"><button class="btn btn-dark" type="submit">Calculate</button><span class="small muted">Measure in metres. Don\'t subtract doors or windows, it\'s handy to have a little extra.</span></div></form>' +
        '<div class="calc-result" id="calcResult" hidden>' +
          '<div class="small muted">You\'ll need about</div>' +
          '<div class="calc-answer"><span class="big" id="calcBig"></span><span class="sub" id="calcSub"></span></div>' +
          '<div class="calc-reco" id="calcReco" data-flag="calculator-item-search-improvement"></div>' +
          '<div class="calc-search"><label for="calcQ"><b>Find a product for your project</b></label>' +
            '<form id="calcSearchForm" style="margin-top:6px" role="search"><input id="calcQ" placeholder="' + ctx.def.ph + '" autocomplete="off" enterkeyhint="search"><button type="submit">Search</button></form>' +
            '<div class="calc-results" id="calcResults" aria-live="polite"></div>' +
          '</div>' +
        '</div>' +
      '</div></section>';
    var started = false, lastResults = [], shownCount = 0;
    var cat = deptName(ctx.def.dept);
    $('#calcForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var res = computeCalc(ctx.type);
      if (!res) { $$('#calcForm input').forEach(function (i) { if (!(parseFloat(i.value) > 0)) i.style.borderColor = '#D92910'; }); return; }
      $$('#calcForm input').forEach(function (i) { i.style.borderColor = ''; });
      if (!started) {
        started = true;
        track('Project Calculator Started', {
          product_id: ctx.context ? ctx.context.id : null, product_category: cat,
          product_price: ctx.context ? ctx.context.price : null, basket_value: basketValue()
        });
      }
      $('#calcBig').textContent = res.big; $('#calcSub').textContent = res.sub;
      $('#calcResult').hidden = false;
      renderReco(ctx, res);
      $('#calcResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('#calcSearchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var term = $('#calcQ').value.trim(); if (!term) { $('#calcQ').focus(); return; }
      $('#calcQ').blur();
      var results = calcSearch(ctx, term);
      var t = totals('home');
      track('Calculator Item Search', {
        search_term: term, results_count: results.length,
        product_id: ctx.context ? ctx.context.id : null, product_category: cat,
        basket_value: t.basket_value, delivery_cost: t.delivery_cost, vat_amount: t.vat_amount, order_total: t.order_total, free_delivery_eligible: t.free_delivery_eligible
      });
      var box = $('#calcResults');
      if (!results.length) { box.innerHTML = '<div class="count">Sorry, we couldn\'t find any results for "' + esc(term) + '". Check the spelling or try something more general.</div>'; return; }
      lastResults = results; shownCount = 0;
      box.innerHTML = '<div class="count">' + results.length + ' results for "' + esc(term) + '"</div><div id="calcList"></div>' +
        '<button class="btn btn-outline btn-sm" type="button" id="calcMore">Show more results</button>';
      showMoreResults();
    });
    function showMoreResults() {
      var next = lastResults.slice(shownCount, shownCount + CALC_PAGE);
      shownCount += next.length;
      $('#calcList').insertAdjacentHTML('beforeend', next.map(function (r) {
        var x = r.p;
        return '<div class="calc-item"><div class="thumb">' + art(x) + '</div><div><div class="t"><a href="product.html?id=' + x.id + '" title="' + esc(x.name) + '">' + esc(clip(x.name, 44)) + '</a></div>' +
          '<div class="dept">' + esc(deptName(x.dept)) + '</div><div class="meta">' +
          (r.sponsored ? '<span class="pill pill-spons">Sponsored</span>' : '') +
          (x.stock ? '' : '<span class="pill pill-oos">Out of stock</span>') + stars(x) + '</div></div>' +
          '<div class="buy"><div class="p">' + money(x.price) + '</div><button class="btn btn-buy btn-sm" type="button" data-cadd="' + x.id + '"' + (x.stock ? '' : ' disabled') + '>' + (x.stock ? 'Add' : 'Unavailable') + '</button></div></div>';
      }).join(''));
      $('#calcMore').hidden = shownCount >= lastResults.length;
      $('#calcMore').textContent = 'Show more results (' + shownCount + ' of ' + lastResults.length + ')';
    }
    $('#calcResults').addEventListener('click', function (e) {
      if (e.target.closest('#calcMore')) { showMoreResults(); return; }
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
  function renderReco(ctx, res) {
    var ideal = ctx.ideal; var el = $('#calcReco');
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
    $('#calcTiles').innerHTML = CALC_DEFS.map(function (c) { return '<a href="calculator.html?type=' + c.type + '"><div class="tile" aria-hidden="true">' + art(byId(c.def)) + '</div>' + esc(c.label) + '</a>'; }).join('');
    var recent = recentlyViewed().slice(0, 4);
    if (recent.length) {
      $('#recentSec').hidden = false;
      $('#recent').innerHTML = recent.map(function (p) { return card(p); }).join('');
      wireCards($('#recent'), 'recently_viewed', false);
    }
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
    LS.set('bq_recent', [p.id].concat(LS.get('bq_recent', []).filter(function (x) { return x !== p.id; })).slice(0, 8));
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
          (p.stock ? '<p class="small" style="margin:-6px 0 14px"><a href="stores.html?id=' + p.id + '">Check stock in store</a></p>' : '') +
          '<div class="buyrow"><div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity">−</button><input id="qty" type="number" min="1" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">+</button></div>' +
            '<button class="btn btn-buy" type="button" id="addBtn"' + (p.stock ? '' : ' disabled') + '>' + (p.stock ? 'Add to basket' : 'Out of stock') + '</button>' +
            '<button class="wish-inline' + (inWish ? ' on' : '') + '" type="button" id="wishBtn" aria-label="Add to wish list">' + HEART + '</button></div>' +
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

  pages.calculator = function () {
    var recent = recentlyViewed();
    var lastCalc = recent.filter(function (p) { return CALC_TYPES[p.type]; })[0];
    var type = CALC_TYPES[qs('type')] ? qs('type') : (lastCalc ? lastCalc.type : 'paint');
    function select(t) {
      type = t;
      var def = calcDef(t);
      var context = recent.filter(function (p) { return p.type === t && p.calcPick; })[0] || null;
      var ideal = byId(context ? context.calcPick : def.def);
      $$('#calcTypes [data-type]').forEach(function (b) { var on = b.getAttribute('data-type') === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#calcIntro').textContent = 'Work out how much ' + def.what + ' you need. Pop in your measurements and we\'ll do the maths.';
      renderCalc({ type: t, def: def, context: context, ideal: ideal }, $('#calcMount'));
      try { history.replaceState(null, '', 'calculator.html?type=' + t); } catch (e) {}
    }
    $('#calcTypes').innerHTML = CALC_DEFS.map(function (c) {
      return '<button type="button" class="calc-type" data-type="' + c.type + '" aria-pressed="false"><span class="tile" aria-hidden="true">' + art(byId(c.def)) + '</span>' + esc(c.label) + '</button>';
    }).join('');
    $('#calcTypes').addEventListener('click', function (e) { var b = e.target.closest('[data-type]'); if (b && b.getAttribute('data-type') !== type) select(b.getAttribute('data-type')); });
    select(type);
  };

  /* ============================================================
     Store stock checker (stores.html).
     To the shopper it works: they see stock levels per store and can collect.
     Behind the scenes every check silently produces errors for Session Replay error analytics:
       1. GET api/store-stock/v3/availability.json -> 404 (no such file on the static host)
       2. console.error('[StockService] ...')
       3. fallback GET to a host that can never resolve (.invalid) -> request fails, status 0
       4. uncaught TypeError while merging the (missing) live response
     The page quietly falls back to a cached stock snapshot, so nothing looks wrong on screen.
     ============================================================ */
  pages.stores = function () {
    var p = byId(qs('id'));
    var sku = p ? p.id : 'ALL';
    if (p) {
      $('#stockFor').innerHTML = '<div class="stock-product"><div class="thumb" aria-hidden="true">' + art(p) + '</div><div><div class="small muted">Checking stock for</div>' +
        '<b>' + esc(p.name) + '</b><div class="price-sm">' + money(p.price) + '</div></div></div>';
    }
    function storeName(st) { return st.split(' (')[0]; }
    function storeDist(st) { return (st.match(/\(([^)]+)\)/) || [])[1] || ''; }
    $('#storeList').innerHTML = STORES.map(function (st) {
      return '<li><b>' + esc(storeName(st)) + '</b><span class="muted small">' + esc(storeDist(st)) + ' · Open today 7am – 8pm</span></li>';
    }).join('');

    // Cached stock snapshot: deterministic per product + postcode + store, so results look stable and real.
    function cachedQty(pc, i) {
      var h = 0, k = sku + '|' + pc + '|' + i;
      for (var c = 0; c < k.length; c++) h = (h * 31 + k.charCodeAt(c)) >>> 0;
      var q = h % 23;
      return q < 3 ? 0 : q;
    }
    function renderResults(pc) {
      $('#stockResult').innerHTML = '<div class="panel stock-results"><h2 style="font-size:18px;margin-bottom:4px">Stock near ' + esc(pc.toUpperCase()) + '</h2>' +
        '<p class="small muted" style="margin-top:0">Updated a few minutes ago</p><ul class="store-list">' + STORES.map(function (st, i) {
          var q = cachedQty(pc, i);
          var lvl = q === 0 ? '<span class="stock-out">Out of stock</span>' : q < 6 ? '<span class="stock-low">Low stock: ' + q + ' left</span>' : '<span class="stock-in">' + q + ' in stock</span>';
          return '<li class="stock-store"><div><b>' + esc(storeName(st)) + '</b><span class="muted small">' + esc(storeDist(st)) + ' · Ready in as little as 15 minutes</span>' + lvl + '</div>' +
            (p && q > 0 ? '<button class="btn btn-buy btn-sm" type="button" data-collect="' + i + '">Collect from here</button>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }

    // Silent background failure: none of this reaches the UI.
    function mergeLiveStock(live) {
      // BUG (intentional): live is undefined when the stock service fails
      return live.stores.map(function (st) { return { name: st.name, qty: st.qty }; });
    }
    function syncLiveStock() {
      fetch('api/store-stock/v3/availability.json?sku=' + encodeURIComponent(sku) + '&radius=10', { headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) {
            console.error('[StockService] Availability request failed: ' + r.status + ' ' + (r.statusText || 'Not Found'), { sku: sku, endpoint: 'store-stock/v3/availability' });
            throw new Error('HTTP ' + r.status);
          }
          return r.json();
        })
        .catch(function () {
          console.warn('[StockService] Falling back to legacy stock API');
          return fetch('https://stock-legacy.diy-demo.invalid/v1/stock?sku=' + encodeURIComponent(sku)).then(function (r) { return r.json(); });
        })
        .catch(function (err) {
          console.error('[StockService] Legacy stock API unreachable: ' + (err && err.message), { sku: sku });
          return undefined;
        })
        .then(function (live) {
          setTimeout(function () { mergeLiveStock(live); }, 0); // throws: Cannot read properties of undefined (reading 'stores')
        });
    }

    function checkStock() {
      var pc = $('#postcode').value.trim();
      if (!pc) { $('#postcode').focus(); return; }
      $('#stockResult').innerHTML = '<div class="panel stock-loading"><span class="spinner" aria-hidden="true"></span> Checking stores near ' + esc(pc.toUpperCase()) + '…</div>';
      syncLiveStock();
      setTimeout(function () { renderResults(pc); }, 700);
    }
    $('#stockForm').addEventListener('submit', function (e) { e.preventDefault(); checkStock(); });
    $('#stockResult').addEventListener('click', function (e) {
      var b = e.target.closest('[data-collect]'); if (!b || !p) return;
      LS.set('bq_fulfil', 'collect');
      addToBasket(p.id, 1, 'store_stock');
      showAdded(p, 1);
    });
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
