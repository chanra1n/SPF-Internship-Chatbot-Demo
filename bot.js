// --- DATA LOADING FROM JSON FILE ---

let experiences = [];
let offices = [];
let majors = [];
let departmentAttributes = {};
let definitions = {}; // <-- Add this

// Load data from experienceData.json (async)
async function loadExperienceData() {
    try {
        const res = await fetch('experienceData.json');
        const data = await res.json();
        experiences = data.experiences || [];
        offices = data.offices || [];
        majors = data.majors || [];
        departmentAttributes = data.departmentAttributes || {};
        definitions = data.definitions || {}; // <-- Load definitions
    } catch (e) {
        console.error("Failed to load experience data:", e);
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
    if (chatbotState.major) {
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
const MESSAGE_DELAY = 750; // ms between bubbles

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
                    setTimeout(typeChar, text.length > 60 ? 8 : 18);
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
                setTimeout(typeChar, text.length > 60 ? 8 : 18);
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

// Helper to set options
function setOptions(options) {
    const optArea = document.getElementById('chatbot-options');
    optArea.innerHTML = '';
    // Group options into columns if there are many
    const colCount = options.length > 6 ? 2 : 1;
    if (colCount === 1) {
        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'chatbot-option-btn';
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
                // Only lock UI if the option is NOT a "Show More" or similar "load more" button
                if (chatbotUILocked) return;
                // Detect "Show More" or similar by label or a property
                const isShowMore = typeof opt.label === "string" && (
                    opt.label.toLowerCase().includes("show more") ||
                    opt.label.toLowerCase().includes("load more")
                );
                if (!isShowMore) lockChatbotUI();
                opt.onClick();
            };
            btn.style.animationDelay = (0.08 * idx) + 's';
            optArea.appendChild(btn);
            void btn.offsetWidth;
            btn.style.opacity = '';
        });
    } else {
        // Use a flex row with two columns for many options
        const colWrap = document.createElement('div');
        colWrap.style.display = "flex";
        colWrap.style.width = "100%";
        colWrap.style.gap = "0.5em";
        colWrap.style.justifyContent = "center";
        const col1 = document.createElement('div');
        const col2 = document.createElement('div');
        col1.style.flex = col2.style.flex = "1 1 0";
        col1.style.display = col2.style.display = "flex";
        col1.style.flexDirection = col2.style.flexDirection = "column";
        col1.style.gap = col2.style.gap = "0em";
        col1.style.marginBottom = col2.style.marginBottom = "-0.5em";
        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'chatbot-option-btn';
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
            btn.style.animationDelay = (0.08 * idx) + 's';
            void btn.offsetWidth;
            btn.style.opacity = '';
            (idx % 2 === 0 ? col1 : col2).appendChild(btn);
        });
        colWrap.appendChild(col1);
        colWrap.appendChild(col2);
        optArea.appendChild(colWrap);
    }
    // After rendering, always scroll options to top and messages to bottom
    setTimeout(scrollOptionsToTop, 0);
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
    chatbotState = { mode: "student", step: 0, filters: [], major: null };
    filterAttempts = 0;
    filterTopicIndex = 0;
    filterSelections = {};
    document.getElementById('chatbot-messages').innerHTML = '';
    showFilterTags();
    hideToolbar();
    queueMessage("Opportunity awaits! To begin, let's get to know you a bit.", "bot", () => {
        setOptions([
            { label: "I'm a Student", icon: "user-line", onClick: () => chatbotChooseMode("student") }
            //{ label: "I'm Faculty/Staff", icon: "graduation-cap-line", onClick: () => chatbotChooseMode("faculty") },
            //{ label: "I'm a Community Partner", icon: "team-line", onClick: () => chatbotChooseMode("community") }
        ]);
    });
}

function chatbotChooseMode(mode) {
    chatbotState.mode = mode;
    queueMessage(
        mode === "student"
            ? "Student"
            : mode === "faculty"
            ? "Faculty/Staff"
            : "Community Partner",
        "user"
    );
    if (mode !== "student") {
        queueMessage("Student mode is the main focus for this demo. Please select 'I'm a Student' to continue.", "bot", () => {
            setOptions([{ label: "Back", icon: "arrow-left-line", onClick: chatbotStart }]);
        });
        return;
    }
    chatbotAskMajor();
}

function chatbotAskMajor() {
    hideToolbar();
    queueMessage("Alright. What's your major?", "bot", () => {
        setOptions(
            majors.map(m => ({
                label: m,
                onClick: () => chatbotSetMajor(m)
            }))
        );
    });
}

