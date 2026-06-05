/* ============================================================
   Bander -- app.js
   Generic band site: catalog discovery, data loading, rendering
   ============================================================ */

(function () {
  'use strict';

  // -----------------------------------------------------------------
  // YouTube rejects embeds when the Referer is an IP address
  // (e.g. 127.0.0.1). Redirect to "localhost" so the browser sends
  // a hostname-based Referer that YouTube accepts.
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
    bandView.classList.add('hidden');
    catalogView.classList.remove('hidden');
    document.title = 'Bander';
    resetTheme();
    loadCatalog();
  }

  async function loadCatalog() {
    try {
      var res = await fetch('/api/bands');
      var bands = await res.json();
      renderCatalog(bands);
    } catch (err) {
      bandList.innerHTML = '<p class="error">Failed to load bands.</p>';
    }
  }

  function renderCatalog(bands) {
    if (!bands.length) {
      bandList.innerHTML = '<p class="empty">No bands found. Run the skill to add one.</p>';
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
      var res = await fetch('/api/bands/' + encodeURIComponent(slug));
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
  // Render: Videos
  // -----------------------------------------------------------------
  function renderVideos(videos) {
    if (!videos.length) {
      videoGrid.innerHTML = '<p class="empty">No videos available.</p>';
      return;
    }
    videoGrid.innerHTML = videos.map(function (v) {
      var vidId = extractYouTubeId(v.youtube_url);
      var badgeClass = 'badge--' + (v.category || 'other');
      var label = categoryLabel(v.category);
      var watchUrl = vidId
        ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(vidId)
        : v.youtube_url || '#';

      // If we cannot extract a valid video ID, show a plain link
      if (!vidId) {
        return (
          '<article class="video-card reveal">' +
            '<div class="video-wrap video-fallback">' +
              '<a href="' + esc(watchUrl) + '" target="_blank" rel="noopener">' +
                '<span class="video-fallback-text">Watch on YouTube</span>' +
              '</a>' +
            '</div>' +
            '<div class="video-info">' +
              '<h3>' + esc(v.title) +
                (v.year ? ' <span class="video-year">(' + esc(v.year) + ')</span>' : '') +
              '</h3>' +
              '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>' +
            '</div>' +
          '</article>'
        );
      }

      // Thumbnail + click-to-play: show a YouTube thumbnail with a play
      // button overlay. On click, replace with an autoplaying iframe.
      // This avoids Error 153 when serving from localhost / IP origins,
      // because the iframe is only created after a user gesture.
      var thumbUrl = 'https://i.ytimg.com/vi/' + encodeURIComponent(vidId) + '/hqdefault.jpg';
      return (
        '<article class="video-card reveal">' +
          '<div class="video-wrap video-thumb" data-vid="' + esc(vidId) + '">' +
            '<img class="video-thumb-img" src="' + esc(thumbUrl) + '" alt="' + esc(v.title) + '" loading="lazy">' +
            '<button class="video-play-btn" aria-label="Play ' + esc(v.title) + '">' +
              '<svg viewBox="0 0 68 48" width="68" height="48">' +
                '<path class="video-play-bg" d="M66.5 7.7c-.8-2.9-2.5-5.4-5.4-6.2C55.8.1 34 0 34 0S12.2.1 6.9 1.6c-2.8.7-4.6 3.2-5.4 6.1C0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 2.6 5.4 5.4 6.2C12.2 47.9 34 48 34 48s21.8-.1 27.1-1.6c2.8-.7 4.6-3.2 5.4-6.1C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#212121" fill-opacity="0.8"/>' +
                '<path d="M45 24L27 14v20" fill="#fff"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="video-info">' +
            '<h3>' +
              '<a href="' + esc(watchUrl) + '" target="_blank" rel="noopener" class="video-title-link">' +
                esc(v.title) +
              '</a>' +
              (v.year ? ' <span class="video-year">(' + esc(v.year) + ')</span>' : '') +
            '</h3>' +
            '<span class="badge ' + badgeClass + '">' + esc(label) + '</span>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    // Attach click handlers for thumbnail-to-iframe replacement
    videoGrid.querySelectorAll('.video-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var vidId = this.dataset.vid;
        if (!vidId) return;
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(vidId) +
          '?autoplay=1&rel=0';
        iframe.title = (this.querySelector('img') || {}).alt || '';
        iframe.frameBorder = '0';
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.setAttribute('allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.allowFullscreen = true;
        this.innerHTML = '';
        this.classList.remove('video-thumb');
        this.appendChild(iframe);
      });
    });
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
    return '/bands/' + currentSlug + '/' + relativePath;
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
