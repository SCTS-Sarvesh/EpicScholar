/* -------------------------------------------
    CORE SETUP AND THEME
------------------------------------------- */
const THEME_KEY = 'epicScholarTheme';
const root = document.documentElement;
let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
let isInitialLoad = true; // For entry animations

function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    currentTheme = theme;
    updateThemeToggle(theme);
}
applyTheme(currentTheme);

function toggleTheme() {
    const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

function updateThemeToggle(theme) {
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.checked = theme === 'light';
}

const feedbackMessage = document.getElementById('feedback-message');
function showFeedback(message) {
    feedbackMessage.textContent = message;
    feedbackMessage.classList.add('show');
    setTimeout(() => feedbackMessage.classList.remove('show'), 2600);
}

/* -------------------------------------------
    DATA / MOCK POSTS
------------------------------------------- */
const state = {
    posts: [],
    currentUser: {id: 'user123', name: 'Epic Student', initials: 'ES'},
    // activeView state is no longer needed
};

function createMockPosts() {
    const c=document.createElement('canvas');c.width=800;c.height=500;const ctx=c.getContext('2d');
    ctx.fillStyle = currentTheme === 'dark' ? '#1c1c1c' : '#f0f2f5';
    ctx.fillRect(0,0,800,500);
    ctx.fillStyle = currentTheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    ctx.font='500 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Epic Learning Insight', 400, 240);
    ctx.font='300 24px Inter, sans-serif';
    ctx.fillText('A visual study note.', 400, 280);

    state.posts.push({
        id: 'welcome',
        author: 'School Admin',
        authorId: 'school',
        authorInitials: 'SA',
        time: Date.now() - 600000,
        caption: 'Welcome to EpicScholar! Explore the new liquid glass interface and share your first learning epic. Double-tap media to love it!',
        url: c.toDataURL('image/png'),
        type: 'image',
        likes: 5, loves: 2, comments: [{by:'Admin', byInitials:'A', text:'The new animations are fantastic!'}],
        likedBy: [], lovedBy: []
    });
    state.posts.push({
        id: 'video-demo',
        author: 'Science Dept',
        authorId: 'science',
        authorInitials: 'SD',
        time: Date.now() - 3600000,
        caption: 'Short explainer video on the Physics of Momentum. Remember to check out the controls!',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        type: 'video',
        likes: 10, loves: 5, comments: [{by:'Student', byInitials:'S', text:'Great video quality!'}, {by:'Epic Student', byInitials:'ES', text:'Thanks for the review!'}],
        likedBy: ['user123'], lovedBy: []
    });
}
createMockPosts();

/* -------------------------------------------
    VIEW SWITCHING (REMOVED)
    NEW navigation logic is in 'DOMContentLoaded'
------------------------------------------- */
const allNavItems = document.querySelectorAll('.sidebar .nav-item');
const feedContainer = document.getElementById('feed-container');

/**
 * NEW: Sets the 'active' class on the sidebar link
 * that matches the current page URL.
 */
function setActiveNav() {
    // Get the current page file name (e.g., "index.html" or "messages.html")
    let currentPath = window.location.pathname.split('/').pop();
    if (currentPath === '') currentPath = 'index.html'; // Default to index.html for root
    
    allNavItems.forEach(nav => {
        const navHref = nav.getAttribute('href');
        
        // Add 'active' class if href matches
        if (navHref === currentPath) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });
}


/* -------------------------------------------
    FEED RENDERING / HELPERS
------------------------------------------- */
const feed = document.getElementById('feed');
function escapeHtml(s){return String(s).replace(/[&"'<>]/g,c=>({"&":"&amp;","\"":"&quot;","'":"&#39;","<":"&lt;",">":"&gt;"}[c]))}
function formatTime(seconds) {const minutes = Math.floor(seconds / 60);const remainingSeconds = Math.floor(seconds % 60);const paddedSeconds = remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds;return `${minutes}:${paddedSeconds}`;}

const reactionMap = { lovedBy: 'loves' };

