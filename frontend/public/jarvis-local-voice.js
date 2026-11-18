
/* JARVIS_LOCAL_VOICE_V4 */
(() => {
  'use strict';

  let recorder = null;
  let stream = null;
  let chunks = [];
  let busy = false;
  let audio = null;
  let audioUrl = null;

  const mic = document.getElementById('mic');
  const mode = document.getElementById('mode');
  const headline = document.getElementById('headline');
  const subtitle = document.getElementById('subtitle');

  function status(label, title, detail) {
    mode.textContent = label;
    headline.textContent = title;
    subtitle.textContent = detail;
  }

  function cleanupMic() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    stream = null;
    mic.classList.remove('active');
    mic.setAttribute('aria-label', 'Start voice recognition');
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
  }

  async function speak(text) {
    if (!text || !text.trim()) return;

    stopAudio();

    try {
      status('SPEAKING', 'J.A.R.V.I.S.', 'Responding, Sir.');

      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: text.slice(0, 2000)})
      });

      if (!response.ok) {
        throw new Error('Speech API HTTP ' + response.status);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error('Empty speech response');
      }

      audioUrl = URL.createObjectURL(blob);
      const playback = new Audio(audioUrl);
      audio = playback;

      playback.onended = () => {
        if (audio === playback) {
          stopAudio();
          status(
            'SYSTEM READY',
            'At your service, Sir.',
            'Awaiting your instruction'
          );
        }
      };

      playback.onerror = () => {
        if (audio === playback) {
          stopAudio();
          status(
            'SYSTEM READY',
            'At your service, Sir.',
            'Audio playback unavailable'
          );
        }
      };

      await playback.play();

    } catch (error) {
      console.warn('JARVIS speech playback:', error);
      stopAudio();
      status(
        'SYSTEM READY',
        'At your service, Sir.',
        'Reply displayed; audio unavailable'
      );
    }
  }

  async function transcribe(blob, extension) {
    const form = new FormData();
    form.append('file', blob, 'jarvis-microphone.' + extension);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: form,
        signal: controller.signal
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Transcription failed'
        );
      }

      return typeof data.text === 'string'
        ? data.text.trim()
        : '';

    } finally {
      clearTimeout(timeout);
    }
  }

  async function startRecording() {
    if (busy || !window.jarvisVoiceSend) return;

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      status(
        'VOICE UNAVAILABLE',
        'Microphone unsupported',
        'Use Chrome or Edge on localhost'
      );
      return;
    }

    stopAudio();
    busy = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ];

      const format = formats.find(type =>
        MediaRecorder.isTypeSupported(type)
      );

      recorder = format
        ? new MediaRecorder(stream, {mimeType: format})
        : new MediaRecorder(stream);

      chunks = [];

      recorder.ondataavailable = event => {
        if (event.data && event.data.size) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupMic();
        busy = false;

        status(
          'VOICE ERROR',
          'Recording failed',
          'Please try again'
        );
      };

      recorder.onstop = async () => {
        const mime = recorder.mimeType || 'audio/webm';
        const extension = mime.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunks, {type: mime});

        recorder = null;
        chunks = [];
        cleanupMic();

        try {
          if (!blob.size) {
            throw new Error('No audio recorded');
          }

          status(
            'TRANSCRIBING',
            'Understanding your voice',
            'Local Faster-Whisper'
          );

          const transcript = await transcribe(blob, extension);

          if (!transcript) {
            status(
              'SYSTEM READY',
              'At your service, Sir.',
              'No speech detected'
            );
            return;
          }

          await window.jarvisVoiceSend(transcript);

        } catch (error) {
          console.error('JARVIS voice recognition:', error);

          status(
            'VOICE ERROR',
            'Could not process recording',
            String(error.message).slice(0, 80)
          );

        } finally {
          busy = false;
        }
      };

      recorder.start();

      mic.classList.add('active');
      mic.setAttribute('aria-label', 'Stop recording and send');

      status(
        'LISTENING',
        'I am listening, Sir.',
        'Click microphone again to send'
      );

    } catch (error) {
      cleanupMic();
      busy = false;

      status(
        'VOICE UNAVAILABLE',
        'Microphone permission required',
        String(error.message).slice(0, 80)
      );
    }
  }

  mic.onclick = () => {
    if (recorder?.state === 'recording') {
      recorder.stop();
    } else if (!busy) {
      startRecording();
    }
  };

  window.jarvisVoiceSpeak = speak;
})();
