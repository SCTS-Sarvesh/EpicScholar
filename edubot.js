    /* ===========================
   API CONFIGURATION
=========================== */
const API_URL = 'https://epicscholar.cloud/api';

/* ---------- State ---------- */
const sidebar = document.getElementById('sidebar');
const hambtn = document.getElementById('hambtn');
const newChatBtn = document.getElementById('newChatBtn');
const headerTitle = document.getElementById('headerTitle');
const historyEl = document.getElementById('history');
const chatEl = document.getElementById('chat');
const attachRow = document.getElementById('attachRow');
const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const input = document.getElementById('userInput');
const voiceBtn = document.getElementById('voiceBtn');
const scrollBtn = document.getElementById('scrollBtn');
const inputRow = document.getElementById('inputRow');

let attachedFiles = [];
let conversationHistory = [];
let savedConversations = JSON.parse(localStorage.getItem('edubot_saved') || '[]');
let currentChatId = null;
let currentChatTitle = 'New Chat';
let isStreaming = false;
let sessionStarted = Date.now();

/* ---------- Autoscroll state ---------- */
let autoScroll = true; // if true, new content scrolls to bottom
const BOTTOM_THRESHOLD = 12; // px from bottom considered "at bottom"

/* ---------- TTS (Text-to-Speech) Logic for Streaming and Read Aloud (Updated) ---------- */
const synth = window.speechSynthesis;
let currentUtterance = null;
let currentReadBtn = null; // Track which button initiated the current reading

// Function to reset the state of the read aloud button
function resetReadButton() {
    if (currentReadBtn) {
        currentReadBtn.innerHTML = '<i class="fa-solid fa-volume-up"></i>';
        currentReadBtn.classList.remove('active');
        currentReadBtn = null;
    }
}

function stopSpeaking() {
    if (synth.speaking || synth.paused) {
        synth.cancel();
    }

    // Remove Message Box Highlight
    document.querySelectorAll('.message.reading-active').forEach(el => {
        el.classList.remove('reading-active');
    });

    // Remove Specific Word Highlight
    removeHighlight();

    resetReadButton();
    currentUtterance = null;
}

function readMessage(button) {
    // 1. Resume if paused
    if (synth.paused && currentReadBtn === button) {
        synth.resume();
        button.innerHTML = '<i class="fa-solid fa-pause"></i>';
        button.classList.add('active');
        return;
    }

    // 2. Pause if playing
    if (synth.speaking && currentUtterance && currentReadBtn === button) {
        synth.pause();
        button.innerHTML = '<i class="fa-solid fa-play"></i>';
        return;
    }

    // 3. Stop existing
    stopSpeaking();

    const messageElement = button.closest('.message');
    const contentArea = messageElement.querySelector('.message-text'); // Target specific text area
    const messageText = contentArea.textContent; // Get plain text for speech

    const utterance = new SpeechSynthesisUtterance(messageText);
    utterance.pitch = 1;
    utterance.rate = 1.0; // Slightly slower for better sync visual

    // Highlight the message box
    messageElement.classList.add('reading-active');

    // --- NEW: SYNC LOGIC ---
    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            // event.charIndex is the index of the word in the plain text
            // event.charLength is the length (sometimes undefined in some browsers, calculation fallback below)

            // Note: Chrome provides event.charLength, others might not. 
            // If length is missing, we approximate or skip.
            const len = event.charLength || ((messageText.substring(event.charIndex).match(/^\S+/) || [''])[0].length);

            highlightWord(contentArea, event.charIndex, len);
        }
    };
    // -----------------------

    utterance.onstart = () => {
        button.innerHTML = '<i class="fa-solid fa-pause"></i>';
        button.classList.add('active');
    };

    utterance.onend = () => {
        resetReadButton();
        messageElement.classList.remove('reading-active');
        removeHighlight(); // Clean up last word
    };

    utterance.onerror = () => {
        resetReadButton();
        messageElement.classList.remove('reading-active');
        removeHighlight();
    };

    currentUtterance = utterance;
    currentReadBtn = button;
    synth.speak(utterance);
}

