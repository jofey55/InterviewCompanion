class InterviewAssistant {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isRecording = false;
        this.currentTranscription = '';
        this.answerCount = 0;
        
        this.initializeElements();
        this.initializeSocket();
        this.bindEvents();
    }
    
    initializeElements() {
        // Control buttons
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.sendQuestionBtn = document.getElementById('send-question-btn');
        this.clearAnswersBtn = document.getElementById('clear-answers-btn');
        
        // Display areas
        this.transcriptionArea = document.getElementById('transcription-area');
        this.answersArea = document.getElementById('answers-area');
        this.statusIndicator = document.getElementById('status-indicator');
        this.connectionStatus = document.getElementById('connection-status');
        
        // Input elements
        this.manualQuestionInput = document.getElementById('manual-question');
        
        // Alert elements
        this.questionAlert = document.getElementById('question-alert');
        this.detectedQuestion = document.getElementById('detected-question');
        this.autoAnswerBtn = document.getElementById('auto-answer-btn');
        this.dismissAlertBtn = document.getElementById('dismiss-alert-btn');
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.startBtn.disabled = false;
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.startBtn.disabled = true;
            this.stopBtn.disabled = true;
            console.log('Disconnected from server');
        });
        
        this.socket.on('status_update', (data) => {
            this.updateStatus(data.status, data.message);
        });
        
        this.socket.on('transcription_update', (data) => {
            this.updateTranscription(data.text, data.full_transcription);
        });
        
        this.socket.on('question_detected', (data) => {
            this.showQuestionAlert(data.question);
        });
        
        this.socket.on('answer_received', (data) => {
            this.displayAnswer(data.question, data.answer, data.timestamp);
        });
        
        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startTranscription());
        this.stopBtn.addEventListener('click', () => this.stopTranscription());
        this.sendQuestionBtn.addEventListener('click', () => this.sendManualQuestion());
        this.clearAnswersBtn.addEventListener('click', () => this.clearAnswers());
        
        // Alert buttons
        this.autoAnswerBtn.addEventListener('click', () => this.getAutoAnswer());
        this.dismissAlertBtn.addEventListener('click', () => this.dismissAlert());
        
        // Enter key in manual question input
        this.manualQuestionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendManualQuestion();
            }
        });
        
        // Auto-resize textarea
        this.manualQuestionInput.addEventListener('input', this.autoResizeTextarea);
    }
    
    async startTranscription() {
        try {
            this.setButtonLoading(this.startBtn, true);
            
            const response = await fetch('/start_transcription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.isRecording = true;
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.updateStatus('recording', 'Recording...');
                this.clearTranscription();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            this.showError(`Failed to start transcription: ${error.message}`);
        } finally {
            this.setButtonLoading(this.startBtn, false);
        }
    }
    
    async stopTranscription() {
        try {
            this.setButtonLoading(this.stopBtn, true);
            
            const response = await fetch('/stop_transcription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.isRecording = false;
                this.startBtn.disabled = false;
                this.stopBtn.disabled = true;
                this.updateStatus('stopped', 'Stopped');
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            this.showError(`Failed to stop transcription: ${error.message}`);
        } finally {
            this.setButtonLoading(this.stopBtn, false);
        }
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
            
            // Clear the input
            this.manualQuestionInput.value = '';
            this.autoResizeTextarea({ target: this.manualQuestionInput });
            
        } catch (error) {
            this.showError(`Failed to send question: ${error.message}`);
        } finally {
            this.setButtonLoading(this.sendQuestionBtn, false);
        }
    }
    
    getAutoAnswer() {
        const question = this.detectedQuestion.textContent;
        if (question) {
            this.socket.emit('manual_question', { question: question });
            this.dismissAlert();
        }
    }
    
    dismissAlert() {
        this.questionAlert.classList.add('d-none');
    }
    
    clearAnswers() {
        this.answersArea.innerHTML = '<p class="text-muted text-center py-4">AI-generated answers will appear here...</p>';
        this.answerCount = 0;
    }
    
    clearTranscription() {
        this.currentTranscription = '';
        this.transcriptionArea.innerHTML = '<p class="text-muted text-center py-4">Listening...</p>';
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
    
    updateStatus(status, message) {
        const badge = this.statusIndicator.querySelector('.badge');
        
        switch (status) {
            case 'recording':
                badge.className = 'badge bg-success status-recording';
                badge.innerHTML = '<span class="recording-dot"></span> Recording';
                break;
            case 'stopped':
                badge.className = 'badge bg-secondary';
                badge.textContent = 'Ready';
                break;
            case 'error':
                badge.className = 'badge bg-danger';
                badge.textContent = 'Error';
                break;
            default:
                badge.className = 'badge bg-secondary';
                badge.textContent = 'Ready';
        }
    }
    
    updateTranscription(newText, fullTranscription) {
        this.currentTranscription = fullTranscription;
        
        if (fullTranscription.trim()) {
            this.transcriptionArea.innerHTML = `<p class="transcription-text">${this.escapeHtml(fullTranscription)}</p>`;
        } else {
            this.transcriptionArea.innerHTML = '<p class="text-muted text-center py-4">Listening...</p>';
        }
        
        // Auto-scroll to bottom
        this.transcriptionArea.scrollTop = this.transcriptionArea.scrollHeight;
        
        // Update manual question input if empty
        if (!this.manualQuestionInput.value.trim()) {
            this.manualQuestionInput.value = fullTranscription;
            this.autoResizeTextarea({ target: this.manualQuestionInput });
        }
    }
    
    showQuestionAlert(question) {
        this.detectedQuestion.textContent = question;
        this.questionAlert.classList.remove('d-none');
        
        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            this.dismissAlert();
        }, 30000);
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
            </div>
        `;
        
        // Bind copy events
        const copyBtn = div.querySelector('.copy-btn');
        const copyQuestionBtn = div.querySelector('.copy-question-btn');
        
        copyBtn.addEventListener('click', (e) => this.copyToClipboard(e, answer));
        copyQuestionBtn.addEventListener('click', (e) => this.copyToClipboard(e, question));
        
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