function createPostEl(post){
    const el=document.createElement('article');el.className='post';
    el.dataset.id = post.id;
    const authorName = post.authorId === state.currentUser.id ? 'You' : escapeHtml(post.author);
    const isLoved = (post.lovedBy || []).includes(state.currentUser.id);

    let mediaContent = '';
    if (post.type === 'video') {
        mediaContent = `
            <div class="video-container" style="position:relative; width:100%; height:100%;">
                <video src="${post.url}" preload="metadata" playsinline webkit-playsinline></video>
                <div class="custom-controls" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 15px; background: rgba(0, 0, 0, 0.6); transition: opacity 0.3s; border-radius: 0 0 12px 12px;">
                    <div class="timeline-bar" style="height: 6px; background: rgba(255, 255, 255, 0.18); border-radius: 3px; position: relative; margin-bottom: 10px; cursor: pointer;">
                        <div class="progress-fill" style="height: 100%; background: var(--primary-gradient); width:0;"></div>
                        <div class="timeline-thumb" style="width: 14px; height: 14px; border-radius: 50%; background-color: white; box-shadow: 0 0 0 3px var(--secondary-color); position: absolute; top: 50%; transform: translate(-50%, -50%); left: 0; transition: left 0.05s linear;"></div>
                    </div>
                    <div class="controls-bar" style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; color:white;">
                        <button class="control-btn play-pause-btn" style="background:none; border:none; color:white; font-size:20px; cursor:pointer; transition: transform 0.1s;">▶</button>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="time-display current-time" style="font-size:13px;">0:00</div>
                            <div class="time-display separator" style="font-size:13px; opacity:0.7;">/</div>
                            <div class="time-display duration" style="font-size:13px;">0:00</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="volume-container">
                                <button class="control-btn mute-btn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer;">🔊</button>
                                <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="1" style="width: 80px; margin-left: 5px;">
                            </div>
                            <button class="control-btn full-screen-btn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer;">⛶</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        mediaContent = `<img src="${post.url}" style="width:100%; height:100%; object-fit: cover;">`;
    }

    el.innerHTML=`
        <div class="meta" style="display: flex; align-items: center; margin-bottom: 15px;">
            <div class="avatar" style="width: 45px; height: 45px; min-width: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--primary-gradient); color: white; font-weight: 700; font-size: 16px; margin-right: 15px;">${post.authorInitials}</div>
            <div>
                <div class="name" style="font-weight: 700; font-size: 16px;">${authorName}</div>
                <div class="time" style="font-size: 12px; opacity: 0.6;">${new Date(post.time).toLocaleString()}</div>
            </div>
        </div>
        <div class="text-wrapping" style="margin-bottom: 20px; line-height: 1.6;">${escapeHtml(post.caption)}</div>
        <div class="media" data-id="${post.id}" style="border-radius: 12px; overflow: hidden; position: relative; height: 350px; margin-bottom: 20px; background-color: var(--secondary-glass); transition: all 0.24s;">
            ${mediaContent}
            
            <div class="heart-animation-overlay">
                <span class="heart-particle">❤️</span>
                <span class="star-particle star-1">✨</span>
                <span class="star-particle star-2">🌟</span>
                <span class="star-particle star-3">💫</span>
                <span class="star-particle star-4">✨</span>
                <span class="star-particle star-5">🌟</span>
            </div>
        </div>
        <div class="actions" style="display: flex; gap: 15px; align-items: center; position: relative;">
            <div class="btn loveBtn ${isLoved ? 'toggled' : ''}" style="padding: 10px 15px; border-radius: 20px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--text-color);">❤️ <span class="count">${post.loves||0}</span></div>
            <div class="btn commentToggle" style="padding: 10px 15px; border-radius: 20px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--text-color);">💬 <span class="count">${(post.comments||[]).length}</span></div>
            <div class="btn shareBtn" style="padding: 10px 15px; border-radius: 20px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--text-color);">🔗 Share</div>

            <div class="share-menu" aria-hidden="true">
                <button class="share-copy">📋 Copy Link</button>
                <button class="share-fb">📘 Facebook</button>
                <button class="share-whatsapp">💬 WhatsApp</button>
                <button class="share-twitter">🐦 X/Twitter</button>
            </div>
        </div>
    `;

    const loveBtn=el.querySelector('.loveBtn');
    const commentToggle=el.querySelector('.commentToggle');
    const media=el.querySelector('.media');
    const heartOverlay=media.querySelector('.heart-animation-overlay');

    function updateCountsUI() {
        loveBtn.querySelector('.count').textContent = post.loves || 0;
    }

    /* ---------------------------
        Video controls
    ----------------------------*/
    if (post.type === 'video') {
        const video = el.querySelector('video');
        const playPauseBtn = el.querySelector('.play-pause-btn');
        const muteBtn = el.querySelector('.mute-btn');
        const volumeSlider = el.querySelector('.volume-slider');
        const fullScreenBtn = el.querySelector('.full-screen-btn');
        const timeline = el.querySelector('.timeline-bar');
        const progressFill = el.querySelector('.progress-fill');
        const timelineThumb = el.querySelector('.timeline-thumb');
        const currentTimeEl = el.querySelector('.current-time');
        const durationEl = el.querySelector('.duration');

        let isDraggingTimeline = false;
        const updateControls = () => {
            playPauseBtn.textContent = (video.paused || video.ended) ? '▶' : '⏸';
            muteBtn.textContent = (video.muted || video.volume === 0) ? '🔇' : '🔊';
        };
        
        const updateSeek = (e) => {
            const rect = timeline.getBoundingClientRect();
            let clientX = e.clientX;
            if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
            let pos = clientX - rect.left;
            pos = Math.max(0, Math.min(pos, rect.width));
            const percent = pos / rect.width;
            
            if (!isNaN(video.duration)) {
                video.currentTime = percent * video.duration;
                progressFill.style.width = `${percent * 100}%`;
                timelineThumb.style.left = `${percent * 100}%`;
                currentTimeEl.textContent = formatTime(video.currentTime);
            }
        };

        video.addEventListener('click', (e) => {
            if (e.target.closest('.controls-bar')) return;
            (video.paused || video.ended) ? video.play() : video.pause();
        });
        playPauseBtn.addEventListener('click', () => {
            (video.paused || video.ended) ? video.play() : video.pause();
        });

        video.addEventListener('play', updateControls);
        video.addEventListener('pause', updateControls);
        video.addEventListener('ended', () => { 
            video.currentTime = 0; 
            updateControls(); 
        });

        video.addEventListener('loadedmetadata', () => { 
            durationEl.textContent = formatTime(video.duration); 
            updateControls();
            const initPercent = video.volume * 100;
            volumeSlider.style.background = `linear-gradient(to right, var(--primary-color) ${initPercent}%, rgba(255, 255, 255, 0.4) ${initPercent}%)`;
        });
        video.addEventListener('timeupdate', () => {
            if (!isNaN(video.duration) && !isDraggingTimeline) {
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = `${percent}%`;
                timelineThumb.style.left = `${percent}%`;
                currentTimeEl.textContent = formatTime(video.currentTime);
            }
        });

        const startDrag = (e) => { isDraggingTimeline = true; video.pause(); updateSeek(e); };
        const endDrag = (e) => { 
            if (isDraggingTimeline) { 
                isDraggingTimeline = false; 
                video.play(); 
                updateControls(); 
            } 
        };

        timeline.addEventListener('mousedown', startDrag);
        timeline.addEventListener('touchstart', startDrag);
        document.addEventListener('mousemove', (e) => { if (isDraggingTimeline) updateSeek(e); });
        document.addEventListener('touchmove', (e) => { if (isDraggingTimeline) updateSeek(e); }, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
        timeline.addEventListener('click', (e) => { if (e.target.closest('.timeline-thumb')) return; if (!isDraggingTimeline) updateSeek(e); });

        // --- FIX for Mute Button ---
        muteBtn.addEventListener('click', () => { 
            video.muted = !video.muted; 
            if (video.muted) {
                video.volume = 0; // Set volume to 0 when muting
            } else {
                video.volume = 0.5; // Restore volume when unmuting
            }
            video.dispatchEvent(new Event('volumechange')); 
            updateControls(); 
        });

        volumeSlider.addEventListener('input', (e) => {
            const newVolume = e.target.value;
            video.volume = newVolume;
            video.muted = newVolume === "0";
            
            const newPercent = newVolume * 100;
            volumeSlider.style.background = `linear-gradient(to right, var(--primary-color) ${newPercent}%, rgba(255, 255, 255, 0.4) ${newPercent}%)`;
            
            updateControls();
        });
        
        video.addEventListener('volumechange', () => {
            const percent = video.volume * 100;
            volumeSlider.value = video.volume;
            volumeSlider.style.background = `linear-gradient(to right, var(--primary-color) ${percent}%, rgba(255, 255, 255, 0.4) ${percent}%)`;
            updateControls();
        });
        
        fullScreenBtn.addEventListener('click', () => {
            const container = el.querySelector('.video-container');
            if (container.requestFullscreen) container.requestFullscreen();
            else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
            else if (container.msRequestFullscreen) container.msRequestFullscreen();
        });
    }

    // --- FIX for Modal Close Animation ---
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const imageModalClose = document.getElementById('imageModalClose');
    let lastOriginRect = null;

    function closeImageModalBounce() {
        if (!imageModal || !modalImage) return; 
        if (!lastOriginRect) {
            imageModal.classList.remove("show");
            setTimeout(() => imageModal.style.display = "none", 160);
            return;
        }
        
        const vw = window.innerWidth, vh = window.innerHeight;
        const centerX = (vw/2) - (lastOriginRect.left + lastOriginRect.width / 2);
        const centerY = (vh/2) - (lastOriginRect.top + lastOriginRect.height / 2);
        
        const modalImgWidth = modalImage.offsetWidth || 1;
        const modalImgHeight = modalImage.offsetHeight || 1;
        
        const scaleX = lastOriginRect.width / modalImgWidth;
        const scaleY = lastOriginRect.height / modalImgHeight;
        
        modalImage.classList.remove('modal-image-animate-in');
        modalImage.classList.add('modal-image-animate-out');
        
        modalImage.style.transform = `translate(${centerX}px, ${centerY}px) scale(${scaleX}, ${scaleY})`;
        modalImage.style.opacity = "0.8";

        setTimeout(() => {
            imageModal.classList.remove("show");
            imageModal.style.display = "none";
            modalImage.classList.remove('modal-image-animate-out');
            modalImage.style.transform = "";
            modalImage.style.opacity = ""; 
            lastOriginRect = null;
        }, 580); 
    }

    if (imageModal && !imageModal.dataset.listenerAttached) {
        imageModalClose.addEventListener('click', closeImageModalBounce);
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) closeImageModalBounce();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === "Escape" && imageModal.classList.contains('show'))
                closeImageModalBounce();
        });
        imageModal.dataset.listenerAttached = 'true';
    }


    /* -------------------------------------------
        Reaction logic
    -------------------------------------------*/
    function toggleReaction(btn, reactionKey, overlay, reactionLabel) {
        const userId = state.currentUser.id;
        post[reactionKey] = post[reactionKey] || [];
        const counterKey = reactionMap[reactionKey];

        const existingIndex = post[reactionKey].indexOf(userId);
        if (existingIndex !== -1) {
            post[reactionKey].splice(existingIndex, 1);
            post[counterKey] = Math.max(0, (post[counterKey] || 1) - 1);
            btn.classList.remove('toggled');
        } else {
            post[reactionKey].push(userId);
            post[counterKey] = (post[counterKey] || 0) + 1;
            btn.classList.add('toggled');

            btn.classList.remove('pulse');
            void btn.offsetWidth;
            btn.classList.add('pulse');

            if (overlay) {
                overlay.classList.add('show');
                setTimeout(()=> overlay.classList.remove('show'), 800);
            }
            showFeedback(`${reactionLabel} post! ${reactionLabel === 'Loved' ? '❤️' : ''}`);
        }
        updateCountsUI();
    }

    loveBtn.addEventListener('click', () => toggleReaction(loveBtn, 'lovedBy', heartOverlay, 'Loved'));

    let lastTap = 0;
    let tapTimer;

    media.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const now = Date.now();
        const dt = now - lastTap;
        lastTap = now;

        clearTimeout(tapTimer);

        if (dt < 300 && dt > 0) {
            e.preventDefault();
            
            const rect = media.getBoundingClientRect();
            const clickX = e.clientX;
            const clickY = e.clientY;
            
            const relativeX = clickX - rect.left;
            const relativeY = clickY - rect.top;

            heartOverlay.style.left = `${relativeX}px`;
            heartOverlay.style.top = `${relativeY}px`;

            toggleReaction(loveBtn, 'lovedBy', heartOverlay, 'Loved');
            lastTap = 0;
        } else {
            tapTimer = setTimeout(() => {
                if (post.type === 'video') return; 

                const img = media.querySelector('img');
                if (img && img.src && imageModal && modalImage) {
                    const imgRect = img.getBoundingClientRect();
                    lastOriginRect = imgRect;
                    modalImage.src = img.src;
                    
                    imageModal.style.visibility = 'hidden';
                    imageModal.style.display = 'flex';
                    
                    const modalImgWidth = modalImage.offsetWidth || 1;
                    const modalImgHeight = modalImage.offsetHeight || 1;

                    imageModal.style.visibility = 'visible';
                    imageModal.style.display = 'none';

                    setTimeout(() => {
                        imageModal.style.display = "flex";
                        
                        const vw = window.innerWidth, vh = window.innerHeight;
                        const centerX = (vw / 2) - (imgRect.left + imgRect.width / 2);
                        const centerY = (vh / 2) - (imgRect.top + imgRect.height / 2);
                        
                        const scaleX = modalImgWidth ? (imgRect.width / modalImgWidth) : 1;
                        const scaleY = modalImgHeight ? (imgRect.height / modalImgHeight) : 1;
                        
                        modalImage.style.transformOrigin = "center center";
                        modalImage.style.transform = `translate(${centerX}px, ${centerY}px) scale(${scaleX}, ${scaleY})`;
                        modalImage.style.opacity = '0.8';
                        modalImage.classList.remove("modal-image-animate-in", "modal-image-animate-out");

                        void modalImage.offsetWidth;
                        imageModal.classList.add("show");
                        setTimeout(() => {
                            modalImage.classList.add("modal-image-animate-in");
                            modalImage.style.transform = "";
                            modalImage.style.opacity = "1";
                        }, 10);
                    }, 6);
                }
            }, 300);
        }
    });

    commentToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openCommentModal(post, () => {
            commentToggle.querySelector('.count').textContent = (post.comments||[]).length;
        });
    });
    
    return el;
}

function renderFeed(postsToRender = state.posts) {
    if (!feed) return; // Do nothing if feed element doesn't exist

    if (isInitialLoad) {
        feed.innerHTML = '';
        postsToRender.forEach(p => {
            const el = createPostEl(p);
            feed.appendChild(el);
        });
        isInitialLoad = false;
    } else {
        feed.style.opacity = 0;
        setTimeout(() => {
            feed.innerHTML = '';
            postsToRender.forEach(p => {
                const el = createPostEl(p);
                feed.appendChild(el);
            });
            feed.style.opacity = 1;
        }, postsToRender.length !== state.posts.length ? 200 : 0);
    }
}

/**
 * NEW: Smoothly adds a new post to the feed
 */
function addNewPostToFeed(post) {
    if (!feed) return;

    const el = createPostEl(post);
    el.classList.add('post-enter'); // Start state (hidden)
    
    feed.prepend(el);
    
    // Force reflow
    void el.offsetWidth; 
    
    // Trigger animation
    el.classList.add('post-enter-active');
    
    // Clean up class
    setTimeout(() => {
        el.classList.remove('post-enter', 'post-enter-active');
    }, 600); // Match CSS transition
}


/* -------------------------------------------
    COMMENT MODAL LOGIC
-------------------------------------------*/
const commentModal = document.getElementById('commentModal');
const commentModalList = document.getElementById('commentModalList');
const commentModalTextarea = document.getElementById('commentModalTextarea');
const commentModalPostBtn = document.getElementById('commentModalPostBtn');
let currentPostUpdateCallback = null;

function renderCommentsForModal(post) {
    if (!commentModalList) return;
    commentModalList.innerHTML = '';
    (post.comments || []).forEach(c => {
        const isMine = c.by === state.currentUser.name;
        const d = document.createElement('div');
        d.className = `comment ${isMine ? 'mine' : ''}`;
        const commentAuthor = isMine ? 'You' : escapeHtml(c.by);
        const authorInitials = isMine ? state.currentUser.initials : (c.byInitials || c.by[0]);
        d.innerHTML = `
            <div class="cavatar" style="background:${isMine ? 'var(--bg-color)' : 'white'}; color:${isMine ? 'var(--text-color)' : 'var(--primary-color)'};">${authorInitials}</div>
            <div class="ctext">
                <strong style="font-size:14px;">${commentAuthor}</strong>
                <div class="text-wrapping" style="font-size:13px; opacity: 0.9;">${escapeHtml(c.text)}</div>
            </div>`;
        commentModalList.appendChild(d);
    });
    setTimeout(()=> commentModalList.scrollTop = commentModalList.scrollHeight, 40);
}

function openCommentModal(post, updateCallback) {
    if (!commentModal || !commentModalPostBtn || !commentModalTextarea) return;
    currentPostUpdateCallback = updateCallback;
    commentModalPostBtn.dataset.postId = post.id;
    renderCommentsForModal(post);
    commentModalTextarea.value = '';
    commentModal.classList.add('show');
    commentModal.setAttribute('aria-hidden','false');
    commentModalTextarea.focus();
}

if (commentModalPostBtn) {
    commentModalPostBtn.addEventListener('click', () => {
        const text = commentModalTextarea.value.trim();
        if (!text) return;
        const postId = commentModalPostBtn.dataset.postId;
        const post = state.posts.find(p => p.id === postId);
        if (!post) return;

        post.comments = post.comments || [];
        post.comments.push({
            by: state.currentUser.name,
            byInitials: state.currentUser.initials,
            text
        });

        commentModalTextarea.value = '';
        commentModalTextarea.style.height = 'auto';
        renderCommentsForModal(post);
        if (currentPostUpdateCallback) currentPostUpdateCallback();
        showFeedback("Comment posted! 💬");
    });
}

if (commentModalTextarea) {
    commentModalTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}
if (commentModal) {
    commentModal.addEventListener('click', (e) => {
        if (e.target === commentModal) {
            commentModal.classList.remove('show');
            commentModal.setAttribute('aria-hidden','true');
        }
    });
}
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && commentModal && commentModal.classList.contains('show')) {
        commentModal.classList.remove('show');
        commentModal.setAttribute('aria-hidden','true');
    }
});

/* -------------------------------------------
    RIGHT PANEL
-------------------------------------------*/
['closeReminder', 'closeNotifs', 'closeSchedule', 'closeTests', 'cancelUpload'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.target.closest('.mini-card')?.classList.remove('active');
    });
});

const miniCards = document.querySelectorAll('#right-panel-wrapper .mini-card');

miniCards.forEach(el => {
    const handleActivation = (activate) => {
        if (activate) {
            miniCards.forEach(ac => { if (ac !== el) ac.classList.remove('active'); });
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    };

    el.addEventListener('mouseenter', () => handleActivation(true));
    el.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (!el.matches(':hover') && el.classList.contains('active')) handleActivation(false);
        }, 140);
    });

    el.addEventListener('click', (e) => {
        if (e.target.closest('.panel-btn') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('label')) return;
        const isActive = el.classList.contains('active');
        handleActivation(!isActive);
    });
});

/* -------------------------------------------
    UPLOAD HANDLING
------------------------------------------- */
const epicFileInput=document.getElementById('epicFileInput');
const epicPreview=document.getElementById('epicPreview');
const epicCaption=document.getElementById('epicCaption');
let pending=null;

if (epicFileInput) {
    epicFileInput.addEventListener('change',(e)=>{
        const file=e.target.files[0];
        if(!file) {
            document.getElementById('fileChooseLabel').textContent = 'Select file';
            epicPreview.innerHTML='Preview';
            pending = null;
            return;
        }
        const url=URL.createObjectURL(file);
        const type=file.type.startsWith('video')?'video':'image';
        pending={file,url,type};
        document.getElementById('fileChooseLabel').textContent = file.name;
        epicPreview.innerHTML=`<div style="width:100%; height:100%; display:flex; justify-content:center; align-items:center; overflow:hidden;">
            ${type==='image'
                ? `<img src="${url}" style="max-width:100%;max-height:100%; object-fit: contain; border-radius:6px;">`
                : `<video src="${url}" controls style="max-width:100%;max-height:100%; object-fit: contain; border-radius:6px;"></video>`
            }
        </div>`;
    });
}

const confirmUploadBtn = document.getElementById('confirmUpload');
if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click',()=>{
        if(!pending) { showFeedback("Please select a file first! 👆"); return; }

        confirmUploadBtn.textContent = 'Posting...';
        confirmUploadBtn.disabled = true;

        setTimeout(() => {
            const newPost = {
                id:Date.now().toString(),
                author:state.currentUser.name,
                authorId:state.currentUser.id,
                authorInitials:state.currentUser.initials,
                time:Date.now(),
                url:pending.url,
                type:pending.type,
                caption:epicCaption.value||'Shared without a caption.',
                likes:0,loves:0,comments:[], likedBy: [], lovedBy: []
            };
            
            state.posts.unshift(newPost);
            
            // MODIFIED: Call the new smooth animation function
            addNewPostToFeed(newPost);
            
            showFeedback("Epic posted successfully! 🎉");

            // Reset form
            pending=null;
            epicFileInput.value='';
            epicPreview.innerHTML='Preview';
            epicCaption.value='';
            document.getElementById('fileChooseLabel').textContent = 'Select file';
            document.getElementById('addEpicCard').classList.remove('active');
            confirmUploadBtn.textContent = 'Post';
            confirmUploadBtn.disabled = false;
        }, 700);
    });
}

/* Init right-panel lists */
const remindersList = document.getElementById('remindersList');
if (remindersList) remindersList.innerHTML='<li style="color: var(--primary-color)">Math (Algebra) - Due Today</li><li>English Essay - Draft 1 Review</li><li>Science Lab Prep - Tomorrow</li>';

const notifList = document.getElementById('notifList');
if (notifList) notifList.innerHTML='<li style="color: var(--primary-color)">New message from Prof. X</li><li>Your post received 5 loves!</li><li>Reminder: EduBot available for tutoring.</li>';

const schedulesList = document.getElementById('schedulesList');
if (schedulesList) schedulesList.innerHTML='<li style="color: var(--primary-color)">10:00 AM - Group Study Session</li><li>1:00 PM - Math Class</li><li>3:00 PM - Library Research</li>';

const testsList = document.getElementById('testsList');
if (testsList) testsList.innerHTML='<li style="color: #ff416c; font-weight: bold;">Chemistry Test: Oct 30</li><li>Physics Quiz: Nov 5</li><li>History Midterm: Nov 15</li>';

/* -------------------------------------------
    SEARCH / NAV (MPA Version)
-------------------------------------------*/
const searchBar = document.getElementById('searchBar');
if (searchBar) {
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPosts = state.posts.filter(p => p.caption.toLowerCase().includes(searchTerm) || p.author.toLowerCase().includes(searchTerm));
        renderFeed(filteredPosts);
    });
}

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        if (searchBar) searchBar.value = '';
        renderFeed(state.posts);
        showFeedback("Feed Refreshed! 🔄");
        if (feedContainer) feedContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// REMOVED: All underline logic is gone
// REMOVED: All nav click listeners are gone (<a> tags handle it)


/* -------------------------------------------
    INITIALIZATION
-------------------------------------------*/
document.addEventListener('DOMContentLoaded', () => {
    // Render the feed *only* if the feed element exists on this page
    if (document.getElementById('feed')) {
        renderFeed();
    }
    
    // NEW: Set active nav link based on the current page URL
    setActiveNav();
    
    // Set up theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
});


/* -------------------------------------------
    SHARE MENU & UPLOAD CANCEL (IIFE)
-------------------------------------------*/
(function(){
    const cancelBtn = document.getElementById('cancelUpload');
    const epicFileInput = document.getElementById('epicFileInput');
    const epicPreview = document.getElementById('epicPreview');
    const fileChooseLabel = document.getElementById('fileChooseLabel');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (epicFileInput) {
                try { epicFileInput.value = ''; } catch(err){ /* ignore */ }
            }
            if (typeof pending !== 'undefined') pending = null;
            if (epicPreview) epicPreview.innerHTML = 'Preview';
            if (fileChooseLabel) fileChooseLabel.textContent = 'Select file';
            const card = cancelBtn.closest('.mini-card');
            if (card) card.classList.remove('active');
            showFeedback('Upload canceled.');
        });
    }

    /* SHARE MENU LOGIC */
    document.addEventListener('click', (e) => {
        if (e.target.closest('.mini-card')) return;
        document.querySelectorAll('.share-menu.show').forEach(m => {
            m.classList.remove('show');
            m.setAttribute('aria-hidden','true');
        });
    });

    document.addEventListener('click', (e) => {
        const shareBtn = e.target.closest('.shareBtn');
        if (!shareBtn) return;
        e.stopPropagation();
        
        const postRoot = shareBtn.closest('article');
        if (!postRoot) return;
        const menu = postRoot.querySelector('.share-menu');
        if (!menu) return;

        const isAlreadyShown = menu.classList.contains('show');

        document.querySelectorAll('.share-menu.show').forEach(m => {
            if (m !== menu) { 
                m.classList.remove('show'); 
                m.setAttribute('aria-hidden','true'); 
            }
        });
        
        menu.classList.toggle('show', !isAlreadyShown);
        menu.setAttribute('aria-hidden', isAlreadyShown);
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.share-menu button');
        if (!btn) return;
        e.stopPropagation();
        
        const menu = btn.closest('.share-menu');
        const post = btn.closest('article');
        const postId = post?.dataset?.id || ('post-' + Date.now());
        const postUrl = `https://epicscholar.com/post/${postId}`;
        const postCaption = post?.querySelector('.text-wrapping')?.textContent || 'Check out this post!';

        if (btn.classList.contains('share-copy')) {
            try {
                const tempInput = document.createElement('textarea');
                tempInput.value = postUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showFeedback('Link copied! 📋');
            } catch (err) {
                showFeedback('Copy failed.');
            }
        } else if (btn.classList.contains('share-fb')) {
            const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}&quote=${encodeURIComponent(postCaption)}`;
            window.open(url, '_blank');
        } else if (btn.classList.contains('share-whatsapp')) {
            const url = `httpsas://wa.me/?text=${encodeURIComponent(postCaption + '\n' + postUrl)}`;
            window.open(url, '_blank');
        } else if (btn.classList.contains('share-twitter')) {
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postCaption)}&url=${encodeURIComponent(postUrl)}`;
            window.open(url, '_blank');
        }
        
        if (menu) { 
            menu.classList.remove('show'); 
            menu.setAttribute('aria-hidden', 'true'); 
        }
    });

})();
