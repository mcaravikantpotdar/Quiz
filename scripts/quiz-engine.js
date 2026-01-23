class QuizEngine {
    constructor() {
        this.quizData = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = {}; // { qId: { history, attempts, isCorrect, marks, hintUsed, finalized } }
        this.score = 0;
        this.startTime = null;
        this.timer = null;
        this.currentTimer = 99;
        this.mode = 'practice'; 
        this.questionTimers = {};
        this.questionTimeSpent = {};
        this.currentQuestionId = null;
    }

    setMode(mode) {
        this.mode = mode;
    }

    loadQuizData(data) {
        const validation = QuizUtils.validateQuizJSON(data);
        if (!validation.isValid) {
            throw new Error(`Invalid JSON: ${validation.errors.join(', ')}`);
        }
        this.quizData = data;
        this.loadProgress();
    }

    getCurrentQuestion() {
        return this.quizData.questions[this.currentQuestionIndex];
    }

    getTotalQuestions() {
        return this.quizData ? this.quizData.questions.length : 0;
    }

    getMaxScore() {
        return this.getTotalQuestions() * 4;
    }

    // --- ENHANCED SCORING & ATOMIC STOP ---
    recordAnswer(questionId, selectedOption, attemptNumber, hintUsed = false) {
        const question = this.quizData.questions.find(q => q.question_id === questionId);
        if (!question) return;

        const isCorrect = selectedOption === question.correct_option;
        let marks = 0;

        if (!this.userAnswers[questionId]) {
            this.userAnswers[questionId] = {
                history: [],
                attempts: 0,
                isCorrect: false,
                marks: 0,
                hintUsed: hintUsed
            };
        }

        const currentData = this.userAnswers[questionId];
        
        if (!currentData.history.includes(selectedOption)) {
            currentData.history.push(selectedOption);
        }

        if (this.mode === 'test') {
            if (isCorrect) marks = hintUsed ? 2 : 4;
            else marks = 0;
            currentData.attempts = 3; // Lock question
        } else {
            if (isCorrect) {
                switch (attemptNumber) {
                    case 1: marks = hintUsed ? 3 : 4; break;
                    case 2: marks = hintUsed ? 2 : 3; break;
                    case 3: marks = hintUsed ? 1 : 2; break;
                }
            } else if (attemptNumber === 3) {
                marks = hintUsed ? 0 : 1;
            } else {
                marks = 0;
            }
            currentData.attempts = attemptNumber;
        }

        currentData.selectedOption = selectedOption;
        currentData.isCorrect = isCorrect;
        currentData.marks = marks;
        currentData.hintUsed = hintUsed;
        currentData.answeredAt = new Date().toISOString();
        
        // Finalize check
        const finalized = (isCorrect || currentData.attempts >= 3);
        currentData.isPartial = !finalized;

        if (finalized) {
            this.clearTimer(); // ATOMIC STOP: Kill the zombie pulse immediately
        }

        this.calculateScore();
        this.saveProgress();
        return { isCorrect, marks };
    }

    recordTimeout(questionId, hintUsed = false) {
        this.userAnswers[questionId] = {
            selectedOption: null,
            history: [],
            attempts: 3,
            isCorrect: false,
            marks: 0,
            hintUsed: hintUsed,
            answeredAt: new Date().toISOString(),
            isTimeout: true,
            isPartial: false
        };
        this.clearTimer();
        this.calculateScore();
        this.saveProgress();
    }

    calculateScore() {
        this.score = Object.values(this.userAnswers)
            .filter(ans => !ans.isPartial)
            .reduce((total, answer) => total + answer.marks, 0);
    }

    // --- TIMER LOGIC (WITH PAUSE/RESUME FIX) ---
    initializeQuestionTimer(questionId) {
        if (this.questionTimers[questionId] === undefined) {
            const defaultTime = (this.mode === 'test') ? 40 : 99;
            this.questionTimers[questionId] = defaultTime;
            this.questionTimeSpent[questionId] = 0;
        }
        return this.questionTimers[questionId];
    }

    startTimer(questionId, onTick, onExpire) {
        // Prevent starting timer on locked questions
        if (this.isQuestionDisabled(questionId)) {
            onTick(this.questionTimers[questionId] || 0);
            return;
        }

        this.clearTimer(); // Reset existing
        const startSeconds = this.initializeQuestionTimer(questionId);
        this.currentTimer = startSeconds;
        this.currentQuestionId = questionId;

        const endTime = Date.now() + (startSeconds * 1000);
        onTick(this.currentTimer);

        this.timer = setInterval(() => {
            const now = Date.now();
            const distance = endTime - now;
            const remainingSeconds = Math.ceil(distance / 1000);
            
            this.currentTimer = remainingSeconds;
            const timerEl = document.getElementById('timer');
            const pulseThreshold = (this.mode === 'test') ? 10 : 49;

            if (this.currentTimer <= pulseThreshold && timerEl) {
                timerEl.classList.add('pulse');
            }

            if (this.currentTimer >= 0) {
                onTick(this.currentTimer);
            }

            if (this.currentTimer <= 0) {
                this.recordTimeout(questionId, this.userAnswers[questionId]?.hintUsed);
                onExpire();
            }
        }, 200);
    }

    clearTimer() {
        // FIX: Before clearing, save the current state for Free-Roam Resume
        if (this.currentQuestionId && this.currentTimer >= 0) {
            this.questionTimers[this.currentQuestionId] = this.currentTimer;
            const maxTime = (this.mode === 'test') ? 40 : 99;
            this.questionTimeSpent[this.currentQuestionId] = maxTime - this.currentTimer;
        }

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.classList.remove('pulse');
        }
    }

    // --- RESULTS & PERSISTENCE ---
    getTotalTimeSpent() {
        return Object.values(this.questionTimeSpent).reduce((total, time) => total + time, 0);
    }

    getQuestionStatus(questionId) {
        const answer = this.userAnswers[questionId];
        if (!answer) return 'unanswered';
        if (answer.isCorrect) return 'correct';
        if (answer.attempts >= 3 && !answer.isCorrect) return 'wrong';
        return 'attempted';
    }

    isQuestionDisabled(questionId) {
        const answer = this.userAnswers[questionId];
        return answer && !answer.isPartial && (answer.isCorrect || answer.attempts >= 3);
    }

    getQuestionMarks(questionId) {
        const answer = this.userAnswers[questionId];
        if (!answer || answer.isPartial) return null;
        return {
            obtained: answer.marks,
            max: 4,
            display: `${answer.marks}/4`
        };
    }

    saveProgress() {
        const progress = {
            currentQuestionIndex: this.currentQuestionIndex,
            userAnswers: this.userAnswers,
            score: this.score,
            startTime: this.startTime,
            questionTimers: this.questionTimers,
            questionTimeSpent: this.questionTimeSpent,
            mode: this.mode
        };
        localStorage.setItem('quizProgress', JSON.stringify(progress));
    }

    loadProgress() {
        const saved = localStorage.getItem('quizProgress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                this.currentQuestionIndex = progress.currentQuestionIndex || 0;
                this.userAnswers = progress.userAnswers || {};
                this.score = progress.score || 0;
                this.startTime = progress.startTime || new Date().toISOString();
                this.questionTimers = progress.questionTimers || {};
                this.questionTimeSpent = progress.questionTimeSpent || {};
                this.mode = progress.mode || 'practice';
                return true;
            } catch (e) {
                console.error('Save Corrupted:', e);
            }
        }
        this.startTime = new Date().toISOString();
        return false;
    }

    clearProgress() {
        localStorage.removeItem('quizProgress');
        this.stopProgressState();
    }

    stopProgressState() {
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.score = 0;
        this.startTime = new Date().toISOString();
        this.questionTimers = {};
        this.questionTimeSpent = {};
        this.clearTimer();
    }

    getResults() {
        // Efficiency calculation based on active time spent, not wall clock
        const totalActiveSeconds = this.getTotalTimeSpent();
        const mins = Math.floor(totalActiveSeconds / 60);
        const secs = totalActiveSeconds % 60;
        const formattedEfficiency = `${mins}:${secs.toString().padStart(2, '0')}`;

        return {
            totalScore: this.score,
            maxScore: this.getMaxScore(),
            percentage: Math.round((this.score / this.getMaxScore()) * 100),
            timeTaken: formattedEfficiency, // This is the "Efficiency" for the leaderboard
            timeTakenSeconds: totalActiveSeconds,
            userAnswers: this.userAnswers,
            questions: this.quizData.questions,
            unattemptedCount: this.quizData.questions.length - Object.keys(this.userAnswers).filter(id => !this.userAnswers[id].isPartial).length,
            mode: this.mode
        };
    }
}
