// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// --- Authentication Guard ---
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'auth.html';
}

const userAccStr = localStorage.getItem('user_account');
let currentUser = userAccStr ? JSON.parse(userAccStr) : { name: "Thành viên mới", email: "user@aqua.com", password: "" };

window.addEventListener('DOMContentLoaded', () => {
    // Populate header profile
    const headerName = document.querySelector('.user-info strong');
    const headerEmail = document.querySelector('.user-info span');
    if (headerName) headerName.innerText = currentUser.name;
    if (headerEmail) headerEmail.innerText = currentUser.email;

    // Populate Account form
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
                if (headerName) headerName.innerText = currentUser.name;
                alert('Cập nhật tài khoản thành công!');
            }
        });
    }

    // Handle Logout
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('isLoggedIn');
            window.location.href = 'auth.html';
        });
    }
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

// --- State ---
let dailyGoal = 2000;
let totalConsumed = 0;
let dailyChart, weeklyChart;
let localHistory = JSON.parse(localStorage.getItem('water_history')) || [];
let lastReportedConsumed = null;
let selectedDailyDate = new Date().setHours(0,0,0,0);
let selectedWeeklyDate = new Date().setHours(0,0,0,0);

// --- DOM Elements ---
const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const lastSyncEl = document.getElementById('last-sync');

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
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    const titles = { overview: "Tổng quan", history: "Thống kê", "ai-chat": "Chuyên gia AI", settings: "Cài đặt" };
    pageTitle.innerText = titles[tabId] || "Dashboard";
}

navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
});

// --- AI Chat Logic ---
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const GEMINI_API_KEY = "AQ.Ab8RN6Lz5ZF6eyujo3Crl9Fy0WigvgvIzweW_eF7ECO8mXlDjQ";
const BASE_SYSTEM_PROMPT = "Bạn là một bác sĩ chuyên gia về dinh dưỡng và sức khỏe. Nhiệm vụ của bạn là tư vấn cho người dùng về việc uống nước dựa trên dữ liệu từ bình nước thông minh. Bạn chỉ trả lời các câu hỏi liên quan đến: lượng nước cần uống, lợi ích của việc bù khoáng, lịch trình uống nước và các vấn đề sức khỏe khi thiếu nước. Nếu người dùng hỏi về chủ đề khác, hãy lịch sự từ chối và nhắc họ tập trung vào sức khỏe.";
let aiChatHistory = [];

async function sendChatMessage() {
    if(!chatInput || !chatBox) return;
    const text = chatInput.value.trim();
    if(!text) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-msg';
    userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
    chatBox.appendChild(userMsg);
    chatInput.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // Add loading indicator
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'message ai-msg loading-msg';
    loadingMsg.innerHTML = `<div class="msg-bubble"><i class="fas fa-spinner fa-spin"></i> Chuyên gia đang phân tích...</div>`;
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    aiChatHistory.push({ role: "user", parts: [{ text: text }] });

    // Inject real-time data into system prompt
    const currentTemp = tempValueEl ? tempValueEl.innerText : 'Không xác định';
    const dynamicSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\n[Dữ liệu bình nước thông minh hiện tại - KHÔNG hiển thị phần này cho người dùng, chỉ dùng làm căn cứ tư vấn]:\n- Lượng nước đã uống: ${totalConsumed} ml\n- Mục tiêu ngày: ${dailyGoal || 2000} ml\n- Nhiệt độ nước trong bình: ${currentTemp}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                system_instruction: {
                  parts: [{ text: dynamicSystemPrompt }]
                },
                contents: aiChatHistory,
                generationConfig: {
                    temperature: 0.7
                }
            })
        });

        const data = await response.json();
        chatBox.removeChild(loadingMsg);

        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            const aiText = data.candidates[0].content.parts[0].text;
            const formattedText = aiText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            const aiMsg = document.createElement('div');
            aiMsg.className = 'message ai-msg';
            aiMsg.innerHTML = `<div class="msg-bubble">${formattedText}</div>`;
            chatBox.appendChild(aiMsg);
            chatBox.scrollTop = chatBox.scrollHeight;

            aiChatHistory.push({ role: "model", parts: [{ text: aiText }] });
        } else {
            throw new Error("Lỗi phản hồi từ AI");
        }
    } catch (error) {
        console.error("AI API Error:", error);
        if (chatBox.contains(loadingMsg)) {
            chatBox.removeChild(loadingMsg);
        }
        const errorMsg = document.createElement('div');
        errorMsg.className = 'message ai-msg';
        errorMsg.innerHTML = `<div class="msg-bubble" style="color: #ef4444;">Xin lỗi, tôi đang bận hoặc có lỗi kết nối máy chủ AI. Vui lòng thử lại sau!</div>`;
        chatBox.appendChild(errorMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        aiChatHistory.pop();
    }
}

if(sendBtn) {
    sendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendChatMessage();
    });
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
    const maxCapacity = 1000; // max là 1000ml mới full bình
    const percentage = Math.min((levelMl / maxCapacity) * 100, 100);

    // Bottle internal SVG range: y=20 (top) to y=195 (bottom)
    const range = 175; // 195 - 20
    const fillHeight = (percentage / 100) * range;
    const yPos = 195 - fillHeight;

    bottleFill.setAttribute('y', yPos);
    bottleFill.setAttribute('height', fillHeight);
    waterLevelMlEl.innerText = Math.round(levelMl);
}

