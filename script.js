// ===== DATA =====

const successRates = {
    sovereign: [8.55, 4.12, 2.0, 0.91, 0.469, 0.273, 0.16, 0.1075, 0.0485, 0.0242],
    kharazad: [16.3, 7.3, 4.57, 2.89, 1.91, 1.29, 0.88, 0.57, 0.32, 0.172],
    fallen: [0, 0, 0, 0, 0.0025] // Only V matters for Fallen God
};

const cronCosts = {
    sovereign: [0, 320, 560, 780, 970, 1350, 1550, 2250, 2760, 3920],
    kharazad: [0, 120, 280, 540, 840, 1090, 1480, 1880, 2850, 3650],
    fallen: [0, 0, 0, 0, 4000]
};

const pityCaps = {
    sovereign: [3, 5, 10, 20, 30, 35, 50, 75, 165, 330],
    kharazad: [3, 5, 7, 8, 10, 12, 15, 20, 25, 30],
    fallen: [0, 0, 0, 0, 1000]
};
const recommendedFS = {
    sovereign: [48, 66, 106, 191, 234, 290, 314, 316, 346, 346],
    kharazad: [38, 66, 96, 142, 161, 191, 225, 272, 314, 316]
};
const essenceOfDawnCosts = [1, 2, 3, 4, 6, 8, 10, 12, 15, 0];

// ===== UTILITIES =====
document.getElementById("compoundButton").addEventListener("click", function() {
    document.querySelector(".container").style.display = "none";
    document.getElementById("compoundSection").style.display = "block";
});

document.getElementById("backToSingle").addEventListener("click", function() {
    document.getElementById("compoundSection").style.display = "none";
    document.querySelector(".container").style.display = "block";
});


function cronWithSilver(numCrons) {
    const source = document.getElementById('cronStoneSource').value;
    const price = source === 'vendor' ? 3000000 : 2185000;
    return `${numCrons.toLocaleString()} (${(numCrons * price).toLocaleString()} silver)`;
}

document.getElementById('cronStoneSource').addEventListener('change', updateCalculations);

function levelToRoman(level) {
    const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
    return romans[level - 1] || level;
}

// ===== MAIN LOGIC =====

function calculateEnhancementChance(baseRate, failstacks) {
    return Math.min(baseRate + (failstacks * baseRate / 10), 100);
}

function calculateTheoreticalAverage(successChance) {
    return successChance > 0 ? 100 / successChance : 0;
}

// ITERATIVE version for robust calculation
function calculateExactAverageAttempts(baseRate, pityCap, initialFailstack, ignorePity = false) {
    if (baseRate === 0 || (!pityCap && !ignorePity)) return 0;

    // If no pity, just use a large practical cap
    const MAX_ATTEMPTS = 100000;
    let limit = (!ignorePity && pityCap > 0) ? pityCap : MAX_ATTEMPTS;

    // E[a]: expected attempts if we've already tried "a" times (so, current attempt = a+1)
    // failstack increases by a
    const E = new Array(limit + 2).fill(0);

    // If we reach pity cap, succeed on next attempt
    E[limit] = 1;

    for (let a = limit - 1; a >= 0; a--) {
        // failstack increases with every attempt
        const fs = initialFailstack + a;
        const P = Math.min(baseRate + (fs * baseRate / 10), 100) / 100;
        if (P >= 1) {
            E[a] = 1;
        } else {
            E[a] = 1 + (1 - P) * E[a + 1];
        }
    }

    return E[0];
}


// ===== UI ELEMENTS =====

