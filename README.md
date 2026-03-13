# tts-audio-mcp

MCP server that analyzes TTS audio recordings — enabling Claude Code, OpenCode, and Qwen Code to debug voice call center audio the same way they debug code errors.

Feed it an audio file, get back a structured report with transcription, quality scores, pacing analysis, and mispronunciation detection.

## What It Does

```
Audio File (.wav/.mp3/.m4a)
       |
       v
+-------------------------------+
|     tts-audio-mcp server      |
|                               |
|  transcribe   -> whisper.cpp  |
|  quality_score -> librosa     |
|  compare_tts  -> whisper+diff |
|  analyze_tts  -> all combined |
|                               |
|  Transport: stdio (MCP)       |
+-------------------------------+
       |
       v
  Structured report -> LLM reasons about fixes
```

## Tools

### `transcribe`
Transcribe audio to text with word-level timestamps.

**Input:** `audio_path` (string), `language` (string, default: "en")

**Output:** Full transcription text, per-word timestamps (start_ms, end_ms), segments, detected language, duration.

### `quality_score`
Analyze speech quality — pitch variation, energy dynamics, silence ratio.

**Input:** `audio_path` (string)

**Output:**
- **Pitch**: mean/std/range Hz, monotone risk flag, interpretation
- **Energy**: RMS level, dynamic range dB, interpretation
- **Silence ratio**: percentage of audio that is silent
- **Overall assessment** with list of detected issues

### `compare_tts`
Compare TTS output against expected text to find mispronunciations.

**Input:** `audio_path` (string), `expected_text` (string), `language` (string, default: "en")

**Output:** Word Error Rate (WER), substitutions, insertions, deletions with positions.

### `analyze_tts`
Full composite analysis — runs all of the above and returns a single structured report.

**Input:** `audio_path` (string), `expected_text` (string, optional), `language` (string, default: "en")

**Output:** Combined report with transcription, quality scores, pacing analysis (WPM, rushed words, long pauses), and pronunciation diff.

## Example Output

```
TTS Analysis Report
File: /tmp/tts-test-speech.wav
Duration: 4.15s | Words: 13 | Rate: 195 WPM

--- Transcription ---
Hello. Thank you for calling Acme Support. How can I help you today?

--- Quality Scores ---
Pitch: mean 258.5Hz, std 61.1Hz, range 264.3Hz
  Good variation — expressive
Energy: RMS 0.0912, dynamic range 80dB
  Wide dynamic range
Silence ratio: 37.3%
Overall: Minor issues detected (1)
  ! Very wide dynamic range — may clip

--- Pacing Analysis ---
Speaking rate: 195 WPM (natural: 120-180)
Minor pacing issues
Rushed words:
  "How" spoken in 40ms
  ! Speaking rate too fast: 195 WPM (natural: 120-180)
  ! 1 rushed word(s) detected (<80ms)

--- Pronunciation Check ---
Expected: Hello. Thank you for calling Acme Support. How can I help you today?
Got:      Hello. Thank you for calling Acme Support. How can I help you today?
WER: 0.0%
Perfect match — no mispronunciations detected

--- Issues Summary ---
1. Very wide dynamic range — may clip
2. Speaking rate too fast: 195 WPM (natural: 120-180)
3. 1 rushed word(s) detected (<80ms)
```

## Prerequisites

- **whisper.cpp** with Metal acceleration: `brew install whisper-cpp`
- **Whisper model**: `ggml-large-v3-turbo.bin` (~1.5 GB) in `models/`
- **Python 3.12** with librosa: `.venv/bin/python3` with `pip install librosa`
- **ffmpeg** for audio format conversion: `brew install ffmpeg`
- **Node.js** 18+

## Installation

```bash
git clone https://github.com/reactiongears/tts-audio-mcp.git
cd tts-audio-mcp

# Node dependencies
npm install

# Python venv for audio analysis
python3.12 -m venv .venv
.venv/bin/pip install librosa 'setuptools<82'

# Download whisper model
mkdir -p models
curl -L -o models/ggml-large-v3-turbo.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin

# Build
npm run build
```

## Integration

### Claude Code

Add to `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "tts-audio": {
      "command": "node",
      "args": ["/path/to/tts-audio-mcp/dist/index.js"]
    }
  }
}
```

### OpenCode

Add to `~/.config/opencode/opencode.json` under `"mcp"`:

```json
"tts-audio": {
  "type": "local",
  "command": ["node", "/path/to/tts-audio-mcp/dist/index.js"],
  "enabled": true
}
```

### Qwen Code

Add to `~/.qwen/settings.json` under `"mcpServers"`:

```json
"tts-audio": {
  "command": "node",
  "args": ["/path/to/tts-audio-mcp/dist/index.js"]
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_BINARY` | `whisper-cli` | Path to whisper.cpp binary |
| `WHISPER_MODEL_PATH` | `~/Documents/_dev/tts-audio-mcp/models/ggml-large-v3-turbo.bin` | Path to Whisper model file |
| `TTS_PYTHON_BIN` | `.venv/bin/python3` | Python binary with librosa installed |