function chatbotSetMajor(major) {
    chatbotState.major = major;
    queueMessage(major, "user", () => {
        filterTopicIndex = 0;
        filterSelections = {};
        chatbotState.filters = [];
        showFilterTags();
        chatbotAskFilterTopic();
    });
}

// Define filter topics (grouped logically) for multi-step selection
const filterTopics = [
    {
        key: "type",
        label: "What type of experience are you looking for?",
        options: [
            { label: "Internships", icon: "briefcase-line", value: "internship" },
            { label: "Research", icon: "flask-line", value: "research" },
            { label: "Service Learning", icon: "service-line", value: "service learning" },
            { label: "Job Shadowing", icon: "eye-line", value: "shadowing" }
        ]
    },
    {
        key: "compensation",
        label: "Do you prefer paid or unpaid opportunities?",
        options: [
            { label: "Paid", icon: "money-dollar-circle-line", value: "paid" },
            { label: "Unpaid", icon: "close-circle-line", value: "not paid" }
        ]
    },
    {
        key: "location",
        label: "Where would you prefer your experience take place?",
        options: [
            { label: "On Campus", icon: "hotel-line", value: "on-campus" },
            { label: "Off Campus", icon: "road-map-line", value: "off-campus" }
        ]
    },
    {
        key: "timing",
        label: "When are you available?",
        options: [
            { label: "Academic Year", icon: "calendar-event-line", value: "academic year" },
            { label: "Summer", icon: "sun-line", value: "summer" }
        ]
    },
    {
        key: "credit",
        label: "Are you interested in potentially earning course credit?",
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
    // If all topics done, show results
    if (filterTopicIndex >= filterTopics.length) {
        chatbotState.filters = Object.values(filterSelections).flat();
        // Ensure filterSelections is up-to-date for showFilterTags in chatbotShowResults
        showFilterTags(); // Update tags based on final selections before showing results
        chatbotShowResults(chatbotState.filters);
        return;
    }
    
    const topic = filterTopics[filterTopicIndex];
    
    queueMessage(topic.label, "bot", () => {
        renderFilterScreen(topic);
    });
}

function renderFilterScreen(topic) {
    const optArea = document.getElementById('chatbot-options');
    optArea.innerHTML = '';

    showToolbar();
    updatePersistentToolbar(topic);

    const currentSelectionsForTopic = filterSelections[topic.key] || [];
    topic.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'chatbot-option-btn';
        if (currentSelectionsForTopic.includes(opt.value)) btn.classList.add('selected');
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

    // Only show toolbar during filter selection steps
    const shouldShow =
        typeof filterTopicIndex === 'number' &&
        filterTopicIndex >= 0 &&
        filterTopicIndex < filterTopics.length;

    if (shouldShow) {
        toolbar.classList.add('show');
    } else {
        toolbar.classList.remove('show');
    }

    if (!shouldShow) return;

    const btnBack = document.getElementById('chatbot-toolbar-back');
    const btnNext = document.getElementById('chatbot-toolbar-next');

    const showBack = filterTopicIndex > 0;
    const showNext = filterTopicIndex < filterTopics.length - 1;

    btnBack.style.display = showBack ? '' : 'none';
    btnNext.style.display = showNext ? '' : 'none';

    // Remove any previous text label and icons
    btnBack.innerHTML = '';
    btnNext.innerHTML = '';

    // --- Dynamic Next/Skip label logic ---
    const selections = filterSelections[topic.key] || [];
    const nextLabel = selections.length === 0 ? 'Skip' : 'Next';

    // Helper to create label+icon span (arrow after or before text)
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

    // Always add the content, but set up the click handlers after
    if (showBack && !showNext) {
        btnBack.appendChild(makeBtnContent('Back', 'arrow-left-line', false)); // ARROW TEXT
    } else if (!showBack && showNext) {
        btnNext.appendChild(makeBtnContent(nextLabel, 'arrow-right-line', true)); // TEXT ARROW
    } else if (showNext) {
        btnBack.appendChild(makeBtnContent('Back', 'arrow-left-line', false)); // ARROW TEXT
        btnNext.appendChild(makeBtnContent(nextLabel, 'arrow-right-line', true)); // TEXT ARROW
    }

    // Remove previous click handlers to avoid stacking
    btnBack.onclick = null;
    btnNext.onclick = null;

    btnBack.onclick = () => {
        if (chatbotUILocked) return;
        lockChatbotUI();
        showLoadingOverlay();
        setTimeout(() => {
            const msgArea = document.getElementById('chatbot-messages');
            if (msgArea) {
                filterTopicIndex--;
                const prevTopic = filterTopics[filterTopicIndex];
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
                // Always delay between user and bot bubbles
                queueMessage(prevTopic.label, "bot", () => {
                    renderFilterScreen(prevTopic);
                    hideLoadingOverlay();
                });
            } else {
                hideLoadingOverlay();
            }
        }, 500);
    };

    btnNext.onclick = () => {
        if (chatbotUILocked) return;
        lockChatbotUI();
        showLoadingOverlay();
        setTimeout(() => {
            const topic = filterTopics[filterTopicIndex];
            const selections = filterSelections[topic.key] || [];
            const userMsgs = selections.map(sel => {
                const opt = topic.options.find(o => o.value === sel);
                return opt ? opt.label : sel;
            });
            const nextBotLabel = filterTopics[filterTopicIndex + 1]?.label;
            queueUserAndBotMessages(
                userMsgs,
                nextBotLabel,
                () => {
                    filterTopicIndex++;
                    renderFilterScreen(filterTopics[filterTopicIndex]);
                    hideLoadingOverlay();
                }
            );
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
                        const topic = filterTopics[filterTopicIndex];
                        const selections = filterSelections[topic.key] || [];
                        const userMsgs = selections.map(sel => {
                            const opt = topic.options.find(o => o.value === sel);
                            return opt ? opt.label : sel;
                        });
                        const nextBotLabel = filterTopics[filterTopicIndex + 1]?.label;
                        queueUserAndBotMessages(
                            userMsgs,
                            nextBotLabel,
                            () => {
                                filterTopicIndex++;
                                renderFilterScreen(filterTopics[filterTopicIndex]);
                                hideLoadingOverlay();
                            }
                        );
                    }, 500);
                };
            }, 10);
        };
        optArea.addEventListener('click', btnNext._labelUpdater);
    }

    const btnResults = document.getElementById('chatbot-toolbar-results');
    btnResults.style.display = filterTopicIndex === filterTopics.length - 1 ? '' : 'none';
    btnResults.onclick = () => {
        chatbotState.filters = Object.values(filterSelections).flat();
        chatbotShowResults(chatbotState.filters);
    };

    // Add or remove the rainbow fill class for the "show results" button
    if (filterTopicIndex === filterTopics.length - 1) {
        btnResults.classList.add('rainbow-border');
    } else {
        btnResults.classList.remove('rainbow-border');
    }

    // Hide the restart button on the last step (when results button is shown)
    const btnStartOver = document.getElementById('chatbot-toolbar-startover');
    btnStartOver.style.display = filterTopicIndex === filterTopics.length - 1 ? 'none' : '';
    btnStartOver.onclick = () => {
        if (chatbotUILocked) return;
        lockChatbotUI();
        chatbotStart();
    };
}

