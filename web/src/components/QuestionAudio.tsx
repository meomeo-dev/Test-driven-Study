import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { courseAsset, readCourseTranscript } from '../api/courses';

export function QuestionAudio({ question }: {
  question: {
    audio_url?: string; transcript_url?: string; package_id?: string; package_version?: string;
  };
}) {
  const { audio_url: audio, transcript_url: transcript, package_id: course,
    package_version: version } = question;
  if (!audio || !course || !version) return null;
  const src = courseAsset(course, version, audio);
  const transcriptSrc = transcript && courseAsset(course, version, transcript);
  return <div className="question-listening">
    <audio className="question-audio" aria-label="本题听力录音"
      src={src} controls preload="metadata" />
    {transcriptSrc && <ListeningTranscript key={transcriptSrc} url={transcriptSrc} />}
  </div>;
}

function ListeningTranscript({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  const script = useQuery({
    queryKey: ['listening-transcript', url],
    queryFn: ({ signal }) => readCourseTranscript(url, signal),
    enabled: expanded,
    staleTime: Infinity,
    retry: false,
  });
  return <details className="question-transcript"
    onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>查看逐字稿</summary>
    {expanded && (script.isPending ? <p role="status">正在读取逐字稿…</p>
      : script.isError ? <p role="alert">{script.error.message}{' '}
        <button type="button" onClick={() => void script.refetch()}>重试</button>
      </p>
        : <div className="question-transcript-text" role="region" aria-label="本题逐字稿"
          tabIndex={0}>{script.data}</div>)}
  </details>;
}
