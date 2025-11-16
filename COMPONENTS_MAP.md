# Mappa Componenti Riusabili - Agoralia UI

## 🎯 Componenti Base (Design System)

### **1. Layout Components**

#### `Layout` / `RootLayout`
**Uso**: Wrapper principale dell'app
**Props**:
- `children`: ReactNode
- `sidebar?`: ReactNode (opzionale)
- `header?`: ReactNode (opzionale)

**Include**:
- Sidebar navigation
- Header con workspace selector
- Main content area
- Toast container

---

#### `Card`
**Uso**: Container generico per contenuti raggruppati
**Props**:
- `children`: ReactNode
- `variant?`: "default" | "outlined" | "elevated"
- `padding?`: "none" | "sm" | "md" | "lg"

**Esempio**:
```jsx
<Card>
  <h3>Title</h3>
  <p>Content...</p>
</Card>
```

---

#### `Container`
**Uso**: Wrapper per contenuti con max-width
**Props**:
- `children`: ReactNode
- `maxWidth?`: "sm" | "md" | "lg" | "xl" | "full"
- `padding?`: boolean

---

### **2. Navigation Components**

#### `Sidebar` / `NavSidebar`
**Uso**: Navigazione laterale principale
**Props**:
- `items`: Array<{ path: string, label: string, icon: Icon }>
- `activePath?`: string
- `collapsed?`: boolean

**Include**:
- Logo/brand
- Menu items con icone
- Badge per notifiche
- Workspace selector (se multi-tenant)

---

#### `Breadcrumbs`
**Uso**: Percorso di navigazione
**Props**:
- `items`: Array<{ label: string, path?: string }>

**Esempio**:
```jsx
<Breadcrumbs items={[
  { label: "Dashboard", path: "/" },
  { label: "Campagne", path: "/campaigns" },
  { label: "Q4 Lead Qualification" }
]} />
```

---

#### `PageHeader`
**Uso**: Header pagina (Dashboard, Campaigns, Calls, ecc.)
**Props**:
- `title`: string
- `subtitle?`: string
- `primaryAction?: { label: string, onClick: () => void, icon?: Icon }`
- `secondaryAction?: { label: string, onClick: () => void, icon?: Icon }`
- `actions?: ReactNode` (custom actions)

**Include**:
- Titolo grande (h1: 40px/44px, weight 700)
- Sottotitolo opzionale (16px/24px, weight 400, color muted)
- Azioni allineate a destra (primary + secondary)

**Esempio**:
```jsx
<PageHeader
  title="Dashboard"
  subtitle="Overview delle tue campagne e chiamate"
  primaryAction={{ label: "Crea Campagna", onClick: () => navigate("/campaigns/new") }}
  secondaryAction={{ label: "Esporta", onClick: () => exportData() }}
/>
```

**Pattern UX**: Stesso spacing, font, posizione bottoni ovunque → coerenza visiva

---

#### `SectionHeader`
**Uso**: Header sezione dentro pagina (es: "Chiamate live", "Le tue campagne")
**Props**:
- `title`: string
- `description?`: string
- `actions?: ReactNode` (es: SearchInput, FilterButton, ecc.)

**Include**:
- Titolo sezione (16px/24px, weight 600)
- Descrizione opzionale (14px/20px, color muted)
- Azioni allineate a destra (search, filter, ecc.)

**Esempio**:
```jsx
<SectionHeader
  title="Chiamate live"
  actions={<SearchInput placeholder="Cerca…" />}
/>
```

**Pattern UX**: Componente piccolo ma utile per coerenza tra sezioni

---

### **3. Form Components**

#### `Button`
**Uso**: Pulsanti azioni
**Props**:
- `variant?`: "primary" | "secondary" | "danger" | "ghost"
- `size?`: "sm" | "md" | "lg"
- `loading?`: boolean
- `disabled?`: boolean
- `icon?`: Icon
- `as?`: "button" | "a" | React.ComponentType

**Stati**: default, hover, active, disabled, loading

---