const itemTypeSelect = document.getElementById('itemType');
const enhanceLevelSelect = document.getElementById('enhanceLevel');
const failstackInput = document.getElementById('failstack');
const cronCostDisplay = document.getElementById('cronCost');
const pityCountDisplay = document.getElementById('pityCount');
const estimatedCronsDisplay = document.getElementById('estimatedCrons');
const enhanceChanceDisplay = document.getElementById('enhanceChance');
const avgSuccessRateDisplay = document.getElementById('avgSuccessRate');
const realAvgSuccessRateDisplay = document.getElementById('realAvgSuccessRate');
const triesResult = document.getElementById('triesResult');
const triesNeededSpan = document.getElementById('triesNeeded');
const finalFailstacksSpan = document.getElementById('finalFailstacks');
const finalSuccessChanceSpan = document.getElementById('finalSuccessChance');
const totalCronsUsedSpan = document.getElementById('totalCronsUsed');
const logAttemptsCheckbox = document.getElementById('logAttempts');

// ===== CALCULATIONS & DISPLAY =====

function updateCalculations() {
    const itemType = itemTypeSelect.value;
    const enhanceLevel = enhanceLevelSelect.value;
    const failstacks = parseInt(failstackInput.value) || 0;

    if (!itemType || !enhanceLevel) {
        resetDisplay();
        updateMaterialDisplay();
        return;
    }

    const levelIndex = parseInt(enhanceLevel) - 1;
    const baseRate = successRates[itemType][levelIndex];
    const cronCost = cronCosts[itemType][levelIndex];
    const pityCap = pityCaps[itemType][levelIndex];

    // Per-try chance
    let chance = Math.min(baseRate + (failstacks * baseRate / 10), 100);

    cronCostDisplay.textContent = cronWithSilver(cronCost);
    if (pityCountDisplay) pityCountDisplay.textContent = pityCap ? pityCap : '—';
    enhanceChanceDisplay.textContent = chance.toFixed(4) + '%';
    avgSuccessRateDisplay.textContent = calculateTheoreticalAverage(chance).toFixed(2);

    // Real average (with/without pity)
    const includePity = document.getElementById('includePityCheckbox')?.checked ?? true;
    let realAvg;
    if (chance >= 100) {
        realAvg = 1;
    } else {
        realAvg = calculateExactAverageAttempts(baseRate, pityCap, failstacks, !includePity);
        if (!isFinite(realAvg) || isNaN(realAvg)) realAvg = 1;
    }
    realAvgSuccessRateDisplay.textContent = realAvg.toFixed(2);

    // Estimated crons
    let estTries = Math.ceil(realAvg);
    let cronAttempts = (pityCap > 0 && estTries > pityCap) ? pityCap : estTries;
    let totalCrons = cronAttempts * cronCost;
    estimatedCronsDisplay.textContent = cronWithSilver(totalCrons);

    // Material cost
    const memFragPrice = parseInt(document.getElementById('memFragPrice').value) || 0;
    const essencePrice = parseInt(document.getElementById('essencePrice').value) || 0;
    const mat = calculateMaterialCosts({
        itemType,
        level: parseInt(enhanceLevel),
        avgAttempts: realAvg,
        pityCap,
        memFragPrice,
        essencePrice
    });
    updateMaterialDisplay(mat);
}

function resetDisplay() {
    cronCostDisplay.textContent = '0';
    if (pityCountDisplay) pityCountDisplay.textContent = '—';
    estimatedCronsDisplay.textContent = '0';
    enhanceChanceDisplay.textContent = '0%';
    avgSuccessRateDisplay.textContent = '0';
    realAvgSuccessRateDisplay.textContent = '0';
}

// Memory Fragments & Essence of Dawn cost calculation for single enhance
function calculateMaterialCosts({ itemType, level, avgAttempts, pityCap, memFragPrice, essencePrice }) {
    const memFragsPerFail = (itemType === "fallen") ? 30 : 20;
    const tries = Math.ceil(avgAttempts);
    const fails = Math.max(0, tries - 1);
    const memFragsUsed = fails * memFragsPerFail;
    let essenceUsed = 0;
    if (itemType === "kharazad" && level >= 1 && level <= 9) {
        essenceUsed = tries * essenceOfDawnCosts[level - 1];
    }
    return {
        memFragsUsed,
        memFragCost: memFragsUsed * memFragPrice,
        essenceUsed,
        essenceCost: essenceUsed * essencePrice
    };
}


