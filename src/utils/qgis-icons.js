// QGIS-style selection toolbar icons (SVG components)

// ── 1. Select Features (dashed rect + arrow cursor)
export const SelectFeaturesIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="2"
      fill="#F5C518" stroke="#C8980A" strokeWidth="1.2"/>
    <rect x="3.5" y="3.5" width="12" height="12" rx="1"
      fill="none" stroke="#555" strokeWidth="1.6" strokeDasharray="3 2"/>
    <path d="M9 9 L9 20 L12 17 L14.5 22 L16 21.2 L13.5 16.2 L17.5 16.2 Z"
      fill="white" stroke="#333" strokeWidth="1.1" strokeLinejoin="round"/>
  </svg>
);

// ── 2. Select All — 3 өргөн зураас
export const SelectAllIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="3" y="4"    width="18" height="4.5" rx="1" fill="#F5C518" stroke="#C8980A" strokeWidth="1.3"/>
    <rect x="3" y="9.75" width="18" height="4.5" rx="1" fill="#F5C518" stroke="#C8980A" strokeWidth="1.3"/>
    <rect x="3" y="15.5" width="18" height="4.5" rx="1" fill="#F5C518" stroke="#C8980A" strokeWidth="1.3"/>
  </svg>
);

// ── 3. Deselect All
export const DeselectAllIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="3" y="3" width="13" height="13" rx="1.5" fill="#F5C518" stroke="#C8980A" strokeWidth="1.4"/>
    <rect x="7" y="7" width="13" height="13" rx="1.5" fill="#F5C518" stroke="#C8980A" strokeWidth="1.4"/>
    <circle cx="17.5" cy="17.5" r="5.5" fill="white"/>
    <circle cx="17.5" cy="17.5" r="5.5" fill="#ff3b30" fillOpacity="0.12"/>
    <circle cx="17.5" cy="17.5" r="5.5" stroke="#ff3b30" strokeWidth="1.6" fill="none"/>
    <line x1="14.2" y1="14.2" x2="20.8" y2="20.8" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

// ── 4. Invert Selection
export const InvertSelectionIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="2"
      fill="none" stroke="#C8980A" strokeWidth="1.4"/>
    <path d="M2 22 L22 2 L22 22 Z" fill="#F5C518"/>
    <path d="M2 2 L22 2 L2 22 Z" fill="white"/>
    <line x1="2" y1="22" x2="22" y2="2" stroke="#C8980A" strokeWidth="1.4"/>
    <rect x="2" y="2" width="20" height="20" rx="2"
      fill="none" stroke="#C8980A" strokeWidth="1.4"/>
  </svg>
);

// ── 5. Select by Location
export const SelectByLocationIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="2" y="5" width="15" height="15" rx="1.5" fill="#F5C518" stroke="#C8980A" strokeWidth="1.4"/>
    <path d="M18 2C15.8 2 14 3.8 14 6C14 9 18 14 18 14C18 14 22 9 22 6C22 3.8 20.2 2 18 2Z"
      fill="#5b9bd5" stroke="#3a78b5" strokeWidth="1"/>
    <circle cx="18" cy="6" r="1.5" fill="white"/>
  </svg>
);
