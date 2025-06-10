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

        // Chatbot state
        let chatbotState = {
            step: 0,
            filters: []
        };

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
                btn.textContent = opt.label;
                btn.onclick = () => opt.onClick();
                // Animate each button with a slight stagger
                btn.style.animationDelay = (0.08 * idx) + 's';
                optArea.appendChild(btn);
                // Force reflow to restart animation if needed
                void btn.offsetWidth;
                btn.style.opacity = '';
            });
        }

        // Chatbot logic steps
        function chatbotStart() {
            chatbotState = { step: 0, filters: [] };
            document.getElementById('chatbot-messages').innerHTML = '';
            addMessage("Hi! 👋 I'm here to help you find the right experiential learning opportunity. What are you most interested in?", "bot", () => {
                setOptions([
                    { label: "Internships", onClick: () => chatbotChooseType("internship") },
                    { label: "Research", onClick: () => chatbotChooseType("research") },
                    { label: "Service Learning", onClick: () => chatbotChooseType("service") },
                    { label: "Job Shadowing", onClick: () => chatbotChooseType("shadowing") },
                    { label: "Show all", onClick: () => chatbotShowResults([]) }
                ]);
            });
        }

        function chatbotChooseType(type) {
            chatbotState.filters.push(type);
            addMessage(type.charAt(0).toUpperCase() + type.slice(1), "user");
            if (type === "internship") {
                addMessage("Great! What kind of internship are you looking for?", "bot", () => {
                    setOptions([
                        { label: "Academic (for course credit)", onClick: () => chatbotAddFilter("course credit") },
                        { label: "Paid (company/industry)", onClick: () => chatbotAddFilter("paid") },
                        { label: "Clinical/Practicum", onClick: () => chatbotAddFilter("clinical") },
                        { label: "Back", onClick: chatbotStart }
                    ]);
                });
            } else if (type === "research") {
                chatbotShowResults(["research"]);
            } else if (type === "service") {
                chatbotShowResults(["service"]);
            } else if (type === "shadowing") {
                chatbotShowResults(["shadowing"]);
            }
        }

        function chatbotAddFilter(filter) {
            chatbotState.filters.push(filter);
            addMessage(filter.charAt(0).toUpperCase() + filter.slice(1), "user");
            chatbotShowResults(chatbotState.filters);
        }

        function chatbotShowResults(filters) {
            let results = experiences;
            if (filters.length) {
                results = results.filter(exp =>
                    filters.every(f => exp.tags.some(tag => tag.includes(f)))
                );
            }
            if (results.length === 0) {
                addMessage("Sorry, I couldn't find any experiences matching your choices. Try another option!", "bot", () => {
                    setOptions([{ label: "Start Over", onClick: chatbotStart }]);
                });
                return;
            }
            addMessage("Here are some opportunities you might be interested in:", "bot", () => {
                // Show each result with a typing effect, one after another
                function showNext(i) {
                    if (i < results.length) {
                        addMessage(`• ${results[i].name}\n${results[i].info}`, "bot", () => showNext(i + 1));
                    } else {
                        setOptions([{ label: "Start Over", onClick: chatbotStart }]);
                    }
                }
                showNext(0);
            });
        }

        // Start chatbot on page load
        window.onload = chatbotStart;