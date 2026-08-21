# OpenList Modern UI (v0.0.1)

A sleek, lightweight, and high-performance web frontend for [OpenList](https://github.com/OpenListTeam/OpenList), built from the ground up with modern React 18, Vite, and Tailwind CSS.

![License MIT](https://img.shields.io/badge/license-MIT-green.svg)
![React 18](https://img.shields.io/badge/React-18-blue.svg)
![Vite 6](https://img.shields.io/badge/Vite-6-purple.svg)
![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)

---

## ✨ Features

- 🎨 **Minimalist & Modern Aesthetic**:
  - Crisp glassmorphic design with seamless Dark & Light theme switching.
  - Interactive Grid & List view modes with smooth transitions.
  - Floating bottom batch toolbar with keyboard-first navigation and multi-select.

- ⚡ **High-Performance Transfer Center (`TransferManager`)**:
  - **OPFS-Backed Multi-Thread Streaming**: 4-thread Range chunked downloading powered by Origin Private File System (OPFS) for zero JS-heap memory overflow (Zero-OOM) on gigabyte-sized files.
  - **Queue Scheduling**: Smart concurrency control (max 3 concurrent tasks) with ordered queuing, pause/retry, and real-time speed & byte progress tracking.

- 📦 **Instant Stream Packaging (`client-zip`)**:
  - Multi-file & nested directory package downloading into `.zip` without blocking the main thread or consuming disk bloat.
  - Sticky pinned progress card showing real-time sub-file progress.

- 🎬 **Next-Gen Media & Asset Previews**:
  - **Video / Audio**: Video.js v10 integrated modern player with multi-language i18n and subtitle support.
  - **Documents & Code**: Rich PDF preview, markdown rendering, and syntax-highlighted text/code viewer.
  - **Archives**: In-browser archive file structure browsing (`.zip`, `.tar`, `.rar`, `.7z`).

- 🌐 **Global i18n & Resilience**:
  - Built-in multi-language translation support (Simplified Chinese, Traditional Chinese, English, etc.).
  - 3-tier lifecycle garbage collection (Dynamic TTL + `pagehide` + Startup Sweeper) ensuring zero orphan storage leakage.

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand 5](https://github.com/pmndrs/zustand)
- **UI & Icons**: [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/)
- **Streaming & Packaging**: [client-zip](https://github.com/ToucanToco/client-zip)

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) >= 18.0.0
- [pnpm](https://pnpm.io/) >= 8.0.0

### Development
```bash
# Clone the repository
git clone https://github.com/OpenListTeam/OpenList-Frontend.git
cd OpenList-Frontend/new-ui

# Install dependencies
pnpm install

# Start local dev server
pnpm dev
```

### Production Build
```bash
# Type check and bundle for production
pnpm build

# Preview build artifacts
pnpm preview
```

---

## 📄 License

This project is licensed under the [MIT License](../LICENSE).

## 💖 Credits

[OpenList](https://github.com/OpenListTeam/OpenList) is a community-driven, resilient open-source project. Special thanks to all contributors and the open-source community!
