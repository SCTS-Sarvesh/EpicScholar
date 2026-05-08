const API_URL = 'https://epicscholar.cloud/api';
const feedbackMessage = document.getElementById('feedback-message');
function showFeedback(message) {
    feedbackMessage.textContent = message;
    feedbackMessage.classList.add('show');
    setTimeout(() => feedbackMessage.classList.remove('show'), 2600);
}

/* -------------------------------------------
    AUTH & USER STATE
------------------------------------------- */
const state = {
    posts: [],
    currentUser: null,
    token: null,
    notifications: [],
    unreadCount: 0
};

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) {
        window.location.href = '/';
        return false;
    }
    state.token = token;
    state.currentUser = JSON.parse(user);
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

/* -------------------------------------------
    API HELPER
------------------------------------------- */
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${state.token}`,
            ...options.headers
        }
    };
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        ...defaultOptions
    });
    if (response.status === 401 || response.status === 403) {
        logout();
        return null;
    }
    return response.json();
}

function escapeHtml(s) {
    return String(s).replace(/[&"'<>]/g, c => ({
        '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;'
    }[c]));
}

function timeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return time.toLocaleDateString();
}

/* -------------------------------------------
    SELF-STUDY DATA (for Schedule & Tests cards)
------------------------------------------- */
let selfStudySessions = [];

async function loadSelfStudyData() {
    try {
        const studyToken = localStorage.getItem('token') || localStorage.getItem('epicScholarToken') || state.token;
        if (!studyToken) return;

        const res = await fetch('https://epicscholar.cloud/api/study/sessions', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studyToken}`
            }
        });
        const data = await res.json();
        if (data && data.success && data.sessions) {
            selfStudySessions = data.sessions.map(s => ({
                id: s.id,
                title: s.title,
                subject: s.subject || '',
                type: s.type || 'Session',
                datetime: s.datetime,
                duration: s.duration || 60,
                is_completed: s.is_completed || 0
            }));
        }
    } catch (err) {
        console.warn('Could not load self-study sessions for home cards:', err);
    }
}

