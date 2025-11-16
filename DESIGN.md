# Design System - Agoralia

## 🎨 Colors

### **Primary**
```css
--indigo-600: #4F46E5  /* Primary color */
--indigo-700: #4338CA  /* Primary hover */
--indigo-800: #3730A3  /* Primary active */
```

### **Success**
```css
--success-600: #16A34A  /* Success color */
--success-700: #15803D  /* Success dark */
--success-50: #F0FDF4   /* Success light bg */
--success-300: #86EFAC  /* Success light border */
```

### **Warning**
```css
--amber: #f59e0b  /* Warning color */
```

### **Error**
```css
--red: #dc2626  /* Error color */
```

### **Neutral**
```css
--ink-900: #111827  /* Text primary */
--muted: #6b7280    /* Text muted */
--border: #E5E7EB   /* Border color */
--surface: #ffffff  /* Surface color */
--bg: #F2EDE4       /* Background color (sand-50) */
--sand-50: #F2EDE4  /* Sand background */
```

---

## 📏 Spacing Scale

```css
/* Spacing */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 20px
--spacing-2xl: 24px
--spacing-3xl: 32px
--spacing-4xl: 48px

/* Layout spacing */
--px: 24px              /* Padding x-axis */
--gap-card: 16px        /* Gap tra cards */
--gap-block: 24px       /* Gap tra blocchi principali */
```

**Uso**:
- `4px`: Padding interno badge, icon spacing
- `8px`: Padding piccolo, gap tra elementi piccoli
- `12px`: Padding medio, gap tra items
- `16px`: Gap tra cards, padding sezioni
- `20px`: Padding card, padding sezioni principali
- `24px`: Padding contenitore, gap tra blocchi principali
- `32px`: Padding grandi, gap tra sezioni
- `48px`: Padding empty state, padding grandi sezioni

---

## 📝 Typography

### **Font Family**
```css
--font-family-latin: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
--font-family-ar: 'Noto Sans Arabic', Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
```

### **Font Scale**
```css
/* Heading 1 */
--h1-size: 40px
--h1-line: 44px
--h1-weight: 700

/* Heading 2 */
--h2-size: 28px
--h2-line: 32px
--h2-weight: 700

/* Heading 3 */
--h3-size: 20px
--h3-line: 28px
--h3-weight: 600

/* Body */
--body-size: 16px
--body-line: 26px
--body-weight: 400

/* Caption */
--caption-size: 12px
--caption-line: 16px
--caption-weight: 500

/* Small */
--small-size: 13px
--small-line: 18px
--small-weight: 400

/* Tiny */
--tiny-size: 11px
--tiny-line: 16px
--tiny-weight: 500
```

**Uso**:
- `h1` (40px/44px, 700): Page titles (Dashboard, Campaigns, ecc.)
- `h2` (28px/32px, 700): Section titles principali
- `h3` (20px/28px, 600): Section titles secondarie
- `body` (16px/26px, 400): Testo corpo principale
- `caption` (12px/16px, 500): Labels, badges, metadata
- `small` (13px/18px, 400): Sottotitoli, helper text
- `tiny` (11px/16px, 500): Badge text, timestamps

---

## 🎨 Border Radius

```css
--radius-sm: 6px   /* Badge, small elements */
--radius-md: 8px   /* Buttons, inputs */
--radius-lg: 12px  /* Cards, modals */
```

**Uso**:
- `6px`: Badge, small badges, duration badges
- `8px`: Buttons, inputs, select
- `12px`: Cards, modals, containers principali

---

## 📐 Layout

```css
/* Container */
--container-max: 1200px  /* Max width contenitore principale */

/* Layout spacing */
--px: 24px               /* Padding x-axis (left/right) */
--section-py-mobile: 64px  /* Padding vertical mobile */
--section-py-desktop: 96px /* Padding vertical desktop */
```

---

## 🎯 Component Spacing

### **Cards**
```css
/* Card padding */
--card-padding: 20px  /* Padding interno card */

/* Card gap */
--card-gap: 16px      /* Gap tra cards in grid */
```

### **Sections**
```css
/* Section gap */
--section-gap: 24px   /* Gap tra sezioni principali */
```

### **Table**
```css
/* Table cell padding */
--table-cell-padding: 12px  /* Padding celle tabella */

/* Table row gap */
--table-row-gap: 0px        /* Gap tra righe (borders) */
```

### **Buttons**
```css
/* Button heights */
--button-height-sm: 32px
--button-height-md: 40px
--button-height-lg: 48px

/* Button padding */
--button-padding-sm: 8px 12px
--button-padding-md: 10px 16px
--button-padding-lg: 12px 24px
```

---

## 🎨 Shadows (Opzionale)

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

**Uso**:
- `shadow-sm`: Hover su cards, buttons
- `shadow-md`: Cards elevate, modals
- `shadow-lg`: Modals, dropdowns

---

## 📱 Breakpoints

```css
/* Mobile */
@media (max-width: 767px) {
  /* Mobile styles */
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  /* Tablet styles */
}

/* Desktop */
@media (min-width: 1024px) {
  /* Desktop styles */
}
```

**Uso**:
- `< 768px`: Mobile (sidebar hidden, grid 1 column)
- `768px - 1023px`: Tablet (sidebar collapsible, grid 2 columns)
- `≥ 1024px`: Desktop (sidebar always visible, grid 3+ columns)

---

## ✅ Design Checklist

Quando implementi un componente, verifica:

1. ✅ **Colors**: Usa variabili CSS, non colori hardcoded
2. ✅ **Spacing**: Usa scale spacing (4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px)
3. ✅ **Typography**: Usa font scale (h1, h2, h3, body, caption, small, tiny)
4. ✅ **Border Radius**: Usa scale (6px, 8px, 12px)
5. ✅ **Responsive**: Testa su mobile (< 768px), tablet (768-1023px), desktop (≥ 1024px)
6. ✅ **States**: Implementa hover, active, disabled, loading
7. ✅ **Accessibility**: Focus visible, ARIA labels, keyboard navigation

---

## 📚 Riferimenti

- Design Tokens: `frontend/src/styles/tokens.css`
- Layout Specs: `DASHBOARD_LAYOUT.md`
- Component Map: `COMPONENTS_MAP.md`
- UI Structure: `UI_STRUCTURE.md`

