let experiences = [];
let offices = [];
let majors = [];
let departmentAttributes = {};
let definitions = {}; // <-- Add this

// Load data from multiple JSON files in /data (async)
async function loadExperienceData() {
    try {
        const [experiencesRes, officesRes, majorsRes, departmentAttributesRes, definitionsRes] = await Promise.all([
            fetch('data/experiences.json'),
            fetch('data/offices.json'),
            fetch('data/majors.json'),
            fetch('data/department_attributes.json'),
            fetch('data/definitions.json')
        ]);

        experiences = await experiencesRes.json() || [];
        offices = await officesRes.json() || [];
        majors = await majorsRes.json() || [];
        departmentAttributes = await departmentAttributesRes.json() || {};
        definitions = await definitionsRes.json() || {};

    } catch (e) {
        console.error("Failed to load experience data.", e);
        // Fallback: empty arrays/objects
        experiences = [];
        offices = [];
        majors = [];
        departmentAttributes = {};
        definitions = {};
    }
}

// --- EXISTING BOT LOGIC BELOW (unchanged except for data source) ---

let chatbotState = {
    mode: "student",
    step: 0,
    filters: [],
    major: null
};

// Max number of filters allowed
const MAX_FILTERS = 5;
// Max number of filter attempts allowed
const MAX_FILTER_ATTEMPTS = 5;

// Track filter attempts
let filterAttempts = 0;

// Utility functions to show/hide toolbar
function showToolbar() {
    const toolbar = document.getElementById('chatbot-toolbar');
    if (toolbar) toolbar.classList.add('show');
}
function hideToolbar() {
    const toolbar = document.getElementById('chatbot-toolbar');
    if (toolbar) toolbar.classList.remove('show');
}

// Helper to show filter tags. Assumes #chatbot-filter-tags exists after #chatbot-toolbar.
function showFilterTags() {
    const tagAreaId = "chatbot-filter-tags";
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    const toolbar = document.getElementById('chatbot-toolbar');
    let tagArea = document.getElementById(tagAreaId);

    // Fallback: If tagArea is missing or not in the correct place, create/move it.
    // This should ideally not be needed if HTML is correct and no other JS removes it.
    if (!tagArea) {
        tagArea = document.createElement('div');
        tagArea.id = tagAreaId;
        if (toolbar && optionsDrawer) {
            // Insert after toolbar
            optionsDrawer.insertBefore(tagArea, toolbar.nextSibling);
        } else if (optionsDrawer) {
            // Fallback if toolbar is missing, insert before options or append
            const optionsDiv = document.getElementById('chatbot-options');
            if (optionsDiv) {
                optionsDrawer.insertBefore(tagArea, optionsDiv);
            } else {
                optionsDrawer.appendChild(tagArea);
            }
        }
    } else if (tagArea.parentNode !== optionsDrawer || (toolbar && tagArea.previousSibling !== toolbar)) {
        // If it exists but is in the wrong place (e.g., detached or misplaced)
        if(tagArea.parentNode) {
            tagArea.parentNode.removeChild(tagArea);
        }
        if (toolbar && optionsDrawer) {
            optionsDrawer.insertBefore(tagArea, toolbar.nextSibling);
        }
        // else: if toolbar or optionsDrawer is missing, tagArea might not be placeable.
    }


    // Populate tagArea
    tagArea.innerHTML = "";
    let hasTags = false;
    if (chatbotState.major && chatbotState.major !== "No major specified" && chatbotState.major !== undefined && chatbotState.major !== null && chatbotState.major !== "") {
        const tag = document.createElement('span');
        tag.className = "chatbot-filter-tag";
        tag.textContent = chatbotState.major;
        tagArea.appendChild(tag);
        hasTags = true;
    }
    const activeFilters = Object.values(filterSelections).flat();
    if (activeFilters.length > 0) hasTags = true;
    activeFilters.forEach(f => {
        const tag = document.createElement('span');
        tag.className = "chatbot-filter-tag";
        tag.textContent = f;
        tagArea.appendChild(tag);
    });

    // Hide tag area if no tags, show if there are tags
    tagArea.style.display = hasTags ? "" : "none";

    // Always scroll tags to the rightmost position
    setTimeout(() => {
        tagArea.scrollLeft = tagArea.scrollWidth;
    }, 0);
}

// Add CSS for filter tags (only once)
if (!document.getElementById('chatbot-filter-tag-style')) {
    const style = document.createElement('style');
    style.id = 'chatbot-filter-tag-style';
    document.head.appendChild(style);
}

// Utility: always scroll messages to bottom
function scrollMessagesToBottom() {
    const msgArea = document.getElementById('chatbot-messages');
    if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;
}

// Utility: scroll messages to top
function scrollMessagesToTop() {
    const msgArea = document.getElementById('chatbot-messages');
    if (msgArea) msgArea.scrollTop = 0;
}

// Utility: always scroll options to top and messages to bottom
function scrollOptionsToTop() {
    const optArea = document.getElementById('chatbot-options');
    if (optArea) optArea.scrollTop = 0;
    // Always scroll messages to bottom when options change
    scrollMessagesToBottom();
}

// --- Message queue with delay between bubbles ---
let messageQueue = [];
let isMessageProcessing = false;
const MESSAGE_DELAY = 800; // ms between bubbles

function queueMessage(text, sender = "bot", cb) {
    messageQueue.push({ text, sender, cb });
    processMessageQueue();
}

function processMessageQueue() {
    if (isMessageProcessing || messageQueue.length === 0) return;
    lockChatbotUI();
    isMessageProcessing = true;
    const { text, sender, cb } = messageQueue.shift();
    addMessageImmediate(text, sender, () => {
        if (cb) cb();
        setTimeout(() => {
            isMessageProcessing = false;
            // Only unlock UI if queue is empty (prevents double-unlock)
            if (messageQueue.length === 0) unlockChatbotUI();
            processMessageQueue();
        }, MESSAGE_DELAY);
    });
}

// --- Replace ALL addMessage calls for user/bot bubbles with queueMessage everywhere except inside queue/processing logic ---

// --- Utility: send a sequence of user messages, then a bot message, all with delays ---
function queueUserAndBotMessages(userMsgs, botMsg, afterBot) {
    // userMsgs: array of strings (user messages)
    // botMsg: string (bot message)
    // afterBot: callback after bot message
    let idx = 0;
    function sendNextUser() {
        if (idx < userMsgs.length) {
            queueMessage(userMsgs[idx], "user", () => {
                idx++;
                sendNextUser();
            });
        } else {
            if (botMsg) {
                queueMessage(botMsg, "bot", afterBot);
            } else if (afterBot) {
                afterBot();
            }
        }
    }
    sendNextUser();
}

