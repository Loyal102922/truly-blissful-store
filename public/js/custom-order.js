const form = document.getElementById('customOrderForm');
const message = document.getElementById('message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    message.textContent = 'Submitting request...';

    try {

        const res = await fetch('/custom-order', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (data.success) {

            message.textContent = 'Custom request submitted successfully!';
            message.className = 'mt-5 font-bold text-green-400';

            form.reset();

        } else {

            throw new Error(data.error || 'Submission failed');

        }

    } catch (err) {

        console.error(err);

        message.textContent = 'Failed to submit request.';
        message.className = 'mt-5 font-bold text-red-400';

    }

});