(function () {
  const ICON_MAP = {
    '/index.html': 'dashboard',
    '/page/pipeline.html': 'pipeline',
    '/page/kanban.html': 'kanban',
    '/page/gantt.html': 'gantt',
    '/page/cold-callers.html': 'phone',
    '/page/outreachers.html': 'mail',
    '/page/freelancers.html': 'user',
    '/page/clients.html': 'building',
    '/page/staffing.html': 'star',
    '/page/tasks.html': 'check',
    '/page/projects.html': 'folder',
    '/page/finance.html': 'wallet',
    '/page/analytics.html': 'chart',
    '/page/reports.html': 'report',
    '/page/client-portal.html': 'portal',
    '/page/freelancer-portal.html': 'userBadge',
    '/page/call-recording.html': 'mic',
    '/page/screen-monitor.html': 'monitor',
    '/page/workflow.html': 'book',
    '/profile.html': 'user',
    '/settings.html': 'settings'
  };

  const SHAPES = {
    dashboard: '<rect x="7" y="12" width="3" height="6" rx="1" fill="#fff" opacity=".95"/><rect x="11" y="9" width="3" height="9" rx="1" fill="#fff" opacity=".85"/><rect x="15" y="11" width="3" height="7" rx="1" fill="#fff" opacity=".75"/>',
    pipeline: '<path d="M8 9h8M8 12h6M8 15h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="9" r="1.2" fill="#fff"/><circle cx="15" cy="12" r="1.2" fill="#fff"/><circle cx="13" cy="15" r="1.2" fill="#fff"/>',
    kanban: '<rect x="7" y="8" width="4" height="9" rx="1.2" fill="#fff" opacity=".9"/><rect x="12" y="8" width="4" height="6" rx="1.2" fill="#fff" opacity=".75"/><rect x="17" y="8" width="4" height="11" rx="1.2" fill="#fff" opacity=".6"/>',
    gantt: '<rect x="7" y="8" width="10" height="2.5" rx="1.2" fill="#fff" opacity=".9"/><rect x="7" y="12" width="7" height="2.5" rx="1.2" fill="#fff" opacity=".75"/><rect x="7" y="16" width="12" height="2.5" rx="1.2" fill="#fff" opacity=".6"/>',
    phone: '<path d="M10 9.5c1.2 2.4 2.6 3.8 5 5l1.4-1.4c.3-.3.8-.4 1.2-.2 1 .4 2.1.6 3.2.6.6 0 1 .4 1 1V17c0 .6-.4 1-1 1C10.8 18 6 13.2 6 7c0-.6.4-1 1-1h2.3c.6 0 1 .4 1 1 0 1.1.2 2.2.6 3.2.1.4 0 .9-.3 1.2L10 9.5z" fill="#fff" opacity=".92"/>',
    mail: '<rect x="7" y="9" width="10" height="7" rx="1.4" fill="#fff" opacity=".25"/><path d="M7 10l5 3.5L17 10" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    user: '<circle cx="12" cy="10" r="2.4" fill="#fff" opacity=".95"/><path d="M8.5 17c.7-2 2.2-3 3.5-3s2.8 1 3.5 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
    building: '<rect x="8" y="8" width="8" height="9" rx="1.2" fill="#fff" opacity=".25"/><rect x="10" y="10" width="1.5" height="1.5" fill="#fff"/><rect x="12.5" y="10" width="1.5" height="1.5" fill="#fff"/><rect x="10" y="12.5" width="1.5" height="1.5" fill="#fff"/><rect x="12.5" y="12.5" width="1.5" height="1.5" fill="#fff"/>',
    star: '<path d="M12 8.2l1.1 2.3 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.4L12 8.2z" fill="#fff" opacity=".95"/>',
    check: '<path d="M9 12.2l2 2 4.2-4.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    folder: '<path d="M8 9h4l1.2 1.5H16a1 1 0 011 1v4.5a1 1 0 01-1 1H8a1 1 0 01-1-1V10a1 1 0 011-1z" fill="#fff" opacity=".88"/>',
    wallet: '<rect x="7.5" y="9.5" width="9" height="6.5" rx="1.5" fill="#fff" opacity=".25"/><circle cx="15" cy="12.8" r="1" fill="#fff"/><rect x="8" y="10.5" width="5" height="1.2" rx=".6" fill="#fff" opacity=".9"/>',
    chart: '<path d="M8 16V13M11 16V10M14 16V12M17 16V9" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M8 16h9" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>',
    report: '<rect x="8" y="8" width="8" height="10" rx="1.4" fill="#fff" opacity=".25"/><path d="M10 11h4M10 13.5h4M10 16h2.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>',
    portal: '<circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" stroke-width="1.5" opacity=".9"/><ellipse cx="12" cy="12" rx="4.2" ry="1.6" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/><path d="M12 7.8v8.4" stroke="#fff" stroke-width="1.2" opacity=".7"/>',
    userBadge: '<circle cx="12" cy="10.2" r="2" fill="#fff"/><path d="M9 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><rect x="15" y="8" width="3" height="3" rx=".8" fill="#fff" opacity=".85"/>',
    mic: '<rect x="10.5" y="8.5" width="3" height="5.5" rx="1.5" fill="#fff"/><path d="M9 12.5a3 3 0 006 0M12 15.5v2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
    monitor: '<rect x="7.5" y="8.5" width="9" height="6" rx="1.2" fill="#fff" opacity=".25"/><rect x="9" y="10" width="6" height="3.2" rx=".6" fill="#fff" opacity=".9"/><path d="M10.5 17h3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
    book: '<path d="M9 8.5h6a1 1 0 011 1v7a1 1 0 00-1-1H9a1 1 0 00-1 1v-7a1 1 0 011-1z" fill="#fff" opacity=".25"/><path d="M9 8.5v8.5" stroke="#fff" stroke-width="1.3"/><path d="M11.5 11h3M11.5 13h2.2" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>',
    settings: '<circle cx="12" cy="12" r="2.2" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M12 8.3v1.2M12 14.5v1.2M8.3 12h1.2M14.5 12h1.2M9.4 9.4l.8.8M13.8 13.8l.8.8M14.6 9.4l-.8.8M10.2 13.8l-.8.8" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>',
    logout: '<path d="M10 8.5v7M13.5 12H8" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 9.8c1 1 1 4.2 0 5.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
    default: '<circle cx="12" cy="12" r="2.5" fill="#fff" opacity=".85"/>'
  };

  let uid = 0;
  function svg(type) {
    const shape = SHAPES[type] || SHAPES.default;
    const gradId = `glassGrad${uid++}`;
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stop-color="#4F6BFF"/>
          <stop offset="1" stop-color="#2B2FFF"/>
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="url(#${gradId})"/>
      <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill="#FFFFFF" fill-opacity="0.22"/>
      <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke="#FFFFFF" stroke-opacity="0.35"/>
      ${shape}
    </svg>`;
  }

  function iconForLink(href) {
    try {
      const path = new URL(href, window.location.origin).pathname;
      return ICON_MAP[path] || 'default';
    } catch {
      return 'default';
    }
  }

  function replaceIcon(el, type) {
    const wrap = document.createElement('span');
    wrap.className = 'glass-nav-icon';
    wrap.innerHTML = svg(type);
    el.replaceWith(wrap);
  }

  function upgradeLogo() {
    document.querySelectorAll('.sidebar-brand img[src*="logo-niche"]').forEach((img) => {
      img.classList.add('niche-logo');
      const wrap = img.parentElement;
      if (wrap) wrap.classList.add('niche-logo-wrap');
    });
  }

  function upgradeNav() {
    document.querySelectorAll('.nav-item').forEach((link) => {
      if (link.querySelector('.glass-nav-icon')) return;
      const type = iconForLink(link.getAttribute('href') || '');
      const icon = link.querySelector('i');
      const wrap = document.createElement('span');
      wrap.className = 'glass-nav-icon';
      wrap.innerHTML = svg(type);
      if (icon) icon.replaceWith(wrap);
      else link.insertBefore(wrap, link.firstChild);
    });

    document.querySelectorAll('.logout-btn').forEach((btn) => {
      if (btn.querySelector('.glass-nav-icon')) return;
      const icon = btn.querySelector('i');
      const wrap = document.createElement('span');
      wrap.className = 'glass-nav-icon';
      wrap.innerHTML = svg('logout');
      if (icon) icon.replaceWith(wrap);
      else btn.insertBefore(wrap, btn.firstChild);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      upgradeLogo();
      upgradeNav();
    });
  } else {
    upgradeLogo();
    upgradeNav();
  }
})();
