const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const USER_DB_PATH = path.join(__dirname, 'multiplayer_user_vault.json');

function loadUsers() {
    try {
        if (!fs.existsSync(USER_DB_PATH)) {
            fs.writeFileSync(USER_DB_PATH, JSON.stringify({}, null, 4));
            return {};
        }
        return JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
    } catch (e) { return {}; }
}

function saveUsers(users) {
    fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 4));
}

const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
const payouts = { '🍒': 2, '🍋': 3, '🍊': 4, '🍇': 5, '💎': 10, '7️⃣': 25 };

app.post('/api/login', (req, res) => {
    const { username } = req.body;
    if (!username || username.trim() === "") return res.status(400).json({ error: "Username required" });

    let db = loadUsers();
    
    if (!db[username]) {
        db[username] = {
            username: username,
            balance: 1000,
            currentLevel: 1,
            currentXp: 0,
            xpNeededPerLevel: 100,
            lastBonusClaimed: 0
        };
        saveUsers(db);
    }
    res.json(db[username]);
});

app.post('/api/claim-daily', (req, res) => {
    const { username } = req.body;
    let db = loadUsers();
    let player = db[username];

    if (!player) return res.status(400).json({ error: "User profile missing" });

    const currentTime = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    if (currentTime - player.lastBonusClaimed < oneDayInMs) {
        const msRemaining = oneDayInMs - (currentTime - player.lastBonusClaimed);
        return res.status(400).json({ error: "Reward on cooldown", msRemaining });
    }

    const rewardPool =;
    const randomReward = rewardPool[Math.floor(Math.random() * rewardPool.length)];

    player.balance += randomReward;
    player.lastBonusClaimed = currentTime;

    db[username] = player;
    saveUsers(db);

    res.json({ success: true, reward: randomReward, userData: player });
});

app.post('/api/spin', (req, res) => {
    const { username, betAmount, risk } = req.body;
    let db = loadUsers();
    let player = db[username];

    if (!player || betAmount > player.balance || betAmount <= 0 || isNaN(betAmount)) {
        return res.status(400).json({ error: "Invalid transaction parameters." });
    }

    player.balance -= betAmount;
    player.currentXp += Math.max(5, Math.floor(betAmount * 0.5));
    let leveledUp = false;

    if (player.currentXp >= player.xpNeededPerLevel) {
        player.currentXp -= player.xpNeededPerLevel;
        player.currentLevel++;
        player.balance += 250; 
        leveledUp = true;
    }

    let roll = Math.random();
    let results = [];
    if (risk === 'low') {
        if (roll < 0.25) { let sym = symbols[Math.floor(Math.random() * 3)]; results = [sym, sym, sym]; }
        else if (roll < 0.65) { let sym = symbols[Math.floor(Math.random() * 4)]; results = [sym, sym, symbols[Math.floor(Math.random() * symbols.length)]]; }
    } else if (risk === 'high') {
        if (roll < 0.05) { let megaSym = symbols[Math.floor(Math.random() * 2) + 4]; results = [megaSym, megaSym, megaSym]; }
        else if (roll < 0.15) { results = ['💎', '💎', symbols[Math.floor(Math.random() * symbols.length)]]; }
    } else {
        if (roll < 0.12) { let sym = symbols[Math.floor(Math.random() * symbols.length)]; results = [sym, sym, sym]; }
        else if (roll < 0.40) { let sym = symbols[Math.floor(Math.random() * symbols.length)]; results = [sym, sym, symbols[Math.floor(Math.random() * symbols.length)]]; }
    }

    if (results.length === 0) {
        results = [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]];
    }

    let winAmount = 0; let finalMultiplier = 0;
    if (results[0] === results[1] && results[1] === results[2]) {
        finalMultiplier = payouts[results[0]];
        if (risk === 'high') finalMultiplier *= 3;
        if (risk === 'low') finalMultiplier = Math.max(2, Math.floor(finalMultiplier * 0.7));
        winAmount = betAmount * finalMultiplier;
        player.balance += winAmount;
    } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
        finalMultiplier = risk === 'high' ? 0.5 : 1.5;
        winAmount = Math.floor(betAmount * finalMultiplier);
        player.balance += winAmount;
    }

    db[username] = player;
    saveUsers(db);

    res.json({ results, winAmount, finalMultiplier, leveledUp, userData: player });
});

// Dynamic port binding for cloud deployments
const CLOUD_PORT = process.env.PORT || 3000;
app.listen(CLOUD_PORT, () => {
    console.log(`🚀 Multiplayer Core operational on port: ${CLOUD_PORT}`);
});
