/* =============================================
   EPICSCHOLAR - MESSAGES.JS
   Outlook-style messaging frontend
   ============================================= */
const API_URL = 'https://epicscholar.cloud/api';
const THEME_KEY = 'epicScholarTheme';

// ============ THEME ============
const root = document.documentElement;
let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
root.setAttribute('data-theme', currentTheme);

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.checked = currentTheme === 'light';
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'light' : 'dark';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
        currentTheme = newTheme;
    });
}

// ============ AUTH ============
function getAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) {
        window.location.href = '/';
        return null;
    }
    return { token, user: JSON.parse(user) };
}

const auth = getAuth();
if (!auth) throw new Error('Not authenticated');
const { token: TOKEN, user: CURRENT_USER } = auth;

// ============ STATE ============
const state = {
    messages: [],
    currentTab: 'inbox',
    activeMessageId: null,
    composeMode: false,
    attachments: [],
    composeAttachments: [],
    voiceRecorder: null,
    voiceChunks: [],
    voiceTimerInterval: null,
    voiceStart: null,
    composeVoiceRecorder: null,
    composeVoiceChunks: [],
    composeVoiceTimerInterval: null,
    composeVoiceStart: null,
    studyLinkTarget: null,
    selectedTag: 'general',
    selectedReceiver: null,
    searchQuery: '',
};

// ============ HELPERS ============
function escapeHtml(s) {
    return String(s).replace(/[&"'<>]/g, c => ({
        '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;'
    }[c]));
}

function timeAgo(ts) {
    const now = new Date();
    const t = new Date(ts);
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullDate(ts) {
    return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function initials(name) {
    return (name || '??').substring(0, 2).toUpperCase();
}

function showFeedback(msg) {
    const el = document.getElementById('feedback-message');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
}

async function apiCall(endpoint, options = {}) {
    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            ...(options.headers || {})
        }
    });
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return null;
    }
    return res.json();
}

// ============ LOAD AUTH IMAGE ============
// Images need the JWT token - can't use a plain <img src> URL
async function loadAuthImage(imgEl, attachmentId) {
    try {
        const res = await fetch(`${API_URL}/messages/attachment/${attachmentId}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (!res.ok) return;
        const blob = await res.blob();
        imgEl.src = URL.createObjectURL(blob);
    } catch (e) {
        imgEl.style.display = 'none';
    }
}

// ============ LOAD MESSAGES ============
async function loadMessages() {
    const data = await apiCall('/messages/list');
    if (!data || !data.success) {
        renderMsgList([]);
        return;
    }
    state.messages = data.messages || [];
    updateUnreadBadge();
    renderMsgList(getFilteredMessages());
}

function getFilteredMessages() {
    let msgs = state.messages;

    if (state.currentTab === 'inbox') {
        msgs = msgs.filter(m => m.receiver_id === CURRENT_USER.id);
    } else if (state.currentTab === 'sent') {
        msgs = msgs.filter(m => m.sender_id === CURRENT_USER.id);
    } else if (state.currentTab === 'starred') {
        msgs = msgs.filter(m => m.is_starred);
    }

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        msgs = msgs.filter(m =>
            (m.subject || '').toLowerCase().includes(q) ||
            (m.sender_name || '').toLowerCase().includes(q) ||
            (m.receiver_name || '').toLowerCase().includes(q) ||
            (m.body_text || '').toLowerCase().includes(q)
        );
    }

    return msgs;
}

function updateUnreadBadge() {
    const unread = state.messages.filter(m => m.receiver_id === CURRENT_USER.id && !m.is_read).length;
    const badge = document.getElementById('unread-badge');
    if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// ============ RENDER MESSAGE LIST ============
function renderMsgList(msgs) {
    const list = document.getElementById('msg-list');

    if (msgs.length === 0) {
        const labels = { inbox: 'No messages in your inbox', sent: 'No sent messages', starred: 'No starred messages' };
        list.innerHTML = `
            <div class="msg-list-empty">
                <div class="empty-icon">📭</div>
                <div>${labels[state.currentTab] || 'No messages found'}</div>
            </div>`;
        return;
    }

    list.innerHTML = '';
    msgs.forEach(msg => {
        const isInbox = msg.receiver_id === CURRENT_USER.id;
        const otherName = isInbox ? msg.sender_name : msg.receiver_name;
        const isUnread = isInbox && !msg.is_read;
        const isActive = state.activeMessageId === msg.id;
        const tag = msg.tag || 'general';

        const row = document.createElement('div');
        row.className = `msg-row${isUnread ? ' unread' : ''}${isActive ? ' active' : ''}`;
        row.dataset.id = msg.id;

        row.innerHTML = `
            <div class="msg-row-avatar">${initials(otherName)}</div>
            <div class="msg-row-content">
                <div class="msg-row-top">
                    <div class="msg-row-from">${escapeHtml(otherName || 'Unknown')}</div>
                    <div class="msg-row-time">${timeAgo(msg.created_at)}</div>
                </div>
                <div class="msg-row-subject">${escapeHtml(msg.subject || '(No subject)')}</div>
                <div class="msg-row-meta">
                    <span class="msg-tag-pill ${tag}">${tagLabel(tag)}</span>
                    <div class="msg-row-preview">${escapeHtml(msg.body_text || '').substring(0, 60)}</div>
                </div>
            </div>
            <span class="msg-star${msg.is_starred ? ' starred' : ''}" data-id="${msg.id}" title="Star">★</span>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('msg-star')) return;
            openMessage(msg.id);
        });

        row.querySelector('.msg-star').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStar(msg.id);
        });

        list.appendChild(row);
    });
}