/* ---- Schedule Card ---- */
function renderScheduleCard() {
    const schedulesList = document.getElementById('schedulesList');
    if (!schedulesList) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const todaySessions = selfStudySessions.filter(s => {
        if (!s.datetime) return false;
        return new Date(s.datetime).toLocaleDateString('en-CA') === todayStr && s.type !== 'Test';
    });

    // Also show next 3 days upcoming sessions
    const upcomingSessions = selfStudySessions.filter(s => {
        if (!s.datetime) return false;
        const d = new Date(s.datetime);
        const dayStr = d.toLocaleDateString('en-CA');
        const threeDaysLater = new Date();
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        return dayStr !== todayStr && d <= threeDaysLater && d >= new Date() && s.type !== 'Test';
    });

    if (todaySessions.length === 0 && upcomingSessions.length === 0) {
        schedulesList.innerHTML = `
            <li style="padding:20px;text-align:center;opacity:0.6;">
                <div style="font-size:36px;margin-bottom:8px;">📅</div>
                <div style="font-size:14px;">No sessions scheduled</div>
                <div style="font-size:12px;margin-top:4px;opacity:0.7;">Go to Self-Study to add sessions</div>
            </li>`;
        return;
    }

    let html = '';

    if (todaySessions.length > 0) {
        html += `<li style="padding:6px 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">Today</li>`;
        todaySessions.forEach(s => {
            const time = new Date(s.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            html += `
                <li style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:10px;align-items:center;">
                    <div style="width:36px;height:36px;min-width:36px;border-radius:10px;background:linear-gradient(135deg,rgba(0,114,255,0.25),rgba(0,212,255,0.15));display:flex;align-items:center;justify-content:center;font-size:17px;">📚</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.title)}</div>
                        <div style="font-size:11px;opacity:0.55;margin-top:2px;">${escapeHtml(s.subject || 'General')} · ${time} · ${s.duration}min</div>
                    </div>
                    <div style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(0,114,255,0.15);color:#00c6ff;white-space:nowrap;">Today</div>
                </li>`;
        });
    }

    if (upcomingSessions.length > 0) {
        html += `<li style="padding:6px 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.06);margin:8px 0;">Upcoming</li>`;
        upcomingSessions.slice(0, 3).forEach(s => {
            const d = new Date(s.datetime);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            html += `
                <li style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:10px;align-items:center;">
                    <div style="width:36px;height:36px;min-width:36px;border-radius:10px;background:linear-gradient(135deg,rgba(255,65,108,0.15),rgba(255,148,30,0.12));display:flex;align-items:center;justify-content:center;font-size:17px;">📖</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.title)}</div>
                        <div style="font-size:11px;opacity:0.55;margin-top:2px;">${escapeHtml(s.subject || 'General')} · ${dateStr}, ${time}</div>
                    </div>
                </li>`;
        });
    }

    schedulesList.innerHTML = html;
}

/* ---- Tests & Quizzes Card ---- */
function renderTestsCard() {
    const testsList = document.getElementById('testsList');
    if (!testsList) return;

    const now = new Date();
    const upcomingTests = selfStudySessions
        .filter(s => s.type === 'Test' && s.datetime && new Date(s.datetime) >= new Date(now.toLocaleDateString('en-CA')))
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    if (upcomingTests.length === 0) {
        testsList.innerHTML = `
            <li style="padding:20px;text-align:center;opacity:0.6;">
                <div style="font-size:36px;margin-bottom:8px;">📒</div>
                <div style="font-size:14px;">No upcoming tests</div>
                <div style="font-size:12px;margin-top:4px;opacity:0.7;">Go to Self-Study to schedule tests</div>
            </li>`;
        return;
    }

    const todayStr = now.toLocaleDateString('en-CA');

    let html = '';
    upcomingTests.slice(0, 5).forEach(s => {
        const d = new Date(s.datetime);
        const dayStr = d.toLocaleDateString('en-CA');
        const isToday = dayStr === todayStr;
        const dateLabel = isToday
            ? 'Today'
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const badgeBg = isToday ? 'rgba(255,65,108,0.2)' : 'rgba(255,149,0,0.15)';
        const badgeColor = isToday ? '#ff416c' : '#ff9500';

        html += `
            <li style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:10px;align-items:center;">
                <div style="width:36px;height:36px;min-width:36px;border-radius:10px;background:linear-gradient(135deg,rgba(255,65,108,0.2),rgba(255,148,30,0.15));display:flex;align-items:center;justify-content:center;font-size:17px;">📝</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.title)}</div>
                    <div style="font-size:11px;opacity:0.55;margin-top:2px;">${escapeHtml(s.subject || 'General')} · ${time} · ${s.duration}min</div>
                </div>
                <div style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:${badgeBg};color:${badgeColor};white-space:nowrap;">${escapeHtml(dateLabel)}</div>
            </li>`;
    });

    testsList.innerHTML = html;
}

/* -------------------------------------------
    NOTIFICATIONS
------------------------------------------- */
async function loadNotifications() {
    try {
        const data = await apiCall('/notifications');
        if (!data || !data.success) return;
        state.notifications = data.notifications;
        state.unreadCount = data.unreadCount;
        updateNotificationBadge();
        renderNotifications();
    } catch (error) {
        console.error('Notification load error:', error);
    }
}

function updateNotificationBadge() {
    const notifCard = document.getElementById('notifsCard');
    if (!notifCard) return;
    let badge = notifCard.querySelector('.notif-badge');
    if (badge) badge.remove();
    if (state.unreadCount > 0) {
        badge = document.createElement('div');
        badge.className = 'notif-badge';
        badge.textContent = state.unreadCount > 99 ? '99+' : state.unreadCount;
        badge.style.cssText = `
            position: absolute; top: -5px; right: -5px;
            background: linear-gradient(135deg, #ff416c, #ff4b2b);
            color: white; border-radius: 50%; width: 22px; height: 22px;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700;
            box-shadow: 0 2px 8px rgba(255,65,108,0.6); animation: pulse 2s infinite;
        `;
        notifCard.appendChild(badge);
    }
}

function renderNotifications() {
    const notifList = document.getElementById('notifList');
    if (!notifList) return;

    if (state.notifications.length === 0) {
        notifList.innerHTML = `
            <li style="padding:30px;text-align:center;opacity:0.6;">
                <div style="font-size:48px;margin-bottom:10px;">🔔</div>
                <div style="font-size:16px;">No notifications yet</div>
                <div style="font-size:13px;margin-top:5px;opacity:0.7;">You'll see notifications here when people interact with your content</div>
            </li>`;
        return;
    }

    const iconMap = { follow: '👤', post: '📸', comment: '💬', reaction: '❤️', message: '✉️' };

    notifList.innerHTML = state.notifications.map(notif => {
        const isUnread = !notif.is_read;
        const icon = iconMap[notif.type] || '🔔';
        return `
            <li class="notif-item ${isUnread ? 'unread' : ''}" data-id="${notif.id}" style="
                padding:15px; margin-bottom:10px; border-radius:12px; cursor:pointer; transition:all 0.2s; position:relative;
                background:${isUnread ? 'rgba(0,114,255,0.1)' : 'rgba(255,255,255,0.03)'};
                border:1px solid ${isUnread ? 'rgba(0,114,255,0.3)' : 'var(--card-glass-border)'};
            ">
                <div style="display:flex;gap:12px;align-items:start;">
                    <div style="width:40px;height:40px;border-radius:50%;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${icon}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:14px;line-height:1.4;margin-bottom:4px;">${escapeHtml(notif.message)}</div>
                        <div style="font-size:12px;opacity:0.6;">${timeAgo(notif.created_at)}</div>
                    </div>
                    ${isUnread ? '<div style="width:8px;height:8px;border-radius:50%;background:#0072ff;position:absolute;top:50%;right:15px;transform:translateY(-50%);"></div>' : ''}
                </div>
            </li>`;
    }).join('');

    notifList.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => markNotificationAsRead(item.dataset.id));
    });
}

async function markNotificationAsRead(notificationId) {
    try {
        await apiCall('/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId: parseInt(notificationId) })
        });
        const notif = state.notifications.find(n => n.id == notificationId);
        if (notif && !notif.is_read) {
            notif.is_read = 1;
            state.unreadCount = Math.max(0, state.unreadCount - 1);
            updateNotificationBadge();
            renderNotifications();
        }
    } catch (error) {
        console.error('Mark read error:', error);
    }
}

async function clearAllNotifications() {
    if (!confirm('Clear all notifications?')) return;
    try {
        await apiCall('/notifications', { method: 'DELETE' });
        state.notifications = [];
        state.unreadCount = 0;
        updateNotificationBadge();
        renderNotifications();
        showFeedback('All notifications cleared! 🗑️');
    } catch (error) {
        console.error('Clear notifications error:', error);
        showFeedback('Failed to clear notifications');
    }
}

/* -------------------------------------------
    REMINDERS
------------------------------------------- */
const remindersState = { reminders: [], showCompleted: true };

async function loadReminders() {
    try {
        const data = await apiCall('/reminders');
        if (!data || !data.success) return;
        remindersState.reminders = data.reminders;
        renderReminders();
    } catch (error) {
        console.error('Load Reminders Error:', error);
    }
}