#### `Input`
**Uso**: Input testuali
**Props**:
- `type?`: "text" | "email" | "tel" | "password" | "number"
- `placeholder?`: string
- `value`: string
- `onChange`: (value: string) => void
- `error?`: string | boolean
- `disabled?`: boolean
- `icon?`: Icon
- `label?`: string

---

#### `Select` / `Dropdown`
**Uso**: Selezione da lista
**Props**:
- `options`: Array<{ value: string, label: string, disabled?: boolean }>
- `value`: string
- `onChange`: (value: string) => void
- `placeholder?`: string
- `disabled?`: boolean
- `error?`: string | boolean
- `label?`: string

---

#### `MultiSelect`
**Uso**: Selezione multipla
**Props**:
- `options`: Array<{ value: string, label: string }>
- `value`: string[]
- `onChange`: (values: string[]) => void
- `placeholder?`: string
- `maxSelected?`: number

---

#### `DatePicker` / `DateTimePicker`
**Uso**: Selezione date/ora
**Props**:
- `value`: Date | null
- `onChange`: (date: Date | null) => void
- `minDate?`: Date
- `maxDate?`: Date
- `timezone?`: string
- `showTime?`: boolean

---

#### `FileUpload`
**Uso**: Upload file (CSV, PDF, etc.)
**Props**:
- `accept?`: string (es: ".csv,.pdf")
- `onUpload`: (file: File) => void | Promise<void>
- `maxSize?`: number (bytes)
- `multiple?`: boolean
- `loading?`: boolean

---

### **4. Wizard / Stepper Components**

#### `Stepper`
**Uso**: Progress indicator per wizard
**Props**:
- `currentStep`: number
- `totalSteps`: number
- `steps`: Array<{ label: string, completed?: boolean }>

**Include**:
- Progress bar
- Step labels
- Connettori tra step

---

#### `Wizard` / `WizardContainer`
**Uso**: Container per wizard multi-step
**Props**:
- `steps`: Array<ReactNode> (ogni step è un ReactNode completo, non un wrapper generico)
- `currentStep`: number
- `onStepChange`: (step: number) => void
- `onComplete`: () => void
- `canGoNext?`: boolean
- `canGoPrev?`: boolean

**Include**:
- Stepper in alto
- Step content (passa ReactNode direttamente)
- Navigation buttons (Previous, Next, Complete)
- Skip step (opzionale)

**Pattern UX**: 
- **Non usare `WizardStep.jsx` come componente generico** - spesso è solo un `div` con margini
- Ogni wizard concreto (`SetupWizard`, `CampaignWizard`) vive come pagina e passa i blocchi di contenuto direttamente
- Se non aggiunge logica, evita l'astrazione

---

### **5. Resource Selection Components**

#### `ResourceSelector`
**Uso**: Selezione risorsa (Agent, KB, Number, Lead List)
**Props**:
- `type`: "agent" | "knowledge" | "number" | "lead-list"
- `value`: string | number | null
- `onChange`: (value: string | number | null) => void
- `filter?`: (resource: Resource) => boolean
- `showCreate?`: boolean
- `onCreateClick?`: () => void

**Include**:
- Dropdown con lista risorse
- Badge stato (✅/⚠️)
- Link "Crea nuovo" se `showCreate`
- Messaggio se vuota: "Nessun agent disponibile"

---

#### `ResourceSelectorInline`
**Uso**: Selezione risorsa con creazione inline (modal)
**Props**:
- `...ResourceSelector props`
- `createModal`: ReactNode (modal per creare nuova risorsa)
- `onCreate`: (data: CreateData) => Promise<Resource>
- `loading?`: boolean

**Include**:
- `ResourceSelector` + modal inline
- Auto-refresh dopo creazione
- Auto-select nuova risorsa creata

---

#### `BrickSelector`
**Uso**: Selezione dei 4 mattoni (ordine fisso)
**Props**:
- `number`: { value: number | null, onChange: (v: number) => void }
- `knowledge`: { value: number | null, onChange: (v: number) => void }
- `agent`: { value: string | null, onChange: (v: string) => void }
- `leads`: { value: number[], onChange: (v: number[]) => void }
- `showCreate?`: boolean
- `onCreate`: (type: "number" | "knowledge" | "agent" | "leads") => void