function tagLabel(tag) {
    const labels = {
        general: '💬 General',
        study: '📚 Study',
        notes: '📝 Notes',
        question: '❓ Question',
        collaboration: '🤝 Collab'
    };
    return labels[tag] || tag;
}

// ============ OPEN MESSAGE / THREAD ============
async function openMessage(messageId) {
    switchToThreadView();
    state.activeMessageId = messageId;
    renderMsgList(getFilteredMessages());

    const data = await apiCall(`/messages/${messageId}`);
    if (!data || !data.success) {
        showFeedback('Failed to load message');
        return;
    }

    const msg = data.message;
    const thread = data.thread || [msg];

    const idx = state.messages.findIndex(m => m.id === messageId);
    if (idx !== -1) state.messages[idx].is_read = true;
    updateUnreadBadge();
    renderMsgList(getFilteredMessages());

    const isInbox = msg.receiver_id === CURRENT_USER.id;
    const otherName = isInbox ? msg.sender_name : msg.receiver_name;
    const otherId = isInbox ? msg.sender_id : msg.receiver_id;

    document.getElementById('msg-thread-avatar').textContent = initials(otherName);
    document.getElementById('msg-thread-name').textContent = otherName;
    document.getElementById('msg-thread-subtitle').textContent =
        `${msg.subject || '(No subject)'} • ${tagLabel(msg.tag || 'general')}`;

    const starBtn = document.getElementById('btn-star-thread');
    starBtn.classList.toggle('starred', !!msg.is_starred);
    starBtn.textContent = msg.is_starred ? '★' : '☆';
    starBtn.onclick = () => toggleStar(messageId);

    document.getElementById('btn-delete-thread').onclick = () => deleteMessage(messageId);
    document.getElementById('btn-reply-top').onclick = () => document.getElementById('reply-body').focus();

    state.activeReceiverId = otherId;
    state.activeReceiverName = otherName;
    state.activeSubject = msg.subject;
    state.activeTag = msg.tag || 'general';
    state.attachments.length = 0;
    document.getElementById('attachments-preview').innerHTML = '';
    document.getElementById('reply-body').innerHTML = '';

    renderThreadMessages(thread);
}

