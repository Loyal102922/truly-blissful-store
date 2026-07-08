const cart = JSON.parse(localStorage.getItem('trulyBlissfulCart')) || [];

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');

const summary = document.getElementById('order-summary');

// Multi-item discount matches the same logic applied server-side in
// create-checkout-session, so the total shown here actually matches
// what the customer was charged.
const totalItems = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
const discountMultiplier = totalItems >= 2 ? 0.95 : 1;

if (sessionId) {

    fetch('/order-details/' + sessionId)
        .then(res => res.json())
        .then(data => {

            console.log('ORDER DETAILS:', data);

            // The order document returns shippingAddress as a top-level
            // field, not nested under a "customer" object.
            const address = data.shippingAddress;

            if (address && (address.line1 || address.city)) {

                const addressDiv = document.createElement('div');

                addressDiv.className =
                    'mt-4 p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-gray-300';

                addressDiv.innerHTML = `
                    <div class="font-bold text-white mb-2">
                        Shipping Address
                    </div>

                    <div>${address.line1 || ''}</div>
                    <div>${address.line2 || ''}</div>
                    <div>
                        ${address.city || ''},
                        ${address.state || ''}
                        ${address.postal_code || ''}
                    </div>
                    <div>${address.country || ''}</div>
                `;

                summary.appendChild(addressDiv);

            }

        })
        .catch(err => console.error('Order details failed:', err));

}

let total = 0;

cart.forEach(item => {

    const lineTotal = item.price * discountMultiplier * (item.qty || 1);
    total += lineTotal;

    const div = document.createElement('div');

    div.className = "border-b border-white/10 py-3";

    div.innerHTML = `
        <div class="font-bold">
            ${item.name}
        </div>

        <div class="text-sm text-gray-400">
            ${item.size || 'Standard'} /
            ${item.color || 'Standard'}
        </div>

        <div class="text-orange-400">
            $${(item.price * discountMultiplier).toFixed(2)} × ${item.qty || 1}
        </div>
    `;

    summary.appendChild(div);

});

if (discountMultiplier < 1) {
    const discountNote = document.createElement('p');
    discountNote.className = "text-orange-400 text-sm mt-2";
    discountNote.textContent = "5% multi-item discount applied";
    summary.appendChild(discountNote);
}

const totalDiv = document.createElement('div');

totalDiv.className = "pt-4 font-bold text-xl";

totalDiv.innerHTML = `Total: $${total.toFixed(2)}`;

summary.appendChild(totalDiv);

localStorage.removeItem('trulyBlissfulCart');