function copyToClipboard(button) {
    const messageElement = button.closest('.message');
    const messageText = messageElement.querySelector('.message-text').textContent;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(messageText).then(() => {
            showToast('Copied to clipboard!'); // Calls the new UI toast
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy', 'fa-circle-xmark');
        });
    }
}


/* ---------- Session Storage ---------- */
function getSessionChat() {
    const key = `edubot_session_${sessionStarted}`;
    return JSON.parse(sessionStorage.getItem(key) || '{"history":[],"html":"","id":null,"title":"New Chat"}');
}
function saveSessionChat() {
    const key = `edubot_session_${sessionStarted}`;
    sessionStorage.setItem(key, JSON.stringify({
        history: conversationHistory.slice(),
        html: chatEl.innerHTML,
        id: currentChatId,
        title: currentChatTitle
    }));
}

/* ---------- New Chat ---------- */
newChatBtn.addEventListener('click', () => {
    if (chatEl.innerHTML.trim() && conversationHistory.length > 0) {
        saveCurrentChatToHistory();
    }
    clearChat();
});

// REPLACE the entire clearChat() function with this:
function clearChat() {
    chatEl.innerHTML = '';
    conversationHistory = [];
    attachedFiles = [];
    renderAttachPreviews();
    currentChatId = null;
    currentChatTitle = 'New Chat';
    // ✅ Only update the text node, never overwrite innerHTML (preserves ham button)
    const titleTextNode = headerTitle.querySelector('#headerTitleText');
    if (titleTextNode) titleTextNode.textContent = currentChatTitle;
    else headerTitle.lastChild.textContent = currentChatTitle;   // fallback
    input.value = '';
    input.focus();
    sessionStarted = Date.now();
    saveSessionChat();
    stopSpeaking();
}

/* ---------- Sidebar behavior ---------- */
hambtn.addEventListener('click', () => {
    const isMin = sidebar.classList.toggle('min');
    if (window.innerWidth <= 900) sidebar.classList.toggle('show', !isMin);
});

// REPLACE the entire renderHistory() function (lines 186–237) with this:
function renderHistory() {
    const mobileHistEl = document.getElementById('mobileHistory');
    const containers = [historyEl];
    if (mobileHistEl) containers.push(mobileHistEl);

    containers.forEach(container => {
        container.innerHTML = '';

        if (!savedConversations.length) {
            container.innerHTML = `
    <div style="padding:30px 20px;text-align:center;opacity:0.6;">
        <div style="font-size:36px;margin-bottom:10px;">💬</div>
        <div style="font-size:14px;font-weight:600;">No saved chats</div>
        <div style="font-size:12px;margin-top:4px;opacity:0.7;">Start a new chat to see history here</div>
    </div>`;
            return;
        }

        const now = new Date();
        const groups = { Today: [], Yesterday: [], Older: [] };

        for (const c of savedConversations) {
            const d = new Date(c.date);
            const diff = (now - d) / (1000 * 60 * 60 * 24);
            if (diff < 1) groups.Today.push(c);
            else if (diff < 2) groups.Yesterday.push(c);
            else groups.Older.push(c);
        }

        for (const label of ['Today', 'Yesterday', 'Older']) {
            const list = groups[label];
            if (!list.length) continue;

            const section = document.createElement('div');
            section.className = 'hist-section';
            section.innerHTML = `<h4>${label}</h4>`;
            container.appendChild(section);

            for (const item of list) {
                const div = document.createElement('div');
                div.className = 'chat-entry';
                div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

                const titleSpan = document.createElement('span');
                titleSpan.textContent = escapeHtml(item.title);
                titleSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

                const delBtn = document.createElement('span');
                delBtn.className = 'del';
                delBtn.textContent = '🗑';
                delBtn.style.cssText = 'flex-shrink:0;margin-left:12px;padding:6px;cursor:pointer;font-size:16px;opacity:0.75;';

                // ✅ Delete — live event, no clone issues
                delBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    savedConversations = savedConversations.filter(s => s.id !== item.id);
                    localStorage.setItem('edubot_saved', JSON.stringify(savedConversations));
                    renderHistory();
                    if (currentChatId === item.id) clearChat();
                });

                // ✅ Load chat — live event on the real DOM node
                div.addEventListener('click', () => {
                    if (chatEl.innerHTML.trim() && conversationHistory.length > 0) {
                        saveCurrentChatToHistory();
                    }
                    chatEl.innerHTML = item.html;
                    conversationHistory = item.history || [];
                    currentChatId = item.id;
                    currentChatTitle = item.title;

                    // Safe header update — won't wipe hamburger button
                    const titleNode = document.getElementById('headerTitleText');
                    if (titleNode) titleNode.textContent = currentChatTitle;
                    else headerTitle.lastChild.textContent = currentChatTitle;

                    chatEl.scrollTop = chatEl.scrollHeight;
                    attachedFiles = [];
                    renderAttachPreviews();
                    saveSessionChat();
                    stopSpeaking();

                    // ✅ Close mobile drawer after selecting a chat
                    const overlay = document.getElementById('mobileHistoryOverlay');
                    if (overlay) {
                        overlay.classList.remove('show');
                        document.body.style.overflow = '';
                    }
                });

                div.appendChild(titleSpan);
                div.appendChild(delBtn);
                container.appendChild(div);
            }
        }
    });
}
renderHistory();

