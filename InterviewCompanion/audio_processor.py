import numpy as np
import whisper
import tempfile
import os
import logging
import wave
import threading
import queue
from typing import Optional

# Try to import sounddevice, fall back gracefully if not available
try:
    import sounddevice as sd
    AUDIO_AVAILABLE = True
except (ImportError, OSError) as e:
    print(f"Audio input not available: {e}")
    AUDIO_AVAILABLE = False
    sd = None

class AudioProcessor:
    """Handles audio recording and transcription using Whisper"""
    
    def __init__(self, sample_rate=16000, chunk_duration=3.0):
        self.sample_rate = sample_rate
        self.chunk_duration = chunk_duration
        self.chunk_size = int(sample_rate * chunk_duration)
        
        # Initialize Whisper model (using base model for balance of speed/accuracy)
        logging.info("Loading Whisper model...")
        try:
            self.whisper_model = whisper.load_model("base")
            logging.info("Whisper model loaded successfully")
        except Exception as e:
            logging.error(f"Failed to load Whisper model: {e}")
            raise
        
        # Audio recording state
        self.recording = False
        self.audio_queue = queue.Queue()
        self.recording_thread = None
        
    def start_recording(self):
        """Start audio recording in a separate thread"""
        if not AUDIO_AVAILABLE:
            raise Exception("Audio recording not available in this environment. Please use manual text input instead.")
        
        if not self.recording:
            self.recording = True
            self.recording_thread = threading.Thread(target=self._record_audio)
            self.recording_thread.daemon = True
            self.recording_thread.start()
            logging.info("Audio recording started")
    
    def stop_recording(self):
        """Stop audio recording"""
        self.recording = False
        if self.recording_thread:
            self.recording_thread.join(timeout=1.0)
        logging.info("Audio recording stopped")
    
    def _record_audio(self):
        """Record audio in chunks"""
        if not AUDIO_AVAILABLE:
            return
            
        try:
            def audio_callback(indata, frames, time, status):
                if status:
                    logging.warning(f"Audio callback status: {status}")
                if self.recording:
                    # Convert to mono if stereo
                    if len(indata.shape) > 1:
                        audio_data = np.mean(indata, axis=1)
                    else:
                        audio_data = indata.flatten()
                    
                    self.audio_queue.put(audio_data.copy())
            
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                callback=audio_callback,
                blocksize=self.chunk_size
            ):
                while self.recording:
                    sd.sleep(100)  # Sleep for 100ms
                    
        except Exception as e:
            logging.error(f"Error in audio recording: {e}")
            self.recording = False
    
    def get_audio_chunk(self) -> Optional[np.ndarray]:
        """Get the next audio chunk from the queue"""
        try:
            # Get audio chunk with timeout to avoid blocking
            audio_chunk = self.audio_queue.get(timeout=0.5)
            return audio_chunk
        except queue.Empty:
            return None
        except Exception as e:
            logging.error(f"Error getting audio chunk: {e}")
            return None
    
    def transcribe_audio(self, audio_data: np.ndarray) -> str:
        """Transcribe audio data using Whisper"""
        try:
            # Check if audio has enough volume to be worth transcribing
            if np.max(np.abs(audio_data)) < 0.01:
                return ""  # Too quiet, likely silence
            
            # Create temporary wav file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_path = temp_file.name
                
                # Write audio data to wav file
                with wave.open(temp_path, 'wb') as wav_file:
                    wav_file.setnchannels(1)  # Mono
                    wav_file.setsampwidth(2)  # 16-bit
                    wav_file.setframerate(self.sample_rate)
                    
                    # Convert float32 to int16
                    audio_int16 = (audio_data * 32767).astype(np.int16)
                    wav_file.writeframes(audio_int16.tobytes())
                
                # Transcribe using Whisper
                result = self.whisper_model.transcribe(temp_path, language="en")
                text = result["text"].strip()
                
                # Clean up temporary file
                os.unlink(temp_path)
                
                return text
                
        except Exception as e:
            logging.error(f"Error transcribing audio: {e}")
            return ""
    
    def list_audio_devices(self):
        """List available audio input devices"""
        if not AUDIO_AVAILABLE:
            logging.info("Audio devices not available in this environment")
            return
            
        try:
            devices = sd.query_devices()
            logging.info("Available audio devices:")
            for i, device in enumerate(devices):
                if device['max_input_channels'] > 0:
                    logging.info(f"  {i}: {device['name']} (inputs: {device['max_input_channels']})")
        except Exception as e:
            logging.error(f"Error listing audio devices: {e}")
