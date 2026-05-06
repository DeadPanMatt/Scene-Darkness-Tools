/* version 1.0.0 */
const MODULE_ID = "scene-darkness-tools";

const DEFAULT_PRESETS = [
  { name: "Dawn",  value: 0.2  },
  { name: "Noon",  value: 0    },
  { name: "Dusk",  value: 0.85 },
  { name: "Night", value: 1    }
];


let _previousDarkness = null;

class ManagePresetsMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "scene-darkness-manage-presets",
    window: { title: "Manage Presets" }
  };

  async render() {
    await openManagePresetsDialog();
    return this;
  }
}

class CreateMacrosMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "scene-darkness-create-macros",
    window: { title: "Create Sample Macros" }
  };

  async render() {
    await createSampleMacros();
    return this;
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "presets", {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_PRESETS
  });

  game.settings.registerMenu(MODULE_ID, "managePresets", {
    name: "SCENE-DARKNESS-TOOLS.SettingsMenuName",
    label: "SCENE-DARKNESS-TOOLS.SettingsMenuLabel",
    hint: "SCENE-DARKNESS-TOOLS.SettingsMenuHint",
    icon: "fa-solid fa-circle-half-stroke",
    type: ManagePresetsMenu,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "createMacros", {
    name: "SCENE-DARKNESS-TOOLS.CreateMacrosName",
    label: "SCENE-DARKNESS-TOOLS.CreateMacrosLabel",
    hint: "SCENE-DARKNESS-TOOLS.CreateMacrosHint",
    icon: "fa-solid fa-scroll",
    type: CreateMacrosMenu,
    restricted: true
  });

  game.keybindings.register(MODULE_ID, "openDialog", {
    name: "SCENE-DARKNESS-TOOLS.KeybindOpenDialog",
    hint: "SCENE-DARKNESS-TOOLS.KeybindOpenDialogHint",
    editable: [],
    onDown: () => { openDarknessDialog(); return true; },
    restricted: true
  });

  game.keybindings.register(MODULE_ID, "undoDarkness", {
    name: "SCENE-DARKNESS-TOOLS.KeybindUndo",
    hint: "SCENE-DARKNESS-TOOLS.KeybindUndoHint",
    editable: [],
    onDown: () => { undoDarkness(); return true; },
    restricted: true
  });
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = {
    /**
     * Set scene darkness with an optional animated transition.
     * @param {number} value       Darkness level 0 (brightest) – 1 (darkest)
     * @param {number} [seconds=0] Transition duration in seconds
     */
    setDarkness: (value, seconds = 0) => applyDarkness(value, seconds),

    undoDarkness: () => undoDarkness(),

    openDialog: () => openDarknessDialog()
  };
});


Hooks.on("getSceneControlButtons", (controls) => {
  controls.lighting.tools.darknessTools = {
    name: "darknessTools",
    title: "SCENE-DARKNESS-TOOLS.DialogTitle",
    icon: "fa-solid fa-circle-half-stroke",
    order: Object.keys(controls.lighting.tools).length,
    button: true,
    visible: game.user.isGM,
    onClick: () => openDarknessDialog()
  };
});

async function openDarknessDialog() {
  if (!canvas.scene) {
    ui.notifications.warn(game.i18n.localize("SCENE-DARKNESS-TOOLS.NoActiveScene"));
    return;
  }

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: game.i18n.localize("SCENE-DARKNESS-TOOLS.DialogTitle")
    },
    content: buildDarknessDialogContent(),
    render: (event, html) => {
      const darknessSlider    = document.querySelector('input[name="darknessLevel"]');
      const darknessReadout   = document.querySelector("#darkness-readout");
      const transitionSlider  = document.querySelector('input[name="transitionSeconds"]');
      const transitionReadout = document.querySelector("#transition-readout");

      if (!darknessSlider || !transitionSlider) return;

      // Slider → readout
      darknessSlider.addEventListener("input", () => {
        darknessReadout.value = Number(darknessSlider.value).toFixed(2);
      });
      transitionSlider.addEventListener("input", () => {
        transitionReadout.value = transitionSlider.value;
      });

      // Readout → slider (manual entry)
      darknessReadout.addEventListener("input", () => {
        darknessSlider.value = Math.max(0, Math.min(1, Number(darknessReadout.value)));
      });
      transitionReadout.addEventListener("input", () => {
        transitionSlider.value = Math.max(0, Math.min(30, Number(transitionReadout.value)));
      });

      // Preset buttons — snap the darkness slider to a preset value
      document.querySelectorAll(".preset-buttons button").forEach((button) => {
        button.addEventListener("click", () => {
          darknessSlider.value = Number(button.dataset.value);
          darknessSlider.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });

      document.querySelector("#manage-presets-btn")
        ?.addEventListener("click", () => openManagePresetsDialog());
    }
  });

  if (!result) return;
  await handleDarknessUpdate(result);
}

