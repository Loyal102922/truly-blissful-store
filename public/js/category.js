async function loadCategoryProducts(category, storageKey) {

    const res = await fetch('/products');
    const products = await res.json();

    const filtered = products.filter(
        p => p.category === category
    );

    const container = document.getElementById('products');

    container.innerHTML = '';

    filtered.forEach(product => {

        container.innerHTML += `
<a
    href="/product.html?id=${product._id}"
    onclick="
        localStorage.setItem('lastCategory','${storageKey}');
        localStorage.setItem('lastScroll', window.scrollY);
    "
    class="block bg-neutral-900 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition"
>

    <img
        src="${product.images?.[0] || ''}"
        alt="${product.name}"
        loading="lazy"
        decoding="async"
        class="w-full h-72 object-cover"
    >

    <div class="p-4">

        <h3 class="font-bold">
            ${product.name}
        </h3>

        <p class="text-orange-400">
            $${product.price}
        </p>

    </div>

</a>
`;
    });

}