/* Collapse Tests :: diagnostic. Ouvrir le menu des filtres AVANT de coller. */
(() => {
  const out = {};

  const menus = [...document.querySelectorAll('ul[role="menu"]')];
  out.menus = menus.length;
  const menu = menus.find(u =>
    u.querySelector('ul[aria-label="File extensions"]') ||
    u.querySelector('li[role="menuitemcheckbox"][aria-keyshortcuts="v"]'));
  out.menuTrouve = !!menu;
  out.menuGroupes = menu ? [...menu.querySelectorAll('ul[role="group"], ul[aria-label]')].map(u => u.getAttribute('aria-label')) : null;
  out.items = menu ? [...menu.querySelectorAll('li[role="menuitemcheckbox"]')].map(li => ({
    label: li.querySelector('[data-component="ActionList.Item.Label"]')?.textContent,
    checked: li.getAttribute('aria-checked'),
    checkmarkVisible: (() => {
      const s = li.querySelector('[data-component="ActionList.Selection"] svg');
      return s ? getComputedStyle(s).visibility + '/' + getComputedStyle(s).opacity : 'pas de svg';
    })(),
  })) : null;
  out.itemHTMLdecoche = menu
    ? (menu.querySelector('li[role="menuitemcheckbox"][aria-checked="false"]')?.outerHTML || 'aucun item decoche, decoche .md puis recolle')
    : null;

  const regions = [...document.querySelectorAll('div[role="region"][id^="diff-"]')];
  out.fichiersDansLeDOM = regions.length;
  out.exemplesChemins = regions.slice(0, 5).map(r =>
    (r.querySelector('h3 a code') || r.querySelector('h3 a'))?.textContent.trim());
  out.fichiersTest = regions
    .map(r => (r.querySelector('h3 a code') || r.querySelector('h3 a'))?.textContent.trim() || '')
    .filter(p => p.toLowerCase().includes('.test'));

  const r0 = regions[0];
  const btn = r0 && r0.querySelector('button:has(> svg.octicon-chevron-down), button:has(> svg.octicon-chevron-right)');
  out.boutonReplierTrouve = !!btn;
  out.boutonReplierHTML = btn ? btn.outerHTML.slice(0, 400) : null;
  out.etatPremierFichier = btn ? (btn.querySelector('svg.octicon-chevron-down') ? 'deplie' : 'replie') : null;

  out.totalAnnonceParGitHub = document.body.innerText.match(/(\d+)\s+changed files?/)?.[0] || 'inconnu';

  console.log(JSON.stringify(out, null, 2));
  return out;
})();
