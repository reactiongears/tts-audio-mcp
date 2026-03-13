# tts-audio-mcp — Agent Instructions

## Project Overview
MCP server that analyzes TTS (text-to-speech) audio recordings to help debug voice call center issues. Combines whisper.cpp (transcription) and NISQA (quality scoring) into a unified tool set that Claude Code and other agentic CLIs can use to "listen" to audio files and report problems.

## System Specs
- **Machine**: Mac Studio, Apple M4 Max, 16 CPU cores, 40 GPU cores
- **RAM**: 64 GB unified memory
- **Shell**: zsh
- **Existing setup**: Ollama running with Qwen3-Coder-Next, Kimi K2.5, Qwen3-VL

## Session Startup Protocol
1. Read `claude-progress.md` for current state
2. Run `git log --oneline -10` for recent changes
3. Run `bash init.sh` to verify environment
4. Read `feature_list.json` to find the next `"passes": false` feature
5. Run a quick smoke test if applicable

## Working Protocol
- Work on ONE feature at a time (highest-priority `"passes": false`)
- Test features by running the actual commands in the verification steps
- Update `feature_list.json` — set `"passes": true` ONLY after real verification
- NEVER remove or weaken a feature test to make it pass
- Make incremental git commits with descriptive messages

## Key Technical Details

### whisper.cpp
- Install via `brew install whisper-cpp` or build from source with Metal
- Binary is `whisper-cli` (not `whisper`)
- Needs a model file: `ggml-large-v3-turbo.bin` (~1.5 GB)
- Use `--output-json` for structured output with word timestamps
- Use `--language auto` for auto-detection
- Metal acceleration is automatic on Apple Silicon builds

### NISQA
- Install via `pip install nisqa`
- Python library, call from Node.js via child_process
- Returns MOS (Mean Opinion Score) on 1-5 scale
- Sub-scores: noisiness, discontinuity, coloration, loudness
- Requires .wav input (convert other formats first)

### MCP Server
- Use `@modelcontextprotocol/sdk` for the server framework
- Stdio transport (standard for local MCP servers)
- Use `zod` for input validation
- Each tool should have clear JSON Schema descriptions
- Tools: transcribe, quality_score, compare_tts, analyze_tts

### Audio Format Handling
- Primary: .wav (required by NISQA, preferred by whisper)
- Also support: .mp3, .m4a (convert to .wav via ffmpeg for NISQA)
- ffmpeg should be available (`brew install ffmpeg` if needed)

## Integration Targets
- OpenCode: `~/.config/opencode/opencode.json` → mcp section
- Qwen Code: `~/.qwen/settings.json` → mcpServers section
- Claude Code: `~/.claude/settings.json` or project-level `.claude/settings.json`

## Session Shutdown Protocol
1. Commit all changes to git
2. Update `claude-progress.md` with what was done
3. Update `feature_list.json` with current pass/fail status
4. Leave the project in a working state

## Error Recovery
- If whisper.cpp fails: check model path, check binary exists
- If NISQA fails: check Python env, check .wav format (16-bit PCM, mono preferred)
- If MCP handshake fails: check stdio transport, verify tool schemas
- If audio conversion fails: ensure ffmpeg is installed
