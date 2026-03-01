import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Input } from '@renderer/components/ui/input';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { Separator } from '@renderer/components/ui/separator';
import { useLearningStore } from '../store/learningStore';
import { toFileUrl } from '../utils/fileUrl';
import type { LearningCue } from '../types';

const LearningProjectPage: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const getProject = useLearningStore((s) => s.getProject);
  const project = projectId ? getProject(projectId) : undefined;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeCueId, setActiveCueId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    if (!project) {
      // If user refreshes and store not hydrated yet, this will re-render once hydrated.
      // If still missing, keep page but show message.
    }
  }, [projectId, project]);

  const filteredCues = useMemo(() => {
    if (!project) return [];
    const q = query.trim().toLowerCase();
    if (!q) return project.cues;
    return project.cues.filter((c) => c.text.toLowerCase().includes(q));
  }, [project, query]);

  const playCue = async (cue: LearningCue) => {
    const v = videoRef.current;
    if (!v) return;
    setActiveCueId(cue.id);
    try {
      v.currentTime = Math.max(0, cue.startMs / 1000);
      await v.play();
      // M1: best-effort stop near endMs
      const durationMs = Math.max(200, cue.endMs - cue.startMs);
      window.setTimeout(() => {
        const vv = videoRef.current;
        if (!vv) return;
        // Only stop if user is still on the same cue
        if (activeCueId === cue.id) vv.pause();
      }, Math.min(durationMs, 10_000)); // guard to avoid super long timeouts
    } catch {
      // ignore
    }
  };

  if (!project) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Button variant="ghost" className="gap-2 w-fit" onClick={() => navigate('/learning')}>
          <ArrowLeft className="h-4 w-4" />
          返回英语训练
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>项目不存在</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            可能是项目被删除，或尚未加载完成。请返回列表重新进入。
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="gap-2" onClick={() => navigate('/learning')}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-semibold">{project.name}</div>
          <div className="truncate text-xs text-muted-foreground">{project.videoPath}</div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">视频预览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <video
            ref={videoRef}
            controls
            className="w-full rounded-lg border bg-black"
            src={toFileUrl(project.videoPath)}
          />
          <div className="text-xs text-muted-foreground">
            点击下方任意句子，视频将跳转到该句起点并播放（M1：简单播放，后续 M2 加循环/遮字幕）。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">句子列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索句子..." />
          <Separator />
          <ScrollArea className="h-[420px] rounded-md border">
            <div className="p-2 space-y-2">
              {filteredCues.map((cue) => {
                const active = cue.id === activeCueId;
                return (
                  <button
                    key={cue.id}
                    onClick={() => void playCue(cue)}
                    className={[
                      'w-full text-left rounded-md border p-3 hover:bg-muted/30 transition-colors',
                      active ? 'border-primary bg-primary/5' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-snug">{cue.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(cue.startMs / 1000).toFixed(3)}s → {(cue.endMs / 1000).toFixed(3)}s
                        </div>
                      </div>
                      <div className="shrink-0">
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Play className="h-3.5 w-3.5" />
                          播放
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredCues.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">未找到匹配句子</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LearningProjectPage;


