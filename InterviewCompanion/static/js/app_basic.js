class InterviewAssistant {
    constructor() {
        this.answerCount = 0;
        this.recognition = null;
        this.isListening = false;
        this.transcript = '';
        
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.bindEvents();
    }
    
    initializeElements() {
        // Control buttons
        this.sendQuestionBtn = document.getElementById('send-question-btn');
        this.clearAnswersBtn = document.getElementById('clear-answers-btn');
        this.clearQuestionBtn = document.getElementById('clear-question-btn');
        
        // Speech recognition elements
        this.startDictationBtn = document.getElementById('start-dictation-btn');
        this.stopDictationBtn = document.getElementById('stop-dictation-btn');
        this.dictationStatus = document.getElementById('dictation-status');
        this.liveTranscript = document.getElementById('live-transcript');
        
        // Display areas
        this.answersArea = document.getElementById('answers-area');
        
        // Input elements
        this.manualQuestionInput = document.getElementById('manual-question');
        
        // Sample question buttons
        this.sampleQuestionBtns = document.querySelectorAll('.sample-question');
    }
    
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.lastFinalTranscript = '';
            
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = true;
            this.recognition.continuous = true;
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.dictationStatus.innerHTML = '<span class="text-success">🎤 Listening... Speak clearly</span>';
                this.liveTranscript.style.display = 'block';
                this.liveTranscript.innerHTML = '<em class="text-muted">Listening for your speech...</em>';
                this.startDictationBtn.disabled = true;
                this.stopDictationBtn.disabled = false;
            };
            
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                // Only add new final transcript if it's different from the last one
                if (finalTranscript && finalTranscript !== this.lastFinalTranscript) {
                    this.transcript += finalTranscript + ' ';
                    this.lastFinalTranscript = finalTranscript;
                }
                
                const displayText = this.transcript + '<span style="color: #999;">' + interimTranscript + '</span>';
                this.liveTranscript.innerHTML = displayText || '<em class="text-muted">Listening for your speech...</em>';
                
                const fullText = (this.transcript + interimTranscript).trim();
                if (fullText) {
                    this.manualQuestionInput.value = fullText;
                }
            };
            
            this.recognition.onerror = (event) => {
                this.handleSpeechError(event.error);
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                this.startDictationBtn.disabled = false;
                this.stopDictationBtn.disabled = true;
                
                if (this.transcript.trim()) {
                    this.dictationStatus.innerHTML = '<span class="text-success">✓ Speech captured successfully</span>';
                    this.liveTranscript.innerHTML = `<strong>Final transcript:</strong> ${this.transcript}`;
                } else {
                    this.dictationStatus.innerHTML = '<span class="text-muted">Click "Start Dictation" to speak your question</span>';
                    this.liveTranscript.style.display = 'none';
                }
            };
        } else {
            this.dictationStatus.innerHTML = '<span class="text-warning">⚠️ Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.</span>';
            this.startDictationBtn.disabled = true;
        }
    }
    
    bindEvents() {
        this.sendQuestionBtn.addEventListener('click', () => this.sendManualQuestion());
        this.clearAnswersBtn.addEventListener('click', () => this.clearAnswers());
        this.clearQuestionBtn.addEventListener('click', () => this.clearQuestion());
        
        // Speech recognition events
        this.startDictationBtn.addEventListener('click', () => this.startDictation());
        this.stopDictationBtn.addEventListener('click', () => this.stopDictation());
        
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
            
            const response = await fetch('/send_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayAnswer(data.question, data.answer, data.timestamp);
            } else {
                this.showError(data.message);
            }
            
        } catch (error) {
            this.showError(`Failed to send question: ${error.message}`);
        } finally {
            this.setButtonLoading(this.sendQuestionBtn, false);
        }
    }
    
    startDictation() {
        if (this.recognition && !this.isListening) {
            this.transcript = '';
            this.lastFinalTranscript = '';
            this.recognition.start();
        }
    }
    
    stopDictation() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    handleSpeechError(error) {
        this.isListening = false;
        this.startDictationBtn.disabled = false;
        this.stopDictationBtn.disabled = true;
        
        let errorMessage = '';
        
        switch (error) {
            case 'not-allowed':
                errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
                break;
            case 'no-speech':
                errorMessage = 'No speech detected. Please try speaking louder or closer to the microphone.';
                break;
            case 'audio-capture':
                errorMessage = 'Audio capture failed. Please check your microphone connection.';
                break;
            case 'network':
                errorMessage = 'Network error occurred during speech recognition.';
                break;
            case 'service-not-allowed':
                errorMessage = 'Speech recognition service not allowed. Please check browser settings.';
                break;
            default:
                errorMessage = `Speech recognition error: ${error}`;
        }
        
        this.dictationStatus.innerHTML = `<span class="text-danger">⚠️ ${errorMessage}</span>`;
        this.liveTranscript.style.display = 'none';
        
        console.error('Speech recognition error:', error);
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
            <div class="answer-text" style="color: #181818; font-weight: 500;">${this.escapeHtml(answer)}</div>
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