/* ---------- Helpers ---------- */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ---------- Improved Markdown Formatter (supports headings, lists, code blocks, inline code, tables, bold/italic) ---------- */
function formatMarkdownToHtml(rawText) {
    if (!rawText) return '';
    // First escape to avoid XSS
    const text = escapeHtml(rawText);

    // handle code fences first (``` ... ```)
    const codeBlocks = [];
    let placeholderIndex = 0;
    const codeFenceRe = /```([\s\S]*?)```/g;
    const withPlaceholders = text.replace(codeFenceRe, (m, inner) => {
        const token = `@@CODE_BLOCK_${placeholderIndex}@@`;
        codeBlocks.push(inner);
        placeholderIndex++;
        return token;
    });

    const lines = withPlaceholders.split(/\r?\n/);
    let out = '';
    let inList = false;
    let listType = null; // 'ul' or 'ol'
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Table detection: simple pipe tables
        if (/^\s*\|.*\|\s*$/.test(line)) {
            inTable = true;
            tableRows.push(line.trim());
            continue;
        } else if (inTable) {
            // flush table
            out += renderTableFromRows(tableRows);
            tableRows = [];
            inTable = false;
        }

        // Headings
        const hMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
        if (hMatch) {
            // close list if open
            if (inList) {
                out += closeList(listType);
                inList = false; listType = null;
            }
            const level = hMatch[1].length;
            out += `<h${level}>${inlineFormat(hMatch[2])}</h${level}>`;
            continue;
        }

        // Ordered list
        const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
        // Unordered list
        const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);

        if (ulMatch || olMatch) {
            const thisType = ulMatch ? 'ul' : 'ol';
            const itemText = (ulMatch ? ulMatch[1] : olMatch[1]).trim();

            if (!inList) {
                // open list
                out += `<${thisType}>`;
                inList = true;
                listType = thisType;
            } else if (listType !== thisType) {
                // close previous, open new
                out += closeList(listType);
                out += `<${thisType}>`;
                listType = thisType;
            }
            out += `<li>${inlineFormat(itemText)}</li>`;
            continue;
        } else {
            if (inList) {
                out += closeList(listType);
                inList = false; listType = null;
            }
        }

        // Blank line -> paragraph break
        if (line.trim() === '') {
            out += '<br/>';
            continue;
        }

        // Inline formatting and simple block paragraphs
        out += `<p style="margin:0;padding:0;">${inlineFormat(line)}</p>`;
    }

    if (inList) {
        out += closeList(listType);
    }
    if (inTable && tableRows.length) {
        out += renderTableFromRows(tableRows);
    }

    // Put back code blocks
    let final = out;
    for (let j = 0; j < codeBlocks.length; j++) {
        const token = `@@CODE_BLOCK_${j}@@`;
        const raw = codeBlocks[j];
        // Keep inner as escaped text but wrap in pre/code
        final = final.split(token).join(`<pre class="code-block" style="background:rgba(0,0,0,0.45);padding:8px;border-radius:6px;overflow:auto"><code>${raw.replace(/</g, '&lt;')}</code></pre>`);
    }

    // Clean multiple <br/>
    final = final.replace(/(<br\/>\s*){2,}/g, '<br/>');

    return final;
}

