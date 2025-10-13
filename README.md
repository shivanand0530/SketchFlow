# SketchFlow

A web-based drawing application for creating shapes, diagrams, and notes with real-time canvas interaction.

## Features

- Drawing tools: circles, rectangles, points, polygons, polylines
- Text notes with positioning
- Color customization for all elements
- Pan and zoom navigation
- Auto-save functionality
- Undo/redo operations
- Shape selection and manipulation

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- pnpm, npm, or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   pnpm install
   ```

3. Start the development server:
   ```
   pnpm run dev
   ```

4. Open your browser and navigate to the local development URL

### Building for Production

```
pnpm run build
```

## Usage

### Drawing Tools

- **Select**: Click to select and move shapes
- **Circle**: Click and drag to create circles
- **Rectangle**: Click and drag to create rectangles  
- **Point**: Click to place individual points
- **Polygon**: Click to add points, press Enter to complete
- **Polyline**: Click to add points, press Enter to complete
- **Note**: Click to place text annotations

### Navigation

- **Pan**: Shift + drag or middle mouse button
- **Zoom**: Mouse wheel
- **Delete**: Select shape and press Delete key
- **Undo/Redo**: Ctrl+Z / Ctrl+Y

### Auto-save

All drawings are automatically saved to browser local storage and restored on page reload.

## Technology Stack

- React 19
- TypeScript
- Redux Toolkit
- Vite
- Tailwind CSS
- Radix UI components

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── CanvasRenderer.tsx
│   ├── CanvasToolbar.tsx
│   └── NoteDialog.tsx
├── pages/              # Page components
├── store/              # Redux store and slices
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── types/              # TypeScript type definitions
```

## Development

### Available Scripts

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier