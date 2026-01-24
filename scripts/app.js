class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        
        // --- CONFIGURATION ---
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxt-akN_S5Dmr3HdtxpEL9by9J80kmZYCufXI1e9_fK3Ep0QYomPU-6jF-3ryPq7Q/exec";
        this.ADMIN_PASSWORD = "Admin@2026"; 
        
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
        this.selectedQuizFile = null;
        this.availableQuizzes = []; 
        
        // Leaderboard State
        this.scoreboardData = [];
        this.sortConfig = { key: 'date', asc: false }; // Default: Latest First

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
                    return { name: `📂 ${cleanName}`, file: file.name };
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

        const headerRow = document.getElementById('leaderboardHeaders');
        if (headerRow) {
            headerRow.addEventListener('click', (e) => {
                const th = e.target.closest('th');
                if (th && th.dataset.sort) this.sortScoreboard(th.dataset.sort);
            });
        }

        this.btnNext.addEventListener('click', () => this.nextQuestion());
        this.btnPrev.addEventListener('click', () => this.previousQuestion());
        this.btnTopHome.addEventListener('click', () => window.location.reload());
        this.btnHint.addEventListener('click', () => this.showHint());
        
        const openQuitModal = () => this.modalQuit.classList.add('active');
        this.btnQuit.addEventListener('click', openQuitModal);
        this.btnTopQuit.addEventListener('click', openQuitModal);
        
        this.btnCancelQuit.addEventListener('click', () => this.modalQuit.classList.remove('active'));
        this.btnConfirmQuit.addEventListener('click', () => this.quitQuiz());
        this.btnRetake.addEventListener('click', () => this.retakeQuiz());
        this.btnHome.addEventListener('click', () => window.location.reload());

        this.btnAdminGear.addEventListener('click', () => this.modalAdmin.classList.add('active'));
        this.btnCloseAdmin.addEventListener('click', () => {
            this.modalAdmin.classList.remove('active');
            this.inputAdminPass.value = '';
            this.adminError.textContent = '';
        });

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

    formatName(str) {
        return str.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
    }

    async handleStart() {
        if (!this.selectedQuizFile) return;
        
        this.inputName.value = this.formatName(this.inputName.value.trim());
        this.inputSchool.value = this.formatName(this.inputSchool.value.trim());

        QuizUtils.showLoading(true);
        this.errorDiv.textContent = '';
        try {
            const response = await fetch(`jsons/${this.selectedQuizFile}?t=${Date.now()}`);
            if (!response.ok) throw new Error("File not found on server.");
            const data = await response.json();
            this.quizEngine.loadQuizData(data);
            this.startQuiz();
        } catch (error) {
            this.errorDiv.textContent = `Error: ${error.message}`;
        } finally { QuizUtils.showLoading(false); }
    }

    updateHeaderIdentity() {
        const name = this.inputName.value;
        const school = this.inputSchool.value;
        const mode = this.quizEngine.mode.toUpperCase();
        
        const oldId = document.getElementById('identityBar');
        if(oldId) oldId.remove();

        const identityHTML = `
            <div id="identityBar">
                <div class="id-student-info">
                    <div class="id-name">👤 ${name}</div>
                    <div class="id-school">${school}</div>
                </div>
                <div class="stat-badge ${mode === 'TEST' ? 'strict' : ''}">
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
        const modeInput = document.querySelector('input[name="quizMode"]:checked');
        const mode = modeInput ? modeInput.value : 'practice';
        
        this.quizEngine.setMode(mode);
        this.quizEngine.clearProgress(); 
        
        this.currentAttempts = {}; 
        this.hintUsed = {}; 
        this.shuffledOrders = {}; 
        
        if (this.quizEngine.userAnswers) {
            Object.keys(this.quizEngine.userAnswers).forEach(qId => {
                if (this.quizEngine.userAnswers[qId].hintUsed) {
                    this.hintUsed[qId] = true;
                }
            });
        }
        
        const metadata = this.quizEngine.quizData.metadata;
        document.getElementById('chapterTitle').textContent = (metadata.chapter_title || "Quiz");
        document.getElementById('totalQuestions').textContent = this.quizEngine.getTotalQuestions();
        
        this.updateHeaderIdentity();
        QuizUtils.showScreen('quizScreen');
        this.renderQuestionGrid();
        this.showQuestion(0);
        this.updateScoreDisplay();
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
            
            const optKey = q.options[key] ? key : key.toUpperCase();
            const optionData = q.options[optKey] || { en: 'Error', hi: 'त्रुटि' };

            card.innerHTML = `<div class="option-label">${labels[idx]}</div><div class="option-content"><div class="opt-lang en">${optionData.en}</div><div class="opt-lang hi">${optionData.hi}</div></div>`;
            
            if (ans) {
                if (mode === 'practice') {
                    if (ans.history && ans.history.includes(key)) {
                        card.classList.add(key === q.correct_option ? 'correct' : 'wrong');
                    } else if (isDisabled && key === q.correct_option) {
                        card.classList.add('correct');
                    }
                } else {
                    if (key === ans.selectedOption) card.classList.add('selected-only');
                }
            }
            if (isDisabled) card.classList.add('disabled');
            else card.addEventListener('click', () => this.selectOption(key));
            container.appendChild(card);
        });
    }

    async fetchScoreboard() {
        const tbody = document.getElementById('scoreboardBody');
        tbody.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center;">Fetching database...</td></tr>';
        try {
            const response = await fetch(`${this.SCRIPT_URL}?action=get&t=${Date.now()}`);
            this.scoreboardData = await response.json();
            this.sortScoreboard('date');
        } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center; color:#dc2626;">Server Connection Error.</td></tr>'; }
    }

    sortScoreboard(key) {
        if (this.sortConfig.key === key) this.sortConfig.asc = !this.sortConfig.asc;
        else { this.sortConfig.key = key; this.sortConfig.asc = (key === 'student' || key === 'chapter'); }

        const headers = document.querySelectorAll('#leaderboardHeaders th');
        headers.forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
        
        const activeHeader = document.querySelector(`#leaderboardHeaders th[data-sort="${key}"]`);
        if (activeHeader) {
            activeHeader.classList.add(this.sortConfig.asc ? 'sort-asc' : 'sort-desc');
        }

        const data = [...this.scoreboardData];
        const asc = this.sortConfig.asc;

        data.sort((a, b) => {
            let valA, valB;
            switch(key) {
                case 'date': valA = new Date(a[0]); valB = new Date(b[0]); break;
                case 'student': valA = a[1].toLowerCase(); valB = b[1].toLowerCase(); break;
                case 'chapter': valA = a[3].toLowerCase(); valB = b[3].toLowerCase(); break;
                case 'mode': valA = a[4].toLowerCase(); valB = b[4].toLowerCase(); break;
                case 'score': valA = parseInt(a[5].split('/')[0]); valB = parseInt(b[5].split('/')[0]); break;
                case 'efficiency': valA = parseFloat(a[6]); valB = parseFloat(b[6]); break;
                default: 
                    valA = parseInt(a[5].split('/')[0]); valB = parseInt(b[5].split('/')[0]);
                    return valB - valA; 
            }
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });

        this.renderScoreboard(data);
    }

    renderScoreboard(data) {
        const tbody = document.getElementById('scoreboardBody');
        tbody.innerHTML = data.slice(0, 50).map((row, index) => {
            let rankDisplay = index + 1; 
            const dateStr = row[0] ? new Date(row[0]).toLocaleDateString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '-';
            const modeClass = row[4] === 'TEST' ? 'tag strict' : 'tag';

            return `
                <tr>
                    <td style="padding:15px; font-weight:bold; font-size:16px;">${rankDisplay}</td>
                    <td style="padding:15px; font-size:12px; color:#64748b;">${dateStr}</td>
                    <td style="padding:15px;">
                        <strong>${row[1]}</strong><br>
                        <span style="font-size:11px; opacity:0.6;">${row[2]}</span>
                    </td>
                    <td style="padding:15px; font-size:13px; font-weight:500;">${row[3]}</td>
                    <td style="padding:15px;"><span class="${modeClass}" style="font-size:10px;">${row[4]}</span></td>
                    <td style="padding:15px; font-weight:800; color:#2563eb;">${row[5]}</td>
                    <td style="padding:15px; font-size:12px;">⏱️ ${row[6]}</td>
                </tr>
            `;
        }).join('');
    }

    async handleDatabaseReset() {
        const input = this.inputAdminPass.value;
        this.adminError.textContent = '';
        if (input !== this.ADMIN_PASSWORD) { this.adminError.textContent = '❌ Incorrect Master Password'; return; }
        if (!confirm("WARNING: Permanent deletion. Proceed?")) return;
        QuizUtils.showLoading(true);
        try {
            await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: 'clear_all_records', password: input }) });
            alert("✅ Database Cleared.");
            this.modalAdmin.classList.remove('active');
            this.inputAdminPass.value = '';
            this.fetchScoreboard();
        } catch (e) { alert("Error."); } finally { QuizUtils.showLoading(false); }
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

    renderQuestionGrid() {
        const grid = document.getElementById('questionGrid'); 
        grid.innerHTML = '';
        if (!this.quizEngine.quizData) return;
        this.quizEngine.quizData.questions.forEach((q, i) => {
            const el = document.createElement('div');
            el.className = `question-number ${this.quizEngine.getQuestionStatus(q.question_id)}`;
            el.dataset.index = i;
            el.dataset.questionId = q.question_id;
            if (i === this.quizEngine.currentQuestionIndex) el.classList.add('current');
            el.innerHTML = `<div class="q-number">${i + 1}</div><div class="marks">${this.quizEngine.getQuestionMarks(q.question_id)?.display || ''}</div>`;
            el.addEventListener('click', () => this.goToQuestion(i));
            grid.appendChild(el);
        });
    }

    showQuestion(i) {
        this.quizEngine.stopTimer(); 
        this.quizEngine.currentQuestionIndex = i;
        const q = this.quizEngine.getCurrentQuestion();
        
        if (!q.question || typeof q.question === 'string') {
            console.error("JSON Error: Question is not bilingual.");
            return;
        }

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

        if (this.quizEngine.isQuestionDisabled(q.question_id) && this.quizEngine.mode === 'practice') this.showFeedbackArea('feedbackContainer');
        if (this.hintUsed[q.question_id]) this.showFeedbackArea('hintArea');
    }

    selectOption(opt) {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.currentAttempts[qId] = (this.currentAttempts[qId] || 0) + 1;
        this.quizEngine.recordAnswer(qId, opt, this.currentAttempts[qId], this.hintUsed[qId]);
        this.showQuestion(this.quizEngine.currentQuestionIndex);
        this.updateScoreDisplay();
        this.updateQuestionInGrid(qId);
    }

    startQuestionTimer(qId) {
        this.quizEngine.startTimer(qId, (t) => {
            document.getElementById('timer').textContent = t;
        }, () => {
            this.showQuestion(this.quizEngine.currentQuestionIndex);
            this.updateQuestionInGrid(qId);
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

    showFeedbackArea(id) { 
        const el = document.getElementById(id);
        if (el) el.style.display = 'block'; 
    }
    
    updateScoreDisplay() { document.getElementById('currentScore').textContent = this.quizEngine.score; }

    updateNavigationButtons() {
        const nextBtn = document.getElementById('nextBtn');
        const isLastQuestion = this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1;
        nextBtn.textContent = isLastQuestion ? '🏁 Finish Assessment' : 'Next Question →';
        nextBtn.disabled = false; 
        document.getElementById('prevBtn').disabled = this.quizEngine.currentQuestionIndex === 0;
    }

    updateQuestionInGrid(questionId) {
        const el = document.querySelector(`.question-number[data-question-id="${questionId}"]`);
        if (!el) return;
        const status = this.quizEngine.getQuestionStatus(questionId);
        const isCurrent = parseInt(el.dataset.index) === this.quizEngine.currentQuestionIndex;
        el.className = `question-number ${status} ${isCurrent ? 'current' : ''}`;
        const marksEl = el.querySelector('.marks');
        if (marksEl) {
            const marksData = this.quizEngine.getQuestionMarks(questionId);
            marksEl.textContent = marksData ? marksData.display : '';
        }
    }

    updateQuestionGrid() {
        if (!this.quizEngine.quizData) return;
        this.quizEngine.quizData.questions.forEach(q => this.updateQuestionInGrid(q.question_id));
    }

    previousQuestion() { 
        this.quizEngine.stopTimer(); 
        this.showQuestion(this.quizEngine.currentQuestionIndex - 1); 
    }

    nextQuestion() { 
        if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) {
            this.completeQuiz(); 
        } else { 
            this.quizEngine.stopTimer(); 
            this.showQuestion(this.quizEngine.currentQuestionIndex + 1); 
        } 
    }

    goToQuestion(i) { 
        if (i === this.quizEngine.currentQuestionIndex) return;
        this.quizEngine.stopTimer(); 
        this.showQuestion(i); 
    }

    quitQuiz() { 
        this.quizEngine.stopTimer(); 
        this.completeQuiz(true); 
    }

    completeQuiz(forced = false) { 
        const res = this.quizEngine.getResults(); 
        if (!forced && res.unattemptedCount > 0) {
            if (!confirm(`Wait! You have ${res.unattemptedCount} unattempted questions.\n\nAre you sure you want to finish?`)) {
                return;
            }
        }

        this.quizEngine.stopTimer();
        QuizUtils.createConfetti(); 
        
        document.getElementById('finalScore').textContent = res.totalScore; 
        document.getElementById('totalPossible').textContent = res.maxScore; 
        document.getElementById('percentage').textContent = res.percentage; 
        document.getElementById('totalTime').textContent = res.timeTaken; 
        
        this.renderResultsBreakdown(res); 
        QuizUtils.showScreen('resultsScreen'); 
        this.submitScore(res); 
    }
    
    renderResultsBreakdown(res) {
        const container = document.getElementById('resultsBreakdown'); container.innerHTML = '';
        res.questions.forEach((q, i) => {
            const ans = res.userAnswers[q.question_id];
            let statusClass = 'wrong'; 
            if (ans && ans.isCorrect) statusClass = 'correct';
            else if (!ans || !ans.finalized) statusClass = 'skipped'; 
            
            const div = document.createElement('div');
            div.className = `result-item ${statusClass}`;
            div.innerHTML = `<div class="result-meta">Q${i+1} • ${ans?.marks || 0} Marks</div><div class="result-question">${q.question.en}</div><div style="font-size:14px; color:#64748b;">Correct: ${q.options[q.correct_option].en}</div>`;
            container.appendChild(div);
        });
    }

    retakeQuiz() { this.quizEngine.clearProgress(); this.startQuiz(); }

    async submitScore(res) {
        if (!this.SCRIPT_URL) return;
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
