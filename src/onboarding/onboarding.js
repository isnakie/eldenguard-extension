// WiseOwl Onboarding Survey
// Stores answers as abstract labels (not free text) in chrome.storage.local.
// Used both as the first-install splash page and as the "edit profile" options page.

const form = document.getElementById("survey-form");
const statusEl = document.getElementById("status");
const skipBtn = document.getElementById("btn-skip");

const ROLE_TEXT = {
  self: {
    q2: "How comfortable are you with computers and technology?",
    q3: "What worries you most online? (Choose all that apply)",
    q4: "How should WiseOwl explain things to you?",
    q5: "Should WiseOwl warn you automatically about risky pages, or only when you ask?",
    techBeginner: "Not very comfortable — I'd like things explained simply",
    techIntermediate: "Somewhat comfortable",
    techAdvanced: "Very comfortable — I understand technical terms",
  },
  caregiver_setup: {
    q2: "How comfortable is the person you're helping with computers and technology?",
    q3: "What worries them most online? (Choose all that apply)",
    q4: "How should WiseOwl explain things to them?",
    q5: "Should WiseOwl warn them automatically about risky pages, or only when asked?",
    techBeginner: "Not very comfortable — things should be explained simply",
    techIntermediate: "Somewhat comfortable",
    techAdvanced: "Very comfortable — understands technical terms",
  },
};

const legends = {
  q2: document.getElementById("q2-legend"),
  q3: document.getElementById("q3-legend"),
  q4: document.getElementById("q4-legend"),
  q5: document.getElementById("q5-legend"),
};

const techLabels = {
  beginner: document.getElementById("tech-beginner-label"),
  intermediate: document.getElementById("tech-intermediate-label"),
  advanced: document.getElementById("tech-advanced-label"),
};

function applyRoleText(role) {
  const t = ROLE_TEXT[role] || ROLE_TEXT.self;
  legends.q2.textContent = `2. ${t.q2}`;
  legends.q3.textContent = `3. ${t.q3}`;
  legends.q4.textContent = `4. ${t.q4}`;
  legends.q5.textContent = `5. ${t.q5}`;
  techLabels.beginner.textContent = t.techBeginner;
  techLabels.intermediate.textContent = t.techIntermediate;
  techLabels.advanced.textContent = t.techAdvanced;
}

form.querySelectorAll('input[name="userRole"]').forEach((input) => {
  input.addEventListener("change", () => applyRoleText(input.value));
});

// Pre-fill if a profile already exists (re-visiting via extension options)
chrome.storage.local.get("userProfile", ({ userProfile }) => {
  if (!userProfile) return;

  for (const [field, value] of Object.entries(userProfile)) {
    if (field === "topConcerns" && Array.isArray(value)) {
      value.forEach((v) => {
        const input = form.querySelector(`input[name="topConcerns"][value="${v}"]`);
        if (input) input.checked = true;
      });
      continue;
    }
    const input = form.querySelector(`input[name="${field}"][value="${value}"]`);
    if (input) input.checked = true;
  }

  applyRoleText(userProfile.userRole);
});

function readProfile() {
  const data = new FormData(form);
  return {
    userRole: data.get("userRole"),
    techLevel: data.get("techLevel"),
    topConcerns: data.getAll("topConcerns"),
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

  if (profile.topConcerns.length === 0) {
    statusEl.textContent = "Please choose at least one option for question 3.";
    statusEl.classList.add("error");
    return;
  }

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
