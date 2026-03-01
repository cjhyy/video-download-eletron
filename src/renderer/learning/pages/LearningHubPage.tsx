import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Input } from '@renderer/components/ui/input';
import { Separator } from '@renderer/components/ui/separator';
import { useLearningStore } from '../store/learningStore';
import { parseSrtToCues } from '../subtitles/parseSrt';
import { parseVttToCues } from '../subtitles/parseVtt';

function getBaseName(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  const file = normalized.split('/').pop() || normalized;
  return file.replace(/\.[^.]+$/, '');
}

function getExtLower(p: string): string {
  const m = p.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

const LearningHubPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = useLearningStore((s) => s.projects);
  const createProject = useLearningStore((s) => s.createProject);
  const deleteProject = useLearningStore((s) => s.deleteProject);

  const [videoPath, setVideoPath] = useState('');
  const [subtitlePath, setSubtitlePath] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = useMemo(() => !!videoPath && !!subtitlePath && !creating, [videoPath, subtitlePath, creating]);

  const handlePickVideo = async () => {
    const p = await window.electronAPI.selectVideoFile();
    if (!p) return;
    setVideoPath(p);
    if (!name.trim()) setName(getBaseName(p));
  };

  const handlePickSubtitle = async () => {
    const p = await window.electronAPI.selectSubtitleFile();
    if (!p) return;
    setSubtitlePath(p);
  };

  const handleCreate = async () => {
    if (!videoPath || !subtitlePath) return;
    setCreating(true);
    try {
      const raw = await window.electronAPI.readTextFile(subtitlePath);
      const ext = getExtLower(subtitlePath);
      const cues =
        ext === 'srt' ? parseSrtToCues(raw) : ext === 'vtt' ? parseVttToCues(raw) : [];

      if (cues.length === 0) {
        toast.error('字幕解析失败：未解析到任何句子（cue）');
        setCreating(false);
        return;
      }

      const id = createProject({
        name: name.trim() || getBaseName(videoPath),
        videoPath,
        subtitlePath,
        cues,
      });

      toast.success('学习项目已创建', { description: `共 ${cues.length} 句` });
      setVideoPath('');
      setSubtitlePath('');
      setName('');
      navigate(`/learning/${id}`);
    } catch (e: any) {
      toast.error(`创建失败: ${e?.message || '未知错误'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">英语训练</div>
        <div className="text-sm text-muted-foreground">
          独立学习模块：从本地视频 + 字幕创建句子训练项目（不影响下载器主流程）。
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>创建学习项目</CardTitle>
          <CardDescription>选择本地视频文件与字幕文件（SRT/VTT）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">项目名称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：TED - The power of habit" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">视频文件</div>
              <div className="flex gap-2">
                <Input readOnly value={videoPath} placeholder="未选择" />
                <Button variant="outline" onClick={handlePickVideo} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  选择
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">字幕文件（.srt/.vtt）</div>
              <div className="flex gap-2">
                <Input readOnly value={subtitlePath} placeholder="未选择" />
                <Button variant="outline" onClick={handlePickSubtitle} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  选择
                </Button>
              </div>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={!canCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {creating ? '创建中...' : '创建项目'}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>我的项目</CardTitle>
          <CardDescription>点击进入项目，按句查看字幕。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">还没有项目，先创建一个吧。</div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <button
                    className="min-w-0 text-left"
                    onClick={() => navigate(`/learning/${p.id}`)}
                    title={p.name}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.cues.length} 句 · {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      deleteProject(p.id);
                      toast.success('已删除项目');
                    }}
                    aria-label="删除项目"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LearningHubPage;