// ============ RENDER THREAD MESSAGES ============
function renderThreadMessages(thread) {
    console.log('🔍 DEBUG:', JSON.stringify(thread.map(m => ({ id: m.id, atts: m.attachments }))));
    const container = document.getElementById('msg-thread-messages');
    container.innerHTML = '';

    thread.forEach(msg => {
        const isOutgoing = msg.sender_id === CURRENT_USER.id;
        const senderName = isOutgoing ? 'You' : (msg.sender_name || 'Unknown');

        const div = document.createElement('div');
        div.className = `thread-message ${isOutgoing ? 'outgoing' : 'incoming'}`;

        const bodyHtml = renderMessageBody(msg.body_html || escapeHtml(msg.body_text || ''));

        // Build attachments HTML
        let attachmentsHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
            attachmentsHtml = msg.attachments.map(att => {
                // Voice note
                if (att.is_voice) {
                    return renderVoicePlayer(att);
                }

                const mime = att.mime_type || '';

                // Image — rendered as placeholder, loaded via auth fetch after DOM insert
                if (mime.startsWith('image/')) {
                    return `<div style="margin-top:8px;">
                        <img id="img-att-${att.id}"
                             style="max-width:300px;max-height:250px;border-radius:10px;display:block;background:rgba(255,255,255,0.05);"
                             alt="${escapeHtml(att.original_name || att.filename)}" />
                    </div>`;
                }

                // PDF / other file — download link
                const icon = mime === 'application/pdf' ? '📄' :
                    mime.startsWith('audio/') ? '🎵' : '📎';
                const name = escapeHtml(att.original_name || att.filename);
                return `<a href="#" onclick="downloadAttachment(event,${att.id},'${name}')" class="attachment-chip">
                    ${icon} ${name}
                </a>`;
            }).join('');
        }

        div.innerHTML = `
            <div class="thread-msg-header">
                ${!isOutgoing ? `<div class="thread-msg-avatar">${initials(senderName)}</div>` : ''}
                <span>${escapeHtml(senderName)}</span>
                <span>${fullDate(msg.created_at)}</span>
            </div>
            <div class="thread-msg-bubble">
                ${bodyHtml}
                ${attachmentsHtml}
            </div>
        `;

        container.appendChild(div);

        // Load images with auth token after they're in the DOM
        if (msg.attachments) {
            msg.attachments.forEach(att => {
                if (!att.is_voice && att.mime_type && att.mime_type.startsWith('image/')) {
                    const imgEl = document.getElementById(`img-att-${att.id}`);
                    if (imgEl) loadAuthImage(imgEl, att.id);
                }
            });
        }
    });

    container.scrollTop = container.scrollHeight;
}

