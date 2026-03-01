export interface LearningCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface LearningProject {
  id: string;
  name: string;
  videoPath: string;
  subtitlePath: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  cues: LearningCue[];
}


