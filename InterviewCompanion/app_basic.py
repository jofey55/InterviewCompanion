import os
import logging
from flask import Flask, render_template, request, jsonify
from openai_client import OpenAIClient
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "interview_assistant_secret_key")

# Initialize OpenAI client
openai_client = OpenAIClient()

@app.route('/')
def index():
    """Main page with the interview assistant interface"""
    return render_template('index_basic.html')

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
        
        return jsonify({
            'success': True,
            'question': question,
            'answer': answer,
            'timestamp': time.time()
        })
        
    except Exception as e:
        logging.error(f"Error generating answer: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to generate answer: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)