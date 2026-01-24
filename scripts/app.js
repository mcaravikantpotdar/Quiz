class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxt-akN_S5Dmr3HdtxpEL9by9J80kmZYCufXI1e9_fK3Ep0QYomPU-6jF-3ryPq7Q/exec";
        this.ADMIN_PASSWORD = "Admin@2026"; 
        this.GITHUB_CONFIG = { owner: "mcaravikantpotdar", repo: "Quiz", path: "jsons" };
        this.currentAttempts = {}; this.hintUsed = {}; this.shuffledOrders = {}; 
        this.selectedQuizFile = null; this.availableQuizzes = []; 
        this.scoreboardData = []; this.sortConfig = { key: 'date', asc: false };
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
            if (response.status === 404) throw new Error("Folder 'jsons' not found.");
            if (!response.ok) throw new Error(`GitHub Error: ${response.status}`);
            const files = await response.json();
            if (!Array.isArray(files)) throw new Error("Invalid library format.");
            this.availableQuizzes = files.filter(f => f.name.toLowerCase().endsWith('.json')).map(f => {
                const clean = f.name.replace('.json', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return { name: `📂 ${clean}`, file: f.name };
            });
            if (this.availableQuizzes.length === 0) this.quizListContainer.innerHTML = '<p style="padding:10px; opacity:0.5;">No Quizzes Found.</p>';
            else this.renderQuizLibrary();
        } catch (error) {
            this.quizListContainer.innerHTML = `<p style="color:#ef4444; font-size:12px; padding:10px;">⚠️ Library Error: ${error.message}</p>`;
        }
    }

    cacheDOM() {
        // FIX: Full list of all required IDs to prevent the blank screen crash
        const ids = [
            'studentName', 'schoolName', 'quizList', 'startQuiz', 'viewScoreboardBtn', 
            'viewScoreboardFromResults', 'backFromScoreboard', 'topHomeBtn', 'topQuitBtn', 
            'nextBtn', 'prevBtn', 'hintBtn', 'quitBtn', 'confirmQuit', 'cancelQuit', 
            'retakeBtn', 'homeBtn', 'adminGear', 'adminModal', 'adminPassword', 
            'confirmReset', 'closeAdmin', 'adminError', 'quitModal', 'errorMessage',
            'optionsContainer', 'questionGrid', 'questionEn', 'questionHi'
        ];
        ids.forEach(id => { 
            const el = document.getElementById(id);
            if (!el) console.warn(`Missing DOM ID: ${id}`);
            this[id] = el; 
        });
        this.quizListContainer = this.quizList;
        this.errorDiv = this.errorMessage;
    }

    bindEvents() {
        this.studentName.addEventListener('input', () => this.validateStartForm());
        this.schoolName.addEventListener('input', () => this.validateStartForm());
        this.startQuiz.addEventListener('click', () => this.handleStart());
        
        const showScore = () => { QuizUtils.showScreen('scoreboardScreen'); this.fetchScoreboard(); };
        this.viewScoreboardBtn.addEventListener('click', showScore);
        if(this.viewScoreboardFromResults) this.viewScoreboardFromResults.addEventListener('click', showScore);
        
        this.backFromScoreboard.addEventListener('click', () => {
            if (this.quizEngine.quizData) QuizUtils.showScreen('quizScreen');
            else QuizUtils.showScreen('uploadScreen');
        });

        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.topHomeBtn.addEventListener('click', () => window.location.reload());
        this.hintBtn.addEventListener('click', () => this.showHint());
        
        const openQuit = () => this.quitModal.classList.add('active');
        this.quitBtn.addEventListener('click', openQuit);
        this.topQuitBtn.addEventListener('click', openQuit);
        
        this.cancelQuit.addEventListener('click', () => this.quitModal.classList.remove('active'));
        this.confirmQuit.addEventListener('click', () => this.quitQuiz());
        this.retakeBtn.addEventListener('click', () => this.retakeQuiz());
        this.homeBtn.addEventListener('click', () => window.location.reload());
        this.adminGear.addEventListener('click', () => this.adminModal.classList.add('active'));
        this.closeAdmin.addEventListener('click', () => this.adminModal.classList.remove('active'));
        
        this.adminPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleDatabaseReset(); });
        this.confirmReset.addEventListener('click', () => this.handleDatabaseReset());
    }

    renderQuizLibrary() {
        this.quizListContainer.innerHTML = '';
        this.availableQuizzes.forEach(q => {
            const btn = document.createElement('div');
            btn.className = 'quiz-btn'; btn.textContent = q.name;
            btn.onclick = () => {
                document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected'); this.selectedQuizFile = q.file; this.validateStartForm();
            };
            this.quizListContainer.appendChild(btn);
        });
    }

    validateStartForm() {
        const ok = this.studentName.value.trim() && this.schoolName.value.trim() && this.selectedQuizFile;
        this.startQuiz.disabled = !ok;
    }

    async handleStart() {
        QuizUtils.showLoading(true);
        try {
            const r = await fetch(`jsons/${this.selectedQuizFile}?t=${Date.now()}`);
            const data = await r.json();
            this.quizEngine.loadQuizData(data);
            this.startActualQuiz();
        } catch (e) { this.errorDiv.textContent = e.message; }
        finally { QuizUtils.showLoading(false); }
    }

    startActualQuiz() {
        const modeInput = document.querySelector('input[name="quizMode"]:checked');
        const mode = modeInput ? modeInput.value : 'practice';
        this.quizEngine.setMode(mode);
        
        Object.keys(this.quizEngine.userAnswers).forEach(id => { 
            if (this.quizEngine.userAnswers[id].hintUsed) this.hintUsed[id] = true; 
        });

        document.getElementById('chapterTitle').textContent = this.quizEngine.quizData.metadata.chapter_title;
        document.getElementById('totalQuestions').textContent = this.quizEngine.getTotalQuestions();
        
        this.updateHeaderIdentity();
        QuizUtils.showScreen('quizScreen');
        this.renderQuestionGrid();
        this.showQuestion(this.quizEngine.currentQuestionIndex);
    }

    updateHeaderIdentity() {
        const old = document.getElementById('identityBar'); if(old) old.remove();
        const html = `<div id="identityBar"><div class="id-student-info"><div class="id-name">👤 ${this.studentName.value}</div><div class="id-school">${this.schoolName.value}</div></div><div class="stat-badge ${this.quizEngine.mode === 'test' ? 'strict' : ''}">${this.quizEngine.mode.toUpperCase()} MODE</div></div>`;
        const temp = document.createElement('div'); temp.innerHTML = html.trim();
        document.querySelector('.quiz-header').prepend(temp.firstChild);
    }

    showQuestion(i) {
        this.quizEngine.stopTimer(); 
        this.quizEngine.currentQuestionIndex = i;
        const q = this.quizEngine.getCurrentQuestion();
        
        this.questionEn.innerHTML = q.question.en;
        this.questionHi.innerHTML = q.question.hi;
        document.getElementById('currentQuestion').textContent = i + 1;
        
        this.renderOptions(q);
        
        document.querySelectorAll('#feedbackContainer, #hintArea').forEach(el => el.remove());
        const fb = `<div id="feedbackContainer" style="display:none;"><div class="feedback-area explanation-area"><h4>✅ Explanation</h4><div>${q.explanation.en}</div><div style="margin-top:5px; opacity:0.8;">${q.explanation.hi}</div></div><div class="key-takeaway-area"><h4>🔑 Key Takeaway</h4><div>${q.key_takeaway.en}</div><div style="margin-top:5px; opacity:0.8;">${q.key_takeaway.hi}</div></div></div><div id="hintArea" class="feedback-area hint-area" style="display:none;"><h4>💡 Hint</h4><div>${q.hint.en}</div><div style="margin-top:5px; opacity:0.8;">${q.hint.hi}</div></div>`;
        this.optionsContainer.insertAdjacentHTML('afterend', fb);
        
        this.updateQuestionGrid(); 
        this.updateNavigation(); 
        
        this.quizEngine.startTimer(q.question_id, (t) => { 
            document.getElementById('timer').textContent = t; 
        }, () => this.showQuestion(i));

        if (this.quizEngine.isQuestionDisabled(q.question_id) && this.quizEngine.mode === 'practice') {
            document.getElementById('feedbackContainer').style.display = 'block';
        }
        if (this.hintUsed[q.question_id]) {
            document.getElementById('hintArea').style.display = 'block';
        }
        this.hintBtn.disabled = this.quizEngine.isQuestionDisabled(q.question_id) || this.hintUsed[q.question_id];
    }

    renderOptions(q) {
        this.optionsContainer.innerHTML = '';
        const order = this.getShuffledOptions(q);
        const ans = this.quizEngine.userAnswers[q.question_id];
        
        order.forEach((key, idx) => {
            const card = document.createElement('div'); card.className = 'option-card';
            const data = q.options[key];
            card.innerHTML = `<div class="option-label">${['A','B','C','D'][idx]}</div><div class="option-content"><div class="opt-lang en">${data.en}</div><div class="opt-lang hi">${data.hi}</div></div>`;
            
            if (ans) {
                if (this.quizEngine.mode === 'practice') {
                    if (ans.history.includes(key)) card.classList.add(key === q.correct_option ? 'correct' : 'wrong');
                    else if (this.quizEngine.isQuestionDisabled(q.question_id) && key === q.correct_option) card.classList.add('correct');
                } else if (key === ans.selectedOption) card.classList.add('selected-only');
            }
            if (this.quizEngine.isQuestionDisabled(q.question_id)) card.classList.add('disabled');
            else card.onclick = () => this.selectOption(key);
            this.optionsContainer.appendChild(card);
        });
    }

    selectOption(opt) {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.currentAttempts[qId] = (this.currentAttempts[qId] || 0) + 1;
        this.quizEngine.recordAnswer(qId, opt, this.currentAttempts[qId], this.hintUsed[qId]);
        this.showQuestion(this.quizEngine.currentQuestionIndex);
        document.getElementById('currentScore').textContent = this.quizEngine.score;
    }

    showHint() {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.hintUsed[qId] = true; 
        document.getElementById('hintArea').style.display = 'block'; 
        this.hintBtn.disabled = true;
    }

    updateNavigation() {
        const isLast = this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1;
        this.nextBtn.textContent = isLast ? '🏁 Finish' : 'Next →';
        this.prevBtn.disabled = this.quizEngine.currentQuestionIndex === 0;
    }

    renderQuestionGrid() {
        this.questionGrid.innerHTML = '';
        this.quizEngine.quizData.questions.forEach((q, i) => {
            const el = document.createElement('div');
            el.className = `question-number ${this.quizEngine.getQuestionStatus(q.question_id)}`;
            if (i === this.quizEngine.currentQuestionIndex) el.classList.add('current');
            const marks = this.quizEngine.getQuestionMarks(q.question_id);
            el.innerHTML = `<div class="q-number">${i + 1}</div><div class="marks">${marks ? marks.display : ''}</div>`;
            el.onclick = () => { if (i !== this.quizEngine.currentQuestionIndex) this.showQuestion(i); };
            this.questionGrid.appendChild(el);
        });
    }

    updateQuestionGrid() { this.renderQuestionGrid(); }

    previousQuestion() { this.showQuestion(this.quizEngine.currentQuestionIndex - 1); }
    nextQuestion() { 
        if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) this.completeQuiz();
        else this.showQuestion(this.quizEngine.currentQuestionIndex + 1); 
    }
    quitQuiz() { this.completeQuiz(true); }

    completeQuiz(forced = false) { 
        const res = this.quizEngine.getResults(); 
        if (!forced && res.unattemptedCount > 0) { if (!confirm(`Finish with ${res.unattemptedCount} unattempted questions?`)) return; }
        this.quizEngine.stopTimer(); QuizUtils.createConfetti(); 
        document.getElementById('finalScore').textContent = res.totalScore; 
        document.getElementById('totalPossible').textContent = res.maxScore; 
        document.getElementById('percentage').textContent = res.percentage + '%'; 
        document.getElementById('totalTime').textContent = res.timeTaken; 
        this.renderResultsBreakdown(res); QuizUtils.showScreen('resultsScreen'); this.submitScore(res); 
    }

    renderResultsBreakdown(res) {
        this.resultsBreakdown = document.getElementById('resultsBreakdown');
        this.resultsBreakdown.innerHTML = res.questions.map((q, i) => {
            const a = res.userAnswers[q.question_id];
            const status = (a && a.isCorrect) ? 'correct' : ((!a || a.isPartial) ? 'skipped' : 'wrong');
            return `<div class="result-item ${status}"><div class="result-meta">Q${i+1} • ${a?.marks || 0} Marks</div><div class="result-question">${q.question.en}</div><div style="font-size:13px; color:#64748b;">Answer: ${q.options[q.correct_option].en}</div></div>`;
        }).join('');
    }

    getShuffledOptions(q) {
        if (this.shuffledOrders[q.question_id]) return this.shuffledOrders[q.question_id];
        let o = ['a', 'b', 'c', 'd'];
        if (!JSON.stringify(q.options).toLowerCase().match(/both|all of|none of/)) {
            for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
        }
        this.shuffledOrders[q.question_id] = o; return o;
    }

    async fetchScoreboard() {
        const b = document.getElementById('scoreboardBody'); b.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center;">Syncing...</td></tr>';
        try {
            const r = await fetch(`${this.SCRIPT_URL}?action=get&t=${Date.now()}`);
            this.scoreboardData = await r.json(); this.sortScoreboard('date');
        } catch (e) { b.innerHTML = '<tr><td colspan="7" style="color:#ef4444; text-align:center;">Server Error.</td></tr>'; }
    }

    sortScoreboard(key) {
        if (this.sortConfig.key === key) this.sortConfig.asc = !this.sortConfig.asc;
        else { this.sortConfig.key = key; this.sortConfig.asc = (key === 'student' || key === 'chapter'); }
        const data = [...this.scoreboardData];
        data.sort((a, b) => {
            let vA, vB;
            if (key === 'date') { vA = new Date(a[0]); vB = new Date(b[0]); }
            else if (key === 'score') { vA = parseInt(a[5].split('/')[0]); vB = parseInt(b[5].split('/')[0]); }
            else if (key === 'efficiency') { vA = parseFloat(a[6]); vB = parseFloat(b[6]); }
            else { vA = a[key === 'student' ? 1 : 3].toLowerCase(); vB = b[key === 'student' ? 1 : 3].toLowerCase(); }
            return this.sortConfig.asc ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1);
        });
        document.getElementById('scoreboardBody').innerHTML = data.slice(0, 50).map((r, i) => `<tr><td style="padding:15px; font-weight:bold;">${i+1}</td><td style="padding:15px; font-size:12px;">${r[0] ? new Date(r[0]).toLocaleDateString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '-'}</td><td style="padding:15px;"><strong>${r[1]}</strong><br><small>${r[2]}</small></td><td style="padding:15px; font-size:13px;">${r[3]}</td><td style="padding:15px;"><span class="tag ${r[4] === 'TEST' ? 'strict' : ''}">${r[4]}</span></td><td style="padding:15px; font-weight:800; color:#2563eb;">${r[5]}</td><td style="padding:15px; font-size:12px;">⏱️ ${r[6]}</td></tr>`).join('');
    }

    async handleDatabaseReset() {
        if (this.adminPassword.value !== this.ADMIN_PASSWORD) { this.adminError.textContent = '❌ Incorrect Password'; return; }
        if (!confirm("Erase all records?")) return;
        QuizUtils.showLoading(true);
        try {
            await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: 'clear_all_records', password: this.adminPassword.value }) });
            alert("✅ Reset Complete."); this.adminModal.classList.remove('active'); this.fetchScoreboard();
        } catch (e) { alert("Error."); } finally { QuizUtils.showLoading(false); }
    }

    async submitScore(res) {
        const p = { action: 'submit', studentName: this.studentName.value, schoolName: this.schoolName.value, quizTitle: this.quizEngine.quizData.metadata.chapter_title, mode: this.quizEngine.mode.toUpperCase(), score: `${res.totalScore}/${res.maxScore}`, timeTaken: res.timeTaken };
        try { await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(p) }); } catch (e) { }
    }
}
document.addEventListener('DOMContentLoaded', () => { window.app = new QuizApp(); });