function renderReminders() {
    const remindersList = document.getElementById('remindersList');
    if (!remindersList) return;

    const activeReminders = remindersState.reminders.filter(r => !r.is_completed);
    const completedReminders = remindersState.reminders.filter(r => r.is_completed);

    if (remindersState.reminders.length === 0) {
        remindersList.innerHTML = `
            <li style="padding:30px;text-align:center;opacity:0.6;">
                <div style="font-size:48px;margin-bottom:10px;">⏰</div>
                <div style="font-size:16px;">No reminders yet</div>
                <div style="font-size:13px;margin-top:5px;opacity:0.7;">Add a reminder to stay organized</div>
            </li>`;
        return;
    }

    const priorityColors = { high: '#ff416c', medium: '#ff9500', low: '#00d4ff' };
    const priorityIcons = { high: '🔴', medium: '🟡', low: '🟢' };
    let html = '';

    activeReminders.forEach(reminder => {
        let isOverdue = false, dateStr = 'No due date';
        if (reminder.reminder_date) {
            const dueDate = new Date(reminder.reminder_date.replace(' ', 'T'));
            isOverdue = dueDate < new Date();
            dateStr = dueDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        html += `
            <li class="reminder-item" data-id="${reminder.id}" style="
                padding:15px;margin-bottom:10px;border-radius:12px;cursor:pointer;transition:all 0.2s;position:relative;
                background:rgba(255,255,255,0.05);border:1px solid var(--card-glass-border);
                border-left:4px solid ${priorityColors[reminder.priority]};
            ">
                <div style="display:flex;gap:12px;align-items:start;">
                    <div onclick="toggleReminder(${reminder.id});event.stopPropagation();" style="
                        width:24px;height:24px;min-width:24px;border-radius:50%;margin-top:2px;
                        border:2px solid ${priorityColors[reminder.priority]};cursor:pointer;transition:all 0.2s;
                        display:flex;align-items:center;justify-content:center;
                    "></div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                            <span style="font-size:14px;">${priorityIcons[reminder.priority]}</span>
                            <div style="font-weight:600;font-size:15px;line-height:1.3;">${escapeHtml(reminder.title)}</div>
                        </div>
                        <div style="font-size:13px;opacity:0.8;margin-bottom:8px;line-height:1.4;">${escapeHtml(reminder.text)}</div>
                        <div style="display:flex;align-items:center;gap:10px;font-size:12px;opacity:0.7;">
                            <span style="color:${isOverdue ? '#ff416c' : 'inherit'};">📅 ${dateStr}</span>
                            ${isOverdue ? '<span style="color:#ff416c;font-weight:600;">Overdue</span>' : ''}
                        </div>
                    </div>
                    <button onclick="deleteReminder(${reminder.id});event.stopPropagation();" style="
                        background:rgba(255,65,108,0.2);color:#ff416c;border:none;
                        width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;transition:all 0.2s;
                    " onmouseover="this.style.background='rgba(255,65,108,0.3)'" onmouseout="this.style.background='rgba(255,65,108,0.2)'">🗑️</button>
                </div>
            </li>`;
    });

    if (completedReminders.length > 0 && remindersState.showCompleted) {
        html += `<div style="padding:10px 5px;margin:15px 0 10px 0;border-top:1px solid var(--card-glass-border);opacity:0.6;font-size:13px;font-weight:600;">✅ Completed (${completedReminders.length})</div>`;
        completedReminders.forEach(reminder => {
            html += `
                <li class="reminder-item completed" data-id="${reminder.id}" style="
                    padding:12px;margin-bottom:8px;border-radius:10px;opacity:0.6;cursor:pointer;transition:all 0.2s;
                    background:rgba(255,255,255,0.02);border:1px solid var(--card-glass-border);
                ">
                    <div style="display:flex;gap:12px;align-items:start;">
                        <div onclick="toggleReminder(${reminder.id});event.stopPropagation();" style="
                            width:24px;height:24px;min-width:24px;border-radius:50%;background:var(--primary-color);
                            cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;
                        ">✓</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:14px;text-decoration:line-through;opacity:0.8;margin-bottom:3px;">${escapeHtml(reminder.title)}</div>
                            <div style="font-size:12px;opacity:0.6;text-decoration:line-through;">${escapeHtml(reminder.text)}</div>
                        </div>
                        <button onclick="deleteReminder(${reminder.id});event.stopPropagation();" style="
                            background:rgba(255,65,108,0.1);color:#ff416c;border:none;
                            width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;transition:all 0.2s;
                        ">🗑️</button>
                    </div>
                </li>`;
        });
    }

    remindersList.innerHTML = html;
}

function openAddReminderModal() {
    const modal = document.createElement('div');
    modal.id = 'addReminderModal';
    modal.className = 'modal show';
    modal.style.zIndex = '3000';
    modal.innerHTML = `
        <div style="
            width: min(480px, calc(100vw - 32px));
            background: var(--card-glass-bg);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border: 1px solid var(--card-glass-border);
            border-radius: 24px;
            padding: 32px;
            box-shadow: var(--shadow-deep);
            display: flex;
            flex-direction: column;
            gap: 20px;
            box-sizing: border-box;
        ">
            <h3 style="
                margin: 0;
                font-size: 22px;
                font-weight: 800;
                background: var(--primary-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            ">⏰ New Reminder</h3>

            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--text-color); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.8px;">Title</label>
                <input type="text" id="reminderTitle" placeholder="What do you need to do?" style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid var(--card-glass-border);
                    background: var(--secondary-glass);
                    color: var(--text-color);
                    font-size: 15px;
                    outline: none;
                    box-sizing: border-box;
                    transition: border-color 0.2s, box-shadow 0.2s;
                " onfocus="this.style.borderColor='var(--primary-color)';this.style.boxShadow='0 0 0 3px rgba(0,114,255,0.12)'" onblur="this.style.borderColor='var(--card-glass-border)';this.style.boxShadow='none'">
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--text-color); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.8px;">Description</label>
                <textarea id="reminderText" placeholder="Add details..." rows="3" style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid var(--card-glass-border);
                    background: var(--secondary-glass);
                    color: var(--text-color);
                    font-size: 15px;
                    resize: none;
                    outline: none;
                    box-sizing: border-box;
                    font-family: inherit;
                    transition: border-color 0.2s, box-shadow 0.2s;
                " onfocus="this.style.borderColor='var(--primary-color)';this.style.boxShadow='0 0 0 3px rgba(0,114,255,0.12)'" onblur="this.style.borderColor='var(--card-glass-border)';this.style.boxShadow='none'"></textarea>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--text-color); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.8px;">Due Date</label>
                <input type="date" id="reminderDate" style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid var(--card-glass-border);
                    background: var(--secondary-glass);
                    color: var(--text-color);
                    font-size: 15px;
                    outline: none;
                    box-sizing: border-box;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    color-scheme: dark;
                " onfocus="this.style.borderColor='var(--primary-color)';this.style.boxShadow='0 0 0 3px rgba(0,114,255,0.12)'" onblur="this.style.borderColor='var(--card-glass-border)';this.style.boxShadow='none'">
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--text-color); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.8px;">Priority</label>
                <div style="display: flex; gap: 10px;">
                    <button class="priority-btn" data-priority="low" style="
                        flex: 1; padding: 10px 8px; border-radius: 12px;
                        border: 1px solid rgba(0,212,255,0.4);
                        background: rgba(0,212,255,0.08);
                        color: #00d4ff; cursor: pointer; font-weight: 600;
                        font-size: 13px; transition: all 0.2s;
                        opacity: 0.6;
                    ">🟢 Low</button>
                    <button class="priority-btn active" data-priority="medium" style="
                        flex: 1; padding: 10px 8px; border-radius: 12px;
                        border: 1px solid rgba(255,149,0,0.6);
                        background: rgba(255,149,0,0.15);
                        color: #ff9500; cursor: pointer; font-weight: 600;
                        font-size: 13px; transition: all 0.2s;
                        opacity: 1;
                    ">🟡 Medium</button>
                    <button class="priority-btn" data-priority="high" style="
                        flex: 1; padding: 10px 8px; border-radius: 12px;
                        border: 1px solid rgba(255,65,108,0.4);
                        background: rgba(255,65,108,0.08);
                        color: #ff416c; cursor: pointer; font-weight: 600;
                        font-size: 13px; transition: all 0.2s;
                        opacity: 0.6;
                    ">🔴 High</button>
                </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; border-top: 1px solid var(--card-glass-border);">
                <button id="cancelAddReminder" style="
                    padding: 11px 24px;
                    border-radius: 12px;
                    background: var(--secondary-glass);
                    color: var(--text-color);
                    border: 1px solid var(--card-glass-border);
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='var(--secondary-glass)'">Cancel</button>
                <button id="confirmAddReminder" style="
                    padding: 11px 24px;
                    border-radius: 12px;
                    background: var(--primary-gradient);
                    color: white;
                    border: none;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 14px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 15px rgba(0,114,255,0.3);
                " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(0,114,255,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 15px rgba(0,114,255,0.3)'">Create Reminder</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    let selectedPriority = 'medium';
    modal.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.priority-btn').forEach(b => {
                b.classList.remove('active');
                b.style.opacity = '0.6';
            });
            btn.classList.add('active');
            btn.style.opacity = '1';
            selectedPriority = btn.dataset.priority;
        });
    });

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('cancelAddReminder').addEventListener('click', () => modal.remove());
    document.getElementById('confirmAddReminder').addEventListener('click', async () => {
        const title = document.getElementById('reminderTitle').value.trim();
        const text = document.getElementById('reminderText').value.trim();
        const date = document.getElementById('reminderDate').value;
        if (!title || !text) { showFeedback('Please fill in title and description! 📝'); return; }
        await createReminder(title, text, date || null, selectedPriority);
        modal.remove();
    });

    document.getElementById('reminderTitle').focus();
}

async function createReminder(title, text, reminderDate, priority) {
    try {
        const data = await apiCall('/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, text, reminderDate, priority: priority || 'medium' })
        });
        if (data && data.success) { showFeedback('Reminder created! ⏰'); loadReminders(); }
        else showFeedback(data?.message || 'Failed to create reminder');
    } catch (error) {
        console.error('Create Reminder Error:', error);
        showFeedback('Error creating reminder');
    }
}

async function toggleReminder(reminderId) {
    try {
        const data = await apiCall(`/reminders/${reminderId}/toggle`, { method: 'PATCH' });
        if (data && data.success) { showFeedback(data.message); loadReminders(); }
    } catch (error) { console.error('Toggle Reminder Error:', error); }
}

async function deleteReminder(reminderId) {
    if (!confirm('Delete this reminder?')) return;
    try {
        const data = await apiCall(`/reminders/${reminderId}`, { method: 'DELETE' });
        if (data && data.success) { showFeedback('Reminder deleted! 🗑️'); loadReminders(); }
    } catch (error) {
        console.error('Delete Reminder Error:', error);
        showFeedback('Error deleting reminder');
    }
}

const closeReminderBtn = document.getElementById('closeReminder');
if (closeReminderBtn) {
    closeReminderBtn.textContent = '➕ Add New';
    closeReminderBtn.style.background = 'var(--primary-gradient)';
    closeReminderBtn.addEventListener('click', e => { e.stopPropagation(); openAddReminderModal(); });
}

setInterval(() => {
    if (document.visibilityState === 'visible') loadNotifications();
}, 30000);

/* -------------------------------------------
    SEARCH — global state so click listener can access it
------------------------------------------- */
let searchBar = null;
let searchDropdown = null;
let isSearchOpen = false;

function hideSearch() {
    isSearchOpen = false;
    if (searchDropdown) searchDropdown.classList.remove('visible');
}

function closeSearch() {
    hideSearch();
    if (searchBar) searchBar.value = '';
    if (searchDropdown) searchDropdown.innerHTML = '';
}

function initializeSearch() {
    searchBar = document.getElementById('searchBar');
    if (!searchBar) { console.warn('Search bar not found'); return; }

    const searchStyle = document.createElement('style');
    searchStyle.textContent = `
        #searchContainer {
            position: relative !important;
            z-index: 1500 !important;
        }
        #searchDropdown {
            position: absolute;
            top: calc(100% + 8px);
            left: 0;
            right: 0;
            background: rgba(18,18,18,0.96);
            backdrop-filter: blur(28px);
            -webkit-backdrop-filter: blur(28px);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 16px 40px rgba(0,0,0,0.5);
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2,0.8,0.2,1);
            z-index: 1501 !important;
            max-height: 420px;
            overflow-y: auto;
            display: none;
        }
        #searchDropdown.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
            display: block !important;
        }
        #searchDropdown::-webkit-scrollbar { width: 4px; }
        #searchDropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
        #searchDropdown::-webkit-scrollbar-track { background: transparent; }
        .search-result-header {
            padding: 12px 18px 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.35);
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .search-result-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 18px;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            transition: background 0.15s ease;
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover { background: rgba(255,255,255,0.05); }
        .search-avatar {
            width: 40px;
            height: 40px;
            min-width: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #0072ff, #ff416c);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 15px;
            color: white;
        }
        .search-user-info { flex: 1; min-width: 0; }
        .search-user-name {
            font-weight: 600;
            font-size: 14px;
            color: rgba(255,255,255,0.9);
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .search-user-meta { font-size: 12px; color: rgba(255,255,255,0.4); }
        .search-arrow { font-size: 16px; color: rgba(255,255,255,0.2); transition: color 0.15s, transform 0.15s; }
        .search-result-item:hover .search-arrow { color: rgba(255,255,255,0.5); transform: translateX(3px); }
        .search-empty { padding: 36px 20px; text-align: center; }
        .search-empty-icon { font-size: 36px; margin-bottom: 10px; opacity: 0.5; }
        .search-empty-text { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.65); margin-bottom: 5px; }
        .search-empty-sub { font-size: 13px; color: rgba(255,255,255,0.3); }
        .search-loading {
            padding: 28px 20px;
            text-align: center;
            color: rgba(255,255,255,0.4);
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .search-spinner {
            width: 16px; height: 16px;
            border: 2px solid rgba(255,255,255,0.12);
            border-top-color: #0072ff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(searchStyle);

    const searchContainer = searchBar.closest('#searchContainer');
    if (!searchContainer) { console.warn('Search container not found'); return; }

    searchDropdown = document.createElement('div');
    searchDropdown.id = 'searchDropdown';
    searchContainer.appendChild(searchDropdown);

    let searchTimeout;

    function openSearch() {
        isSearchOpen = true;
        searchDropdown.classList.add('visible');
    }

    searchBar.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) { hideSearch(); return; }
        openSearch();
        searchDropdown.innerHTML = `
            <div class="search-loading">
                <div class="search-spinner"></div>Searching...
            </div>`;
        searchTimeout = setTimeout(() => searchUsers(query), 300);
    });

    searchBar.addEventListener('focus', e => {
        if (e.target.value.trim().length >= 2) openSearch();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isSearchOpen) closeSearch();
    });

    async function searchUsers(query) {
        try {
            const data = await apiCall(`/search?q=${encodeURIComponent(query)}`);
            if (!data || !data.success) {
                searchDropdown.innerHTML = `
                    <div class="search-empty">
                        <div class="search-empty-icon">⚠️</div>
                        <div class="search-empty-text">Search failed</div>
                        <div class="search-empty-sub">Please try again</div>
                    </div>`;
                return;
            }
            if (data.users.length === 0) {
                searchDropdown.innerHTML = `
                    <div class="search-empty">
                        <div class="search-empty-icon">🔍</div>
                        <div class="search-empty-text">No users found</div>
                        <div class="search-empty-sub">Try a different name</div>
                    </div>`;
                return;
            }
            const header = `<div class="search-result-header">${data.users.length} result${data.users.length > 1 ? 's' : ''} found</div>`;
            const items = data.users.map(user => {
                const initials = user.full_name.substring(0, 2).toUpperCase();
                return `
                    <a class="search-result-item" href="/user.html?id=${user.id}">
                        <div class="search-avatar">${initials}</div>
                        <div class="search-user-info">
                            <div class="search-user-name">${escapeHtml(user.full_name)}</div>
                            <div class="search-user-meta">Grade ${user.grade} &nbsp;•&nbsp; ${user.syllabus}</div>
                        </div>
                        <div class="search-arrow">→</div>
                    </a>`;
            }).join('');
            searchDropdown.innerHTML = header + items;
        } catch (error) {
            console.error('Search error:', error);
            searchDropdown.innerHTML = `
                <div class="search-empty">
                    <div class="search-empty-icon">⚠️</div>
                    <div class="search-empty-text">Something went wrong</div>
                    <div class="search-empty-sub">Check your connection and try again</div>
                </div>`;
        }
    }
}