// ============ DOWNLOAD ATTACHMENT WITH AUTH ============
window.downloadAttachment = async function (e, attId, filename) {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/messages/attachment/${attId}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (!res.ok) { showFeedback('Failed to download file'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        showFeedback('Download failed');
    }
};

function renderMessageBody(html) {
    return html.replace(/\[\[STUDY_RESOURCE:(.*?)\]\]/g, (_, json) => {
        try {
            const resource = JSON.parse(decodeURIComponent(json));
            return renderStudyResourceCard(resource);
        } catch {
            return html;
        }
    });
}

function renderStudyResourceCard(resource) {
    const icons = { link: '🔗', note: '📝', quiz: '❓' };
    const icon = icons[resource.type] || '📚';

    if (resource.type === 'link') {
        return `<a href="${escapeHtml(resource.url)}" target="_blank" class="study-resource-card">
            <span class="sr-icon">${icon}</span>
            <div class="sr-info">
                <div class="sr-title">${escapeHtml(resource.title || resource.url)}</div>
                <div class="sr-meta">${resource.subject ? `📚 ${escapeHtml(resource.subject)}` : 'Study Resource'}</div>
            </div>
            <span>→</span>
        </a>`;
    }
    if (resource.type === 'note') {
        return `<div class="study-resource-card">
            <span class="sr-icon">📝</span>
            <div class="sr-info">
                <div class="sr-title">Quick Study Note</div>
                <div class="sr-meta">${escapeHtml(resource.content)}</div>
            </div>
        </div>`;
    }
    if (resource.type === 'quiz') {
        return `<div class="study-resource-card">
            <span class="sr-icon">❓</span>
            <div class="sr-info">
                <div class="sr-title">${escapeHtml(resource.question)}</div>
                <div class="sr-meta">${resource.answer ? `Answer: ${escapeHtml(resource.answer)}` : `Subject: ${escapeHtml(resource.subject || 'General')}`}</div>
            </div>
        </div>`;
    }
    return '';
}

function renderVoicePlayer(att) {
    const id = `voice-${att.id}`;
    const duration = att.duration_seconds ? formatDuration(att.duration_seconds) : '0:00';
    const bars = Array.from({ length: 32 }, () =>
        `<div class="waveform-bar" style="height:${Math.random() * 20 + 4}px;"></div>`
    ).join('');

    return `<div class="voice-note-player" id="${id}">
        <button onclick="toggleVoicePlay('${id}', ${att.id})" title="Play voice note">▶</button>
        <div class="voice-note-waveform">${bars}</div>
        <span class="voice-note-duration">${duration}</span>
        <audio id="audio-${id}" style="display:none;"></audio>
    </div>`;
}

window.toggleVoicePlay = async function (playerId, attId) {
    const audio = document.getElementById(`audio-${playerId}`);
    const btn = document.querySelector(`#${playerId} button`);
    if (!audio || !btn) return;

    if (audio.paused) {
        if (!audio.src || audio.src === window.location.href) {
            btn.textContent = '⏳';
            try {
                const res = await fetch(`${API_URL}/messages/attachment/${attId}`, {
                    headers: { 'Authorization': `Bearer ${TOKEN}` }
                });
                const blob = await res.blob();
                audio.src = URL.createObjectURL(blob);
            } catch (e) {
                showFeedback('Could not load audio');
                btn.textContent = '▶';
                return;
            }
        }
        document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
        document.querySelectorAll('.voice-note-player button').forEach(b => b.textContent = '▶');
        audio.play();
        btn.textContent = '⏸';
        audio.onended = () => { btn.textContent = '▶'; };
    } else {
        audio.pause();
        btn.textContent = '▶';
    }
};

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============ VIEW SWITCHING ============
function switchToThreadView() {
    document.getElementById('msg-empty-state').style.display = 'none';
    document.getElementById('msg-compose-view').style.display = 'none';
    document.getElementById('msg-thread-view').style.display = 'flex';
    state.composeMode = false;
}

function switchToComposeView() {
    document.getElementById('msg-empty-state').style.display = 'none';
    document.getElementById('msg-thread-view').style.display = 'none';
    document.getElementById('msg-compose-view').style.display = 'flex';
    state.composeMode = true;
    state.activeMessageId = null;
    renderMsgList(getFilteredMessages());
    state.composeAttachments.length = 0;
    document.getElementById('compose-attachments-preview').innerHTML = '';
    document.getElementById('compose-body').innerHTML = '';
    document.getElementById('compose-to-input').value = '';
    document.getElementById('compose-subject').value = '';
    state.selectedReceiver = null;
    document.getElementById('compose-to-input').focus();
}

function switchToEmptyState() {
    document.getElementById('msg-empty-state').style.display = 'flex';
    document.getElementById('msg-thread-view').style.display = 'none';
    document.getElementById('msg-compose-view').style.display = 'none';
}

// ============ SEND REPLY ============
async function sendReply() {
    const bodyEl = document.getElementById('reply-body');
    const bodyHtml = bodyEl.innerHTML.trim();
    const bodyText = bodyEl.innerText.trim();

    if (!bodyHtml && state.attachments.length === 0) {
        showFeedback('Please write a reply before sending');
        return;
    }

    const btn = document.getElementById('reply-send-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const formData = new FormData();
        formData.append('receiverId', state.activeReceiverId);
        formData.append('subject', `Re: ${state.activeSubject || ''}`);
        formData.append('bodyHtml', bodyHtml);
        formData.append('bodyText', bodyText);
        formData.append('tag', state.activeTag || 'general');
        formData.append('parentId', state.activeMessageId);

        state.attachments.forEach(att => {
            formData.append('attachments', att.file, att.name);
            if (att.isVoice && att.duration) {
                formData.append(`duration_${att.name}`, att.duration);
            }
        });

        const res = await fetch(`${API_URL}/messages/send`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });

        const data = await res.json();

        if (data && data.success) {
            showFeedback('Reply sent! ✉️');
            bodyEl.innerHTML = '';
            state.attachments.length = 0;
            document.getElementById('attachments-preview').innerHTML = '';
            await loadMessages();
            openMessage(state.activeMessageId);
        } else {
            showFeedback(data?.message || 'Failed to send reply');
        }
    } catch (err) {
        console.error('Send reply error:', err);
        showFeedback('Error sending reply');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reply ➤';
    }
}

