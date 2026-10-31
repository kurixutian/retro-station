# Graph Report - Retro Station  (2026-10-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 70 nodes · 93 edges · 11 communities (6 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App.tsx
- compilerOptions
- package.json
- RetroAudioSynth
- devDependencies
- dependencies
- main.tsx
- scripts
- vite

## God Nodes (most connected - your core abstractions)
1. `App()` - 15 edges
2. `RetroAudioSynth` - 10 edges
3. `compilerOptions` - 9 edges
4. `createEmptySlotsForGame()` - 4 edges
5. `createInitialEngineState()` - 3 edges
6. `createPrepopulatedThumbnail()` - 3 edges
7. `react` - 3 edges
8. `scripts` - 3 edges
9. `buildSrmBuffer()` - 2 edges
10. `decodeSaveStateBinary()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (11 total, 5 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.24
Nodes (13): lucide-react, App(), buildSrmBuffer(), CORE_MAP, createEmptySlotsForGame(), createInitialEngineState(), createPrepopulatedThumbnail(), decodeSaveStateBinary() (+5 more)

### Community 1 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 2 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, type, autoprefixer, postcss, tailwindcss, @types/react, @types/react-dom (+1 more)

### Community 4 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, autoprefixer, postcss, tailwindcss, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 5 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, lucide-react, react, react-dom

### Community 7 - "scripts"
Cohesion: 0.67
Nodes (3): scripts, build, dev

## Knowledge Gaps
- **6 isolated node(s):** `autoprefixer`, `postcss`, `tailwindcss`, `@types/react`, `@types/react-dom` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 39 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **What connects `autoprefixer`, `postcss`, `tailwindcss` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Why does `react` connect `main.tsx` to `App.tsx`, `package.json`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `App.tsx` to `package.json`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._