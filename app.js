// State
let friends = [];
let items = [];
let currency = '$';
let payerMode = 'single'; // 'single' or 'multiple'
let payments = {}; // { "Name": amount }

// DOM Elements
const friendInput = document.getElementById('friend-name');
const friendsList = document.getElementById('friends-list');
const friendCount = document.getElementById('friend-count');

const itemNameInput = document.getElementById('item-name');
const itemPriceInput = document.getElementById('item-price');
const sharedByGrid = document.getElementById('shared-by-grid');
const itemsList = document.getElementById('items-list');
const itemCount = document.getElementById('item-count');

const payerSelect = document.getElementById('payer-select');
const resultsArea = document.getElementById('results-area');
const totalAmountEl = document.getElementById('total-amount');
const individualSharesEl = document.getElementById('individual-shares');
const debtsEl = document.getElementById('debts-list');

const currencySelect = document.getElementById('currency-select');
const singlePayerContainer = document.getElementById('single-payer-container');
const multiplePayerContainer = document.getElementById('multiple-payer-container');
const payerInputs = document.getElementById('payer-inputs');
const totalPaidDisplay = document.getElementById('total-paid-display');
const paymentStatus = document.getElementById('payment-status');

// Utilities
const formatMoney = (amount) => currency + amount.toFixed(2);
const handleEnter = (e, callback) => {
    if (e.key === 'Enter') callback();
};

// Theme Logic
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Init Theme & Currency
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
}

const savedCurrency = localStorage.getItem('currency');
if (savedCurrency) {
    currency = savedCurrency;
    currencySelect.value = currency;
}

function updateCurrency() {
    currency = currencySelect.value;
    localStorage.setItem('currency', currency);
    renderItems();
    calculateSplits();
}

// Friends Logic
function addFriend() {
    const name = friendInput.value.trim();
    if (!name) return;
    if (friends.includes(name)) {
        alert('Friend already exists!');
        return;
    }

    friends.push(name);
    friendInput.value = '';
    renderFriends();
    updateSharedByGrid();
    updatePayerSelect();
    renderPayerInputs(); // Update multiple payer inputs
    calculateSplits();
}

function removeFriend(index) {
    const name = friends[index];
    friends.splice(index, 1);

    // Remove friend from items they were part of
    items.forEach(item => {
        item.involved = item.involved.filter(f => f.name !== name);
    });

    renderFriends();
    updateSharedByGrid();
    updatePayerSelect();
    renderPayerInputs();
    renderItems();
    calculateSplits();
}

function renderFriends() {
    friendsList.innerHTML = friends.map((friend, index) => `
        <div class="list-item">
            <span>${friend}</span>
            <button class="danger" onclick="removeFriend(${index})" aria-label="Remove ${friend}">
                ✕
            </button>
        </div>
    `).join('');
    friendCount.textContent = `${friends.length} friend${friends.length !== 1 ? 's' : ''}`;
}

// Items Logic
function updateSharedByGrid() {
    if (friends.length === 0) {
        sharedByGrid.innerHTML = '<p class="subtitle" style="font-style: italic;">Add friends first...</p>';
        return;
    }

    // Preserve checked state if possible, or default to all checked
    const currentChecked = Array.from(document.querySelectorAll('.checkbox-label input[type="checkbox"]:checked')).map(i => i.value);

    sharedByGrid.innerHTML = friends.map(friend => {
        const isChecked = currentChecked.length === 0 || currentChecked.includes(friend); // Default to all checked if new item
        return `
        <label class="checkbox-label ${isChecked ? 'checked' : ''}">
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <input type="checkbox" value="${friend}" ${isChecked ? 'checked' : ''}>
                ${friend}
            </div>
            <input type="number" class="share-input" value="1" min="0.1" step="0.1" placeholder="Shares" onclick="event.stopPropagation()">
        </label>
    `}).join('');

    // Re-attach listener for visual toggle
    document.querySelectorAll('.checkbox-label input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.checked) e.target.parentElement.parentElement.classList.add('checked');
            else e.target.parentElement.parentElement.classList.remove('checked');
        });
    });
}

function addItem() {
    const name = itemNameInput.value.trim();
    const price = parseFloat(itemPriceInput.value);

    if (!name || isNaN(price) || price <= 0) {
        alert('Please enter a valid name and price');
        return;
    }

    const involved = [];
    document.querySelectorAll('#shared-by-grid .checkbox-label').forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        const shareInput = label.querySelector('.share-input');

        if (checkbox && checkbox.checked) {
            involved.push({
                name: checkbox.value,
                weight: parseFloat(shareInput.value) || 1
            });
        }
    });

    if (involved.length === 0) {
        alert('Please select at least one friend to share this item');
        return;
    }

    items.push({
        id: Date.now(),
        name,
        price,
        involved
    });

    itemNameInput.value = '';
    itemPriceInput.value = '';
    itemNameInput.focus();

    renderItems();
    calculateSplits();
}

function removeItem(id) {
    items = items.filter(item => item.id !== id);
    renderItems();
    calculateSplits();
}

