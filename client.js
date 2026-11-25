window.__ModuleLoader__.load({
  id: 'dsh-agency-skill-panel',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const NS = 'agencySkillPanel';
    const PANEL_ID = 'dsh-agency-skill-panel';
    const API = '/agency-skill-panel/api';

    /* ------------------------------------------------------------------ copy */

    const zh = {
      panel: 'Agency 专家库',
      title: 'Agency 专家库',
      subtitle: '按分类浏览、搜索、开关 283 个 agency 专家技能',
      search: '搜索：中文名 / slug / 中文描述 / 英文原词…',
      clear: '清空',
      searchHit: '命中',
      clear: '清空',
      searchHit: '命中',
      all: '全部',
      enabled: '已启用',
      disabled: '已关闭',
      total: '总计',
      savedTokens: '每轮省下',
      tokens: 'tokens',
      on: '开',
      off: '关',
      showEn: '看英文原文',
      hideEn: '收起英文',
      showOnlyOn: '只看已启用',
      showOnlyOff: '只看已关闭',
      showAll: '看全部',
      disableDivision: '整个分类全关',
      enableDivision: '整个分类全开',
      enableAll: '全部开启',
      disableAll: '全部关闭',
      resync: '按配置重新同步',
      loading: '读取技能清单…',
      empty: '没有匹配的技能',
      noFile: '找不到技能文件，无法切换',
      busy: '处理中…',
      stateFile: '配置写在',
      hint: '关掉的技能不再注入 catalog，省下的就是每轮的固定开销。开关会写回技能文件的 frontmatter，重装技能后打开本面板会自动重新应用。',
      confirmDisableAll: '确定全关？',
      confirmHint: '再点一次确认全部关闭，之后可以逐个开回来',
      failed: '操作失败',
      count: '个技能',
    };

    const en = {
      panel: 'Agency Library',
      title: 'Agency Library',
      subtitle: 'Browse, search and toggle the 283 agency skills',
      search: 'Search: Chinese name / slug / description / English…',
      clear: 'Clear',
      searchHit: 'matches',
      clear: 'Clear',
      searchHit: 'matches',
      all: 'All',
      enabled: 'Enabled',
      disabled: 'Disabled',
      total: 'Total',
      savedTokens: 'Saves per turn',
      tokens: 'tokens',
      on: 'On',
      off: 'Off',
      showEn: 'Show English source',
      hideEn: 'Hide English',
      showOnlyOn: 'Enabled only',
      showOnlyOff: 'Disabled only',
      showAll: 'Show all',
      disableDivision: 'Disable whole division',
      enableDivision: 'Enable whole division',
      enableAll: 'Enable all',
      disableAll: 'Disable all',
      resync: 'Re-sync from config',
      loading: 'Loading skills…',
      empty: 'No matching skill',
      noFile: 'Skill file not found; cannot toggle',
      busy: 'Working…',
      stateFile: 'Config lives in',
      hint: 'A disabled skill drops out of the injected catalog, so its tokens stop costing every turn. Toggles rewrite the skill frontmatter; reopening this panel re-applies the stored intent after a reinstall.',
      confirmDisableAll: 'Disable all?',
      confirmHint: 'Click again to disable every skill; you can turn them back on one by one',
      failed: 'Action failed',
      count: 'skills',
    };

    /* --------------------------------------------------------------- helpers */

    const styles = {
      root: {
        display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
        background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)',
        fontSize: 13, lineHeight: 1.5,
      },
      header: {
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '18px 22px 12px', borderBottom: '1px solid var(--dsw-alias-border-l1)',
      },
      titleRow: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
      title: { fontSize: 16, fontWeight: 600, margin: 0 },
      subtitle: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      searchRow: { display: 'flex', gap: 8, alignItems: 'center' },
      inputWrap: { position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' },
      input: {
        width: '100%', height: 32, padding: '0 76px 0 10px',
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8,
        fontSize: 13, outline: 'none', fontFamily: 'inherit',
      },
      inputMeta: {
        position: 'absolute', right: 7, display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, color: 'var(--dsw-alias-label-tertiary)',
        pointerEvents: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      },
      inputClear: {
        pointerEvents: 'auto', width: 18, height: 18, lineHeight: '16px', padding: 0,
        borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      button: {
        height: 32, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l2)', fontSize: 12.5,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      },
      buttonPrimary: {
        height: 32, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
        background: 'var(--dsw-alias-button-primary-fill)',
        color: 'var(--dsw-alias-label-primary-inverted)',
        border: '1px solid transparent', fontSize: 12.5, fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      },
      buttonDanger: {
        height: 32, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
        background: 'var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-label-primary-inverted)',
        border: '1px solid transparent', fontSize: 12.5, fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      },
      stats: {
        display: 'flex', gap: 18, flexWrap: 'wrap', padding: '0 22px 12px',
        fontSize: 12, color: 'var(--dsw-alias-label-secondary)',
      },
      statNum: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
      body: { display: 'flex', flex: 1, minHeight: 0 },
      side: {
        width: 196, flexShrink: 0, overflowY: 'auto', padding: '10px 8px',
        borderRight: '1px solid var(--dsw-alias-border-l1)',
      },
      sideItem: (active) => ({
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 10px', borderRadius: 7, cursor: 'pointer',
        background: active ? 'var(--dsw-alias-interactive-bg-active)' : 'transparent',
        color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
        border: 'none', fontFamily: 'inherit', fontSize: 12.5, textAlign: 'left',
      }),
      sideCount: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', fontVariantNumeric: 'tabular-nums' },
      list: { flex: 1, minWidth: 0, overflowY: 'auto', padding: '12px 22px 28px' },
      card: (disabled) => ({
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 10,
        padding: '11px 13px', marginBottom: 8,
        background: disabled ? 'transparent' : 'var(--dsw-alias-bg-layer-1)',
        opacity: disabled ? 0.62 : 1,
      }),
      cardHead: { display: 'flex', alignItems: 'flex-start', gap: 10 },
      cardText: { flex: 1, minWidth: 0 },
      cardName: { fontSize: 13, fontWeight: 600, marginBottom: 3 },
      cardSlug: {
        fontSize: 11, color: 'var(--dsw-alias-label-tertiary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      cardDesc: { fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)', marginTop: 4 },
      cardEn: {
        fontSize: 11.5, color: 'var(--dsw-alias-label-tertiary)', marginTop: 6,
        lineHeight: 1.45,
      },
      link: {
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--dsw-alias-link)', fontSize: 11.5, fontFamily: 'inherit',
      },
      switchBox: {
        position: 'relative', width: 36, height: 20, flexShrink: 0,
        borderRadius: 999, cursor: 'pointer', border: 'none', padding: 0,
        background: 'var(--dsw-alias-border-l3)',
        transition: 'background 120ms ease',
      },
      switchBoxOn: { background: 'var(--dsw-alias-brand-primary)' },
      switchKnob: (on) => ({
        position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16,
        borderRadius: 999, background: 'var(--dsw-static-neutral-00)',
        transition: 'left 120ms ease',
      }),
      badge: {
        fontSize: 11, padding: '1px 6px', borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-tertiary)',
        marginLeft: 6, whiteSpace: 'nowrap',
      },
      caveat: {
        margin: '6px 0 12px', fontSize: 11.5, color: 'var(--dsw-alias-label-tertiary)',
        lineHeight: 1.55,
      },
      err: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, marginTop: 6 },
    };

    function Toggle({ on, onToggle, disabled, label }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': on,
        'aria-label': label,
        disabled: disabled === true,
        onClick: onToggle,
        style: { ...styles.switchBox, ...(on ? styles.switchBoxOn : null), ...(disabled ? { opacity: 0.4, cursor: 'default' } : null) },
      }, h('span', { style: styles.switchKnob(on) }));
    }

    async function call(path, init) {
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });
      const body = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
      if (!response.ok && body.ok !== true) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      return body;
    }

    /** Rough per-turn cost: the catalog carries the name plus one description line. */
    function estimateTokens(skills) {
      let chars = 0;
      for (const skill of skills) {
        chars += skill.slug.length + 4 + skill.desc.length;
      }
      return Math.round(chars / 2.4);
    }

    /* --------------------------------------------------------------- search */

    /** Real CJK ideographs only. Em-dashes and full-width punctuation do NOT count. */
    const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

    /**
     * Below this many identity matches, description matches are appended.
     * Three is deliberate: a two-letter query like "抖音" or "wechat" rarely
     * appears in names, and hiding its strategists would look broken.
     */
    const MIN_STRONG = 3;

    /**
     * Split one field into latin tokens plus keep the folded string for CJK use.
     *
     * Latin tokens break on any non-alphanumeric AND on a camel-case hump, so
     * "mobileAppBuilder" and "agency-mobile-app-builder" both yield
     * [mobile, app, builder]. CJK has no delimiters, so it stays inside the
     * token run and is additionally searched as a substring.
     */
    function tokenize(text) {
      const folded = String(text).normalize('NFKC').toLowerCase();
      const spaced = folded.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
      const tokens = new Set();
      for (const raw of spaced.split(/[^0-9a-z\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/u)) {
        if (raw !== '') tokens.add(raw);
      }
      return { tokens, flat: folded };
    }

    /** Whether this term should be matched as a latin word. */
    function isLatinTerm(term) {
      return /^[a-z0-9][a-z0-9+#._-]*$/.test(term);
    }

    /**
     * Find a latin term in a mixed CJK/latin field only on a word boundary.
     *
     * Without this, a field that happens to contain one Chinese character made
     * the whole field substring-searchable, and "ui" matched b(ui)lding and
     * R(ui)jie. Boundary = not preceded/followed by a latin letter or digit.
     */
    function latinOnBoundary(flat, term) {
      let at = flat.indexOf(term);
      const boundary = (ch) => ch === '' || /[0-9a-z]/.test(ch) === false;
      while (at !== -1) {
        const before = at > 0 ? flat[at - 1] : '';
        const after = at + term.length < flat.length ? flat[at + term.length] : '';
        if (boundary(before) && boundary(after)) return true;
        at = flat.indexOf(term, at + 1);
      }
      return false;
    }

    /** Match one term against one already-tokenised field. */
    function matchField(field, term) {
      if (isLatinTerm(term) === false) {
        return field.flat.includes(term);
      }
      for (const token of field.tokens) {
        if (token === term) return true;
        if (term.length >= 3 && token.startsWith(term)) return true;
      }
      if (CJK_RE.test(field.flat) && latinOnBoundary(field.flat, term)) return true;
      return false;
    }

    /**
     * Score one skill against every term.
     *
     * Returns 2 when all terms hit an identity field (name / slug / category),
     * 1 when they only hit a description, 0 when any term misses entirely.
     * Identity fields are pre-tokenised once per skill by the caller.
     */
    function rankSkill(identity, describe, terms) {
      let allInIdentity = true;
      let allAnywhere = true;
      for (const term of terms) {
        if (identity.some((f) => matchField(f, term)) === false) {
          allInIdentity = false;
          if (describe.some((f) => matchField(f, term)) === false) {
            allAnywhere = false;
            break;
          }
        }
      }
      if (allInIdentity) return 2;
      return allAnywhere ? 1 : 0;
    }

    /* ----------------------------------------------------------------- view */

    function Panel() {
      const [snapshot, setSnapshot] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [query, setQuery] = useState('');
      const [division, setDivision] = useState('');
      const [filter, setFilter] = useState('all');
      const [openEn, setOpenEn] = useState(() => new Set());
      const [armed, setArmed] = useState(false);
      const alive = useRef(true);
      const searchRef = useRef(null);

      // The confirm button disarms itself so a second accidental click cannot
      // wipe all 283 toggles.
      useEffect(() => {
        if (!armed) return undefined;
        const timer = setTimeout(() => setArmed(false), 4000);
        return () => clearTimeout(timer);
      }, [armed]);

      const load = useCallback(async () => {
        try {
          const next = await call('/state');
          if (alive.current) setSnapshot(next);
        } catch (cause) {
          if (alive.current) setError(cause instanceof Error ? cause.message : String(cause));
        }
      }, []);

      useEffect(() => {
        alive.current = true;
        void load();
        return () => { alive.current = false; };
      }, [load]);

      const run = useCallback(async (path, body) => {
        setBusy(true);
        setError('');
        try {
          const next = await call(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
          if (alive.current) setSnapshot(next);
        } catch (cause) {
          if (alive.current) setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (alive.current) setBusy(false);
        }
      }, []);

      const skills = snapshot?.skills ?? [];

      const visible = useMemo(() => {
        const terms = query
          .normalize('NFKC')
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        const base = skills.filter((skill) => {
          if (division !== '' && skill.division !== division) return false;
          if (filter === 'on' && skill.disabled) return false;
          if (filter === 'off' && !skill.disabled) return false;
          return true;
        });
        if (terms.length === 0) return base;

        const strong = [];
        const weak = [];
        for (const skill of base) {
          // Identity = what this skill IS. Description = what it DOES.
          const identity = [
            tokenize(skill.slug),
            tokenize(skill.label),
            tokenize(skill.divisionLabel ?? ''),
          ];
          const describe = [tokenize(skill.desc), tokenize(skill.enDesc ?? '')];
          const rank = rankSkill(identity, describe, terms);
          if (rank === 2) strong.push(skill);
          else if (rank === 1) weak.push(skill);
        }
        // Name/category hits are authoritative; description-only hits are a
        // fallback for rare terms, not peers of the real matches.
        return strong.length >= MIN_STRONG ? strong : strong.concat(weak);
      }, [skills, query, division, filter]);

      const totals = useMemo(() => {
        const enabled = skills.filter((skill) => !skill.disabled);
        return {
          enabled: enabled.length,
          disabled: skills.length - enabled.length,
          saved: estimateTokens(skills) - estimateTokens(enabled),
          all: estimateTokens(skills),
        };
      }, [skills]);

      const toggle = useCallback((skill) => {
        void run('/toggle', { slug: skill.slug, disabled: !skill.disabled });
      }, [run]);

      const bulkDivision = useCallback((key, disabled) => {
        const slugs = skills.filter((skill) => key === '' || skill.division === key).map((skill) => skill.slug);
        void run('/bulk', { slugs, disabled });
      }, [run, skills]);

      if (snapshot === null) {
        return h('div', { style: styles.root },
          h('div', { style: { padding: 22, color: 'var(--dsw-alias-label-secondary)' } }, error || t('loading')));
      }

      const sidebarItems = [
        { key: '', label: t('all'), count: snapshot.total },
        ...snapshot.divisions.map((entry) => ({ key: entry.key, label: entry.label, count: entry.count })),
      ];

      return h('div', { style: styles.root },
        h('div', { style: styles.header },
          h('div', { style: styles.titleRow },
            h('h1', { style: styles.title }, t('title')),
            h('span', { style: styles.subtitle }, t('subtitle')),
          ),
          h('div', { style: styles.searchRow },
            h('div', { style: styles.inputWrap },
              h('input', {
                style: styles.input,
                // Uncontrolled on purpose: a controlled value fights the IME and
                // swallows Chinese input, because React writes the stale value
                // back into the DOM while the candidate window is still open.
                defaultValue: '',
                ref: searchRef,
                placeholder: t('search'),
                'aria-label': t('search'),
                spellCheck: false,
                autoComplete: 'off',
                onInput: (event) => {
                  // Mid-composition the box only holds the pinyin buffer;
                  // applying it would flicker the list on every keystroke.
                  if (event.nativeEvent?.isComposing === true) return;
                  setQuery(event.currentTarget.value);
                },
                onCompositionEnd: (event) => setQuery(event.currentTarget.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') {
                    event.currentTarget.value = '';
                    setQuery('');
                  }
                },
              }),
              h('span', { style: styles.inputMeta },
                query === '' ? null : h('span', null, visible.length, ' ', t('searchHit')),
                query === ''
                  ? null
                  : h('button', {
                      type: 'button',
                      style: styles.inputClear,
                      'aria-label': t('clear'),
                      title: t('clear'),
                      onClick: () => {
                        if (searchRef.current !== null) searchRef.current.value = '';
                        setQuery('');
                      },
                    }, '\u00d7'),
              ),
            ),
            h('button', {
              style: styles.button,
              type: 'button',
              disabled: busy,
              onClick: () => setFilter(filter === 'on' ? 'all' : 'on'),
            }, t('showOnlyOn')),
            h('button', {
              style: styles.button,
              type: 'button',
              disabled: busy,
              onClick: () => setFilter(filter === 'off' ? 'all' : 'off'),
            }, t('showOnlyOff')),
            h('button', {
              style: styles.buttonPrimary,
              type: 'button',
              disabled: busy,
              onClick: () => void bulkDivision('', false),
            }, t('enableAll')),
            h('button', {
              style: armed ? styles.buttonDanger : styles.button,
              type: 'button',
              disabled: busy,
              title: armed ? t('confirmHint') : t('disableAll'),
              onClick: () => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                setArmed(false);
                void bulkDivision('', true);
              },
            }, armed ? t('confirmDisableAll') : t('disableAll')),
            h('button', {
              style: styles.button,
              type: 'button',
              disabled: busy,
              onClick: () => void run('/sync', {}),
            }, t('resync')),
          ),
        ),
        h('div', { style: styles.stats },
          h('span', null, t('total'), ' ', h('span', { style: styles.statNum }, snapshot.total)),
          h('span', null, t('enabled'), ' ', h('span', { style: styles.statNum }, totals.enabled)),
          h('span', null, t('disabled'), ' ', h('span', { style: styles.statNum }, totals.disabled)),
          h('span', null, t('savedTokens'), ' ', h('span', { style: styles.statNum }, totals.saved.toLocaleString()), ' ', t('tokens')),
          h('span', null, '（当前 ', h('span', { style: styles.statNum }, totals.all.toLocaleString()), ' tokens，占满 ', t('count'), '）'),
        ),
        error !== '' ? h('div', { style: { ...styles.err, padding: '0 22px 8px' } }, error) : null,
        h('div', { style: styles.body },
          h('nav', { style: styles.side, 'aria-label': t('title') },
            sidebarItems.map((item) => h('button', {
              key: item.key === '' ? '__all' : item.key,
              type: 'button',
              style: styles.sideItem(division === item.key),
              onClick: () => setDivision(item.key),
            },
              h('span', null, item.label),
              h('span', { style: styles.sideCount }, item.count),
            )),
            division !== ''
              ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 6px 4px' } },
                  h('button', {
                    style: styles.button, type: 'button', disabled: busy,
                    onClick: () => void bulkDivision(division, false),
                  }, t('enableDivision')),
                  h('button', {
                    style: styles.button, type: 'button', disabled: busy,
                    onClick: () => void bulkDivision(division, true),
                  }, t('disableDivision')),
                )
              : null,
          ),
          h('div', { style: styles.list },
            h('p', { style: styles.caveat },
              t('hint'), ' ', t('stateFile'), ' ',
              h('code', { style: { fontSize: 11 } }, snapshot.stateFile),
            ),
            visible.length === 0
              ? h('p', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12.5 } }, t('empty'))
              : visible.map((skill) => {
                  const enOpen = openEn.has(skill.slug);
                  return h('div', { key: skill.slug, style: styles.card(skill.disabled) },
                    h('div', { style: styles.cardHead },
                      h('div', { style: styles.cardText },
                        h('div', { style: styles.cardName },
                          skill.label,
                          h('span', { style: styles.badge }, skill.divisionLabel),
                          skill.file === undefined
                            ? h('span', { style: { ...styles.badge, color: 'var(--dsw-alias-state-error-primary)' } }, t('noFile'))
                            : null,
                        ),
                        h('div', { style: styles.cardSlug }, skill.slug),
                        h('div', { style: styles.cardDesc }, skill.desc),
                        h('button', {
                          style: { ...styles.link, marginTop: 5 },
                          type: 'button',
                          onClick: () => {
                            const next = new Set(openEn);
                            if (enOpen) next.delete(skill.slug);
                            else next.add(skill.slug);
                            setOpenEn(next);
                          },
                        }, enOpen ? t('hideEn') : t('showEn')),
                        enOpen ? h('div', { style: styles.cardEn }, skill.enDesc) : null,
                      ),
                      h(Toggle, {
                        on: !skill.disabled,
                        label: `${skill.label} ${skill.disabled ? t('off') : t('on')}`,
                        disabled: busy || skill.file === undefined,
                        onToggle: () => toggle(skill),
                      }),
                    ),
                  );
                }),
          ),
        ),
      );
    }

    /* ----------------------------------------------------------------- boot */

    function PanelIcon({ size }) {
      const s = typeof size === 'number' ? size : 18;
      return h('svg', {
        viewBox: '0 0 24 24', width: s, height: s, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z' }),
        h('path', { d: 'M8 3v18' }),
        h('path', { d: 'M12 8h4M12 12h4' }),
      );
    }

    /** Resolved once per render pass; `t` reads the active dictionary. */
    let bound;
    function t(key) {
      const dict = bound === undefined ? zh : bound;
      return dict[key] ?? zh[key] ?? key;
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        bound = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agency-skill-panel: dictionaries');

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 12,
          locale: NS,
          label: () => t('panel'),
        }, PanelIcon));

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, Panel));
      },
    };
  },
});
