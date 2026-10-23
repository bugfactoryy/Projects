// ---------- 1. DATA ----------
const monthNames = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
const MAX_AMOUNT = 1000000000; // biggest amount we accept
const MIN_YEAR = 2000;         // year arrows stop here
const MAX_YEAR = 2100;

let problems = 0; // counts saved items that were damaged and had to be skipped

// allData keeps EVERY month. Each key is "year-month" and holds a list of transactions.
// Example: { "2026-9": [ {...}, {...} ], "2026-10": [ {...} ] }   (month 9 = October)
let allData = cleanAllData(loadFromStorage("spendwiseData", {}));

// budgets keeps ONE budget for EVERY month, with the same kind of key.
// Example: { "2026-9": 5000, "2026-10": 4500 }
let budgets = cleanBudgets(loadFromStorage("spendwiseBudgets", {}));

let filter = "all";          // selected tab: all, income or expense
let selectedType = "expense"; // selected in the form: income or expense

// The real date comes from your computer's clock
let now = new Date();
let viewYear = now.getFullYear();  // year we are looking at
let viewMonth = now.getMonth();    // month we are looking at (0 = January ... 11 = December)

// ---------- 2. LOADING SAVED DATA SAFELY ----------
// Reads text from localStorage and turns it into data.
// If anything goes wrong (damaged text, storage blocked) we use the fallback instead of crashing.
function loadFromStorage(name, fallback) {
  let text = null;
  try {
    text = localStorage.getItem(name);
    if (text === null) {
      return fallback;           // nothing saved yet
    }
    return JSON.parse(text);     // this line crashes if the text is damaged
  } catch (error) {
    problems++;
    try {
      if (text !== null) {
        localStorage.setItem(name + "Backup", text); // keep a copy of the damaged text
      }
    } catch (error2) {
      // storage is not usable, nothing more to do
    }
    return fallback;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// A good key looks like "2026-9": 4 digits, a dash, month 0 to 11
function isGoodKey(key) {
  if (/^\d{4}-\d{1,2}$/.test(key) === false) return false;
  let month = Number(key.split("-")[1]);
  return month >= 0 && month <= 11;
}

function newId() {
  return Date.now() + Math.random();
}

// Checks ONE saved transaction. Returns a clean copy, or null if it is not usable.
function fixTransaction(item) {
  if (!isObject(item)) return null;
  if (typeof item.title !== "string" || item.title.trim() === "") return null;
  if (item.type !== "income" && item.type !== "expense") return null;
  if (typeof item.amount !== "number" || !isFinite(item.amount)) return null;
  if (item.amount <= 0 || item.amount > MAX_AMOUNT) return null;

  return {
    id: typeof item.id === "number" ? item.id : newId(),
    title: item.title.trim().slice(0, 50),
    amount: item.amount,
    type: item.type,
    date: typeof item.date === "string" ? item.date : ""
  };
}

// Goes through everything that was saved and keeps only the good parts
function cleanAllData(data) {
  let clean = {};
  if (!isObject(data)) {
    problems++;
    return clean;
  }

  for (let key in data) {
    if (!isGoodKey(key) || !Array.isArray(data[key])) {
      problems++;
      continue;
    }
    clean[key] = [];
    for (let i = 0; i < data[key].length; i++) {
      let t = fixTransaction(data[key][i]);
      if (t === null) {
        problems++;
      } else {
        clean[key].push(t);
      }
    }
  }
  return clean;
}

function cleanBudgets(data) {
  let clean = {};
  if (!isObject(data)) {
    problems++;
    return clean;
  }

  for (let key in data) {
    let value = data[key];
    if (isGoodKey(key) && typeof value === "number" && isFinite(value) && value > 0 && value <= MAX_AMOUNT) {
      clean[key] = value;
    } else {
      problems++;
    }
  }
  return clean;
}

// ---------- 3. SMALL HELPERS ----------
function getKey(year, month) {
  return year + "-" + month;
}

// The list of transactions of the month we are looking at
function currentList() {
  let key = getKey(viewYear, viewMonth);
  if (!allData[key]) {
    allData[key] = [];
  }
  return allData[key];
}

// The budget of the month we are looking at (0 means no budget)
function getBudget() {
  return budgets[getKey(viewYear, viewMonth)] || 0;
}

let saveWarningShown = false;
function saveData() {
  try {
    localStorage.setItem("spendwiseData", JSON.stringify(allData));
    localStorage.setItem("spendwiseBudgets", JSON.stringify(budgets));
  } catch (error) {
    if (saveWarningShown === false) {
      alert("Could not save your data in this browser. It will be lost when you close the page.");
      saveWarningShown = true;
    }
  }
}

// Total income and expense of ANY list of transactions
function getTotalsOf(list) {
  let income = 0;
  let expense = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === "income") {
      income += list[i].amount;
    } else {
      expense += list[i].amount;
    }
  }
  return { income: income, expense: expense };
}