// ============ SEND NEW MESSAGE ============
async function sendNewMessage() {
    if (!state.selectedReceiver) {
        showFeedback('Please select a recipient');
        return;
    }

    const subject = document.getElementById('compose-subject').value.trim();
    const bodyEl = document.getElementById('compose-body');
    const bodyHtml = bodyEl.innerHTML.trim();
    const bodyText = bodyEl.innerText.trim();

    if (!bodyHtml && state.composeAttachments.length === 0) {
        showFeedback('Please write a message');
        return;
    }

    const btn = document.getElementById('compose-send-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const formData = new FormData();
        formData.append('receiverId', state.selectedReceiver.id);
        formData.append('subject', subject || '(No subject)');
        formData.append('bodyHtml', bodyHtml);
        formData.append('bodyText', bodyText);
        formData.append('tag', state.selectedTag);

        state.composeAttachments.forEach(att => {
            formData.append('attachments', att.file, att.name);
            if (att.isVoice && att.duration) {
                formData.append(`duration_${att.name}`, att.duration);
            }
        });

        const res = await fetch(`${API_URL}/messages/send`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });

        const data = await res.json();

        if (data && data.success) {
            showFeedback('Message sent! ✉️');
            switchToEmptyState();
            await loadMessages();
        } else {
            showFeedback(data?.message || 'Failed to send message');
        }
    } catch (err) {
        console.error('Send message error:', err);
        showFeedback('Error sending message');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Message ➤';
    }
}

// ============ STAR / DELETE ============
async function toggleStar(messageId) {
    const data = await apiCall(`/messages/${messageId}/star`, { method: 'PATCH' });
    if (data && data.success) {
        const msg = state.messages.find(m => m.id === messageId);
        if (msg) {
            msg.is_starred = !msg.is_starred;
            const starBtn = document.getElementById('btn-star-thread');
            if (starBtn) {
                starBtn.classList.toggle('starred', msg.is_starred);
                starBtn.textContent = msg.is_starred ? '★' : '☆';
            }
            renderMsgList(getFilteredMessages());
            showFeedback(msg.is_starred ? 'Starred ★' : 'Unstarred');
        }
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;

    const data = await apiCall(`/messages/${messageId}`, { method: 'DELETE' });
    if (data && data.success) {
        state.messages = state.messages.filter(m => m.id !== messageId);
        state.activeMessageId = null;
        switchToEmptyState();
        renderMsgList(getFilteredMessages());
        updateUnreadBadge();
        showFeedback('Message deleted 🗑️');
    } else {
        showFeedback('Failed to delete message');
    }
}

// ============ SEARCH ============
const searchInput = document.getElementById('msg-search');
let searchTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        state.searchQuery = searchInput.value.trim();
        renderMsgList(getFilteredMessages());
    }, 250);
});

// ============ TABS ============
document.querySelectorAll('.msg-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.msg-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentTab = tab.dataset.tab;
        renderMsgList(getFilteredMessages());
    });
});

// ============ COMPOSE RECIPIENT SEARCH ============
const composeToInput = document.getElementById('compose-to-input');
const composeToDropdown = document.getElementById('compose-to-dropdown');
let composeSearchTimer;

composeToInput.addEventListener('input', () => {
    clearTimeout(composeSearchTimer);
    const q = composeToInput.value.trim();
    if (q.length < 2) {
        composeToDropdown.style.display = 'none';
        return;
    }
    composeSearchTimer = setTimeout(() => searchRecipients(q), 300);
});

async function searchRecipients(query) {
    const data = await apiCall(`/search?q=${encodeURIComponent(query)}`);
    if (!data || !data.success || data.users.length === 0) {
        composeToDropdown.style.display = 'none';
        return;
    }

    composeToDropdown.innerHTML = data.users.map(u => `
        <div class="to-dropdown-item" data-id="${u.id}" data-name="${escapeHtml(u.full_name)}">
            <div class="to-dropdown-avatar">${initials(u.full_name)}</div>
            <div>
                <div style="font-weight:600;">${escapeHtml(u.full_name)}</div>
                <div style="font-size:12px;opacity:0.6;">Grade ${u.grade} • ${u.syllabus}</div>
            </div>
        </div>
    `).join('');

    composeToDropdown.querySelectorAll('.to-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            state.selectedReceiver = { id: parseInt(item.dataset.id), name: item.dataset.name };
            composeToInput.value = item.dataset.name;
            composeToDropdown.style.display = 'none';
        });
    });

    composeToDropdown.style.display = 'block';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#compose-to-wrap')) {
        composeToDropdown.style.display = 'none';
    }
});