function renderItems() {
    itemsList.innerHTML = items.map(item => {
        const involvedText = item.involved.map(i =>
            i.weight === 1 ? i.name : `${i.name} (${i.weight}x)`
        ).join(', ');

        return `
        <div class="list-item">
            <div style="flex: 1">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span style="font-weight: 600">${item.name}</span>
                    <span style="font-weight: 600">${formatMoney(item.price)}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Shared by: ${involvedText}
                </div>
            </div>
            <button class="danger" onclick="removeItem(${item.id})" aria-label="Remove ${item.name}">
                ✕
            </button>
        </div>
    `}).join('');
    itemCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
}

// Settlement Logic
function togglePayerMode() {
    const radios = document.getElementsByName('payer-mode');
    for (const radio of radios) {
        if (radio.checked) {
            payerMode = radio.value;
            break;
        }
    }

    if (payerMode === 'single') {
        singlePayerContainer.classList.remove('hidden');
        multiplePayerContainer.classList.add('hidden');
    } else {
        singlePayerContainer.classList.add('hidden');
        multiplePayerContainer.classList.remove('hidden');
        renderPayerInputs();
    }
    calculateSplits();
}

function updatePayerSelect() {
    const currentPayer = payerSelect.value;
    payerSelect.innerHTML = '<option value="">Select Payer</option>' +
        friends.map(f => `<option value="${f}">${f}</option>`).join('');
    if (friends.includes(currentPayer)) {
        payerSelect.value = currentPayer;
    }
}

function renderPayerInputs() {
    payerInputs.innerHTML = friends.map(friend => `
        <div class="list-item">
            <span>${friend}</span>
            <input type="number" class="payment-input" 
                   placeholder="0.00" 
                   step="0.01" 
                   data-friend="${friend}"
                   oninput="calculateSplits()"
                   style="width: 100px; text-align: right;">
        </div>
    `).join('');
}

function calculateSplits() {
    if (items.length === 0) {
        resultsArea.classList.add('hidden');
        return;
    }

    // 1. Calculate Total and Individual Shares (Cost)
    let total = 0;
    const cost = {}; // How much each person SHOULD pay
    friends.forEach(f => cost[f] = 0);

    items.forEach(item => {
        total += item.price;

        const totalWeight = item.involved.reduce((sum, i) => sum + i.weight, 0);
        const costPerWeight = item.price / totalWeight;

        item.involved.forEach(person => {
            if (cost[person.name] !== undefined) {
                cost[person.name] += costPerWeight * person.weight;
            }
        });
    });

    totalAmountEl.textContent = formatMoney(total);

    // 2. Determine who paid what
    const paid = {}; // How much each person ACTUALLY paid
    friends.forEach(f => paid[f] = 0);
    let totalPaid = 0;

    if (payerMode === 'single') {
        const payer = payerSelect.value;
        if (!payer) {
            resultsArea.classList.add('hidden');
            return;
        }
        paid[payer] = total;
        totalPaid = total;
    } else {
        const inputs = document.querySelectorAll('.payment-input');
        inputs.forEach(input => {
            const amount = parseFloat(input.value) || 0;
            paid[input.dataset.friend] = amount;
            totalPaid += amount;
        });

        totalPaidDisplay.textContent = formatMoney(totalPaid);

        const diff = totalPaid - total;
        if (Math.abs(diff) > 0.01) {
            paymentStatus.textContent = diff > 0
                ? `Overpaid by ${formatMoney(diff)}`
                : `Remaining: ${formatMoney(Math.abs(diff))}`;
            paymentStatus.style.color = diff > 0 ? 'var(--success)' : 'var(--danger)';
        } else {
            paymentStatus.textContent = 'Total matches bill amount';
            paymentStatus.style.color = 'var(--success)';
        }
    }

    resultsArea.classList.remove('hidden');

    // Render Individual Shares (Cost)
    individualSharesEl.innerHTML = Object.entries(cost)
        .sort(([, a], [, b]) => b - a)
        .map(([name, amount]) => `
            <div class="list-item" style="background: transparent; border: none; padding: 0.5rem 0;">
                <span>${name}</span>
                <span style="font-weight: 600">${formatMoney(amount)}</span>
            </div>
        `).join('');

    // 3. Calculate Debts (Net Balance)
    // Net = Paid - Cost
    // Positive Net = Owed Money (Creditor)
    // Negative Net = Owes Money (Debtor)

    let debtors = [];
    let creditors = [];

    friends.forEach(f => {
        const net = paid[f] - cost[f];
        if (net < -0.01) debtors.push({ name: f, amount: -net });
        else if (net > 0.01) creditors.push({ name: f, amount: net });
    });

    // Match debtors to creditors
    const debts = [];

    // Sort by amount to minimize transactions (greedy approach)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        const amount = Math.min(debtor.amount, creditor.amount);

        if (amount > 0.01) {
            debts.push({ from: debtor.name, to: creditor.name, amount });
        }

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    debtsEl.innerHTML = debts.length ? debts.map(debt => `
        <div class="list-item" style="border-left: 4px solid var(--danger);">
            <span>
                <span style="font-weight: 600">${debt.from}</span> 
                owes 
                <span style="font-weight: 600">${debt.to}</span>
            </span>
            <span style="font-weight: 700; color: var(--danger)">${formatMoney(debt.amount)}</span>
        </div>
    `).join('') : '<div class="subtitle text-center">No debts to settle!</div>';
}