/* -------------------------------------------
    UPLOAD
------------------------------------------- */
const epicFileInput = document.getElementById('epicFileInput');
const epicPreview = document.getElementById('epicPreview');
const epicCaption = document.getElementById('epicCaption');
let pending = null;

if (epicFileInput) {
    epicFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) {
            document.getElementById('fileChooseLabel').textContent = 'Select file';
            epicPreview.innerHTML = 'Preview';
            pending = null;
            return;
        }
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';
        pending = { file, url, type };
        document.getElementById('fileChooseLabel').textContent = file.name;
        epicPreview.innerHTML = `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;overflow:hidden;">
            ${type === 'image'
                ? `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;">`
                : `<video src="${url}" controls style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;"></video>`}
        </div>`;
        const addEpicCard = document.getElementById('addEpicCard');
        if (addEpicCard && !addEpicCard.classList.contains('active')) {
            addEpicCard.classList.add('active');
            activeCard = addEpicCard;
        }
    });
}

const confirmUploadBtn = document.getElementById('confirmUpload');
if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', async () => {
        if (!pending) { showFeedback('Please select a file first! 👆'); return; }
        confirmUploadBtn.textContent = 'Uploading...';
        confirmUploadBtn.disabled = true;
        try {
            const formData = new FormData();
            formData.append('file', pending.file);
            formData.append('caption', epicCaption.value || '');
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${state.token}` },
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                showFeedback('Post uploaded successfully! 🎉');
                pending = null;
                epicFileInput.value = '';
                epicPreview.innerHTML = 'Preview';
                epicCaption.value = '';
                document.getElementById('fileChooseLabel').textContent = 'Select file';
                document.getElementById('addEpicCard').classList.remove('active');
                activeCard = null;
                setTimeout(() => loadFeed(), 1500);
            } else {
                showFeedback(data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showFeedback('Upload failed. Please try again.');
        } finally {
            confirmUploadBtn.textContent = 'Post';
            confirmUploadBtn.disabled = false;
        }
    });
}

