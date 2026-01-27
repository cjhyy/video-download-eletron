import type { LearningCue } from '../types';
import { parseTimestampToMs } from './parseTime';

function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

export function parseVttToCues(raw: string): LearningCue[] {
  const text = stripBom(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const cues: LearningCue[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    if (!line) continue;
    if (line === 'WEBVTT') continue;
    if (line.startsWith('NOTE')) {
      // skip NOTE blocks until blank line
      while (i < lines.length && lines[i].trim() !== '') i++;
      continue;
    }

    // cue identifier (optional)
    let timeLine = line;
    if (!timeLine.includes('-->') && i < lines.length) {
      timeLine = lines[i].trim();
      i++;
    }

    const m = timeLine.match(/^(.+?)\s*-->\s*(.+?)(?:\s+.*)?$/);
    if (!m) continue;

    const startMs = parseTimestampToMs(m[1]);
    const endMs = parseTimestampToMs(m[2]);

    const textLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i];
      i++;
      if (!t.trim()) break;
      textLines.push(t.trim());
    }

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


