/**
 * KOMI.LAB — Main JavaScript
 * komilab.org
 */

window.KL = (() => {

  /* ── SEARCH ──────────────────────────────────────── */
  let searchIndex = [];

  async function loadSearchIndex() {
    try {
      const res  = await fetch('/search-index.json');
      searchIndex = await res.json();
    } catch(e) {
      searchIndex = [];
    }
  }

  function renderResults(query) {
    const container = document.getElementById('search-results');
    if (!container) return;

    const q = query.toLowerCase().trim();
    const items = q
      ? searchIndex.filter(i =>
          i.title.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          (i.tags || []).some(t => t.toLowerCase().includes(q))
        )
      : searchIndex;

    if (!items.length) {
      container.innerHTML = `<div class="search-empty">Aucun résultat pour "<strong>${query}</strong>"</div>`;
      return;
    }

    const typeColors = { guides:'#3b82f6', veille:'#f43f5e' };

    container.innerHTML = items.slice(0, 12).map(i => `
      <a class="search-item" href="${i.url}">
        <div class="search-dot" style="background:${typeColors[i.section] || '#3b82f6'}"></div>
        <div style="flex:1">
          <div class="search-title">${i.title}</div>
          <div class="search-desc">${(i.description || '').substring(0, 110)}...</div>
          <div class="search-tags">
            <span class="tag" style="background:${typeColors[i.section] || '#3b82f6'}18;color:${typeColors[i.section] || '#3b82f6'}">${i.section}</span>
            ${(i.tags || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        </div>
      </a>
    `).join('');
  }

  function open() {
    const overlay = document.getElementById('search-overlay');
    const input   = document.getElementById('search-input');
    if (!overlay) return;
    overlay.classList.add('open');
    if (!searchIndex.length) loadSearchIndex();
    setTimeout(() => input && input.focus(), 40);
    renderResults('');
  }

  function close() {
    const overlay = document.getElementById('search-overlay');
    const input   = document.getElementById('search-input');
    if (overlay) overlay.classList.remove('open');
    if (input)   input.value = '';
  }

  // Search events
  document.addEventListener('DOMContentLoaded', () => {
    const input   = document.getElementById('search-input');
    const overlay = document.getElementById('search-overlay');

    if (input)   input.addEventListener('input', e => renderResults(e.target.value));
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape') close();
  });

  /* ── COPY TO CLIPBOARD ───────────────────────────── */
  function copy(btn) {
    const pre  = btn.closest('.code-block').querySelector('pre');
    const text = pre.innerText;

    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copié`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copier`;
      }, 2200);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  /* ── FILTERS (liste guides) ──────────────────────── */
  function filter(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('#articles-container .article-row').forEach(row => {
      const cats = (row.dataset.cats || '').split(',');
      row.style.display = (cat === 'all' || cats.includes(cat)) ? '' : 'none';
    });
  }

  /* ── NEWSLETTER SUBSCRIBE ────────────────────────── */
  function subscribe(btn) {
    const input = btn.previousElementSibling;
    const email = input ? input.value.trim() : '';
    if (!email || !email.includes('@')) {
      input && (input.style.borderColor = 'var(--red)');
      return;
    }
    btn.textContent = 'OK !';
    btn.style.background = 'var(--green)';
    input.value = '';
  }

  /* ── HIGHLIGHT.JS INIT ───────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
  });

  return { search: { open, close }, copy, filter, subscribe };

})();