function updateMaterialDisplay(mat = null) {
    const avgMatDiv = document.getElementById('avgMatCosts');
    if (!mat) {
        avgMatDiv.innerHTML = "Memory Fragments: --<br>Essence of Dawn: --";
        return;
    }
    avgMatDiv.innerHTML =
        `Memory Fragments: ${mat.memFragsUsed.toLocaleString()} (${mat.memFragCost.toLocaleString()} silver)<br>` +
        (mat.essenceUsed > 0
            ? `Essence of Dawn: ${mat.essenceUsed.toLocaleString()} (${mat.essenceCost.toLocaleString()} silver)`
            : "Essence of Dawn: --");
}


// ===== SIMULATION =====

document.getElementById('enhanceButton').addEventListener('click', function() {
    const result = simulateEnhancement();
    displayResults(result);
});

function simulateEnhancement() {
    const itemType = itemTypeSelect.value;
    const enhanceLevel = enhanceLevelSelect.value;
    let failstacks = parseInt(failstackInput.value) || 0;
    if (!itemType || !enhanceLevel) {
        alert('Please select both item type and enhancement level');
        return null;
    }
    const levelIndex = parseInt(enhanceLevel) - 1;
    const baseRate = successRates[itemType][levelIndex];
    const cronCost = cronCosts[itemType][levelIndex];
    const pityCap = pityCaps[itemType][levelIndex];

    let tries = 0, totalCrons = 0, finalChance = 0, fails = 0;
    let pityTriggered = false;
    while (true) {
        tries++;
        // Only charge cron cost if not about to activate pity
        if (!(pityCap > 0 && tries === pityCap)) {
            totalCrons += cronCost;
        }
        const currentChance = Math.min(baseRate + ((failstacks + tries - 1) * baseRate / 10), 100);
        const roll = Math.random() * 100;
        if (logAttemptsCheckbox.checked) {
            console.log(`Attempt ${tries}: ${currentChance.toFixed(4)}% at FS=${failstacks + tries - 1} - Rolled ${roll.toFixed(2)} -> ${
                roll <= currentChance ? 'SUCCESS' : 'FAIL'
            }`);
        }
        // Check for pity activation (on the current attempt)
        if (pityCap > 0 && tries === pityCap) {
            pityTriggered = true;
            finalChance = 100;
            break;
        }
        if (roll <= currentChance) {
            finalChance = currentChance;
            break;
        }
        fails++;
    }

    // Material cost
    const memFragPrice = parseInt(document.getElementById('memFragPrice').value) || 0;
    const essencePrice = parseInt(document.getElementById('essencePrice').value) || 0;
    const mat = calculateMaterialCosts({
        itemType,
        level: parseInt(enhanceLevel),
        avgAttempts: tries,
        pityCap,
        memFragPrice,
        essencePrice
    });

    return {
        tries,
        finalFailstacks: failstacks + tries - 1, // The failstack you succeeded on
        finalChance,
        totalCrons,
        fails,
        mat
    };
}


function displayResults(result) {
    if (!result) return;
    // ...existing code...
    triesNeededSpan.textContent = result.tries;
    finalFailstacksSpan.textContent = result.finalFailstacks;
    finalSuccessChanceSpan.textContent = result.finalChance.toFixed(4) + '%';
    totalCronsUsedSpan.textContent = cronWithSilver(result.totalCrons);

    // Material costs in results:
    const matLine = document.getElementById('materialCostLine');
    matLine.innerHTML =
        `Memory Fragments: ${result.mat.memFragsUsed.toLocaleString()} (${result.mat.memFragCost.toLocaleString()} silver)<br>` +
        (result.mat.essenceUsed > 0
            ? `Essence of Dawn: ${result.mat.essenceUsed.toLocaleString()} (${result.mat.essenceCost.toLocaleString()} silver)`
            : "Essence of Dawn: --");
    triesResult.style.display = 'block';
}

