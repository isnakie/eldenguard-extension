// WiseOwl Onboarding Survey
// Stores answers as abstract labels (not free text) in chrome.storage.local.
// Used both as the first-install splash page and as the "edit profile" options page.

const form = document.getElementById("survey-form");
const statusEl = document.getElementById("status");
const skipBtn = document.getElementById("btn-skip");

// Pre-fill if a profile already exists (re-visiting via extension options)
chrome.storage.local.get("userProfile", ({ userProfile }) => {
  if (!userProfile) return;
  for (const [field, value] of Object.entries(userProfile)) {
    const input = form.querySelector(`input[name="${field}"][value="${value}"]`);
    if (input) input.checked = true;
  }
});

function readProfile() {
  const data = new FormData(form);
  return {
    userRole: data.get("userRole"),
    techLevel: data.get("techLevel"),
    topConcern: data.get("topConcern"),
    explanationStyle: data.get("explanationStyle"),
    warningStyle: data.get("warningStyle"),
  };
}

async function saveProfile(profile) {
  await chrome.storage.local.set({ userProfile: profile, onboardingComplete: true });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const profile = readProfile();

  await saveProfile(profile);
  statusEl.textContent = "Saved! You're all set.";
  statusEl.classList.remove("error");

  // If this was opened as the first-install tab, close it after a moment.
  // If opened as the options page (re-editing), just leave it on the saved state.
  setTimeout(() => window.close(), 1200);
});

skipBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ onboardingComplete: true });
  statusEl.textContent = "Skipped — you can fill this out anytime from the extension's options.";
  statusEl.classList.remove("error");
  setTimeout(() => window.close(), 1500);
});
