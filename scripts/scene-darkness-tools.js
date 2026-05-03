const MODULE_ID = "scene-darkness-tools";

// Adds a GM-only button to the Lighting scene controls.
Hooks.on("getSceneControlButtons", (controls) => {
  controls.lighting.tools.darknessTools = {
    name: "darknessTools",
    title: "SCENE-DARKNESS-TOOLS.SetSceneDarkness",
    icon: "fa-solid fa-moon",
    order: Object.keys(controls.lighting.tools).length,
    button: true,
    visible: game.user.isGM,
    onClick: () => openDarknessDialog() // FIXED: was onChange
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
      title: game.i18n.localize("SCENE-DARKNESS-TOOLS.SetSceneDarkness")
    },
    content: buildDarknessDialogContent(),
    render: (html) => {
      // --- Darkness slider setup ---
      const slider = document.querySelector('input[name="darknessLevel"]');
      // ADDED: a live readout span so the user can see the exact darkness value
      const darknessReadout = document.querySelector("#darkness-readout");

      // --- Transition slider setup ---
      const transitionSlider = document.querySelector('input[name="transitionSeconds"]');
      // ADDED: a live readout span for the transition time
      const transitionReadout = document.querySelector("#transition-readout");

      if (!slider || !transitionSlider) return;

      // ADDED: update the darkness readout live as the slider moves
      slider.addEventListener("input", () => {
        darknessReadout.textContent = Number(slider.value).toFixed(2);
      });

      // ADDED: update the transition readout live as the slider moves
      transitionSlider.addEventListener("input", () => {
        transitionReadout.textContent = `${transitionSlider.value}s`;
      });

      // Preset buttons — snap the darkness slider to a preset value
      const buttons = document.querySelectorAll(".preset-buttons button");
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          slider.value = Number(button.dataset.value);
          // Dispatch "input" so the live readout above also updates when a preset is clicked
          slider.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });
    }
  });

  if (!result) return;

  await handleDarknessUpdate(result);
}

function buildDarknessDialogContent() {
  const currentDarkness =
    canvas.scene.environment?.darknessLevel ?? canvas.scene.darkness ?? 0;

  return `
    <div class="scene-darkness-tools">
      <div class="preset-buttons">
        <button type="button" data-value="0.2">Dawn</button>
        <button type="button" data-value="0">Noon</button>
        <button type="button" data-value="0.85">Dusk</button>
        <button type="button" data-value="1">Night</button>
      </div>

      <div class="form-group">
        <label>Darkness Level:</label>
        <div class="form-fields">
          <input
            type="range"
            name="darknessLevel"
            min="0"
            max="1"
            step="0.01"
            value="${currentDarkness}"
            autofocus>
          <!-- ADDED: live readout of the darkness value, initialised to current scene darkness -->
          <span id="darkness-readout">${currentDarkness.toFixed(2)}</span>
        </div>
      </div>

      <div class="form-group">
        <label>Transition Time:</label>
        <div class="form-fields">
          <input
            type="range"
            name="transitionSeconds"
            min="0"
            max="30"
            step="1"
            value="5">
          <!-- CHANGED: was a static "seconds" label. Now shows live value + unit -->
          <span id="transition-readout">5s</span>
        </div>
      </div>
    </div>
  `;
}

// Validates the selected values and updates the scene darkness.
// No changes here — this was already correct!
async function handleDarknessUpdate(result) {
  let darknessLevel = Number(result.darknessLevel);

  if (isNaN(darknessLevel) || darknessLevel < 0 || darknessLevel > 1) {
    darknessLevel = canvas.scene.environment?.darknessLevel ?? 0;
  }

  const transitionSeconds = Number(result.transitionSeconds) || 0;
  const transitionTime = transitionSeconds * 1000;

  await canvas.scene.update(
    { environment: { darknessLevel } },
    { animateDarkness: transitionTime }
  );
}
