/**
 * Zero-dependency procedural WAV audio synthesizer for Fauxmium
 * Generates valid, playable 16-bit PCM WAV audio for sound effects, chiptunes, ambient soundscapes, and lofi music.
 */

const SAMPLE_RATE = 22050; // 22.05kHz keeps buffer small while sounding crisp

/**
 * Build a 44-byte RIFF WAVE header for 16-bit mono PCM
 */
function createWavHeader(numSamples, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = (numSamples * numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, 4, "ascii");

  // "fmt " sub-chunk
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return header;
}

/**
 * Clamp a float sample [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
 */
function floatToInt16(val) {
  const clamped = Math.max(-1.0, Math.min(1.0, val));
  return clamped < 0 ? Math.floor(clamped * 32768) : Math.floor(clamped * 32767);
}

/**
 * Generate a procedural audio buffer based on description and type
 * @param {Object} options
 * @param {string} [options.description]
 * @param {string} [options.type] 'speech' | 'music' | 'sfx' | 'ambient' | 'chiptune'
 * @param {number} [options.durationSeconds]
 * @returns {{ mimeType: string, buffer: Buffer }}
 */
export function synthesizeWav({
  description = "ambient sound",
  transcript = "",
  type,
  durationSeconds,
  bpm = 120,
  mood = "neutral",
  lens = "modern",
} = {}) {
  const desc = (description || "").toLowerCase();
  const transcriptText = (transcript || "").trim();
  const activeLens = (lens || "modern").toLowerCase();
  const activeMood = (mood || "neutral").toLowerCase();

  const parsedBpm = Math.min(220, Math.max(60, parseFloat(bpm) || 120));
  const beatSec = 60 / parsedBpm;
  const stepSec = beatSec / 2;
  const chordDuration = beatSec * 2;

  // Infer mode
  let mode = (type || "").toLowerCase();
  if (!mode || mode === "default") {
    if (transcriptText) {
      mode = "speech";
    } else if (desc.includes("click") || desc.includes("coin") || desc.includes("beep") || desc.includes("alert") || desc.includes("chime") || desc.includes("sfx")) {
      mode = "sfx";
    } else if (
      desc.includes("8-bit") ||
      desc.includes("8bit") ||
      desc.includes("chiptune") ||
      desc.includes("arcade") ||
      desc.includes("retro") ||
      activeLens.includes("arcade") ||
      activeLens.includes("8bit")
    ) {
      mode = "chiptune";
    } else if (desc.includes("rain") || desc.includes("nature") || desc.includes("ocean") || desc.includes("wind") || desc.includes("ambient") || desc.includes("drone")) {
      mode = "ambient";
    } else if (desc.includes("voice") || desc.includes("speech") || desc.includes("podcast") || desc.includes("talk")) {
      mode = "speech";
    } else {
      mode = "music";
    }
  }

  // Calculate duration
  let duration = durationSeconds;
  if (!duration) {
    if (mode === "sfx") {
      duration = 1.2;
    } else if (mode === "speech") {
      if (transcriptText) {
        const words = transcriptText.split(/\s+/).filter(Boolean);
        duration = Math.min(15.0, Math.max(1.5, words.length * 0.38 + 0.4));
      } else {
        duration = 3.5;
      }
    } else {
      duration = 5.0;
    }
  }

  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const sampleBuffer = new Int16Array(totalSamples);

  switch (mode) {
    case "sfx": {
      // Harmonic chime / ascending arpeggio sweep with exponential decay
      const baseFreq = desc.includes("laser") ? 880 : desc.includes("coin") ? 987 : 523.25; // C5 or B5
      for (let i = 0; i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 3.5);
        let sample = 0;

        if (desc.includes("laser")) {
          // Pitch downward sweep
          const f = baseFreq * Math.exp(-t * 6);
          sample = Math.sin(2 * Math.PI * f * t) * env;
        } else if (desc.includes("coin")) {
          // Classic 2-tone chime
          const f = t < 0.12 ? 987.77 : 1318.51; // B5 -> E6
          sample = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * env;
        } else {
          // Gentle warm bell chime
          sample = (
            Math.sin(2 * Math.PI * 523.25 * t) * 0.5 +
            Math.sin(2 * Math.PI * 659.25 * t) * 0.3 +
            Math.sin(2 * Math.PI * 783.99 * t) * 0.2
          ) * env;
        }

        sampleBuffer[i] = floatToInt16(sample * 0.7);
      }
      break;
    }

    case "chiptune": {
      // Looping 8-bit square wave arpeggio + bass pulse
      const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // C-E-G-C-G-E
      const tempo = stepSec;
      for (let i = 0; i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        const noteIdx = Math.floor(t / tempo) % notes.length;
        const freq = notes[noteIdx];
        const bassFreq = notes[Math.floor(t / (tempo * 4)) % 3] / 2;

        // Square wave
        const lead = Math.sin(2 * Math.PI * freq * t) >= 0 ? 0.25 : -0.25;
        // Triangle wave bass
        const bass = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * bassFreq * t)) * 0.35;
        // Subtle drum tick
        const tick = ((t % (tempo * 2)) < 0.02) ? (Math.random() * 2 - 1) * 0.15 : 0;

        sampleBuffer[i] = floatToInt16((lead + bass + tick) * 0.7);
      }
      break;
    }

    case "ambient": {
      // Modulated pink/brown noise + warm drone pad
      let lastBrown = 0.0;
      const dronePitch = activeMood.includes("tense") ? 98.0 : 110.0; // G2 or A2
      for (let i = 0; i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        const white = Math.random() * 2 - 1;
        lastBrown = (lastBrown + 0.02 * white) / 1.02; // Brown noise filter
        const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * (1 / (beatSec * 4)) * t);
        const drone = (
          Math.sin(2 * Math.PI * dronePitch * t) * 0.3 +
          Math.sin(2 * Math.PI * (dronePitch * 1.498) * t) * 0.2
        );
        const sample = (lastBrown * 2.5 * swell + drone * 0.4);
        sampleBuffer[i] = floatToInt16(sample * 0.5);
      }
      break;
    }

    case "speech": {
      // Formant-like modulated speech cadence with transcript syllable scaling
      const formants = [400, 1200, 2400];
      const isQuestion = transcriptText.endsWith("?");
      for (let i = 0; i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        // Syllable pulse rate ~4.2 Hz
        const syllable = Math.sin(2 * Math.PI * 4.2 * t);
        const syllableGate = syllable > -0.2 ? Math.pow(Math.max(0, syllable), 0.5) : 0.05;

        // Pitch inflection: rise if question, gentle fall if statement
        let pitchContour = 135;
        if (isQuestion) {
          pitchContour = 125 + 35 * (t / duration);
        } else {
          pitchContour = 145 - 20 * (t / duration);
        }
        const pitch = pitchContour + 8 * Math.sin(2 * Math.PI * 1.5 * t);

        const vowelCycle = (Math.sin(2 * Math.PI * 2.5 * t) + 1) * 0.5;
        const f1 = formants[0] + vowelCycle * 250;
        const f2 = formants[1] + vowelCycle * 400;

        const voiceCarrier = Math.sin(2 * Math.PI * pitch * t);
        const voice = (
          voiceCarrier * Math.sin(2 * Math.PI * f1 * t) * 0.4 +
          voiceCarrier * Math.sin(2 * Math.PI * f2 * t) * 0.3
        );

        // Word gap every ~0.4s
        const wordGap = (Math.sin(2 * Math.PI * 1.8 * t) > -0.85) ? 1.0 : 0.1;
        sampleBuffer[i] = floatToInt16(voice * syllableGate * wordGap * 0.7);
      }
      break;
    }

    case "music":
    default: {
      const isCyberpunk = activeLens.includes("cyberpunk") || activeLens.includes("vaporwave");
      const isNoir = activeLens.includes("noir") || activeMood.includes("jazz");

      // Chords based on lens
      let chords;
      if (isCyberpunk) {
        // Dark synthwave: Em9 - Cmaj7 - Am - Bm
        chords = [
          [164.81, 196.00, 246.94, 293.66], // Em9
          [130.81, 164.81, 196.00, 246.94], // Cmaj7
          [220.00, 261.63, 329.63, 392.00], // Am7
          [246.94, 293.66, 369.99, 440.00], // Bm7
        ];
      } else if (isNoir) {
        // Smoky jazz noir: Dm7 - G7 - Cmaj7 - Am7
        chords = [
          [146.83, 174.61, 220.00, 261.63], // Dm7
          [196.00, 246.94, 293.66, 349.23], // G7
          [130.81, 164.81, 196.00, 246.94], // Cmaj7
          [220.00, 261.63, 329.63, 392.00], // Am7
        ];
      } else {
        // Standard warm lofi progression (Am - F - C - G)
        chords = [
          [220.00, 261.63, 329.63], // Am
          [174.61, 220.00, 261.63], // F
          [130.81, 164.81, 196.00], // C
          [196.00, 246.94, 293.66], // G
        ];
      }

      for (let i = 0; i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        const chordIndex = Math.floor(t / chordDuration) % chords.length;
        const chord = chords[chordIndex];
        const tremolo = 0.85 + 0.15 * Math.sin(2 * Math.PI * (1 / beatSec) * t);

        let sample = 0;
        for (const freq of chord) {
          if (isCyberpunk) {
            // Sawtooth synthwave wave
            const saw = (2 * ((freq * t) % 1) - 1) * 0.15;
            const detuneSaw = (2 * (((freq * 1.008) * t) % 1) - 1) * 0.12;
            sample += saw + detuneSaw;
          } else {
            // Warm sine + subtle octave
            sample += Math.sin(2 * Math.PI * freq * t) * 0.20;
            sample += Math.sin(2 * Math.PI * (freq * 2) * t) * 0.05;
          }
        }

        // Sub bass
        const bassFreq = chord[0] / 2;
        sample += Math.sin(2 * Math.PI * bassFreq * t) * 0.3;

        sampleBuffer[i] = floatToInt16(sample * tremolo * 0.65);
      }
      break;
    }
  }

  const pcmBuffer = Buffer.from(sampleBuffer.buffer);
  const header = createWavHeader(totalSamples, SAMPLE_RATE);
  const fullWavBuffer = Buffer.concat([header, pcmBuffer]);

  return {
    mimeType: "audio/wav",
    buffer: fullWavBuffer,
  };
}