/* -------------------------------------------
    FEED
------------------------------------------- */
const feed = document.getElementById('feed');
const feedContainer = document.getElementById('feed-container');

async function loadFeed() {
    if (!feed) return;
    try {
        const data = await apiCall('/feed');
        if (!data || !data.success) {
            feed.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-color);font-size:18px;">Failed to load feed</div>';
            return;
        }
        if (data.message === 'no_posts_in_db') {
            feed.innerHTML = `
                <div style="padding:60px 20px;text-align:center;">
                    <div style="font-size:64px;margin-bottom:20px;">📭</div>
                    <div style="font-size:24px;font-weight:700;background:var(--primary-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;">No Posts Yet</div>
                    <div style="color:var(--text-color);opacity:0.7;font-size:16px;">Be the first to share something epic!</div>
                </div>`;
            return;
        }
        if (data.message === 'no_followed_posts' || data.posts.length === 0) {
            feed.innerHTML = `
                <div style="padding:60px 20px;text-align:center;">
                    <div style="font-size:64px;margin-bottom:20px;">🔍</div>
                    <div style="font-size:24px;font-weight:700;background:var(--primary-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;">No Posts to Show</div>
                    <div style="color:var(--text-color);opacity:0.7;font-size:16px;margin-bottom:20px;">Follow some users to see their posts here!</div>
                    <div style="color:var(--primary-color);cursor:pointer;font-weight:600;" onclick="document.getElementById('searchBar').focus()">Search for users →</div>
                </div>`;
            return;
        }
        feed.innerHTML = '';
        state.posts = data.posts;
        data.posts.forEach(post => feed.appendChild(createPostEl(post)));
        const caughtUp = document.createElement('div');
        caughtUp.style.cssText = 'padding:40px 20px;text-align:center;color:var(--text-color);opacity:0.6;font-size:16px;font-weight:500;';
        caughtUp.innerHTML = `<div style="font-size:32px;margin-bottom:10px;">✨</div><div>You're all caught up!</div><div style="font-size:14px;margin-top:5px;opacity:0.8;">You've seen all posts from people you follow</div>`;
        feed.appendChild(caughtUp);
    } catch (error) {
        console.error('Feed error:', error);
        feed.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error loading feed</div>';
    }
}