// ============ TAGS ============
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedTag = btn.dataset.tag;
    });
});

// ============ TOOLBAR (RICH TEXT) ============
function setupToolbar(toolbarId, editorId) {
    document.querySelectorAll(`#${toolbarId} .toolbar-btn[data-action]`).forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(editorId).focus();
            document.execCommand(btn.dataset.action, false, null);
        });
    });
}
setupToolbar('reply-toolbar', 'reply-body');
setupToolbar('compose-toolbar', 'compose-body');

document.getElementById('reply-body').addEventListener('input', () => {
    const len = document.getElementById('reply-body').innerText.length;
    document.getElementById('reply-char-count').textContent = `${len} chars`;
});

// ============ ATTACHMENTS ============
function setupAttachInput(inputId, previewId, attachArray) {
    document.getElementById(inputId).addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => {
            const entry = { file, name: file.name, id: Date.now() + Math.random() };
            attachArray.push(entry);
            addAttachPreview(previewId, entry, attachArray);
        });
        e.target.value = '';
    });
}

function addAttachPreview(previewId, entry, attachArray) {
    const preview = document.getElementById(previewId);
    const chip = document.createElement('div');
    chip.className = 'attach-preview-chip';
    chip.dataset.entryId = entry.id;

    const icon = entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' :
        entry.name.match(/\.(pdf)$/i) ? '📄' :
            entry.name.match(/\.(mp3|wav|ogg|webm)$/i) ? '🎵' : '📎';

    chip.innerHTML = `${icon} ${escapeHtml(entry.name.length > 22 ? entry.name.substring(0, 22) + '...' : entry.name)}
        <button onclick="removeAttach(this, ${JSON.stringify(entry.id)}, '${previewId}', true)">✕</button>`;
    preview.appendChild(chip);
}

window.removeAttach = function (btn, entryId, previewId, isCompose) {
    const arr = isCompose ? state.composeAttachments : state.attachments;
    const idx = arr.findIndex(a => a.id === entryId);
    if (idx !== -1) arr.splice(idx, 1);
    btn.closest('.attach-preview-chip').remove();
};

setupAttachInput('attach-file-input', 'attachments-preview', state.attachments);
setupAttachInput('compose-attach-input', 'compose-attachments-preview', state.composeAttachments);

// ============ VOICE RECORDING ============
function setupVoiceRecording({ btnId, barId, stopBtnId, cancelBtnId, timerId, onStop, stateKey }) {
    let interval = null;

    document.getElementById(btnId).addEventListener('click', async () => {
        if (!navigator.mediaDevices) { showFeedback('Microphone not supported'); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            state[`${stateKey}Chunks`] = [];
            state[`${stateKey}Recorder`] = recorder;

            recorder.ondataavailable = e => state[`${stateKey}Chunks`].push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(state[`${stateKey}Chunks`], { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                onStop(blob);
            };

            recorder.start();
            state[`${stateKey}Start`] = Date.now();
            document.getElementById(barId).style.display = 'flex';
            document.getElementById(btnId).style.opacity = '0.4';

            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - state[`${stateKey}Start`]) / 1000);
                document.getElementById(timerId).textContent = formatDuration(elapsed);
            }, 500);
            state[`${stateKey}TimerInterval`] = interval;
        } catch (err) {
            showFeedback('Could not access microphone');
        }
    });

    document.getElementById(stopBtnId).addEventListener('click', () => {
        if (state[`${stateKey}Recorder`]?.state === 'recording') state[`${stateKey}Recorder`].stop();
        clearInterval(state[`${stateKey}TimerInterval`]);
        document.getElementById(barId).style.display = 'none';
        document.getElementById(btnId).style.opacity = '1';
    });

    document.getElementById(cancelBtnId).addEventListener('click', () => {
        if (state[`${stateKey}Recorder`]?.state === 'recording') {
            state[`${stateKey}Recorder`].ondataavailable = null;
            state[`${stateKey}Recorder`].onstop = null;
            state[`${stateKey}Recorder`].stop();
        }
        clearInterval(state[`${stateKey}TimerInterval`]);
        document.getElementById(barId).style.display = 'none';
        document.getElementById(btnId).style.opacity = '1';
    });
}

