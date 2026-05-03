const MODULE_ID = "scene-darkness-tools";

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
    default: [
      { name: "Dawn",  value: 0.2  },
      { name: "Noon",  value: 0    },
      { name: "Dusk",  value: 0.85 },
      { name: "Night", value: 1    }
    ]
  });

  // Adds a "Manage Presets" button inside the Module Settings panel.
  game.settings.registerMenu(MODULE_ID, "managePresets", {
    name: "Darkness Presets",
    label: "Manage Presets",
    hint: "Add, rename, or delete the darkness preset buttons.",
    icon: "fa-solid fa-moon",
    type: ManagePresetsMenu,
    restricted: true
  });
});

// Adds a GM-only button to the Lighting scene controls.
// onClick is deprecated since V13 in favour of onChange, but onChange does not fire reliably for button:true tools. Revisit when V15 approaches.
Hooks.on("getSceneControlButtons", (controls) => {
  controls.lighting.tools.darknessTools = {
    name: "darknessTools",
    title: "SceneDarkness",
    icon: "fa-solid fa-moon",
    order: Object.keys(controls.lighting.tools).length,
    button: true,
    visible: game.user.isGM,
    onClick: () => openDarknessDialog()
  };
});

// Checks if a scene is active, then opens the darkness control dialog.
async function openDarknessDialog() {
  if (!canvas.scene) {
    ui.notifications.warn("No active scene found.");
    return;
  }

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: game.i18n.localize("SceneDarkness")
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
        <i class="fa-solid fa-pen-to-square"></i> Edit Presets
      </button>

      <div class="form-group">
        <label>Darkness Level:</label>
        <div class="form-fields">
          <input type="range" name="darknessLevel" min="0" max="1" step="0.01"
            value="${currentDarkness}" autofocus>
          <input type="number" id="darkness-readout" min="0" max="1" step="0.01"
            value="${currentDarkness.toFixed(2)}" style="width: 3rem !important">
        </div>
      </div>
      <p class="darkness-hint">0 is brightest &nbsp;·&nbsp; 1 is darkest</p>

      <div class="form-group">
        <label>Transition Time:</label>
        <div class="form-fields">
          <input type="range" name="transitionSeconds" min="0" max="30" step="1"
            value="${savedTransition}">
          <input type="number" id="transition-readout" min="0" max="30" step="1"
            value="${savedTransition}" style="width: 3rem !important">
        </div>
      </div>
      <p class="transition-hint">0s is instant &nbsp;·&nbsp; 30s is slowest</p>
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
    window: { title: "Manage Darkness Presets" },
    content: `
      <div class="scene-darkness-tools-manage">
        <p class="manage-hint">Changes apply immediately to the open dialog.</p>
        <div id="preset-list">${buildRows(presets)}</div>
        <button type="button" id="add-preset-btn">
          <i class="fa-solid fa-plus"></i> Add Preset
        </button>
      </div>
    `,
    ok: {
      label: "Save",
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
