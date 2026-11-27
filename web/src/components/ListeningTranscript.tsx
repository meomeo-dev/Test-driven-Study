import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readCourseTranscript } from '../api/courses';
import type { RichText } from '../api/generated/types.gen';
import { AudioControls } from './AudioControls';
import type { DialogueLine } from './DialoguePlayer';
import { StudyPassage } from './StudyPassage';

export type ListeningStudyTranslation = {
  material: string[];
  passage?: RichText;
  visible: boolean;
};

function DialogueLinesView({
  lines,
  studyTranslation,
}: {
  lines: DialogueLine[];
  studyTranslation?: ListeningStudyTranslation;
}) {
  const [firstLine] = lines;
  const translations = studyTranslation?.visible
    && studyTranslation.material.length === lines.length
    ? studyTranslation.material
    : undefined;
  return (
    <div
      className="question-transcript-text"
      role="region"
      aria-label="本题逐字稿"
      tabIndex={0}
    >
      {studyTranslation?.passage && firstLine && lines.length === 1 ? (
        <>
          <StudyPassage
            passage={studyTranslation.passage}
            translations={studyTranslation.material}
            showTranslation={studyTranslation.visible}
          />
          <AudioControls
            text={firstLine.speech || firstLine.text}
            voice={firstLine.voice}
            speed={firstLine.speed}
          />
        </>
      ) : lines.map((line, idx) => (
        <div key={idx} className="transcript-line">
          {line.speaker && (
            <span className="transcript-speaker">{line.speaker}:</span>
          )}
          <span className="transcript-content">
            <span>{line.text}</span>
            {translations && (
              <span className="study-translation" lang="zh-Hans">{translations[idx]}</span>
            )}
          </span>
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
  studyTranslation,
}: {
  dialogueLines?: DialogueLine[];
  inlineText?: string;
  studyTranslation?: ListeningStudyTranslation;
  script: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    data?: string;
    refetch: () => Promise<unknown>;
  };
}) {
  if (dialogueLines && dialogueLines.length > 0) {
    return <DialogueLinesView lines={dialogueLines} studyTranslation={studyTranslation} />;
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
  studyTranslation,
}: {
  url?: string;
  inlineText?: string;
  dialogueLines?: DialogueLine[];
  studyTranslation?: ListeningStudyTranslation;
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
      <summary>{studyTranslation?.visible ? '查看英中逐字稿' : '查看逐字稿'}</summary>
      {expanded && (
        <TranscriptBody
          dialogueLines={dialogueLines}
          inlineText={inlineText}
          script={script}
          studyTranslation={studyTranslation}
        />
      )}
    </details>
  );
}
