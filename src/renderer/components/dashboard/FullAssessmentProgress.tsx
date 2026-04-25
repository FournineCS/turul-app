// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { useAssessmentStore, type FullRunStage } from '../../stores/assessmentStore';
import './FullAssessmentProgress.css';

interface StepSpec {
  key: FullRunStage;
  label: string;
}

const STEPS: StepSpec[] = [
  { key: 'discovering', label: 'Discover services' },
  { key: 'scanning', label: 'Scan resources' },
  { key: 'analyzing', label: 'Analyze cost · security · compliance' },
  { key: 'finalizing', label: 'Build dashboard' },
];

const STAGE_INDEX: Record<FullRunStage, number> = {
  idle: -1,
  discovering: 0,
  scanning: 1,
  analyzing: 2,
  finalizing: 3,
  done: 4,
  error: -1,
};

export function FullAssessmentProgress() {
  const stage = useAssessmentStore((s) => s.fullRunStage);
  const percent = useAssessmentStore((s) => s.fullRunPercent);
  const message = useAssessmentStore((s) => s.fullRunMessage);
  const error = useAssessmentStore((s) => s.fullRunError);
  const resetFullRun = useAssessmentStore((s) => s.resetFullRun);

  if (stage === 'idle' || stage === 'done') return null;

  const isError = stage === 'error';
  const activeIndex = STAGE_INDEX[stage];

  return (
    <div className="full-assess-overlay" role="dialog" aria-modal="true" aria-labelledby="full-assess-title">
      <div className="full-assess-modal">
        <header className="full-assess-modal__header">
          <h2 id="full-assess-title" className="full-assess-modal__title">
            {isError ? 'Assessment failed' : 'Running your full assessment'}
          </h2>
          <p className="full-assess-modal__subtitle">
            {isError
              ? 'Something went wrong before we could finish. You can dismiss this and try again.'
              : 'You can keep using the app while this runs — we&rsquo;ll update widgets as data lands.'}
          </p>
        </header>

        {!isError && (
          <div className="full-assess-modal__bar" aria-hidden="true">
            <div
              className="full-assess-modal__bar-fill"
              style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
            />
          </div>
        )}

        <ol className="full-assess-modal__steps">
          {STEPS.map((step, index) => {
            const status =
              isError
                ? index < activeIndex
                  ? 'done'
                  : index === activeIndex
                  ? 'error'
                  : 'pending'
                : index < activeIndex
                ? 'done'
                : index === activeIndex
                ? 'active'
                : 'pending';
            return (
              <li key={step.key} className={`full-assess-step full-assess-step--${status}`}>
                <span className="full-assess-step__bullet" aria-hidden="true">
                  {status === 'done' ? '✓' : status === 'error' ? '!' : index + 1}
                </span>
                <span className="full-assess-step__label">{step.label}</span>
              </li>
            );
          })}
        </ol>

        <div className={`full-assess-modal__message${isError ? ' full-assess-modal__message--error' : ''}`}>
          {isError ? error || 'Unknown error' : message || 'Working...'}
        </div>

        {isError && (
          <div className="full-assess-modal__footer">
            <button type="button" className="btn btn-secondary" onClick={resetFullRun}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FullAssessmentProgress;
