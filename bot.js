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

        // Helper to show filter tags
        function showFilterTags() {
            const tagAreaId = "chatbot-filter-tags";
            let tagArea = document.getElementById(tagAreaId);
            if (!tagArea) {
                tagArea = document.createElement('div');
                tagArea.id = tagAreaId;
                tagArea.style.display = "flex";
                tagArea.style.flexWrap = "wrap";
                tagArea.style.gap = "0.5em";
                tagArea.style.justifyContent = "center";
                tagArea.style.margin = "0.5em 0";
                document.getElementById('chatbot-messages').parentNode.insertBefore(tagArea, document.getElementById('chatbot-messages').nextSibling);
            }
            tagArea.innerHTML = "";
            if (chatbotState.major) {
                const tag = document.createElement('span');
                tag.className = "chatbot-filter-tag";
                tag.textContent = chatbotState.major;
                tagArea.appendChild(tag);
            }
            chatbotState.filters.forEach(f => {
                const tag = document.createElement('span');
                tag.className = "chatbot-filter-tag";
                tag.textContent = f;
                tagArea.appendChild(tag);
            });
        }

        // Add CSS for filter tags (only once)
        if (!document.getElementById('chatbot-filter-tag-style')) {
            const style = document.createElement('style');
            style.id = 'chatbot-filter-tag-style';
            style.innerHTML = `
                .chatbot-filter-tag {
                    background: rgba(0,99,65,0.09);
                    color: #006341;
                    border-radius: 12px;
                    padding: 0.2em 0.8em;
                    font-size: 0.95em;
                    font-weight: 500;
                    margin: 0 0.1em;
                    border: 1px solid #e3f1e6;
                    display: inline-block;
                }
            `;
            document.head.appendChild(style);
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
            msgArea.scrollTop = msgArea.scrollHeight;

            if (sender === "bot") {
                let i = 0;
                function typeChar() {
                    if (i <= text.length) {
                        bubble.textContent = text.slice(0, i);
                        msgArea.scrollTop = msgArea.scrollHeight;
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
        }

        // Helper to set options
        function setOptions(options) {
            const optArea = document.getElementById('chatbot-options');
            optArea.innerHTML = '';
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'chatbot-option-btn';
                // Add icon in a circle if provided
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
                // Force reflow to restart animation if needed
                void btn.offsetWidth;
                btn.style.opacity = '';
            });
        }

        // Chatbot logic steps
        function chatbotStart() {
            chatbotState = { mode: "student", step: 0, filters: [], major: null };
            document.getElementById('chatbot-messages').innerHTML = '';
            showFilterTags();
            addMessage("Opportunity awaits! What would you like to learn more about?", "bot", () => {
                setOptions([
                    { label: "I'm a Student", icon: "user-line", onClick: () => chatbotChooseMode("student") },
                    { label: "I'm Faculty/Staff", icon: "graduation-cap-line", onClick: () => chatbotChooseMode("faculty") },
                    { label: "I'm a Community Partner", icon: "team-line", onClick: () => chatbotChooseMode("community") }
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
                    setOptions([{ label: "Back", icon: "arrow-go-back-line", onClick: chatbotStart }]);
                });
                return;
            }
            chatbotAskMajor();
        }

        function chatbotAskMajor() {
            addMessage("What's your major?", "bot", () => {
                setOptions(
                    majors.map(m => ({
                        label: m,
                        icon: "book-mark-line",
                        onClick: () => chatbotSetMajor(m)
                    }))
                );
            });
        }

        function chatbotSetMajor(major) {
            chatbotState.major = major;
            addMessage(major, "user");
            showFilterTags();
            chatbotAskFilters();
        }

        function chatbotAskFilters() {
            addMessage("What are you looking for?", "bot", () => {
                setOptions([
                    { label: "Internships", icon: "briefcase-line", onClick: () => chatbotAddFilter("internship") },
                    { label: "Research", icon: "flask-line", onClick: () => chatbotAddFilter("research") },
                    { label: "Service Learning", icon: "heart-line", onClick: () => chatbotAddFilter("service learning") },
                    { label: "Job Shadowing", icon: "eye-line", onClick: () => chatbotAddFilter("shadowing") },
                    { label: "Paid", icon: "money-dollar-circle-line", onClick: () => chatbotAddFilter("paid") },
                    { label: "On Campus", icon: "home-2-line", onClick: () => chatbotAddFilter("on-campus") },
                    { label: "Off Campus", icon: "road-map-line", onClick: () => chatbotAddFilter("off-campus") },
                    { label: "Academic Year", icon: "calendar-event-line", onClick: () => chatbotAddFilter("academic year") },
                    { label: "Summer", icon: "sun-line", onClick: () => chatbotAddFilter("summer") },
                    { label: "Course Credit", icon: "award-line", onClick: () => chatbotAddFilter("course credit") },
                    { label: "Show Results", icon: "search-line", onClick: () => chatbotShowResults(chatbotState.filters) },
                    { label: "Start Over", icon: "refresh-line", onClick: chatbotStart }
                ]);
            });
        }

        function chatbotAddFilter(filter) {
            if (!chatbotState.filters.includes(filter)) {
                chatbotState.filters.push(filter);
            }
            addMessage(filter.charAt(0).toUpperCase() + filter.slice(1), "user");
            showFilterTags();
            chatbotAskFilters();
        }

        function chatbotShowResults(filters) {
            showFilterTags();
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
                addMessage("No matches found. Try different filters.", "bot", () => {
                    setOptions([{ label: "Start Over", icon: "refresh-line", onClick: chatbotStart }]);
                });
                return;
            }
            addMessage("Here are some opportunities for you:", "bot", () => {
                function showNext(i) {
                    if (i < results.length) {
                        // Show tags for each result
                        const tagStr = results[i].tags.map(t => `#${t}`).join(' ');
                        addMessage(
                            `If you're interested in ${results[i].name}, check out:\n${results[i].info}\n${tagStr}`,
                            "bot",
                            () => showNext(i + 1)
                        );
                    } else {
                        // Show info cards for offices
                        chatbotShowOffices();
                    }
                }
                showNext(0);
            });
        }

        function chatbotShowOffices() {
            addMessage("Campus offices that can help:", "bot", () => {
                function showOffice(i) {
                    if (i < offices.length) {
                        const tagStr = offices[i].tags.map(t => `#${t}`).join(' ');
                        addMessage(`${offices[i].name}: ${offices[i].info}\n${tagStr}`, "bot", () => showOffice(i + 1));
                    } else {
                        setOptions([{ label: "Start Over", icon: "refresh-line", onClick: chatbotStart }]);
                    }
                }
                showOffice(0);
            });
        }

        // Start chatbot on page load
        window.onload = chatbotStart;