**Include**:
- 4 selettori in ordine fisso con icone
- Badge stato per ogni mattone
- Link "Crea" se mancante
- Layout verticale con spacing

---

### **6. Status / Badge Components**

#### `Badge`
**Uso**: Badge di stato/etichetta
**Props**:
- `variant?`: "success" | "warning" | "error" | "info" | "neutral"
- `size?`: "sm" | "md"
- `icon?`: Icon

**Esempio**:
```jsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Error</Badge>
```

---

#### `StatusBadge`
**Uso**: Badge di stato specifico (Numero, KB, Agent)
**Props**:
- `type`: "number" | "knowledge" | "agent"
- `status`: "pending" | "active" | "error" | "syncing" | "ready"
- `label?`: string

**Include**:
- Colori specifici per tipo e stato
- Icona appropriata
- Tooltip con dettagli

---

#### `ProgressBadge`
**Uso**: Badge con progress bar (es: KB syncing)
**Props**:
- `progress`: number (0-100)
- `label`: string
- `status?`: "syncing" | "ready" | "error"

---

### **7. Checklist / Setup Components**

#### `SetupChecklist`
**Uso**: Checklist setup in Dashboard
**Props**:
- `items`: Array<{
    id: string,
    type: "number" | "knowledge" | "agent" | "leads",
    label: string,
    completed: boolean,
    actionLabel?: string,
    onAction?: () => void
  }>
- `totalCompleted`: number
- `totalItems`: number

**Include**:
- Card container con titolo e progress
- Lista di `BrickCard` in versione compatta (riuso componente)
- Progress: "X/Y completati"
- Badge "Sistema pronto ✅" o "Setup incompleto ⚠️"

**Pattern UX**: 
- **Non ridisegnare l'item** - riusa `BrickCard` in una variante compatta
- `SetupChecklist` è solo il **container** che usa `BrickCard` insieme

---

#### `BrickCard`
**Uso**: Card per singolo mattone (usato sia in setup wizard che in SetupChecklist)
**Props**:
- `type`: "number" | "knowledge" | "agent" | "leads"
- `title`: string
- `description`: string
- `completed`: boolean
- `onAction`: () => void
- `actionLabel?`: string
- `variant?`: "default" | "compact" (per SetupChecklist)

**Include**:
- Icona del mattone
- Titolo e descrizione
- Stato completato/incompleto
- CTA button
- Educazione breve

---

### **8. Banner / Alert Components**

#### `Banner` / `Alert`
**Uso**: Messaggi informativi/avvisi
**Props**:
- `variant?`: "info" | "success" | "warning" | "error"
- `title?`: string
- `children`: ReactNode
- `onClose?`: () => void
- `icon?`: Icon

**Esempio**:
```jsx
<Banner variant="warning" title="Numero non attivo">
  Il numero selezionato non è attivo. La campagna non può partire.
</Banner>
```

---

#### `CampaignStatusBanner`
**Uso**: Banner stato campagna (pronto/non pronto)
**Props**:
- `status`: "ready" | "missing-number" | "missing-leads" | "missing-agent" | "outside-hours"
- `message?`: string

**Include**:
- ✅ "Campagna pronta per partire"
- ⚠️ "Campagna non può partire: mancano leads / numero / fuori orario"

---

### **9. Table / List Components**

#### `Table`
**Uso**: Tabelle dati
**Props**:
- `columns`: Array<{ key: string, label: string, render?: (row: T) => ReactNode }>
- `data`: T[]
- `loading?`: boolean
- `emptyState?`: ReactNode
- `onRowClick?`: (row: T) => void

**Include**:
- Header fisso
- Body scrollabile
- Row hover
- Responsive (mobile: accordion)

---

