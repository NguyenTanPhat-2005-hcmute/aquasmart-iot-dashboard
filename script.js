// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get, child, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// --- Authentication Guard ---
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'auth.html';
}

const userAccStr = localStorage.getItem('user_account');
let currentUser = userAccStr ? JSON.parse(userAccStr) : { name: "Thành viên mới", email: "user@aqua.com", password: "", role: "user" };

const ADMIN_EMAIL = "23161297@student.hcmute.edu.vn";

function encodeEmail(email) {
    return email.toLowerCase().replaceAll(".", "_").replaceAll("@", "_");
}

function isCurrentUserAdmin() {
    return currentUser.email === ADMIN_EMAIL || currentUser.role === "admin";
}

window.addEventListener('DOMContentLoaded', () => {
    const headerName = document.querySelector('.user-info strong');
    const headerEmail = document.querySelector('.user-info span');

    if (headerName) headerName.innerText = currentUser.name;
    if (headerEmail) headerEmail.innerText = currentUser.email;

    const accNameInput = document.getElementById('acc-name');
    const accEmailInput = document.getElementById('acc-email');
    const accPassInput = document.getElementById('acc-pass');
    const accForm = document.getElementById('account-form');
    
    if (accNameInput && accEmailInput) {
        accNameInput.value = currentUser.name;
        accEmailInput.value = currentUser.email;
    }

    if (accForm) {
        accForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const newName = accNameInput.value.trim();
            const newPass = accPassInput.value.trim();
            
            if (newName) {
                currentUser.name = newName;

                if (newPass) {
                    currentUser.password = newPass;
                    accPassInput.value = '';
                }

                localStorage.setItem('user_account', JSON.stringify(currentUser));

                if (!isCurrentUserAdmin()) {
                    const userKey = encodeEmail(currentUser.email);
                    set(ref(db, `approved_users/${userKey}`), currentUser).catch(console.error);
                }

                if (headerName) headerName.innerText = currentUser.name;

                alert('Cập nhật tài khoản thành công!');
            }
        });
    }

    const logoutLink = document.querySelector('.logout-link');

    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();

            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user_account');

            window.location.href = 'auth.html';
        });
    }

    initAdminPanel();
});

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDFzYwBWcOEYLmUX_3UaLeS7P-kgCVGZlg",
    authDomain: "smart-water-bottle-85d4e.firebaseapp.com",
    databaseURL: "https://smart-water-bottle-85d4e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-water-bottle-85d4e",
    storageBucket: "smart-water-bottle-85d4e.firebasestorage.app",
    messagingSenderId: "564913647295",
    appId: "1:564913647295:web:e3726087e93545a2a8e00a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Session Verification ---
async function verifyCurrentSession() {
    if (isCurrentUserAdmin()) return;

    try {
        const userKey = encodeEmail(currentUser.email || "");
        const approvedSnap = await get(child(ref(db), `approved_users/${userKey}`));

        if (!approvedSnap.exists()) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user_account');

            alert('Tài khoản chưa được quản trị viên duyệt hoặc đã bị xóa.');
            window.location.href = 'auth.html';

            return;
        }

        const approvedUser = approvedSnap.val();
        currentUser = approvedUser;

        localStorage.setItem('user_account', JSON.stringify(approvedUser));
    } catch (error) {
        console.error(error);
    }
}

verifyCurrentSession();

