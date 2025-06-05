import os
import logging
from openai import OpenAI
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class OpenAIClient:
    """Handles OpenAI API interactions for answer generation"""
    
    def __init__(self):
        # Get API key from environment variables
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set in environment variables")
        
        self.client = OpenAI(api_key=api_key)
        
        # System prompt for interview assistance
        self.system_prompt = """You are an intelligent interview assistant. Your role is to help candidates answer interview questions effectively. 

When given a question, provide:
1. A clear, concise answer that demonstrates competence
2. Relevant examples or experiences when appropriate
3. Professional tone suitable for an interview setting

Keep responses focused and interview-appropriate. Aim for answers that are 1-3 minutes when spoken aloud."""
    
    def generate_answer(self, question: str) -> str:
        """Generate an answer for the given interview question"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Interview question: {question}"}
                ],
                max_tokens=500,
                temperature=0.7
            )
            answer = response.choices[0].message.content.strip()
            logging.info(f"Generated answer for question: {question[:50]}...")
            return answer
            
        except Exception as e:
            logging.error(f"Error generating answer with OpenAI: {e}")
            raise Exception(f"Failed to generate answer: {str(e)}")
    
    def generate_follow_up_questions(self, topic: str) -> list:
        """Generate potential follow-up questions for a given topic"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system", 
                        "content": "Generate 3 relevant follow-up interview questions for the given topic. Return as a simple list."
                    },
                    {"role": "user", "content": f"Topic: {topic}"}
                ],
                max_tokens=200,
                temperature=0.8
            )
            questions_text = response.choices[0].message.content.strip()
            questions = [q.strip() for q in questions_text.split('\n') if q.strip()]
            return questions[:3]  # Return max 3 questions
            
        except Exception as e:
            logging.error(f"Error generating follow-up questions: {e}")
            return []
    
    def improve_answer(self, question: str, current_answer: str) -> str:
        """Improve an existing answer"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are helping improve interview answers. Make the answer more compelling, specific, and interview-appropriate while maintaining authenticity."
                    },
                    {
                        "role": "user", 
                        "content": f"Question: {question}\n\nCurrent answer: {current_answer}\n\nProvide an improved version:"
                    }
                ],
                max_tokens=500,
                temperature=0.6
            )
            improved_answer = response.choices[0].message.content.strip()
            return improved_answer
            
        except Exception as e:
            logging.error(f"Error improving answer: {e}")
            raise Exception(f"Failed to improve answer: {str(e)}")
