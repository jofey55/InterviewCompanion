import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from openai_client import OpenAIClient
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "interview_assistant_secret_key")

# Initialize SocketIO for real-time communication
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Initialize OpenAI client
openai_client = OpenAIClient()

@app.route('/')
def index():
    """Main page with the interview assistant interface"""
    return render_template('index_simple.html')

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