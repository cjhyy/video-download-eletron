import type { LearningCue } from '../types';
import { parseTimestampToMs } from './parseTime';

function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

export function parseSrtToCues(raw: string): LearningCue[] {
  const text = stripBom(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return [];

  const blocks = text.split(/\n{2,}/g);
  const cues: LearningCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Optional index line
    let idx = 0;
    if (/^\d+$/.test(lines[0])) idx = 1;
    const timeLine = lines[idx];
    const m = timeLine.match(/^(.+?)\s*-->\s*(.+?)(?:\s+.*)?$/);
    if (!m) continue;

    const startMs = parseTimestampToMs(m[1]);
    const endMs = parseTimestampToMs(m[2]);
    const textLines = lines.slice(idx + 1);
    const cueText = textLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!cueText) continue;

    cues.push({
      id: `cue-${cues.length + 1}`,
      startMs,
      endMs,
      text: cueText,
    });
  }

  return cues;
}


