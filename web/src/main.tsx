import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router';
import { MemorizationPage } from './features/memorization/MemorizationPage';
import { PracticePage } from './features/practice/PracticePage';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { PalacePage } from './features/palace/PalacePage';
import { GuidePage } from './features/guide/GuidePage';
import { ExamPage } from './features/exam/ExamPage';
import { LearningPage } from './features/learning/LearningPage';
import { readSubject, useCatalog } from './app/workspace';
import { ThemeProvider } from './components/ThemeToggle';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/study.css';
import './features/question-navigation/question-navigation.css';
import './styles/practice.css';
import './styles/analysis.css';
import './styles/responsive.css';
import './styles/palace.css';
import './styles/tasks.css';
import './styles/guide.css';
import './styles/trace.css';
import './styles/provider-settings.css';
import './styles/exam.css';
import './features/question-types/question-types.css';
import './features/learning/learning.css';

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const CourseCatalog = React.lazy(() => import('./features/courses/CoursePages')
  .then(module => ({ default: module.CourseCatalogPage })));
const Course = React.lazy(() => import('./features/courses/CoursePages')
  .then(module => ({ default: module.CoursePage })));

function ActiveCourseWorkspace() {
  const [params] = useSearchParams();
  const subject = readSubject(params);
  const catalog = useCatalog();
  if (!subject) return <Navigate to="/courses" replace />;
  if (catalog.isPending) return <p role="status">正在读取课程…</p>;
  if (catalog.error) return <p role="alert">{catalog.error.message}</p>;
  const active = catalog.data?.some(course =>
    course.units.some(unit => unit.subject_id === subject));
  return active ? <Outlet /> : <Navigate to="/courses" replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider><QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/courses" replace />} />
          <Route element={<ActiveCourseWorkspace />}>
            <Route path="/memorize" element={<MemorizationPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/palace" element={<PalacePage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/exam" element={<ExamPage />} />
            <Route path="/learning" element={<LearningPage />} />
          </Route>
          <Route path="/courses" element={<React.Suspense><CourseCatalog /></React.Suspense>} />
          <Route path="/courses/:courseId/:unitId?" element={<React.Suspense>
            <Course />
          </React.Suspense>} />
          <Route path="*" element={<Navigate to="/courses" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider></ThemeProvider>
  </React.StrictMode>,
);