// ===== COMPOUND ENHANCING =====
document.getElementById('compoundItemType').addEventListener('change', generateCompoundFailstacksInputs);
document.getElementById('compoundStartLevel').addEventListener('change', generateCompoundFailstacksInputs);
document.getElementById('compoundEndLevel').addEventListener('change', generateCompoundFailstacksInputs);

function generateCompoundFailstacksInputs() {
    const itemType = document.getElementById('compoundItemType').value;
    const start = parseInt(document.getElementById('compoundStartLevel').value);
    const end = parseInt(document.getElementById('compoundEndLevel').value);
    const group = document.getElementById('compoundFailstacksGroup');
    const box = document.getElementById('compoundFailstacksInputs');
    box.innerHTML = '';

    // Only show if all are selected and valid
    if (!itemType || isNaN(start) || isNaN(end) || end < start) {
        group.style.display = 'none';
        return;
    }
    group.style.display = 'block';

    // Only allow IX max for Kharazad, Sovereign
    const maxLevel = 10;
    for (let i = start; i <= end; i++) {
        if (i > maxLevel) break;
        const levelName = ["I","II","III","IV","V","VI","VII","VIII","IX","X"][i-1] || i;
        box.innerHTML += `<div style="margin-bottom: 8px;">
            <label style="display:inline-block; width: 60px;">${levelName}:</label>
            <input type="number" id="compoundFSInput${i}" value="0" min="0" style="width: 60px;">
        </div>`;    }
}
document.getElementById("compoundButton").addEventListener("click", function() {
    document.querySelector(".container").style.display = "none";
    document.getElementById("compoundSection").style.display = "block";
    generateCompoundFailstacksInputs();
});


document.getElementById('useRecommendedFS').addEventListener('click', function() {
    const itemType = document.getElementById('compoundItemType').value;
    const start = parseInt(document.getElementById('compoundStartLevel').value);
    const end = parseInt(document.getElementById('compoundEndLevel').value);

    if (!itemType || isNaN(start) || isNaN(end) || end < start) return;
    const fsList = recommendedFS[itemType];
    if (!fsList) return;

    for (let i = start; i <= end; i++) {
        const inp = document.getElementById('compoundFSInput' + i);
        if (inp) inp.value = fsList[i-1] || 0;
    }
});



