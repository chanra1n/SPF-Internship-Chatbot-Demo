// Experience data (simplified for demo, expand as needed)
        const experiences = [
            {
                name: "Academic Internship",
                tags: ["course credit", "faculty help", "not always paid", "reflection", "off-campus", "academic", "internship"],
                info: "Internships connected to a course; students get projects with faculty help and receive course credit. Typically not paid. The Center for Community Based Learning facilitates academic internships."
            },
            {
                name: "Service Learning",
                tags: ["service", "course credit", "reflection", "off-campus", "community", "maybe paid"],
                info: "Academic internship focused on providing a service to an external organization. Facilitated by the Center for Community Based Learning."
            },
            {
                name: "Clinical Placement",
                tags: ["clinical", "professional", "course credit", "required", "reflection", "off-campus"],
                info: "Internship in a clinical setting for professional experience. Common for social work majors. Facilitated by the Center for Community Based Learning."
            },
            {
                name: "Practicum",
                tags: ["practicum", "professional", "course credit", "required", "reflection", "off-campus"],
                info: "Internship in a professional setting for experience. Common for psychology majors. Facilitated by the Center for Community Based Learning."
            },
            {
                name: "Research Internship",
                tags: ["research", "faculty", "paid", "off-campus", "summer", "academic year"],
                info: "Opportunities with faculty, research labs, or agencies to generate new knowledge. Usually paid, especially off-campus. Advertised via Sponsored Programs Foundation, departments, or faculty."
            },
            {
                name: "Paid Academic Year Internship",
                tags: ["paid", "company", "academic year", "off-campus", "career", "internship"],
                info: "Internships offered by companies during the academic year. Students are hired directly. Advertised by the Career Development Center and departments."
            },
            {
                name: "Paid Summer Internship",
                tags: ["paid", "company", "summer", "off-campus", "career", "internship"],
                info: "Internships offered by companies during the summer. Students are hired directly. Advertised by the Career Development Center and departments."
            },
            {
                name: "Job Shadowing",
                tags: ["shadowing", "not paid", "career", "off-campus", "exploration"],
                info: "Observe professionals in their work environment to learn about careers. Not paid. May be arranged through departments or Career Center."
            }
        ];

        // Example majors (expand as needed)
        const majors = [
            "Biology", "Business", "Psychology", "Social Work", "Education", "Engineering", "Art", "Other"
        ];

        // Example departments for demo purposes
        const departmentAttributes = {
            "Biology": ["research", "faculty help", "career-relevant skills"],
            "Business": ["paid", "career-relevant skills"],
            "Psychology": ["practicum", "required", "faculty help"],
            "Social Work": ["clinical", "required", "faculty help"],
            "Education": ["required", "off-campus", "faculty help"],
            "Engineering": ["paid", "internship", "career-relevant skills"],
            "Art": ["internship", "faculty help"],
            "Other": []
        };

        // Offices info cards
        const offices = [
            {
                name: "Career Development Center",
                info: "The Career Development Center advertises paid jobs, internships, and fellowships through Handshake. They host career fairs and offer resume and job application help.",
                tags: ["paid", "career", "Handshake"]
            },
            {
                name: "Center for Community Based Learning (CCBL)",
                info: "CCBL supports course-based, hands-on learning: internships, practicums, and service learning. They help with course design, S4 reporting, and community connections.",
                tags: ["internship", "service learning", "practicum"]
            },
            {
                name: "Youth Educational Services (YES)",
                info: "YES offers volunteer opportunities, events, and leadership roles. Time commitment varies by program.",
                tags: ["volunteer", "leadership", "community"]
            },
            {
                name: "College Corps",
                info: "College Corps is a service fellowship: $10,000 for 450 hours of service in education, climate, or food insecurity. Hours may count for other requirements.",
                tags: ["service", "fellowship", "paid"]
            },
            {
                name: "SPF Engagement Hub",
                info: "SPF Engagement Hub lists externally funded fellowships, research, and paid internships for students and faculty. Opportunities change dynamically.",
                tags: ["fellowship", "research", "paid"]
            },
            {
                name: "Library",
                info: "The Library offers paid, on-campus internships involving research and scholarship, available year-round.",
                tags: ["paid", "research", "on-campus"]
            }
        ];

        // Chatbot state
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
            style.innerHTML = `
                .chatbot-filter-tag {
                    background: rgba(0,99,65,0.09);
                    color: #006341;
                    border-radius: 100vmin;
                    padding: 0.25em 1em;
                    font-size: 0.95em;
                    font-weight: 500;
                    margin: 0 0.1em;
                    border: 1px solid #e3f1e6;
                    display: inline-block;
                    white-space: nowrap;
                }
            `;
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
                let i = 0;
                function typeChar() {
                    if (i <= text.length) {
                        bubble.textContent = text.slice(0, i);
                        scrollMessagesToBottom();
                        i++;
                        setTimeout(typeChar, text.length > 60 ? 8 : 18); // faster for longer text
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
                    btn.onclick = () => opt.onClick();
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
                    btn.onclick = () => opt.onClick();
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
        function chatbotStart() {
            chatbotState = { mode: "student", step: 0, filters: [], major: null };
            filterAttempts = 0;
            filterTopicIndex = 0;
            filterSelections = {}; // Clear this too
            document.getElementById('chatbot-messages').innerHTML = '';
            showFilterTags(); // This will now show major (if any) and empty filters
            hideToolbar();
            addMessage("Opportunity awaits! What would you like to learn more about?", "bot", () => {
                setOptions([
                    { label: "I'm a Student", icon: "user-line", onClick: () => chatbotChooseMode("student") }
                    //{ label: "I'm Faculty/Staff", icon: "graduation-cap-line", onClick: () => chatbotChooseMode("faculty") },
                    //{ label: "I'm a Community Partner", icon: "team-line", onClick: () => chatbotChooseMode("community") }
                ]);
            });
        }

        function chatbotChooseMode(mode) {
            chatbotState.mode = mode;
            addMessage(
                mode === "student"
                    ? "Student"
                    : mode === "faculty"
                    ? "Faculty/Staff"
                    : "Community Partner",
                "user"
            );
            if (mode !== "student") {
                addMessage("Student mode is the main focus for this demo. Please select 'I'm a Student' to continue.", "bot", () => {
                    setOptions([{ label: "Back", icon: "arrow-left-line", onClick: chatbotStart }]);
                });
                return;
            }
            chatbotAskMajor();
        }

        function chatbotAskMajor() {
            hideToolbar();
            addMessage("What's your major?", "bot", () => {
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
            addMessage(major, "user");
            filterTopicIndex = 0;
            filterSelections = {}; // Clear this
            chatbotState.filters = []; // Clear this too
            showFilterTags(); // This will show major and empty filters
            chatbotAskFilterTopic();
        }

        // Define filter topics (grouped logically) for multi-step selection
        const filterTopics = [
            {
                key: "type",
                label: "What type of experience are you looking for?",
                options: [
                    { label: "Internships", icon: "briefcase-line", value: "internship" },
                    { label: "Research", icon: "flask-line", value: "research" },
                    { label: "Service Learning", icon: "heart-line", value: "service learning" },
                    { label: "Job Shadowing", icon: "eye-line", value: "shadowing" }
                ]
            },
            {
                key: "compensation",
                label: "Do you want paid or unpaid opportunities?",
                options: [
                    { label: "Paid", icon: "money-dollar-circle-line", value: "paid" },
                    { label: "Unpaid", icon: "close-circle-line", value: "not paid" }
                ]
            },
            {
                key: "location",
                label: "Where do you want your experience?",
                options: [
                    { label: "On Campus", icon: "home-2-line", value: "on-campus" },
                    { label: "Off Campus", icon: "road-map-line", value: "off-campus" }
                ]
            },
            {
                key: "timing",
                label: "When do you want to do this?",
                options: [
                    { label: "Academic Year", icon: "calendar-event-line", value: "academic year" },
                    { label: "Summer", icon: "sun-line", value: "summer" }
                ]
            },
            {
                key: "credit",
                label: "Do you want course credit?",
                options: [
                    { label: "Course Credit", icon: "award-line", value: "course credit" }
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
            
            addMessage(topic.label, "bot", () => {
                renderFilterScreen(topic);
            });
        }

    function renderFilterScreen(topic) {
        const optArea = document.getElementById('chatbot-options');
        optArea.innerHTML = '';

        showToolbar();
        updatePersistentToolbar(topic);

        // Render all buttons once, and update their selected state on click without re-rendering all
        const currentSelectionsForTopic = filterSelections[topic.key] || [];
        topic.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'chatbot-option-btn';

            if (currentSelectionsForTopic.includes(opt.value)) {
                btn.classList.add('selected');
            }

            // Icon (always left, absolutely positioned)
            if (opt.icon) {
                const iconCircle = document.createElement('div');
                iconCircle.className = 'chatbot-btn-icon-circle';
                const icon = document.createElement('i');
                icon.className = `ri-${opt.icon}`;
                icon.setAttribute('aria-hidden', 'true');
                iconCircle.appendChild(icon);
                btn.appendChild(iconCircle);
            }

            // Label (centered)
            const labelSpan = document.createElement('span');
            labelSpan.className = 'chatbot-btn-label';
            labelSpan.textContent = opt.label;
            btn.appendChild(labelSpan);

            btn.onclick = () => {
                // Toggle selection for this option only
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
                scrollMessagesToBottom(); // Ensure messages are always scrolled down after selection
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

    // Remove any previous text label
    btnBack.querySelector('.chatbot-btn-label')?.remove();
    btnNext.querySelector('.chatbot-btn-label')?.remove();

    // If only one nav button is visible, add text label
    if (showBack && !showNext) {
        // Only Back is visible
        const label = document.createElement('span');
        label.className = 'chatbot-btn-label';
        label.textContent = 'Back';
        btnBack.appendChild(label);
    } else if (!showBack && showNext) {
        // Only Next is visible
        const label = document.createElement('span');
        label.className = 'chatbot-btn-label';
        label.textContent = 'Next';
        btnNext.appendChild(label);
    }
    // If both are visible, just show icons (no label)

    btnBack.onclick = () => {
        filterTopicIndex--;
        chatbotAskFilterTopic();
    };

    btnNext.onclick = () => {
        filterTopicIndex++;
        chatbotAskFilterTopic();
    };

    const btnResults = document.getElementById('chatbot-toolbar-results');
    btnResults.style.display = filterTopicIndex === filterTopics.length - 1 ? '' : 'none';
    btnResults.onclick = () => {
        chatbotState.filters = Object.values(filterSelections).flat();
        chatbotShowResults(chatbotState.filters);
    };

    const btnStartOver = document.getElementById('chatbot-toolbar-startover');
    btnStartOver.onclick = chatbotStart;
}

// Hide toolbar for non-filter steps (results, offices, etc.)
function chatbotShowResults(filters) {
    hideToolbar();
    // Update chatbotState.filters before calling showFilterTags if it relies on it for results screen
    chatbotState.filters = filters; // Ensure this is up-to-date
    showFilterTags(); // Now this will show the final selected filters
    let results = experiences;
    // Filter by major (department attributes)
    if (chatbotState.major && departmentAttributes[chatbotState.major]) {
        results = results.filter(exp =>
            departmentAttributes[chatbotState.major].some(tag =>
                exp.tags.includes(tag)
            ) || exp.tags.includes(chatbotState.major.toLowerCase())
        );
    }
    // Filter by selected filters
    if (filters.length) {
        results = results.filter(exp =>
            filters.every(f =>
                exp.tags.some(tag => tag.toLowerCase().includes(f.toLowerCase()))
            )
        );
    }
    if (results.length === 0) {
        // Try relaxing filters one by one (from last to first)
        let relaxedResults = [];
        let relaxedFilters = [...filters];
        let removed = [];
        while (relaxedResults.length === 0 && relaxedFilters.length > 0) {
            removed.unshift(relaxedFilters.pop());
            relaxedResults = experiences;
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
            addMessage(
                "No matches found for all your filters. " +
                (removed.length > 0
                    ? `Removed filter${removed.length > 1 ? "s" : ""}: ${removed.join(", ")}.`
                    : ""
                ) +
                " Here are some close matches:",
                "bot",
                () => {
                    function showNext(i) {
                        if (i < relaxedResults.length) {
                            const tagStr = relaxedResults[i].tags.map(t => `#${t}`).join(' ');
                            addMessage(
                                `If you're interested in ${relaxedResults[i].name}, check out:\n${relaxedResults[i].info}\n${tagStr}`,
                                "bot",
                                () => showNext(i + 1)
                            );
                        } else {
                            chatbotShowOffices();
                        }
                    }
                    showNext(0);
                }
            );
        } else {
            addMessage("No matches found. Try different filters.", "bot", () => {
                setOptions([{ label: "Restart", icon: "refresh-line", onClick: chatbotStart }]);
            });
        }
        return;
    }
    addMessage("Here are some opportunities for you:", "bot", () => {
        function showNext(i) {
            if (i < results.length) {
                const tagStr = results[i].tags.map(t => `#${t}`).join(' ');
                addMessage(
                    `If you're interested in ${results[i].name}, check out:\n${results[i].info}\n${tagStr}`,
                    "bot",
                    () => showNext(i + 1)
                );
            } else {
                chatbotShowOffices();
            }
        }
        showNext(0);
    });
}

function chatbotShowOffices() {
    hideToolbar();
    addMessage("Campus offices that can help:", "bot", () => {
        function showOffice(i) {
            if (i < offices.length) {
                const tagStr = offices[i].tags.map(t => `#${t}`).join(' ');
                addMessage(`${offices[i].name}: ${offices[i].info}\n${tagStr}`, "bot", () => showOffice(i + 1));
            } else {
                setOptions([{ label: "Restart", icon: "refresh-line", onClick: chatbotStart }]);
            }
        }
        showOffice(0);
    });
}

// Start chatbot on page load
window.onload = chatbotStart;