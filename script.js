// MONO.DUO — Tabungan Berdua JavaScript Engine

let appState = {
    balance: 0,
    target: {
        name: "Liburan / Target Bersama",
        amount: 10000000
    },
    transactions: [],
    pendingDeposit: null
};

let activeFilter = 'all';
let myChart = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initChart();
    renderAll();
});

// Load state from localStorage & auto-fix missing IDs
function loadState() {
    const saved = localStorage.getItem('mono_duo_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState.balance = parsed.balance || 0;
            appState.target = parsed.target || appState.target;
            appState.transactions = parsed.transactions || [];

            // Pastikan semua transaksi lama punya ID unik
            appState.transactions.forEach((tx, index) => {
                if (!tx.id) {
                    tx.id = 'TRX-' + (Date.now() + index);
                }
            });
        } catch (e) {
            console.error("Failed to parse local storage data", e);
        }
    }
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('mono_duo_state', JSON.stringify({
        balance: appState.balance,
        target: appState.target,
        transactions: appState.transactions
    }));
}

// Render UI Components
function renderAll() {
    // 1. Balance Display
    document.getElementById('balanceDisplay').innerText = formatRupiah(appState.balance);

    // 2. Target Progress
    const targetPercentage = Math.min(100, Math.round((appState.balance / appState.target.amount) * 100)) || 0;
    document.getElementById('targetName').innerText = appState.target.name;
    document.getElementById('targetProgressText').innerText = `${targetPercentage}% (${formatRupiah(appState.balance)} / ${formatRupiah(appState.target.amount)})`;
    document.getElementById('targetProgressBar').style.width = `${targetPercentage}%`;

    // 3. Transactions List
    renderTransactions();

    // 4. Update Chart
    updateChart();

    // Re-initialize Lucide Icons
    if (window.lucide) lucide.createIcons();
}

// Format Currency to IDR
function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

// Format Date Real-Time
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    }).replace(/\./g, ':');
}

// Modal Control
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Quick Deposit Selection
function setQuickDeposit(amount) {
    document.getElementById('depositAmount').value = amount;
}

// Handle Deposit Form
function handleDepositSubmit(e) {
    e.preventDefault();
    const amount = parseInt(document.getElementById('depositAmount').value);
    const category = document.getElementById('depositCategory').value;
    const note = document.getElementById('depositNote').value.trim() || 'Setoran Tabungan';

    if (!amount || amount < 1000) {
        showToast('Minimal nominal Rp 1.000', 'error');
        return;
    }

    appState.pendingDeposit = {
        amount: amount,
        category: category,
        note: note
    };

    document.getElementById('qrAmountText').innerText = formatRupiah(amount);
    closeModal('depositModal');
    openModal('qrModal');
}

// Download QR Image
function downloadQRImage() {
    const qrImg = document.getElementById('qrImageDisplay');
    const a = document.createElement('a');
    a.href = qrImg.src;
    a.download = 'QR_DANA_Tabungan_Berdua.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Mengunduh Gambar QR DANA...', 'info');
}

// Direct Bank Launcher
function openBankApp(appName) {
    const danaNumber = '081234567890';
    navigator.clipboard.writeText(danaNumber);
    
    showToast(`Nomor DANA (${danaNumber}) disalin! Membuka ${appName.toUpperCase()}...`, 'success');

    setTimeout(() => {
        let appUrl = '#';
        switch (appName) {
            case 'seabank': appUrl = 'seabank://'; break;
            case 'dana': appUrl = 'dana://'; break;
            case 'bca': appUrl = 'bca://'; break;
            case 'gopay': appUrl = 'gopay://'; break;
            case 'shopeepay': appUrl = 'shopeepay://'; break;
            case 'mandiri': appUrl = 'livin://'; break;
        }
        window.location.href = appUrl;
    }, 1200);
}

// Confirm Deposit
function confirmDeposit() {
    if (!appState.pendingDeposit) return;

    const dep = appState.pendingDeposit;
    appState.balance += dep.amount;

    const newTx = {
        id: 'TRX-' + Date.now(),
        type: 'in',
        amount: dep.amount,
        category: dep.category,
        note: dep.note,
        method: 'QR DANA / QRIS',
        date: new Date().toISOString(),
        postBalance: appState.balance
    };

    appState.transactions.unshift(newTx);
    appState.pendingDeposit = null;

    saveState();
    renderAll();
    closeModal('qrModal');

    document.getElementById('depositAmount').value = '';
    document.getElementById('depositNote').value = '';

    showToast('Transfer berhasil dikonfirmasi! Tabungan bertambah.', 'success');
    showReceipt(newTx.id);
}