// --- Rename the original addMessage to addMessageImmediate ---
function addMessageImmediate(text, sender = "bot", cb) {
    const msgArea = document.getElementById('chatbot-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chatbot-msg ' + sender;
    const bubble = document.createElement('div');
    bubble.className = 'chatbot-bubble ' + sender;
    msgDiv.appendChild(bubble);
    msgArea.appendChild(msgDiv);

    // Always scroll to bottom after any change
    setTimeout(scrollMessagesToBottom, 0);

    if (sender === "bot") {
        // If the text contains HTML tags, use innerHTML for the final output
        let isHtml = /<\/?[a-z][\s\S]*>/i.test(text);
        let i = 0;
        function typeChar() {
            if (i <= text.length) {
                if (isHtml) {
                    // Show all at once if HTML (no typing animation)
                    bubble.innerHTML = text;
                    if (cb) cb();
                } else {
                    bubble.textContent = text.slice(0, i);
                    scrollMessagesToBottom();
                    i++;
                    setTimeout(typeChar, 12);
                }
            } else if (cb) {
                cb();
            }
        }
        typeChar();
    } else {
        bubble.textContent = text;
        if (cb) cb();
    }
    // Scroll to bottom again after animation
    setTimeout(scrollMessagesToBottom, 100);
}

// Typing animation for bot messages
function addMessage(text, sender = "bot", cb) {
    const msgArea = document.getElementById('chatbot-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chatbot-msg ' + sender;
    const bubble = document.createElement('div');
    bubble.className = 'chatbot-bubble ' + sender;
    msgDiv.appendChild(bubble);
    msgArea.appendChild(msgDiv);

    // Always scroll to bottom after any change
    setTimeout(scrollMessagesToBottom, 0);

if (sender === "bot") {
    // If the text contains HTML tags, use innerHTML for the final output
    let isHtml = /<\/?[a-z][\s\S]*>/i.test(text);
    let i = 0;
    function typeChar() {
        if (i <= text.length) {
            if (isHtml) {
                // Show all at once if HTML (no typing animation)
                bubble.innerHTML = text;
                if (cb) cb();
            } else {
                bubble.textContent = text.slice(0, i);
                scrollMessagesToBottom();
                i++;
                setTimeout(typeChar, text.length > 60 ? 9 : 20);
            }
        } else if (cb) {
            cb();
        }
    }
    typeChar();
} else {
    bubble.textContent = text;
    if (cb) cb();
}
    // Scroll to bottom again after animation
    setTimeout(scrollMessagesToBottom, 100);
}

// --- Animation Utilities ---
function animateIn(element, className = 'animate-in') {
    if (!element) return;
    element.classList.remove('animate-out');
    element.classList.add(className);
    element.style.display = '';
    // Remove the class after animation completes to allow re-trigger
    element.addEventListener('animationend', function handler() {
        element.classList.remove(className);
        element.removeEventListener('animationend', handler);
    });
}
function animateOut(element, className = 'animate-out') {
    if (!element) return;
    element.classList.remove('animate-in');
    element.classList.add(className);
    element.addEventListener('animationend', function handler() {
        element.style.display = 'none';
        element.classList.remove(className);
        element.removeEventListener('animationend', handler);
    });
}

// Helper to set options
function setOptions(options) {
    const optArea = document.getElementById('chatbot-options');
    if (!optArea) return;
    
    // Clear existing content first
    optArea.innerHTML = '';
    
    // Show or hide the options drawer based on options
    if (options && options.length > 0) {
        showOptionsDrawer();
        // Don't animate if we're just updating content
        if (optArea.style.display === 'none') {
            animateIn(optArea);
        }
    } else {
        animateOut(optArea);
        hideOptionsDrawer();
        return; // Exit early if no options to show
    }

    // --- Overhauled button layout logic ---
    const container = document.createElement('div');
    container.className = 'chatbot-options-btn-container';

    const LONG_BUTTON_CHAR_LIMIT = 22;
    const createButton = (opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'chatbot-option-btn';
        btn.style.opacity = '0';
        btn.style.transform = 'translateY(20px)';
        if (opt.icon) {
            const iconCircle = document.createElement('div');
            iconCircle.className = 'chatbot-btn-icon-circle';
            const icon = document.createElement('i');
            icon.className = `ri-${opt.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            iconCircle.appendChild(icon);
            btn.appendChild(iconCircle);
        }
        const labelSpan = document.createElement('span');
        labelSpan.className = 'chatbot-btn-label';
        labelSpan.textContent = opt.label;
        btn.appendChild(labelSpan);
        btn.onclick = () => {
            if (chatbotUILocked) return;
            const isShowMore = typeof opt.label === "string" && (
                opt.label.toLowerCase().includes("show more") ||
                opt.label.toLowerCase().includes("load more")
            );
            if (!isShowMore) lockChatbotUI();
            opt.onClick();
        };
        // Animate in with stagger
        setTimeout(() => {
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
            btn.style.transition = 'opacity 0.35s var(--fluid-ease), transform 0.35s var(--fluid-ease)';
        }, 40 + idx * 60);
        return btn;
    };
    let i = 0;
    while (i < options.length) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '0.5em';
        row.style.width = '100%';
        const opt1 = options[i];
        const isOpt1Long = opt1.label.length > LONG_BUTTON_CHAR_LIMIT;
        const hasOpt1Width = opt1.width === 'full' || opt1.width === 'half';
        if (opt1.width === 'full' || (!hasOpt1Width && isOpt1Long)) {
            const btn1 = createButton(opt1, i);
            btn1.style.width = '100%';
            row.appendChild(btn1);
            i++;
        } else {
            const btn1 = createButton(opt1, i);
            i++;
            if (i < options.length) {
                const opt2 = options[i];
                const isOpt2Long = opt2.label.length > LONG_BUTTON_CHAR_LIMIT;
                const hasOpt2Width = opt2.width === 'full' || opt2.width === 'half';
                const canPair = (opt1.width === 'half' && opt2.width === 'half') || (!hasOpt1Width && !hasOpt2Width && !isOpt1Long && !isOpt2Long);
                if (canPair) {
                    const btn2 = createButton(opt2, i);
                    btn1.style.width = 'calc(50% - 0.25em)';
                    btn2.style.width = 'calc(50% - 0.25em)';
                    row.appendChild(btn1);
                    row.appendChild(btn2);
                    i++;
                } else {
                    btn1.style.width = '100%';
                    row.appendChild(btn1);
                }
            } else {
                btn1.style.width = '100%';
                row.appendChild(btn1);
            }
        }
        container.appendChild(row);
    }
    optArea.appendChild(container);
    // Only animate in if options are present
    if (options && options.length > 0) animateIn(optArea);
    scrollOptionsToTop();
}

// Observe changes to messages/options and auto-scroll as needed
(function observeChatbotScroll() {
    const msgArea = document.getElementById('chatbot-messages');
    const optArea = document.getElementById('chatbot-options');
    if (window.MutationObserver && msgArea && optArea) {
        const msgObs = new MutationObserver(() => scrollMessagesToBottom());
        msgObs.observe(msgArea, { childList: true, subtree: true });
        const optObs = new MutationObserver(() => scrollOptionsToTop());
        optObs.observe(optArea, { childList: true, subtree: true });
    }
})();

// Chatbot logic steps
async function chatbotStart() {
    // Wait for data to be loaded before starting
    if (!experiences.length || !offices.length || !majors.length || !Object.keys(departmentAttributes).length) {
        await loadExperienceData();
    }
    chatbotState = { mode: null, step: 0, filters: [], major: null };
    filterAttempts = 0;
    filterTopicIndex = 0;
    filterSelections = {};

    // Ensure a clean UI state before starting
    document.getElementById('chatbot-messages').innerHTML = '';
    const optArea = document.getElementById('chatbot-options');
    if (optArea) optArea.innerHTML = '';
    hideToolbar();
    hideAdvisorBanner();
    const tagArea = document.getElementById('chatbot-filter-tags');
    if (tagArea) tagArea.style.display = "none";
    showFilterTags();

    queueMessage("Opportunity awaits! To begin, let's get to know you a bit.", "bot", () => {
        setOptions([
            { label: "I'm a Student", icon: "user-line", onClick: () => chatbotChooseMode("student") },
            // { label: "I'm Faculty / Staff", icon: "user-2-line", onClick: () => chatbotChooseMode("faculty") },
            // { label: "I'm a Community Partner", icon: "group-2-line", onClick: () => chatbotChooseMode("community") }
        ]);
    });
}

// --- Main mode router ---
function chatbotChooseMode(mode) {
    chatbotState.mode = mode;
    queueMessage(
        mode === "student"
            ? "I'm a student."
            : mode === "faculty"
            ? "I'm a faculty/staff member."
            : "I'm a Community Partner.",
        "user"
    );
    if (mode === "student") {
        chatbotStudentFlowStart();
    } else if (mode === "faculty") {
        chatbotGenericFilterFlowStart("faculty");
    } else if (mode === "community") {
        chatbotGenericFilterFlowStart("community");
    }
}

// --- Student flow (unchanged) ---
function chatbotStudentFlowStart() {
    chatbotState.step = 0;
    chatbotState.filters = [];
    chatbotState.major = null;
    filterTopicIndex = 0;
    filterSelections = {};
    showFilterTags();
    hideToolbar();

    queueMessage("Alright!", "bot", () => {
        queueMessage("Some programs have major-specific internship courses for students.", "bot", () => {
            queueMessage("You can explore the major-specific experiences or search all opportunities.", "bot", () => {
                setupMajorSearch();
            });
        });
    });
}

function setupMajorSearch() {
    const optArea = document.getElementById('chatbot-options');
    optArea.innerHTML = '';
    optArea.className = 'chatbot-options major-search-active';
    // Create a scrollable container for search input and results
    const scrollableContainer = document.createElement('div');
    scrollableContainer.className = 'major-search-scroll-area';
    // Container for the search input (this will be sticky)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'chatbot-major-search-container';
    searchContainer.style.opacity = '0';
    searchContainer.style.transform = 'translateY(20px)';
    const searchIcon = document.createElement('i');
    searchIcon.className = 'ri-search-line';
    searchContainer.appendChild(searchIcon);
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search for your major...';
    input.className = 'chatbot-major-search-input';
    searchContainer.appendChild(input);
    scrollableContainer.appendChild(searchContainer);
    // Container for major results
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'major-results';
    resultsContainer.className = 'chatbot-major-results';
    resultsContainer.style.opacity = '0';
    resultsContainer.style.transform = 'translateY(20px)';
    scrollableContainer.appendChild(resultsContainer);
    optArea.appendChild(scrollableContainer);
    // Container for the static buttons below (the fixed part)
    const staticButtonsContainer = document.createElement('div');
    staticButtonsContainer.className = 'chatbot-major-static-buttons';
    staticButtonsContainer.style.opacity = '0';
    staticButtonsContainer.style.transform = 'translateY(20px)';
    optArea.appendChild(staticButtonsContainer);
    // Animate in the search UI components only after they are in the DOM
    setTimeout(() => {
        [searchContainer, resultsContainer, staticButtonsContainer].forEach((el, idx) => {
            el.style.transition = 'opacity 0.35s var(--fluid-ease), transform 0.35s var(--fluid-ease)';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 10);

    input.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredMajors = majors.filter(major => 
            major.name.toLowerCase().includes(searchTerm)
        );
        renderMajorResults(filteredMajors, resultsContainer);
    });

    // Initial render of all majors
    renderMajorResults(majors, resultsContainer);

    // Add static buttons
    renderStaticMajorButtons(staticButtonsContainer);
}

function renderMajorResults(majors, container) {
    container.innerHTML = '';
    majors.forEach(major => {
        // Each item is an anchor tag that looks exactly like a button
        const majorLink = document.createElement('a');
        majorLink.className = 'chatbot-option-btn'; // Use the existing button class
        majorLink.href = major.url;
        majorLink.target = '_blank';
        majorLink.rel = 'noopener noreferrer';

        // Style it to have content justified to the start
        majorLink.style.justifyContent = 'space-between';
        majorLink.style.animation = 'none'; // Disable entry animation for search results
        majorLink.style.opacity = '1';

        const majorName = document.createElement('span');
        majorName.className = 'chatbot-btn-label';
        majorName.textContent = major.name;
        majorName.style.textAlign = 'left';
        majorName.style.flexGrow = '1';

        const icon = document.createElement('i');
        icon.className = 'ri-arrow-right-line';

        majorLink.appendChild(majorName);
        majorLink.appendChild(icon);
        container.appendChild(majorLink);
    });
}

function renderStaticMajorButtons(container) {
    container.innerHTML = ''; // Clear previous buttons
    const buttons = [
        { 
            label: "Major missing", 
            icon: "question-line",
            onClick: () => {
                queueMessage("I don't see my major listed.", "user", () => {
                    chatbotState.major = "No major specified"; // Set a placeholder major
                    filterTopicIndex = 0;
                    filterSelections = {};
                    const optArea = document.getElementById('chatbot-options');
                    if (optArea) optArea.classList.remove('major-search-active');
                    chatbotAskFilterTopic();
                    // The loading overlay is hidden inside chatbotAskFilterTopic's callback
                });
            }
        },
        { 
            label: "Skip this", 
            icon: "arrow-right-s-line",
            onClick: () => {
                queueMessage("Just show me everything.", "user", () => {
                    chatbotState.major = "No major specified"; // Set a placeholder major
                    filterTopicIndex = 0;
                    filterSelections = {};
                    const optArea = document.getElementById('chatbot-options');
                    if (optArea) optArea.classList.remove('major-search-active');
                    chatbotAskFilterTopic();
                    // The loading overlay is hidden inside chatbotAskFilterTopic's callback
                });
            }
        }
    ];

    // We can't use setOptions here as it would clear the search input and results.
    // So, we'll create the buttons manually.
    buttons.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'chatbot-option-btn';
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'chatbot-btn-label';
        labelSpan.textContent = opt.label;

        if (opt.icon) {
            const icon = document.createElement('i');
            icon.className = `ri-${opt.icon}`;
            
            // For the skip button, put the icon after the label.
            if (opt.label === "Skip this") {
                btn.appendChild(labelSpan);
                btn.appendChild(icon);
            } else {
                // For all other buttons, icon comes first.
                btn.appendChild(icon);
                btn.appendChild(labelSpan);
            }
        } else {
            // If no icon, just add the label.
            btn.appendChild(labelSpan);
        }

        btn.onclick = () => {
            if (chatbotUILocked) return;
            lockChatbotUI();
            showLoadingOverlay(); // Show overlay on click
            // Use a timeout to ensure the overlay renders before proceeding
            setTimeout(() => {
                opt.onClick();
            }, 250);
        };
        container.appendChild(btn);
    });
}


// --- Generic filter flow for faculty/staff and community partners ---
function chatbotGenericFilterFlowStart(role) {
    chatbotState.step = 0;
    chatbotState.filters = [];
    chatbotState.major = null;
    filterTopicIndex = 0;
    filterSelections = {};
    showFilterTags();
    hideToolbar();
    // Role-specific intro
    let introMsg = "";
    if (role === "faculty") {
        introMsg = "What's your department, or focus area?";
    } else if (role === "community") {
        introMsg = "What is your organization or focus area?";
    }
    queueMessage(introMsg, "bot", () => {
        setOptions(
            majors.map(m => ({
                label: m,
                onClick: () => chatbotSetGenericMajor(role, m)
            }))
        );
    });
}

function chatbotSetGenericMajor(role, major) {
    chatbotState.major = major;
    queueMessage(major, "user", () => {
        filterTopicIndex = 0;
        filterSelections = {};
        chatbotState.filters = [];
        showFilterTags();
        chatbotAskGenericFilterTopic(role);
    });
}

function chatbotAskGenericFilterTopic(role) {
    // If all topics done, show results
    if (filterTopicIndex >= genericFilterTopics.length) {
        chatbotState.filters = Object.values(filterSelections).flat();
        showFilterTags();
        chatbotShowGenericResults(role, chatbotState.filters);
        return;
    }
    const topic = genericFilterTopics[filterTopicIndex];
    // Role-specific question phrasing
    let label = topic.label;
    if (role === "faculty") {
        if (topic.key === "type") label = "What kind of experience are you looking to offer or support?";
        else if (topic.key === "compensation") label = "Will this opportunity be paid or unpaid?";
        else if (topic.key === "location") label = "Where will the experience take place?";
        else if (topic.key === "timing") label = "When will the experience be available?";
        else if (topic.key === "credit") label = "Can students earn course credit for this experience?";
    } else if (role === "community") {
        if (topic.key === "type") label = "What type of experience are you looking to provide?";
        else if (topic.key === "compensation") label = "Will this opportunity be paid or unpaid?";
        else if (topic.key === "location") label = "Where will the experience take place?";
        else if (topic.key === "timing") label = "When will the experience be available?";
        else if (topic.key === "credit") label = "Can students earn course credit for this experience?";
    }
    queueMessage(label, "bot", () => {
        renderGenericFilterScreen(role, topic);
    });
}

function renderGenericFilterScreen(role, topic) {
    const optArea = document.getElementById('chatbot-options');
    optArea.innerHTML = '';

    showToolbar();
    updatePersistentToolbar(topic);

    const currentSelectionsForTopic = filterSelections[topic.key] || [];
    topic.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'chatbot-option-btn';
        if (currentSelectionsForTopic.includes(opt.value)) btn.classList.add('selected');
        if (opt.icon) {
            const iconCircle = document.createElement('div');
            iconCircle.className = 'chatbot-btn-icon-circle';
            const icon = document.createElement('i');
            icon.className = `ri-${opt.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            iconCircle.appendChild(icon);
            btn.appendChild(iconCircle);
        }
        const labelSpan = document.createElement('span');
        labelSpan.className = 'chatbot-btn-label';
        labelSpan.textContent = opt.label;
        btn.appendChild(labelSpan);

        // Info icon
        const infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.className = 'chatbot-info-btn';
        infoBtn.style.position = 'absolute';
        infoBtn.style.right = '0.7em';
        infoBtn.style.top = '50%';
        infoBtn.style.transform = 'translateY(-50%)';
        infoBtn.style.background = 'none';
        infoBtn.style.border = 'none';
        infoBtn.style.padding = '0';
        infoBtn.style.margin = '0';
        infoBtn.style.cursor = 'pointer';
        infoBtn.style.fontSize = '1.2em';
        infoBtn.style.color = '#888';
        infoBtn.setAttribute('tabindex', '0');
        infoBtn.setAttribute('aria-label', `More info about ${opt.label}`);
        infoBtn.innerHTML = '<i class="ri-information-line" style = "color: var(--ocean-deep);opacity: 50%;"></i>';
        infoBtn.onclick = (e) => {
            e.stopPropagation();
            showInfoModal(opt.label, definitions[opt.value] || "No additional information available.");
        };
        btn.style.position = 'relative';
        btn.appendChild(infoBtn);

        btn.onclick = () => {
            let selections = filterSelections[topic.key] || [];
            const isSelected = selections.includes(opt.value);
            if (isSelected) {
                selections = selections.filter(v => v !== opt.value);
                btn.classList.remove('selected');
            } else {
                selections = [...selections, opt.value];
                btn.classList.add('selected');
            }
            filterSelections[topic.key] = selections;
            showFilterTags();
            updatePersistentToolbar(topic);
            scrollMessagesToBottom();
        };

        btn.style.animationDelay = (0.08 * idx) + 's';
        optArea.appendChild(btn);
        void btn.offsetWidth;
        btn.style.opacity = '';
    });

    setTimeout(() => {
        optArea.scrollTop = 0;
        scrollMessagesToBottom();
    }, 0);
}

function updatePersistentToolbar(topic) {
    const toolbar = document.getElementById('chatbot-toolbar');
    if (!toolbar) return;

    // --- Determine which filter topics array to use based on mode ---
    let topicsArr = filterTopics;
    if (chatbotState.mode === "faculty" || chatbotState.mode === "community") {
        topicsArr = genericFilterTopics;
    }

    // --- NEW: Add a virtual "final" step after the last filter topic ---
    const isFinalStep = filterTopicIndex === topicsArr.length;
    const shouldShow =
        typeof filterTopicIndex === 'number' &&
        filterTopicIndex >= 0 &&
        filterTopicIndex <= topicsArr.length; // allow one step past last topic

    if (shouldShow) {
        toolbar.classList.add('show');
    } else {
        toolbar.classList.remove('show');
    }

    if (!shouldShow) return;

    const btnBack = document.getElementById('chatbot-toolbar-back');
    const btnNext = document.getElementById('chatbot-toolbar-next');
    const btnResults = document.getElementById('chatbot-toolbar-results');
    const btnStartOver = document.getElementById('chatbot-toolbar-startover');

    // --- NEW: On the final step, only show Back and Restart ---
    if (isFinalStep) {
        btnBack.style.display = filterTopicIndex > 0 ? '' : 'none';
        btnNext.style.display = 'none';
        btnResults.style.display = 'none';
        btnStartOver.style.display = '';
        btnBack.innerHTML = '';
        btnBack.appendChild(makeBtnContent('Back', 'arrow-left-line', false));
        btnBack.onclick = () => {
            if (chatbotUILocked) return;
            lockChatbotUI();
            showLoadingOverlay();
            setTimeout(() => {
                // Clear selections for the current topic before going back
                const currentTopic = topicsArr[filterTopicIndex];
                if (currentTopic && filterSelections[currentTopic.key]) {
                    delete filterSelections[currentTopic.key];
                    showFilterTags(); // Update UI
                }

                filterTopicIndex--;
                const prevTopic = topicsArr[filterTopicIndex];
                while (msgArea.lastElementChild) {
                    const last = msgArea.lastElementChild;
                    const isBotMsg = last.classList.contains('bot');
                    if (isBotMsg && last.querySelector('.chatbot-bubble')?.textContent === prevTopic.label) {
                        break;
                    }
                    msgArea.removeChild(last);
                }
                if (msgArea.lastElementChild && msgArea.lastElementChild.classList.contains('bot') &&
                    msgArea.lastElementChild.querySelector('.chatbot-bubble')?.textContent === prevTopic.label) {
                    msgArea.removeChild(msgArea.lastElementChild);
                }
                queueMessage(prevTopic.label, "bot", () => {
                    if (chatbotState.mode === "faculty" || chatbotState.mode === "community") {
                        renderGenericFilterScreen(chatbotState.mode, prevTopic);
                    } else {
                        renderFilterScreen(prevTopic);
                    }
                    hideLoadingOverlay();
                });
            }, 500);
        };
        btnStartOver.onclick = () => {
            if (chatbotUILocked) return;
            lockChatbotUI();
            chatbotStart();
        };
        return;
    }

    // --- Normal steps (not final) ---
    const showBack = filterTopicIndex > 0;
    const showNext = filterTopicIndex < topicsArr.length;

    btnBack.style.display = showBack ? '' : 'none';
    btnNext.style.display = showNext ? '' : 'none';
    btnResults.style.display = 'none'; // never show in toolbar
    btnStartOver.style.display = '';

    btnBack.innerHTML = '';
    btnNext.innerHTML = '';

    const selections = filterSelections[topic.key] || [];
    const nextLabel = selections.length === 0 ? 'Skip' : 'Next';

    function makeBtnContent(labelText, iconClass, arrowAfter = true) {
        const label = document.createElement('span');
        label.className = 'chatbot-btn-label';
        label.textContent = labelText;
        const icon = document.createElement('i');
        icon.className = `ri-${iconClass}`;
        icon.setAttribute('aria-hidden', 'true');
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        if (arrowAfter) {
            label.style.marginRight = '0.5em';
            wrapper.appendChild(label);
            wrapper.appendChild(icon);
        } else {
            icon.style.marginRight = '0.5em';
            wrapper.appendChild(icon);
            wrapper.appendChild(label);
        }
        return wrapper;
    }

    if (showBack && showNext) {
        btnBack.appendChild(makeBtnContent('Back', 'arrow-left-line', false));
        btnNext.appendChild(makeBtnContent(nextLabel, 'arrow-right-line', true));
    } else if (showBack && !showNext) {
        btnBack.appendChild(makeBtnContent('Back', 'arrow-left-line', false));
    } else if (!showBack && showNext) {
        btnNext.appendChild(makeBtnContent(nextLabel, 'arrow-right-line', true));
    }

    // Remove previous click handlers to avoid stacking
    btnBack.onclick = null;
    btnNext.onclick = null;

    btnBack.onclick = () => {
        if (chatbotUILocked) return;
        lockChatbotUI();
        showLoadingOverlay();
        setTimeout(() => {
            // Clear selections for the current topic before going back
            const currentTopic = topicsArr[filterTopicIndex];
            if (currentTopic && filterSelections[currentTopic.key]) {
                delete filterSelections[currentTopic.key];
                showFilterTags(); // Update UI
            }

            filterTopicIndex--;
            const prevTopic = topicsArr[filterTopicIndex];
            while (msgArea.lastElementChild) {
                const last = msgArea.lastElementChild;
                const isBotMsg = last.classList.contains('bot');
                if (isBotMsg && last.querySelector('.chatbot-bubble')?.textContent === prevTopic.label) {
                    break;
                }
                msgArea.removeChild(last);
            }
            if (msgArea.lastElementChild && msgArea.lastElementChild.classList.contains('bot') &&
                msgArea.lastElementChild.querySelector('.chatbot-bubble')?.textContent === prevTopic.label) {
                msgArea.removeChild(msgArea.lastElementChild);
            }
            queueMessage(prevTopic.label, "bot", () => {
                if (chatbotState.mode === "faculty" || chatbotState.mode === "community") {
                    renderGenericFilterScreen(chatbotState.mode, prevTopic);
                } else {
                    renderFilterScreen(prevTopic);
                }
                hideLoadingOverlay();
            });
        }, 500);
    };

    btnNext.onclick = () => {
        if (chatbotUILocked) return;
        lockChatbotUI();
        showLoadingOverlay();
        setTimeout(() => {
            const topic = topicsArr[filterTopicIndex];
            const selections = filterSelections[topic.key] || [];
            const userMsgs = selections.map(sel => {
                const opt = topic.options.find(o => o.value === sel);
                return opt ? opt.label : sel;
            });
            // If next is the final step, show the "Show Results" option set
            if (filterTopicIndex + 1 === topicsArr.length) {
                queueUserAndBotMessages(
                    userMsgs,
                    "Ready to see your results?",
                    () => {
                        filterTopicIndex++;
                        renderShowResultsStep();
                        hideLoadingOverlay();
                    }
                );
            } else {
                queueUserAndBotMessages(
                    userMsgs,
                    null, // No bot message, let chatbotAskFilterTopic handle it
                    () => {
                        filterTopicIndex++;
                        if (chatbotState.mode === "faculty" || chatbotState.mode === "community") {
                            chatbotAskGenericFilterTopic(chatbotState.mode);
                        } else {
                            chatbotAskFilterTopic();
                        }
                        // hideLoadingOverlay is handled by the ask topic function
                    }
                );
            }
        }, 500);
    };

    // --- Update next/skip label live when selections change ---
    const optArea = document.getElementById('chatbot-options');
    if (optArea && btnNext) {
        if (btnNext._labelUpdater) {
            optArea.removeEventListener('click', btnNext._labelUpdater);
        }
        btnNext._labelUpdater = function () {
            setTimeout(() => {
                const selections = filterSelections[topic.key] || [];
                btnNext.innerHTML = '';
                btnNext.appendChild(makeBtnContent(selections.length === 0 ? 'Skip' : 'Next', 'arrow-right-line', true));
                btnNext.onclick = () => {
                    if (chatbotUILocked) return;
                    lockChatbotUI();
                    showLoadingOverlay();
                    setTimeout(() => {
                        const topic = topicsArr[filterTopicIndex];
                        const selections = filterSelections[topic.key] || [];
                        const userMsgs = selections.map(sel => {
                            const opt = topic.options.find(o => o.value === sel);
                            return opt ? opt.label : sel;
                        });
                        if (filterTopicIndex + 1 === topicsArr.length) {
                            queueUserAndBotMessages(
                                userMsgs,
                                "Ready to see your results?",
                                () => {
                                    filterTopicIndex++;
                                    renderShowResultsStep();
                                    hideLoadingOverlay();
                                }
                            );
                        } else {
                            queueUserAndBotMessages(
                                userMsgs,
                                null, // No bot message, let chatbotAskFilterTopic handle it
                                () => {
                                    filterTopicIndex++;
                                    if (chatbotState.mode === "faculty" || chatbotState.mode === "community") {
                                        chatbotAskGenericFilterTopic(chatbotState.mode);
                                    } else {
                                        chatbotAskFilterTopic();
                                    }
                                    // hideLoadingOverlay is handled by the ask topic function
                                }
                            );
                        }
                    }, 500);
                };
            }, 10);
        };
        optArea.addEventListener('click', btnNext._labelUpdater);
    }

    btnStartOver.onclick = () => {
        if (chatbotUILocked) return;
        lockChatbotUI();
        chatbotStart();
    };

    // Helper for button content
    function makeBtnContent(labelText, iconClass, arrowAfter = true) {
        const label = document.createElement('span');
        label.className = 'chatbot-btn-label';
        label.textContent = labelText;
        const icon = document.createElement('i');
        icon.className = `ri-${iconClass}`;
        icon.setAttribute('aria-hidden', 'true');
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        if (arrowAfter) {
            label.style.marginRight = '0.5em';
            wrapper.appendChild(label);
            wrapper.appendChild(icon);
        } else {
            icon.style.marginRight = '0.5em';
            wrapper.appendChild(icon);
            wrapper.appendChild(label);
        }
        return wrapper;
    }
}

function renderShowResultsStep() {
    const optArea = document.getElementById('chatbot-options');
    optArea.innerHTML = '';
    showToolbar();
    // Toolbar: show Back and Restart, hide Next and Results
    const toolbar = document.getElementById('chatbot-toolbar');
    if (toolbar) {
        document.getElementById('chatbot-toolbar-back').style.display = filterTopicIndex > 0 ? '' : 'none';
        document.getElementById('chatbot-toolbar-next').style.display = 'none';
        document.getElementById('chatbot-toolbar-results').style.display = 'none';
        document.getElementById('chatbot-toolbar-startover').style.display = '';
    }
    // Big "Show Results" button
    const btn = document.createElement('button');
    btn.className = 'chatbot-option-btn chatbot-show-results-btn';
    btn.style.fontSize = '1em';
    btn.style.padding = '1em';
    btn.style.margin = 'auto';
    btn.style.display = 'flex';
    btn.innerHTML = `<span class="chatbot-btn-label">Show Results</span> <i class="ri-arrow-right-line"></i>`;
    btn.onclick = () => {
        chatbotState.filters = Object.values(filterSelections).flat();
        if (chatbotState.mode === "faculty" || chatbotState.mode === "community") {
            chatbotShowGenericResults(chatbotState.mode, chatbotState.filters);
        } else {
            chatbotShowResults(chatbotState.filters);
        }
    };
    optArea.appendChild(btn);
}

// --- Add: Helper function to show/hide advisor banner ---
function showAdvisorBanner() {
    const banner = document.getElementById('chatbot-advisor-banner');
    if (banner) {
        banner.style.display = 'flex';
    }
}

function hideAdvisorBanner() {
    const banner = document.getElementById('chatbot-advisor-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// --- Add: Helper function to format experience terms into a single message string ---
function formatExperienceTermsMessage(experiencesList, introPrefix) {
    if (!experiencesList || experiencesList.length === 0) {
        // Fallback if no experiences, though typically handled before calling this
        return introPrefix + "no specific experiences found. We can look at general campus resources.";
    }

    // Local pluralizeExperience helper
    function pluralizeExperience(name, expName) {
        expName = expName.toLowerCase();
        if (expName === "research" || expName === "service learning") {
            return name; // No pluralization
        }
        if (expName === "practicum") {
            return name.replace(/(<b>)(.*?)(<\/b>)/i, (_, open, inner, close) => `${open}practica${close}`);
        }
        return name.replace(/(<b>)(.*?)(<\/b>)/i, (_, open, inner, close) => `${open}${inner}s${close}`);
    }

    const clickableNames = experiencesList.map(exp =>
        `<span class="chatbot-def-term" data-exp-name="${encodeURIComponent(exp.name)}"><b>${exp.name.toLowerCase()}<i class="ri-information-fill chatbot-term-info"></i></b></span>`
    );

    const pluralizedNames = experiencesList.map((exp, idx) => pluralizeExperience(clickableNames[idx], exp.name));

    let termsPortion;
    if (pluralizedNames.length === 1) {
        termsPortion = pluralizedNames[0] + ".";
    } else if (pluralizedNames.length === 2) {
        termsPortion = `${pluralizedNames[0]}, or ${pluralizedNames[1]}.`;
    } else { // More than 2
        const allButLast = pluralizedNames.slice(0, -1).join(", ");
        const last = pluralizedNames[pluralizedNames.length - 1];
        termsPortion = `${allButLast}, or ${last}.`;
    }
    return introPrefix + termsPortion;
}

// --- Add: Helper function to attach click handlers to definition terms ---
function attachClickHandlersToTerms(experienceDataArray) {
    const msgArea = document.getElementById('chatbot-messages');
    if (!msgArea) return;
    // Target terms in the last bot message to avoid re-attaching to old messages
    const lastBotBubble = msgArea.querySelector('.chatbot-msg.bot:last-child .chatbot-bubble');
    if (!lastBotBubble) return;

    const terms = lastBotBubble.querySelectorAll('.chatbot-def-term');
    terms.forEach(term => {
        term.style.cursor = "pointer";
        term.title = "Tap to see definition";
        // Remove old handler before adding new one to prevent duplicates if this function were ever called on same bubble
        term.onclick = null;
        term.onclick = function(e) {
            const expName = decodeURIComponent(term.getAttribute('data-exp-name'));
            const exp = experienceDataArray.find(x => x.name.toLowerCase() === expName.toLowerCase());
            if (exp) {
                showInfoModal(exp.name, exp.description || "No additional information available.");
            }
        };
    });
}


function chatbotShowResults(filters) {
    hideToolbar();
    chatbotState.filters = filters;
    showFilterTags();
    showOptionsDrawer();
    const msgArea = document.getElementById('chatbot-messages');
    if (msgArea) {
        msgArea.innerHTML = '';
        // Scroll to top immediately after clearing messages
        scrollMessagesToTop();
    }
    // Add advisor banner at the top
    showAdvisorBanner();

    const canonicalTerms = [
        "academic internship", "paid internship", "research", "fellowship",
        "service learning", "clinical placement", "practicum"
    ];

    let userTags = [];
    if (chatbotState.major && departmentAttributes[chatbotState.major]) {
        userTags = [...departmentAttributes[chatbotState.major]];
    }
    if (chatbotState.major) {
        userTags.push(chatbotState.major.toLowerCase());
    }
    userTags = userTags.concat(filters.map(f => f.toLowerCase()));

    function matchScore(exp) {
        let expTags = (exp.tags || []).map(t => t.toLowerCase());
        let score = userTags.reduce((s, tag) => expTags.includes(tag) ? s + 1 : s, 0);
        if (canonicalTerms.includes(exp.name.toLowerCase())) score += 2;
        return score;
    }

    let scoredResults = experiences.map(exp => ({ ...exp, _score: matchScore(exp) }))
        .filter(exp => canonicalTerms.includes(exp.name.toLowerCase()));

    let maxScore = 0;
    scoredResults.forEach(exp => { if (exp._score > maxScore) maxScore = exp._score; });

    let finalResults = [];
    if (maxScore > 0) {
        finalResults = scoredResults.filter(exp => exp._score === maxScore);
    }

    if (finalResults.length === 0) {
        let relaxedResults = [];
        let relaxedFilters = [...filters];
        while (relaxedResults.length === 0 && relaxedFilters.length > 0) {
            relaxedFilters.pop();
            relaxedResults = experiences.filter(exp => canonicalTerms.includes(exp.name.toLowerCase()));
            if (chatbotState.major && departmentAttributes[chatbotState.major]) {
                relaxedResults = relaxedResults.filter(exp =>
                    departmentAttributes[chatbotState.major].some(tag => exp.tags.includes(tag)) ||
                    exp.tags.includes(chatbotState.major.toLowerCase())
                );
            }
            if (relaxedFilters.length) {
                relaxedResults = relaxedResults.filter(exp =>
                    relaxedFilters.every(f => exp.tags.some(tag => tag.toLowerCase().includes(f.toLowerCase())))
                );
            }
        }
        if (relaxedResults.length > 0) {
            relaxedResults = relaxedResults.map(exp => ({ ...exp, _score: matchScore(exp) }));
            let relaxedMax = 0;
            relaxedResults.forEach(exp => { if (exp._score > relaxedMax) relaxedMax = exp._score; });
            relaxedResults = relaxedResults.filter(exp => exp._score === relaxedMax && relaxedMax > 0)
                .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));

            const intro = "Hmm. We weren't able to find an experience that matched all your filters, so we relaxed them a bit. Here are some options that might interest you, based on your major and/or remaining filters: ";
            const message = formatExperienceTermsMessage(relaxedResults, intro);
            addMessage(message, "bot", () => {
                attachClickHandlersToTerms(experiences);
                chatbotShowOffices();
            });
        } else {
            addMessage("No matches found, sorry. Try different filters?", "bot", () => {
                setOptions([
                    { label: "Try Different Filters", icon: "filter-line", onClick: () => {
                        filterTopicIndex = 0;
                        filterSelections = {};
                        chatbotAskFilterTopic(); // This is for student flow
                    }}
                ]);
            });
        }
        return;
    }

    finalResults.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
    
    // For student flow, showExperienceResultsList will handle the intro message
    showExperienceResultsList(finalResults);
}

// --- Add: Generic results function for faculty/community, using single message ---
function chatbotShowGenericResults(role, filters) {
    hideToolbar();
    chatbotState.filters = filters;
    showFilterTags();
    showOptionsDrawer();
    const msgArea = document.getElementById('chatbot-messages');
    if (msgArea) {
        msgArea.innerHTML = '';
        // Scroll to top immediately after clearing messages
        scrollMessagesToTop();
    }

    // Add advisor banner at the top
    showAdvisorBanner();

    const canonicalTerms = [
        "academic internship", "paid internship", "research", "fellowship",
        "service learning", "clinical placement", "practicum"
    ];

    let userTags = [];
    if (chatbotState.major && departmentAttributes[chatbotState.major]) {
        userTags = [...departmentAttributes[chatbotState.major]];
    }
    if (chatbotState.major) {
        userTags.push(chatbotState.major.toLowerCase());
    }
    userTags = userTags.concat(filters.map(f => f.toLowerCase()));

    function matchScore(exp) {
        let expTags = (exp.tags || []).map(t => t.toLowerCase());
        let score = userTags.reduce((s, tag) => expTags.includes(tag) ? s + 1 : s, 0);
        if (canonicalTerms.includes(exp.name.toLowerCase())) score += 2;
        return score;
    }

    let scoredResults = experiences.map(exp => ({ ...exp, _score: matchScore(exp) }))
        .filter(exp => canonicalTerms.includes(exp.name.toLowerCase()));

    let maxScore = 0;
    scoredResults.forEach(exp => { if (exp._score > maxScore) maxScore = exp._score; });

    let finalResults = [];
    if (maxScore > 0) {
        finalResults = scoredResults.filter(exp => exp._score === maxScore);
    }

    if (finalResults.length === 0) {
        let relaxedResults = [];
        let relaxedFilters = [...filters];
        while (relaxedResults.length === 0 && relaxedFilters.length > 0) {
            relaxedFilters.pop();
            // Re-filter based on remaining relaxedFilters and major
            relaxedResults = experiences.filter(exp => canonicalTerms.includes(exp.name.toLowerCase()));
             if (chatbotState.major && departmentAttributes[chatbotState.major]) {
                relaxedResults = relaxedResults.filter(exp =>
                    departmentAttributes[chatbotState.major].some(tag => exp.tags.includes(tag)) ||
                    exp.tags.includes(chatbotState.major.toLowerCase())
                );
            }
            if (relaxedFilters.length) {
                relaxedResults = relaxedResults.filter(exp =>
                    relaxedFilters.every(f => exp.tags.some(tag => tag.toLowerCase().includes(f.toLowerCase())))
                );
            }
        }

        if (relaxedResults.length > 0) {
            relaxedResults = relaxedResults.map(exp => ({ ...exp, _score: matchScore(exp) }));
            let relaxedMax = 0;
            relaxedResults.forEach(exp => { if (exp._score > relaxedMax) relaxedMax = exp._score; });
            relaxedResults = relaxedResults.filter(exp => exp._score === relaxedMax && relaxedMax > 0)
                .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
            
            const intro = "Hmm. We weren't able to find an experience that matched all your filters, so we relaxed them a bit. Here are some options that might interest you: ";
            const message = formatExperienceTermsMessage(relaxedResults, intro);
            addMessage(message, "bot", () => {
                attachClickHandlersToTerms(experiences);
                chatbotShowOffices();
            });
        } else {
            addMessage("No matches found, sorry. Try different filters?", "bot", () => {
                setOptions([
                    { label: "Try Different Filters", icon: "filter-line", onClick: () => {
                        filterTopicIndex = 0;
                        filterSelections = {};
                        chatbotAskGenericFilterTopic(role); // Use generic for faculty/community
                    }}
                ]);
            });
        }
        return;
    }

    finalResults.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));

    let introText = "";
    if (role === "faculty") {
        introText = "Based on your selections, you may want to offer or support ";
    } else if (role === "community") {
        introText = "Based on your selections, you may want to partner on or host ";
    } else { // Should not happen for generic flow, but as a fallback
        introText = "Based on your responses, you might be interested in ";
    }

    const message = formatExperienceTermsMessage(finalResults, introText);
    addMessage(message, "bot", () => {
        attachClickHandlersToTerms(experiences);
        // Scroll to top after the message is added
        setTimeout(() => scrollMessagesToTop(), 100);
        chatbotShowOffices();
    });
}


