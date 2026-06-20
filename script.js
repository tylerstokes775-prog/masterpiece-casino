let isSpinning = false;
let autoSpinInterval = null;
let selectedRisk = 'low';
let currentUsername = "";

const SOUND_SPIN = new Audio('https://mixkit.co');
const SOUND_WIN = new Audio('https://mixkit.co');
const SOUND_LOSS = new Audio('https://mixkit.co');
SOUND_SPIN.volume = 0.4; SOUND_WIN.volume = 0.5; SOUND_LOSS.volume = 0.3;

const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];

async function initializeSession() {
    let name = prompt("Enter username to access STAKE_AI Network:");
    if (!name || name.trim() === "") {
        initializeSession();
        return;
    }
    currentUsername = name.trim();

    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername })
    });
    const data = await response.json();
    updateUI(data);
}
initializeSession();

function setRisk(risk) {
    if (isSpinning) return;
    selectedRisk = risk;
    ['low', 'med', 'high'].forEach(r => {
        document.getElementById(`risk-${r}`).className = r === risk ? "py-2 text-xs font-bold rounded-lg uppercase tracking-wide transition border bg-[#1a2c38] text-[#00e701] border-[#00e701]/30" : "py-2 text-xs font-bold rounded-lg uppercase tracking-wide transition border border-transparent text-slate-400 hover:text-slate-200";
    });
}

async function spin() {
    if (isSpinning) return;
    const betInput = document.getElementById('betInput');
    const spinBtn = document.getElementById('spinBtn');
    const statusMessage = document.getElementById('statusMessage');
    const betAmount = parseInt(betInput.value);

    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.classList.add('opacity-50', 'cursor-not-allowed');
    statusMessage.innerText = "🎰 Spinning...";

    SOUND_SPIN.currentTime = 0;
    SOUND_SPIN.play().catch(e => {});

    for (let i = 0; i < 3; i++) {
        const reelElement = document.getElementById(`reel${i}`);
        let fakeSequence = '';
        for(let j=0; j<10; j++) { fakeSequence += symbols[Math.floor(Math.random() * symbols.length)] + '<br>'; }
        reelElement.innerHTML = fakeSequence + '🎰';
        reelElement.style.transform = 'translateY(-80%)';
    }

    try {
        const response = await fetch('/api/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, betAmount, risk: selectedRisk })
        });
        
        const data = await response.json();

        if (response.status !== 200) {
            statusMessage.innerText = `❌ ${data.error}`;
            statusMessage.className = "mt-5 text-center text-xs uppercase tracking-wider font-bold text-red-400";
            stopAutoSpin();
            resetButtons();
            return;
        }

        setTimeout(() => {
            SOUND_SPIN.pause();
            
            for (let i = 0; i < 3; i++) {
                const reelElement = document.getElementById(`reel${i}`);
                reelElement.style.transition = 'none';
                reelElement.style.transform = 'translateY(0)';
                reelElement.innerHTML = data.results[i];
                void reelElement.offsetHeight; 
                reelElement.style.transition = 'transform 2s cubic-bezier(0.1, 0.8, 0.1, 1)';
            }

            if (data.winAmount > 0) {
                statusMessage.innerText = `🎉 Match! Won $${data.winAmount}`;
                statusMessage.className = "mt-5 text-center text-xs uppercase tracking-wider font-bold text-green-400";
                SOUND_WIN.currentTime = 0; SOUND_WIN.play();
            } else {
                statusMessage.innerText = "❌ No match. Try again!";
                statusMessage.className = "mt-5 text-center text-xs uppercase tracking-wider font-bold text-slate-400";
                SOUND_LOSS.currentTime = 0; SOUND_LOSS.play();
            }

            addBetToHistory(betAmount, data.finalMultiplier, data.winAmount);
            updateUI(data.userData);
            resetButtons();

            if (data.leveledUp) {
                alert(`🌟 VIP LEVEL UP! You reached Level ${data.userData.currentLevel}! +$250 Bonus.`);
            }

            if (document.getElementById('autoToggle').checked) {
                autoSpinInterval = setTimeout(spin, 1200);
            }
        }, 2000);

    } catch (err) {
        statusMessage.innerText = "❌ Server Connection Error";
        stopAutoSpin();
        resetButtons();
    }
}