// Handle Withdraw Form
function handleWithdrawSubmit(e) {
    e.preventDefault();
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const category = document.getElementById('withdrawCategory').value;
    const note = document.getElementById('withdrawNote').value.trim() || 'Penarikan Tabungan';

    if (!amount || amount < 1000) {
        showToast('Minimal penarikan Rp 1.000', 'error');
        return;
    }

    if (amount > appState.balance) {
        showToast('Saldo tabungan tidak mencukupi!', 'error');
        return;
    }

    appState.balance -= amount;

    const newTx = {
        id: 'TRX-' + Date.now(),
        type: 'out',
        amount: amount,
        category: category,
        note: note,
        method: 'Penarikan Vault',
        date: new Date().toISOString(),
        postBalance: appState.balance
    };

    appState.transactions.unshift(newTx);
    saveState();
    renderAll();
    closeModal('withdrawModal');

    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawNote').value = '';

    showToast('Penarikan dana berhasil diproses.', 'info');
    showReceipt(newTx.id);
}

// Render Transactions List
function renderTransactions() {
    const container = document.getElementById('txList');
    if (!container) return;
    container.innerHTML = '';

    let filtered = appState.transactions;
    if (activeFilter === 'in') filtered = appState.transactions.filter(t => t.type === 'in');
    if (activeFilter === 'out') filtered = appState.transactions.filter(t => t.type === 'out');

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-zinc-500 font-mono text-xs">
                Belum ada mutasi transaksi
            </div>
        `;
        return;
    }

    filtered.forEach(tx => {
        const isIn = tx.type === 'in';
        const card = document.createElement('div');
        card.className = 'flex items-center justify-between p-3.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl transition-all group';
        
        card.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${isIn ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' : 'bg-rose-950/40 border-rose-800/50 text-rose-400'}">
                    <i data-lucide="${isIn ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-zinc-200 truncate">${tx.category}</span>
                        <span class="text-[10px] font-mono text-zinc-500 shrink-0">${tx.id}</span>
                    </div>
                    <p class="text-[11px] text-zinc-400 font-mono truncate">${tx.note} • ${formatDate(tx.date)}</p>
                </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
                <div class="text-right">
                    <span class="text-sm font-bold font-mono ${isIn ? 'text-emerald-400' : 'text-rose-400'}">
                        ${isIn ? '+' : '-'}${formatRupiah(tx.amount)}
                    </span>
                    <p class="text-[10px] font-mono text-zinc-500">Saldo: ${formatRupiah(tx.postBalance)}</p>
                </div>
                
                <button onclick="showReceipt('${tx.id}')" title="Lihat Struk" class="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
                    <i data-lucide="receipt" class="w-4 h-4"></i>
                </button>

                <button onclick="deleteTransaction('${tx.id}')" title="Hapus Mutasi" class="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Hapus Mutasi Spesifik
function deleteTransaction(id) {
    const txIndex = appState.transactions.findIndex(t => t.id === id);
    if (txIndex === -1) {
        showToast('Transaksi nggak ditemukan', 'error');
        return;
    }

    const targetTx = appState.transactions[txIndex];
    const konfirmasi = confirm(`Hapus mutasi "${targetTx.category}" (${formatRupiah(targetTx.amount)})?\n\nSaldo akan otomatis dihitung ulang.`);
    
    if (!konfirmasi) return;

    appState.transactions.splice(txIndex, 1);
    recalculateState();

    saveState();
    renderAll();
    showToast('Mutasi berhasil dihapus & saldo disesuaikan.', 'info');
}

// Rekalkulasi Saldo
function recalculateState() {
    let runningBalance = 0;
    const chronological = [...appState.transactions].reverse();

    chronological.forEach(tx => {
        if (tx.type === 'in') {
            runningBalance += tx.amount;
        } else if (tx.type === 'out') {
            runningBalance -= tx.amount;
        }
        tx.postBalance = runningBalance;
    });

    appState.balance = runningBalance;
}

// Filter Transactions
function filterMutasi(type) {
    activeFilter = type;
    document.getElementById('btnFilterAll').className = `px-2.5 py-1 rounded-lg transition-all ${type === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`;
    document.getElementById('btnFilterIn').className = `px-2.5 py-1 rounded-lg transition-all ${type === 'in' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`;
    document.getElementById('btnFilterOut').className = `px-2.5 py-1 rounded-lg transition-all ${type === 'out' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`;
    renderTransactions();
    if (window.lucide) lucide.createIcons();
}

// Show Receipt Modal
let activeReceiptTx = null;
function showReceipt(idOrTx) {
    const tx = typeof idOrTx === 'object' ? idOrTx : appState.transactions.find(t => t.id === idOrTx);
    if (!tx) return;

    activeReceiptTx = tx;
    document.getElementById('receiptId').innerText = tx.id;
    document.getElementById('receiptDate').innerText = formatDate(tx.date);
    document.getElementById('receiptType').innerText = tx.type === 'in' ? 'SETORAN' : 'PENARIKAN';
    document.getElementById('receiptType').className = `font-bold ${tx.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}`;
    document.getElementById('receiptCategory').innerText = tx.category;
    document.getElementById('receiptMethod').innerText = tx.method;
    document.getElementById('receiptNote').innerText = tx.note || '-';
    document.getElementById('receiptAmount').innerText = (tx.type === 'in' ? '+' : '-') + formatRupiah(tx.amount);
    document.getElementById('receiptPostBalance').innerText = formatRupiah(tx.postBalance);

    openModal('receiptModal');
}

// Download Receipt PNG
function downloadReceiptPNG() {
    const target = document.getElementById('thermalReceipt');
    html2canvas(target, { backgroundColor: '#09090b', scale: 2 }).then(canvas => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `Struk_${activeReceiptTx ? activeReceiptTx.id : 'Tabungan'}.png`;
        a.click();
        showToast('Struk berhasil diunduh sebagai PNG!', 'success');
    });
}

// Copy Receipt Text
function copyReceiptText() {
    if (!activeReceiptTx) return;
    const text = `=== MONO.DUO STRUK ===\nID: ${activeReceiptTx.id}\nTanggal: ${formatDate(activeReceiptTx.date)}\nTipe: ${activeReceiptTx.type === 'in' ? 'SETORAN' : 'PENARIKAN'}\nNominal: ${formatRupiah(activeReceiptTx.amount)}\nKategori: ${activeReceiptTx.category}\nSaldo Akhir: ${formatRupiah(activeReceiptTx.postBalance)}\n=====================`;
    navigator.clipboard.writeText(text);
    showToast('Teks struk berhasil disalin!', 'info');
}

// Edit Target
function editTarget() {
    const newName = prompt('Masukkan nama Target Impian Bersama:', appState.target.name);
    if (!newName) return;
    const newAmount = prompt('Masukkan nominal Target (Rp):', appState.target.amount);
    if (!newAmount || isNaN(newAmount)) return;

    appState.target.name = newName;
    appState.target.amount = parseInt(newAmount);
    saveState();
    renderAll();
    showToast('Target impian berhasil diperbarui!', 'success');
}

// Chart.js Setup
function initChart() {
    const chartEl = document.getElementById('financialChart');
    if (!chartEl) return;
    const ctx = chartEl.getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['M1', 'M2', 'M3', 'M4'],
            datasets: [
                {
                    label: 'Pemasukan',
                    data: [0, 0, 0, 0],
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#34d399'
                },
                {
                    label: 'Pengeluaran',
                    data: [0, 0, 0, 0],
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#f87171'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#71717a', font: { family: 'Space Mono', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#71717a', font: { family: 'Space Mono', size: 10 } }
                }
            }
        }
    });
}

function updateChart() {
    if (!myChart) return;
    
    let totalIn = 0;
    let totalOut = 0;

    appState.transactions.forEach(t => {
        if (t.type === 'in') totalIn += t.amount;
        if (t.type === 'out') totalOut += t.amount;
    });

    myChart.data.datasets[0].data = [totalIn * 0.2, totalIn * 0.5, totalIn * 0.8, totalIn];
    myChart.data.datasets[1].data = [totalOut * 0.1, totalOut * 0.4, totalOut * 0.7, totalOut];
    myChart.update();
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium shadow-2xl backdrop-blur-md ${
        type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' 
            : type === 'error'
            ? 'bg-rose-950/90 border-rose-800 text-rose-200'
            : 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
    }`;

    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i><span>${message}</span>`;
    
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}