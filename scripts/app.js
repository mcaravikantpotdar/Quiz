class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        
        // --- CONFIGURATION ---
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxt-akN_S5Dmr3HdtxpEL9by9J80kmZYCufXI1e9_fK3Ep0QYomPU-6jF-3ryPq7Q/exec";
        
        // State
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {}; // Holds the randomized order for each question
        this.selectedQuizFile = null;

        // --- QUIZ LIBRARY ---
        this.availableQuizzes = [
            // --- NEW: Coding Challenges (High Priority) ---
            { name: "💻 HTML Coding Challenge (40 Qs)",  file: "coding-challenge-html.json" },
            { name: "💻 JS Coding Challenge (40 Qs)",    file: "coding-challenge-js.json" },
            { name: "💻 PHP Coding Challenge (40 Qs)",   file: "coding-challenge-php.json" },
            { name: "💻 PL/SQL Coding Challenge (40 Qs)", file: "coding-challenge-plsql.json" },

            // Class 11 (10+1)
            { name: "11th Ch1: Computer Fundamentals", file: "10+1-Ch-1-(Computer Fundamentals).json" },
            { name: "11th Ch2: Digital Network",       file: "10+1-Ch-2-(Digital Network).json" },
            { name: "11th Ch3: DTP (PageMaker)",       file: "10+1-Ch-3-(DTP-PageMaker).json" },
            { name: "11th Ch4: Photoshop",             file: "10+1-Ch-4-(Photoshop).json" },
            { name: "11th Ch5: HTML Fundamentals",     file: "10+1-Ch-5-(HTML).json" },
            { name: "11th Ch6: JavaScript",            file: "10+1-Ch-6-(JS).json" },
            { name: "11th Ch7: Multimedia Apps",       file: "10+1-Ch-7-(Multimedia Applications).json" },

            // Class 12 (10+2)
            { name: "12th Ch1: NOS Essentials",        file: "10+2-CH-1-(NOS).json" },
            { name: "12th Ch2: Network Admin",         file: "10+2-CH-2-(Network Administration).json" },
            { name: "12th Ch3: Corel Draw",            file: "10+2-CH-3-(Corel Draw).json" },
            { name: "12th Ch4: PHP Scripting",         file: "10+2-CH-4-(PHP).json" },
            { name: "12th Ch5: RDBMS & MySQL",         file: "10+2-CH-5-(RDBMS-MySQL).json" },
            { name: "12th Ch6: PL/SQL",                file: "10+2-CH-6-(PL-SQL).json" },
            { name: "12th Ch7: Internet & Business",   file: "10+2-CH-7-(Internet and Business Applications).json" }
        ];

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.renderQuizLibrary();
        console.log("Quiz App Initialized - Online Mode");
    }

    cacheDOM() {
        // Inputs
        this.inputName = document.getElementById('studentName');
        this.inputSchool = document.getElementById('schoolName');
        this.quizListContainer = document.getElementById('quizList');
        
        // Buttons
        this.btnStart = document.getElementById('startQuiz');
        this.btnViewScoreboard = document.getElementById('viewScoreboardBtn');
        this.btnViewScoreboardResults = document.getElementById('viewScoreboardFromResults');
        this.btnBackScoreboard = document.getElementById('backFromScoreboard');
        this.btnDemo = document.getElementById('demoModeBtn'); // NEW: Demo Button
        
        // Quiz Controls
        this.btnNext = document.getElementById('nextBtn');
        this.btnPrev = document.getElementById('prevBtn');
        this.btnHint = document.getElementById('hintBtn');
        this.btnQuit = document.getElementById('quitBtn');
        this.btnConfirmQuit = document.getElementById('confirmQuit');
        this.btnCancelQuit = document.getElementById('cancelQuit');
        this.btnRetake = document.getElementById('retakeBtn');
        this.btnHome = document.getElementById('homeBtn');
        
        // Modals & Errors
        this.modalQuit = document.getElementById('quitModal');
        this.errorDiv = document.getElementById('errorMessage');
    }

    bindEvents() {
        this.inputName.addEventListener('input', () => this.validateStartForm());
        this.inputSchool.addEventListener('input', () => this.validateStartForm());
        this.btnStart.addEventListener('click', () => this.handleStart());
        
        // NEW: Bind Demo Button
        if (this.btnDemo) {
            this.btnDemo.addEventListener('click', () => this.runDemoMode());
        }
        
        const showScoreboard = () => { QuizUtils.showScreen('scoreboardScreen'); this.fetchScoreboard(); };
        this.btnViewScoreboard.addEventListener('click', showScoreboard);
        if(this.btnViewScoreboardResults) this.btnViewScoreboardResults.addEventListener('click', showScoreboard);
        
        this.btnBackScoreboard.addEventListener('click', () => {
            if (this.quizEngine.quizData && this.quizEngine.currentQuestionIndex >= 0 && this.quizEngine.score > 0) {
                 QuizUtils.showScreen('resultsScreen');
            } else { QuizUtils.showScreen('uploadScreen'); }
        });

        this.btnNext.addEventListener('click', () => this.nextQuestion());
        this.btnPrev.addEventListener('click', () => this.previousQuestion());
        this.btnHint.addEventListener('click', () => this.showHint());
        this.btnQuit.addEventListener('click', () => this.modalQuit.classList.add('active'));
        this.btnCancelQuit.addEventListener('click', () => this.modalQuit.classList.remove('active'));
        this.btnConfirmQuit.addEventListener('click', () => this.quitQuiz());
        this.btnRetake.addEventListener('click', () => this.retakeQuiz());
        this.btnHome.addEventListener('click', () => window.location.reload());
    }

    renderQuizLibrary() {
        this.quizListContainer.innerHTML = '';
        this.availableQuizzes.forEach((quiz) => {
            const btn = document.createElement('div');
            btn.className = 'quiz-btn';
            btn.textContent = quiz.name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedQuizFile = quiz.file;
                this.validateStartForm();
            });
            this.quizListContainer.appendChild(btn);
        });
    }

    validateStartForm() {
        const name = this.inputName.value.trim();
        const school = this.inputSchool.value.trim();
        const hasQuiz = !!this.selectedQuizFile;
        this.btnStart.disabled = !(name && school && hasQuiz);
    }

    // --- NEW: DEMO MODE LOGIC ---
    runDemoMode() {
        // 1. Auto-fill details for the scoreboard test
        this.inputName.value = "Demo Tester";
        this.inputSchool.value = "UI Lab";
        
        // 2. Create Hardcoded "Smoke Test" Data
        const demoData = {
            metadata: {
                chapter_title: "UI Smoke Test",
                chapter_title_hindi: "UI परीक्षण",
                total_questions: 4
            },
            questions: [
                {
                    // TEST 1: Code Snippet Styling
                    question_id: "demo1",
                    question: { 
                        en: "What does this code output?<br><pre><code>&lt;script&gt;\n  console.log('Hello');\n&lt;/script&gt;</code></pre>", 
                        hi: "यह कोड क्या आउटपुट देता है?<br><pre><code>&lt;script&gt;\n  console.log('Hello');\n&lt;/script&gt;</code></pre>" 
                    },
                    options: { 
                        a: {en:"Hello",hi:"Hello"}, 
                        b: {en:"Error",hi:"त्रुटि"}, 
                        c: {en:"Null",hi:"शून्य"}, 
                        d: {en:"Undefined",hi:"अपरिभाषित"} 
                    },
                    correct_option: "a",
                    hint: { en: "Check the console.", hi: "कंसोल की जाँच करें।" },
                    explanation: { en: "It prints a string.", hi: "यह एक स्ट्रिंग प्रिंट करता है।" },
                    key_takeaway: { en: "Code blocks should be dark.", hi: "कोड ब्लॉक डार्क होने चाहिए।" }
                },
                {
                    // TEST 2: Smart Shuffle Logic (Must contain 'Both')
                    question_id: "demo2",
                    question: { en: "Logic Check: Both A and B are correct.", hi: "लॉजिक चेक: A और B दोनों सही हैं।" },
                    options: { 
                        a: {en:"First Option",hi:"पहला विकल्प"}, 
                        b: {en:"Second Option",hi:"दूसरा विकल्प"}, 
                        c: {en:"Both A and B",hi:"A और B दोनों"}, 
                        d: {en:"None",hi:"कोई नहीं"} 
                    },
                    correct_option: "c",
                    hint: { en: "Look for 'Both'.", hi: "'Both' को देखें।" },
                    explanation: { en: "Shuffle should be disabled here.", hi: "यहाँ शफल अक्षम होना चाहिए।" },
                    key_takeaway: { en: "Order preserved.", hi: "क्रम संरक्षित।" }
                },
                {
                    // TEST 3: Timer & Scoring
                    question_id: "demo3",
                    question: { en: "What is 2 + 2?", hi: "2 + 2 क्या है?" },
                    options: { 
                        a: {en:"3",hi:"3"}, 
                        b: {en:"4",hi:"4"}, 
                        c: {en:"5",hi:"5"}, 
                        d: {en:"6",hi:"6"} 
                    },
                    correct_option: "b",
                    hint: { en: "Basic math.", hi: "गणित।" },
                    explanation: { en: "It is 4.", hi: "यह 4 है।" },
                    key_takeaway: { en: "Math check.", hi: "गणित की जाँच।" }
                },
                {
                    // TEST 4: Finish & Submit
                    question_id: "demo4",
                    question: { en: "Click correct to finish.", hi: "समाप्त करने के लिए सही क्लिक करें।" },
                    options: { 
                        a: {en:"Correct",hi:"सही"}, 
                        b: {en:"Wrong",hi:"गलत"}, 
                        c: {en:"Wrong",hi:"गलत"}, 
                        d: {en:"Wrong",hi:"गलत"} 
                    },
                    correct_option: "a",
                    hint: { en: "Click A.", hi: "A पर क्लिक करें।" },
                    explanation: { en: "Done.", hi: "हो गया।" },
                    key_takeaway: { en: "Quiz Complete.", hi: "क्विज़ पूरा हुआ।" }
                }
            ]
        };

        // 3. Inject & Start
        this.quizEngine.loadQuizData(demoData);
        this.startQuiz();
    }

    async handleStart() {
        if (!this.selectedQuizFile) return;
        QuizUtils.showLoading(true);
        this.errorDiv.textContent = '';
        try {
            const response = await fetch(`jsons/${this.selectedQuizFile}`);
            if (!response.ok) throw new Error(`Could not find chapter file: ${this.selectedQuizFile}`);
            const data = await response.json();
            const validation = QuizUtils.validateQuizJSON(data);
            if (!validation.isValid) throw new Error(`Invalid JSON: ${validation.errors.join(', ')}`);
            this.quizEngine.loadQuizData(data);
            this.startQuiz();
        } catch (error) {
            console.error(error);
            this.errorDiv.textContent = `Error: ${error.message}`;
        } finally { QuizUtils.showLoading(false); }
    }

    startQuiz() {
        const mode = document.querySelector('input[name="quizMode"]:checked').value;
        this.quizEngine.setMode(mode);
        this.quizEngine.clearProgress(); 
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {}; // Reset shuffle state

        const metadata = this.quizEngine.quizData.metadata;
        const titleText = metadata.chapter_title || "Quiz";
        const titleHi = metadata.chapter_title_hindi ? ` / ${metadata.chapter_title_hindi}` : "";
        document.getElementById('chapterTitle').textContent = titleText + titleHi;
        document.getElementById('totalQuestions').textContent = this.quizEngine.getTotalQuestions();
        document.getElementById('maxScore').textContent = this.quizEngine.getMaxScore();

        QuizUtils.showScreen('quizScreen');
        this.renderQuestionGrid();
        this.showQuestion(0);
        this.updateScoreDisplay();
    }

    // --- SMART SHUFFLE HELPER ---
    getShuffledOptions(question) {
        const qId = question.question_id;
        
        // Return existing order if already shuffled
        if (this.shuffledOrders[qId]) return this.shuffledOrders[qId];

        // CHECK: Should we shuffle?
        // Scan all options for keywords that imply order dependence
        const allText = JSON.stringify(question.options).toLowerCase();
        const keywords = ["both", "all of", "none of", "above", "below"];
        const isUnsafe = keywords.some(kw => allText.includes(kw));

        let order = ['a', 'b', 'c', 'd'];

        if (!isUnsafe) {
            // Fisher-Yates Shuffle (Non-biased)
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
        }

        this.shuffledOrders[qId] = order;
        return order;
    }

    // --- GAMEPLAY ---
    renderQuestionGrid() {
        const grid = document.getElementById('questionGrid');
        grid.innerHTML = '';
        this.quizEngine.quizData.questions.forEach((question, index) => {
            const questionEl = document.createElement('div');
            questionEl.className = 'question-number';
            questionEl.dataset.index = index;
            questionEl.dataset.questionId = question.question_id;
            
            const status = this.quizEngine.getQuestionStatus(question.question_id);
            questionEl.classList.add(status);
            if (index === this.quizEngine.currentQuestionIndex) questionEl.classList.add('current');
            
            const numberEl = document.createElement('div');
            numberEl.className = 'q-number';
            numberEl.textContent = index + 1;
            questionEl.appendChild(numberEl);
            
            const marksEl = document.createElement('div');
            marksEl.className = 'marks';
            const marksInfo = this.quizEngine.getQuestionMarks(question.question_id);
            marksEl.textContent = marksInfo ? marksInfo.display : ''; 
            questionEl.appendChild(marksEl);
            
            questionEl.addEventListener('click', () => this.goToQuestion(index));
            grid.appendChild(questionEl);
        });
    }

    showQuestion(index) {
        if (this.quizEngine.currentQuestionId) {
            this.quizEngine.saveCurrentQuestionTime(
                this.quizEngine.currentQuestionId, 
                this.quizEngine.currentTimer
            );
        }
        this.quizEngine.currentQuestionIndex = index;
        const question = this.quizEngine.getCurrentQuestion();
        if (!question) return;
        
        document.getElementById('questionEn').innerHTML = question.question.en;
        document.getElementById('questionHi').innerHTML = question.question.hi;
        document.getElementById('currentQuestion').textContent = index + 1;
        
        this.renderOptions(question);
        
        const existingHint = document.getElementById('hintArea');
        if (existingHint) existingHint.remove();
        const existingFeedback = document.getElementById('feedbackContainer');
        if (existingFeedback) existingFeedback.remove();

        document.getElementById('optionsContainer').insertAdjacentHTML('afterend', `
            <div id="feedbackContainer" style="display: none;">
                <div class="feedback-area explanation-area">
                    <h4 class="explanation-header">✅ Explanation</h4>
                    <div class="explanation-content">
                        <div class="e-en">${question.explanation.en}</div>
                        <div class="e-hi">${question.explanation.hi}</div>
                    </div>
                </div>
                <div class="key-takeaway-area">
                    <h4>🔑 Key Takeaway</h4>
                    <div class="key-takeaway-content">
                        <div class="t-en">${question.key_takeaway.en}</div>
                        <div class="t-hi">${question.key_takeaway.hi}</div>
                    </div>
                </div>
            </div>
            <div id="hintArea" class="feedback-area hint-area" style="display: none;">
                <h4 class="hint-header">💡 Hint</h4>
                <div class="hint-content">
                    <div class="h-en">${question.hint.en}</div>
                    <div class="h-hi">${question.hint.hi}</div>
                </div>
            </div>
        `);

        if (!this.currentAttempts[question.question_id]) {
            this.currentAttempts[question.question_id] = 0;
            this.hintUsed[question.question_id] = false;
        }
        
        this.updateNavigationButtons();
        this.updateQuestionGrid();
        this.startQuestionTimer(question.question_id);
        this.updateHintButton();
        this.updateScoreDisplay(); // FORCE UPDATE

        const isDisabled = this.quizEngine.isQuestionDisabled(question.question_id);
        if (isDisabled && this.quizEngine.mode === 'practice') this.showFeedbackArea('feedbackContainer');
        if (this.hintUsed[question.question_id]) this.showFeedbackArea('hintArea');
    }

    renderOptions(question) {
        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';
        
        // --- SMART SHUFFLE IMPLEMENTATION ---
        const displayOrder = this.getShuffledOptions(question);
        const visualLabels = ['A', 'B', 'C', 'D'];

        const isDisabled = this.quizEngine.isQuestionDisabled(question.question_id);
        const userAnswer = this.quizEngine.userAnswers[question.question_id];
        const currentAttempts = this.currentAttempts[question.question_id] || 0;
        
        const showCorrectAnswer = isDisabled && (
            this.quizEngine.mode === 'practice' 
            ? (userAnswer?.isCorrect || currentAttempts >= 3)
            : true
        );
        
        displayOrder.forEach((optionKey, index) => {
            const option = question.options[optionKey];
            const optionCard = document.createElement('div');
            optionCard.className = 'option-card';
            optionCard.dataset.option = optionKey;
            
            optionCard.innerHTML = `
                <div class="option-label">${visualLabels[index]}</div>
                <div class="option-content">
                    <div class="option-en">${option.en}</div>
                    <div class="option-hi">${option.hi}</div>
                </div>
            `;
            
            if (userAnswer) {
                if (showCorrectAnswer && optionKey === question.correct_option) optionCard.classList.add('correct');
                else if (optionKey === userAnswer.selectedOption && !userAnswer.isCorrect) optionCard.classList.add('wrong');
                else if (optionKey === userAnswer.selectedOption && userAnswer.isCorrect) optionCard.classList.add('correct');
            } else if (isDisabled && optionKey === question.correct_option) {
                optionCard.classList.add('correct');
            }
            
            if (isDisabled) optionCard.classList.add('disabled');
            else optionCard.addEventListener('click', () => this.selectOption(optionKey));
            
            container.appendChild(optionCard);
        });
    }

    selectOption(selectedOption) {
        const question = this.quizEngine.getCurrentQuestion();
        const questionId = question.question_id;
        
        this.currentAttempts[questionId] = (this.currentAttempts[questionId] || 0) + 1;
        const attemptNumber = this.currentAttempts[questionId];
        const hintUsed = this.hintUsed[questionId] || false;
        
        const result = this.quizEngine.recordAnswer(questionId, selectedOption, attemptNumber, hintUsed);
        
        this.renderOptions(question);
        this.updateScoreDisplay();
        this.updateQuestionInGrid(questionId);
        this.updateHintButton();

        if (this.quizEngine.mode === 'practice') {
            if (result.isCorrect || attemptNumber >= 3) {
                this.showFeedbackArea('feedbackContainer');
                this.quizEngine.clearTimer(); 
                this.updateNavigationButtons(); 
            }
        } else {
            if (this.quizEngine.isQuestionDisabled(questionId)) {
                this.quizEngine.clearTimer();
                this.updateNavigationButtons();
            }
        }
    }

    startQuestionTimer(questionId) {
        this.quizEngine.startTimer(
            questionId,
            (timeLeft) => {
                document.getElementById('timer').textContent = timeLeft;
                if (this.quizEngine.mode === 'practice' && timeLeft === 49 && !this.hintUsed[questionId]) {
                    this.showHint(true);
                }
            },
            () => {
                const hintUsed = this.hintUsed[questionId] || false;
                this.quizEngine.recordTimeout(questionId, hintUsed);
                this.currentAttempts[questionId] = 3; 

                const question = this.quizEngine.getCurrentQuestion();
                this.renderOptions(question);
                this.updateScoreDisplay();
                this.updateQuestionInGrid(questionId);
                this.updateHintButton();
                this.updateNavigationButtons();
                if (this.quizEngine.mode === 'practice') this.showFeedbackArea('feedbackContainer');
            }
        );
    }

    updateQuestionInGrid(questionId) {
        const questionEl = document.querySelector(`.question-number[data-question-id="${questionId}"]`);
        if (!questionEl) return;
        
        const index = parseInt(questionEl.dataset.index);
        const status = this.quizEngine.getQuestionStatus(questionId);
        questionEl.classList.remove('current', 'correct', 'wrong', 'answered');
        questionEl.classList.add(status);
        if (index === this.quizEngine.currentQuestionIndex) questionEl.classList.add('current');
        
        const marksEl = questionEl.querySelector('.marks');
        const marksInfo = this.quizEngine.getQuestionMarks(questionId);
        if (marksEl) marksEl.textContent = marksInfo ? marksInfo.display : '';
    }

    updateQuestionGrid() {
        this.quizEngine.quizData.questions.forEach((q) => this.updateQuestionInGrid(q.question_id));
    }

    showFeedbackArea(areaId) {
        const area = document.getElementById(areaId);
        if (area) {
            area.style.display = 'block';
            area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    showHint(autoShow = false) {
        const question = this.quizEngine.getCurrentQuestion();
        const questionId = question.question_id;
        if (this.quizEngine.isQuestionDisabled(questionId)) return;
        
        if (!this.hintUsed[questionId] && !autoShow) {
            this.hintUsed[questionId] = true;
            this.updateHintButton();
        }
        this.showFeedbackArea('hintArea');
    }

    updateHintButton() {
        const question = this.quizEngine.getCurrentQuestion();
        const hintBtn = document.getElementById('hintBtn');
        if (!question) return;
        
        const isDisabled = this.quizEngine.isQuestionDisabled(question.question_id);
        const hintAlreadyUsed = this.hintUsed[question.question_id];
        
        hintBtn.disabled = isDisabled || hintAlreadyUsed;
        if (hintAlreadyUsed) hintBtn.textContent = '💡 Hint Used';
        else hintBtn.textContent = this.quizEngine.mode === 'test' ? '💡 Hint (-2)' : '💡 Hint';
    }

    updateScoreDisplay() { document.getElementById('currentScore').textContent = this.quizEngine.score; }

    updateNavigationButtons() {
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        const question = this.quizEngine.getCurrentQuestion();
        const isQuestionFinished = this.quizEngine.isQuestionDisabled(question.question_id);
        const isLastQuestion = this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1;
        prevBtn.disabled = this.quizEngine.currentQuestionIndex === 0;
        nextBtn.disabled = !isQuestionFinished; 
        nextBtn.textContent = isLastQuestion ? 'Finish →' : 'Next →';
    }

    previousQuestion() {
        if (this.quizEngine.currentQuestionIndex > 0) {
            this.quizEngine.clearTimer();
            this.showQuestion(this.quizEngine.currentQuestionIndex - 1);
        }
    }

    nextQuestion() {
        if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) {
            this.completeQuiz();
        } else {
            this.quizEngine.clearTimer();
            this.showQuestion(this.quizEngine.currentQuestionIndex + 1);
        }
    }

    goToQuestion(index) { this.quizEngine.clearTimer(); this.showQuestion(index); }
    quitQuiz() { this.quizEngine.clearTimer(); this.modalQuit.classList.remove('active'); this.completeQuiz(); }

    completeQuiz() {
        this.quizEngine.clearTimer();
        QuizUtils.createConfetti();
        const results = this.quizEngine.getResults();
        document.getElementById('finalScore').textContent = results.totalScore;
        document.getElementById('totalPossible').textContent = results.maxScore;
        document.getElementById('percentage').textContent = results.percentage;
        document.getElementById('totalTime').textContent = results.timeTaken;
        this.renderResultsBreakdown(results);
        QuizUtils.showScreen('resultsScreen');
        this.submitScore(results);
    }

    renderResultsBreakdown(results) {
        const container = document.getElementById('resultsBreakdown');
        container.innerHTML = '';
        results.questions.forEach((question, index) => {
            const userAnswer = results.userAnswers[question.question_id];
            const isCorrect = userAnswer?.isCorrect;
            const div = document.createElement('div');
            div.className = `result-item ${isCorrect ? 'correct' : 'wrong'}`;
            div.innerHTML = `
                <div class="result-meta">Q${index+1} • ${userAnswer ? userAnswer.marks : 0} Marks</div>
                <div class="result-question" style="font-weight:600; margin-bottom:5px;">${question.question.en}</div>
                <div style="font-size:14px; color:#64748b;">
                    Correct: ${question.options[question.correct_option].en}
                </div>
            `;
            container.appendChild(div);
        });
    }

    retakeQuiz() {
        this.quizEngine.clearProgress();
        this.startQuiz();
    }

    async submitScore(results) {
        if (!this.SCRIPT_URL) return;
        const payload = {
            action: 'submit',
            timestamp: new Date().toISOString(),
            studentName: this.inputName.value,
            schoolName: this.inputSchool.value,
            quizTitle: this.quizEngine.quizData.metadata.chapter_title,
            mode: this.quizEngine.mode.toUpperCase(),
            score: `${results.totalScore}/${results.maxScore}`,
            timeTaken: `${results.timeTaken}m`
        };
        try {
            await fetch(this.SCRIPT_URL, {
                method: "POST", mode: "no-cors", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error("Submission error:", e); }
    }

    async fetchScoreboard() {
        const tbody = document.getElementById('scoreboardBody');
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">Fetching scores...</td></tr>';
        try {
            const response = await fetch(`${this.SCRIPT_URL}?action=get&t=${Date.now()}`);
            const data = await response.json();
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">No scores recorded yet.</td></tr>';
                return;
            }
            data.slice(0, 50).forEach(row => { 
                const tr = document.createElement('tr');
                const dateStr = row[0] ? new Date(row[0]).toLocaleDateString() : '-';
                tr.innerHTML = `
                    <td style="padding:15px;">${dateStr}</td>
                    <td style="padding:15px;"><strong>${row[1]}</strong><br><span style="font-size:11px; color:#64748b;">${row[2]}</span></td>
                    <td style="padding:15px;">${row[3]}</td>
                    <td style="padding:15px;"><span class="tag ${row[4] === 'TEST' ? 'strict' : ''}">${row[4]}</span></td>
                    <td style="padding:15px;"><strong>${row[5]}</strong></td>
                    <td style="padding:15px;">${row[6]}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:red;">Could not load scoreboard.</td></tr>';
        }
    }
}
document.addEventListener('DOMContentLoaded', () => { window.app = new QuizApp(); });