function buildDarknessDialogContent() {
  const currentDarkness =
    canvas.scene.environment?.darknessLevel ?? canvas.scene.darkness ?? 0;

  const savedTransition = canvas.scene.getFlag(MODULE_ID, "transitionSeconds") ?? 5;

  const presets = game.settings.get(MODULE_ID, "presets");
  const presetButtons = presets
    .map(p => `<button type="button" data-value="${p.value}">${p.name}</button>`)
    .join("");

  return `
    <div class="scene-darkness-tools">
      <div class="preset-buttons">
        ${presetButtons}
      </div>
      <button type="button" id="manage-presets-btn" class="manage-presets-btn">
        <i class="fa-solid fa-pen-to-square"></i> ${game.i18n.localize("SCENE-DARKNESS-TOOLS.EditPresets")}
      </button>

      <div class="form-group">
        <label>${game.i18n.localize("SCENE-DARKNESS-TOOLS.DarknessLevel")}:</label>
        <div class="form-fields">
          <input type="range" name="darknessLevel" min="0" max="1" step="0.01"
            value="${currentDarkness}" autofocus>
          <input type="number" id="darkness-readout" min="0" max="1" step="0.01"
            value="${currentDarkness.toFixed(2)}" style="width: 3rem !important">
        </div>
      </div>
      <p class="darkness-hint">${game.i18n.localize("SCENE-DARKNESS-TOOLS.DarknessHint")}</p>

      <div class="form-group">
        <label>${game.i18n.localize("SCENE-DARKNESS-TOOLS.TransitionTime")}:</label>
        <div class="form-fields">
          <input type="range" name="transitionSeconds" min="0" max="30" step="1"
            value="${savedTransition}">
          <input type="number" id="transition-readout" min="0" max="30" step="1"
            value="${savedTransition}" style="width: 3rem !important">
        </div>
      </div>
      <p class="transition-hint">${game.i18n.localize("SCENE-DARKNESS-TOOLS.TransitionHint")}</p>
    </div>
  `;
}