function createPostEl(post) {
    const el = document.createElement('article');
    el.className = 'post';
    el.dataset.id = post.id;
    const authorName = post.authorId == state.currentUser.id ? 'You' : escapeHtml(post.author);
    const isLoved = (post.lovedBy || []).includes(state.currentUser.id);
    const mediaContent = post.type === 'video'
        ? `<div class="video-container" style="position:relative;width:100%;height:100%;"><video src="${post.url}" preload="metadata" playsinline webkit-playsinline controls style="width:100%;height:100%;object-fit:contain;"></video></div>`
        : `<img src="${post.url}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;">`;
    el.innerHTML = `
        <div class="meta" style="display:flex;align-items:center;margin-bottom:15px;">
            <div class="avatar" style="width:45px;height:45px;min-width:45px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--primary-gradient);color:white;font-weight:700;font-size:16px;margin-right:15px;">${post.authorInitials}</div>
            <div>
                <div class="name" style="font-weight:700;font-size:16px;cursor:pointer;" onclick="window.location.href='/user.html?id=${post.authorId}'">${authorName}</div>
                <div class="time" style="font-size:12px;opacity:0.6;">${new Date(post.time).toLocaleString()}</div>
            </div>
        </div>
        <div class="text-wrapping" style="margin-bottom:20px;line-height:1.6;">${escapeHtml(post.caption)}</div>
        <div class="media" style="border-radius:12px;overflow:hidden;position:relative;height:350px;margin-bottom:20px;background-color:var(--secondary-glass);">${mediaContent}</div>
        <div class="actions" style="display:flex;gap:15px;align-items:center;">
            <div class="btn loveBtn ${isLoved ? 'toggled' : ''}" style="padding:10px 15px;border-radius:20px;cursor:pointer;font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;background:var(--secondary-glass);">❤️ <span class="count">${post.loves || 0}</span></div>
            <div class="btn commentToggle" style="padding:10px 15px;border-radius:20px;cursor:pointer;font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;background:var(--secondary-glass);">💬 <span class="count">${(post.comments || []).length}</span></div>
        </div>`;
    setupPostInteractions(el, post);
    return el;
}

