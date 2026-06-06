/* ============================================================
   Bander -- app.js
   Generic band site: catalog discovery, data loading, rendering
   ============================================================ */

(function () {
  'use strict';

  // -----------------------------------------------------------------
  // Runtime config injected by the server into index.html.
  // Falls back to empty basePath for vanilla local dev.
  // -----------------------------------------------------------------
  var cfg = window.BANDER_CONFIG || {};
  var basePath = cfg.basePath || '';          // e.g. "/bander"
  var githubIssuesUrl = cfg.githubIssuesUrl || 'https://github.com/cescofry/Bander/issues/new';

  // -----------------------------------------------------------------
  // YouTube rejects embeds when the Referer is an IP address
  // (e.g. 127.0.0.1). Redirect to "localhost" so the browser sends
  // a hostname-based Referer that YouTube accepts.
  // Only applies in local dev (hostname is literally 127.0.0.1).
  // -----------------------------------------------------------------
  if (location.hostname === '127.0.0.1') {
    location.replace(location.href.replace('127.0.0.1', 'localhost'));
    return;
  }

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------
  let currentBand = null;   // loaded band data
  let currentSlug = null;   // slug for asset paths
  let revealObserver = null;
  let allBands = [];        // full catalog for client-side filtering
  let searchQuery = '';     // current search text

  // YouTube IFrame API state
  let ytPlayer = null;        // YT.Player instance
  let ytApiReady = false;     // true once YT API has loaded
  let ytPendingVideos = null; // queued video list if API isn't ready yet
  let ytVideoIds = [];        // current playlist video IDs
  let ytActiveIndex = 0;      // currently playing index

  // -----------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------
  const catalogView      = document.getElementById('catalog-view');
  const bandView         = document.getElementById('band-view');
  const bandList         = document.getElementById('band-list');
  const backBtn          = document.getElementById('backBtn');
  const navBrand         = document.getElementById('navBrand');
  const heroTitle        = document.getElementById('heroTitle');
  const heroTagline      = document.getElementById('heroTagline');
  const videoGrid        = document.getElementById('videoGrid');
  const timeline         = document.getElementById('timeline');
  const membersContainer = document.getElementById('membersContainer');
  const triviaList       = document.getElementById('triviaList');
  const tabButtons       = document.querySelectorAll('.tab-btn');
  const pageSections     = document.querySelectorAll('.page-section');
  const catalogSearch    = document.getElementById('catalogSearch');
  const requestCard      = document.getElementById('request-card');
  const requestCardText  = document.getElementById('requestCardText');
  const requestCardLink  = document.getElementById('requestCardLink');

  // -----------------------------------------------------------------
  // Routing (hash-based)
  // -----------------------------------------------------------------
  function navigate() {
    var hash = location.hash.replace(/^#\/?/, '');
    if (hash) {
      loadBand(hash);
    } else {
      showCatalog();
    }
  }

  window.addEventListener('hashchange', navigate);

  // -----------------------------------------------------------------
  // Catalog
  // -----------------------------------------------------------------
  function showCatalog() {
    currentBand = null;
    currentSlug = null;
    destroyPlayer();
    bandView.classList.add('hidden');
    catalogView.classList.remove('hidden');
    document.title = 'Bander';
    resetTheme();
    loadCatalog();
  }

  async function loadCatalog() {
    try {
      var res = await fetch(basePath + '/api/bands');
      allBands = await res.json();
      applySearch();
    } catch (err) {
      bandList.innerHTML = '<p class="error">Failed to load bands.</p>';
    }
  }

  // -----------------------------------------------------------------
  // Search & filter
  // -----------------------------------------------------------------
  function applySearch() {
    var query = searchQuery.trim().toLowerCase();
    var filtered = allBands;

    if (query) {
      filtered = allBands.filter(function (b) {
        var haystack = [
          b.name || '',
          (b.genres || []).join(' '),
          b.origin || '',
          b.description || ''
        ].join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
      });
    }

    renderCatalog(filtered);
    updateRequestCard(query, filtered.length);
  }

  function updateRequestCard(query, matchCount) {
    if (!query || matchCount > 0) {
      requestCard.classList.add('hidden');
      return;
    }

    // Capitalize the query for display
    var displayName = searchQuery.trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); });

    requestCardText.textContent = "Can\u2019t find \u201c" + displayName + "\u201d in the catalog.";

    var issueTitle = 'Band request: ' + displayName;
    var issueBody =
      '## Requested band\n' +
      displayName + '\n\n' +
      '## Why this band should be added\n' +
      '<!-- Tell us why you\u2019d like to see this band on Bander -->\n\n' +
      '## Useful links or sources\n' +
      '<!-- Wikipedia, YouTube channels, official sites, etc. -->\n\n' +
      '## Additional notes\n' +
      '<!-- Anything else: specific albums, eras, live footage, etc. -->\n';

    var issueUrl = githubIssuesUrl
      + '?title=' + encodeURIComponent(issueTitle)
      + '&body=' + encodeURIComponent(issueBody)
      + '&labels=' + encodeURIComponent('band-request');

    requestCardLink.href = issueUrl;
    requestCardLink.textContent = 'Request \u201c' + esc(displayName) + '\u201d on GitHub';
    requestCard.classList.remove('hidden');
  }

  catalogSearch.addEventListener('input', function () {
    searchQuery = this.value;
    applySearch();
  });

  function renderCatalog(bands) {
    if (!bands.length && !searchQuery.trim()) {
      bandList.innerHTML = '<p class="empty">No bands found. Run the skill to add one.</p>';
      return;
    }
    if (!bands.length) {
      bandList.innerHTML = '';
      return;
    }
    bandList.innerHTML = bands.map(function (b) {
      var genres = (b.genres || []).slice(0, 3).join(', ');
      var meta = [b.origin, b.formed ? 'Est. ' + b.formed : ''].filter(Boolean).join(' -- ');
      return (
        '<a class="band-card" href="#/' + encodeURIComponent(b.slug) + '">' +
          '<h2 class="band-card-name">' + esc(b.name) + '</h2>' +
          (genres ? '<p class="band-card-genres">' + esc(genres) + '</p>' : '') +
          (meta ? '<p class="band-card-meta">' + esc(meta) + '</p>' : '') +
          (b.description ? '<p class="band-card-desc">' + esc(truncate(b.description, 140)) + '</p>' : '') +
        '</a>'
      );
    }).join('');
  }

  // -----------------------------------------------------------------
  // Band loading
  // -----------------------------------------------------------------
  async function loadBand(slug) {
    currentSlug = slug;
    try {
      var res = await fetch(basePath + '/api/bands/' + encodeURIComponent(slug));
      if (!res.ok) throw new Error('Not found');
      currentBand = await res.json();
    } catch (err) {
      bandList.innerHTML = '<p class="error">Band not found.</p>';
      showCatalog();
      return;
    }
    catalogView.classList.add('hidden');
    bandView.classList.remove('hidden');
    applyTheme(currentBand.theme || {});
    renderBand(currentBand);
    window.scrollTo({ top: 0, behavior: 'instant' });
    highlightNavButton('live');
    observeReveals();
    setupSectionObserver();
  }

  // -----------------------------------------------------------------
  // Theme application
  // -----------------------------------------------------------------
  var defaultColors = {
    bg: '#0a0a1a',
    bg_secondary: '#111128',
    surface: '#1a1a2e',
    text: '#e0e0e0',
    text_muted: '#888',
    accent: '#4fc3f7',
    accent_secondary: '#7c4dff',
    nav_bg: 'rgba(10, 10, 26, 0.95)',
    border: 'rgba(255, 255, 255, 0.08)'
  };

  var defaultBadges = {
    formation: '#4caf50',
    album_release: '#00bcd4',
    lineup_change: '#e91e63',
    milestone: '#ffc107',
    controversy: '#ff5722',
    breakup: '#9e9e9e',
    reunion: '#8bc34a',
    death: '#616161',
    official: '#4fc3f7',
    live: '#ff9800',
    interview: '#ab47bc',
    documentary: '#26a69a',
    other: '#78909c'
  };

  function applyTheme(theme) {
    var root = document.documentElement;
    var colors = Object.assign({}, defaultColors, theme.colors || {});
    var badges = Object.assign({}, defaultBadges, theme.badges || {});

    Object.keys(colors).forEach(function (key) {
      root.style.setProperty('--color-' + key.replace(/_/g, '-'), colors[key]);
    });
    Object.keys(badges).forEach(function (key) {
      root.style.setProperty('--badge-' + key.replace(/_/g, '-'), badges[key]);
    });

    // Fonts
    if (theme.fonts) {
      var heading = theme.fonts.heading || 'Montserrat';
      var body = theme.fonts.body || 'Inter';
      root.style.setProperty('--font-heading', heading + ', sans-serif');
      root.style.setProperty('--font-body', body + ', sans-serif');

      // Update Google Fonts link
      var hw = theme.fonts.heading_weights || '400;600;700;800;900';
      var bw = theme.fonts.body_weights || '300;400;500;600';
      var link = document.getElementById('google-fonts');
      if (link) {
        link.href = 'https://fonts.googleapis.com/css2?family=' +
          encodeURIComponent(heading) + ':wght@' + hw +
          '&family=' + encodeURIComponent(body) + ':wght@' + bw +
          '&display=swap';
      }
    }
  }

  function resetTheme() {
    applyTheme({});
  }

  // -----------------------------------------------------------------
  // Render full band page
  // -----------------------------------------------------------------
  function renderBand(band) {
    var artist = band;
    document.title = (artist.name || 'Band') + ' -- Bander';
    navBrand.textContent = (artist.name || '').toUpperCase();
    heroTitle.textContent = (artist.name || '').toUpperCase();

    var sep = (band.theme && band.theme.hero && band.theme.hero.tagline_separator) || '|';
    var parts = [];
    if (artist.genres && artist.genres.length) parts.push(artist.genres.slice(0, 2).join(', '));
    if (artist.origin) parts.push(artist.origin);
    var years = artist.formed || '';
    if (artist.dissolved) years += '\u2013' + artist.dissolved;
    else if (artist.formed) years += '\u2013present';
    if (years) parts.push(years);
    heroTagline.innerHTML = parts.join(' &nbsp;' + esc(sep) + '&nbsp; ');

    renderVideos(band.videos || []);
    renderTimeline(band.events || []);
    renderMembers(band.members || []);
    renderTrivia(band.trivia || []);
  }

  // -----------------------------------------------------------------
  // Render: Videos (single player + playlist sidebar)
  // -----------------------------------------------------------------

  // Load YouTube IFrame API once
  function ensureYouTubeAPI() {
    if (ytApiReady || document.getElementById('yt-api-script')) return;
    var tag = document.createElement('script');
    tag.id = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    var first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(tag, first);
  }

  // Global callback required by YouTube IFrame API
  window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (ytPendingVideos) {
      initPlayer(ytPendingVideos);
      ytPendingVideos = null;
    }
  };

  function destroyPlayer() {
    if (ytPlayer) {
      try { ytPlayer.destroy(); } catch (e) { /* ignore */ }
      ytPlayer = null;
    }
    ytVideoIds = [];
    ytActiveIndex = 0;
  }

  function renderVideos(videos) {
    destroyPlayer();

    if (!videos.length) {
      videoGrid.innerHTML = '<p class="empty">No videos available.</p>';
      return;
    }

    // Separate playable videos from fallback-only entries
    var playable = [];
    var fallbacks = [];
    videos.forEach(function (v) {
      var vidId = extractYouTubeId(v.youtube_url);
      if (vidId) {
        playable.push({ id: vidId, title: v.title, year: v.year, category: v.category, url: v.youtube_url });
      } else {
        fallbacks.push(v);
      }
    });

    if (!playable.length) {
      // All entries are invalid -- show fallback links
      videoGrid.innerHTML = fallbacks.map(function (v) {
        var badgeClass = 'badge--' + (v.category || 'other');
        var label = categoryLabel(v.category);
        var watchUrl = v.youtube_url || '#';
        return (
          '<div class="pl-fallback-item">' +
            '<a href="' + esc(watchUrl) + '" target="_blank" rel="noopener">' +
              esc(v.title) +
              (v.year ? ' <span class="video-year">(' + esc(v.year) + ')</span>' : '') +
            '</a>' +
            '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>' +
          '</div>'
        );
      }).join('');
      return;
    }

    ytVideoIds = playable.map(function (p) { return p.id; });

    // Build the layout: player on the left, playlist on the right
    var html =
      '<div class="pl-shell reveal">' +
        '<div class="pl-player-pane">' +
          '<div class="pl-player-wrap">' +
            '<div id="ytPlayerMount"></div>' +
          '</div>' +
          '<div class="pl-now-playing" id="plNowPlaying"></div>' +
        '</div>' +
        '<div class="pl-list-pane">' +
          '<div class="pl-list-header">Playlist</div>' +
          '<ol class="pl-list" id="plList">';

    playable.forEach(function (p, i) {
      var badgeClass = 'badge--' + (p.category || 'other');
      var label = categoryLabel(p.category);
      var thumbUrl = 'https://i.ytimg.com/vi/' + encodeURIComponent(p.id) + '/default.jpg';
      html +=
        '<li class="pl-item' + (i === 0 ? ' pl-item--active' : '') + '" data-index="' + i + '">' +
          '<img class="pl-item-thumb" src="' + esc(thumbUrl) + '" alt="" loading="lazy">' +
          '<div class="pl-item-info">' +
            '<span class="pl-item-title">' + esc(p.title) + '</span>' +
            (p.year ? '<span class="pl-item-year">' + esc(p.year) + '</span>' : '') +
          '</div>' +
          '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>' +
        '</li>';
    });

    html += '</ol>';

    // Append fallback links if any
    if (fallbacks.length) {
      html += '<div class="pl-fallbacks">';
      fallbacks.forEach(function (v) {
        var badgeClass = 'badge--' + (v.category || 'other');
        var label = categoryLabel(v.category);
        var watchUrl = v.youtube_url || '#';
        html +=
          '<div class="pl-fallback-item">' +
            '<a href="' + esc(watchUrl) + '" target="_blank" rel="noopener">' +
              esc(v.title) +
              (v.year ? ' <span class="video-year">(' + esc(v.year) + ')</span>' : '') +
            '</a>' +
            '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '</div></div>';

    videoGrid.innerHTML = html;
    updateNowPlaying(playable[0]);

    // Attach click handlers to playlist items
    var plList = document.getElementById('plList');
    plList.addEventListener('click', function (e) {
      var item = e.target.closest('.pl-item');
      if (!item) return;
      var idx = parseInt(item.dataset.index, 10);
      if (isNaN(idx)) return;
      playAtIndex(idx);
    });

    // Load the YouTube API and create the player
    ensureYouTubeAPI();
    if (ytApiReady) {
      initPlayer(playable);
    } else {
      ytPendingVideos = playable;
    }
  }

  function initPlayer(playable) {
    var mount = document.getElementById('ytPlayerMount');
    if (!mount) return;

    ytPlayer = new YT.Player('ytPlayerMount', {
      height: '100%',
      width: '100%',
      videoId: playable[0].id,
      playerVars: {
        rel: 0,
        playsinline: 1,
        enablejsapi: 1,
        origin: location.origin
      },
      events: {
        onStateChange: onYTStateChange
      }
    });
  }

  function onYTStateChange(event) {
    // When a video ends, play the next one
    if (event.data === YT.PlayerState.ENDED) {
      var next = ytActiveIndex + 1;
      if (next < ytVideoIds.length) {
        playAtIndex(next);
      }
    }
  }

  function playAtIndex(idx) {
    if (idx < 0 || idx >= ytVideoIds.length) return;
    ytActiveIndex = idx;

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById(ytVideoIds[idx]);
    }

    // Update active state in playlist UI
    var items = document.querySelectorAll('.pl-item');
    items.forEach(function (el) {
      el.classList.toggle('pl-item--active', parseInt(el.dataset.index, 10) === idx);
    });

    // Scroll active item into view
    var active = document.querySelector('.pl-item--active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update now-playing bar
    var data = null;
    // Re-derive from current band data
    if (currentBand && currentBand.videos) {
      var vid = currentBand.videos.filter(function (v) {
        return extractYouTubeId(v.youtube_url) === ytVideoIds[idx];
      })[0];
      if (vid) data = { title: vid.title, year: vid.year, category: vid.category };
    }
    updateNowPlaying(data);
  }

  function updateNowPlaying(info) {
    var el = document.getElementById('plNowPlaying');
    if (!el || !info) return;
    var badgeClass = 'badge--' + (info.category || 'other');
    var label = categoryLabel(info.category);
    el.innerHTML =
      '<span class="pl-now-title">' + esc(info.title) + '</span>' +
      (info.year ? '<span class="pl-now-year">' + esc(info.year) + '</span>' : '') +
      '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>';
  }

  // -----------------------------------------------------------------
  // Render: Timeline
  // -----------------------------------------------------------------
  function renderTimeline(events) {
    if (!events.length) {
      timeline.innerHTML = '<p class="empty">No events available.</p>';
      return;
    }
    timeline.innerHTML = events.map(function (e, i) {
      var side = i % 2 === 0 ? 'timeline-left' : 'timeline-right';
      var badgeClass = 'badge--' + (e.category || 'other');
      var label = categoryLabel(e.category);
      var imgHtml = '';
      if (e.image) {
        var src = bandAssetPath(e.image);
        imgHtml =
          '<div class="timeline-img-wrap">' +
            '<img src="' + esc(src) + '" alt="' + esc(e.title) + '" ' +
              'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
            '<div class="img-fallback" style="display:none;"><span>' + esc(initials(e.title)) + '</span></div>' +
          '</div>';
      }
      return (
        '<div class="timeline-event ' + side + ' reveal">' +
          '<div class="timeline-card" data-category="' + esc(e.category || 'other') + '">' +
            '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>' +
            '<time class="timeline-date">' + esc(formatDate(e.date)) + '</time>' +
            '<h3>' + esc(e.title) + '</h3>' +
            '<p>' + esc(e.description || '') + '</p>' +
            imgHtml +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  // -----------------------------------------------------------------
  // Render: Members
  // -----------------------------------------------------------------
  function renderMembers(members) {
    if (!members.length) {
      membersContainer.innerHTML = '<p class="empty">No member information available.</p>';
      return;
    }
    membersContainer.innerHTML = members.map(function (m) {
      var images = (m.images || []).map(function (img) {
        var src = bandAssetPath(img);
        return (
          '<div class="member-img-wrap">' +
            '<img src="' + esc(src) + '" alt="' + esc(m.name) + '" ' +
              'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
            '<div class="img-fallback" style="display:none;"><span>' + esc(initials(m.name)) + '</span></div>' +
          '</div>'
        );
      }).join('');

      var sideProjects = '';
      if (m.side_projects && m.side_projects.length) {
        sideProjects =
          '<div class="member-projects">' +
            '<strong>Other projects:</strong> ' + esc(m.side_projects.join(', ')) +
          '</div>';
      }

      return (
        '<div class="member-section reveal">' +
          '<div class="member-images">' + images + '</div>' +
          '<div class="member-info">' +
            '<h3 class="member-name">' + esc(m.name) + '</h3>' +
            '<p class="member-role">' + esc(m.role) +
              (m.active_period ? ' <span class="member-period">(' + esc(m.active_period) + ')</span>' : '') +
            '</p>' +
            '<p class="member-bio">' + esc(m.bio || '') + '</p>' +
            sideProjects +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  // -----------------------------------------------------------------
  // Render: Trivia
  // -----------------------------------------------------------------
  function renderTrivia(trivia) {
    if (!trivia || !trivia.length) {
      triviaList.innerHTML = '';
      return;
    }
    triviaList.innerHTML = trivia.map(function (t) {
      return '<li class="trivia-item reveal">' + esc(t) + '</li>';
    }).join('');
  }

  // -----------------------------------------------------------------
  // Section navigation (scroll-based)
  // -----------------------------------------------------------------
  var isScrollingToSection = false;

  function scrollToSection(sectionId) {
    var panel = document.getElementById('panel-' + sectionId);
    if (!panel) return;
    isScrollingToSection = true;
    highlightNavButton(sectionId);
    panel.scrollIntoView({ behavior: 'smooth' });
    // Allow observer to resume after scroll settles
    setTimeout(function () { isScrollingToSection = false; }, 800);
  }

  function highlightNavButton(sectionId) {
    tabButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === sectionId);
    });
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      scrollToSection(this.dataset.tab);
    });
  });

  // Scroll-synced active state via IntersectionObserver
  var sectionObserver = null;

  function setupSectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    if (sectionObserver) sectionObserver.disconnect();

    sectionObserver = new IntersectionObserver(function (entries) {
      if (isScrollingToSection) return;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id.replace('panel-', '');
          highlightNavButton(id);
        }
      });
    }, {
      rootMargin: '-20% 0px -60% 0px',  // trigger when section is near the top
      threshold: 0
    });

    pageSections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  // Back button
  backBtn.addEventListener('click', function () {
    location.hash = '';
  });

  // -----------------------------------------------------------------
  // Scroll reveal
  // -----------------------------------------------------------------
  function observeReveals() {
    var reveals = document.querySelectorAll('.reveal:not(.visible)');
    if (!reveals.length) return;
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  // -----------------------------------------------------------------
  // Nav shadow
  // -----------------------------------------------------------------
  function setupNavScroll() {
    var nav = document.getElementById('tabNav');
    if (!nav) return;
    window.addEventListener('scroll', function () {
      nav.style.boxShadow = window.scrollY > 80
        ? '0 2px 20px rgba(0,0,0,0.5)'
        : 'none';
    }, { passive: true });
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------
  function bandAssetPath(relativePath) {
    if (!currentSlug) return relativePath;
    return basePath + '/bands/' + currentSlug + '/' + relativePath;
  }

  function extractYouTubeId(url) {
    if (!url) return '';
    var m = url.match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function categoryLabel(cat) {
    var labels = {
      formation: 'Formation', album_release: 'Album Release',
      lineup_change: 'Lineup Change', milestone: 'Milestone',
      controversy: 'Controversy', breakup: 'Breakup',
      reunion: 'Reunion', death: 'Memorial',
      official: 'Official Video', live: 'Live Performance',
      interview: 'Interview', documentary: 'Documentary',
      other: 'Other'
    };
    return labels[cat] || (cat || 'other').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function formatDate(d) {
    if (!d) return '';
    // Try ISO-ish parsing for display
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (/^\d{4}-\d{2}$/.test(d)) {
      var dt2 = new Date(d + '-01T00:00:00');
      return dt2.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
    return d; // Just a year or freeform
  }

  function esc(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  function truncate(s, n) {
    if (!s || s.length <= n) return s;
    return s.substring(0, n).replace(/\s+\S*$/, '') + '...';
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(/\s+/).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
  }

  // -----------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    setupNavScroll();
    setupSectionObserver();
    navigate();
  });

})();
