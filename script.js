// ==========================================
// 1. НАСТРОЙКИ И ИНИЦИАЛИЗАЦИЯ ДАННЫХ
// ==========================================
const SHEET_ID = '1YsoKkkq9ye97fUZviG-qgXUnEFgmiFjbotWsaDBjPZw';
const MENU_API_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

// ВСТАВЬ СЮДА СВОЙ РЕАЛЬНЫЙ URL ИЗ МОДУЛЯ WEBHOOKS В MAKE!
const MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/2xklgc3wggb286ae3y5rydx7e1uehfzt'; 
// Ссылка на Wolt (замените на нужную)
const WOLT_URL = 'https://wolt.com/he/isr/holon/restaurant/твоя-пиццерия'; 

const BASE_CONSTRUCTOR_PRICE = 40; // Базовая цена пустой пиццы-основы
let cart = JSON.parse(localStorage.getItem('pizza_cart')) || [];

// ==========================================
// 2. ДИНАМИЧЕСКАЯ ЗАГРУЗКА МЕНЮ ИЗ GOOGLE
// ==========================================
async function loadMenu() {
    const menuGrid = document.querySelector('.menu-grid');
    if (!menuGrid) return;
    
    try {
        const response = await fetch(MENU_API_URL);
        if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
        
        const csvText = await response.text();
        const lines = csvText.split('\n').map(line => 
            line.split('","').map(item => item.replace(/^"|"$/g, '').trim())
        );
        
        const headers = lines[0];
        const jsonArray = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i][0] || lines[i].length < headers.length) continue;
            const obj = {};
            headers.forEach((header, index) => { obj[header] = lines[i][index]; });
            jsonArray.push(obj);
        }
        
        menuGrid.innerHTML = '';
        
        const constructorCard = document.createElement('div');
        constructorCard.className = 'menu-item';
        constructorCard.style.border = '1px dashed #1a1a1a';
        constructorCard.innerHTML = `
            <div class="menu-item-image" style="background-color: #1a1a1a; color: #fff; font-size: 24px;">🛠️</div>
            <div class="menu-item-info">
                <span class="menu-item-title" style="font-weight: 700;">Собери свою пиццу</span>
                <span class="menu-item-price">от ${BASE_CONSTRUCTOR_PRICE} ₪</span>
            </div>
            <p class="menu-item-description">Выбирай размер, основу, добавляй любимые сыры, мясо и овощи. Сделай свой идеальный микс.</p>
            <button class="btn btn-sm" id="open-constructor-btn" style="width: 100%; text-align: center; cursor: pointer; background: #fff; color: #1a1a1a; border: 1px solid #1a1a1a;">
                Открыть конструктор
            </button>
        `;
        menuGrid.appendChild(constructorCard);
        document.getElementById('open-constructor-btn').addEventListener('click', openConstructorModal);

        const activePizzas = jsonArray.filter(pizza => {
            if (!pizza.available) return false;
            const val = String(pizza.available).toUpperCase().trim();
            return val.includes('TRUE') || val === '1' || val === 'ДА';
        });

        const pizzasToRender = activePizzas.length > 0 ? activePizzas : jsonArray;
        
        pizzasToRender.forEach(pizza => {
            const itemElement = document.createElement('div');
            itemElement.className = 'menu-item';
            let imageHTML = `<div class="menu-item-image">[ Фото: ${pizza.name} ]</div>`;
            if (pizza.image && pizza.image.startsWith('http') && !pizza.image.includes('ссылка')) {
                imageHTML = `<div class="menu-item-image" style="padding: 0; overflow: hidden;"><img src="${pizza.image.trim()}" alt="${pizza.name}" style="width:100%; height:100%; object-fit:cover;"></div>`;
            }
            itemElement.innerHTML = `
                ${imageHTML}
                <div class="menu-item-info">
                    <span class="menu-item-title">${pizza.name}</span>
                    <span class="menu-item-price">${pizza.price} ₪</span>
                </div>
                <p class="menu-item-description">${pizza.description || 'Классическая пицца'}</p>
                <button class="btn btn-sm add-to-cart-btn" data-id="${pizza.id}" data-name="${pizza.name}" data-price="${pizza.price}" style="border: none; cursor: pointer; width: 100%; text-align: center;">
                    В корзину
                </button>
            `;
            menuGrid.appendChild(itemElement);
        });
        initMenuEvents();
    } catch (error) {
        console.error('Не удалось загрузить меню:', error);
    }
}

