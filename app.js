// State
let friends = [];
let items = [];

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

// Utilities
const formatMoney = (amount) => '$' + amount.toFixed(2);
const handleEnter = (e, callback) => {
    if (e.key === 'Enter') callback();
};

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
    calculateSplits(); // Recalculate if needed
}

function removeFriend(index) {
    const name = friends[index];
    friends.splice(index, 1);
    
    // Remove friend from items they were part of
    items.forEach(item => {
        item.involved = item.involved.filter(f => f !== name);
    });

    renderFriends();
    updateSharedByGrid();
    updatePayerSelect();
    renderItems();
    calculateSplits();
}

function renderFriends() {
    friendsList.innerHTML = friends.map((friend, index) => `
        <div class="list-item">
            <span>${friend}</span>
            <button class="danger" onclick="removeFriend(${index})" style="padding: 0.5rem;">
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
    const currentChecked = Array.from(document.querySelectorAll('.checkbox-label input:checked')).map(i => i.value);
    
    sharedByGrid.innerHTML = friends.map(friend => {
        const isChecked = currentChecked.length === 0 || currentChecked.includes(friend); // Default to all checked if new item
        return `
        <label class="checkbox-label ${isChecked ? 'checked' : ''}" onclick="this.classList.toggle('checked')">
            <input type="checkbox" value="${friend}" ${isChecked ? 'checked' : ''}>
            ${friend}
        </label>
    `}).join('');
    
    // Re-attach listener for visual toggle
    document.querySelectorAll('.checkbox-label input').forEach(input => {
        input.addEventListener('change', (e) => {
            if(e.target.checked) e.target.parentElement.classList.add('checked');
            else e.target.parentElement.classList.remove('checked');
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

    const involved = Array.from(document.querySelectorAll('#shared-by-grid input:checked')).map(cb => cb.value);
    
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
    itemsList.innerHTML = items.map(item => `
        <div class="list-item">
            <div style="flex: 1">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span style="font-weight: 600">${item.name}</span>
                    <span style="font-weight: 600">${formatMoney(item.price)}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Shared by: ${item.involved.join(', ')}
                </div>
            </div>
            <button class="danger" onclick="removeItem(${item.id})" style="padding: 0.5rem; margin-left: 1rem;">
                ✕
            </button>
        </div>
    `).join('');
    itemCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
}

// Settlement Logic
function updatePayerSelect() {
    const currentPayer = payerSelect.value;
    payerSelect.innerHTML = '<option value="">Select Payer</option>' + 
        friends.map(f => `<option value="${f}">${f}</option>`).join('');
    if (friends.includes(currentPayer)) {
        payerSelect.value = currentPayer;
    }
}

function calculateSplits() {
    const payer = payerSelect.value;
    
    if (!payer || items.length === 0) {
        resultsArea.classList.add('hidden');
        return;
    }

    resultsArea.classList.remove('hidden');

    // 1. Calculate Total and Individual Shares
    let total = 0;
    const shares = {};
    friends.forEach(f => shares[f] = 0);

    items.forEach(item => {
        total += item.price;
        const splitAmount = item.price / item.involved.length;
        item.involved.forEach(person => {
            if (shares[person] !== undefined) {
                shares[person] += splitAmount;
            }
        });
    });

    totalAmountEl.textContent = formatMoney(total);

    // Render Individual Shares
    individualSharesEl.innerHTML = Object.entries(shares)
        .sort(([,a], [,b]) => b - a)
        .map(([name, amount]) => `
            <div class="list-item" style="background: transparent; border: none; padding: 0.5rem 0;">
                <span>${name}</span>
                <span style="font-weight: 600">${formatMoney(amount)}</span>
            </div>
        `).join('');

    // 2. Calculate Debts (Who owes Payer)
    // Since there is only ONE payer, this is simple.
    // Everyone owes their share to the payer.
    // The payer "owes" themselves their share (which cancels out).
    
    const debts = [];
    Object.entries(shares).forEach(([name, share]) => {
        if (name !== payer && share > 0) {
            debts.push({ from: name, to: payer, amount: share });
        }
    });

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