// --- Admin Account Management ---
function initAdminPanel() {
    const isAdmin = isCurrentUserAdmin();
    const adminItems = document.querySelectorAll('.admin-only');

    adminItems.forEach(item => {
        item.style.display = isAdmin ? '' : 'none';
    });

    if (!isAdmin) return;

    const pendingUsersRef = ref(db, 'pending_users');

    onValue(pendingUsersRef, (snapshot) => {
        const tbody = document.getElementById('pending-users-body');

        if (!tbody) return;

        tbody.innerHTML = '';

        if (!snapshot.exists()) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">Hiện không có tài khoản nào đang chờ duyệt.</td>
                </tr>
            `;

            return;
        }

        snapshot.forEach((childSnap) => {
            const key = childSnap.key;
            const user = childSnap.val();
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : 'Không rõ';

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${user.name || ''}</td>
                <td>${user.email || ''}</td>
                <td>${createdAt}</td>
                <td><span style="color: #f59e0b; font-weight: 600;">Chờ duyệt</span></td>
                <td>
                    <button class="btn-approve" data-key="${key}" style="padding: 8px 12px; border: none; border-radius: 8px; background: #10b981; color: white; cursor: pointer;">
                        Duyệt
                    </button>
                    <button class="btn-reject" data-key="${key}" style="padding: 8px 12px; border: none; border-radius: 8px; background: #ef4444; color: white; cursor: pointer; margin-left: 6px;">
                        Từ chối
                    </button>
                </td>
            `;

            tbody.appendChild(tr);

            tr.querySelector('.btn-approve').addEventListener('click', async () => {
                const approvedUser = {
                    ...user,
                    role: "user",
                    status: "approved",
                    approvedAt: new Date().toISOString(),
                    approvedBy: currentUser.email
                };

                await set(ref(db, `approved_users/${key}`), approvedUser);
                await remove(ref(db, `pending_users/${key}`));

                alert(`Đã duyệt tài khoản: ${user.email}`);
            });

            tr.querySelector('.btn-reject').addEventListener('click', async () => {
                const confirmReject = confirm(`Bạn có chắc muốn từ chối tài khoản ${user.email}?`);

                if (confirmReject) {
                    await remove(ref(db, `pending_users/${key}`));
                    alert(`Đã từ chối tài khoản: ${user.email}`);
                }
            });
        });
    });
}

// --- State ---
let dailyGoal = 2000;
let totalConsumed = 0;
let dailyChart, weeklyChart;
let localHistory = JSON.parse(localStorage.getItem('water_history')) || [];
let lastReportedConsumed = null;
let selectedDailyDate = new Date().setHours(0, 0, 0, 0);
let selectedWeeklyDate = new Date().setHours(0, 0, 0, 0);

// Biến dùng để đo delay Firebase → Web chỉ khi trạng thái uống thay đổi
let lastDrinkState = null;
let drinkChangeCount = 0;

// --- DOM Elements ---
const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const lastSyncEl = document.getElementById('last-sync');
const firebaseDelayEl = document.getElementById('firebase-delay');

const tempValueEl = document.getElementById('temp-value');
const tempCard = document.getElementById('temp-card');
const waterLevelMlEl = document.getElementById('water-level-ml');
const bottleFill = document.getElementById('bottle-water-fill');
const drinkingStatusEl = document.getElementById('drinking-status');
const drinkingIconEl = document.getElementById('drinking-icon');

const progressPercentEl = document.getElementById('progress-percent');
const intakeTextEl = document.getElementById('intake-text');
const progressCircle = document.getElementById('daily-progress');
const smartTipEl = document.getElementById('smart-tip');

// --- Navigation ---
function switchTab(tabId) {
    if (tabId === 'admin-users' && !isCurrentUserAdmin()) {
        alert('Bạn không có quyền truy cập trang quản lý tài khoản.');
        tabId = 'overview';
    }

    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    const titles = {
        overview: "Tổng quan",
        history: "Thống kê",
        advisor: "Cố vấn Sức khỏe",
        settings: "Cài đặt",
        "admin-users": "Quản lý tài khoản"
    };

    pageTitle.innerText = titles[tabId] || "Dashboard";
}

navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
});