function chatbotShowResults(filters) {
    hideToolbar();
    chatbotState.filters = filters;
    showFilterTags();

    // --- Clear all previous messages before showing results ---
    const msgArea = document.getElementById('chatbot-messages');
    if (msgArea) {
        msgArea.innerHTML = '';
    }

    // Canonical result terms for matching
    const canonicalTerms = [
        "academic internship",
        "paid internship",
        "research",
        "fellowship",
        "service learning",
        "clinical placement",
        "practicum"
    ];

    // Gather all user tags (major + filters)
    let userTags = [];
    if (chatbotState.major && departmentAttributes[chatbotState.major]) {
        userTags = [...departmentAttributes[chatbotState.major]];
    }
    if (chatbotState.major) {
        userTags.push(chatbotState.major.toLowerCase());
    }
    userTags = userTags.concat(filters.map(f => f.toLowerCase()));

    // --- Compute match score for each experience, prioritize canonical terms ---
    function matchScore(exp) {
        let expTags = (exp.tags || []).map(t => t.toLowerCase());
        let score = userTags.reduce((score, tag) => expTags.includes(tag) ? score + 1 : score, 0);
        // Boost score if experience is a canonical term and matches a filter
        if (canonicalTerms.includes(exp.name.toLowerCase())) {
            score += 2;
        }
        return score;
    }

    // Attach score to each experience
    let scoredResults = experiences.map(exp => ({ ...exp, _score: matchScore(exp) }));

    // Only show canonical result terms (filter out non-canonical if any)
    scoredResults = scoredResults.filter(exp => canonicalTerms.includes(exp.name.toLowerCase()));

    // Find the highest score
    let maxScore = 0;
    scoredResults.forEach(exp => { if (exp._score > maxScore) maxScore = exp._score; });

    // Only include results with the highest score (and at least 1 match)
    let finalResults = [];
    if (maxScore > 0) {
        finalResults = scoredResults.filter(exp => exp._score === maxScore);
    }

    // If nothing matched at all, fallback to previous relaxation logic
    if (finalResults.length === 0) {
        // Try relaxing filters one by one (from last to first)
        let relaxedResults = [];
        let relaxedFilters = [...filters];
        let removed = [];
        while (relaxedResults.length === 0 && relaxedFilters.length > 0) {
            removed.unshift(relaxedFilters.pop());
            relaxedResults = experiences.filter(exp => canonicalTerms.includes(exp.name.toLowerCase()));
            if (chatbotState.major && departmentAttributes[chatbotState.major]) {
                relaxedResults = relaxedResults.filter(exp =>
                    departmentAttributes[chatbotState.major].some(tag =>
                        exp.tags.includes(tag)
                    ) || exp.tags.includes(chatbotState.major.toLowerCase())
                );
            }
            if (relaxedFilters.length) {
                relaxedResults = relaxedResults.filter(exp =>
                    relaxedFilters.every(f =>
                        exp.tags.some(tag => tag.toLowerCase().includes(f.toLowerCase()))
                    )
                );
            }
        }
        if (relaxedResults.length > 0) {
            // Only show the highest score matches from relaxed results
            relaxedResults = relaxedResults
                .map(exp => ({ ...exp, _score: matchScore(exp) }));
            let relaxedMax = 0;
            relaxedResults.forEach(exp => { if (exp._score > relaxedMax) relaxedMax = exp._score; });
            relaxedResults = relaxedResults.filter(exp => exp._score === relaxedMax && relaxedMax > 0);
            relaxedResults.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
            addMessage(
                "Hmm. We weren't able to find an experience that matched all your filters, so we relaxed them a bit. Here are some options that might interest you, based on your major and/or remaining filters.",
                "bot",
                () => {
                    showExperienceResultsList(relaxedResults, 0);
                }
            );
        } else {
            addMessage("No matches found, sorry. Try different filters?", "bot", () => {
                setOptions([
                    { label: "Try Different Filters", icon: "filter-line", onClick: () => {
                        filterTopicIndex = 0;
                        filterSelections = {};
                        chatbotAskFilterTopic();
                    }}
                ]);
            });
        }
        return;
    }

    // Sort finalResults by score descending, then by name for consistency
    finalResults.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));

    showExperienceResultsList(finalResults, 0);
}

