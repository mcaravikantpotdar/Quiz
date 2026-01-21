class QuizEngine {
    constructor() {
        this.quizData = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
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
        return this.quizData.questions.length;
    }

    getMaxScore() {
        return this.getTotalQuestions() * 4;
    }

    recordAnswer(questionId, selectedOption, attemptNumber, hintUsed = false) {
        const question = this.quizData.questions.find(q => q.question_id === questionId);
        if (!question) return;

        const isCorrect = selectedOption === question.correct_option;
        let marks = 0;
        let finalAttempts = attemptNumber;

        // --- MANAGE SELECTION HISTORY ---
        // Initialize history if this is the first click for this question
        if (!this.userAnswers[questionId]) {
            this.userAnswers[questionId] = {
                history: [], // Stores all clicked options
                attempts: 0,
                isCorrect: false,
                marks: 0,
                hintUsed: hintUsed
            };
        }

        const currentData = this.userAnswers[questionId];
        
        // Add current selection to history if not already there
        if (!currentData.history.includes(selectedOption)) {
            currentData.history.push(selectedOption);
        }

        if (this.mode === 'test') {
            if (isCorrect) marks = hintUsed ? 2 : 4;
            else marks = 0;
            finalAttempts = 3; 
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
        }

        // --- UPDATE PERSISTENT STATE ---
        currentData.selectedOption = selectedOption; // Last selected
        currentData.attempts = (this.mode === 'test') ? 3 : attemptNumber;
        currentData.isCorrect = isCorrect;
        currentData.marks = marks;
        currentData.hintUsed = hintUsed;
        currentData.answeredAt = new Date().toISOString();
        
        // Flag to prevent UI spoilers until finished
        currentData.isPartial = (this.mode === 'practice' && !isCorrect && attemptNumber < 3);

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
        this.calculateScore();
        this.saveProgress();
    }

    calculateScore() {
        this.score = Object.values(this.userAnswers)
            .filter(ans => !ans.isPartial)
            .reduce((total, answer) => total + answer.marks, 0);
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

    getRemainingAttempts(questionId) {
        const answer = this.userAnswers[questionId];
        if (this.mode === 'test' && answer) return 0;
        return answer ? Math.max(0, 3 - answer.attempts) : 3;
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

    isQuestionAnswered(questionId) {
        const answer = this.userAnswers[questionId];
        return answer && !answer.isPartial;
    }

    initializeQuestionTimer(questionId) {
        if (this.questionTimers[questionId] === undefined) {
            const defaultTime = (this.mode === 'test') ? 40 : 99;
            this.questionTimers[questionId] = defaultTime;
            this.questionTimeSpent[questionId] = 0;
        }
        return this.questionTimers[questionId];
    }

    saveCurrentQuestionTime(questionId, remainingTime) {
        if (questionId && remainingTime >= 0) {
            this.questionTimers[questionId] = remainingTime;
            const maxTime = (this.mode === 'test') ? 40 : 99;
            const timeSpent = maxTime - remainingTime;
            if (timeSpent > 0) {
                this.questionTimeSpent[questionId] = timeSpent;
            }
        }
    }

    startTimer(questionId, onTick, onExpire) {
        this.clearTimer();
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
                this.saveCurrentQuestionTime(questionId, 0);
                this.clearTimer();
                onExpire();
            }
        }, 200);
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.classList.remove('pulse');
        }
    }

    getTimeSpent(questionId) {
        return this.questionTimeSpent[questionId] || 0;
    }

    getTotalTimeSpent() {
        return Object.values(this.questionTimeSpent).reduce((total, time) => total + time, 0);
    }

    saveProgress() {
        const progress = {
            quizData: this.quizData,
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
                if (progress.quizData && progress.quizData.metadata) {
                    this.currentQuestionIndex = progress.currentQuestionIndex || 0;
                    this.userAnswers = progress.userAnswers || {};
                    this.score = progress.score || 0;
                    this.startTime = progress.startTime || new Date().toISOString();
                    this.questionTimers = progress.questionTimers || {};
                    this.questionTimeSpent = progress.questionTimeSpent || {};
                    this.mode = progress.mode || 'practice';
                    return true;
                }
            } catch (e) {
                console.error('Error loading progress:', e);
            }
        }
        this.startTime = new Date().toISOString();
        this.questionTimers = {};
        this.questionTimeSpent = {};
        return false;
    }

    clearProgress() {
        localStorage.removeItem('quizProgress');
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.score = 0;
        this.startTime = new Date().toISOString();
        this.questionTimers = {};
        this.questionTimeSpent = {};
    }

    getResults() {
        const endTime = new Date();
        const startTime = new Date(this.startTime);
        const totalTimeTaken = Math.round((endTime - startTime) / 1000);

        return {
            totalScore: this.score,
            maxScore: this.getMaxScore(),
            percentage: Math.round((this.score / this.getMaxScore()) * 100),
            timeTaken: Math.round(totalTimeTaken / 60),
            timeTakenSeconds: totalTimeTaken,
            userAnswers: this.userAnswers,
            questions: this.quizData.questions,
            metadata: this.quizData.metadata,
            questionTimeSpent: this.questionTimeSpent,
            totalTimeSpent: this.getTotalTimeSpent(),
            mode: this.mode
        };
    }
}
