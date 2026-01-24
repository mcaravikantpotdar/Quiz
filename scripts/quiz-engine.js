class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        
        // --- CONFIGURATION ---
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxt-akN_S5Dmr3HdtxpEL9by9J80kmZYCufXI1e9_fK3Ep0QYomPU-6jF-3ryPq7Q/exec";
        this.ADMIN_PASSWORD = "Admin@2026"; 
        
        this.GITHUB_CONFIG = {
            owner: "mcaravikantpotdar", 
            repo: "Quiz",                
            path: "jsons"                
        };
        
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {}; 
        this.selectedQuizFile = null;
        this.availableQuizzes = []; 
        this.scoreboardData = [];
        this.sortConfig = { key: 'date', asc: false };

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
            if (!response.ok) throw new Error(`Library Sync Failed`);
            const files = await response.json();

            this.availableQuizzes = files
                .filter(file => file.name.toLowerCase().endsWith('.json'))
                .map(file => {
                    const cleanName = file.name
                        .replace('.json', '')
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    return { name: `📂 ${cleanName}`, file: file.name };
                });

            if (this.availableQuizzes.length === 0) {
                this.quizListContainer.innerHTML = '<p style="padding:10px; opacity:0.5;">No Quizzes Available.</p>';
            } else {
                this.renderQuizLibrary();
            }
        } catch (error) {
            this.quizListContainer.innerHTML = `<p style="color:#ef4444; padding:10px;">Connection Error.</p>`;
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
        this.btnTopHome = document.getElementById('topHomeBtn');
        this.btnTopQuit = document.getElementById('topQuitBtn');
        this.btnNext = document.getElementById('nextBtn');
        this.btnPrev = document.getElementById('prevBtn');
        this.btnHint = document.getElementById('hintBtn');
        this.btnQuit = document.getElementById('quitBtn');
        this.btnConfirmQuit = document.getElementById('confirmQuit');
        this.btnCancelQuit = document.getElementById('cancelQuit');
        this.btnRetake = document.getElementById('retakeBtn');
        this.btnHome = document.getElementById('homeBtn');
        this.btnAdminGear = document.getElementById('adminGear');
        this.modalAdmin = document.getElementById('adminModal');
        this.inputAdminPass = document.getElementById('adminPassword');
        this.btnConfirmReset = document.getElementById('confirmReset');
        this.btnCloseAdmin = document.getElementById('closeAdmin');
        this.adminError = document.getElementById('adminError');
        this.modalQuit = document.getElementById('quitModal');
        this.errorDiv = document.getElementById('errorMessage');
    }

    bindEvents() {
        this.inputName.addEventListener('input', () => this.validateStartForm());
        this.inputSchool.addEventListener('input', () => this.validateStartForm());
        this.btnStart.addEventListener('click', () => this.handleStart());
        
        const showScoreboard = () => { QuizUtils.showScreen('scoreboardScreen'); this.fetchScoreboard(); };
        this.btnViewScoreboard.addEventListener('click', showScoreboard);
        if(this.btnViewScoreboardResults) this.btnViewScoreboardResults.addEventListener('click', showScoreboard);
        
        this.btnBackScoreboard.addEventListener('click', () => {
            if (this.quizEngine.quizData && this.quizEngine.currentQuestionIndex >= 0) {
                 QuizUtils.showScreen('quizScreen');
            } else { QuizUtils.showScreen('uploadScreen'); }
        });

        this.btnNext.addEventListener('click', () => this.nextQuestion());
        this.btnPrev.addEventListener('click', () => this.previousQuestion());
        this.btnTopHome.addEventListener('click', () => window.location.reload());
        this.btnHint.addEventListener('click', () => this.showHint());
        this.btnQuit.addEventListener('click', () => this.modalQuit.classList.add('active'));
        this.btnTopQuit.addEventListener('click', () => this.modalQuit.classList.add('active'));
        this.btnCancelQuit.addEventListener('click', () => this.modalQuit.classList.remove('active'));
        this.btnConfirmQuit.addEventListener('click', () => this.quitQuiz());
        this.btnRetake.addEventListener('click', () => this.retakeQuiz());
        this.btnHome.addEventListener('click', () => window.location.reload());
        this.btnAdminGear.addEventListener('click', () => this.modalAdmin.classList.add('active'));
        this.btnCloseAdmin.addEventListener('click', () => this.modalAdmin.classList.remove('active'));

        this.inputAdminPass.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleDatabaseReset();
        });
        this.btnConfirmReset.addEventListener('click', () => this.handleDatabaseReset());
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

    async handleStart() {
        if (!this.selectedQuizFile) return;
        QuizUtils.showLoading(true);
        try {
            const response = await fetch(`jsons/${this.selectedQuizFile}?t=${Date.now()}`);
            const data = await response.json();
            this.quizEngine.loadQuizData(data);
            this.startQuiz();
        } catch (error) {
            this.errorDiv.textContent = error.message;
        } finally { QuizUtils.showLoading(false); }
    }

    updateHeaderIdentity() {
        const name = this.inputName.value;
        const school = this.inputSchool.value;
        const mode = this.quizEngine.mode.toUpperCase();
        
        const oldId = document.getElementById('identityBar');
        if(oldId) oldId.remove();

        const identityHTML = `
            <div id="identityBar" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:10px; margin-bottom:15px; width:100%;">
                <div style="text-align:left;">
                    <div style="font-weight:700; font-size:14px; color:#1e293b;">👤 ${name}</div>
                    <div style="font-size:11px; color:#64748b;">${school}</div>
                </div>
                <div class="stat-badge ${mode === 'TEST' ? 'strict' : ''}" style="font-size:10px; padding:4px 8px; border-radius:12px; background:${mode === 'TEST' ? '#fee2e2' : '#dcfce7'}; color:${mode === 'TEST' ? '#991b1b' : '#166534'}; border:none;">
                    ${mode} MODE
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = identityHTML.trim();
        const header = document.querySelector('.quiz-header');
        if (header) {
            header.prepend(tempDiv.firstChild);
        }
    }

    startQuiz() {
        const mode = document.querySelector('input[name="quizMode"]:checked').value;
        this.quizEngine.setMode(mode);
        
        // Sync Hint State
        Object.keys(this.quizEngine.userAnswers).forEach(qId => {
            if (this.quizEngine.userAnswers[qId].hintUsed) this.hintUsed[qId] = true;
        });

        const metadata = this.quizEngine.quizData.metadata;
        document.getElementById('chapterTitle').textContent = metadata.chapter_title;
        document.getElementById('totalQuestions').textContent = this.quizEngine.getTotalQuestions();
        
        this.updateHeaderIdentity();
        QuizUtils.showScreen('quizScreen');
        this.renderQuestionGrid();
        this.showQuestion(this.quizEngine.currentQuestionIndex);
        this.updateScoreDisplay();
    }

    renderOptions(q) {
        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';
        const order = this.getShuffledOptions(q);
        const labels = ['A', 'B', 'C', 'D'];
        const ans = this.quizEngine.userAnswers[q.question_id];
        const isDisabled = this.quizEngine.isQuestionDisabled(q.question_id);

        order.forEach((key, idx) => {
            const card = document.createElement('div');
            card.className = 'option-card';
            const optionData = q.options[key];

            card.innerHTML = `<div class="option-label">${labels[idx]}</div><div class="option-content"><div class="opt-lang en">${optionData.en}</div><div class="opt-lang hi">${optionData.hi}</div></div>`;
            
            if (ans) {
                if (this.quizEngine.mode === 'practice') {
                    if (ans.history && ans.history.includes(key)) {
                        card.classList.add(key === q.correct_option ? 'correct' : 'wrong');
                    } else if (isDisabled && key === q.correct_option) {
                        card.classList.add('correct');
                    }
                } else if (key === ans.selectedOption) {
                    card.classList.add('selected-only');
                }
            }
            if (isDisabled) card.classList.add('disabled');
            else card.addEventListener('click', () => this.selectOption(key));
            container.appendChild(card);
        });
    }

    showQuestion(i) {
        this.quizEngine.stopTimer(); 
        this.quizEngine.currentQuestionIndex = i;
        const q = this.quizEngine.getCurrentQuestion();
        
        document.getElementById('questionEn').innerHTML = q.question.en;
        document.getElementById('questionHi').innerHTML = q.question.hi;
        document.getElementById('currentQuestion').textContent = i + 1;
        this.renderOptions(q);
        
        document.querySelectorAll('#feedbackContainer, #hintArea').forEach(el => el.remove());
        
        document.getElementById('optionsContainer').insertAdjacentHTML('afterend', `
            <div id="feedbackContainer" style="display: none;">
                <div class="feedback-area explanation-area"><h4>✅ Explanation</h4><div class="e-en">${q.explanation.en}</div><div class="e-hi">${q.explanation.hi}</div></div>
                <div class="key-takeaway-area"><h4>🔑 Key Takeaway</h4><div class="t-en">${q.key_takeaway.en}</div><div class="t-hi">${q.key_takeaway.hi}</div></div>
            </div>
            <div id="hintArea" class="feedback-area hint-area" style="display: none;"><h4>💡 Hint</h4><div class="h-en">${q.hint.en}</div><div class="h-hi">${q.hint.hi}</div></div>
        `);
        
        this.updateQuestionGrid(); 
        this.updateNavigationButtons();
        this.startQuestionTimer(q.question_id);
        this.updateHintButton();

        if (this.quizEngine.isQuestionDisabled(q.question_id) && this.quizEngine.mode === 'practice') {
            document.getElementById('feedbackContainer').style.display = 'block';
        }
        if (this.hintUsed[q.question_id]) {
            document.getElementById('hintArea').style.display = 'block';
        }
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
            this.showQuestion(this.quizEngine.currentQuestionIndex);
        });
    }

    updateHintButton() {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.btnHint.disabled = this.quizEngine.isQuestionDisabled(qId) || this.hintUsed[qId];
    }

    showHint() {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.hintUsed[qId] = true;
        const hintEl = document.getElementById('hintArea');
        if (hintEl) hintEl.style.display = 'block';
        this.updateHintButton();
    }

    updateScoreDisplay() { document.getElementById('currentScore').textContent = this.quizEngine.score; }

    updateNavigationButtons() {
        const isLast = this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1;
        this.btnNext.textContent = isLast ? '🏁 Finish' : 'Next →';
        this.btnPrev.disabled = this.quizEngine.currentQuestionIndex === 0;
    }

    renderQuestionGrid() {
        const grid = document.getElementById('questionGrid'); 
        grid.innerHTML = '';
        this.quizEngine.quizData.questions.forEach((q, i) => {
            const el = document.createElement('div');
            el.className = `question-number ${this.quizEngine.getQuestionStatus(q.question_id)}`;
            if (i === this.quizEngine.currentQuestionIndex) el.classList.add('current');
            el.innerHTML = `<div class="q-number">${i + 1}</div>`;
            el.addEventListener('click', () => this.goToQuestion(i));
            grid.appendChild(el);
        });
    }

    updateQuestionGrid() {
        this.renderQuestionGrid();
    }

    previousQuestion() { this.showQuestion(this.quizEngine.currentQuestionIndex - 1); }
    nextQuestion() { 
        if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) this.completeQuiz();
        else this.showQuestion(this.quizEngine.currentQuestionIndex + 1); 
    }
    goToQuestion(i) { this.showQuestion(i); }
    quitQuiz() { this.completeQuiz(true); }

    completeQuiz(forced = false) { 
        const res = this.quizEngine.getResults(); 
        this.quizEngine.stopTimer();
        QuizUtils.createConfetti(); 
        document.getElementById('finalScore').textContent = res.totalScore; 
        document.getElementById('totalPossible').textContent = res.maxScore; 
        document.getElementById('percentage').textContent = res.percentage; 
        document.getElementById('totalTime').textContent = res.timeTaken; 
        QuizUtils.showScreen('resultsScreen'); 
        this.submitScore(res); 
    }

    getShuffledOptions(q) {
        const qId = q.question_id;
        if (this.shuffledOrders[qId]) return this.shuffledOrders[qId];
        let order = ['a', 'b', 'c', 'd'];
        const allText = JSON.stringify(q.options).toLowerCase();
        if (!["both", "all of", "none of"].some(kw => allText.includes(kw))) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
        }
        this.shuffledOrders[qId] = order;
        return order;
    }

    async submitScore(res) {
        const payload = { 
            action: 'submit', 
            studentName: this.inputName.value, 
            schoolName: this.inputSchool.value, 
            quizTitle: this.quizEngine.quizData.metadata.chapter_title, 
            mode: this.quizEngine.mode.toUpperCase(), 
            score: `${res.totalScore}/${res.maxScore}`, 
            timeTaken: res.timeTaken 
        };
        try { await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) }); } catch (e) { }
    }
}
document.addEventListener('DOMContentLoaded', () => { window.app = new QuizApp(); });