// Totals of the month we are looking at
function getTotals() {
  return getTotalsOf(currentList());
}

// Turns a number into text like "৳150" or "-৳20.5" (rounded to 2 decimals)
function money(number) {
  let rounded = Math.round(number * 100) / 100;
  let sign = rounded < 0 ? "-" : "";
  return sign + "৳" + Math.abs(rounded);
}

function pad(number) {
  return number < 10 ? "0" + number : "" + number;
}

// Builds a date text like "2026-10-05" (month is 0 to 11)
function makeDate(year, month, day) {
  return year + "-" + pad(month + 1) + "-" + pad(day);
}

// "2026-10-05" -> "5 Oct 2026". Old saved dates in another format are shown as they are.
function formatDate(text) {
  if (text === "") return "No date";
  let parts = text.split("-");
  if (parts.length !== 3) return text;
  let month = Number(parts[1]);
  if (!(month >= 1 && month <= 12)) return text;
  return Number(parts[2]) + " " + monthNames[month - 1].slice(0, 3) + " " + parts[0];
}

// Checks an amount typed by the user.
// Returns the number (rounded to 2 decimals), or 0 if it is empty, not a number, zero or negative.
function checkAmount(text) {
  if (text === "") return 0;
  let number = Number(text);
  if (isNaN(number) || !isFinite(number)) return 0;
  number = Math.round(number * 100) / 100;
  if (number <= 0 || number > MAX_AMOUNT) return 0;
  return number;
}