// --- Smart Advisor Logic ---
function generateAdvisorInsights() {
    const container = document.getElementById('advisor-cards-container');
    const timeStamp = document.getElementById('advisor-time-stamp');

    if (!container) return;
    
    container.innerHTML = '';
    
    if (timeStamp) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        timeStamp.innerHTML = `<i class="fas fa-clock"></i> Cập nhật phân tích lúc: ${timeStr}`;
    }

    const currentHour = new Date().getHours();
    const progress = totalConsumed / dailyGoal;
    const safeTotal = Math.round(totalConsumed);
    const safeGoal = Math.round(dailyGoal);
    const currentLevelEl = document.getElementById('water-level-ml');
    const currentLevel = currentLevelEl ? currentLevelEl.innerText : '0';
    const drinkingStatus = drinkingStatusEl ? drinkingStatusEl.innerText.toLowerCase() : 'bình thường';
    
    let progressTitle = "Đánh giá tiến độ";
    let progressMsg = "";
    let progressIconClass = "progress-icon";
    let progressIconHtml = `<i class="fas fa-chart-line"></i>`;

    if (progress >= 1) {
        progressMsg = `Hệ thống ghi nhận bạn đã uống <strong>${safeTotal} / ${safeGoal} ml</strong>, chính thức hoàn thành mục tiêu ngày hôm nay! Hãy dừng lại hoặc chỉ uống vài ngụm nhỏ để tránh bị đầy bụng sát giờ ngủ.`;
        progressIconHtml = `<i class="fas fa-trophy"></i>`;
    } else if (progress > 0.8 && currentHour < 18) {
        progressMsg = `Tổng quát báo cáo bạn đã nạp được <strong>${safeTotal} ml</strong>. Tiến độ cực kỳ xuất sắc! Cơ thể bạn đang ở trạng thái hydrat hóa hoàn hảo, duy trì phong độ này nhé.`;
    } else if (progress < 0.3 && currentHour >= 15) {
        progressMsg = `Cảnh báo: Hiện tại là xế chiều mà bạn mới chỉ nạp <strong>${safeTotal} ml</strong> chưa tới 30% mục tiêu. Trạng thái việc uống của bạn đang là <strong>${drinkingStatus}</strong>. Việc thiếu hụt này dễ gây mệt mỏi!`;
        progressIconClass = "temp-icon";
        progressIconHtml = `<i class="fas fa-exclamation-triangle"></i>`;
    } else {
        progressMsg = `Tiến độ hiện tại: Bạn đã nạp <strong>${safeTotal} ml</strong> đạt ${Math.round(progress * 100)}%. Bình nước đang báo còn <strong>${currentLevel} ml</strong>. Hãy chia nhỏ lượng nước này ra để uống dần trong vài tiếng tới.`;
    }

    const currentTemp = tempValueEl ? (parseFloat(tempValueEl.innerText) || 25) : 25;
    let tempMsg = "";
    let tempIconHtml = `<i class="fas fa-thermometer-half"></i>`;
    
    if (currentTemp < 20) {
        tempMsg = `Cảm biến báo nhiệt độ nước đang khá mát <strong>${currentTemp}°C</strong>. Nước lạnh giúp tạo sự sảng khoái, nhưng nên hạn chế nếu khoang họng đang nhạy cảm.`;
        tempIconHtml = `<i class="fas fa-snowflake"></i>`;
    } else if (currentTemp > 35) {
        tempMsg = `Theo cảm biến, nước đang khá ấm <strong>${currentTemp}°C</strong>. Bạn nên ưu tiên uống từng ngụm chậm.`;
        tempIconHtml = `<i class="fas fa-mug-hot"></i>`;
    } else {
        tempMsg = `Nhiệt độ nước đo được hiện tại là <strong>${currentTemp}°C</strong>. Đây là mức tương đối phù hợp để sử dụng hằng ngày.`;
    }

    const tips = [
        "Uống 1 ly nước lọc ngay sau khi thức dậy giúp cơ thể bù lại lượng nước thiếu hụt qua đêm.",
        "Não bộ cần đủ nước để duy trì sự tập trung và khả năng xử lý thông tin.",
        "Khi bạn cảm thấy khát, cơ thể đã bắt đầu thiếu nước. Chủ động uống từng ngụm nhỏ là tốt nhất.",
        "Uống đủ nước đều đặn giúp duy trì độ ẩm và độ đàn hồi tự nhiên của da.",
        "Nước đóng vai trò quan trọng trong việc bôi trơn khớp và vận chuyển chất dinh dưỡng."
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    const cardsHtml = `
        <div class="advisor-card">
            <div class="advisor-icon ${progressIconClass}">
                ${progressIconHtml}
            </div>
            <div class="advisor-content">
                <h4>${progressTitle}</h4>
                <p>${progressMsg}</p>
            </div>
        </div>

        <div class="advisor-card">
            <div class="advisor-icon progress-icon">
                ${tempIconHtml}
            </div>
            <div class="advisor-content">
                <h4>Đánh giá Nhiệt độ nước</h4>
                <p>${tempMsg}</p>
            </div>
        </div>

        <div class="advisor-card">
            <div class="advisor-icon tip-icon">
                <i class="fas fa-lightbulb"></i>
            </div>
            <div class="advisor-content">
                <h4>Kiến thức sức khỏe</h4>
                <p>${randomTip}</p>
            </div>
        </div>
    `;

    container.innerHTML = cardsHtml;
}

const refreshBtn = document.getElementById('refresh-advisor-btn');

if (refreshBtn) {
    refreshBtn.addEventListener('click', generateAdvisorInsights);
}

// --- Theme Toggle ---
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
}

if (toggleSwitch) {
    toggleSwitch.addEventListener('change', switchTheme, false);

    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);

        if (currentTheme === 'dark') {
            toggleSwitch.checked = true;
        }
    }
}

