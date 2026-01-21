class QuizUtils {
    // --- UI UTILITIES ---
    
    /**
     * Handles the visibility of the loading spinner.
     * Updated to ensure compatibility with your .spinner CSS class.
     */
    static showLoading(show = true) {
        // Look for the spinner by ID first, then fallback to class if necessary
        const spinner = document.getElementById('loadingSpinner') || document.querySelector('.spinner');
        if (spinner) {
            spinner.classList.toggle('active', show);
        }
    }

    /**
     * Swaps between different application screens.
     */
    static showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
        }
    }

    /**
     * Visual celebration effect for quiz completion.
     */
    static createConfetti() {
        const colors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#059669'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 2 + 's';
            document.body.appendChild(confetti);
            
            // Clean up DOM to prevent memory leaks
            setTimeout(() => confetti.remove(), 3000);
        }
    }

    // --- TIME FORMATTING ---

    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    static formatTimeSpent(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }

    // --- DATA VALIDATION ---

    /**
     * Deep inspection of Quiz JSON structure.
     * Prevents runtime errors by catching missing bilingual keys early.
     */
    static validateQuizJSON(data) {
        const errors = [];
        
        if (!data) return { isValid: false, errors: ['JSON data is null or undefined'] };
        if (!data.metadata) errors.push('Missing metadata object');
        if (!data.questions || !Array.isArray(data.questions)) {
            errors.push('Missing or invalid questions array');
        }

        if (data.questions && Array.isArray(data.questions)) {
            data.questions.forEach((q, index) => {
                const qNum = index + 1;
                
                // 1. Structural Checks
                if (!q.question_id) errors.push(`Q${qNum}: Missing question_id`);
                if (!q.question || !q.question.en || !q.question.hi) {
                    errors.push(`Q${qNum}: Missing question text in English or Hindi`);
                }
                
                // 2. Options Validation (Deep Check)
                if (!q.options) {
                    errors.push(`Q${qNum}: Missing options object`);
                } else {
                    ['a', 'b', 'c', 'd'].forEach(opt => {
                        if (!q.options[opt] || !q.options[opt].en || !q.options[opt].hi) {
                            errors.push(`Q${qNum}: Option ${opt.toUpperCase()} is missing English or Hindi text`);
                        }
                    });
                }

                if (!q.correct_option || !['a','b','c','d'].includes(q.correct_option)) {
                    errors.push(`Q${qNum}: Missing or invalid correct_option (must be a, b, c, or d)`);
                }

                // 3. Pedagogical Field Checks (Bilingual Requirement)
                const pedagogicalFields = ['hint', 'explanation', 'key_takeaway'];
                pedagogicalFields.forEach(field => {
                    if (!q[field] || !q[field].en || !q[field].hi) {
                        errors.push(`Q${qNum}: Missing ${field.replace('_', ' ')} text in English or Hindi`);
                    }
                });
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Provides the Master Specification Template for new JSON creation.
     */
    static getSampleJSON() {
        return {
            "metadata": {
                "chapter_title": "Sample Chapter",
                "chapter_title_hindi": "नमूना अध्याय",
                "total_questions": 1,
                "max_score": 4
            },
            "questions": [
                {
                    "question_id": "sample_01",
                    "question": {
                        "en": "What is 2 + 2?",
                        "hi": "2 + 2 क्या है?"
                    },
                    "options": {
                        "a": {"en": "3", "hi": "3"},
                        "b": {"en": "4", "hi": "4"},
                        "c": {"en": "5", "hi": "5"},
                        "d": {"en": "6", "hi": "6"}
                    },
                    "correct_option": "b",
                    "hint": {
                        "en": "Basic math.",
                        "hi": "बुनियादी गणित।"
                    },
                    "explanation": {
                        "en": "2 + 2 equals 4.",
                        "hi": "2 + 2 बराबर 4 होता है।"
                    },
                    "key_takeaway": {
                        "en": "Addition results in a sum.",
                        "hi": "जोड़ का परिणाम योग होता है।"
                    }
                }
            ]
        };
    }
}