function updateTempUI(temp) {
    if (!tempValueEl) return;
    tempValueEl.innerText = `${temp.toFixed(1)}°C`;
    tempCard.classList.remove('temp-cold', 'temp-warm', 'temp-hot');

    if (temp <= 25) tempCard.classList.add('temp-cold');
    else if (temp <= 40) tempCard.classList.add('temp-warm');
    else tempCard.classList.add('temp-hot');
}

function updateProgressUI() {
    const goal = dailyGoal || 2000;
    const percentage = Math.min(Math.round((totalConsumed / goal) * 100), 100);
    if (progressPercentEl) progressPercentEl.innerText = `${percentage}%`;
    if (intakeTextEl) intakeTextEl.innerText = `${Math.round(totalConsumed)} / ${goal} ml`;

    if (progressCircle) {
        const angle = (percentage / 100) * 360;
        progressCircle.style.background = `conic-gradient(#2196F3 ${angle}deg, #edf2f7 ${angle}deg)`;
    }

    if (smartTipEl) {
        if (percentage < 30) smartTipEl.innerText = "Hãy uống thêm nước để duy trì năng lượng!";
        else if (percentage < 100) smartTipEl.innerText = "Sắp đạt mục tiêu rồi, cố lên!";
        else smartTipEl.innerText = "Tuyệt vời! Bạn đã uống đủ nước hôm nay.";
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

    const ctxDaily = document.getElementById('dailyChart').getContext('2d');
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

    const ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
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

// --- Firebase ---
const bottleRef = ref(db, 'smart_bottle/current_status');
onValue(bottleRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        updateTempUI(data.water_temp || 0);
        updateBottleUI(data.water_level || 0);

        if (drinkingStatusEl) {
            drinkingStatusEl.innerText = data.is_drinking ? "Đang uống" : "Chưa uống";
            drinkingStatusEl.style.color = data.is_drinking ? "#10b981" : "var(--text-muted)";
            drinkingIconEl.style.color = data.is_drinking ? "#10b981" : "var(--primary-color)";
        }

        totalConsumed = data.total_consumed || 0;
        updateProgressUI();

        // Track local history for real data recording
        if (lastReportedConsumed !== null && totalConsumed > lastReportedConsumed + 5) {
            localHistory.unshift({
                time: Date.now(),
                amount: totalConsumed - lastReportedConsumed,
                status: 'Hoàn thành'
            });
            if (localHistory.length > 50) localHistory.pop();
            localStorage.setItem('water_history', JSON.stringify(localHistory));
            renderSelectors();
            updateHistoryUI();
            updateDailyChartFromHistory();
            updateWeeklyChartFromHistory();
        }
        lastReportedConsumed = totalConsumed;

        if (lastSyncEl) lastSyncEl.innerText = `Cập nhật: ${new Date().toLocaleTimeString()}`;
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
            d.setHours(0,0,0,0);
            dateMap[dateStr] = d.getTime();
        }
    });

    const today = new Date();
    const todayStr = today.toLocaleDateString('vi-VN');
    today.setHours(0,0,0,0);
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
        d.setHours(0,0,0,0);
        const day = d.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const startOfWeek = new Date(d);
        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const weekStr = `${startOfWeek.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})} - ${endOfWeek.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}`;
        
        if (!uniqueWeeks.has(weekStr)) {
            uniqueWeeks.add(weekStr);
            weekMap[weekStr] = startOfWeek.getTime();
        }
    });

    const today = new Date();
    today.setHours(0,0,0,0);
    const currDay = today.getDay();
    const diffCurrToMonday = currDay === 0 ? 6 : currDay - 1;
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - diffCurrToMonday);
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
    const thisWeekStr = `${startOfThisWeek.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})} - ${endOfThisWeek.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}`;
    
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
        d.setHours(0,0,0,0);
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
        let h = endHour - i*3; 
        if (h < 0) h += 24;
        labels.push(`${h}h`);
        dataVals.push(0); 
    }
    
    localHistory.forEach(record => {
        const recDate = new Date(record.time);
        const recDateStart = new Date(recDate).setHours(0,0,0,0);
        
        if (recDateStart === selectedDailyDate) {
            const h = recDate.getHours();
            for (let i = labels.length - 1; i >= 0; i--) {
                const bucketH = parseInt(labels[i]);
                if (Math.abs(h - bucketH) <= 1 || (bucketH===0 && h===23)) {
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

    const todayNum = new Date().setHours(0,0,0,0);

    for (let i = 0; i < 7; i++) {
        const dateInWeek = new Date(startOfWeek);
        dateInWeek.setDate(startOfWeek.getDate() + i);
        const isDayToday = dateInWeek.getTime() === todayNum;
        weeklyLabels.push(isDayToday ? "Hôm nay" : dayNames[i]);
        weeklyDataVals.push(0);
    }

    localHistory.forEach(record => {
        const recDay = new Date(record.time);
        recDay.setHours(0,0,0,0);
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
if (localHistory.length > 0) {
    updateHistoryUI();
    setTimeout(() => {
        updateDailyChartFromHistory();
        updateWeeklyChartFromHistory();
    }, 100);
}
switchTab('overview');