function showExperienceResultsList(list, startIdx) {
    // Hide filter tags when showing final results
    const tagArea = document.getElementById('chatbot-filter-tags');
    if (tagArea) tagArea.style.display = "none";

    // Only show the "Based on your interests..." message ONCE, then show all results as a single message.
    if (!list || list.length === 0) {
        chatbotShowOffices();
        return;
    }

    // Build clickable names for all results
    const names = list.map(exp =>
        `<span class="chatbot-def-term" data-exp-name="${encodeURIComponent(exp.name)}"><b>${exp.name.toLowerCase()}<i class="ri-information-fill chatbot-term-info"></i></b></span>`
    );

    let message = "";

    // Pluralization rules
    function pluralizeExperience(name, expName) {
        expName = expName.toLowerCase();
        if (expName === "research" || expName === "service learning") {
            // No pluralization
            return name;
        }
        if (expName === "practicum") {
            // Plural is "practica"
            return name.replace(/(<b>)(.*?)(<\/b>)/i, (_, open, inner, close) => `${open}practica${close}`);
        }
        // Default: add "s"
        return name.replace(/(<b>)(.*?)(<\/b>)/i, (_, open, inner, close) => `${open}${inner}s${close}`);
    }

    if (names.length === 1) {
        message = `Based on your responses, you might be interested in ${pluralizeExperience(names[0], list[0].name)}.`;
    } else if (names.length === 2) {
        message = `Based on your responses, you might be interested in ${pluralizeExperience(names[0], list[0].name)}, or ${pluralizeExperience(names[1], list[1].name)}.`;
    } else {
        const pluralNames = names.map((n, idx) => pluralizeExperience(n, list[idx].name));
        const allButLast = pluralNames.slice(0, -1).join(" ");
        const last = pluralNames[pluralNames.length - 1];
        message = `Based on your responses, you might be interested in ${allButLast} or ${last}`;
    }

    addMessage(message, "bot", () => {
        const msgArea = document.getElementById('chatbot-messages');
        if (!msgArea) return;
        const terms = msgArea.querySelectorAll('.chatbot-def-term');
        terms.forEach(term => {
            term.style.cursor = "pointer";
            term.title = "Tap to see definition";
            term.onclick = function(e) {
                const expName = decodeURIComponent(term.getAttribute('data-exp-name'));
                const exp = experiences.find(x => x.name.toLowerCase() === expName.toLowerCase());
                if (exp) {
                    showInfoModal(exp.name, exp.description || "No additional information available.");
                }
            };
        });
        chatbotShowOffices();
    });
}


