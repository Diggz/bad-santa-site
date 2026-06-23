/* ========================================
   Bad Santa — Shared Nav, Footer & Scripts
   ======================================== */
(function () {
  /* --- Detect current page for active state --- */
  var path = window.location.pathname.split('/').pop() || 'index.html';
  var isHome = (path === '' || path === 'index.html');

  function href(target) {
    /* On the home page, #anchors work directly; on sub-pages, prepend index.html */
    if (target.startsWith('#')) return isHome ? target : 'index.html' + target;
    return target;
  }

  function active(page) {
    return path === page ? ' class="active"' : '';
  }

  /* --- Nav items --- */
  var navItems = [
    { label: 'Listen', url: 'epk.html' },
    { label: 'Buzz', url: 'buzz.html' },
    { label: 'Shows', url: 'shows.html' },
    { label: 'Tickets', url: '#tickets', anchor: true },
    { label: 'Playbill', url: 'playbill.html' }
  ];

  /* --- Build desktop nav links --- */
  var desktopLinks = '';
  navItems.forEach(function (item) {
    var url = item.anchor ? href(item.url) : item.url;
    desktopLinks += '<a href="' + url + '"' + (item.anchor ? '' : active(item.url)) + '>' + item.label + '</a>';
  });
  desktopLinks += '<a href="' + href('#support') + '" class="topbar-cta" style="text-decoration:none;">Support</a>';
  /* Share button (desktop) */
  desktopLinks += '<button class="share-btn" onclick="sharesite(this)" aria-label="Share">'
    + '<svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>'
    + '<span class="share-toast">Link copied!</span>'
    + '</button>';

  /* --- Build mobile menu links --- */
  var mobileLinks = '';
  var closeMenu = "document.querySelector('.mobile-menu').classList.remove('open');document.querySelector('.hamburger').classList.remove('open');";
  navItems.forEach(function (item) {
    var url = item.anchor ? href(item.url) : item.url;
    var onclick = (item.anchor && isHome) ? ' onclick="' + closeMenu + '"' : '';
    mobileLinks += '<a href="' + url + '"' + onclick + '>' + item.label + '</a>';
  });
  var supportOnclick = isHome ? ' onclick="' + closeMenu + '"' : '';
  mobileLinks += '<a href="' + href('#support') + '" class="topbar-cta"' + supportOnclick + '>Support</a>';
  /* Share button (mobile) */
  mobileLinks += '<button class="mobile-share-btn" onclick="sharesite(this)">'
    + '<svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>'
    + ' Share</button>';

  /* --- Topbar HTML --- */
  var brandUrl = isHome ? '#' : 'index.html';
  var topbar = '<div class="topbar">'
    + '<a href="' + brandUrl + '" class="topbar-brand" style="text-decoration:none;">Bad Santa<span class="bolt">⚡</span>The Angry Elves</a>'
    + '<div class="topbar-links">' + desktopLinks + '</div>'
    + '<button class="hamburger" onclick="document.querySelector(\'.mobile-menu\').classList.toggle(\'open\');this.classList.toggle(\'open\');" aria-label="Menu">'
    + '<span></span><span></span><span></span></button>'
    + '</div>'
    + '<div class="mobile-menu">' + mobileLinks + '</div>';

  /* --- Footer HTML --- */
  var footer = '<footer>'
    + '<div class="creed">Living in the Presents. Christmas every day. Don\'t be a dick.</div>'
    + '<div class="footer-links">'
    + '<a href="https://www.facebook.com/BadSantaandTheAngryElves" target="_blank">Facebook</a>'
    + '<a href="https://www.instagram.com/badsantaandtheangryelves/" target="_blank">Instagram</a>'
    + '<a href="https://x.com/BSantaAElves" target="_blank">Twitter</a>'
    + '<a href="https://edinburgh.justthetonic.com/event/88:5735/" target="_blank">Edinburgh Tickets</a>'
    + '<a href="https://www.gofundme.com/f/help-bad-santa-the-angry-elves-rock-edinburgh/donate?source=btn_donate" target="_blank">Donate</a>'
    + '</div>'
    + '<div class="copyright">Bad Santa and the Angry Elves &middot; Orlando, FL &middot; est. 2016 &middot; Edinburgh Fringe 2026</div>'
    + '</footer>';

  /* --- Inject --- */
  var navTarget = document.getElementById('site-nav');
  var footerTarget = document.getElementById('site-footer');
  if (navTarget) navTarget.innerHTML = topbar;
  if (footerTarget) footerTarget.innerHTML = footer;

  /* --- Share function (global) --- */
  window.sharesite = function (btn) {
    var data = {
      title: 'Bad Santa and the Angry Elves',
      text: 'Mythical Cabaret Rock Opera — Edinburgh Fringe 2026',
      url: 'https://badsantaandtheangryelves.com'
    };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else {
      navigator.clipboard.writeText(data.url).then(function () {
        var toast = btn.querySelector('.share-toast');
        if (!toast) {
          toast = document.createElement('span');
          toast.className = 'share-toast';
          toast.textContent = 'Link copied!';
          btn.appendChild(toast);
        }
        toast.classList.add('show');
        setTimeout(function () { toast.classList.remove('show'); }, 2000);
      });
    }
  };
})();
