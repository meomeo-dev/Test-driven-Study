import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readCourseTranscript } from '../api/courses';
import { AudioControls } from './AudioControls';
import type { DialogueLine } from './DialoguePlayer';

function DialogueLinesView({ lines }: { lines: DialogueLine[] }) {
  return (
    <div
      className="question-transcript-text"
      role="region"
      aria-label="本题逐字稿"
      tabIndex={0}
    >
      {lines.map((line, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '4px 0',
            lineHeight: '1.6',
          }}
        >
          {line.speaker && (
            <span style={{ fontWeight: 600, color: 'var(--primary)', minWidth: '22px' }}>
              {line.speaker}:
            </span>
          )}
          <span style={{ flex: 1 }}>{line.text}</span>
          <AudioControls
            text={line.speech || line.text}
            voice={line.voice}
            speed={line.speed}
          />
        </div>
      ))}
    </div>
  );
}

function TranscriptBody({
  dialogueLines,
  inlineText,
  script,
}: {
  dialogueLines?: DialogueLine[];
  inlineText?: string;
  script: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    data?: string;
    refetch: () => Promise<unknown>;
  };
}) {
  if (dialogueLines && dialogueLines.length > 0) {
    return <DialogueLinesView lines={dialogueLines} />;
  }
  if (inlineText) {
    return (
      <div
        className="question-transcript-text"
        role="region"
        aria-label="本题逐字稿"
        tabIndex={0}
        style={{ whiteSpace: 'pre-line' }}
      >
        {inlineText}
      </div>
    );
  }
  if (script.isPending) return <p role="status">正在读取逐字稿…</p>;
  if (script.isError) {
    return (
      <p role="alert">
        {script.error?.message}{' '}
        <button type="button" onClick={() => void script.refetch()}>
          重试
        </button>
      </p>
    );
  }
  return (
    <div
      className="question-transcript-text"
      role="region"
      aria-label="本题逐字稿"
      tabIndex={0}
    >
      {script.data}
    </div>
  );
}

export function ListeningTranscript({
  url,
  inlineText,
  dialogueLines,
}: {
  url?: string;
  inlineText?: string;
  dialogueLines?: DialogueLine[];
}) {
  const [expanded, setExpanded] = useState(false);
  const script = useQuery({
    queryKey: ['listening-transcript', url],
    queryFn: ({ signal }) => readCourseTranscript(url!, signal),
    enabled: expanded && Boolean(url),
    staleTime: Infinity,
    retry: false,
  });

  return (
    <details
      className="question-transcript"
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary>查看逐字稿</summary>
      {expanded && (
        <TranscriptBody
          dialogueLines={dialogueLines}
          inlineText={inlineText}
          script={script}
        />
      )}
    </details>
  );
}
