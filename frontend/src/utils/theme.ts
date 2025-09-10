// src/utils/theme.ts
export type ThemeMode = 'light' | 'dark';
export type PrimaryKey =
  | 'blue' | 'violet' | 'green' | 'orange' | 'red' | 'teal' | 'magenta' | 'yellow';

const PRIMARY: Record<PrimaryKey, { base: string; hover: string; ring: string }> = {
  blue:   { base:'#0d6efd', hover:'#0b5ed7', ring:'rgba(13,110,253,.35)' },
  violet: { base:'#6f42c1', hover:'#5e37a7', ring:'rgba(111,66,193,.35)' },
  green:  { base:'#198754', hover:'#157347', ring:'rgba(25,135,84,.35)' },
  orange: { base:'#fd7e14', hover:'#e36809', ring:'rgba(253,126,20,.35)' },
  red:    { base:'#dc3545', hover:'#bb2d3b', ring:'rgba(220,53,69,.35)' },
  teal:   { base:'#20c997', hover:'#1aa179', ring:'rgba(32,201,151,.35)' },
  magenta:{ base:'#d63384', hover:'#b02a6f', ring:'rgba(214,51,132,.35)' },
  yellow: { base:'#ffc107', hover:'#e0a800', ring:'rgba(255,193,7,.35)' },
};

const MODE: Record<ThemeMode, {
  body: string; text: string; muted: string; border: string;
  card: string; cap: string; input: string;
}> = {
  light: {
    body:'#ffffff', text:'#212529', muted:'#6c757d', border:'rgba(0,0,0,.125)',
    card:'#ffffff', cap:'#ffffff', input:'#ffffff'
  },
  dark: {
    body:'#0f1115', text:'#e9ecef', muted:'#adb5bd', border:'rgba(255,255,255,.18)',
    card:'#12141a', cap:'#12141a', input:'#0f1115'
  }
};

export type ThemeChoice = { mode: ThemeMode; primary: PrimaryKey };
const KEY = 'theme-choice';

export function loadTheme(): ThemeChoice {
  try { return JSON.parse(localStorage.getItem(KEY) || '') as ThemeChoice; } catch {}
  return { mode: 'light', primary: 'blue' }; // default
}
export function saveTheme(t: ThemeChoice) { localStorage.setItem(KEY, JSON.stringify(t)); }