function resetButtons() {
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = false;
    spinBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    isSpinning = false;
}

function toggleAutoSpin() {
    const toggle = document.getElementById('autoToggle');
    const status = document.getElementById('autoStatus');
    if (toggle.checked) {
        status.innerText = "Status: Active 🔄"; status.className = "text-[10px] text-[#00e701] font-bold uppercase tracking-wide";
        if (!isSpinning) spin();
    } else { stopAutoSpin(); }
}

function stopAutoSpin() {
    document.getElementById('autoToggle').checked = false;
    const status = document.getElementById('autoStatus');
    status.innerText = "Status: Inactive"; status.className = "text-[10px] text-slate-500 font-bold uppercase tracking-wide";
    clearTimeout(autoSpinInterval);
}

function addBetToHistory(bet, multiplier, payout) {
    const body = document.getElementById('historyBody');
    const emptyRow = document.getElementById('emptyRow');
    if (emptyRow) emptyRow.remove();

    const row = document.createElement('tr');
    row.className = "hover:bg-[#1f3341]/30 transition duration-150 border-b border-[#213743]/20";
    row.innerHTML = `
        <td class="p-3 text-slate-300">Slots (${selectedRisk.toUpperCase()})</td>
        <td class="p-3 text-right text-slate-300">$${bet.toFixed(2)}</td>
        <td class="p-3 text-right ${multiplier > 0 ? 'text-yellow-400' : 'text-slate-500'}">${multiplier > 0 ? multiplier.toFixed(2) + 'x' : '0.00x'}</td>
        <td class="p-3 text-right ${payout > 0 ? 'text-[#00e701] font-bold' : 'text-slate-400'}">$${payout.toFixed(2)}</td>
    `;
    body.insertBefore(row, body.firstChild);
    if (body.children.length > 5) body.removeChild(body.lastChild);
}

function updateUI(userData) {
    document.getElementById('balance').innerText = userData.balance;
    document.getElementById('levelDisplay').innerText = `Level ${userData.currentLevel}`;
    document.getElementById('xpBar').style.width = `${(userData.currentXp / userData.xpNeededPerLevel) * 100}%`;
}

function openBonusModal() {
    document.getElementById('bonusModal').classList.remove('hidden');
    executeClaimCheck();
}

function closeBonusModal() {
    document.getElementById('bonusModal').classList.add('hidden');
}

function executeClaimCheck() {
    fetch('/api/claim-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error === "Reward on cooldown") {
            startClientCountdown(data.msRemaining);
        }
    });
}

function executeClaim() {
    fetch('/api/claim-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`🎉 BONUS! You collected $${data.reward} free coins!`);
            updateUI(data.userData);
            closeBonusModal();
        } else if (data.error === "Reward on cooldown") {
            startClientCountdown(data.msRemaining);
        }
    });
}

function startClientCountdown(ms) {
    const claimBtn = document.getElementById('claimBtn');
    const timerText = document.getElementById('cooldownTimer');

    claimBtn.classList.add('hidden');
    timerText.classList.remove('hidden');

    let secondsLeft = Math.floor(ms / 1000);

    function runClock() {
        if (secondsLeft <= 0) {
            claimBtn.classList.remove('hidden');
            timerText.classList.add('hidden');
            return;
        }
        let hrs = Math.floor(secondsLeft / 3600);
        let mins = Math.floor((secondsLeft % 3600) / 60);
        let secs = secondsLeft % 60;
        timerText.innerText = `🔒 COOLDOWN: ${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        secondsLeft--;
        setTimeout(runClock, 1000);
    }
    runClock();
}
