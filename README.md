# Scene Darkness Tools

A Foundry VTT module that gives GMs fine-grained control over scene lighting, with animated transitions and customisable presets.

---

## Features

- **Moon icon button** added to the Lighting controls toolbar (GM only)
- **Darkness slider** with live numeric readout — drag or type a precise value between 0 (brightest) and 1 (darkest)
- **Transition time slider** with live readout — animate darkness changes over 0–30 seconds
- **Customisable presets** — Dawn, Noon, Dusk, and Night ship by default; add, rename, or delete presets to suit your world
- **Per-scene transition memory** — each scene remembers its last-used transition time
- **Manage presets** from the darkness dialog or from Game Settings → Module Settings
- **Reset to Defaults** button to restore the original four presets at any time

---

## Compatibility

| Foundry VTT | Status |
|---|---|
| V14 | Verified |
| V12 – V13 | Supported |

---

## Installation

**Via Manifest URL (recommended):**

1. Open Foundry VTT
2. Go to **Add-on Modules → Install Module**
3. Paste the manifest URL into the field at the bottom:

```
https://raw.githubusercontent.com/DeadPanMatt/scene-darkness-tools/main/module.json
```

4. Click **Install**

**Manual installation:**

Download the latest release zip from [GitHub Releases](https://github.com/DeadPanMatt/scene-darkness-tools/releases) and extract it into your Foundry `Data/modules/` folder.

---

## Usage

1. Enable the module in **Game Settings → Module Management**
2. Load a scene
3. Click the bottom **half light half dark** circle in the Lighting controls toolbar
4. Use the preset buttons or sliders to set your desired darkness level and transition time
5. Click **OK** to apply - the scene will animate to the new darkness level

### Managing Presets

Click **Edit Presets** inside the darkness dialog, or go to **Game Settings → Configure Settings → Module Settings → Scene Darkness Tools** and click **Manage Presets**.

From there you can:
- Edit preset names and values
- Add new presets
- Delete presets
- Reset to the original Dawn / Noon / Dusk / Night defaults

---

## Author

**DeadPanMatt**
[GitHub](https://github.com/DeadPanMatt/scene-darkness-tools)

---

## Licence

This module is provided under the [MIT Licence](https://opensource.org/licenses/MIT).