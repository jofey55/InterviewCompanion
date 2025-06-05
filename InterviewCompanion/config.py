import os

class Config:
    """Application configuration"""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SESSION_SECRET', 'interview_assistant_secret_key')
    DEBUG = True
    
    # Audio settings
    SAMPLE_RATE = 16000
    CHUNK_DURATION = 3.0  # seconds
    
    # Whisper settings
    WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large
    
    # OpenAI settings
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    OPENAI_MODEL = "gpt-4o"
    MAX_TOKENS = 500
    TEMPERATURE = 0.7
    
    # UI settings
    MAX_TRANSCRIPTION_LENGTH = 5000  # characters
    AUTO_QUESTION_DETECTION = True
    
    @staticmethod
    def validate():
        """Validate required configuration"""
        if not Config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        return True
