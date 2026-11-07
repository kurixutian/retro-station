# Retro Pocket (Retro Station)

[![Live Web App](https://img.shields.io/badge/Play%20Now-kurixutian.github.io%2Fretro--station-10b981?style=for-the-badge&logo=github)](https://kurixutian.github.io/retro-station/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support%20Development-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kurixutian)

A tactile, offline-first mobile & web Libretro handheld emulator frontend with automatic core detection, per-game save state slots, customizable on-screen touch controls, CRT/LCD hardware shaders, and private zero-cost Google Drive cloud sync.

## Play Now

**Play in your browser:** [https://kurixutian.github.io/retro-station/](https://kurixutian.github.io/retro-station/)

## Features

- **Multi-System Libretro Cores**: Automatic core matching for Game Boy (`.gb`), Game Boy Color (`.gbc`), Game Boy Advance (`.gba`), NES (`.nes`), Super Nintendo (`.sfc`/`.smc`), and Sega Genesis / Mega Drive (`.md`/`.gen`).
- **Tactile Cartridge Binder & Slot-1 Deck**: Physical cartridge shelf with automatic Libretro boxart resolution, quick cartridge swapping, and 4 isolated save state slots per game.
- **Hardware-Style Touch & Controller Input**: Zero-drop sliding D-pad, customizable & scalable portrait/landscape control layouts (3 saved slots per orientation), haptic feedback, and plug-and-play Bluetooth/USB Gamepad & Keyboard support.
- **CRT & Handheld Shaders**: Combinable scanlines, Game Boy dot-matrix LCD grid, RGB phosphor bloom, Trinitron curved bezel vignette, color accuracy profiles, and true-black AMOLED battery saver mode.
- **Private Cloud Vault & Offline Backups**: Synchronize save states, SRAM battery saves (`.sav` / `.srm`), and library metadata directly to your personal Google Drive `appDataFolder`, or export/restore a single offline `.json` backup file anytime.
- **Flasher-Ready Battery Exports**: Export raw `.sav` (GB Operator / FlashGBX) or `.srm` (RetroArch) battery RAM directly from any cartridge.

## Local Development

```bash
npm install
npm run dev
```

### Build Single-File Production Bundle

```bash
npm run build
npm test
```

## Support the Project

If you enjoy using **Retro Pocket**, consider supporting its development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/kurixutian)

- **Buy Me a Coffee:** [https://buymeacoffee.com/kurixutian](https://buymeacoffee.com/kurixutian)