// --- UI Updates ---
function updateBottleUI(levelMl) {
    if (!bottleFill) return;

    const maxCapacity = 1000;
    const percentage = Math.min((levelMl / maxCapacity) * 100, 100);
    const range = 175;
    const fillHeight = (percentage / 100) * range;
    const yPos = 195 - fillHeight;

    bottleFill.setAttribute('y', yPos);
    bottleFill.setAttribute('height', fillHeight);

    if (waterLevelMlEl) {
        waterLevelMlEl.innerText = Math.round(levelMl);
    }
}

function updateTempUI(temp) {
    if (!tempValueEl) return;

    tempValueEl.innerText = `${temp.toFixed(1)}°C`;

    if (!tempCard) return;

    tempCard.classList.remove('temp-cold', 'temp-warm', 'temp-hot');

    if (temp <= 25) {
        tempCard.classList.add('temp-cold');
    } else if (temp <= 40) {
        tempCard.classList.add('temp-warm');
    } else {
        tempCard.classList.add('temp-hot');
    }
}

function updateProgressUI() {
    const goal = dailyGoal || 2000;
    const percentage = Math.min(Math.round((totalConsumed / goal) * 100), 100);

    if (progressPercentEl) {
        progressPercentEl.innerText = `${percentage}%`;
    }

    if (intakeTextEl) {
        intakeTextEl.innerText = `${Math.round(totalConsumed)} / ${goal} ml`;
    }

    if (progressCircle) {
        const angle = (percentage / 100) * 360;
        progressCircle.style.background = `conic-gradient(#2196F3 ${angle}deg, #edf2f7 ${angle}deg)`;
    }

    if (smartTipEl) {
        if (percentage < 30) {
            smartTipEl.innerText = "Hãy uống thêm nước để duy trì năng lượng!";
        } else if (percentage < 100) {
            smartTipEl.innerText = "Sắp đạt mục tiêu rồi, cố lên!";
        } else {
            smartTipEl.innerText = "Tuyệt vời! Bạn đã uống đủ nước hôm nay.";
        }
    }
}