function showError(id, message) {
  let box = document.getElementById(id);
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError(id) {
  document.getElementById(id).classList.add("hidden");
}

// The date box only allows days of the month we are looking at
function resetDateInput() {
  let input = document.getElementById("date");
  let lastDay = new Date(viewYear, viewMonth + 1, 0).getDate(); // day 0 of next month = last day of this month
  input.min = makeDate(viewYear, viewMonth, 1);
  input.max = makeDate(viewYear, viewMonth, lastDay);

  // today's date if we are in the real current month, otherwise the 1st
  let isNow = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  input.value = isNow ? makeDate(viewYear, viewMonth, now.getDate()) : input.min;
}

// ---------- 4. ACTIONS (things the user clicks) ----------
function addTransaction() {
  let title = document.getElementById("title").value.trim();
  let amountText = document.getElementById("amount").value.trim();
  let date = document.getElementById("date").value;

  // Check everything first. If something is wrong, show a message and stop.
  if (title === "") {
    showError("error", "Please enter a title.");
    return;
  }
  if (title.length > 50) {
    showError("error", "The title can be at most 50 characters.");
    return;
  }

  let amount = checkAmount(amountText);
  if (amount === 0) {
    showError("error", "Amount must be a number above 0 (and at most " + MAX_AMOUNT + ").");
    return;
  }

  if (date === "") {
    showError("error", "Please choose a date.");
    return;
  }
  // The date must be inside the month we are looking at, e.g. "2026-10"
  if (date.slice(0, 7) !== makeDate(viewYear, viewMonth, 1).slice(0, 7)) {
    showError("error", "The date must be in " + monthNames[viewMonth] + " " + viewYear + ".");
    return;
  }

  hideError("error");

  // Each transaction is one object, added to the month we are looking at
  currentList().push({
    id: newId(),
    title: title,
    amount: amount,
    type: selectedType,
    date: date
  });
  saveData();

  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";
  showAll();
}

function deleteTransaction(id) {
  // keep every transaction except the one with this id
  let key = getKey(viewYear, viewMonth);
  allData[key] = currentList().filter(function (t) {
    return t.id !== id;
  });
  saveData();
  showAll();
}

// Income / Expense buttons in the form
function setType(value) {
  selectedType = value;
  showTypeButtons();
}

function setFilter(value) {
  filter = value;
  showAll();
}

// Saves the budget for the month we are looking at
function setBudget() {
  let value = checkAmount(document.getElementById("budgetInput").value.trim());
  if (value === 0) {
    showError("budgetError", "The budget must be a number above 0 (and at most " + MAX_AMOUNT + ").");
    return;
  }

  hideError("budgetError");
  budgets[getKey(viewYear, viewMonth)] = value;
  saveData();
  document.getElementById("budgetInput").value = "";
  showBudget();
}

// Used after the month or year changes
function afterViewChange() {
  resetDateInput();
  hideError("error");
  hideError("budgetError");
  showAll();
}

// Click a month in the left panel
function selectMonth(month) {
  viewMonth = month;
  afterViewChange();
}

// Year arrows
function changeYear(step) {
  let newYear = viewYear + step;
  if (newYear < MIN_YEAR || newYear > MAX_YEAR) return;
  viewYear = newYear;
  afterViewChange();
}

// Jump back to the real current month
function goToToday() {
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  afterViewChange();
}

// ---------- 5. SHOW THINGS ON THE SCREEN ----------
function showTypeButtons() {
  let base = "rounded-xl py-2.5 font-bold transition ";
  let incomeBtn = document.getElementById("typeIncome");
  let expenseBtn = document.getElementById("typeExpense");

  if (selectedType === "income") {
    incomeBtn.className = base + "bg-emerald-500 text-white";
    expenseBtn.className = base + "bg-slate-100 text-slate-500 hover:bg-rose-50";
  } else {
    incomeBtn.className = base + "bg-slate-100 text-slate-500 hover:bg-emerald-50";
    expenseBtn.className = base + "bg-rose-500 text-white";
  }
}

function showTotals() {
  let totals = getTotals();
  document.getElementById("monthTitle").textContent = monthNames[viewMonth] + " " + viewYear;
  document.getElementById("income").textContent = money(totals.income);
  document.getElementById("expense").textContent = money(totals.expense);
  document.getElementById("balance").textContent = money(totals.income - totals.expense);

  // show the "Go to this month" button only when we are looking at another month
  let isNow = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  document.getElementById("todayBtn").classList.toggle("invisible", isNow);
}

function showStats() {
  let list = currentList();

  // 1) number of transactions
  document.getElementById("statCount").textContent = list.length;

  // 2) biggest single expense and 3) biggest single income
  let biggestExpense = 0;
  let biggestIncome = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === "expense" && list[i].amount > biggestExpense) {
      biggestExpense = list[i].amount;
    }
    if (list[i].type === "income" && list[i].amount > biggestIncome) {
      biggestIncome = list[i].amount;
    }
  }
  document.getElementById("statBiggest").textContent = money(biggestExpense);
  document.getElementById("statBiggestIncome").textContent = money(biggestIncome);
}