// helper: inline formatting of bold, italic, inline code, emoji shortcuts
function inlineFormat(s) {
    if (!s) return '';
    // inline code `code`
    s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.95em">$1</code>');
    // bold **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // italic *text*
    s = s.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);
    // emoji shortcuts like :smile:
    s = s.replace(/:([a-z0-9_+-]+):/gi, (m, name) => {
        const map = { smile: '😊', thumbs_up: '👍', heart: '❤️', fire: '🔥', star: '⭐' };
        return map[name] || m;
    });
    // auto-link URLs (simple)
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
}

function closeList(type) {
    return `</${type}>`;
}

function renderTableFromRows(rows) {
    // rows are strings like "| a | b |"
    if (!rows.length) return '';
    // sanitize and parse
    const parsed = rows.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    // If only one row — treat as normal line(s)
    if (parsed.length < 2) {
        return parsed.map(r => r.join(' | ')).map(cell => `<p>${inlineFormat(cell)}</p>`).join('');
    }
    const header = parsed[0];
    let html = '<table class="markdown-table"><thead><tr>';
    header.forEach(h => html += `<th>${inlineFormat(h)}</th>`);
    html += '</tr></thead><tbody>';
    for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        // skip divider rows like ---|--- 
        if (row.every(c => /^-+$/.test(c))) continue;
        html += '<tr>';
        row.forEach(c => html += `<td>${inlineFormat(c)}</td>`);
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

/* ---------- Message rendering ---------- */
function appendMessage(text, sender, images = []) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = `message ${sender}`;

    // Images
    if (images && images.length > 0) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'message-images';
        images.forEach(imgSrc => {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.className = 'inline-image';
            imgContainer.appendChild(img);
        });
        div.appendChild(imgContainer);
    }

    const content = document.createElement('div');
    content.className = 'message-text';
    content.innerHTML = formatMarkdownToHtml(text); // Initial content if not streaming
    div.appendChild(content);

    // Actions Bar
    const actionsBar = document.createElement('div');
    actionsBar.className = 'actions-bar';

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp-text';
    timestampSpan.textContent = timestamp;
    actionsBar.appendChild(timestampSpan);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyBtn.onclick = () => copyToClipboard(copyBtn);
    copyBtn.title = 'Copy message';
    actionsBar.appendChild(copyBtn);

    const readBtn = document.createElement('button');
    readBtn.className = 'action-btn';
    readBtn.innerHTML = '<i class="fa-solid fa-volume-up"></i>';
    readBtn.onclick = () => readMessage(readBtn);
    readBtn.title = 'Read aloud';
    actionsBar.appendChild(readBtn);

    div.appendChild(actionsBar);

    chatEl.appendChild(div);
    if (autoScroll) chatEl.scrollTop = chatEl.scrollHeight;
    return content; // Return the text container for streaming updates
}


function appendUserMessage(text, images) {
    appendMessage(text, 'user', images);
}