// --- Student flow continues as before ---
function chatbotAskMajor() {
    // This function is now deprecated. The logic is handled by setupMajorSearch.
    // Kept here to avoid breaking any potential legacy calls, but it does nothing.
}

function chatbotSetMajor(major) {
    chatbotState.major = major;
    queueMessage(major, "user", () => {
        filterTopicIndex = 0;
        filterSelections = {}; // Reset selections
        chatbotState.filters = []; // Reset filters
        showFilterTags();
        chatbotAskFilterTopic();
    });
}

// Define filter topics for student flow
const filterTopics = [
    {
        key: "compensation",
        label: "Are you looking for paid or unpaid opportunities?",
        explanation: "Knowing this lets us show you experiences that match your financial needs.",
        options: [
            { label: "Paid", icon: "money-dollar-circle-line", value: "paid" },
            { label: "Unpaid", icon: "close-circle-line", value: "unpaid" }
        ]
    },
    {
        key: "credit",
        label: "Are you interested in earning course credit?",
        explanation: "We'll show you options that could count toward your degree.",
        options: [
            { label: "For Credit", icon: "graduation-cap-line", value: "course credit" },
            { label: "Not for Credit", icon: "prohibited-line", value: "not for credit" }
        ]
    },
    {
        key: "location",
        label: "Where would you like your experience to take place?",
        explanation: "Your choice helps us suggest on-campus or off-campus options that work for you.",
        options: [
            { label: "On Campus", icon: "hotel-line", value: "on-campus" },
            { label: "Off Campus", icon: "road-map-line", value: "off-campus" }
        ]
    },
    {
        key: "timing",
        label: "When are you available?",
        explanation: "This helps us direct you towards opportunities available during your preferred time.",
        options: [
            { label: "Academic Year", icon: "calendar-event-line", value: "academic year" },
            { label: "Summer", icon: "sun-line", value: "summer" }
        ]
    },
];

