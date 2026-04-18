const API_URL = 'https://www.reviewreply.store/generate-ext';

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['email', 'tone'], data => {
      resolve({ email: data.email || '', tone: data.tone || 'friendly' });
    });
  });
}

function injectButton(reviewEl) {
  if (reviewEl.querySelector('.rr-btn')) return;

  const reviewText = reviewEl.innerText.slice(0, 500);

  const btn = document.createElement('button');
  btn.className = 'rr-btn';
  btn.innerHTML = '<span class="rr-dot"></span> Reply with ReviewReply AI';

  btn.addEventListener('click', async () => {
    btn.innerHTML = '<span class="rr-dot"></span> Generating...';
    btn.disabled = true;

    try {
      const { email, tone } = await getSettings();

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: reviewText, email, tone })
      });

      const data = await res.json();

      if (data.reply) {
        const textarea = reviewEl.querySelector('textarea') ||
          reviewEl.closest('[data-reply-container]')?.querySelector('textarea');

        if (textarea) {
          textarea.value = data.reply;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.focus();
        } else {
          let out = reviewEl.querySelector('.rr-output');
          if (!out) {
            out = document.createElement('div');
            out.className = 'rr-output';
            btn.parentNode.insertBefore(out, btn.nextSibling);
          }
          out.innerText = data.reply;
        }
        btn.innerHTML = '<span class="rr-dot rr-green"></span> Done — copy and paste reply above';
        btn.disabled = false;

      } else if (data.upgrade) {
        btn.innerHTML = '<span class="rr-dot rr-yellow"></span> Free limit — upgrade to PRO';
        btn.disabled = false;
        btn.onclick = () => window.open('https://www.reviewreply.store/#pricing', '_blank');
      } else {
        btn.innerHTML = 'Error — try again';
        btn.disabled = false;
      }

    } catch (e) {
      btn.innerHTML = 'Connection error — try again';
      btn.disabled = false;
    }
  });

  reviewEl.appendChild(btn);
}

function scanAndInject() {
  const selectors = [
    '[data-review-id]',
    '.review-container',
    '.UzHbQ',
    '.review-list-item',
    'div[jscontroller] div[data-review-id]'
  ];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => injectButton(el));
  });
}

const observer = new MutationObserver(() => scanAndInject());
observer.observe(document.body, { childList: true, subtree: true });

setTimeout(scanAndInject, 2000);
setTimeout(scanAndInject, 5000);
