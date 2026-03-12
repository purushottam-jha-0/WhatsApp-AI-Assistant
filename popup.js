document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.local.get(['apiKey', 'tone'], (data) => {
    if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
    if (data.tone) document.getElementById('tone').value = data.tone;
  });

  // Save settings
  document.getElementById('saveBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const tone = document.getElementById('tone').value;

    chrome.storage.local.set({ apiKey, tone }, () => {
      const status = document.getElementById('status');
      status.textContent = 'Saved!';
      setTimeout(() => status.textContent = '', 2000);
    });
  });
});