// --- Charts ---
function initCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
            x: { grid: { display: false } }
        }
    };

    const dailyCanvas = document.getElementById('dailyChart');
    const weeklyCanvas = document.getElementById('weeklyChart');

    if (dailyCanvas) {
        const ctxDaily = dailyCanvas.getContext('2d');

        dailyChart = new Chart(ctxDaily, {
            type: 'bar',
            data: {
                labels: ['6h', '9h', '12h', '15h', '18h', '21h'],
                datasets: [{
                    data: [0.2, 0.4, 0.3, 0.5, 0.2, 0.1],
                    backgroundColor: '#2196F3',
                    borderRadius: 5
                }]
            },
            options: chartOptions
        });
    }

    if (weeklyCanvas) {
        const ctxWeekly = weeklyCanvas.getContext('2d');

        weeklyChart = new Chart(ctxWeekly, {
            type: 'line',
            data: {
                labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
                datasets: [{
                    data: [1.8, 2.1, 1.9, 2.5, 2.0, 1.5, 2.2],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: chartOptions
        });
    }
}

// --- Firebase ---
// Đo delay Firebase → Web chỉ khi trạng thái uống thay đổi
const bottleRef = ref(db, 'smart_bottle/current_status');

onValue(bottleRef, (snapshot) => {
    const tWebStart = performance.now();
    const data = snapshot.val();

    if (data) {
        updateTempUI(data.water_temp || 0);
        updateBottleUI(data.water_level || 0);

        const currentDrinkState = data.is_drinking ? true : false;
        const drinkStateChanged = lastDrinkState !== null && currentDrinkState !== lastDrinkState;

        if (drinkingStatusEl) {
            drinkingStatusEl.innerText = currentDrinkState ? "Đang uống" : "Chưa uống";
            drinkingStatusEl.style.color = currentDrinkState ? "#10b981" : "var(--text-muted)";
        }

        if (drinkingIconEl) {
            drinkingIconEl.style.color = currentDrinkState ? "#10b981" : "var(--primary-color)";
        }

        totalConsumed = data.total_consumed || 0;
        updateProgressUI();

        if (lastReportedConsumed !== null && totalConsumed > lastReportedConsumed + 5) {
            localHistory.unshift({
                time: Date.now(),
                amount: totalConsumed - lastReportedConsumed,
                status: 'Hoàn thành'
            });

            if (localHistory.length > 50) {
                localHistory.pop();
            }

            localStorage.setItem('water_history', JSON.stringify(localHistory));

            renderSelectors();
            updateHistoryUI();
            updateDailyChartFromHistory();
            updateWeeklyChartFromHistory();
        }

        lastReportedConsumed = totalConsumed;

        const tWebEnd = performance.now();
        const firebaseToWebDelay = tWebEnd - tWebStart;

        if (lastSyncEl) {
            lastSyncEl.innerText = `Cập nhật: ${new Date().toLocaleTimeString()}`;
        }

        if (drinkStateChanged) {
            drinkChangeCount++;

            const statusText = currentDrinkState ? "Bắt đầu uống" : "Kết thúc uống";

            if (firebaseDelayEl) {
                firebaseDelayEl.innerText = `Lần ${drinkChangeCount} - ${statusText}: ${firebaseToWebDelay.toFixed(2)} ms`;
            }

            console.log("===== ĐO ĐỘ TRỄ FIREBASE → WEB =====");
            console.log("Lần thay đổi:", drinkChangeCount);
            console.log("Trạng thái:", statusText);
            console.log("tWebStart =", tWebStart.toFixed(2), "ms");
            console.log("tWebEnd =", tWebEnd.toFixed(2), "ms");
            console.log("Tweb =", firebaseToWebDelay.toFixed(2), "ms");
        }

        lastDrinkState = currentDrinkState;
    } else {
        simulateUpdate();
    }
});

function renderSelectors() {
    renderDailySelector();
    renderWeeklySelector();
}

function renderDailySelector() {
    const listEl = document.getElementById('date-scroll-list');

    if (!listEl) return;
    
    const uniqueDates = new Set();
    const dateMap = {};

    localHistory.forEach(record => {
        const d = new Date(record.time);
        const dateStr = d.toLocaleDateString('vi-VN');

        if (!uniqueDates.has(dateStr)) {
            uniqueDates.add(dateStr);
            d.setHours(0, 0, 0, 0);
            dateMap[dateStr] = d.getTime();
        }
    });

    const today = new Date();
    const todayStr = today.toLocaleDateString('vi-VN');

    today.setHours(0, 0, 0, 0);
    dateMap[todayStr] = today.getTime();

    const sortedDateStrs = Object.keys(dateMap).sort((a, b) => dateMap[b] - dateMap[a]);

    listEl.innerHTML = '';

    sortedDateStrs.forEach(dateStr => {
        const btn = document.createElement('button');

        btn.className = 'date-btn';

        if (selectedDailyDate === dateMap[dateStr]) {
            btn.classList.add('active');
        }

        btn.innerText = dateStr === todayStr ? "Hôm nay" : dateStr;
        
        btn.addEventListener('click', () => {
            listEl.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));

            btn.classList.add('active');
            selectedDailyDate = dateMap[dateStr];

            updateHistoryUI();
            updateDailyChartFromHistory();
        });
        
        listEl.appendChild(btn);
    });
}