// Builds ONE row of the transaction list.
// We use textContent for the title, so whatever the user types is shown as plain text
// and is never run as HTML.
function makeListItem(t) {
  let isIncome = t.type === "income";

  let row = document.createElement("li");
  row.className = "item-in flex items-center justify-between gap-3 py-3";

  // left side: title and date
  let left = document.createElement("div");
  left.className = "min-w-0";
  let title = document.createElement("p");
  title.className = "font-bold break-words";
  title.textContent = t.title;
  let date = document.createElement("p");
  date.className = "text-sm text-slate-400";
  date.textContent = formatDate(t.date);
  left.appendChild(title);
  left.appendChild(date);

  // right side: amount and delete button
  let right = document.createElement("div");
  right.className = "flex items-center gap-4 shrink-0";
  let amount = document.createElement("span");
  amount.className = "font-bold " + (isIncome ? "text-emerald-600" : "text-rose-500");
  amount.textContent = (isIncome ? "+" : "-") + money(t.amount);
  let deleteBtn = document.createElement("button");
  deleteBtn.className = "text-slate-300 hover:text-rose-500 text-xl";
  deleteBtn.title = "Delete";
  deleteBtn.textContent = "\u00d7";
  deleteBtn.onclick = function () {
    deleteTransaction(t.id);
  };
  right.appendChild(amount);
  right.appendChild(deleteBtn);

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

function showList() {
  let list = document.getElementById("list");
  let items = currentList();
  list.innerHTML = ""; // only empties the list, no user text is inserted here

  // Highlight the active filter button
  let names = ["all", "income", "expense"];
  for (let i = 0; i < names.length; i++) {
    let btn = document.getElementById("btn-" + names[i]);
    if (names[i] === filter) {
      btn.className = "px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white";
    } else {
      btn.className = "px-4 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200";
    }
  }

  let shown = 0;
  // Show newest added first
  for (let i = items.length - 1; i >= 0; i--) {
    if (filter !== "all" && items[i].type !== filter) continue; // skip if it doesn't match the tab
    shown++;
    list.appendChild(makeListItem(items[i]));
  }

  if (shown === 0) {
    let empty = document.createElement("li");
    empty.className = "py-16 text-center text-slate-400";
    empty.textContent = "Nothing here yet. Add your first transaction from the form.";
    list.appendChild(empty);
  }
}

function showBudget() {
  let bar = document.getElementById("budgetBar");
  let text = document.getElementById("budgetText");
  let budget = getBudget();
  let monthText = monthNames[viewMonth] + " " + viewYear;

  if (budget <= 0) {
    bar.style.width = "0%";
    bar.className = "bar-fill h-3 rounded-full bg-emerald-500";
    text.textContent = "No budget set for " + monthText + ".";
    return;
  }

  let spent = getTotals().expense;
  let percent = Math.round((spent / budget) * 100);
  bar.style.width = Math.min(percent, 100) + "%";
  let start = monthText + " budget: " + money(budget) + ". ";

  // Change the bar color depending on how much is used
  if (percent >= 100) {
    bar.className = "bar-fill h-3 rounded-full bg-rose-500";
    text.textContent = start + "Over budget by " + money(spent - budget) + ".";
  } else if (percent >= 75) {
    bar.className = "bar-fill h-3 rounded-full bg-amber-400";
    text.textContent = start + "Careful: " + percent + "% used, " + money(budget - spent) + " left.";
  } else {
    bar.className = "bar-fill h-3 rounded-full bg-emerald-500";
    text.textContent = start + percent + "% used, " + money(budget - spent) + " left.";
  }
}

// Left side: all 12 months of the year, click one to open it
// (innerHTML is safe here: it only contains month names and numbers made by our own code)
function showMonths() {
  let box = document.getElementById("months");
  box.innerHTML = "";

  for (let i = 0; i < 12; i++) {
    let list = allData[getKey(viewYear, i)] || [];
    let totals = getTotalsOf(list);
    let balance = totals.income - totals.expense;

    // is this the month we are looking at? is it the real current month?
    let isSelected = i === viewMonth;
    let isNow = viewYear === now.getFullYear() && i === now.getMonth();

    let boxClass = isSelected
      ? "bg-indigo-600 text-white"
      : "bg-slate-50 hover:bg-indigo-50 text-slate-700";

    // balance text: "-" when the month is empty
    let balanceText = list.length === 0 ? "-" : money(balance);
    let nowTag = isNow ? ' <span class="text-xs font-medium opacity-70">(now)</span>' : "";

    box.innerHTML += `
      <button onclick="selectMonth(${i})"
        class="stat-card w-full flex justify-between items-center rounded-2xl px-4 py-3 text-left ${boxClass}">
        <span class="font-bold">${monthNames[i]}${nowTag}</span>
        <span class="font-bold">${balanceText}</span>
      </button>`;
  }
}

// Left side: totals for the whole year (all 12 months added together)
function showYear() {
  let income = 0;
  let expense = 0;

  for (let i = 0; i < 12; i++) {
    let totals = getTotalsOf(allData[getKey(viewYear, i)] || []);
    income += totals.income;
    expense += totals.expense;
  }

  document.getElementById("yearTitle").textContent = viewYear + " summary";
  document.getElementById("yearIncome").textContent = money(income);
  document.getElementById("yearExpense").textContent = money(expense);
  document.getElementById("yearSaved").textContent = money(income - expense);
}

// Update every part of the page
function showAll() {
  showTypeButtons();
  showTotals();
  showStats();
  showList();
  showBudget();
  showMonths();
  showYear();
}

// ---------- 6. START ----------
document.getElementById("today").textContent = now.toDateString();
resetDateInput();
showAll();

if (problems > 0) {
  saveData(); // replace the damaged text with the cleaned data, so this message does not repeat
  alert("Some saved data was damaged, so it was skipped. The rest was loaded normally.");
}
