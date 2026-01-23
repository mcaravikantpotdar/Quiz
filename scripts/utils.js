class QuizUtils {
    
    // --- UI UTILITIES ---

    /**
     * Handles the visibility of the loading spinner.
     */
    static showLoading(show = true) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            if (show) spinner.classList.add('active');
            else spinner.classList.remove('active');
        }
    }

    /**
     * Swaps between different application screens and resets scroll position.
     */
    static showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none'; // Force hide to prevent layout jumps
        });

        // Show target screen
        const target = document.getElementById(screenId);
        if (target) {
            target.style.display = 'block';
            // Small delay to allow display:block to apply before adding class for animation
            setTimeout(() => target.classList.add('active'), 10);
            
            // EXPERT UPGRADE: Auto-scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Visual celebration effect for quiz completion.
     * Optimized to be self-contained (no external CSS dependencies needed for animation).
     */
    static createConfetti() {
        const colors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#7c3aed'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            // Inline styles to ensure it works without extra CSS
            confetti.style.position = 'fixed';
            confetti.style.zIndex = '9999';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = Math.random() * 10 + 5 + 'px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = '50%';
            confetti.style.opacity = Math.random() + 0.5;
            
            document.body.appendChild(confetti);

            // Physics Animation
            const animationDuration = Math.random() * 2 + 1.5; // 1.5s - 3.5s
            
            confetti.animate([
                { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
                { transform: `translate(${Math.random() * 200 - 100}px, 100vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
            ], {
                duration: animationDuration * 1000,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            });

            // Cleanup
            setTimeout(() => confetti.remove(), animationDuration * 1000);
        }
    }

    // --- TIME FORMATTING ---

    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // --- DATA VALIDATION (ROBUST BILINGUAL CHECK) ---

    static validateQuizJSON(data) {
        const errors = [];
        
        if (!data) return { isValid: false, errors: ['JSON data is null'] };

        // 1. Metadata Check
        if (!data.metadata) {
            errors.push("Missing 'metadata' object");
        } else if (!data.metadata.chapter_title) {
            errors.push("Missing 'chapter_title' in metadata");
        }

        // 2. Questions Array Check
        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            errors.push("Missing or empty 'questions' array");
        } else {
            // 3. Deep Validation of Each Question
            data.questions.forEach((q, i) => {
                const qNum = i + 1;
                
                if (!q.question_id) errors.push(`Q${qNum} missing 'question_id'`);
                
                // Bilingual Text Check
                if (!q.question || !q.question.en || !q.question.hi) {
                    errors.push(`Q${qNum} missing English or Hindi question text`);
                }

                // Options Check
                if (!q.options) {
                    errors.push(`Q${qNum} missing options`);
                } else {
                    ['a', 'b', 'c', 'd'].forEach(opt => {
                        if (!q.options[opt]) errors.push(`Q${qNum} missing Option ${opt.toUpperCase()}`);
                        else if (!q.options[opt].en || !q.options[opt].hi) {
                            errors.push(`Q${qNum} Option ${opt.toUpperCase()} incomplete (needs en & hi)`);
                        }
                    });
                }

                if (!q.correct_option) errors.push(`Q${qNum} missing 'correct_option'`);

                // Feedback Check
                ['hint', 'explanation', 'key_takeaway'].forEach(field => {
                    if (q[field] && (!q[field].en || !q[field].hi)) {
                        errors.push(`Q${qNum} '${field}' exists but is missing language keys`);
                    }
                });
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Helper to generate a template (Preserved from your original code)
    static getSampleJSON() {
        return {
            "metadata": { "chapter_title": "Sample", "total_questions": 1 },
            "questions": [{
                "question_id": "q1",
                "question": { "en": "Test?", "hi": "Test?" },
                "options": {
                    "a": { "en": "A", "hi": "A" },
                    "b": { "en": "B", "hi": "B" },
                    "c": { "en": "C", "hi": "C" },
                    "d": { "en": "D", "hi": "D" }
                },
                "correct_option": "a",
                "hint": { "en": "Hint", "hi": "Hint" },
                "explanation": { "en": "Exp", "hi": "Exp" },
                "key_takeaway": { "en": "Key", "hi": "Key" }
            }]
        };
    }
}
