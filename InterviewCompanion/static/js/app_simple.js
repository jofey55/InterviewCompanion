class InterviewAssistant {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.answerCount = 0;
        
        this.initializeElements();
        this.initializeSocket();
        this.bindEvents();
    }
    
    initializeElements() {
        // Control buttons
        this.sendQuestionBtn = document.getElementById('send-question-btn');
        this.clearAnswersBtn = document.getElementById('clear-answers-btn');
        this.clearQuestionBtn = document.getElementById('clear-question-btn');
        
        // Display areas
        this.answersArea = document.getElementById('answers-area');
        this.connectionStatus = document.getElementById('connection-status');
        
        // Input elements
        this.manualQuestionInput = document.getElementById('manual-question');
        
        // Sample question buttons
        this.sampleQuestionBtns = document.querySelectorAll('.sample-question');
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.sendQuestionBtn.disabled = false;
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.sendQuestionBtn.disabled = true;
            console.log('Disconnected from server');
        });
        
        this.socket.on('status_update', (data) => {
            console.log('Status update:', data.message);
        });
        
        this.socket.on('answer_received', (data) => {
            this.displayAnswer(data.question, data.answer, data.timestamp);
        });
        
        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }
    
    bindEvents() {
        this.sendQuestionBtn.addEventListener('click', () => this.sendManualQuestion());
        this.clearAnswersBtn.addEventListener('click', () => this.clearAnswers());
        this.clearQuestionBtn.addEventListener('click', () => this.clearQuestion());
        
        // Enter key in manual question input
        this.manualQuestionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendManualQuestion();
            }
        });
        
        // Auto-resize textarea
        this.manualQuestionInput.addEventListener('input', this.autoResizeTextarea);
        
        // Sample question buttons
        this.sampleQuestionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.target.getAttribute('data-question');
                this.manualQuestionInput.value = question;
                this.autoResizeTextarea({ target: this.manualQuestionInput });
            });
        });
    }
    
    async sendManualQuestion() {
        const question = this.manualQuestionInput.value.trim();
        
        if (!question) {
            this.showError('Please enter a question');
            return;
        }
        
        try {
            this.setButtonLoading(this.sendQuestionBtn, true);
            
            // Send via Socket.IO for real-time response
            this.socket.emit('manual_question', { question: question });
            
        } catch (error) {
            this.showError(`Failed to send question: ${error.message}`);
        } finally {
            this.setButtonLoading(this.sendQuestionBtn, false);
        }
    }
    
    clearAnswers() {
        this.answersArea.innerHTML = `
            <p class="text-muted text-center py-4">
                <i data-feather="message-circle" class="me-2"></i>
                AI-generated answers will appear here after you submit a question...
            </p>
        `;
        this.answerCount = 0;
        feather.replace();
    }
    
    clearQuestion() {
        this.manualQuestionInput.value = '';
        this.autoResizeTextarea({ target: this.manualQuestionInput });
    }
    
    updateConnectionStatus(connected) {
        const icon = this.connectionStatus.querySelector('i');
        const text = this.connectionStatus.childNodes[this.connectionStatus.childNodes.length - 1];
        
        if (connected) {
            icon.setAttribute('data-feather', 'wifi');
            text.textContent = ' Connected';
            this.connectionStatus.className = 'nav-link connection-connected';
        } else {
            icon.setAttribute('data-feather', 'wifi-off');
            text.textContent = ' Disconnected';
            this.connectionStatus.className = 'nav-link connection-disconnected';
        }
        
        feather.replace();
    }
    
    displayAnswer(question, answer, timestamp) {
        this.answerCount++;
        
        // Remove empty state message
        if (this.answerCount === 1) {
            this.answersArea.innerHTML = '';
        }
        
        const answerElement = this.createAnswerElement(question, answer, timestamp, this.answerCount);
        this.answersArea.insertBefore(answerElement, this.answersArea.firstChild);
        
        // Auto-scroll to top to show new answer
        this.answersArea.scrollTop = 0;
    }
    
    createAnswerElement(question, answer, timestamp, id) {
        const div = document.createElement('div');
        div.className = 'answer-item';
        div.innerHTML = `
            <div class="answer-timestamp">
                <i data-feather="clock" style="width: 12px; height: 12px;"></i>
                ${new Date(timestamp * 1000).toLocaleTimeString()}
            </div>
            <div class="answer-question">
                <i data-feather="help-circle" style="width: 16px; height: 16px;"></i>
                ${this.escapeHtml(question)}
            </div>
            <div class="answer-text">${this.escapeHtml(answer)}</div>
            <div class="answer-actions">
                <button class="btn btn-sm btn-outline-primary copy-btn" data-text="${this.escapeHtml(answer)}">
                    <i data-feather="copy" style="width: 14px; height: 14px;"></i>
                    Copy Answer
                </button>
                <button class="btn btn-sm btn-outline-secondary copy-question-btn" data-text="${this.escapeHtml(question)}">
                    <i data-feather="message-square" style="width: 14px; height: 14px;"></i>
                    Copy Question
                </button>
                <button class="btn btn-sm btn-outline-info improve-btn" data-question="${this.escapeHtml(question)}" data-answer="${this.escapeHtml(answer)}">
                    <i data-feather="zap" style="width: 14px; height: 14px;"></i>
                    Improve Answer
                </button>
            </div>
        `;
        
        // Bind copy events
        const copyBtn = div.querySelector('.copy-btn');
        const copyQuestionBtn = div.querySelector('.copy-question-btn');
        const improveBtn = div.querySelector('.improve-btn');
        
        copyBtn.addEventListener('click', (e) => this.copyToClipboard(e, answer));
        copyQuestionBtn.addEventListener('click', (e) => this.copyToClipboard(e, question));
        improveBtn.addEventListener('click', (e) => this.improveAnswer(e, question, answer));
        
        // Replace feather icons
        setTimeout(() => feather.replace(), 0);
        
        return div;
    }
    
    async copyToClipboard(event, text) {
        try {
            await navigator.clipboard.writeText(text);
            
            const button = event.currentTarget;
            const originalHTML = button.innerHTML;
            const originalClass = button.className;
            
            button.innerHTML = '<i data-feather="check" style="width: 14px; height: 14px;"></i> Copied!';
            button.className = button.className.replace('btn-outline-primary', 'btn-success').replace('btn-outline-secondary', 'btn-success');
            
            feather.replace();
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.className = originalClass;
                feather.replace();
            }, 2000);
            
        } catch (error) {
            this.showError('Failed to copy to clipboard');
        }
    }
    
    async improveAnswer(event, question, currentAnswer) {
        const button = event.currentTarget;
        this.setButtonLoading(button, true);
        
        try {
            const response = await fetch('/send_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: `Please improve this interview answer: Question: "${question}" Current answer: "${currentAnswer}" Provide a better, more detailed version.`
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // The improved answer will be displayed automatically via WebSocket
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            this.showError(`Failed to improve answer: ${error.message}`);
        } finally {
            this.setButtonLoading(button, false);
        }
    }
    
    showError(message) {
        // Create a toast-like error notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-bg-danger border-0 position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i data-feather="alert-circle" style="width: 16px; height: 16px;"></i>
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        feather.replace();
        
        const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
        
        console.error('Interview Assistant Error:', message);
    }
    
    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }
    
    autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.interviewAssistant = new InterviewAssistant();
});