class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        this.selectedQuizFile = null;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.renderQuizLibrary();
    }

    cacheDOM() {
        this.btnStart = document.getElementById('startQuiz');
        this.inputName = document.getElementById('studentName');
        this.inputSchool = document.getElementById('schoolName');
        this.quizListContainer = document.getElementById('quizList');
        this.errorMsg = document.getElementById('errorMessage');
    }

    bindEvents() {
        // Validation for the Start Learning button
        const validate = () => {
            const nameVal = this.inputName.value.trim();
            const schoolVal = this.inputSchool.value.trim();
            this.btnStart.disabled = !(nameVal && schoolVal && this.selectedQuizFile);
        };

        this.inputName.addEventListener('input', validate);
        this.inputSchool.addEventListener('input', validate);

        this.btnStart.addEventListener('click', () => this.handleStart());
        
        // Modal Event Listeners
        document.getElementById('quitBtn').addEventListener('click', () => {
            document.getElementById('quitModal').classList.add('active');
        });
        document.getElementById('cancelQuit').addEventListener('click', () => {
            document.getElementById('quitModal').classList.remove('active');
        });
        document.getElementById('confirmQuit').addEventListener('click', () => {
            window.location.reload();
        });
    }

    renderQuizLibrary() {
        const chapters = [
            { name: "💻 HTML Challenge", file: "coding-challenge-html.json" },
            { name: "💻 JS Challenge", file: "coding-challenge-js.json" },
            { name: "💻 PHP Challenge", file: "coding-challenge-php.json" },
            { name: "💻 PL/SQL Challenge", file: "coding-challenge-plsql.json" }
        ];

        this.quizListContainer.innerHTML = '';
        chapters.forEach(ch => {
            const item = document.createElement('div');
            item.className = 'quiz-btn-item';
            item.textContent = ch.name;
            item.onclick = () => {
                this.selectedQuizFile = ch.file;
                document.querySelectorAll('.quiz-btn-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.inputName.dispatchEvent(new Event('input')); // Re-validate
            };
            this.quizListContainer.appendChild(item);
        });
    }

    async handleStart() {
        this.errorMsg.textContent = "";
        try {
            // Path check for jsons folder
            const response = await fetch(`jsons/${this.selectedQuizFile}`);
            if (!response.ok) throw new Error("Lesson file not found.");
            
            const data = await response.json();
            this.quizEngine.loadQuizData(data);
            
            // Activate Screen
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('quizScreen').classList.add('active');
            
            this.showQuestion(0);
        } catch (err) {
            this.errorMsg.textContent = "Load Error: " + err.message;
        }
    }
}

window.onload = () => { window.app = new QuizApp(); };
