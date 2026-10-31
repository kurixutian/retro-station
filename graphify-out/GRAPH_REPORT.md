# Graph Report - Retro Station  (2026-10-31)

## Corpus Check
- Corpus is ~22,253 words - fits in a single context window. You may not need a graph.

## Summary
- 191 nodes · 295 edges · 17 communities (12 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Main Emulator UI and State
- Project Dependencies and Scripts
- GitHub Pages CI/CD Workflow
- Cloud Save Types and Events
- PWA Web App Manifest
- Google OAuth Token Management
- TypeScript Compiler Configuration
- Drive AppData Storage Helpers
- Two-Way Cloud Synchronization Engine
- Cloud Sync Architecture and Rationale
- PWA Shell and Visual Branding
- Local Save Metadata and Debounce
- Service Worker and Offline Cache
- Drive Files Enumeration
- Mobile Viewport Meta

## God Nodes (most connected - your core abstractions)
1. `App()` - 23 edges
2. `ensureToken()` - 12 edges
3. `executeFullSync()` - 12 edges
4. `RetroAudioSynth` - 10 edges
5. `setStatus()` - 10 edges
6. `syncSingleItem()` - 10 edges
7. `compilerOptions` - 9 edges
8. `normalizeBinaryData()` - 8 edges
9. `uploadToAppData()` - 8 edges
10. `initTokenClient()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `PWA Application Shell` --references--> `PWA 192px Touch Icon`  [EXTRACTED]
  index.html → public/icon-192.png
- `PWA Application Shell` --references--> `Retro Station Gamepad Icon`  [EXTRACTED]
  index.html → public/icon.svg
- `PWA 192px Touch Icon` --semantically_similar_to--> `Retro Station Gamepad Icon`  [INFERRED] [semantically similar]
  public/icon-192.png → public/icon.svg
- `PWA 192px Touch Icon` --semantically_similar_to--> `PWA 512px Splash Icon`  [INFERRED] [semantically similar]
  public/icon-192.png → public/icon-512.png
- `App()` --calls--> `normalizeBinaryData()`  [EXTRACTED]
  src/App.tsx → src/cloudSync.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cloud Sync Architecture Design Flow** — idk_cloud_sync_plan, idk_base_revision_conflict_detection, idk_silent_token_renewal, idk_appdata_folder_storage [EXTRACTED 1.00]

## Communities (17 total, 5 thin omitted)

### Community 0 - "Main Emulator UI and State"
Cohesion: 0.10
Nodes (29): App(), buildPlayerHtml(), CORE_MAP, coreRatio(), createEmptySlotsForGame(), createInitialEngineState(), createPrepopulatedThumbnail(), DEFAULT_PAD_LAYOUT (+21 more)

### Community 1 - "Project Dependencies and Scripts"
Cohesion: 0.08
Nodes (32): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, devDependencies, autoprefixer@^10.4.20, postcss@^8.4.49, tailwindcss@^3.4.15 (+24 more)

### Community 2 - "GitHub Pages CI/CD Workflow"
Cohesion: 0.08
Nodes (23): environment, runs-on, steps, name, url, jobs, deploy, name (+15 more)

### Community 3 - "Cloud Save Types and Events"
Cohesion: 0.11
Nodes (12): CloudSaveMetadata, CloudSyncStatus, ConflictBackupItem, dataUpdateListeners, DEFAULT_GOOGLE_CLIENT_ID, DriveFileSummary, GoogleUserProfile, initialStoredToken (+4 more)

### Community 4 - "PWA Web App Manifest"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, display_override, icons, name, orientation (+4 more)

### Community 5 - "Google OAuth Token Management"
Cohesion: 0.24
Nodes (13): deleteAllCloudSaves(), ensureToken(), fetchUserProfile(), getGoogleClientId(), getStoredToken(), initTokenClient(), listCloudConflictBackups(), loadGisScript() (+5 more)

### Community 6 - "TypeScript Compiler Configuration"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 7 - "Drive AppData Storage Helpers"
Cohesion: 0.31
Nodes (9): downloadFromAppData(), getOrCreateDeviceId(), keyToFilename(), normalizeBinaryData(), parseDriveApiError(), searchAppDataFile(), syncSingleItem(), uint8ToBase64() (+1 more)

### Community 8 - "Two-Way Cloud Synchronization Engine"
Cohesion: 0.33
Nodes (7): executeFullSync(), filenameToKey(), getCachedUserProfile(), initGlobalSyncListeners(), isSyncableKey(), notifyDataUpdated(), withSyncLock()

### Community 9 - "Cloud Sync Architecture and Rationale"
Cohesion: 0.33
Nodes (6): Drive appDataFolder Storage, Base Revision Conflict Detection, Cloud Sync Architecture Plan, Multi-tab Concurrency Lock, Immediate Local Persistence, Silent Token Renewal

### Community 10 - "PWA Shell and Visual Branding"
Cohesion: 0.67
Nodes (4): PWA Application Shell, PWA 192px Touch Icon, PWA 512px Splash Icon, Retro Station Gamepad Icon

### Community 11 - "Local Save Metadata and Debounce"
Cohesion: 0.50
Nodes (4): getCloudMeta(), markLocalSaveModified(), setCloudMeta(), triggerDebouncedCloudSync()

## Knowledge Gaps
- **7 isolated node(s):** `Base Revision Conflict Detection`, `Silent Token Renewal`, `Drive appDataFolder Storage`, `Multi-tab Concurrency Lock`, `Immediate Local Persistence` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 82 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Project Dependencies and Scripts` to `Main Emulator UI and State`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `App()` (e.g. with `loadPadLayout()` and `.coin()`) actually correct?**
  _`App()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Base Revision Conflict Detection`, `Silent Token Renewal`, `Drive appDataFolder Storage` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Main Emulator UI and State` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Project Dependencies and Scripts` to `Main Emulator UI and State`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `Project Dependencies and Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.07936507936507936 - nodes in this community are weakly interconnected._
- **Why does `App()` connect `Main Emulator UI and State` to `Project Dependencies and Scripts`, `Drive AppData Storage Helpers`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._