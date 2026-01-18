/* ============================
   GLOBAL DATA STORE
============================ */
let monthlyBills = [];

/* ============================
   LOAD SAVED DATA (PERSISTENCE)
============================ */
const savedBills = localStorage.getItem("monthlyBills");
if (savedBills) {
    monthlyBills = JSON.parse(savedBills);
}

/* ============================
   LOADING BAR LOGIC
============================ */
function move(newWidth) {
    document.getElementById("myFill").style.width = newWidth + "%";
    document.getElementById("label").innerText = newWidth + "%";
}

function updateFromInput() {
    const inputField = document.getElementById("quantity1");
    const val = Number(inputField.value);

    if (val >= 0 && val <= 100) {
        move(val);
    } else {
        alert("Please enter a number between 0 and 100.");
    }
}

/* ============================
   BUDGET CALCULATIONS
============================ */
function calculateBudget() {
    const income = Number(document.getElementById("quantity1")?.value) || 0;

    const billIds = [
        "bill-one",
        "bill-two",
        "bill-three",
        "bill-four",
        "bill-five",
        "bill-six",
        "bill-seven"
    ];

    const totalBills = billIds.reduce((sum, id) => {
        return sum + (Number(document.getElementById(id)?.value) || 0);
    }, 0);

    const remaining = income - totalBills;
    let percent = income > 0 ? (remaining / income) * 100 : 0;
    percent = Math.max(0, Math.min(100, percent));

    updateUI(percent, remaining);
}

function updateUI(percent, moneyLeft) {
    const bar = document.getElementById("myFill");
    const label = document.getElementById("label");
    if (!bar || !label) return;

    bar.style.width = percent + "%";
    label.innerText =
        "$" + moneyLeft.toFixed(2) +
        " remaining (" + Math.round(percent) + "%)";

    if (percent < 20) bar.dataset.status = "danger";
    else if (percent < 50) bar.dataset.status = "warning";
    else bar.dataset.status = "healthy";
}

/* ============================
   UPCOMING BILLS LOGIC
============================ */
function displayUpcomingBills() {
    const limitInput = document.getElementById("days-limit");
    if (!limitInput || !monthlyBills.length) return;

    const container = document.getElementById("bill-list-container");
    const totalDisplay = document.getElementById("upcoming-total");
    const customRange = document.getElementById("custom-range");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate = new Date(today);
    let endDate = new Date(today);

    /* ----- RANGE SELECTION ----- */
    if (limitInput.value === "custom") {
        if (customRange) customRange.style.display = "flex";

        const startVal = document.getElementById("start-date")?.value;
        const endVal = document.getElementById("end-date")?.value;
        if (!startVal || !endVal) return;

        startDate = new Date(startVal);
        endDate = new Date(endVal);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
    } else {
        if (customRange) customRange.style.display = "none";
        const limit = Number(limitInput.value) || 7;
        endDate.setDate(startDate.getDate() + limit);
    }

    let totalNeeded = 0;
    container.innerHTML = "";

    const renderQueue = [];

    monthlyBills.forEach(bill => {
        /* MONTHLY */
        if (bill.type === "monthly") {
            let billDate = new Date(startDate.getFullYear(), startDate.getMonth(), bill.day);
            if (billDate < startDate) billDate.setMonth(billDate.getMonth() + 1);

            if (billDate >= startDate && billDate <= endDate) {
                totalNeeded += bill.amount;
                renderQueue.push({
                    date: billDate,
                    name: bill.name,
                    amount: bill.amount,
                    offset: Math.ceil((billDate - today) / 86400000),
                    isPaycheck: false
                });
            }
        }

        /* WEEKLY & BI-WEEKLY */
        else {
            const baseDate = bill.lastDate ? new Date(bill.lastDate) : null;
            if (baseDate) baseDate.setHours(0, 0, 0, 0);

            const daysRange = Math.ceil((endDate - startDate) / 86400000);

            for (let d = 0; d <= daysRange; d++) {
                const checkDate = new Date(startDate);
                checkDate.setDate(startDate.getDate() + d);

                if (bill.type === "weekly" && checkDate.getDay() === bill.day) {
                    totalNeeded += bill.amount;
                    renderQueue.push({
                        date: checkDate,
                        name: bill.name,
                        amount: bill.amount,
                        offset: d,
                        isPaycheck: false
                    });
                }

                if (bill.type === "bi-weekly" && baseDate) {
                    const diffDays = Math.round((checkDate - baseDate) / 86400000);
                    if (diffDays >= 0 && diffDays % 14 === 0) {
                        renderQueue.push({
                            date: checkDate,
                            name: "💰 " + bill.name,
                            amount: bill.amount,
                            offset: d,
                            isPaycheck: true
                        });
                    }
                }
            }
        }
    });

    renderQueue
        .sort((a, b) => b.date - a.date)
        .forEach(item => {
            renderBillItem(
                container,
                item.name,
                item.amount,
                item.offset,
                item.isPaycheck
            );
        });

    totalDisplay.innerText = "Total Needed: $" + totalNeeded.toFixed(2);
}

/* ============================
   BILL RENDER HELPER
============================ */
function renderBillItem(container, name, amount, days, isPaycheck = false) {
    const div = document.createElement("div");
    div.className = "upcoming-bill-item";
    if (isPaycheck) div.style.color = "#000";

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; padding:5px 0;">
            <span><strong>${name}</strong> (${days === 0 ? "Today" : "in " + days + " days"})</span>
            <span>$${amount}</span>
        </div>
    `;

    container.appendChild(div);
}

/* ============================
   FILE UPLOAD (CSV / JSON)
============================ */
function handleBillsUpload(event) {
    console.log("Upload triggered");
    const file = event.target.files[0];
    console.log("File:", file);

    const status = document.getElementById("upload-status");
    const reader = new FileReader();

    reader.onload = e => {
        try {
            let parsed;

            if (file.name.endsWith(".json")) {
                parsed = JSON.parse(e.target.result);
            } else if (file.name.endsWith(".csv")) {
                parsed = parseCSV(e.target.result);
            } else {
                throw new Error("Unsupported file type");
            }

            monthlyBills = parsed;
            localStorage.setItem("monthlyBills", JSON.stringify(monthlyBills));

            status.innerText = `Loaded ${monthlyBills.length} bills successfully.`;
            displayUpcomingBills();
        } catch (err) {
            console.error(err);
            status.innerText = "Error loading file. Check format.";
        }
    };

    reader.readAsText(file);
}

/* ============================
   CSV PARSER
============================ */
function parseCSV(csvText) {
    csvText = csvText.replace(/^\uFEFF/, "");
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    const headers = lines.shift().split(",").map(h => h.trim());

    return lines.map(line => {
        const values = line.split(",");
        const obj = {};

        headers.forEach((h, i) => {
            let v = values[i]?.trim() ?? "";

            if (h === "amount" || h === "day") v = Number(v);
            if (v === "" || Number.isNaN(v)) v = null;

            obj[h] = v;
        });

        return obj;
    });
}


/* ============================
   INIT
============================ */
window.onload = function () {
    displayUpcomingBills();
    calculateBudget();
};
