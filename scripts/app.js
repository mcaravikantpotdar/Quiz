class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        
        // --- CONFIGURATION ---
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxt-akN_S5Dmr3HdtxpEL9by9J80kmZYCufXI1e9_fK3Ep0QYomPU-6jF-3ryPq7Q/exec";
        
        // --- GITHUB API CONFIG (Updated from your data) ---
        this.GITHUB_CONFIG = {
            owner: "mcaravikantpotdar", 
            repo: "Quiz",               
            path: "jsons"               
        };
        
        // State
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {}; 
        this.selectedQuizFile = null;
        this.availableQuizzes = []; 

        this.init();
    }

    async init() {
        this.cacheDOM();
        this.bindEvents();
        
        // Automatically scan GitHub for quiz files on startup
        await this.autoScanGitHubLibrary();
    }

    async autoScanGitHubLibrary() {
        const { owner, repo, path } = this.GITHUB_CONFIG;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        
        try {
            const response = await fetch(apiUrl, { cache: 'no-cache' });
            
            if (!response.ok) {
                if (response.status === 404) throw new Error(`Folder '${path}' not found.`);
                throw new Error(`GitHub API Error: ${response.statusText}`);
            }
            
            const files = await response.json();

            // Transform filenames into clean labels for the UI
            this.availableQuizzes = files
                .filter(file => file.name.toLowerCase().endsWith('.json'))
                .map(file => {
                    const cleanName = file.name
                        .replace('.json', '')
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                        
                    return {
                        name: `📂 ${cleanName}`,
                        file: file.name
                    };
                });

            if (this.availableQuizzes.length === 0) {
                this.quizListContainer.innerHTML = '<p style="font-size:12px; opacity:0.6; padding:10px;">No JSONs found.</p>';
            } else {
                this.renderQuizLibrary();
            }

        } catch (error) {
            this.quizListContainer.innerHTML = `<p style="color:#ef4444; font-size:12px; padding:10px;">Scan Error: ${error.message}</p>`;
        }
    }

    cacheDOM() {
        this.inputName = document.getElementById('studentName');
        this.inputSchool = document.getElementById('schoolName');
        this.quizListContainer = document.getElementById('quizList');
        this.btnStart = document.getElementById('startQuiz');
        this.btnViewScoreboard = document.getElementById('viewScoreboardBtn');
        this.btnViewScoreboardResults = document.getElementById('viewScoreboardFromResults');
        this.btnBackScoreboard = document.getElementById('backFromScoreboard');
        this.btnDemo = document.getElementById('demoModeBtn'); 
        this.btnNext = document.getElementById('nextBtn');
        this.btnPrev = document.getElementById('prevBtn');
        this.btnHint = document.getElementById('hintBtn');
        this.btnQuit = document.getElementById('quitBtn');
        this.btnConfirmQuit = document.getElementById('confirmQuit');
        this.btnCancelQuit = document.getElementById('cancelQuit');
        this.btnRetake = document.getElementById('retakeBtn');
        this.btnHome = document.getElementById('homeBtn');
        this.modalQuit = document.getElementById('quitModal');
        this.errorDiv = document.getElementById('errorMessage');
    }

    bindEvents() {
        this.inputName.addEventListener('input', () => this.validateStartForm());
        this.inputSchool.addEventListener('input', () => this.validateStartForm());
        this.btnStart.addEventListener('click', () => this.handleStart());
        
        if (this.btnDemo) this.btnDemo.addEventListener('click', () => this.runDemoMode());
        
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

    runDemoMode() {
        this.inputName.value = "Demo Tester";
        this.inputSchool.value = "UI Lab";
        const demoData = {
            metadata: { chapter_title: "UI Smoke Test", chapter_title_hindi: "UI परीक्षण", total_questions: 1 },
            questions: [
                {
                    question_id: "demo1",
                    question: { en: "Demo Mode Active?", hi: "डेमो मोड सक्रिय?" },
                    options: { a: {en:"Yes",hi:"हाँ"}, b: {en:"No",hi:"नहीं"}, c: {en:"Maybe",hi:"शायद"}, d: {en:"None",hi:"कोई नहीं"} },
                    correct_option: "a",
                    hint: { en: "Click Yes", hi: "हाँ पर क्लिक करें" },
                    explanation: { en: "UI works.", hi: "UI काम करता है।" },
                    key_takeaway: { en: "Test passed.", hi: "परीक्षण सफल।" }
                }
            ]
        };
        this.quizEngine.loadQuizData(demoData);
        this.startQuiz();
    }

    async handleStart() {
        if (!this.selectedQuizFile) return;
        QuizUtils.showLoading(true);
        this.errorDiv.textContent = '';
        try {
            // Cache Busting ensure latest JSON content [cite: 27]
            const response = await fetch(`jsons/${this.selectedQuizFile}?t=${Date.now()}`);
            if (!response.ok) throw new Error(`Could not find chapter file: ${this.selectedQuizFile}`);
            const data = await response.json();
            
            const validation = QuizUtils.validateQuizJSON(data);
            if (!validation.isValid) throw new Error(`Invalid JSON: ${validation.errors.join(', ')}`);
            
            this.quizEngine.loadQuizData(data);
            this.startQuiz();
        } catch (error) {
            this.errorDiv.textContent = `Error: ${error.message}`;
        } finally { QuizUtils.showLoading(false); }
    }

    startQuiz() {
        const mode = document.querySelector('input[name="quizMode"]:checked').value;
        this.quizEngine.setMode(mode);
        this.quizEngine.clearProgress(); 
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {}; 

        const metadata = this.quizEngine.quizData.metadata;
        document.getElementById('chapterTitle').textContent = (metadata.chapter_title || "Quiz") + (metadata.chapter_title_hindi ? ` / ${metadata.chapter_title_hindi}` : "");
        document.getElementById('totalQuestions').textContent = this.quizEngine.getTotalQuestions();
        document.getElementById('maxScore').textContent = this.quizEngine.getMaxScore();

        QuizUtils.showScreen('quizScreen');
        this.renderQuestionGrid();
        this.showQuestion(0);
        this.updateScoreDisplay();
    }

    getShuffledOptions(question) {
        const qId = question.question_id;
        if (this.shuffledOrders[qId]) return this.shuffledOrders[qId];
        const allText = JSON.stringify(question.options).toLowerCase();
        const keywords = ["both", "all of", "none of", "above", "below"];
        const isUnsafe = keywords.some(kw => allText.includes(kw));
        let order = ['a', 'b', 'c', 'd'];
        if (!isUnsafe) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
        }
        this.shuffledOrders[qId] = order;
        return order;
    }

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
            
            questionEl.innerHTML = `<div class="q-number">${index + 1}</div><div class="marks">${this.quizEngine.getQuestionMarks(question.question_id)?.display || ''}</div>`;
            questionEl.addEventListener('click', () => this.goToQuestion(index));
            grid.appendChild(questionEl);
        });
    }

    showQuestion(index) {
        if (this.quizEngine.currentQuestionId) this.quizEngine.saveCurrentQuestionTime(this.quizEngine.currentQuestionId, this.quizEngine.currentTimer);
        this.quizEngine.currentQuestionIndex = index;
        const question = this.quizEngine.getCurrentQuestion();
        if (!question) return;
        
        document.getElementById('questionEn').innerHTML = question.question.en;
        document.getElementById('questionHi').innerHTML = question.question.hi;
        document.getElementById('currentQuestion').textContent = index + 1;
        
        this.renderOptions(question);
        
        document.querySelectorAll('.hint-area, .explanation-area, .key-takeaway-area').forEach(el => el.remove());
        document.getElementById('optionsContainer').insertAdjacentHTML('afterend', `
            <div id="feedbackContainer" style="display: none;">
                <div class="feedback-area explanation-area"><h4 class="explanation-header">✅ Explanation</h4><div class="explanation-content"><div class="e-en">${question.explanation.en}</div><div class="e-hi">${question.explanation.hi}</div></div></div>
                <div class="key-takeaway-area"><h4>🔑 Key Takeaway</h4><div class="key-takeaway-content"><div class="t-en">${question.key_takeaway.en}</div><div class="t-hi">${question.key_takeaway.hi}</div></div></div>
            </div>
            <div id="hintArea" class="feedback-area hint-area" style="display: none;"><h4 class="hint-header">💡 Hint</h4><div class="hint-content"><div class="h-en">${question.hint.en}</div><div class="h-hi">${question.hint.hi}</div></div></div>
        `);

        if (!this.currentAttempts[question.question_id]) { this.currentAttempts[question.question_id] = 0; this.hintUsed[question.question_id] = false; }
        
        this.updateNavigationButtons();
        this.updateQuestionGrid();
        this.startQuestionTimer(question.question_id);
        this.updateHintButton();
        this.updateScoreDisplay();

        if (this.quizEngine.isQuestionDisabled(question.question_id) && this.quizEngine.mode === 'practice') this.showFeedbackArea('feedbackContainer');
        if (this.hintUsed[question.question_id]) this.showFeedbackArea('hintArea');
    }

    renderOptions(question) {
        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';
        const displayOrder = this.getShuffledOptions(question);
        const visualLabels = ['A', 'B', 'C', 'D'];
        const isDisabled = this.quizEngine.isQuestionDisabled(question.question_id);
        const userAnswer = this.quizEngine.userAnswers[question.question_id];
        
        displayOrder.forEach((optionKey, index) => {
            const option = question.options[optionKey];
            const optionCard = document.createElement('div');
            optionCard.className = 'option-card';
            optionCard.innerHTML = `<div class="option-label">${visualLabels[index]}</div><div class="option-content"><div class="option-en">${option.en}</div><div class="option-hi">${option.hi}</div></div>`;
            
            if (userAnswer) {
                if (optionKey === question.correct_option) optionCard.classList.add('correct');
                else if (optionKey === userAnswer.selectedOption && !userAnswer.isCorrect) optionCard.classList.add('wrong');
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
        const result = this.quizEngine.recordAnswer(questionId, selectedOption, this.currentAttempts[questionId], this.hintUsed[questionId]);
        this.renderOptions(question);
        this.updateScoreDisplay();
        this.updateQuestionInGrid(questionId);
        this.updateHintButton();

        if (this.quizEngine.isQuestionDisabled(questionId)) {
            this.quizEngine.clearTimer();
            this.updateNavigationButtons();
            if (this.quizEngine.mode === 'practice') this.showFeedbackArea('feedbackContainer');
        }
    }

    startQuestionTimer(questionId) {
        this.quizEngine.startTimer(questionId, (timeLeft) => {
            document.getElementById('timer').textContent = timeLeft;
            if (this.quizEngine.mode === 'practice' && timeLeft === 49 && !this.hintUsed[questionId]) this.showHint(true);
        }, () => {
            this.quizEngine.recordTimeout(questionId, this.hintUsed[questionId]);
            this.currentAttempts[questionId] = 3; 
            this.renderOptions(this.quizEngine.getCurrentQuestion());
            this.updateScoreDisplay();
            this.updateQuestionInGrid(questionId);
            this.updateHintButton();
            this.updateNavigationButtons();
            if (this.quizEngine.mode === 'practice') this.showFeedbackArea('feedbackContainer');
        });
    }

    updateQuestionInGrid(questionId) {
        const el = document.querySelector(`.question-number[data-question-id="${questionId}"]`);
        if (!el) return;
        const status = this.quizEngine.getQuestionStatus(questionId);
        el.className = `question-number ${status} ${parseInt(el.dataset.index) === this.quizEngine.currentQuestionIndex ? 'current' : ''}`;
        const marksEl = el.querySelector('.marks');
        if (marksEl) marksEl.textContent = this.quizEngine.getQuestionMarks(questionId)?.display || '';
    }

    updateQuestionGrid() { this.quizEngine.quizData.questions.forEach(q => this.updateQuestionInGrid(q.question_id)); }
    showFeedbackArea(id) { const el = document.getElementById(id); if (el) { el.style.display = 'block'; el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }
    showHint(autoShow = false) {
        const q = this.quizEngine.getCurrentQuestion();
        if (this.quizEngine.isQuestionDisabled(q.question_id)) return;
        if (!this.hintUsed[q.question_id] && !autoShow) { this.hintUsed[q.question_id] = true; this.updateHintButton(); }
        this.showFeedbackArea('hintArea');
    }

    updateHintButton() {
        const q = this.quizEngine.getCurrentQuestion();
        const btn = document.getElementById('hintBtn');
        if (!q) return;
        btn.disabled = this.quizEngine.isQuestionDisabled(q.question_id) || this.hintUsed[q.question_id];
        btn.textContent = this.hintUsed[q.question_id] ? '💡 Hint Used' : (this.quizEngine.mode === 'test' ? '💡 Hint (-2)' : '💡 Hint');
    }

    updateScoreDisplay() { document.getElementById('currentScore').textContent = this.quizEngine.score; }
    updateNavigationButtons() {
        const next = document.getElementById('nextBtn');
        const q = this.quizEngine.getCurrentQuestion();
        next.disabled = !this.quizEngine.isQuestionDisabled(q.question_id); 
        next.textContent = this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1 ? 'Finish →' : 'Next →';
        document.getElementById('prevBtn').disabled = this.quizEngine.currentQuestionIndex === 0;
    }

    previousQuestion() { this.quizEngine.clearTimer(); this.showQuestion(this.quizEngine.currentQuestionIndex - 1); }
    nextQuestion() { if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) this.completeQuiz(); else { this.quizEngine.clearTimer(); this.showQuestion(this.quizEngine.currentQuestionIndex + 1); } }
    goToQuestion(i) { this.quizEngine.clearTimer(); this.showQuestion(i); }
    quitQuiz() { this.quizEngine.clearTimer(); this.completeQuiz(); }

    completeQuiz() {
        this.quizEngine.clearTimer();
        QuizUtils.createConfetti();
        const res = this.quizEngine.getResults();
        document.getElementById('finalScore').textContent = res.totalScore;
        document.getElementById('totalPossible').textContent = res.maxScore;
        document.getElementById('percentage').textContent = res.percentage;
        document.getElementById('totalTime').textContent = res.timeTaken;
        this.renderResultsBreakdown(res);
        QuizUtils.showScreen('resultsScreen');
        this.submitScore(res);
    }

    renderResultsBreakdown(res) {
        const container = document.getElementById('resultsBreakdown');
        container.innerHTML = '';
        res.questions.forEach((q, i) => {
            const ans = res.userAnswers[q.question_id];
            const div = document.createElement('div');
            div.className = `result-item ${ans?.isCorrect ? 'correct' : 'wrong'}`;
            div.innerHTML = `<div class="result-meta">Q${i+1} • ${ans?.marks || 0} Marks</div><div class="result-question">${q.question.en}</div><div style="font-size:14px; color:#64748b;">Correct: ${q.options[q.correct_option].en}</div>`;
            container.appendChild(div);
        });
    }

    retakeQuiz() { this.quizEngine.clearProgress(); this.startQuiz(); }

    async submitScore(res) {
        if (!this.SCRIPT_URL) return;
        const payload = { action: 'submit', studentName: this.inputName.value, schoolName: this.inputSchool.value, quizTitle: this.quizEngine.quizData.metadata.chapter_title, mode: this.quizEngine.mode.toUpperCase(), score: `${res.totalScore}/${res.maxScore}`, timeTaken: `${res.timeTaken}m` };
        try { await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch (e) { console.error("Error:", e); }
    }

    async fetchScoreboard() {
        const tbody = document.getElementById('scoreboardBody');
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">Fetching...</td></tr>';
        try {
            const response = await fetch(`${this.SCRIPT_URL}?action=get&t=${Date.now()}`);
            const data = await response.json();
            tbody.innerHTML = data.slice(0, 50).map(row => `<tr><td style="padding:15px;">${row[0] ? new Date(row[0]).toLocaleDateString() : '-'}</td><td style="padding:15px;"><strong>${row[1]}</strong><br><span style="font-size:11px;">${row[2]}</span></td><td style="padding:15px;">${row[3]}</td><td style="padding:15px;">${row[4]}</td><td style="padding:15px;"><strong>${row[5]}</strong></td><td style="padding:15px;">${row[6]}</td></tr>`).join('');
        } catch (e) { tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">Error.</td></tr>'; }
    }
}
document.addEventListener('DOMContentLoaded', () => { window.app = new QuizApp(); });