/* ---------- Typing indicator (Updated) ---------- */
function showTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'message bot';
    el.dataset.typing = '1';
    el.innerHTML = `
        <div class="typing-container">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <span>EduBot is thinking</span>
        </div>
    `;
    chatEl.appendChild(el);
    if (autoScroll) chatEl.scrollTop = chatEl.scrollHeight;
    return el;
}
function removeTypingIndicator(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

/* ---------- Streaming bot message: real-time formatted + autoscroll handling (Updated with TTS) ---------- */
function appendBotMessageStream(text, images = []) {
    stopSpeaking(); // Stop any previous speech synthesis immediately

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = 'message bot';

    // Add images first if any
    if (images.length > 0) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'message-images';
        images.forEach(img => {
            const imgEl = document.createElement('img');
            imgEl.src = img;
            imgEl.className = 'inline-image';
            imgContainer.appendChild(imgEl);
        });
        div.appendChild(imgContainer);
    }

    const textContainer = document.createElement('div');
    textContainer.className = 'message-text';
    div.appendChild(textContainer);

    // Actions Bar (initially empty, filled on finalization)
    const actionsBar = document.createElement('div');
    actionsBar.className = 'actions-bar';
    div.appendChild(actionsBar);


    chatEl.appendChild(div);
    if (autoScroll) chatEl.scrollTop = chatEl.scrollHeight;

    // Split by words/punctuation chunks for better TTS/streaming
    const tokens = text.match(/[^.!?]+[.!?]|\s+|\S+/g) || [text];
    let idx = 0;
    let currentText = '';
    isStreaming = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-square"></i>';

    const pump = async () => {
        if (!isStreaming) {
            finalizeStream();
            return;
        }

        if (idx >= tokens.length) {
            finalizeStream();
            return;
        }

        const chunk = tokens[idx];
        currentText += chunk;
        idx++;

        // NO AUTOMATIC READ ALOUD HERE

        // REAL-TIME formatting and CURSOR
        const formatted = formatMarkdownToHtml(currentText);
        textContainer.innerHTML = formatted + `<span class="cursor"></span>`;

        if (autoScroll) chatEl.scrollTop = chatEl.scrollHeight;

        const delay = 35;
        await new Promise(r => setTimeout(r, delay));
        pump();
    };

    const finalizeStream = () => {
        // Clean up cursor
        textContainer.innerHTML = formatMarkdownToHtml(currentText);

        // Add final actions bar content
        actionsBar.innerHTML = `
            <span class="timestamp-text">${timestamp}</span>
            <button class="action-btn" onclick="copyToClipboard(this)" title="Copy message"><i class="fa-solid fa-copy"></i></button>
            <button class="action-btn" onclick="readMessage(this)" title="Read aloud"><i class="fa-solid fa-volume-up"></i></button>
        `;

        isStreaming = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        saveSessionChat();
        if (autoScroll) chatEl.scrollTop = chatEl.scrollHeight;
    };

    pump();
}

/* ---------- Error message ---------- */
function appendBotMessageError(msg) {
    stopSpeaking();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = 'message bot';
    div.innerHTML = escapeHtml(msg);

    const actionsBar = document.createElement('div');
    actionsBar.className = 'actions-bar';
    actionsBar.innerHTML = `<span class="timestamp-text">${timestamp} (Error)</span>`;

    div.appendChild(actionsBar);
    chatEl.appendChild(div);

    if (autoScroll) chatEl.scrollTop = chatEl.scrollHeight;
    isStreaming = false;
    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
}

/* ---------- File attach UI ---------- */
fileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
    attachedFiles = [...e.target.files];
    renderAttachPreviews();
});

function renderAttachPreviews() {
    attachRow.innerHTML = '';
    if (!attachedFiles.length) { attachRow.setAttribute('aria-hidden', 'true'); return; }
    attachRow.setAttribute('aria-hidden', 'false');
    attachedFiles.forEach((f, idx) => {
        const el = document.createElement('div');
        if (f.type.startsWith('image/')) {
            const img = document.createElement('img'); img.src = URL.createObjectURL(f); img.className = 'attach-thumb';
            el.appendChild(img);
        } else {
            const d = document.createElement('div'); d.textContent = f.name;
            d.style.cssText = 'padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            el.appendChild(d);
        }
        const rm = document.createElement('button'); rm.className = 'icon-btn'; rm.style.width = '30px'; rm.style.height = '30px'; rm.style.marginLeft = '8px';
        rm.innerHTML = '✕'; rm.title = 'Remove';
        rm.addEventListener('click', (ev) => { ev.stopPropagation(); attachedFiles.splice(idx, 1); renderAttachPreviews(); });
        el.style.display = 'flex'; el.style.alignItems = 'center';
        el.appendChild(rm);
        attachRow.appendChild(el);
    });
}