function renderWeeklySelector() {
    const listEl = document.getElementById('week-scroll-list');

    if (!listEl) return;
    
    const uniqueWeeks = new Set();
    const weekMap = {};

    localHistory.forEach(record => {
        const d = new Date(record.time);

        d.setHours(0, 0, 0, 0);

        const day = d.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const startOfWeek = new Date(d);

        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
        
        const endOfWeek = new Date(startOfWeek);

        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const weekStr = `${startOfWeek.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${endOfWeek.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
        
        if (!uniqueWeeks.has(weekStr)) {
            uniqueWeeks.add(weekStr);
            weekMap[weekStr] = startOfWeek.getTime();
        }
    });

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const currDay = today.getDay();
    const diffCurrToMonday = currDay === 0 ? 6 : currDay - 1;
    const startOfThisWeek = new Date(today);

    startOfThisWeek.setDate(today.getDate() - diffCurrToMonday);

    const endOfThisWeek = new Date(startOfThisWeek);

    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);

    const thisWeekStr = `${startOfThisWeek.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${endOfThisWeek.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
    
    weekMap[thisWeekStr] = startOfThisWeek.getTime();

    const sortedWeekStrs = Object.keys(weekMap).sort((a, b) => weekMap[b] - weekMap[a]);

    listEl.innerHTML = '';

    sortedWeekStrs.forEach(weekStr => {
        const btn = document.createElement('button');

        btn.className = 'date-btn';
        
        const currentSelectedStartOfWeek = new Date(selectedWeeklyDate);

        currentSelectedStartOfWeek.setDate(currentSelectedStartOfWeek.getDate() - (currentSelectedStartOfWeek.getDay() === 0 ? 6 : currentSelectedStartOfWeek.getDay() - 1));
        
        if (currentSelectedStartOfWeek.getTime() === weekMap[weekStr]) {
            btn.classList.add('active');
        }

        btn.innerText = weekStr === thisWeekStr ? "Tuần này" : weekStr;
        
        btn.addEventListener('click', () => {
            listEl.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));

            btn.classList.add('active');
            selectedWeeklyDate = weekMap[weekStr];

            updateWeeklyChartFromHistory();
        });
        
        listEl.appendChild(btn);
    });
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-body');

    if (!tbody) return;

    tbody.innerHTML = '';
    
    const filteredHistory = localHistory.filter(record => {
        const d = new Date(record.time);

        d.setHours(0, 0, 0, 0);

        return d.getTime() === selectedDailyDate;
    });

    filteredHistory.slice(0, 10).forEach(record => {
        const timeStr = new Date(record.time).toLocaleTimeString('vi-VN');
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${timeStr}</td>
            <td>${Math.round(record.amount)} ml</td>
            <td><span style="color: #4caf50;">${record.status}</span></td>
        `;

        tbody.appendChild(tr);
    });
}

function updateDailyChartFromHistory() {
    if (!dailyChart) return;
    
    const refDate = new Date(selectedDailyDate);
    const isToday = refDate.toLocaleDateString('vi-VN') === new Date().toLocaleDateString('vi-VN');
    const endHour = isToday ? new Date().getHours() : 23;
    const labels = [];
    const dataVals = [];
    
    for (let i = 5; i >= 0; i--) {
        let h = endHour - i * 3;

        if (h < 0) h += 24;

        labels.push(`${h}h`);
        dataVals.push(0);
    }
    
    localHistory.forEach(record => {
        const recDate = new Date(record.time);
        const recDateStart = new Date(recDate).setHours(0, 0, 0, 0);
        
        if (recDateStart === selectedDailyDate) {
            const h = recDate.getHours();

            for (let i = labels.length - 1; i >= 0; i--) {
                const bucketH = parseInt(labels[i]);

                if (Math.abs(h - bucketH) <= 1 || (bucketH === 0 && h === 23)) {
                    dataVals[i] += record.amount / 1000;
                    break;
                }
            }
        }
    });

    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = dataVals;
    dailyChart.data.datasets[0].backgroundColor = 'rgba(33, 150, 243, 0.8)';
    dailyChart.update();
}

function updateWeeklyChartFromHistory() {
    if (!weeklyChart) return;
    
    const weeklyLabels = [];
    const weeklyDataVals = [];
    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const d = new Date(selectedWeeklyDate);
    const day = d.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(selectedWeeklyDate);

    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const todayNum = new Date().setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const dateInWeek = new Date(startOfWeek);

        dateInWeek.setDate(startOfWeek.getDate() + i);

        const isDayToday = dateInWeek.getTime() === todayNum;

        weeklyLabels.push(isDayToday ? "Hôm nay" : dayNames[i]);
        weeklyDataVals.push(0);
    }

    localHistory.forEach(record => {
        const recDay = new Date(record.time);

        recDay.setHours(0, 0, 0, 0);

        const daysFromMonday = Math.round((recDay - startOfWeek) / (1000 * 60 * 60 * 24));
        
        if (daysFromMonday >= 0 && daysFromMonday <= 6) {
            weeklyDataVals[daysFromMonday] += record.amount / 1000;
        }
    });

    weeklyChart.data.labels = weeklyLabels;
    weeklyChart.data.datasets[0].data = weeklyDataVals;
    weeklyChart.data.datasets[0].borderColor = '#00c6ff';
    weeklyChart.data.datasets[0].backgroundColor = 'rgba(0, 198, 255, 0.15)';
    weeklyChart.update();
}

function simulateUpdate() {
    let demoLevel = 350;

    setInterval(() => {
        demoLevel = 300 + Math.random() * 100;

        updateBottleUI(demoLevel);
        updateTempUI(25 + Math.random() * 5);
    }, 3000);
}

// Initial
initCharts();
updateProgressUI();
updateBottleUI(0);
renderSelectors();
generateAdvisorInsights();

if (localHistory.length > 0) {
    updateHistoryUI();

    setTimeout(() => {
        updateDailyChartFromHistory();
        updateWeeklyChartFromHistory();
    }, 100);
}

switchTab('overview');