#### `DataTable`
**Uso**: Tabella completa con filtri, pagination, toolbar (componente unico)
**Props**:
- `columns`: Array<{ key: string, label: string, render?: (row: T) => ReactNode }>
- `data`: T[]
- `loading?`: boolean
- `emptyState?`: ReactNode
- `filters?`: FilterConfig[]
- `pagination?`: { page: number, pageSize: number, total: number }
- `onFilterChange?`: (filters: Filters) => void
- `onPageChange?`: (page: number) => void
- `searchable?`: boolean
- `toolbar?: ReactNode` (custom toolbar)

**Include**:
- Toolbar (search bar + filter bar)
- Filtri sempre visibili (sidebar o barra)
- Pagination (infinite scroll o tradizionale)
- Loading state
- Empty state
- URL params per filtri (salva filtri in URL, refresh non resetta)

**Pattern UX**: 
- **Componente unico** che gestisce tutto: pagination, loading, empty state, toolbar
- **Non creare `CallList`/`CampaignList` come componenti separati** - sono pagine che passano:
  - `columns`
  - `filters config`
  - `fetcher`/hook (es: `useCallsTable()`)
- Se i "list" diventano solo "DataTable con columns diversi", evitarli come componenti

---

### **10. Stats / KPI Components**

#### `StatCard`
**Uso**: Card con metrica numerica (KPI/Stat) - componente unico flessibile
**Props**:
- `label`: string
- `value`: string | number
- `icon?`: Icon
- `trend?`: { value: number, direction: "up" | "down" }
- `loading?`: boolean
- `variant?`: "default" | "large" | "compact"

**Include**:
- Label piccola in alto (13px/18px, weight 400, color muted)
- Value grande (32px/40px, weight 700, color text)
- Icona opzionale
- Trend arrow (opzionale)

**Pattern UX**: 
- **Inizia con un solo `StatCard` abbastanza flessibile** - evita `KPICard` separato
- Se senti lo smell di troppi `if`/varianti, allora estrai `KPICard`
- Ma di solito `variant` prop è sufficiente

---

#### `StatGrid`
**Uso**: Grid di KPI cards
**Props**:
- `children`: ReactNode (StatCard[])
- `columns?`: number (responsive)

---

### **11. Modal / Dialog Components**

#### `Modal`
**Uso**: Dialog modale generico
**Props**:
- `open`: boolean
- `onClose`: () => void
- `title?`: string
- `children`: ReactNode
- `footer?`: ReactNode
- `size?`: "sm" | "md" | "lg" | "xl"

---

#### `CreateResourceModal`
**Uso**: Modal per creare risorsa inline (Agent, KB, Number, Lead List)
**Props**:
- `type`: "agent" | "knowledge" | "number" | "lead-list"
- `open`: boolean
- `onClose`: () => void
- `onCreate`: (data: CreateData) => Promise<Resource>
- `initialData?`: Partial<CreateData>

**Include**:
- Form specifico per tipo
- Validazione
- Loading state
- Success feedback

---

#### `ConfirmDialog`
**Uso**: Dialog di conferma
**Props**:
- `open`: boolean
- `onClose`: () => void
- `onConfirm`: () => void
- `title`: string
- `message`: string
- `confirmLabel?`: string
- `cancelLabel?`: string
- `variant?`: "danger" | "warning" | "info"

---

### **12. Empty State Components**

#### `EmptyState`
**Uso**: Stato vuoto generico
**Props**:
- `icon?`: Icon
- `title`: string
- `description?`: string
- `action?: { label: string, onClick: () => void }

**Esempio**:
```jsx
<EmptyState
  icon={CampaignIcon}
  title="Nessuna campagna"
  description="Crea la tua prima campagna per iniziare"
  action={{ label: "Crea Campagna", onClick: () => navigate("/campaigns/new") }}