document.getElementById("calculateCompound").addEventListener("click", function() {
    const itemType = document.getElementById("compoundItemType").value;
    const startLevel = parseInt(document.getElementById("compoundStartLevel").value);
    const endLevel = parseInt(document.getElementById("compoundEndLevel").value);
    const memFragPrice = parseInt(document.getElementById('memFragPrice').value) || 0;
    const essencePrice = parseInt(document.getElementById('essencePrice').value) || 0;
    const compoundIncludePity = document.getElementById("compoundIncludePityCheckbox").checked;

    if (!itemType || isNaN(startLevel) || isNaN(endLevel) || endLevel < startLevel) {
        console.log("Compound enhance button clicked!");
        document.getElementById("compoundResult").innerHTML = "Please select item type and valid levels.";
        document.getElementById("compoundResult").style.display = "block";
        return;
    }

    const failstackMap = {};
    for (let lvl = startLevel; lvl <= endLevel; lvl++) {
        const fsInput = document.getElementById(`compoundFSInput${lvl}`);
        failstackMap[lvl] = fsInput ? (parseInt(fsInput.value) || 0) : 0;
    }

    let totalCrons = 0, totalAttempts = 0, totalFails = 0, totalMemFrags = 0, totalEssence = 0;
    let totalMemFragCost = 0, totalEssenceCost = 0;
    let breakdown = [];
    for (let level = startLevel; level <= endLevel; level++) {
        const data = {
            successRates: successRates[itemType],
            cronCosts: cronCosts[itemType],
            pityCaps: pityCaps[itemType]
        };
        const idx = level - 1;
        const baseRate = data.successRates[idx];
        const cronCost = data.cronCosts[idx];
        const pityCap = data.pityCaps[idx];
        let failstacks = failstackMap[level];

        let chanceForLevel = Math.min(baseRate + (failstacks * baseRate / 10), 100);

        let avgAttempts;
        if (chanceForLevel >= 100) { // <--- THIS FIXES THE REAL AVG CLAMP!
            avgAttempts = 1;
        } else {
            avgAttempts = calculateExactAverageAttempts(baseRate, pityCap, failstacks, !compoundIncludePity);
            if (!isFinite(avgAttempts) || isNaN(avgAttempts)) avgAttempts = 1;
        }
        let triesForLevel = Math.ceil(avgAttempts);

        let cronAttempts = (pityCap > 0 && triesForLevel > pityCap) ? pityCap : triesForLevel;
        let cronsForLevel = cronAttempts * cronCost;

        let memFragsPerFail = (itemType === "fallen") ? 30 : 20;
        let failsForLevel = Math.max(0, triesForLevel - 1);
        let memFrags = failsForLevel * memFragsPerFail;
        let memFragCost = memFrags * memFragPrice;

        let essenceUsed = 0, essenceCost = 0;
        if (itemType === "kharazad" && level >= 1 && level <= 9) {
            essenceUsed = triesForLevel * essenceOfDawnCosts[level - 1];
            essenceCost = essenceUsed * essencePrice;
        }

        breakdown.push(
            `<b>Level ${levelToRoman(level)}</b> (Chance: ${(chanceForLevel*1).toFixed(4)}%):<br>
             Estimated Tries: ${triesForLevel}<br>
             Crons: ${cronWithSilver(cronsForLevel)}<br>
             Memory Fragments: ${memFrags} (${memFragCost.toLocaleString()} silver)` +
            (essenceUsed > 0 ? `<br>Essence of Dawn: ${essenceUsed} (${essenceCost.toLocaleString()} silver)` : '')
        );

        totalCrons += cronsForLevel;
        totalAttempts += triesForLevel;
        totalFails += failsForLevel;
        totalMemFrags += memFrags;
        totalEssence += essenceUsed;
        totalMemFragCost += memFragCost;
        totalEssenceCost += essenceCost;
    }

    const resultDiv = document.getElementById("compoundResult");
    resultDiv.style.display = "block";
    resultDiv.innerHTML =
        `<b>Total Estimated Tries:</b> ${totalAttempts}<br>
         <b>Total Estimated Crons Used:</b> ${cronWithSilver(totalCrons)}<br>
         <b>Total Memory Fragments:</b> ${totalMemFrags} (${totalMemFragCost.toLocaleString()} silver)<br>` +
        (totalEssence > 0 ? `<b>Total Essence of Dawn:</b> ${totalEssence} (${totalEssenceCost.toLocaleString()} silver)<br>` : "") +
        `<b>Breakdown:</b><br>` +
        breakdown.join('<hr style="border:none;border-top:1px solid #444;margin:8px 0;">');
});

// ===== EVENT LISTENERS =====

itemTypeSelect.addEventListener('change', function() {
    if (this.value === 'fallen') {
        enhanceLevelSelect.value = '5';
        enhanceLevelSelect.disabled = true;
    } else {
        enhanceLevelSelect.disabled = false;
    }
    updateCalculations();
});

enhanceLevelSelect.addEventListener('change', updateCalculations);
failstackInput.addEventListener('input', updateCalculations);

document.getElementById('includePityCheckbox').addEventListener('change', updateCalculations);

// Optional: Material prices update
document.getElementById('memFragPrice').addEventListener('input', updateCalculations);
document.getElementById('essencePrice').addEventListener('input', updateCalculations);

// ===== INITIALIZE =====
updateCalculations();
