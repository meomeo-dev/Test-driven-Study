import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { courseAsset, readCourseTranscript } from '../api/courses';
import { AudioControls } from './AudioControls';

function speechTextFromTranscript(transcript: string): string {
  return transcript
    .split('\n')
    .map(line => line.replace(/^[a-zA-Z0-9_\u4e00-\u9fa5]+:\s*/, '').trim())
    .filter(Boolean)
    .join(' ');
}

export function QuestionAudio({ question }: {
  question: {
    audio_url?: string; transcript_url?: string; package_id?: string; package_version?: string;
  };
}) {
  const { audio_url: audio, transcript_url: transcript, package_id: course,
    package_version: version } = question;
  if (!course || !version || (!audio && !transcript)) return null;
  const isPath = Boolean(transcript && (transcript.startsWith('assets/') || transcript.endsWith('.txt')));
  const src = audio ? courseAsset(course, version, audio) : undefined;
  const transcriptSrc = isPath ? courseAsset(course, version, transcript!) : undefined;
  const inlineTranscript = !isPath ? transcript : undefined;
  const ttsText = inlineTranscript ? speechTextFromTranscript(inlineTranscript) : undefined;

  return <div className="question-listening">
    {src ? (
      <audio className="question-audio" aria-label="本题听力录音"
        src={src} controls preload="metadata" />
    ) : ttsText ? (
      <div className="question-listening-bar" role="region" aria-label="听力音频播放">
        <span className="listening-bar-label">听力录音</span>
        <AudioControls text={ttsText} voice="stella" />
      </div>
    ) : null}
    {transcript && <ListeningTranscript url={transcriptSrc} inlineText={inlineTranscript} />}
  </div>;
}

function ListeningTranscript({ url, inlineText }: { url?: string; inlineText?: string }) {
  const [expanded, setExpanded] = useState(false);
  const script = useQuery({
    queryKey: ['listening-transcript', url],
    queryFn: ({ signal }) => readCourseTranscript(url!, signal),
    enabled: expanded && Boolean(url),
    staleTime: Infinity,
    retry: false,
  });
  return <details className="question-transcript"
    onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>查看逐字稿</summary>
    {expanded && (
      inlineText ? <div className="question-transcript-text" role="region" aria-label="本题逐字稿"
        tabIndex={0} style={{ whiteSpace: 'pre-line' }}>{inlineText}</div>
      : script.isPending ? <p role="status">正在读取逐字稿…</p>
      : script.isError ? <p role="alert">{script.error.message}{' '}
        <button type="button" onClick={() => void script.refetch()}>重试</button>
      </p>
      : <div className="question-transcript-text" role="region" aria-label="本题逐字稿"
        tabIndex={0}>{script.data}</div>
    )}
  </details>;
}
