# tts-audio-mcp — Progress Log

## Current State
- **Last session**: 2026-03-12 — All 16 features passing
- **Features passing**: 16 / 16
- **Current focus**: Complete — ready for real-world use
- **Known issues**: None

## Architecture

```
Audio File (.wav/.mp3/.m4a)
       │
       ▼
┌─────────────────────────────────────────┐
│         tts-audio-mcp server            │
│                                         │
│  Tools:                                 │
│  • transcribe    → whisper.cpp          │
│  • quality_score → librosa (Python)      │
│  • compare_tts   → whisper + text diff  │
│  • analyze_tts   → all of the above     │
│                                         │
│  Transport: stdio (MCP standard)        │
└─────────────────────────────────────────┘
       │
       ▼
  Structured report → Claude / Qwen / OpenCode
```

## Dependencies
- **whisper.cpp**: Speech-to-text with word timestamps (Metal accelerated)
- **librosa**: Audio analysis (pitch, energy, silence ratio via Python)
- **@modelcontextprotocol/sdk**: MCP server framework
- **Node.js + TypeScript**: Server runtime

## Session History

### Session 2 — 2026-03-12
**Worked on**: F001-F016 — Full implementation, integration, docs
**Completed**:
- whisper.cpp + large-v3-turbo model installed (Metal GPU)
- Pivoted from NISQA to librosa for quality analysis (NISQA had unresolvable dependency issues)
- Built all 4 MCP tools: transcribe, quality_score, compare_tts, analyze_tts
- Fixed word-level timestamp extraction (segments ARE words with --max-len 1)
- End-to-end test: 195 WPM, rushed word detected, 0% WER, quality metrics working
- Wired MCP server into OpenCode, Qwen Code, and Claude Code configs
- Error handling verified (clear errors, server stays alive)
- Env var configuration (WHISPER_BINARY, WHISPER_MODEL_PATH, TTS_PYTHON_BIN)
- Full README with installation, tool docs, integration configs, example output
**Status**: All 16/16 features passing. Project complete.
**Next**: Push to GitHub, test in real voice call center debugging workflow

### Session 1 — 2026-03-12
**Worked on**: Project harness creation
**Completed**: feature_list.json (16 features), init.sh, claude-progress.md, CLAUDE.md
**Status**: Harness files created, no features implemented yet
**Next**: Begin F001 — Install whisper.cpp with Metal acceleration