// --- Add: Define filter topics for faculty/community (generic) flow ---
const genericFilterTopics = [
    {
        key: "type",
        label: "What type of experience do you want to offer or support?",
        options: [
            { label: "Internships", icon: "briefcase-line", value: "internship" },
            { label: "Research", icon: "flask-line", value: "research" },
            { label: "Service Learning", icon: "service-line", value: "service learning" }
        ]
    },
    {
        key: "compensation",
        label: "Will this opportunity be paid or unpaid?",
        options: [
            { label: "Paid", icon: "money-dollar-circle-line", value: "paid" },
            { label: "Unpaid", icon: "close-circle-line", value: "unpaid" }
        ]
    },
    {
        key: "location",
        label: "Where will the experience take place?",
        options: [
            { label: "On Campus", icon: "hotel-line", value: "on-campus" },
            { label: "Off Campus", icon: "road-map-line", value: "off-campus" }
        ]
    },
    {
        key: "timing",
        label: "When will the experience be available?",
        options: [
            { label: "Academic Year", icon: "calendar-event-line", value: "academic year" },
            { label: "Summer", icon: "sun-line", value: "summer" }
        ]
    },
    {
        key: "credit",
        label: "Will students earn course credit for this experience?",
        options: [
            { label: "Course Credit", icon: "graduation-cap-line", value: "course credit" }
        ]
    }
];

