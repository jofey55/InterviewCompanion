import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
# Import audio processor with fallback
try:
    from audio_processor import AudioProcessor
    AUDIO_AVAILABLE = True
except Exception as e:
    print(f"Audio processing not available: {e}")
    AUDIO_AVAILABLE = False
    AudioProcessor = None
from openai_client import OpenAIClient
import threading
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "interview_assistant_secret_key")

# Initialize SocketIO for real-time communication
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize processors
if AUDIO_AVAILABLE:
    audio_processor = AudioProcessor()
else:
    audio_processor = None
openai_client = OpenAIClient()

# Global state
transcription_active = False
current_transcription = ""
transcription_thread = None

@app.route('/')
def index():
    """Main page with the interview assistant interface"""
    return render_template('index.html')

@app.route('/start_transcription', methods=['POST'])
def start_transcription():
    """Start audio transcription"""
    global transcription_active, transcription_thread
    
    try:
        if not AUDIO_AVAILABLE:
            return jsonify({
                'success': False,
                'message': 'Audio recording not available in this environment. Please use manual text input.'
            }), 400
            
        if not transcription_active:
            transcription_active = True
            transcription_thread = threading.Thread(target=transcription_worker)
            transcription_thread.daemon = True
            transcription_thread.start()
            
            socketio.emit('status_update', {
                'status': 'started',
                'message': 'Transcription started successfully'
            })
            
            return jsonify({
                'success': True,
                'message': 'Transcription started'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Transcription already active'
            })
    except Exception as e:
        logging.error(f"Error starting transcription: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to start transcription: {str(e)}'
        }), 500

@app.route('/stop_transcription', methods=['POST'])
def stop_transcription():
    """Stop audio transcription"""
    global transcription_active
    
    try:
        transcription_active = False
        if audio_processor:
            audio_processor.stop_recording()
        
        socketio.emit('status_update', {
            'status': 'stopped',
            'message': 'Transcription stopped'
        })
        
        return jsonify({
            'success': True,
            'message': 'Transcription stopped'
        })
    except Exception as e:
        logging.error(f"Error stopping transcription: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to stop transcription: {str(e)}'
        }), 500

@app.route('/send_question', methods=['POST'])
def send_question():
    """Send question to OpenAI and get answer"""
    try:
        data = request.get_json()
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({
                'success': False,
                'message': 'No question provided'
            }), 400
        
        # Generate answer using OpenAI
        answer = openai_client.generate_answer(question)
        
        # Emit the answer via WebSocket
        socketio.emit('answer_received', {
            'question': question,
            'answer': answer,
            'timestamp': time.time()
        })
        
        return jsonify({
            'success': True,
            'question': question,
            'answer': answer
        })
        
    except Exception as e:
        logging.error(f"Error generating answer: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to generate answer: {str(e)}'
        }), 500

@app.route('/get_current_transcription', methods=['GET'])
def get_current_transcription():
    """Get the current transcription text"""
    global current_transcription
    return jsonify({
        'transcription': current_transcription,
        'active': transcription_active
    })

def transcription_worker():
    """Background worker for continuous transcription"""
    global transcription_active, current_transcription
    
    if not audio_processor:
        return
    
    try:
        audio_processor.start_recording()
        
        while transcription_active:
            # Get audio chunk and transcribe
            audio_chunk = audio_processor.get_audio_chunk()
            
            if audio_chunk is not None:
                # Transcribe the audio chunk
                text = audio_processor.transcribe_audio(audio_chunk)
                
                if text and text.strip():
                    current_transcription += " " + text.strip()
                    
                    # Emit transcription update via WebSocket
                    socketio.emit('transcription_update', {
                        'text': text.strip(),
                        'full_transcription': current_transcription.strip()
                    })
                    
                    # Check if this looks like a question
                    if is_question(text.strip()):
                        socketio.emit('question_detected', {
                            'question': text.strip()
                        })
            
            time.sleep(0.1)  # Small delay to prevent excessive CPU usage
            
    except Exception as e:
        logging.error(f"Error in transcription worker: {e}")
        socketio.emit('error', {
            'message': f'Transcription error: {str(e)}'
        })
    finally:
        if audio_processor:
            audio_processor.stop_recording()

def is_question(text):
    """Simple question detection based on question marks and question words"""
    text_lower = text.lower().strip()
    
    # Check for question mark
    if '?' in text:
        return True
    
    # Check for common question starters
    question_words = ['what', 'where', 'when', 'why', 'how', 'who', 'which', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'are', 'is', 'was', 'were']
    
    for word in question_words:
        if text_lower.startswith(word + ' '):
            return True
    
    return False

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logging.info('Client connected')
    emit('status_update', {
        'status': 'connected',
        'message': 'Connected to Interview Assistant'
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logging.info('Client disconnected')

@socketio.on('manual_question')
def handle_manual_question(data):
    """Handle manually triggered question"""
    question = data.get('question', '').strip()
    if question:
        try:
            answer = openai_client.generate_answer(question)
            emit('answer_received', {
                'question': question,
                'answer': answer,
                'timestamp': time.time()
            })
        except Exception as e:
            emit('error', {
                'message': f'Failed to generate answer: {str(e)}'
            })

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