function setupPostInteractions(el, post) {
    const loveBtn = el.querySelector('.loveBtn');
    const commentToggle = el.querySelector('.commentToggle');

    loveBtn.addEventListener('click', async () => {
        try {
            const data = await apiCall('/react', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: post.id, type: 'love' })
            });
            if (data && data.success) {
                const countEl = loveBtn.querySelector('.count');
                let count = parseInt(countEl.textContent);
                if (data.action === 'added') {
                    loveBtn.classList.add('toggled');
                    countEl.textContent = count + 1;
                    showFeedback('Loved! ❤️');
                } else {
                    loveBtn.classList.remove('toggled');
                    countEl.textContent = Math.max(0, count - 1);
                }
            }
        } catch (error) { console.error('React error:', error); }
    });

    commentToggle.addEventListener('click', () => {
        openCommentModal(post, () => {
            commentToggle.querySelector('.count').textContent = (post.comments || []).length;
        });
    });
}

/* -------------------------------------------
    COMMENT MODAL
------------------------------------------- */
const commentModal = document.getElementById('commentModal');
const commentModalList = document.getElementById('commentModalList');
const commentModalTextarea = document.getElementById('commentModalTextarea');
const commentModalPostBtn = document.getElementById('commentModalPostBtn');
let currentPostForComment = null;

function openCommentModal(post, updateCallback) {
    if (!commentModal) return;
    currentPostForComment = post;
    commentModalList.innerHTML = (post.comments || []).map(c => {
        const isMine = c.userId === state.currentUser.id;
        return `
            <div class="comment ${isMine ? 'mine' : ''}" style="padding:12px;margin-bottom:10px;border-radius:12px;background:${isMine ? 'linear-gradient(135deg,rgba(0,114,255,0.16),rgba(255,65,108,0.08))' : 'rgba(255,255,255,0.03)'};position:relative;">
                <div style="display:flex;gap:12px;align-items:start;">
                    <div style="width:35px;height:35px;border-radius:50%;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${c.byInitials}</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${isMine ? 'You' : escapeHtml(c.by)}</div>
                        <div style="font-size:14px;line-height:1.4;">${escapeHtml(c.text)}</div>
                    </div>
                    ${isMine ? `<button onclick="deleteComment(${c.id},${post.id});event.stopPropagation();" style="background:rgba(255,65,108,0.2);color:#ff416c;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.background='rgba(255,65,108,0.3)'" onmouseout="this.style.background='rgba(255,65,108,0.2)'" title="Delete comment">🗑️</button>` : ''}
                </div>
            </div>`;
    }).join('') || '<div style="padding:20px;text-align:center;opacity:0.6;">No comments yet. Be the first!</div>';
    commentModalTextarea.value = '';
    commentModal.classList.add('show');
    commentModalTextarea.focus();
}

async function deleteComment(commentId, postId) {
    if (!confirm('Delete this comment?')) return;
    try {
        const data = await apiCall(`/comment/${commentId}`, { method: 'DELETE' });
        if (data && data.success) {
            showFeedback('Comment deleted! 🗑️');
            const post = state.posts.find(p => p.id === postId);
            if (post) {
                post.comments = post.comments.filter(c => c.id !== commentId);
                const postEl = document.querySelector(`[data-id="${postId}"]`);
                if (postEl) {
                    const countEl = postEl.querySelector('.commentToggle .count');
                    if (countEl) countEl.textContent = post.comments.length;
                }
                if (currentPostForComment && currentPostForComment.id === postId) openCommentModal(post);
            }
        } else { showFeedback(data?.message || 'Failed to delete comment'); }
    } catch (error) {
        console.error('Delete Comment Error:', error);
        showFeedback('Error deleting comment');
    }
}

if (commentModalPostBtn) {
    commentModalPostBtn.addEventListener('click', async () => {
        const text = commentModalTextarea.value.trim();
        if (!text || !currentPostForComment) return;
        try {
            const data = await apiCall('/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: currentPostForComment.id, text })
            });
            if (data && data.success && data.comment) {
                currentPostForComment.comments = currentPostForComment.comments || [];
                currentPostForComment.comments.push({
                    id: data.comment.id, userId: data.comment.userId,
                    by: data.comment.by, byInitials: data.comment.byInitials, text: data.comment.text
                });
                const postInState = state.posts.find(p => p.id === currentPostForComment.id);
                if (postInState) postInState.comments = currentPostForComment.comments;
                openCommentModal(currentPostForComment);
                showFeedback('Comment posted! 💬');
                const postEl = document.querySelector(`[data-id="${currentPostForComment.id}"]`);
                if (postEl) {
                    const countEl = postEl.querySelector('.commentToggle .count');
                    if (countEl) countEl.textContent = currentPostForComment.comments.length;
                }
            }
        } catch (error) {
            console.error('Comment error:', error);
            showFeedback('Failed to post comment');
        }
    });
}

if (commentModal) {
    commentModal.addEventListener('click', e => {
        if (e.target === commentModal) commentModal.classList.remove('show');
    });
}

/* -------------------------------------------
    RIGHT PANEL
------------------------------------------- */
const miniCards = document.querySelectorAll('#right-panel-wrapper .mini-card');
let activeCard = null;

miniCards.forEach(el => {
    el.addEventListener('click', e => {
        if (e.target.closest('.mini-card-content') && el.classList.contains('active')) return;
        miniCards.forEach(ac => { if (ac !== el) ac.classList.remove('active'); });
        el.classList.toggle('active');
        activeCard = el.classList.contains('active') ? el : null;
    });
});