// Track filter state
let filterTopicIndex = 0;
let filterSelections = {};

// Main filter topic stepper
function chatbotAskFilterTopic() {
    // If all topics done, show final message and options
    if (filterTopicIndex >= filterTopics.length) {
        queueMessage("That's all we have to ask! Feel free to explore the options below.", "bot", () => {
            setOptions([
                { label: "Start Over", icon: "refresh-line", onClick: chatbotStart, width: "full" },
                { label: "Internship Hub", icon: "global-line", onClick: () => window.open("https://www.humboldt.edu/internships", "_blank") }
            ]);
        });
        return;
    }
    
    const topic = filterTopics[filterTopicIndex];
    
    queueMessage(topic.label, "bot", () => {
        if (topic.explanation) {
            queueMessage(topic.explanation, "bot", () => {
                renderFilterScreen(topic);
                hideLoadingOverlay(); // Hide overlay when the next screen is ready
            });
        } else {
            renderFilterScreen(topic);
            hideLoadingOverlay(); // Hide overlay when the next screen is ready
        }
    });
}

function renderFilterScreen(topic) {
    const optArea = document.getElementById('chatbot-options');
    optArea.innerHTML = '';

    // No persistent toolbar for this flow. Options will drive the actions.
    hideToolbar();

    const currentSelectionsForTopic = filterSelections[topic.key] || [];
    topic.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'chatbot-option-btn';
        if (currentSelectionsForTopic.includes(opt.value)) {
            btn.classList.add('selected');
        }
        // Icon (left)
        if (opt.icon) {
            const iconCircle = document.createElement('div');
            iconCircle.className = 'chatbot-btn-icon-circle';
            const icon = document.createElement('i');
            icon.className = `ri-${opt.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            iconCircle.appendChild(icon);
            btn.appendChild(iconCircle);
        }
        // Label (center)
        const labelSpan = document.createElement('span');
        labelSpan.className = 'chatbot-btn-label';
        labelSpan.textContent = opt.label;
        btn.appendChild(labelSpan);

        // Info icon (right, styled by your CSS)
        const infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.className = 'chatbot-info-btn';
        infoBtn.style.position = 'absolute';
        infoBtn.style.right = '1em';
        infoBtn.style.top = '50%';
        infoBtn.style.transform = 'translateY(-50%)';
        infoBtn.style.background = 'none';
        infoBtn.style.border = 'none';
        infoBtn.style.padding = '0';
        infoBtn.style.margin = '0';
        infoBtn.style.cursor = 'pointer';
        infoBtn.style.fontSize = '1.2em';
        infoBtn.style.color = '#888';
        infoBtn.setAttribute('tabindex', '0');
        infoBtn.setAttribute('aria-label', `More info about ${opt.label}`);
        infoBtn.innerHTML = '<i class="ri-information-line" style = "color: var(--ocean-deep);opacity: 50%;"></i>';
        infoBtn.onclick = (e) => {
            e.stopPropagation();
            const def = definitions[opt.value] || `Learn more about ${opt.label.toLowerCase()} opportunities by speaking with an advisor or visiting the relevant campus offices.`;
            showInfoModal(opt.label, def);
        };
        btn.style.position = 'relative';
        btn.appendChild(infoBtn);

        btn.onclick = () => {
            if (chatbotUILocked) return;
            lockChatbotUI();
            queueMessage(opt.label, "user", () => {
                // For the student exploratory flow, each question is independent.
                // We clear previous filters and only use the most recent selection.
                chatbotState.filters = [opt.value];
                showFilterTags();
                showFilteredOfficesAndContinue();
            });
        };

        btn.style.animationDelay = (0.08 * idx) + 's';
        optArea.appendChild(btn);
        void btn.offsetWidth;
        btn.style.opacity = '';
    });

    setTimeout(() => {
        optArea.scrollTop = 0;
        scrollMessagesToBottom();
    }, 0);
}

// --- New function to show offices based on current filters and then continue ---
function showFilteredOfficesAndContinue(showAll = false) {
    // For regular filter selections, clear history but preserve recent context
    // For "show all", keep the full conversation
    if (!showAll) {
        const msgArea = document.getElementById('chatbot-messages');
        if (msgArea) {
            // Keep only the last few messages for context
            const messages = msgArea.querySelectorAll('.chatbot-msg');
            if (messages.length > 3) {
                // Clear everything and add a clean context
                msgArea.innerHTML = '';
                
                // Add a clean context message
                const latestFilter = chatbotState.filters[chatbotState.filters.length - 1];
                const contextMsg = document.createElement('div');
                contextMsg.className = 'chatbot-msg user';
                const contextBubble = document.createElement('div');
                contextBubble.className = 'chatbot-bubble user';
                contextBubble.textContent = `I'm looking for ${latestFilter} opportunities.`;
                contextMsg.appendChild(contextBubble);
                msgArea.appendChild(contextMsg);
                
                scrollMessagesToBottom();
            }
        }
    }
    
    let userTags = [];
    if (chatbotState.major) userTags.push(chatbotState.major.toLowerCase());
    userTags = userTags.concat(chatbotState.filters);

    let filteredOffices;
    if (showAll) {
        filteredOffices = [...offices]; // Show all offices
    } else {
        // Find offices that have at least one of the user's tags
        filteredOffices = offices.filter(office => {
            const officeTags = (office.tags || []).map(t => t.toLowerCase());
            return userTags.some(userTag => officeTags.includes(userTag));
        });
    }

    // Sort offices by how many matching tags they have
    const sortedOffices = filteredOffices.sort((a, b) => {
        const aScore = getOfficeWeightedScore(a, userTags);
        const bScore = getOfficeWeightedScore(b, userTags);
        return bScore - aScore;
    });

    if (sortedOffices.length > 0) {
        // More natural messaging
        let message = "";
        if (showAll) {
            message = "Here are all the campus offices that can help with experiential learning.";
        } else {
            showAdvisorBanner();
            const filterName = chatbotState.filters[chatbotState.filters.length - 1]; // Get the latest filter
            if (filterName === "paid") {
                message = "Great! Here are some offices that can help you find paid opportunities.";
            } else if (filterName === "unpaid") {
                message = "Perfect! These offices can help you find meaningful unpaid experiences.";
            } else if (filterName === "course credit") {
                message = "Excellent! These offices specialize in credit-bearing experiences.";
            } else if (filterName === "not for credit") {
                message = "Wonderful! These offices can help you find experiences outside of coursework.";
            } else if (filterName === "on-campus") {
                message = "Here are offices that can connect you with on-campus opportunities.";
            } else if (filterName === "off-campus") {
                message = "These offices can help you find experiences beyond campus.";
            } else if (filterName === "academic year") {
                message = "Perfect! These offices can help with opportunities during the school year.";
            } else if (filterName === "summer") {
                message = "Great choice! These offices specialize in summer experiences.";
            } else {
                message = "Here are some offices that might be helpful.";
            }
        }
        
        queueMessage(message, "bot", () => {
            // Display all matching offices normally
            sortedOffices.forEach(office => {
                const matchedTags = (office.tags || []).filter(tag =>
                    userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
                );
                
                let contactSection = '';
                if (office.contactName || office.contactEmail || office.contactPhone) {
                    contactSection = `
                        <div class="chatbot-office-contact">
                            ${office.contactName ? `<div class="contact-name"><i class="ri-user-3-line"></i> ${office.contactName}</div>` : ""}
                            ${office.contactEmail ? `<div class="contact-email"><i class="ri-mail-line"></i> <a href="mailto:${office.contactEmail}">${office.contactEmail}</a></div>` : ""}
                            ${office.contactPhone ? `<div class="contact-phone"><i class="ri-phone-line"></i> <a href="tel:${office.contactPhone.replace(/[^0-9+]/g, '')}">${office.contactPhone}</a></div>` : ""}
                        </div>
                    `;
                }
                
                let locationSection = '';
                if (office.locationEmbed) {
                    locationSection = `
                        <div class="chatbot-office-location">
                            <iframe src="${office.locationEmbed}" width="100%" height="120" style="border:0;border-radius:10px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                        </div>
                    `;
                }

                // Display each office card
                let officeCard = `
                    <div class="chatbot-office-card-flex">
                        ${office.image ? `<div class="chatbot-office-image-wrap"><img src="${office.image}" alt="${office.name}" class="chatbot-office-image"></div>` : ""}
                        <div class="chatbot-office-main">
                            <div class="chatbot-office-header">
                                <h2 class="chatbot-office-title">${office.name}</h2>
                            </div>
                            <div class="chatbot-office-body">
                                <p>${summarizeInfo(office.description || office.info)}</p>
                                ${office.link ? `<button class="chatbot-option-btn" style="margin-bottom:0rem;" onclick="window.open('${office.link}', '_blank')">Website<i class="ri-external-link-fill" style="position: absolute;right: 1rem;font-size:1.2rem;"></i></button>` : ""}
                                ${contactSection}
                                ${locationSection}
                                ${matchedTags.length > 0 ? `
                                    <div class="chatbot-office-tags">
                                        ${matchedTags.map(tag => `<span class="chatbot-office-tag">${tag}</span>`).join('')}
                                    </div>
                                ` : ""}
                            </div>
                        </div>
                    </div>
                `;
                addMessage(officeCard, "bot");
            });
            
            // Add relevant experience type links based on current filters
            showRelevantExperienceLinks();
            
            // After showing offices, ask to continue
            promptToContinue();
        });
    } else {
        queueMessage("Hmm, I don't have specific offices for that combination, but let's keep going to see what else we can find!", "bot", () => {
            promptToContinue();
        });
    }
}