setupVoiceRecording({
    btnId: 'voice-record-btn', barId: 'voice-recording-bar',
    stopBtnId: 'voice-stop-btn', cancelBtnId: 'voice-cancel-btn',
    timerId: 'rec-timer', stateKey: 'voice',
    onStop: (blob) => {
        const duration = Math.floor((Date.now() - state.voiceStart) / 1000);
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        const entry = { file, name: file.name, id: Date.now(), isVoice: true, duration };
        state.attachments.push(entry);
        addAttachPreview('attachments-preview', entry, state.attachments);
        showFeedback('Voice note attached 🎙️');
    }
});

setupVoiceRecording({
    btnId: 'compose-voice-btn', barId: 'compose-voice-bar',
    stopBtnId: 'compose-voice-stop', cancelBtnId: 'compose-voice-cancel',
    timerId: 'compose-rec-timer', stateKey: 'composeVoice',
    onStop: (blob) => {
        const duration = Math.floor((Date.now() - state.composeVoiceStart) / 1000);
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        const entry = { file, name: file.name, id: Date.now(), isVoice: true, duration };
        state.composeAttachments.push(entry);
        addAttachPreview('compose-attachments-preview', entry, state.composeAttachments);
        showFeedback('Voice note attached 🎙️');
    }
});

// ============ STUDY RESOURCE MODAL ============
function openStudyLinkModal(target) {
    state.studyLinkTarget = target;
    document.getElementById('study-link-modal').style.display = 'flex';
    ['study-link-url', 'study-link-title', 'study-link-subject', 'study-note-content',
        'quiz-question', 'quiz-answer', 'quiz-subject'].forEach(id => {
            document.getElementById(id).value = '';
        });
}

document.getElementById('insert-study-link-btn').addEventListener('click', () => openStudyLinkModal('reply'));
document.getElementById('compose-study-link-btn').addEventListener('click', () => openStudyLinkModal('compose'));

document.querySelectorAll('.study-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.study-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('study-link-form').style.display = btn.dataset.type === 'link' ? 'flex' : 'none';
        document.getElementById('study-note-form').style.display = btn.dataset.type === 'note' ? 'flex' : 'none';
        document.getElementById('study-quiz-form').style.display = btn.dataset.type === 'quiz' ? 'flex' : 'none';
    });
});

document.getElementById('study-link-cancel-btn').addEventListener('click', () => {
    document.getElementById('study-link-modal').style.display = 'none';
});

document.getElementById('study-link-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('study-link-modal')) {
        document.getElementById('study-link-modal').style.display = 'none';
    }
});

document.getElementById('study-link-insert-btn').addEventListener('click', () => {
    const activeType = document.querySelector('.study-type-btn.active').dataset.type;
    let resource = null;

    if (activeType === 'link') {
        const url = document.getElementById('study-link-url').value.trim();
        const title = document.getElementById('study-link-title').value.trim();
        const subject = document.getElementById('study-link-subject').value;
        if (!url) { showFeedback('Please enter a URL'); return; }
        resource = { type: 'link', url, title: title || url, subject };
    } else if (activeType === 'note') {
        const content = document.getElementById('study-note-content').value.trim();
        if (!content) { showFeedback('Please write a note'); return; }
        resource = { type: 'note', content };
    } else if (activeType === 'quiz') {
        const question = document.getElementById('quiz-question').value.trim();
        const answer = document.getElementById('quiz-answer').value.trim();
        const subject = document.getElementById('quiz-subject').value.trim();
        if (!question) { showFeedback('Please enter a question'); return; }
        resource = { type: 'quiz', question, answer, subject };
    }

    const placeholder = `[[STUDY_RESOURCE:${encodeURIComponent(JSON.stringify(resource))}]]`;
    const targetId = state.studyLinkTarget === 'reply' ? 'reply-body' : 'compose-body';
    const editor = document.getElementById(targetId);
    editor.focus();
    document.execCommand('insertText', false, placeholder);
    document.getElementById('study-link-modal').style.display = 'none';
    showFeedback('Study resource inserted 📚');
});

