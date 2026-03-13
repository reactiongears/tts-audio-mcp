#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { transcribe } from "./whisper.js";
import { analyzeAudioQuality } from "./quality.js";
import { compareTexts } from "./diff.js";
import { analyzePacing } from "./pacing.js";
import { formatFullReport } from "./report.js";

const server = new McpServer({
  name: "tts-audio-mcp",
  version: "0.1.0",
});

// Tool: transcribe
server.tool(
  "transcribe",
  "Transcribe an audio file to text with word-level timestamps using Whisper",
  {
    audio_path: z.string().describe("Path to the audio file (.wav, .mp3, .m4a)"),
    language: z.string().default("en").describe("Language code (default: en)"),
  },
  async ({ audio_path, language }) => {
    const result = await transcribe(audio_path, language);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: quality_score
server.tool(
  "quality_score",
  "Analyze speech quality metrics of an audio file — pitch variation, energy, pacing, silence ratio. Detects robotic tone, monotone speech, and audio issues.",
  {
    audio_path: z.string().describe("Path to the audio file (.wav, .mp3, .m4a)"),
  },
  async ({ audio_path }) => {
    const result = await analyzeAudioQuality(audio_path);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: compare_tts
server.tool(
  "compare_tts",
  "Compare TTS audio output against expected text — identifies mispronunciations, inserted/deleted words, and Word Error Rate (WER)",
  {
    audio_path: z.string().describe("Path to the TTS audio file"),
    expected_text: z.string().describe("The text that was supposed to be spoken"),
    language: z.string().default("en").describe("Language code (default: en)"),
  },
  async ({ audio_path, expected_text, language }) => {
    const transcription = await transcribe(audio_path, language);
    const diff = compareTexts(expected_text, transcription.text);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ transcription, diff }, null, 2),
        },
      ],
    };
  },
);

// Tool: analyze_tts
server.tool(
  "analyze_tts",
  "Full TTS audio analysis — transcription, quality scores, pacing analysis, and optional mispronunciation detection. Returns a comprehensive report for debugging TTS issues.",
  {
    audio_path: z.string().describe("Path to the TTS audio file"),
    expected_text: z
      .string()
      .optional()
      .describe("Optional: the text that was supposed to be spoken (enables mispronunciation detection)"),
    language: z.string().default("en").describe("Language code (default: en)"),
  },
  async ({ audio_path, expected_text, language }) => {
    const transcription = await transcribe(audio_path, language);
    const quality = await analyzeAudioQuality(audio_path);
    const pacing = analyzePacing(transcription);
    const diff = expected_text
      ? compareTexts(expected_text, transcription.text)
      : null;

    const report = formatFullReport({
      audio_path,
      transcription,
      quality,
      pacing,
      diff,
    });

    return {
      content: [{ type: "text", text: report }],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
