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

    wrap.innerHTML = '';

    reviews.forEach(review => {

        const stars =
            '★'.repeat(review.rating) +
            '☆'.repeat(5 - review.rating);

        const card = document.createElement('div');

        card.className =
            "bg-neutral-900/60 rounded-2xl p-6 border border-white/10 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/10 transition duration-300";

       card.innerHTML = `<p class="text-orange-400 mb-2">${stars}</p>`;

const reviewText = document.createElement('p');
reviewText.className = 'text-gray-300 text-sm mb-4';
reviewText.textContent = '"' + review.text + '"';
card.appendChild(reviewText);

const reviewName = document.createElement('p');
reviewName.className = 'text-xs text-gray-500 mb-3';
reviewName.textContent = '— ' + review.name;
card.appendChild(reviewName);

const replyHTML = review.reply ? `
  <div class="mt-3 p-3 rounded-xl bg-black/40 border border-orange-500/20">
    <p class="text-orange-400 text-xs font-bold mb-1">TRULY BLISSFUL</p>
    <p class="text-sm text-gray-300"></p>
  </div>` : '';

if (replyHTML) {
  const replyDiv = document.createElement('div');
  replyDiv.innerHTML = replyHTML;
  replyDiv.querySelector('.text-sm.text-gray-300').textContent = review.reply;
  card.appendChild(replyDiv);
}
            ${
                review.reply
                    ? `
                        <div class="mt-3 p-3 rounded-xl bg-black/40 border border-orange-500/20">
                            <p class="text-orange-400 text-xs font-bold mb-1">
                                TRULY BLISSFUL
                            </p>

                            <p class="text-sm text-gray-300">
                                ${review.reply}
                            </p>
                        </div>
                    `
                    : ''
            }
        `;

        wrap.appendChild(card);

    });

}

loadReviews();