/>
```

---

### **13. Loading / Skeleton Components**

#### `Skeleton`
**Uso**: Placeholder durante loading
**Props**:
- `variant?`: "text" | "rectangular" | "circular"
- `width?`: string | number
- `height?`: string | number
- `animated?`: boolean

---

#### `SkeletonCard`
**Uso**: Skeleton per card
**Props**:
- `lines?`: number

---

#### `LoadingSpinner`
**Uso**: Spinner loading
**Props**:
- `size?`: "sm" | "md" | "lg"
- `text?`: string

---

### **14. Filter Components**

#### `FilterBar`
**Uso**: Barra filtri (sidebar o orizzontale)
**Props**:
- `filters`: FilterConfig[]
- `values`: Filters
- `onChange`: (filters: Filters) => void
- `layout?`: "sidebar" | "horizontal"

---

#### `Filter`
**Uso**: Singolo filtro
**Props**:
- `type`: "select" | "date" | "dateRange" | "text" | "number"
- `label`: string
- `value`: any
- `onChange`: (value: any) => void
- `options?`: Array<{ value: any, label: string }>

---

### **15. Chart Components** (Opzionale per Analytics)

#### `LineChart`
**Uso**: Grafico lineare
**Props**:
- `data`: ChartData
- `height?`: number
- `showLegend?`: boolean

---

#### `BarChart`
**Uso**: Grafico a barre
**Props**:
- `data`: ChartData
- `height?`: number

---

## 🎨 Design Tokens (CSS Variables)

Già definiti in `frontend/src/styles/tokens.css`:

```css
/* Colors */
--indigo-600: #4F46E5
--sand-50: #F2EDE4
--success-600: #16A34A
--border-200: #E5E7EB
--ink-900: #111827

/* Spacing */
--px: 24px
--gap-card: 16px
--gap-block: 24px

/* Typography */
--font-family-latin: Inter, system-ui, ...
--h1-size: 40px
--body-size: 16px

/* Layout */
--container-max: 1200px
--radius: 12px
```

---

## 📦 Struttura File Componenti

```
frontend/src/
├── components/
│   ├── ui/                    # Componenti base (Design System)
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Card.jsx
│   │   ├── Select.jsx
│   │   ├── Badge.jsx
│   │   ├── Modal.jsx
│   │   ├── Table.jsx
│   │   ├── Skeleton.jsx
│   │   └── ...
│   │
│   ├── layout/                # Layout components
│   │   ├── RootLayout.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   ├── PageHeader.jsx     # Header pagina
│   │   ├── SectionHeader.jsx  # Header sezione
│   │   └── Breadcrumbs.jsx
│   │
│   ├── wizard/                # Wizard/Stepper components
│   │   ├── Stepper.jsx
│   │   └── WizardContainer.jsx
│   │   # NOTA: WizardStep.jsx generico NON necessario
│   │   # Ogni wizard concreto passa ReactNode direttamente
│   │
│   ├── resources/             # Resource selection
│   │   ├── ResourceSelector.jsx
│   │   ├── ResourceSelectorInline.jsx
│   │   ├── BrickSelector.jsx
│   │   └── CreateResourceModal.jsx
│   │
│   ├── setup/                 # Setup/Checklist
│   │   ├── SetupChecklist.jsx # Riusa BrickCard
│   │   ├── BrickCard.jsx      # Usato sia in wizard che checklist
│   │   └── SetupWizard.jsx
│   │
│   ├── campaigns/             # Campaign-specific
│   │   ├── CampaignStatusBanner.jsx
│   │   └── CampaignFilters.jsx
│   │   # NOTA: CampaignList è una pagina, non un componente
│   │   # Usa DataTable con columns/filters config
│   │
│   ├── calls/                 # Calls-specific
│   │   ├── CallFilters.jsx
│   │   └── CallDetail.jsx
│   │   # NOTA: CallList è una pagina, non un componente
│   │   # Usa DataTable con columns/filters config
│   │
│   └── stats/                 # KPI/Stats
│       ├── StatCard.jsx       # Unico componente flessibile
│       └── StatGrid.jsx
│       # NOTA: KPICard NON necessario - usa StatCard con variant
```

---

## 🔗 Dipendenze Componenti

```
RootLayout
├── Sidebar
├── Header (con WorkspaceSelector)
├── Breadcrumbs
└── Main Content
    ├── Dashboard
    │   ├── SetupChecklist
    │   ├── StatGrid
    │   │   └── StatCard
    │   └── CallList
    │
    ├── Setup Wizard
    │   ├── Stepper
    │   └── WizardContainer
    │       ├── BrickCard (x4)
    │       └── CreateResourceModal
    │
    ├── Campaigns
    │   ├── CampaignList (DataTable)
    │   └── CampaignDetail
    │       ├── CampaignStatusBanner
    │       ├── BrickSelector
    │       └── CampaignResults (tabs)
    │
    └── Calls
        ├── CallFilters (FilterBar)
        └── CallList (DataTable)
