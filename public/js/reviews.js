let reviews = [];

async function loadReviews() {
  try {
    const res = await fetch('/reviews');
    const data = await res.json();
    reviews = Array.isArray(data) ? data : [];
    renderReviews();
  } catch (error) {
    console.error('Load reviews failed:', error);
  }
}

function renderReviews() {
  const wrap = document.getElementById('reviews-list');
  if (!wrap) return;

  wrap.innerHTML = '';

  reviews.forEach(review => {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

    const card = document.createElement('div');
    card.className = "bg-neutral-900/60 rounded-2xl p-6 border border-white/10 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/10 transition duration-300";

    const starsEl = document.createElement('p');
    starsEl.className = 'text-orange-400 mb-2';
    starsEl.textContent = stars;
    card.appendChild(starsEl);

    const reviewText = document.createElement('p');
    reviewText.className = 'text-gray-300 text-sm mb-4';
    reviewText.textContent = '"' + review.text + '"';
    card.appendChild(reviewText);
    if (review.image) {
      const reviewImg = document.createElement('img');
      reviewImg.src = review.image;
      reviewImg.alt = 'Customer photo';
      reviewImg.className = 'rounded-xl mb-4 w-full object-cover max-h-64';
      card.appendChild(reviewImg);
    }

    const reviewName = document.createElement('p');
    reviewName.className = 'text-xs text-gray-500 mb-3';
    reviewName.textContent = '— ' + review.name;
    card.appendChild(reviewName);

    if (review.reply) {
      const replyDiv = document.createElement('div');
      replyDiv.className = 'mt-3 p-3 rounded-xl bg-black/40 border border-orange-500/20';

      const replyLabel = document.createElement('p');
      replyLabel.className = 'text-orange-400 text-xs font-bold mb-1';
      replyLabel.textContent = 'TRULY BLISSFUL';

      const replyText = document.createElement('p');
      replyText.className = 'text-sm text-gray-300';
      replyText.textContent = review.reply;

      replyDiv.appendChild(replyLabel);
      replyDiv.appendChild(replyText);
      card.appendChild(replyDiv);
    }

    wrap.appendChild(card);
  });
}

function scrollToReviewForm() {
  document.getElementById('review-form-wrap').scrollIntoView({ behavior: 'smooth' });
}

async function submitReview() {
  const name = document.getElementById('review-name').value.trim();
  const rating = parseInt(document.getElementById('review-rating').value, 10);
  const text = document.getElementById('review-text').value.trim();
  const recaptchaToken = grecaptcha.getResponse(0);

  if (!name || !text) {
    alert('Please add your name and review.');
    return;
  }

  if (!recaptchaToken) {
    alert('Please complete the reCAPTCHA.');
    return;
  }

  const imageFile = document.getElementById('review-image').files[0];
  const formData = new FormData();
  formData.append('name', name);
  formData.append('rating', rating);
  formData.append('text', text);
  formData.append('recaptchaToken', recaptchaToken);
  if (imageFile) formData.append('image', imageFile);

  const res = await fetch('/reviews', { method: 'POST', body: formData });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Failed to submit review.');
    return;
  }

  await loadReviews();
  document.getElementById('review-name').value = '';
  document.getElementById('review-rating').value = '5';
  document.getElementById('review-text').value = '';
  grecaptcha.reset(0);
  alert('Review submitted!');
}

async function sendContactMessage() {
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const subject = document.getElementById('contact-subject').value.trim();
  const message = document.getElementById('contact-message').value.trim();
  const status = document.getElementById('contact-status');
  const recaptchaToken = grecaptcha.getResponse(1);

  status.textContent = '';

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || !email || !message) {
    status.textContent = 'Please fill out your name, email, and message.';
    return;
  }

  if (!emailValid) {
    status.textContent = 'Please enter a valid email address.';
    return;
  }

  if (!recaptchaToken) {
    status.textContent = 'Please complete the reCAPTCHA.';
    return;
  }

  const res = await fetch('/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, subject, message, recaptchaToken })
  });

  const data = await res.json();

  if (!res.ok) {
    status.textContent = data.error || 'Failed to send message.';
    return;
  }

  status.textContent = 'Message sent successfully!';
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-email').value = '';
  document.getElementById('contact-subject').value = '';
  document.getElementById('contact-message').value = '';
  grecaptcha.reset(1);
}

async function joinNewsletter() {
  const email = document.getElementById('newsletter-email').value.trim();
  const status = document.getElementById('newsletter-status');

  if (!email) {
    status.textContent = 'Please enter an email address.';
    return;
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    status.textContent = 'Please enter a valid email address.';
    return;
  }

  try {
    status.textContent = 'Joining...';
    const res = await fetch('/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.error || 'Failed to join newsletter.';
      return;
    }

    status.textContent = 'You are officially part of the movement.';
    document.getElementById('newsletter-email').value = '';
  } catch (err) {
    status.textContent = 'Server connection failed.';
  }
}

loadReviews();