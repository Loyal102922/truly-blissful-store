const cart = JSON.parse(localStorage.getItem('trulyBlissfulCart')) || [];

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');

const summary = document.getElementById('order-summary');

if (sessionId) {

    fetch('/order-details/' + sessionId)
        .then(res => res.json())
        .then(data => {

            console.log('ORDER DETAILS:', data);

            const address = data.customer?.address;

            if (address) {

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

    total += item.price * (item.qty || 1);

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
            $${item.price} × ${item.qty || 1}
        </div>
    `;

    summary.appendChild(div);

});

const totalDiv = document.createElement('div');

totalDiv.className = "pt-4 font-bold text-xl";

totalDiv.innerHTML = `Total: $${total}`;

summary.appendChild(totalDiv);

localStorage.removeItem('trulyBlissfulCart');