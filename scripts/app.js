class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        
        // --- CONFIGURATION ---
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxt-akN_S5Dmr3HdtxpEL9by9J80kmZYCufXI1e9_fK3Ep0QYomPU-6jF-3ryPq7Q/exec";
        
        // --- GITHUB API CONFIG ---
        this.GITHUB_CONFIG = {
            owner: "mcaravikantpotdar", 
            repo: "Quiz",               
            path: "jsons"               
        };
        
        // State
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {}; 
        this.selectedQuizUrl = null; 
        this.availableQuizzes = []; 

        this.init();
    }

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.autoScanGitHubLibrary();
    }

    async autoScanGitHubLibrary() {
        const { owner, repo, path } = this.GITHUB_CONFIG;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        
        try {
            const response = await fetch(apiUrl, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
            
            const files = await response.json();

            this.availableQuizzes = files
                .filter(file => file.name.toLowerCase().endsWith('.json'))
                .map(file => {
                    const cleanName = file.name
                        .replace('.json', '')
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                        
                    return {
                        name: `📂 ${cleanName}`,
                        url: file.download_url 
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
                this.selectedQuizUrl = quiz.url; 
                this.validateStartForm();
            });
            this.quizListContainer.appendChild(btn);
        });
    }

    validateStartForm() {
        const name = this.inputName.value.trim();
        const school = this.inputSchool.value.trim();
        const hasQuiz = !!this.selectedQuizUrl;
        this.btnStart.disabled = !(name && school && hasQuiz);
    }

    async handleStart() {
        if (!this.selectedQuizUrl) return;
        QuizUtils.showLoading(true);
        this.errorDiv.textContent = '';
        try {
            const response = await fetch(`${this.selectedQuizUrl}?t=${Date.now()}`);
            if (!response.ok) throw new Error("Could not download quiz data.");
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
        this.currentAttempts = {}; this.hintUsed = {}; this.shuffledOrders = {}; 
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
        let order = ['a', 'b', 'c', 'd'];
        const allText = JSON.stringify(question.options).toLowerCase();
        if (!["both", "all of", "none of"].some(kw => allText.includes(kw))) {
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
        this.quizEngine.quizData.questions.forEach((q, i) => {
            const el = document.createElement('div');
            el.className = `question-number ${this.quizEngine.getQuestionStatus(q.question_id)}`;
            if (i === this.quizEngine.currentQuestionIndex) el.classList.add('current');
            el.innerHTML = `<div class="q-number">${i + 1}</div><div class="marks">${this.quizEngine.getQuestionMarks(q.question_id)?.display || ''}</div>`;
            el.addEventListener('click', () => this.goToQuestion(i));
            grid.appendChild(el);
        });
    }

    showQuestion(i) {
        this.quizEngine.currentQuestionIndex = i;
        const q = this.quizEngine.getCurrentQuestion();
        document.getElementById('questionEn').innerHTML = q.question.en;
        document.getElementById('questionHi').innerHTML = q.question.hi;
        document.getElementById('currentQuestion').textContent = i + 1;
        this.renderOptions(q);
        document.querySelectorAll('.hint-area, .explanation-area, .key-takeaway-area').forEach(el => el.remove());
        document.getElementById('optionsContainer').insertAdjacentHTML('afterend', `
            <div id="feedbackContainer" style="display: none;">
                <div class="feedback-area explanation-area"><h4>✅ Explanation</h4><div class="e-en">${q.explanation.en}</div><div class="e-hi">${q.explanation.hi}</div></div>
                <div class="key-takeaway-area"><h4>🔑 Key Takeaway</h4><div class="t-en">${q.key_takeaway.en}</div><div class="t-hi">${q.key_takeaway.hi}</div></div>
            </div>
            <div id="hintArea" class="feedback-area hint-area" style="display: none;"><h4>💡 Hint</h4><div class="h-en">${q.hint.en}</div><div class="h-hi">${q.hint.hi}</div></div>
        `);
        this.updateNavigationButtons();
        this.startQuestionTimer(q.question_id);
        this.updateHintButton();
    }

    renderOptions(q) {
        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';
        const order = this.getShuffledOptions(q);
        const labels = ['A', 'B', 'C', 'D'];
        const ans = this.quizEngine.userAnswers[q.question_id];
        const mode = this.quizEngine.mode;
        const isDisabled = this.quizEngine.isQuestionDisabled(q.question_id);

        order.forEach((key, idx) => {
            const card = document.createElement('div');
            card.className = 'option-card';
            card.innerHTML = `<div class="option-label">${labels[idx]}</div><div class="option-content"><div>${q.options[key].en}</div><div>${q.options[key].hi}</div></div>`;
            
            // --- UPDATED RENDER LOGIC ---
            if (ans) {
                if (mode === 'practice') {
                    // Practice: Highlight CORRECT green only when finalized (correct or max attempts)
                    if (key === q.correct_option && isDisabled) {
                        card.classList.add('correct');
                    } else if (key === ans.selectedOption && !ans.isCorrect) {
                        card.classList.add('wrong');
                    } else if (key === ans.selectedOption && ans.isCorrect) {
                        card.classList.add('correct');
                    }
                } else {
                    // Test: Just highlight selection neutrally
                    if (key === ans.selectedOption) card.classList.add('selected-only');
                }
            }

            if (isDisabled) {
                card.classList.add('disabled');
            } else {
                card.addEventListener('click', () => this.selectOption(key));
            }
            container.appendChild(card);
        });
    }

    selectOption(opt) {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.currentAttempts[qId] = (this.currentAttempts[qId] || 0) + 1;
        this.quizEngine.recordAnswer(qId, opt, this.currentAttempts[qId], this.hintUsed[qId]);
        this.showQuestion(this.quizEngine.currentQuestionIndex);
        this.updateScoreDisplay();
    }

    startQuestionTimer(qId) {
        this.quizEngine.startTimer(qId, (t) => {
            document.getElementById('timer').textContent = t;
        }, () => {
            this.quizEngine.recordTimeout(qId, this.hintUsed[qId]);
            this.showQuestion(this.quizEngine.currentQuestionIndex);
        });
    }

    updateHintButton() {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        const btn = document.getElementById('hintBtn');
        btn.disabled = this.quizEngine.isQuestionDisabled(qId) || this.hintUsed[qId];
    }

    showHint(auto = false) {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.hintUsed[qId] = true;
        this.showFeedbackArea('hintArea');
        this.updateHintButton();
    }

    showFeedbackArea(id) { document.getElementById(id).style.display = 'block'; }
    updateScoreDisplay() { document.getElementById('currentScore').textContent = this.quizEngine.score; }
    updateNavigationButtons() {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        document.getElementById('nextBtn').disabled = !this.quizEngine.isQuestionDisabled(qId);
        document.getElementById('prevBtn').disabled = this.quizEngine.currentQuestionIndex === 0;
    }

    previousQuestion() { this.quizEngine.clearTimer(); this.showQuestion(this.quizEngine.currentQuestionIndex - 1); }
    nextQuestion() { if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) this.completeQuiz(); else { this.quizEngine.clearTimer(); this.showQuestion(this.quizEngine.currentQuestionIndex + 1); } }
    goToQuestion(i) { this.quizEngine.clearTimer(); this.showQuestion(i); }
    completeQuiz() { QuizUtils.showScreen('resultsScreen'); this.submitScore(this.quizEngine.getResults()); }
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
