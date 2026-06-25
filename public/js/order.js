async function trackOrder() {

    const email = document.getElementById('email').value.trim();
    const result = document.getElementById('result');

    if (!email) {
        alert('Enter your email');
        return;
    }

    result.innerHTML = '<p>Loading order...</p>';

    try {

        const res = await fetch(`/track-order?email=${encodeURIComponent(email)}`);
        const data = await res.json();

        if (!res.ok || !data.order) {

            result.innerHTML =
                '<p class="text-red-500">No order found for this email.</p>';

            return;
        }

        const order = data.order;

        result.innerHTML = `
            <div class="border border-white/20 rounded-2xl p-6">

                <h2 class="text-2xl font-bold mb-4">
                    Order Status
                </h2>

                <p><strong>Status:</strong> ${order.status || 'pending'}</p>

                <p><strong>Tracking:</strong>
                    ${order.trackingNumber || 'Not available yet'}
                </p>

                <p><strong>Total:</strong> $${order.total || 0}</p>

                <div class="mt-6">

                    <strong>Items:</strong>

                    ${(order.cart || []).map(item => `

                        <div class="mt-3 pl-3 border-l border-orange-500">

                            ${item.name} × ${item.qty || 1}<br>

                            ${item.size ? `Size: ${item.size}<br>` : ''}

                            ${item.color ? `Color: ${item.color}` : ''}

                        </div>

                    `).join('')}

                </div>

            </div>
        `;

    } catch {

        result.innerHTML =
            '<p class="text-red-500">Failed to load order.</p>';

    }

}