// --- New function to show relevant experience type links ---
function showRelevantExperienceLinks() {
    // Only use the latest filter selection for experience links
    const userTags = [];
    if (chatbotState.major) userTags.push(chatbotState.major.toLowerCase());
    
    const latestFilter = chatbotState.filters[chatbotState.filters.length - 1];
    if (latestFilter) userTags.push(latestFilter);
    
    // Find relevant experiences based on current filter
    const relevantExperiences = experiences.filter(exp => {
        const expTags = (exp.tags || []).map(t => t.toLowerCase());
        return userTags.some(userTag => expTags.includes(userTag));
    });
    
    if (relevantExperiences.length > 0) {
        // Sort by relevance (most matching tags first)
        const sortedExperiences = relevantExperiences.sort((a, b) => {
            const aMatches = (a.tags || []).filter(tag => 
                userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
            ).length;
            const bMatches = (b.tags || []).filter(tag => 
                userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
            ).length;
            return bMatches - aMatches;
        });
        
        // Take top 2-3 most relevant experiences
        const topExperiences = sortedExperiences.slice(0, 3);
        
        if (topExperiences.length > 0) {
            const icons = ['ri-briefcase-line', 'ri-flask-line', 'ri-graduation-cap-line', 'ri-award-line', 'ri-service-line'];
            
            const experienceHtml = `
                <div class="experience-message-combined">
                    <p>For more information, check out the following pages:</p>
                    <hr class="experience-divider">
                    <div class="experience-links-clean">
                        ${topExperiences.map((exp, index) => {
                            const icon = topExperiences.length === 1 ? 'ri-bookmark-line' : icons[index % icons.length];
                            return `
                                <a href="${exp.websiteLocation}" target="_blank" class="experience-link-clean">
                                    <i class="${icon}"></i>
                                    <span>${exp.buttonLabel || exp.name}</span>
                                    <i class="ri-external-link-line"></i>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            addMessage(experienceHtml, "bot");
        }
    }
}

