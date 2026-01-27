import type { VideoInfo, VideoFormat } from '../shared/electron';

export function getFormattedVideoFormats(videoInfo: VideoInfo | null): VideoFormat[] {
  if (!videoInfo) {
    console.log('[格式列表] videoInfo 为空');
    return [];
  }

  console.log('[格式列表] 原始 formats 数量:', videoInfo.formats.length);
  console.log('[格式列表] 原始 formats 示例:', videoInfo.formats.slice(0, 5));

  // 过滤出有分辨率的格式（包括YouTube分离的视频流）
  let validFormats = videoInfo.formats.filter((f) => {
    // 排除 storyboard（故事板缩略图）
    if (f.format_note?.toLowerCase().includes('storyboard') || f.ext === 'mhtml') {
      return false;
    }
    // 排除同时没有音视频编码的格式
    if (f.vcodec === 'none' && f.acodec === 'none') {
      return false;
    }
    // 只保留有分辨率信息的格式（YouTube的4K等高分辨率视频流可能vcodec不为none但acodec为none）
    return !!(f.height && f.height > 0);
  });

  console.log('[格式列表] 过滤后有分辨率的格式数量:', validFormats.length);

  if (validFormats.length > 0) {
    console.log(
      '[格式列表] 包含的分辨率:',
      [...new Set(validFormats.map((f) => f.height))].sort((a, b) => (b ?? 0) - (a ?? 0))
    );
  }

  // 如果没有分辨率信息，使用宽松条件
  if (validFormats.length === 0) {
    console.log('[格式列表] 无分辨率信息，使用宽松条件');
    validFormats = videoInfo.formats.filter((f) => {
      return !!(f.ext && f.format_note);
    });
    console.log('[格式列表] 宽松过滤后有效格式数量:', validFormats.length);
  }

  // 如果还是没有，返回前15个
  if (validFormats.length === 0) {
    console.warn('[格式列表] 所有过滤条件都无结果，返回原始前15个格式');
    return videoInfo.formats.slice(0, 15);
  }

  // 按分辨率降序排序
  const sortedFormats = validFormats.sort((a, b) => {
    const heightA = a.height || 0;
    const heightB = b.height || 0;
    return heightB - heightA;
  });

  // 去重：对于相同分辨率和扩展名，只保留一个
  const uniqueFormats: VideoFormat[] = [];
  const seenResolutions = new Set<string>();

  sortedFormats.forEach((format) => {
    const resolution = format.height ? `${format.height}p` : format.format_note || 'unknown';
    const ext = format.ext || 'unknown';
    const key = `${resolution}-${ext}`;

    // 优先保留有音视频合并的格式，如果没有则保留视频流（原逻辑是“第一个出现的”）
    if (!seenResolutions.has(key)) {
      seenResolutions.add(key);
      uniqueFormats.push(format);
    }
  });

  console.log('[格式列表] 去重后格式数量:', uniqueFormats.length);
  console.log(
    '[格式列表] 最终格式列表:',
    uniqueFormats.map((f) => ({
      format_id: f.format_id,
      height: f.height,
      width: f.width,
      ext: f.ext,
      vcodec: f.vcodec,
      acodec: f.acodec,
      format_note: f.format_note,
      filesize: f.filesize || f.filesize_approx,
    }))
  );

  return uniqueFormats;
}




