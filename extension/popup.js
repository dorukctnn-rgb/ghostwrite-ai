chrome.storage.local.get(['license', 'tone'], data => {
  if (data.license) document.getElementById('license').value = data.license;
  if (data.tone)  document.getElementById('tone').value  = data.tone;
});

document.getElementById('saveBtn').addEventListener('click', save);

function save() {
  const license = document.getElementById('license').value.trim();
  const tone  = document.getElementById('tone').value;
  chrome.storage.local.set({ license, tone }, () => {
    const s = document.getElementById('saved');
    s.style.display = 'block';
    setTimeout(() => s.style.display = 'none', 2000);
  });
}
