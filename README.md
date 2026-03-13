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

Once configured, ask your coding assistant to analyze TTS audio:

> "Analyze the TTS recording at /tmp/call-greeting.wav — the customer complained it sounded robotic"

> "Compare /tmp/agent-response.wav against the expected script: 'Thank you for your patience, I'll transfer you now'"

> "Check the pacing on /recordings/ivr-menu.wav — callers are saying it's too fast"

The LLM receives the structured report and can reason about what to adjust in your TTS configuration.

## License

MIT
