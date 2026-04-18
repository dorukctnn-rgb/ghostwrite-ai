chrome.storage.local.get(['email', 'tone'], data => {
  if (data.email) document.getElementById('email').value = data.email;
  if (data.tone)  document.getElementById('tone').value  = data.tone;
});

function save() {
  const email = document.getElementById('email').value;
  const tone  = document.getElementById('tone').value;
  chrome.storage.local.set({ email, tone }, () => {
    const s = document.getElementById('saved');
    s.style.display = 'block';
    setTimeout(() => s.style.display = 'none', 2000);
  });
}