function initMenuEvents() {
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            addToCart(e.target.getAttribute('data-id'), e.target.getAttribute('data-name'), parseFloat(e.target.getAttribute('data-price')));
        });
    });
}

// ==========================================
// 3. ЛОГИКА РАБОТЫ КОНСТРУКТОРА ПИЦЦЫ
// ==========================================
function openConstructorModal() {
    const modal = document.getElementById('constructor-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('close-constructor-btn').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    calculateConstructorPrice();
}

function calculateConstructorPrice() {
    let price = BASE_CONSTRUCTOR_PRICE;
    const sizeRadio = document.querySelector('input[name="pizza-size"]:checked');
    if (sizeRadio) price += parseFloat(sizeRadio.getAttribute('data-price') || 0);
    document.querySelectorAll('input[name="pizza-topping"]:checked').forEach(cb => {
        price += parseFloat(cb.getAttribute('data-price') || 0);
    });
    document.getElementById('constructor-total-price').innerText = `${price} ₪`;
    return price;
}

function handleConstructorSubmit(e) {
    e.preventDefault();
    const size = document.querySelector('input[name="pizza-size"]:checked').value;
    const sauce = document.querySelector('input[name="pizza-sauce"]:checked').value;
    const toppings = [];
    document.querySelectorAll('input[name="pizza-topping"]:checked').forEach(cb => toppings.push(cb.value));
    const notes = document.getElementById('constructor-notes').value.trim();
    const finalPrice = calculateConstructorPrice();
    const toppingsStr = toppings.length > 0 ? ` + ${toppings.join(', ')}` : '';
    const notesStr = notes ? ` [Прим: ${notes}]` : '';
    cart.push({
        id: 'CUSTOM-' + Date.now(),
        name: `Кастом (${size}, ${sauce} соус${toppingsStr})${notesStr}`,
        price: finalPrice,
        quantity: 1
    });
    document.getElementById('constructor-modal').style.display = 'none';
    document.getElementById('pizza-constructor-form').reset();
    updateCart();
}

// ==========================================
// 4. ФУНКЦИОНАЛ КОРЗИНЫ
// ==========================================
function toggleAddressField() {
    const type = document.getElementById('modal-type').value;
    const addrContainer = document.getElementById('address-container');
    if (addrContainer) addrContainer.style.display = (type === 'Доставка') ? 'block' : 'none';
}

function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) existing.quantity += 1;
    else cart.push({ id, name, price, quantity: 1 });
    updateCart();
}

window.changeQuantity = function(id, delta) {
    const item = cart.find(item => item.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(item => item.id !== id);
    updateCart();
};

function updateCart() {
    localStorage.setItem('pizza_cart', JSON.stringify(cart));
    renderCartWidget();
}

function renderCartWidget() {
    let widget = document.getElementById('cart-widget');
    if (cart.length === 0) { if (widget) widget.remove(); return; }
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'cart-widget';
        widget.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: #1a1a1a; padding: 20px; border: 1px solid #333; max-width: 360px; width: calc(100% - 40px); z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.15);`;
        document.body.appendChild(widget);
    }
    let totalItems = 0, totalPrice = 0, itemsHTML = '';
    cart.forEach(item => {
        totalItems += item.quantity;
        totalPrice += item.price * item.quantity;
        itemsHTML += `
            <div style="display: flex; justify-content: space-between; align-items: top; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #fff; font-weight: 300; padding-right: 10px; text-align: left; display: block; max-width: 200px;">${item.name} x${item.quantity}</span>
                <div style="display: flex; align-items: center; gap: 10px; white-space: nowrap;">
                    <span style="color: #ccc;">${item.price * item.quantity} ₪</span>
                    <button onclick="changeQuantity('${item.id}', -1)" style="background: #333; color: #fff; border: none; width: 20px; height: 20px; cursor: pointer;">-</button>
                    <button onclick="changeQuantity('${item.id}', 1)" style="background: #333; color: #fff; border: none; width: 20px; height: 20px; cursor: pointer;">+</button>
                </div>
            </div>
        `;
    });
    widget.innerHTML = `
        <h4 style="color: #fff; text-transform: uppercase; letter-spacing: 1px; font-size: 14px; margin-bottom: 15px; font-weight: 500; border-bottom: 1px solid #333; padding-bottom: 5px;">Корзина (${totalItems})</h4>
        <div style="max-height: 180px; overflow-y: auto; margin-bottom: 15px; padding-right: 5px;">${itemsHTML}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-top: 1px solid #333; padding-top: 10px;">
            <span style="color: #fff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Итого:</span>
            <span style="color: #fff; font-weight: 600; font-size: 16px;">${totalPrice} ₪</span>
        </div>
        <button id="checkout-btn" style="width: 100%; background: #fff; color: #1a1a1a; border: none; padding: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; cursor: pointer;">Оформить заказ</button>
    `;
    document.getElementById('checkout-btn').addEventListener('click', openOrderModal);
}

