# LassanaPata POS - Windows Desktop App
## Built with Tauri 2 + React + TypeScript

A standalone Windows desktop POS application connecting to your existing LassanaPata server.

---

## Setup & Installation

### Step 1: Install Rust

Rust is required to build Tauri apps.

1. Download **rustup** from: https://rustup.rs/
2. Run the installer and follow the prompts (choose default installation)
3. After installation, **restart your terminal**
4. Verify: `rustc --version`

### Step 2: Install Visual Studio C++ Build Tools

Required on Windows for Rust compilation:
1. Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Select **"Desktop development with C++"** workload
3. Restart after installation

### Step 3: Install npm packages

Open a terminal in this folder (`LassanaPata-POS`) and run:

```bash
npm install
```

### Step 4: Generate App Icons

Place a 1024×1024 PNG file named `app-icon.png` in this folder, then run:

```bash
npx tauri icon app-icon.png
```

If you skip this, copy icons from another Tauri project or use:

```bash
mkdir src-tauri\icons
# Then manually add placeholder icons, or run the icon command above
```

### Step 5: Run in Development Mode

Make sure your **LassanaPata Next.js server is running** on port 3000:

```bash
# In your LassanaPata folder:
npm run dev   # or npm start
```

Then in this POS folder, run:

```bash
npm run tauri dev
```

### Step 6: Build for Production

```bash
npm run tauri build
```

The installer will be at: `src-tauri/target/release/bundle/`

---

## Configuration

When you first open the app, log in with your existing LassanaPata credentials.

To change the server URL, click **"⚙ Server: http://localhost:3000"** on the login screen.

---

## Architecture

```
LassanaPata-POS/
├── src/                    # React + TypeScript frontend
│   ├── App.tsx             # Root component (Login → POS)
│   ├── api.ts              # HTTP client → LassanaPata API
│   ├── store.ts            # Zustand state management
│   ├── types.ts            # TypeScript interfaces
│   ├── utils.ts            # Formatting helpers
│   └── components/
│       ├── LoginScreen.tsx      # Authentication screen
│       ├── POSLayout.tsx        # Main layout shell
│       ├── TopBar.tsx           # App header
│       ├── ProductPanel.tsx     # Product catalog (left panel)
│       ├── CategoryBar.tsx      # Category filter tabs
│       ├── ProductCard.tsx      # Individual product card
│       ├── CartPanel.tsx        # Shopping cart (right panel)
│       ├── PaymentModal.tsx     # Payment processing
│       ├── DaySessionModal.tsx  # Day open/close
│       ├── CustomerPicker.tsx   # Customer selection
│       ├── TierDialog.tsx       # Price tier selection
│       ├── ReceiptModal.tsx     # Sale receipt
│       └── ToastContainer.tsx   # Notifications
├── src-tauri/              # Rust / Tauri backend
│   ├── src/main.rs         # Entry point
│   ├── src/lib.rs          # App builder
│   ├── tauri.conf.json     # Tauri configuration
│   └── Cargo.toml          # Rust dependencies
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Features

- ✅ Product catalog with category filtering
- ✅ Real-time product search (by name, SKU, barcode)
- ✅ Shopping cart with quantity controls
- ✅ Price tier support (quantity-based pricing)
- ✅ Order-level discounts (flat or percentage)
- ✅ Payment methods: Cash, Card, Mixed, Credit
- ✅ Cash change calculator with numpad
- ✅ Customer selection
- ✅ Day session management (open/close with cash counts)
- ✅ Sale receipt with print support
- ✅ Stock level indicators
- ✅ Dark theme with modern UI
- ✅ Connects to existing LassanaPata MySQL database (via API)