// Modular function to show office results as cards with matched tags
function showOfficesResultsList(list, startIdx, userTags) {
    // Sort offices by number of matched tags (descending)
    const sortedList = [...list].sort((a, b) => {
        const aMatches = (a.tags || []).filter(tag =>
            userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
        ).length;
        const bMatches = (b.tags || []).filter(tag =>
            userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
        ).length;
        // Descending order: most matches first
        return bMatches - aMatches;
    });

    const endIdx = Math.min(startIdx + 2, sortedList.length);
    for (let i = startIdx; i < endIdx; i++) {
        const office = sortedList[i];
        // Find matching tags (case-insensitive)
        const matchedTags = (office.tags || []).filter(tag =>
            userTags.some(userTag => tag.toLowerCase() === userTag.toLowerCase())
        );

        // --- New: Build contact/location section if present ---
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

        // --- New: Arrange card with a flex layout: left = image, right = content (including contact/location) ---
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
    }
    if (endIdx < sortedList.length) {
        setOptions([
            {
                label: "Show More",
                icon: "arrow-down-line",
                onClick: () => {
                    setOptions([]);
                    showOfficesResultsList(sortedList, endIdx, userTags);
                }
            }
        ]);
        unlockChatbotUI();
    } else {
        setOptions([
            { label: "Search Again", icon: "search-line", onClick: () => {
                chatbotStart();
            }},
            { label: "Internship Hub", icon: "external-link-line", onClick: () => {
                window.open("https://humboldt.edu/internships", "_blank");
            }}
        ]);
        unlockChatbotUI();
        // --- Add feedback button as a final message ---
        setTimeout(() => {
            queueMessage(
                `<button class="chatbot-option-btn feedback-button" onclick="window.open('https://forms.gle/y3fC1q7sthgipkaFA', '_blank')">
                    Submit feedback <i class="ri-external-link-line" style="margin-left:0.5em;font-size:1em;"></i>
                </button>`,
                "bot"
            );
        }, 400);
    }
}

// Update chatbotShowOffices to use the new card layout and tags
function chatbotShowOffices() {
    hideToolbar();
    addMessage("Here are some campus resources you may find helpful.", "bot", () => {
        // Collect user tags from major and filters
        let userTags = [];
        if (chatbotState.major) userTags.push(chatbotState.major);
        userTags = userTags.concat(Object.values(filterSelections).flat());
        showOfficesResultsList(offices, 0, userTags);
    });
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

// Add a loading overlay inside the options container if not present
function ensureLoadingOverlay() {
    const optionsDrawer = document.getElementById('chatbot-options-drawer');
    if (!optionsDrawer) return;
    if (!document.getElementById('chatbot-loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'chatbot-loading-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'transparent';
        overlay.style.backdropFilter = 'blur(20px)';
        overlay.style.display = 'none';
        overlay.style.zIndex = '999';
        overlay.style.pointerEvents = 'all';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.display = 'none';
        overlay.style.transition = 'opacity 0.2s';
        overlay.innerHTML = `<div style="font-size:2rem;color:#00695c;display:flex;align-items:center;gap:0.7em;">
            <span class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></span>
        </div>
        <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
        </style>`;
        optionsDrawer.style.position = 'relative';
        optionsDrawer.appendChild(overlay);
    }
}

function showLoadingOverlay() {
    ensureLoadingOverlay();
    const overlay = document.getElementById('chatbot-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}
function hideLoadingOverlay() {
    const overlay = document.getElementById('chatbot-loading-overlay');
    if (overlay) overlay.style.display = 'none';
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