export function applyTheme(t: ThemeChoice) {
  const root = document.documentElement;
  const p = PRIMARY[t.primary];
  const m = MODE[t.mode];

  // helper to turn #hex into "r,g,b"
  const toRGB = (hex: string) => {
    const h = hex.replace('#','');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(v, 16);
    return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
  };

  // ---- Danger palette (darker & unified) ----
  const dangerStrong       = '#881925'; // darker crimson
  const dangerStrongHover  = '#4e0e14ff';

  root.style.setProperty('--danger-strong', dangerStrong);
  root.style.setProperty('--danger-strong-hover', dangerStrongHover);

  // Keep Bootstrap's tokens in sync so .text-danger/.badge/bg-danger/etc. track it
  root.style.setProperty('--bs-danger', dangerStrong);
  root.style.setProperty('--bs-danger-rgb', toRGB(dangerStrong));
  root.style.setProperty('--bs-danger-text-emphasis', dangerStrong); // ensure text uses same shade

  // Primary/accent
  root.style.setProperty('--bs-primary', p.base);
  root.style.setProperty('--bs-primary-hover', p.hover);
  root.style.setProperty('--focus-ring', p.ring);

  // Keep usernames/links always blue
  root.style.setProperty('--bs-link-color', '#0d6efd');
  root.style.setProperty('--bs-link-hover-color', '#0a58ca');
  root.style.setProperty('--bs-link-color-rgb', '13,110,253');

  // Surfaces & text
  root.style.setProperty('--bs-body-bg', m.body);
  root.style.setProperty('--bs-body-color', m.text);
  root.style.setProperty('--bs-secondary-color', m.muted);
  root.style.setProperty('--bs-border-color', m.border);

  // Cards & overlays
  root.style.setProperty('--bs-card-bg', m.card);
  root.style.setProperty('--bs-card-cap-bg', m.cap);
  root.style.setProperty('--bs-card-color', m.text);
  root.style.setProperty('--bs-card-border-color', m.border);
  root.style.setProperty('--bs-form-control-bg', m.input);
  root.style.setProperty('--bs-dropdown-bg', m.card);
  root.style.setProperty('--bs-modal-bg', m.card);
  root.style.setProperty('--bs-offcanvas-bg', m.card);

  // Hover / active states
  root.style.setProperty(
    '--bs-list-group-action-hover-bg',
    t.mode === 'dark' ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'
  );
  root.style.setProperty('--bs-list-group-action-hover-color', m.text);
  root.style.setProperty('--bs-list-group-active-bg', p.base);
  root.style.setProperty('--bs-list-group-active-color', '#fff');

  // Close button color (white in dark mode)
  root.style.setProperty(
    '--btn-close-filter',
    t.mode === 'dark' ? 'invert(1) brightness(180%)' : 'none'
  );

  // List group (Followers / Following)
  root.style.setProperty('--bs-list-group-bg', m.card);
  root.style.setProperty('--bs-list-group-color', m.text);
  root.style.setProperty('--bs-list-group-border-color', m.border);

  // Search suggestion colors
  root.style.setProperty(
    '--dropdown-item-color',
    t.mode === 'dark' ? 'rgba(255,255,255,.92)' : m.text
  );
  root.style.setProperty(
    '--dropdown-item-muted',
    t.mode === 'dark' ? 'rgba(255,255,255,.60)' : m.muted
  );
  root.style.setProperty(
    '--dropdown-hover-bg',
    t.mode === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)'
  );

  // action/hovers/actives
  root.style.setProperty('--bs-list-group-action-color', m.text);
  root.style.setProperty('--bs-list-group-action-hover-color', m.text);
  root.style.setProperty(
    '--bs-list-group-action-hover-bg',
    t.mode === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)'
  );
  root.style.setProperty('--bs-list-group-action-active-color', m.text);
  root.style.setProperty(
    '--bs-list-group-action-active-bg',
    t.mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)'
  );

  root.style.setProperty('--bs-list-group-active-bg', p.base);
  root.style.setProperty('--bs-list-group-active-color', '#fff');
  root.style.setProperty('--bs-list-group-active-border-color', p.base);

  root.style.setProperty('--bs-list-group-disabled-bg', m.card);
  root.style.setProperty('--bs-list-group-disabled-color', m.muted);

  // Scrollbar palette (used by overlays, etc.)
  root.style.setProperty('--scrollbar-thumb',        t.mode === 'dark' ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)');
  root.style.setProperty('--scrollbar-thumb-hover',  t.mode === 'dark' ? 'rgba(255,255,255,.42)' : 'rgba(0,0,0,.42)');
  root.style.setProperty('--scrollbar-track',        t.mode === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)');

  // Notifications (rows + hover + unread tint)
  root.style.setProperty('--notif-row-bg', m.card);
  root.style.setProperty(
    '--notif-row-hover-bg',
    t.mode === 'dark' ? 'rgba(255,255,255,.06)' : '#f8f9fa'
  );
  root.style.setProperty(
    '--notif-unread-bg',
    t.mode === 'dark'
      ? 'color-mix(in srgb, var(--bs-primary) 18%, var(--bs-card-bg) 82%)'
      : '#f3f7ff'
  );

  const STYLE_ID = 'theme-overrides';
  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `
    /* Cards */
    .card{
      --bs-card-bg: ${m.card};
      --bs-card-color: ${m.text};
      --bs-card-border-color: ${m.border};
      --bs-card-cap-bg: ${m.cap};
    }

    /* List groups (conversations, followers/following, notifications) */
    .list-group{
      --bs-list-group-bg: ${m.card};
      --bs-list-group-color: ${m.text};
      --bs-list-group-border-color: ${m.border};

      --bs-list-group-action-color: ${m.text};
      --bs-list-group-action-hover-color: ${m.text};
      --bs-list-group-action-hover-bg: ${
        t.mode === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)'
      };
      --bs-list-group-action-active-bg: ${
        t.mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)'
      };

      --bs-list-group-active-bg: ${p.base};
      --bs-list-group-active-color: #fff;
      --bs-list-group-active-border-color: ${p.base};
    }

    /* Inputs, selects, textareas */
    .form-control,
    .form-control:focus,
    .form-select,
    .form-select:focus,
    textarea.form-control{
      /* set the variables Bootstrap reads */
      --bs-form-control-bg: ${m.input};
      --bs-body-color: ${m.text};
      --bs-border-color: ${m.border};

      /* force the properties so it darkens even if other rules exist */
      background-color: var(--bs-form-control-bg) !important;
      color: var(--bs-body-color) !important;
      border-color: var(--bs-border-color) !important;
    }

    /* Buttons: force them to use our theme vars */
    .btn-primary{
      background-color: var(--bs-primary) !important;
      border-color: var(--bs-primary) !important;
      color: #fff !important;
    }
    .btn-primary:hover,
    .btn-primary:focus{
      background-color: var(--bs-primary-hover) !important;
      border-color: var(--bs-primary-hover) !important;
    }
    .btn-primary:focus-visible{
      box-shadow: 0 0 0 .25rem var(--focus-ring) !important;
    }

    /* Outline primary (used by the Mode toggle on Settings) */
    .btn-outline-primary{
      color: var(--bs-primary) !important;
      border-color: var(--bs-primary) !important;
    }
    .btn-outline-primary:hover,
    .btn-outline-primary:focus{
      background-color: var(--bs-primary) !important;
      border-color: var(--bs-primary) !important;
      color: #fff !important;
    }
    .btn-outline-primary.active,
    .btn-outline-primary:active,
    .btn-check:checked + .btn-outline-primary{
      background-color: var(--bs-primary) !important;
      border-color: var(--bs-primary) !important;
      color: #fff !important;
      box-shadow: 0 0 0 .25rem var(--focus-ring) !important;
    }

    /* Autofill (Chrome/Safari/Edge) */
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    textarea:-webkit-autofill,
    textarea:-webkit-autofill:hover,
    textarea:-webkit-autofill:focus,
    select:-webkit-autofill,
    select:-webkit-autofill:hover,
    select:-webkit-autofill:focus{
      -webkit-text-fill-color: var(--bs-body-color) !important;
      caret-color: var(--bs-body-color);
      /* Paint over the browser’s white/yellow with your input bg */
      -webkit-box-shadow: 0 0 0px 1000px var(--bs-form-control-bg) inset !important;
      box-shadow: 0 0 0px 1000px var(--bs-form-control-bg) inset !important;
      border-color: var(--bs-border-color) !important;
      /* Prevent flash on apply */
      transition: background-color 9999s ease-in-out 0s;
    }

    /* Autofill (Firefox) */
    input:-moz-autofill,
    textarea:-moz-autofill,
    select:-moz-autofill{
      box-shadow: 0 0 0px 1000px var(--bs-form-control-bg) inset !important;
      -moz-text-fill-color: var(--bs-body-color) !important;
      border-color: var(--bs-border-color) !important;
    }

    /* Placeholder text */
    .form-control::placeholder{
      color: ${m.muted};
      opacity: .9;
    }

    /* Input-group addons (e.g. @mention chip) */
    .input-group-text{
      background-color: ${m.card} !important;
      color: ${m.text} !important;
      border-color: ${m.border} !important;
    }

    /* Checkboxes / radios for dark mode contrast */
    .form-check-input{
      background-color: ${m.input};
      border-color: ${m.border};
    }
    .form-check-input:checked{
      background-color: var(--bs-primary);
      border-color: var(--bs-primary);
    }

    /* Optional: keep other surfaces consistent */
    .dropdown-menu{ --bs-dropdown-bg: ${m.card}; }
    .modal-content{ --bs-modal-bg: ${m.card}; --bs-modal-color: ${m.text}; }
    .offcanvas{ --bs-offcanvas-bg: ${m.card}; }

    /* ===== Darker, unified danger ===== */

    /* Buttons – set vars only, let :hover swap to hover color */
    .btn-danger{
      --bs-btn-bg: var(--danger-strong);
      --bs-btn-border-color: var(--danger-strong);
      --bs-btn-hover-bg: var(--danger-strong-hover);
      --bs-btn-hover-border-color: var(--danger-strong-hover);
      --bs-btn-active-bg: var(--danger-strong-hover);
      --bs-btn-active-border-color: var(--danger-strong-hover);
      color: #fff !important;
    }
    /* Ensure visible hover even if other rules have higher specificity */
    .btn-danger:hover,
    .btn-danger:focus,
    .btn-danger:active{
      background-color: var(--danger-strong-hover) !important;
      border-color: var(--danger-strong-hover) !important;
    }

    /* Outline variant keeps the same darker family */
    .btn-outline-danger{
      color: var(--danger-strong) !important;
      border-color: var(--danger-strong) !important;
    }
    .btn-outline-danger:hover{
      background-color: var(--danger-strong) !important;
      border-color: var(--danger-strong) !important;
      color: #fff !important;
    }

    /* Badges / pills (e.g., unread counts) */
    .badge.bg-danger,
    .text-bg-danger{
      --bs-bg-opacity: 1;
      background-color: rgba(var(--bs-danger-rgb), var(--bs-bg-opacity)) !important;
      color: #fff !important;
    }

    /* If you use the newer badge utility */
    .text-bg-danger{
      background-color: var(--bs-danger) !important;
      color: #fff !important;
    }

    /* Make the section title match the button exactly */
    .danger-zone-title{
      color: var(--danger-strong) !important;
    }
  `;

  // Elevation used in your components
  root.style.setProperty('--elev-2-shadow',
    t.mode === 'light' ? '0 8px 20px rgba(0,0,0,.06)' : '0 8px 20px rgba(0,0,0,.6)'
  );

  // Ring + underlay colors (invert for dark)
  root.style.setProperty('--ring-underlay',
    t.mode === 'dark' ? 'rgba(255,255,255,.36)' : 'rgba(13,110,253,.12)');

  // Shadows & ring contrast (tuned per mode)
  root.style.setProperty('--shadow-outer', t.mode === 'dark' ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.15)');
  root.style.setProperty('--ring-contrast', t.mode === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.06)');
  root.style.setProperty('--elev-card', t.mode === 'dark'
    ? '0 12px 28px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35)'
    : '0 8px 20px rgba(0,0,0,.06)');

  // Tell the browser to render form controls for this mode (affects password eye, date pickers, etc.)
  root.style.setProperty('color-scheme', t.mode === 'dark' ? 'dark' : 'light');
}