// ==========================================
// 5. ОТПРАВКА ИТОГОВОГО ЗАКАЗА В MAKE
// ==========================================
function openOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('close-modal-btn').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
}

async function sendOrderToMake(e) {
    e.preventDefault(); 
    if (cart.length === 0) return;
    
    const nameValue = document.getElementById('modal-name').value;
    const phoneValue = document.getElementById('modal-phone').value;
    const typeValue = document.getElementById('modal-type').value; 
    const addressValue = document.getElementById('modal-address') ? document.getElementById('modal-address').value : '';
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // --- НОВАЯ ЛОГИКА: Перенаправление на Wolt ---
    if (typeValue === 'Wolt') {
        window.location.href = WOLT_URL;
        return;
    }

    // --- НОВАЯ ЛОГИКА: Проверка минимальной суммы ---
    if (typeValue === 'Доставка' && totalPrice < 80) {
        alert('Минимальная сумма заказа для доставки — 80 ₪');
        return;
    }
    
    const orderPayload = {
        clientName: nameValue,
        phone: phoneValue,
        type: (typeValue === 'Доставка') ? `Доставка: ${addressValue}` : 'Самовывоз',
        items: cart.map(item => `${item.name} (x${item.quantity})`).join('; '),
        total: totalPrice
    };
    
    const submitBtn = document.getElementById('modal-submit-btn');
    
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'ОБРАБОТКА...';
            submitBtn.style.background = '#666';
        }
        
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        
        if (response.ok) {
            const modalInner = document.getElementById('modal-order-form').parentElement;
            modalInner.innerHTML = `
                <h3 style="text-transform: uppercase; letter-spacing: 2px; font-size: 18px; margin-bottom: 15px; font-weight: 500; text-align: center;">Спасибо за заказ!</h3>
                <p style="text-align: center; font-size: 14px; color: #666;">Данные переданы на кухню.</p>
                <button onclick="document.getElementById('order-modal').style.display='none'; location.reload();" class="btn" style="width: 100%; margin-top: 25px; cursor: pointer;">Закрыть</button>
            `;
            cart = [];
            localStorage.removeItem('pizza_cart');
            updateCart();
        } else {
            throw new Error('Ошибка вебхука');
        }
    } catch (error) {
        console.error(error);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'ПОДТВЕРДИТЬ ЗАКАЗ';
            submitBtn.style.background = '#1a1a1a';
        }
        alert('Ошибка соединения. Пожалуйста, проверьте URL вебхука в коде.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadMenu();       
    renderCartWidget();     
    
    const modalForm = document.getElementById('modal-order-form');
    if (modalForm) modalForm.addEventListener('submit', sendOrderToMake);
    
    const pizzaForm = document.getElementById('pizza-constructor-form');
    if (pizzaForm) {
        pizzaForm.addEventListener('change', calculateConstructorPrice);
        pizzaForm.addEventListener('submit', handleConstructorSubmit);
    }
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
});