## Usage

Once the MCP server is configured in your coding assistant, the tools are available automatically. You talk to your assistant in natural language — it decides when to call the tools and interprets the results for you.

### Quick Start

Generate a test audio file to try it out:

```bash
# macOS — use the built-in TTS engine
say -o /tmp/test-greeting.wav --data-format=LEI16@16000 \
  "Hello. Thank you for calling Acme Support. How can I help you today?"
```

Then in Claude Code, OpenCode, or Qwen Code:

```
> Analyze the audio at /tmp/test-greeting.wav
```

The assistant calls `analyze_tts` behind the scenes and returns a full report with transcription, quality scores, pacing, and issues.

### Debugging TTS Problems

**"It sounds robotic"** — Check pitch variation and monotone risk:

```
> Run quality_score on /recordings/agent-greeting.wav — customers say it sounds robotic
```

The report shows pitch std < 20 Hz = monotone risk. You know to increase prosody variation in your TTS config.

**"Words are getting swallowed"** — Compare against expected script:

```
> Compare /recordings/transfer-prompt.wav against the expected text:
> "Thank you for your patience. I'll transfer you to a specialist now."
```

The tool transcribes the audio, diffs it against your script, and reports substitutions ("specialist" → "specialist's"), deletions, and WER. You know exactly which words the TTS is mangling.

**"It's talking too fast / has weird pauses"** — Check pacing:

```
> Analyze /recordings/ivr-menu.wav — callers are complaining it's too fast
```

The report flags speaking rate (natural range: 120-180 WPM), individual rushed words (< 80ms), and unnatural pauses (> 500ms). You know where to add SSML breaks or adjust rate.

**"Something is off but I'm not sure what"** — Full analysis:

```
> Run a full analysis on /recordings/hold-message.wav
> The expected text is: "Your call is important to us. Please hold and an agent will be with you shortly."
```

Returns everything: transcription, quality metrics, pacing analysis, pronunciation diff, and a prioritized issues summary.

### Batch Debugging

You can analyze multiple recordings in a conversation:

```
> Compare these three recordings against their scripts and tell me which one has the most issues:
> 1. /recordings/greeting.wav — "Welcome to Acme Support"
> 2. /recordings/hold.wav — "Please hold while I look that up"
> 3. /recordings/goodbye.wav — "Thank you for calling. Have a great day!"
```

The assistant calls `compare_tts` for each file and summarizes which recordings need attention.

### Using Individual Tools

You can also ask for specific analysis:

| What you want | What to ask |
|---------------|-------------|
| Just the transcription | "Transcribe /path/to/audio.wav" |
| Just quality metrics | "Check the audio quality of /path/to/audio.wav" |
| Just pronunciation accuracy | "Compare /path/to/audio.wav against 'expected text here'" |
| Everything at once | "Full TTS analysis on /path/to/audio.wav" |

### Supported Audio Formats

- `.wav` — processed directly (best performance)
- `.mp3` — auto-converted to WAV via ffmpeg
- `.m4a` — auto-converted to WAV via ffmpeg

### Interpreting Results

**Quality Scores:**
| Metric | Good | Concerning |
|--------|------|------------|
| Pitch std | 25-80 Hz (natural variation) | < 15 Hz (monotone/robotic) |
| Dynamic range | 10-50 dB | < 10 dB (flat) or > 70 dB (may clip) |
| Silence ratio | 10-50% | > 50% (too much dead air) or < 10% (no breathing room) |

**Pacing:**
| Metric | Natural range | Flag |
|--------|---------------|------|
| Speaking rate | 120-180 WPM | Outside range |
| Word duration | > 80ms | < 80ms = rushed |
| Inter-word gap | < 500ms | > 500ms = unnatural pause |

**Pronunciation (WER):**
| WER | Interpretation |
|-----|----------------|
| 0% | Perfect match |
| 1-5% | Minor issues (articles, contractions) |
| 5-15% | Noticeable mispronunciations |
| > 15% | Significant problems |

### Real-World Workflow

A typical voice call center debugging session:

1. Customer reports: *"The bot sounds weird when it says the account number"*
2. You pull the call recording: `/recordings/call-1234-segment.wav`
3. You know the expected script: `"Your account number is 7 8 4 2 0 1 3"`
4. In Claude Code:
   ```
   > Compare /recordings/call-1234-segment.wav against "Your account number is 7 8 4 2 0 1 3"
   > What's wrong and how should I fix the TTS config?
   ```
5. Claude calls `compare_tts`, sees the TTS is running digits together ("seven eight four" → "seventy-eight four"), and suggests adding SSML `<say-as interpret-as="digits">` tags or inter-digit pauses to your TTS configuration

The LLM doesn't just report the numbers — it reasons about the root cause and suggests specific fixes to your TTS code or configuration.

## License

MIT