document.addEventListener('click', e => {
    if (e.target.closest('#epicFileInput') || e.target.closest('#fileChooseLabel')) return;

    if (!e.target.closest('#searchContainer') && isSearchOpen) closeSearch();

    if (!e.target.closest('.mini-card') && activeCard) {
        activeCard.classList.remove('active');
        activeCard = null;
    }
});

const cancelUploadBtn = document.getElementById('cancelUpload');
if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (epicFileInput) epicFileInput.value = '';
        pending = null;
        if (epicPreview) epicPreview.innerHTML = 'Preview';
        const label = document.getElementById('fileChooseLabel');
        if (label) label.textContent = 'Select file';
        document.getElementById('addEpicCard').classList.remove('active');
        activeCard = null;
        showFeedback('Upload canceled.');
    });
}

const closeNotifsBtn = document.getElementById('closeNotifs');
if (closeNotifsBtn) {
    closeNotifsBtn.addEventListener('click', e => { e.stopPropagation(); clearAllNotifications(); });
}

/* ---- Schedule Card "View Calendar" button → navigate to self-study ---- */
const closeScheduleBtn = document.getElementById('closeSchedule');
if (closeScheduleBtn) {
    closeScheduleBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.location.href = 'self-study.html';
    });
}

/* ---- Tests Card "Start Test" button → navigate to self-study ---- */
const closeTestsBtn = document.getElementById('closeTests');
if (closeTestsBtn) {
    closeTestsBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.location.href = 'self-study.html';
    });
}

/* -------------------------------------------
    REFRESH BUTTON
------------------------------------------- */
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        if (searchBar) searchBar.value = '';
        closeSearch();
        loadFeed();
        loadNotifications();
        showFeedback('Feed Refreshed! 🔄');
        if (feedContainer) feedContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* -------------------------------------------
    NAVIGATION
------------------------------------------- */
function setActiveNav() {
    let currentPath = window.location.pathname.split('/').pop();
    if (currentPath === '') currentPath = 'index.html';
    document.querySelectorAll('.sidebar .nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.getAttribute('href') === currentPath);
    });
}

/* -------------------------------------------
    GREETING CARD
------------------------------------------- */
async function loadGreetingCard() {
    const user = state.currentUser;
    const token = state.token;
    if (!user || !token) return;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greetingTime').textContent = greeting;

    const name = user.full_name || user.name || 'Scholar';
    document.getElementById('greetingName').textContent = name;
    document.getElementById('greetingAvatar').textContent = name.substring(0, 2).toUpperCase();
    if (user.grade && user.syllabus) {
        document.getElementById('greetingMeta').textContent = `Grade ${user.grade} · ${user.syllabus}`;
    }
    try {
        const res = await fetch(`${API_URL}/user/${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
            document.getElementById('greetingPosts').textContent = data.stats.posts;
            document.getElementById('greetingFollowers').textContent = data.stats.followers;
            document.getElementById('greetingFollowing').textContent = data.stats.following;
        }
    } catch (e) { console.error('Greeting stats error:', e); }
}

/* -------------------------------------------
    INIT
------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    if (document.getElementById('feed')) {
        loadFeed();
        loadNotifications();
        loadReminders();
        loadGreetingCard();
        initializeSearch();

        // Load self-study data and populate schedule + tests cards
        await loadSelfStudyData();
        renderScheduleCard();
        renderTestsCard();
    }

    setActiveNav();

});
// ── Mobile drawer (bottom nav links) ──
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const closeMobileMenuBtn = document.getElementById('closeMobileMenu');
if (closeMobileMenuBtn) {
    closeMobileMenuBtn.addEventListener('click', () => mobileMenuOverlay.classList.remove('show'));
}
if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', e => {
        if (e.target === mobileMenuOverlay) mobileMenuOverlay.classList.remove('show');
    });
}

// ── Hamburger → show/hide mini-cards column ──
const mobileHamburgerBtn = document.getElementById('mobileHamburgerBtn');
const rightPanelWrapper = document.getElementById('right-panel-wrapper');

if (mobileHamburgerBtn && rightPanelWrapper) {

    // Toggle panel on hamburger tap
    mobileHamburgerBtn.addEventListener('click', e => {
        e.stopPropagation();
        rightPanelWrapper.classList.toggle('mobile-active');
    });

    // Close panel when tapping completely outside it (but NOT when tapping inside)
    document.addEventListener('click', e => {
        if (window.innerWidth > 1023) return;
        if (!rightPanelWrapper.classList.contains('mobile-active')) return;

        const insidePanel = rightPanelWrapper.contains(e.target);
        const insideHamburger = mobileHamburgerBtn.contains(e.target);

        // If tap is inside the panel or on the hamburger, do nothing
        if (insidePanel || insideHamburger) return;

        // Otherwise close
        rightPanelWrapper.classList.remove('mobile-active');
    }, true); // ← capture phase so it runs before card click handlers
}

// ── Bottom bar hide-on-scroll ──
let lastScrollTop = 0;
let isScrollingTimer;
const bottomBar = document.querySelector('.mobile-bottom-bar');
const scrollContainer = document.getElementById('feed-container');

if (scrollContainer) {
    scrollContainer.addEventListener('scroll', function () {
        if (window.innerWidth > 1023) return;
        clearTimeout(isScrollingTimer);
        const st = Math.max(0, scrollContainer.scrollTop);
        if (st > lastScrollTop && st > 10) {
            bottomBar && bottomBar.classList.add('hide-bar');
        } else {
            bottomBar && bottomBar.classList.remove('hide-bar');
        }
        lastScrollTop = st;
        isScrollingTimer = setTimeout(() => {
            bottomBar && bottomBar.classList.remove('hide-bar');
        }, 600);
    });
}
