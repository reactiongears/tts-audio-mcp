# tts-audio-mcp — Progress Log

## Current State
- **Last session**: 2026-03-12 — Project harness created
- **Features passing**: 0 / 16
- **Current focus**: F001-F004 — Install dependencies and scaffold MCP server
- **Known issues**: None yet

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
│  • quality_score → NISQA (Python)       │
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
- **NISQA**: Non-intrusive speech quality assessment (MOS prediction)
- **@modelcontextprotocol/sdk**: MCP server framework
- **Node.js + TypeScript**: Server runtime

## Session History

### Session 1 — 2026-03-12
**Worked on**: Project harness creation
**Completed**: feature_list.json (16 features), init.sh, claude-progress.md, CLAUDE.md
**Status**: Harness files created, no features implemented yet
**Next**: Begin F001 — Install whisper.cpp with Metal acceleration