async function openManagePresetsDialog() {
  const presets = game.settings.get(MODULE_ID, "presets");

  const buildRows = (list) => list.map((p, i) => `
    <div class="preset-row" data-index="${i}">
      <input type="text"   class="preset-name"  value="${p.name}"  placeholder="Name">
      <input type="number" class="preset-value" value="${p.value}" min="0" max="1" step="0.01">
      <button type="button" class="delete-preset" data-index="${i}">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `).join("");

  await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("SCENE-DARKNESS-TOOLS.ManagePresetsTitle") },
    content: `
      <div class="scene-darkness-tools-manage">
        <p class="manage-hint">${game.i18n.localize("SCENE-DARKNESS-TOOLS.ManagePresetsHint")}</p>
        <div id="preset-list">${buildRows(presets)}</div>
        <div class="preset-actions">
          <button type="button" id="add-preset-btn">
            <i class="fa-solid fa-plus"></i> ${game.i18n.localize("SCENE-DARKNESS-TOOLS.AddPreset")}
          </button>
          <button type="button" id="reset-presets-btn">
            <i class="fa-solid fa-rotate-left"></i> ${game.i18n.localize("SCENE-DARKNESS-TOOLS.ResetToDefaults")}
          </button>
        </div>
      </div>
    `,
    ok: {
      label: game.i18n.localize("SCENE-DARKNESS-TOOLS.Save"),
      callback: () => {
        const updated = [];
        document.querySelectorAll(".preset-row").forEach(row => {
          const name  = row.querySelector(".preset-name").value.trim();
          const value = parseFloat(row.querySelector(".preset-value").value);
          if (name && !isNaN(value)) {
            updated.push({ name, value: Math.max(0, Math.min(1, value)) });
          }
        });
        game.settings.set(MODULE_ID, "presets", updated);

        const presetContainer = document.querySelector(".scene-darkness-tools .preset-buttons");
        if (presetContainer) {
          presetContainer.innerHTML = updated
            .map(p => `<button type="button" data-value="${p.value}">${p.name}</button>`)
            .join("");

          const darknessSlider = document.querySelector('input[name="darknessLevel"]');
          if (darknessSlider) {
            presetContainer.querySelectorAll("button").forEach(button => {
              button.addEventListener("click", () => {
                darknessSlider.value = Number(button.dataset.value);
                darknessSlider.dispatchEvent(new Event("input", { bubbles: true }));
              });
            });
          }
        }
      }
    },
    render: (event, html) => {
      const list = document.querySelector("#preset-list");

      list.addEventListener("click", (e) => {
        e.target.closest(".delete-preset")?.closest(".preset-row")?.remove();
      });

      document.querySelector("#add-preset-btn").addEventListener("click", () => {
        const row = document.createElement("div");
        row.className = "preset-row";
        row.innerHTML = `
          <input type="text"   class="preset-name"  placeholder="Name">
          <input type="number" class="preset-value" value="0.5" min="0" max="1" step="0.01">
          <button type="button" class="delete-preset">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        list.appendChild(row);
      });

      document.querySelector("#reset-presets-btn").addEventListener("click", () => {
        list.innerHTML = buildRows(DEFAULT_PRESETS);
      });
    }
  });
}

async function handleDarknessUpdate(result) {
  let darknessLevel = Number(result.darknessLevel);

  if (isNaN(darknessLevel) || darknessLevel < 0 || darknessLevel > 1) {
    darknessLevel = canvas.scene.environment?.darknessLevel ?? 0;
  }

  const transitionSeconds = Number(result.transitionSeconds) || 0;

  await canvas.scene.setFlag(MODULE_ID, "transitionSeconds", transitionSeconds);
  await applyDarkness(darknessLevel, transitionSeconds);
}

async function applyDarkness(darknessLevel, transitionSeconds = 0) {
  if (!canvas.scene) {
    ui.notifications.warn(game.i18n.localize("SCENE-DARKNESS-TOOLS.NoActiveScene"));
    return;
  }

  _previousDarkness = canvas.scene.environment?.darknessLevel ?? canvas.scene.darkness ?? 0;

  await canvas.scene.update(
    { environment: { darknessLevel } },
    { animateDarkness: transitionSeconds * 1000 }
  );
}

async function undoDarkness() {
  if (!canvas.scene) {
    ui.notifications.warn(game.i18n.localize("SCENE-DARKNESS-TOOLS.NoActiveScene"));
    return;
  }
  if (_previousDarkness === null) {
    ui.notifications.info(game.i18n.localize("SCENE-DARKNESS-TOOLS.NothingToUndo"));
    return;
  }

  const current = canvas.scene.environment?.darknessLevel ?? canvas.scene.darkness ?? 0;

  await canvas.scene.update(
    { environment: { darknessLevel: _previousDarkness } },
    { animateDarkness: 0 }
  );

  _previousDarkness = current;
  ui.notifications.info(game.i18n.localize("SCENE-DARKNESS-TOOLS.UndoApplied"));
}

async function createSampleMacros() {
  const api = `game.modules.get("${MODULE_ID}").api`;

  const macros = [
    { name: "Darkness — Dawn",  command: `${api}.setDarkness(0.2, 5);`  },
    { name: "Darkness — Noon",  command: `${api}.setDarkness(0, 5);`    },
    { name: "Darkness — Dusk",  command: `${api}.setDarkness(0.85, 5);` },
    { name: "Darkness — Night", command: `${api}.setDarkness(1, 10);`   },
    { name: "Darkness — Undo",  command: `${api}.undoDarkness();`        }
  ];

  let created = 0;
  for (const m of macros) {
    if (game.macros.getName(m.name)) continue;
    await Macro.create({ name: m.name, type: "script", command: m.command });
    created++;
  }

  const msg = created > 0
    ? game.i18n.format("SCENE-DARKNESS-TOOLS.MacrosCreated", { count: created })
    : game.i18n.localize("SCENE-DARKNESS-TOOLS.MacrosAlreadyExist");

  ui.notifications.info(msg);
}
