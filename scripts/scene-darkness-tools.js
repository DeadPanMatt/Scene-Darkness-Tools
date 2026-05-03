const MODULE_ID = "scene-darkness-tools";

const DEFAULT_PRESETS = [
  { name: "Dawn",  value: 0.2  },
  { name: "Noon",  value: 0    },
  { name: "Dusk",  value: 0.85 },
  { name: "Night", value: 1    }
];

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

// Runs once when Foundry initialises
Hooks.once("init", () => {
  // Stores the preset array. config:false hides it from the normal settings list
  game.settings.register(MODULE_ID, "presets", {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_PRESETS
  });

  // Adds a "Manage Presets" button inside the Module Settings panel.
  game.settings.registerMenu(MODULE_ID, "managePresets", {
    name: "SCENE-DARKNESS-TOOLS.SettingsMenuName",
    label: "SCENE-DARKNESS-TOOLS.SettingsMenuLabel",
    hint: "SCENE-DARKNESS-TOOLS.SettingsMenuHint",
    icon: "fa-solid fa-circle-half-stroke",
    type: ManagePresetsMenu,
    restricted: true
  });
});

// Adds a GM-only button to the Lighting scene controls.
// onClick is deprecated since V13 in favour of onChange, but onChange does not fire reliably for button:true tools. Revisit when V15 approaches.
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

// Checks if a scene is active, then opens the darkness control dialog.
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

  // Load the last-used transition time for this scene, defaulting to 5
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

        // If the main dialog is still open, refresh its preset buttons immediately
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

      // Delete a row when its trash button is clicked
      list.addEventListener("click", (e) => {
        e.target.closest(".delete-preset")?.closest(".preset-row")?.remove();
      });

      // Add a blank row at the bottom
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

      // Replace all rows with the original defaults
      document.querySelector("#reset-presets-btn").addEventListener("click", () => {
        list.innerHTML = buildRows(DEFAULT_PRESETS);
      });
    }
  });
}

// Validates the selected values and updates the scene darkness.
async function handleDarknessUpdate(result) {
  let darknessLevel = Number(result.darknessLevel);

  if (isNaN(darknessLevel) || darknessLevel < 0 || darknessLevel > 1) {
    darknessLevel = canvas.scene.environment?.darknessLevel ?? 0;
  }

  const transitionSeconds = Number(result.transitionSeconds) || 0;
  const transitionTime = transitionSeconds * 1000;

  // Save the transition time so this scene remembers it next time
  await canvas.scene.setFlag(MODULE_ID, "transitionSeconds", transitionSeconds);

  await canvas.scene.update(
    { environment: { darknessLevel } },
    { animateDarkness: transitionTime }
  );
}