// --- New function to prompt user to continue to next question ---
function promptToContinue() {
    filterTopicIndex++; // Move to the next topic
    
    // Check if there are more questions
    if (filterTopicIndex < filterTopics.length) {
        const nextTopic = filterTopics[filterTopicIndex];
        let nextMessage = "";
        
        if (nextTopic.key === "credit") {
            nextMessage = "Let's talk about course credit next.";
        } else if (nextTopic.key === "location") {
            nextMessage = "Now, let's think about location.";
        } else if (nextTopic.key === "timing") {
            nextMessage = "Finally, let's consider timing.";
        } else {
            nextMessage = "Let's continue with the next question.";
        }
        
        queueMessage(nextMessage, "bot", () => {
            setOptions([
                { 
                    label: "Continue", 
                    icon: "arrow-right-line", 
                    onClick: () => {
                        const msgArea = document.getElementById('chatbot-messages');
                        if (msgArea) msgArea.innerHTML = '';
                        chatbotAskFilterTopic();
                        hideAdvisorBanner();
                    }, 
                    width: "full" 
                },
                { label: "Start Over", icon: "refresh-line", onClick: chatbotStart }
            ]);
        });
    } else {
        // End of the flow
        queueMessage("That's all the questions! You now have a better sense of what's available on campus.", "bot", () => {
            setOptions([
                { label: "Start Over", icon: "refresh-line", onClick: chatbotStart, width: "full" },
                { label: "Internship Hub", icon: "external-link-line", onClick: () => window.open("https://www.humboldt.edu/internships", "_blank") }
            ]);
        });


                    // Add feedback as a message after setting the options
            setTimeout(() => {
                queueMessage(
                    `<button class="chatbot-option-btn feedback-button" onclick="window.open('https://forms.gle/y3fC1q7sthgipkaFA', '_blank')">
                        Submit feedback <i class="ri-external-link-line" style="margin-left:0.5em;font-size:1em;"></i>
                    </button>`,
                    "bot"
                );
            }, 200);

    }
    unlockChatbotUI();
}

// --- Tag Weights: Make any tag more important by increasing its value here ---
// Example: 'service learning': 5 means matches on this tag count 5x more than normal
const TAG_WEIGHTS = {
    'internship': 3,      // Example: internships are more important
    'paid': 3,          // Paid opportunities are more important
    'on-campus': 2,
    'academic year': 2,
    // Add more tags and weights as needed
};

// Helper: Get tag weight (default 1)
function getTagWeight(tag) {
    return TAG_WEIGHTS[tag.toLowerCase()] || 1;
}

// Helper: Calculate weighted tag match score for an office
function getOfficeWeightedScore(office, userTags) {
    let score = 0;
    (office.tags || []).forEach(tag => {
        userTags.forEach(userTag => {
            if (tag.toLowerCase() === userTag.toLowerCase()) {
                score += getTagWeight(tag);
            }
        });
    });
    return score;
}



// --- Update chatbotShowOffices to use weighted scores and new narrative flow ---
function chatbotShowOffices() {
    hideToolbar();
    showOptionsDrawer();
    
    let userTags = [];
    if (chatbotState.major) userTags.push(chatbotState.major);
    userTags = userTags.concat(Object.values(filterSelections).flat());

    // Sort offices by weighted score (descending)
    const sortedList = [...offices].sort((a, b) => {
        const aScore = getOfficeWeightedScore(a, userTags);
        const bScore = getOfficeWeightedScore(b, userTags);
        return bScore - aScore;
    });

    // Split into "good matches" (score >= 2) and "low matches" (score < 2)
    const goodMatches = sortedList.filter(office => getOfficeWeightedScore(office, userTags) >= 2);
    const lowMatches = sortedList.filter(office => getOfficeWeightedScore(office, userTags) < 2);

    // Helper to show final options including feedback
    function showFinalOptions() {
        setTimeout(() => {
            setOptions([
                { label: "Search Again", icon: "search-line", width: "full", onClick: () => {
                    chatbotStart();
                }},
                { label: "Internship Hub", icon: "external-link-line", width: "full", onClick: () => {
                    window.open("https://humboldt.edu/internships", "_blank");
                }}
            ]);
            // Add feedback as a message after setting the options
            setTimeout(() => {
                queueMessage(
                    `<button class="chatbot-option-btn feedback-button" onclick="window.open('https://forms.gle/y3fC1q7sthgipkaFA', '_blank')">
                        Submit feedback <i class="ri-external-link-line" style="margin-left:0.5em;font-size:1em;"></i>
                    </button>`,
                    "bot"
                );
            }, 200);
        }, 100);
    }

    // Show the best group(s) with the new narrative flow
    if (goodMatches.length > 0) {
        showOfficesResultsList(goodMatches, 0, userTags, () => {
            if (lowMatches.length > 0) {
                // The intro for low matches is now handled inside the next call
                showOfficesResultsList(lowMatches, 0, userTags, showFinalOptions);
            } else {
                showFinalOptions();
            }
        });
    } else if (lowMatches.length > 0) {
        showOfficesResultsList(lowMatches, 0, userTags, showFinalOptions);
    } else {
        addMessage("No campus resources matched your selections. Try different filters?", "bot", showFinalOptions);
    }
}

function showOfficesResultsList(list, startIdx, userTags, onDone) {
    // Sort offices by weighted score (descending)
    const sortedList = [...list].sort((a, b) => {
        const aScore = getOfficeWeightedScore(a, userTags);
        const bScore = getOfficeWeightedScore(b, userTags);
        return bScore - aScore;
    });

    const PAGE_SIZE = 2;
    const endIdx = Math.min(startIdx + PAGE_SIZE, sortedList.length);
    const officesToShow = sortedList.slice(startIdx, endIdx);

    // Generate and queue the introductory message for the current batch of offices
    const introMessage = formatOfficeNamesMessage(officesToShow);
    queueMessage(introMessage, "bot", () => {
        // Display the office cards after the intro message
        officesToShow.forEach(office => {
            const matchedTags = (office.tags || []).filter(tag =>
                userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
            );
            let contactSection = '';
            if (office.contactName || office.contactEmail || office.contactPhone) {
                contactSection = `
                    <div class="chatbot-office-contact">
                        ${office.contactName ? `<div class="contact-name"><i class="ri-user-3-line"></i> ${office.contactName}</div>` : ""}
                        ${office.contactEmail ? `<div class="contact-email"><i class="ri-mail-line"></i> <a href="mailto:${office.contactEmail}">${office.contactEmail}</a></div>` : ""}
                        ${office.contactPhone ? `<div class="contact-phone"><i class="ri-phone-line"></i> <a href="tel:${office.contactPhone.replace(/[^0-9+]/g, '')}">${office.contactPhone}</a></div>` : ""}
                    </div>
                `;
            }
            let locationSection = '';
            if (office.locationEmbed) {
                locationSection = `
                    <div class="chatbot-office-location">
                        <iframe src="${office.locationEmbed}" width="100%" height="120" style="border:0;border-radius:10px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                    </div>
                `;
            }

            let msg = `
                <div class="chatbot-office-card-flex">
                    ${office.image ? `<div class="chatbot-office-image-wrap"><img src="${office.image}" alt="${office.name}" class="chatbot-office-image"></div>` : ""}
                    <div class="chatbot-office-main">
                        <div class="chatbot-office-header">
                            <h2 class="chatbot-office-title">${office.name}</h2>
                        </div>
                        <div class="chatbot-office-body">
                            <p>${summarizeInfo(office.description || office.info)}</p>
                            ${office.link ? `<button class="chatbot-option-btn" style = "margin-bottom:0rem;" onclick="window.open('${office.link}', '_blank')">Website<i class="ri-external-link-fill" style="position: absolute;right: 1rem;font-size:1.2rem;"></i></button>` : ""}
                            ${contactSection}
                            ${locationSection}
                            ${matchedTags.length > 0 ? `
                                <div class="chatbot-office-tags">
                                    ${matchedTags.map(tag => `<span class="chatbot-office-tag">${tag}</span>`).join('')}
                                </div>
                            ` : ""}
                        </div>
                    </div>
                </div>
            `;
            addMessage(msg, "bot");
        });

        // Set up the next action (Show More or finish)
        if (endIdx < sortedList.length) {
            setOptions([
                {
                    label: "Show More",
                    icon: "arrow-down-line",
                    onClick: () => {
                        // Add a small delay to ensure smooth transition
                        setTimeout(() => {
                            showOfficesResultsList(sortedList, endIdx, userTags, onDone);
                        }, 50);
                    }
                }
            ]);
            unlockChatbotUI();
        } else {
            // Final step - unlock UI and call onDone (which will set the final options)
            unlockChatbotUI();
            if (typeof onDone === "function") {
                onDone();
            }
        }
    });
}