```

---

## ✅ Priorità Implementazione

**Fase 1: Base (MVP)**
- ✅ `Button`, `Input`, `Card` (già esistenti)
- ✅ `Badge`, `Modal`
- ✅ `Table`, `DataTable`
- ✅ `Skeleton`, `LoadingSpinner`
- ✅ `EmptyState`

**Fase 2: Setup & Wizard**
- `Stepper`, `WizardContainer`
- `SetupChecklist`, `BrickCard`
- `ResourceSelector`, `BrickSelector`

**Fase 3: Inline Creation**
- `CreateResourceModal`
- `ResourceSelectorInline`

**Fase 4: Advanced**
- `FilterBar`, `Filter`
- `StatCard`, `StatGrid`
- Charts (se necessario)

---

## 📘 TypeScript Types / Domain Model

⚠️ **IMPORTANTE**: Quando implementi i componenti dominio, **non usare `any`**. Crea tipi TypeScript specifici per ogni risorsa.

### **Domain Types**

Definisci i tipi in `frontend/src/types/` o `@/types`:

```typescript
// types/resources.ts

export interface Agent {
  id: string;
  name: string;
  status: "active" | "disabled";
  language: string;
  voice: string;
  instructions?: string;
  // ...
}

export interface KnowledgeBase {
  id: number;
  name: string;
  status: "syncing" | "ready" | "error";
  document_count?: number;
  // ...
}

export interface PhoneNumber {
  id: number;
  e164: string;
  status: "pending" | "active" | "suspended" | "error";
  country: string;
  type?: "local" | "toll-free" | "mobile";
  // ...
}

export interface LeadList {
  id: number;
  name: string;
  lead_count: number;
  // ...
}

export type ResourceType = "agent" | "knowledge" | "number" | "lead-list";

export type ResourceMap = {
  agent: Agent;
  knowledge: KnowledgeBase;
  number: PhoneNumber;
  "lead-list": LeadList;
};

export type ResourceIdMap = {
  agent: Agent["id"];        // string
  knowledge: KnowledgeBase["id"];  // number
  number: PhoneNumber["id"];       // number
  "lead-list": LeadList["id"];     // number
};
```

### **Componenti Type-Safe**

Usa i tipi nei componenti:

```typescript
// components/resources/ResourceSelector.tsx

interface ResourceSelectorProps<T extends ResourceType> {
  type: T;
  value: ResourceIdMap[T] | null;
  onChange: (value: ResourceIdMap[T] | null) => void;
  filter?: (resource: ResourceMap[T]) => boolean;
  showCreate?: boolean;
  onCreateClick?: () => void;
}

export function ResourceSelector<T extends ResourceType>(
  props: ResourceSelectorProps<T>
) {
  // `value` è ora type-safe: string se type="agent", number se type="knowledge"/"number"/"lead-list"
  // ...
}
```

### **Benefici**

- ✅ **Type Safety**: `ResourceSelector<"agent">` sa che `value` è `string | null`, non generico
- ✅ **Autocomplete**: IDE suggerisce proprietà corrette per tipo risorsa
- ✅ **Refactoring**: Cambi al tipo si propagano automaticamente
- ✅ **DX (Developer Experience)**: Codice più mantenibile, meno bug

**Pattern**: Non cambia la UX, ma la DX sì - il codice è più sicuro e facile da mantenere.