/* ---------- AI Chat Name Generation (from entire conversation) ---------- */
async function generateChatName(conversationContext) {
    try {
        const messages = conversationContext.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.parts[0]?.text || ''}`).join('\n');
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyAzgHW7uamKpDl0UGbJKusgXgc0E5kgsTg`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: `Based on this conversation topic, generate a short, concise title (max 6 words). Return ONLY the title:\n\n${messages}` }]
                }]
            })
        });
        const data = await res.json();
        const title = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Chat';
        return title.substring(0, 50);
    } catch (err) {
        return 'New Chat';
    }
}

/* ---------- Send & Stream ---------- */
sendBtn.addEventListener('click', () => {
    if (isStreaming) {
        // stop streaming (pump will check isStreaming and finalize)
        isStreaming = false;
        stopSpeaking();
        return;
    }
    startSend();
});
input.addEventListener('keypress', e => { if (e.key === 'Enter' && !isStreaming) startSend(); });

async function startSend() {
    const text = input.value.trim();
    if (!text && attachedFiles.length === 0) return;

    input.value = ''; // Clear input immediately

    const parts = [{ text }];
    const userImageUrls = []; // To store data URLs for the UI

    for (const f of attachedFiles) {
        if (f.type.startsWith('image/')) {
            const base64Url = await toBase64(f);
            userImageUrls.push(base64Url); // For UI
            const base64Data = base64Url.split(',')[1];
            parts.push({ inlineData: { mimeType: f.type, data: base64Data } }); // For API
        } else {
            parts.push({ text: `[file:${f.name}]` });
        }
    }

    appendUserMessage(text, userImageUrls); // Use the updated appendMessage
    attachedFiles = [];
    renderAttachPreviews();

    conversationHistory.push({ role: 'user', parts: parts });

    const typingEl = showTypingIndicator();
    isStreaming = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-square"></i>';

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyAzgHW7uamKpDl0UGbJKusgXgc0E5kgsTg`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: conversationHistory.slice(-6) })
        });

        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";

        removeTypingIndicator(typingEl);
        appendBotMessageStream(reply, []);
        conversationHistory.push({ role: 'model', parts: [{ text: reply }] });

        // Generate chat name based on conversation topic
        if (currentChatTitle === 'New Chat' && !currentChatId && conversationHistory.length >= 2) {
            const name = await generateChatName(conversationHistory);
            currentChatTitle = name;
            const _ht = document.getElementById('headerTitleText');
            if (_ht) _ht.textContent = currentChatTitle;
            else headerTitle.lastChild.textContent = currentChatTitle;
            saveSessionChat();
        } else if (conversationHistory.length > 6 && conversationHistory.length % 4 === 0) {
            const name = await generateChatName(conversationHistory);
            if (name !== 'New Chat') currentChatTitle = name;
            const _ht = document.getElementById('headerTitleText');
            if (_ht) _ht.textContent = currentChatTitle;
            else headerTitle.lastChild.textContent = currentChatTitle;
            saveSessionChat();
        }

    }
    catch (err) {
        removeTypingIndicator(typingEl);
        appendBotMessageError('Error: ' + err.message);
    }
}

/* ---------- Save & Restore chats ---------- */
function saveCurrentChatToHistory() {
    if (!conversationHistory.length) return;

    const record = {
        id: currentChatId,
        title: currentChatTitle || 'New Chat',
        date: new Date().toISOString(),
        html: chatEl.innerHTML,
        history: conversationHistory.slice()
    };

    if (currentChatId) {
        const idx = savedConversations.findIndex(c => c.id === currentChatId);
        if (idx > -1) {
            savedConversations.splice(idx, 1);
        }
        savedConversations.unshift(record);
    } else {
        record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        currentChatId = record.id;
        savedConversations.unshift(record);
    }

    if (savedConversations.length > 50) savedConversations.pop();
    localStorage.setItem('edubot_saved', JSON.stringify(savedConversations));
    renderHistory();
}

/* ---------- Load session on page load ---------- */
window.addEventListener('load', () => {
    renderHistory();
    const session = getSessionChat();
    if (session.history.length > 0) {
        conversationHistory = session.history;
        chatEl.innerHTML = session.html;
        chatEl.scrollTop = chatEl.scrollHeight;
        currentChatId = session.id;
        currentChatTitle = session.title || 'New Chat';
        const _ht = document.getElementById('headerTitleText');
        if (_ht) _ht.textContent = currentChatTitle;
        else headerTitle.lastChild.textContent = currentChatTitle;
    }
    input.focus();
});

/* ---------- Voice ---------- */
let rec = null, recOn = false;
if ('webkitSpeechRecognition' in window) {
    rec = new webkitSpeechRecognition();
    rec.lang = 'en-US';
    rec.onstart = () => {
        voiceBtn.classList.add('recording');
    };
    rec.onend = () => {
        voiceBtn.classList.remove('recording');
        recOn = false;
    };
    rec.onresult = e => { input.value = e.results[0][0].transcript; };
}
voiceBtn.addEventListener('click', () => {
    if (!rec) { alert('Voice not supported by this browser'); return; }
    if (!recOn) { rec.start(); recOn = true; }
    else { rec.stop(); }
});

/* ---------- Scroll / Autoscroll behavior ---------- */
// Replace previous scroll handler: decide autoscroll vs manual
chatEl.addEventListener('scroll', () => {
    const distanceFromBottom = chatEl.scrollHeight - (chatEl.scrollTop + chatEl.clientHeight);
    if (distanceFromBottom > BOTTOM_THRESHOLD) {
        autoScroll = false; // user scrolled up
    } else {
        autoScroll = true; // near bottom, re-enable autoscroll
    }

    // show manual scroll-to-bottom button if user isn't at bottom
    if (distanceFromBottom > 220) scrollBtn.classList.add('show');
    else scrollBtn.classList.remove('show');
});
scrollBtn.addEventListener('click', () => {
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
    // after smooth scroll finishes, ensure autoScroll true (approx)
    setTimeout(() => { autoScroll = true; scrollBtn.classList.remove('show'); }, 300);
});

/* ---------- Utilities ---------- */
function toBase64(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => { res(r.result); }
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}

/* ---------- Save session before leaving ---------- */
window.addEventListener('beforeunload', () => {
    if (conversationHistory.length > 0) {
        saveCurrentChatToHistory();
    }
    // Ensure speech is cancelled before closing/reloading
    stopSpeaking();
});
/* ---------- Toast Notification Logic ---------- */
function showToast(message, icon = 'fa-circle-check') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); // Wait for fade out
    }, 3000);
}
/* ---------- TTS Highlighting Helpers ---------- */
let currentHighlightSpan = null;

// Removes the span wrapper from the currently highlighted word
function removeHighlight() {
    if (currentHighlightSpan && currentHighlightSpan.parentNode) {
        const parent = currentHighlightSpan.parentNode;
        // Move text out of span
        while (currentHighlightSpan.firstChild) {
            parent.insertBefore(currentHighlightSpan.firstChild, currentHighlightSpan);
        }
        // Remove empty span
        parent.removeChild(currentHighlightSpan);
        // Clean up adjacent text nodes (optional, keeps DOM clean)
        parent.normalize();
        currentHighlightSpan = null;
    }
}

// Complex logic to find the specific text node from a global character index
function highlightWord(rootElement, startIndex, wordLength) {
    removeHighlight(); // Clear previous

    if (!rootElement || wordLength === 0) return;

    let charCount = 0;
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;
    let foundStart = false;
    let foundEnd = false;

    // Recursive function to traverse text nodes
    function traverse(node) {
        if (foundEnd) return;

        if (node.nodeType === 3) { // Text Node
            const nodeLength = node.textContent.length;
            const nextCharCount = charCount + nodeLength;

            // Check if start index falls in this node
            if (!foundStart && startIndex >= charCount && startIndex < nextCharCount) {
                startNode = node;
                startOffset = startIndex - charCount;
                foundStart = true;
            }

            // Check if end index falls in this node (end index = startIndex + wordLength)
            if (foundStart && !foundEnd && (startIndex + wordLength) <= nextCharCount) {
                endNode = node;
                endOffset = (startIndex + wordLength) - charCount;
                foundEnd = true;
            }

            charCount = nextCharCount;
        } else if (node.nodeType === 1) { // Element Node
            for (let i = 0; i < node.childNodes.length; i++) {
                traverse(node.childNodes[i]);
            }
        }
    }

    traverse(rootElement);

    if (startNode && endNode && startNode === endNode) {
        // Create Range and Surround with Span
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        const span = document.createElement('span');
        span.className = 'highlight-word';

        try {
            range.surroundContents(span);
            currentHighlightSpan = span;
        } catch (e) {
            console.log('Skipping highlight across complex boundaries');
        }
    }
}
// REPLACE the entire (function initMobile() { ... })(); block with this:
(function initMobile() {
    const overlay = document.getElementById('mobileHistoryOverlay');
    const mobileHamBtn = document.getElementById('mobileHamBtn');
    const closeBtn = document.getElementById('closeHistoryBtn');
    const mobileNew = document.getElementById('mobileNewChatBtn');
    const desktopNew = document.getElementById('newChatBtn');
    const bar = document.getElementById('mobileBottomBar');
    const drawer = document.getElementById('mobileHistoryDrawer');

    function openDrawer() {
        if (window.innerWidth > 1023) return;
        // ✅ Re-render with live events — never clone innerHTML
        renderHistory();
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    mobileHamBtn?.addEventListener('click', openDrawer);
    closeBtn?.addEventListener('click', closeDrawer);

    // Tap the dark backdrop to close
    overlay?.addEventListener('click', (e) => {
        if (!drawer.contains(e.target)) closeDrawer();
    });

    // Mobile New Chat
    mobileNew?.addEventListener('click', () => {
        closeDrawer();
        desktopNew?.click();
    });

    // Swipe down on drawer to close
    let touchStartY = 0;
    drawer?.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    drawer?.addEventListener('touchmove', (e) => {
        if (e.touches[0].clientY - touchStartY > 60) closeDrawer();
    }, { passive: true });

    // Auto-hide bottom bar when chat is scrolled
    const chatEl = document.getElementById('chat');
    let lastY = 0;
    chatEl?.addEventListener('scroll', () => {
        if (window.innerWidth > 1023) return;
        const y = chatEl.scrollTop;
        if (y > lastY + 12) bar?.classList.add('hide-bar');
        else if (y < lastY - 12) bar?.classList.remove('hide-bar');
        lastY = y;
    }, { passive: true });

    // ✅ NO MutationObserver cloning — renderHistory() handles both lists directly
})();
/* Nav sidebar hover → shift input row */
const navSidebar = document.querySelector('.nav-sidebar');
const inputRowEl = document.querySelector('.input-row');
const attachRowEl = document.querySelector('.attach-row');

if (navSidebar && inputRowEl) {
    navSidebar.addEventListener('mouseenter', () => {
        inputRowEl.style.left = 'calc(var(--nav-max-width) + var(--history-max-width))';
        if (attachRowEl) attachRowEl.style.left = 'calc(var(--nav-max-width) + var(--history-max-width))';
    });
    navSidebar.addEventListener('mouseleave', () => {
        inputRowEl.style.left = 'calc(var(--nav-min-width) + var(--history-max-width))';
        if (attachRowEl) attachRowEl.style.left = 'calc(var(--nav-min-width) + var(--history-max-width))';
    });
}
