/**
 * ContextPrompt AI - Onboarding Script
 */

let currentStep = 0;
const totalSteps = 3;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ob-next').addEventListener('click', nextStep);
  document.getElementById('ob-skip').addEventListener('click', finish);
});

function nextStep() {
  if (currentStep >= totalSteps - 1) {
    finish();
    return;
  }
  currentStep++;
  updateUI();
}

function updateUI() {
  // Update slides
  document.querySelectorAll('.ob-slide').forEach(s => s.classList.remove('active'));
  const slide = document.querySelector(`.ob-slide[data-step="${currentStep}"]`);
  if (slide) slide.classList.add('active');

  // Update dots
  document.querySelectorAll('.ob-dot').forEach(d => d.classList.remove('active'));
  const dot = document.querySelector(`.ob-dot[data-step="${currentStep}"]`);
  if (dot) dot.classList.add('active');

  // Update button text
  const btn = document.getElementById('ob-next');
  if (currentStep === totalSteps - 1) {
    btn.textContent = chrome.i18n?.getMessage('getStarted') || 'Get Started';
  }
}

function finish() {
  window.close();
}