// --- Helper function to format office names into a single message string ---
function formatOfficeNamesMessage(officesToShow) {
    if (!officesToShow || officesToShow.length === 0) {
        return "Here are some campus resources you may find helpful."; // Fallback
    }

    const officeNames = officesToShow.map(office => `<b2>${office.name}</b2>`);

    let officesPortion;
    if (officeNames.length === 1) {
        officesPortion = officeNames[0];
    } else if (officeNames.length === 2) {
        officesPortion = `${officeNames[0]} or ${officeNames[1]}`;
    } else { // More than 2 (should not happen with page size of 2, but good to have)
        const allButLast = officeNames.slice(0, -1).join(", ");
        const last = officeNames[officeNames.length - 1];
        officesPortion = `${allButLast}, or ${last}`;
    }
    return `You may find the ${officesPortion} helpful.`;
}

// Utility: summarize description to 2 sentences max
function summarizeInfo(info) {
    if (!info) return "";
    // Prevent splitting after single-letter abbreviations like Y.E.S.
    // Replace periods between single letters with nothing temporarily
    let safeInfo = info.replace(/\b([A-Z])\.\s?/g, '$1');
    const sentences = safeInfo.match(/[^.!?]+[.!?]+/g);
    if (!sentences) return info;
    return sentences.slice(0, 2).join(' ').trim();
}

// Animate in the options drawer
function showOptionsDrawer() {
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    if (optionsDrawer) {
        optionsDrawer.classList.add('visible');
    }
}

// Animate out the options drawer
function hideOptionsDrawer() {
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    if (optionsDrawer) {
        optionsDrawer.classList.remove('visible');
    }
}

// Add a loading overlay inside the options container if not present
// --- Loading overlay with blur and spinner, but only blur the content, not the overlay itself ---
function ensureLoadingOverlay() {
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    if (!optionsDrawer) return;
    if (!document.getElementById('chatbot-loading-overlay')) {
        // Create overlay container
        const overlayContainer = document.createElement('div');
        overlayContainer.id = 'chatbot-loading-overlay';
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = '0';
        overlayContainer.style.left = '0';
        overlayContainer.style.width = '100%';
        overlayContainer.style.height = '100%';
        overlayContainer.style.display = 'none';
        overlayContainer.style.zIndex = '1000';
        overlayContainer.style.pointerEvents = 'all';
        overlayContainer.style.borderRadius = '0 0 1rem 1rem';
        overlayContainer.style.overflow = 'hidden';
        overlayContainer.style.opacity = '0';
        overlayContainer.style.transition = 'opacity 0.25s cubic-bezier(.4,0,.2,1)';

        // Spinner layer (on top, NOT blurred)
        const spinnerLayer = document.createElement('div');
        spinnerLayer.style.position = 'absolute';
        spinnerLayer.style.top = '0';
        spinnerLayer.style.left = '0';
        spinnerLayer.style.width = '100%';
        spinnerLayer.style.height = '100%';
        spinnerLayer.style.display = 'flex';
        spinnerLayer.style.justifyContent = 'center';
        spinnerLayer.style.alignItems = 'center';
        spinnerLayer.style.zIndex = '1002';
        spinnerLayer.style.background = 'rgba(255,255,255,0.1)';
        spinnerLayer.innerHTML = `
            <div class="chatbot-loading-spinner-wrap" style="font-size:3rem;color:#00695c;display:flex;align-items:center;gap:0.7em;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
                <span class="ri-loader-4-line chatbot-loading-spinner" style="opacity:0;transform:scale(0.85);animation:spin 1s linear infinite;"></span>
            </div>
        `;

        overlayContainer.appendChild(spinnerLayer);

        optionsDrawer.style.position = 'relative';
        optionsDrawer.appendChild(overlayContainer);

        // Add CSS for spinner animation and blur effect if not present
        if (!document.getElementById('loading-overlay-styles')) {
            const styles = document.createElement('style');
            styles.id = 'loading-overlay-styles';
            styles.textContent = `
                @keyframes spin { 
                    0% { transform: rotate(0deg); } 
                    100% { transform: rotate(360deg); } 
                }
                #chatbot-options-drawer.loading-blur > *:not(#chatbot-loading-overlay) {
                    filter: blur(15px) !important;
                    -webkit-filter: blur(15px) !important;
                    pointer-events: none !important;
                    user-select: none !important;
                }
                .chatbot-loading-spinner {
                    transition: opacity 0.25s cubic-bezier(.4,0,.2,1), transform 0.25s cubic-bezier(.4,0,.2,1);
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

function showLoadingOverlay() {
    ensureLoadingOverlay();
    const overlay = document.getElementById('chatbot-loading-overlay');
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    if (overlay && optionsDrawer) {
        overlay.style.display = 'block';
        // Add blur class to options drawer
        optionsDrawer.classList.add('loading-blur');
        // Fade in overlay
        setTimeout(() => {
            overlay.style.opacity = '1';
            // Animate spinner in
            const spinner = overlay.querySelector('.chatbot-loading-spinner');
            if (spinner) {
                spinner.style.opacity = '1';
                spinner.style.transform = 'scale(1)';
            }
        }, 10);
    }
}
function hideLoadingOverlay() {
    const overlay = document.getElementById('chatbot-loading-overlay');
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    if (overlay && optionsDrawer) {
        // Animate spinner out
        const spinner = overlay.querySelector('.chatbot-loading-spinner');
        if (spinner) {
            spinner.style.opacity = '0';
            spinner.style.transform = 'scale(0.85)';
        }
        // Fade out overlay after spinner animation
        overlay.style.opacity = '0';
        // Remove blur class after fade out and then hide overlay
        setTimeout(() => {
            overlay.style.display = 'none';
            optionsDrawer.classList.remove('loading-blur');
        }, 250); // Wait for the opacity transition to finish
    }
}

// Start chatbot on page load
window.onload = function() {
    // Always reload the page to ensure the most recent version is loaded
    if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_BACK_FORWARD) {
        window.location.reload(true);
        return;
    }
    chatbotStart();
};

// Minimal modal logic
function showInfoModal(title, body) {
    let modal = document.getElementById('chatbot-info-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chatbot-info-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.35)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div>
                <button type="button" class="chatbot-info-modal-close" aria-label="Close" style="position:absolute;top:1em;right:1em;background:none;border:none;color:var(--ocean-main);font-size:1.7em;cursor:pointer;padding:0.1em 0.2em;z-index:2;border-radius:50%;transition:background 0.2s;width:2em;height:2em;display:flex;align-items:center;justify-content:center;">
                    <i class="ri-close-line"></i>
                </button>
                <div id="chatbot-info-modal-title" style="font-weight:600;font-size:1.15em;margin-bottom:-0.25em;"></div>
                <hr style="margin:1em 0;">
                <div id="chatbot-info-modal-body"></div>
                <button onclick="document.getElementById('chatbot-info-modal').style.display='none';" >Okay</button>
            </div>
        `;
        document.body.appendChild(modal);
        // Add close logic for the close button
        modal.querySelector('.chatbot-info-modal-close').onclick = () => { modal.style.display = 'none'; };
        // Click outside modal closes it
        modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    }
    modal.querySelector('#chatbot-info-modal-title').textContent = title;
    modal.querySelector('#chatbot-info-modal-body').textContent = body;
    modal.style.display = 'flex';
}

// --- Lock/unlock UI during message queue processing ---
let chatbotUILocked = false;

function lockChatbotUI() {
    chatbotUILocked = true;
    // Disable all option buttons
    const optArea = document.getElementById('chatbot-options');
    if (optArea) {
        Array.from(optArea.querySelectorAll('button')).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('chatbot-btn-locked');
        });
    }
    // Disable toolbar buttons
    const toolbar = document.getElementById('chatbot-toolbar');
    if (toolbar) {
        Array.from(toolbar.querySelectorAll('button')).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('chatbot-btn-locked');
        });
    }
}

function unlockChatbotUI() {
    chatbotUILocked = false;
    // Enable all option buttons
    const optArea = document.getElementById('chatbot-options');
    if (optArea) {
        Array.from(optArea.querySelectorAll('button')).forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('chatbot-btn-locked');
        });
    }
    // Enable toolbar buttons
    const toolbar = document.getElementById('chatbot-toolbar');
    if (toolbar) {
        Array.from(toolbar.querySelectorAll('button')).forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('chatbot-btn-locked');
        });
    }
}

// --- Modify showExperienceResultsList to use new helpers and remove pagination logic for terms ---
function showExperienceResultsList(list) {
    const tagArea = document.getElementById('chatbot-filter-tags');
    if (tagArea) tagArea.style.display = "none";
    showOptionsDrawer();
    if (!list || list.length === 0) {
        chatbotShowOffices();
        return;
    }
    const intro = "Based on your responses, you might be interested in ";
    const message = formatExperienceTermsMessage(list, intro);
    addMessage(message, "bot", () => {
        attachClickHandlersToTerms(experiences);
        // Scroll to top after the message is added
        setTimeout(() => scrollMessagesToTop(), 100);
        chatbotShowOffices();
    });
}