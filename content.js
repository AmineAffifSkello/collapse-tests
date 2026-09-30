(() => {
  'use strict';

  const ITEM_ID = 'tem-tests-filter';
  const LABEL = 'Tests';
  const KEY_PREFIX = 'collapse-tests:';
  const DEBOUNCE_MS = 150;
  const MAX_WAIT_MS = 600;
  const CLICK_COOLDOWN_MS = 1200;
  const MAX_CLICKS_PER_FILE = 6;

  /* ---------- etat persiste par PR ---------- */

  const prKey = () => {
    const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    return m ? `${KEY_PREFIX}${m[1]}/${m[2]}/${m[3]}` : null;
  };

  const isDiffPage = () =>
    /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)(\/|$)/.test(location.pathname);

  const testsShown = () => {
    const k = prKey();
    if (!k) return true;
    try { return localStorage.getItem(k) !== '0'; } catch { return true; }
  };

  const setTestsShown = (on) => {
    const k = prKey();
    if (!k) return;
    try {
      if (on) localStorage.removeItem(k);
      else localStorage.setItem(k, '0');
    } catch { /* storage bloque: l'etat reste valable pour la session */ }
  };

  /* ---------- lecture du diff ---------- */

  const TEST_DIRS = new Set([
    'test', 'tests', '__test__', '__tests__',
    'spec', 'specs', '__spec__', '__specs__',
    'e2e', 'cypress',
  ]);

  const TEST_NAMES = [
    /(^|[._-])(tests?|specs?)[._-]/i,
    /(^|[._-])(tests?|specs?)$/i,
    /^tests?[A-Z]/,
    /[a-z0-9](Tests?|Specs?)\.[A-Za-z0-9]+$/,
    /[a-z0-9]IT\.(java|kt|kts|groovy|scala)$/,
    /\.(cy|e2e)\.[A-Za-z0-9]+$/i,
    /^conftest\.py$/i,
    /\.tftest\.hcl$/i,
    /\.feature$/i,
  ];

  const isTestFile = (path) => {
    const parts = path.split('/');
    const name = parts.pop() || '';
    if (parts.some((dir) => TEST_DIRS.has(dir.toLowerCase()))) return true;
    return TEST_NAMES.some((re) => re.test(name));
  };

  const MUTED = 'collapse-tests-muted';

  const treeEntries = () => {
    const rows = [];
    for (const link of document.querySelectorAll('a[href*="#diff-"]')) {
      if (link.closest('div[role="region"][id^="diff-"]')) continue;
      const href = link.getAttribute('href');
      const anchorId = href.slice(href.indexOf('#diff-') + 1);
      const region = document.getElementById(anchorId);
      const named = region && (region.querySelector('h3 a code') || region.querySelector('h3 a'));
      rows.push({
        row: link.closest('[role="treeitem"]') || link,
        path: named ? named.textContent.trim() : link.textContent.trim(),
      });
    }
    return rows;
  };

  const GREY = 'var(--fgColor-muted, #656d76)';
  const selfAndChildren = (el) => [el, ...el.querySelectorAll('*')];

  const muteRow = (row) => {
    if (row.classList.contains(MUTED)) return;
    row.classList.add(MUTED);
    row.setAttribute('aria-disabled', 'true');
    for (const el of selfAndChildren(row)) {
      if (el.style.getPropertyValue('color')) continue;
      el.style.setProperty('color', GREY, 'important');
      el.style.setProperty('cursor', 'not-allowed', 'important');
      el.dataset.ctGrey = '1';
    }
  };

  const unmuteRow = (row) => {
    row.classList.remove(MUTED);
    row.removeAttribute('aria-disabled');
    for (const el of selfAndChildren(row)) {
      if (!el.dataset.ctGrey) continue;
      el.style.removeProperty('color');
      el.style.removeProperty('cursor');
      delete el.dataset.ctGrey;
    }
  };

  const headerOf = (region) =>
    region.querySelector('[data-diff-header-wrapper="true"]') ||
    region.querySelector('[class*="diffHeaderWrapper"]') ||
    region.firstElementChild;

  const paintMuted = (muted, files) => {
    if (!muted) {
      for (const row of document.querySelectorAll('.' + MUTED)) unmuteRow(row);
      return;
    }
    for (const entry of treeEntries()) {
      if (isTestFile(entry.path)) muteRow(entry.row);
      else if (entry.row.classList.contains(MUTED)) unmuteRow(entry.row);
    }
    for (const file of files) {
      const header = file.region && headerOf(file.region);
      if (header) muteRow(header);
    }
  };

  const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick'];
  const KEYS = ['keydown', 'keyup', 'keypress'];

  const blockMuted = (event) => {
    if (selfClick) return;
    if (!(event.target instanceof Element)) return;
    if (KEYS.includes(event.type) && event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.target.closest('.' + MUTED)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  };

  const scanTestFiles = () => {
    const found = [];
    for (const region of document.querySelectorAll('div[role="region"][id^="diff-"]')) {
      const node = region.querySelector('h3 a code') || region.querySelector('h3 a');
      const path = node ? node.textContent.trim() : '';
      if (!path || !isTestFile(path)) continue;
      const btn = region.querySelector(
        'button:has(> svg.octicon-chevron-down), button:has(> svg.octicon-chevron-right)'
      );
      found.push({ path, btn, region, expanded: !!(btn && btn.querySelector('svg.octicon-chevron-down')) });
    }
    return found;
  };

  let selfClick = false;

  const lastClick = new WeakMap();
  const attempts = new Map();
  let expandPending = false;

  const setTestFiles = (wantExpanded, files) => {
    const now = Date.now();
    let remaining = 0;
    for (const file of files) {
      if (!file.btn || file.expanded === wantExpanded) {
        attempts.delete(file.path);
        continue;
      }
      const prev = attempts.get(file.path);
      const tried = prev && prev.want === wantExpanded ? prev.n : 0;
      if (tried >= MAX_CLICKS_PER_FILE) continue;
      remaining++;
      if (now - (lastClick.get(file.btn) || 0) < CLICK_COOLDOWN_MS) continue;
      lastClick.set(file.btn, now);
      attempts.set(file.path, { want: wantExpanded, n: tried + 1 });
      selfClick = true;
      try { file.btn.click(); } finally { selfClick = false; }
    }
    return remaining;
  };

  /* ---------- item de menu ---------- */

  const findMenu = () =>
    [...document.querySelectorAll('ul[role="menu"]')].find(
      (ul) =>
        ul.querySelector('ul[aria-label="File extensions"]') ||
        ul.querySelector('li[role="menuitemcheckbox"][aria-keyshortcuts="v"]')
    );

  const paintChecked = (li, on) => {
    const checked = String(on);
    if (li.getAttribute('aria-checked') !== checked) li.setAttribute('aria-checked', checked);
    const svg = li.querySelector('[data-component="ActionList.Selection"] svg');
    if (!svg) return;
    const display = on ? 'inline-block' : 'none';
    if (svg.style.display === display) return;
    svg.style.display = display;
    svg.style.visibility = on ? 'visible' : 'hidden';
  };

  const paintCount = (li, n) => {
    const total = String(n);
    const counter = li.querySelector('[data-component="CounterLabel"]');
    if (counter && counter.textContent !== total) counter.textContent = total;
    const sr = li.querySelector('[data-component="ActionList.TrailingVisual"] [class*="VisuallyHidden"]');
    const srText = '\u00a0(' + total + ')';
    if (sr && sr.textContent !== srText) sr.textContent = srText;
  };

  const buildItem = (menu) => {
    const model =
      menu.querySelector(`li[role="menuitemcheckbox"][aria-checked="true"]:not(#${ITEM_ID}):has([data-component="ActionList.TrailingVisual"])`) ||
      menu.querySelector(`li[role="menuitemcheckbox"][aria-checked="true"]:not(#${ITEM_ID})`) ||
      menu.querySelector(`li[role="menuitemcheckbox"]:not(#${ITEM_ID})`);
    if (!model) return null;

    const li = model.cloneNode(true);
    for (const node of li.querySelectorAll('[id]')) node.removeAttribute('id');
    for (const node of li.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
      node.removeAttribute('aria-labelledby');
      node.removeAttribute('aria-describedby');
    }

    li.id = ITEM_ID;
    li.dataset.temItem = '1';
    li.tabIndex = -1;
    li.removeAttribute('aria-keyshortcuts');
    li.removeAttribute('aria-describedby');

    const label = li.querySelector('[data-component="ActionList.Item.Label"]');
    if (label) {
      label.id = `${ITEM_ID}--label`;
      label.textContent = LABEL;
    }

    const trailing = li.querySelector('[data-component="ActionList.TrailingVisual"]');
    if (trailing) trailing.id = `${ITEM_ID}--tv`;
    li.setAttribute(
      'aria-labelledby',
      trailing ? `${ITEM_ID}--label ${ITEM_ID}--tv` : `${ITEM_ID}--label`
    );

    const toggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = !testsShown();
      setTestsShown(next);
      paintChecked(li, next);
      attempts.clear();
      const files = scanTestFiles();
      for (const file of files) if (file.btn) lastClick.delete(file.btn);
      paintMuted(!next, files);
      const remaining = setTestFiles(next, files);
      expandPending = next && remaining > 0;
      schedule();
    };

    li.addEventListener('click', toggle, true);
    li.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') toggle(event);
    }, true);

    return li;
  };

  const ensureItem = (count) => {
    const menu = findMenu();
    if (!menu) return;

    let li = menu.querySelector(`#${ITEM_ID}`);
    if (!li) {
      li = buildItem(menu);
      if (!li) return;
      (menu.querySelector('ul[aria-label="More"]') || menu).appendChild(li);
    }

    paintChecked(li, testsShown());
    paintCount(li, count);
  };

  /* ---------- boucle ---------- */

  const tick = () => {
    if (!isDiffPage()) return;
    const files = scanTestFiles();
    ensureItem(files.length);
    if (!testsShown()) {
      expandPending = false;
      setTestFiles(false, files);
      paintMuted(true, files);
      return;
    }
    paintMuted(false, files);
    if (!expandPending) return;
    expandPending = setTestFiles(true, files) > 0;
    if (expandPending) schedule();
  };

  let debounceTimer = null;
  let maxWaitTimer = null;

  const run = () => {
    clearTimeout(debounceTimer);
    clearTimeout(maxWaitTimer);
    debounceTimer = null;
    maxWaitTimer = null;
    tick();
  };

  const schedule = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, DEBOUNCE_MS);
    if (!maxWaitTimer) maxWaitTimer = setTimeout(run, MAX_WAIT_MS);
  };

  for (const type of [...BLOCKED, ...KEYS]) {
    document.addEventListener(type, blockMuted, true);
  }

  new MutationObserver(() => {
    if (isDiffPage()) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });

  let lastHref = location.href;
  setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    attempts.clear();
    schedule();
  }, 500);

  schedule();
})();