// ============ COMPOSE BUTTONS ============
document.getElementById('compose-btn').addEventListener('click', switchToComposeView);
document.getElementById('compose-btn-empty').addEventListener('click', switchToComposeView);
document.getElementById('compose-close-btn').addEventListener('click', switchToEmptyState);
document.getElementById('compose-send-btn').addEventListener('click', sendNewMessage);
document.getElementById('compose-discard-btn').addEventListener('click', () => {
    if (document.getElementById('compose-body').innerText.trim().length > 0) {
        if (!confirm('Discard this message?')) return;
    }
    switchToEmptyState();
});

// ============ REPLY BUTTONS ============
document.getElementById('reply-send-btn').addEventListener('click', sendReply);
document.getElementById('reply-discard-btn').addEventListener('click', () => {
    if (document.getElementById('reply-body').innerText.trim().length > 0) {
        if (!confirm('Discard your reply?')) return;
    }
    document.getElementById('reply-body').innerHTML = '';
    state.attachments.length = 0;
    document.getElementById('attachments-preview').innerHTML = '';
});

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (state.composeMode) sendNewMessage();
        else if (state.activeMessageId) sendReply();
    }
    if (e.key === 'Escape') {
        if (document.getElementById('study-link-modal').style.display === 'flex') {
            document.getElementById('study-link-modal').style.display = 'none';
        }
    }
});

// ============ INIT ============
loadMessages();

setInterval(() => {
    if (document.visibilityState === 'visible') loadMessages();
}, 60000);
/* =============================================
   MOBILE PANEL NAVIGATION
   ============================================= */

const IS_MOBILE = () => window.innerWidth <= 768;

function openMobileRightPanel() {
    if (!IS_MOBILE()) return;
    const panel = document.getElementById('msg-right-panel');
    panel.classList.add('mobile-open');
    // Show back buttons
    const backThread = document.getElementById('btn-back-to-list');
    const backCompose = document.getElementById('btn-back-compose');
    if (backThread) backThread.style.display = 'flex';
    if (backCompose) backCompose.style.display = 'flex';
}

function closeMobileRightPanel() {
    const panel = document.getElementById('msg-right-panel');
    panel.classList.remove('mobile-open');
    // Restore to empty state so the list shows cleanly
    document.getElementById('msg-empty-state').style.display = 'flex';
    document.getElementById('msg-thread-view').style.display = 'none';
    document.getElementById('msg-compose-view').style.display = 'none';
    state.activeMessageId = null;
    state.composeMode = false;
    renderMsgList(getFilteredMessages());
}

// Wire back buttons
document.getElementById('btn-back-to-list')?.addEventListener('click', closeMobileRightPanel);
document.getElementById('btn-back-compose')?.addEventListener('click', closeMobileRightPanel);

// Patch switchToThreadView
const _origThread = switchToThreadView;
switchToThreadView = function () {
    _origThread();
    openMobileRightPanel();
};

// Patch switchToComposeView
const _origCompose = switchToComposeView;
switchToComposeView = function () {
    _origCompose();
    openMobileRightPanel();
};

// ── Auto-hide bottom bar on scroll ──
const _mobileBar = document.getElementById('mobileBottomBar');
let _lastY = 0;
window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > _lastY + 10) _mobileBar?.classList.add('hide-bar');
    else if (y < _lastY - 10) _mobileBar?.classList.remove('hide-bar');
    _lastY = y;
}, { passive: true });

// ── Crisp press feedback on nav icons (no blue flash) ──
document.querySelectorAll('.mobile-nav-icon').forEach(icon => {
    // Prevent any browser default highlight
    icon.addEventListener('touchstart', (e) => {
        e.currentTarget.style.transform = 'scale(0.82)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
    }, { passive: true });

    icon.addEventListener('touchend', (e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.background = '';
    }, { passive: true });

    icon.addEventListener('touchcancel', (e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.background = '';
    }, { passive: true });
});
