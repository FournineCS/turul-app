// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { Link } from 'react-router-dom';
import { useAssessmentStore } from '../../stores/assessmentStore';
import { useProviderStore } from '../../stores/providerStore';
import { useProfileStore } from '../../stores/profileStore';
import { useGCPProjectStore } from '../../stores/gcpProjectStore';
import './QuickAssessCard.css';

interface PillarSpec {
  key: 'resources' | 'cost' | 'security' | 'compliance';
  title: string;
  description: string;
  glyph: string;
}

const PILLARS: PillarSpec[] = [
  {
    key: 'resources',
    title: 'Resources',
    description: 'Discover what you have',
    glyph: '◇',
  },
  {
    key: 'cost',
    title: 'Cost',
    description: 'See where money goes',
    glyph: '$',
  },
  {
    key: 'security',
    title: 'Security',
    description: 'Find risky misconfig',
    glyph: '⛨',
  },
  {
    key: 'compliance',
    title: 'Compliance',
    description: 'CIS controls coverage',
    glyph: '✓',
  },
];

interface QuickAssessCardProps {
  variant?: 'hero' | 'compact';
}

export function QuickAssessCard({ variant = 'hero' }: QuickAssessCardProps) {
  const fullRunStage = useAssessmentStore((s) => s.fullRunStage);
  const runFullAssessment = useAssessmentStore((s) => s.runFullAssessment);
  const provider = useProviderStore((s) => s.selectedProvider);
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);

  const isRunning =
    fullRunStage !== 'idle' && fullRunStage !== 'done' && fullRunStage !== 'error';
  const identityMissing =
    provider === 'aws' ? !selectedProfileName : !selectedProjectId;
  const disabled = isRunning || identityMissing;

  const handleClick = () => {
    if (disabled) return;
    void runFullAssessment(provider);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        className="btn btn-primary quick-assess-compact"
        onClick={handleClick}
        disabled={disabled}
        title={
          identityMissing
            ? `Select ${provider === 'aws' ? 'an AWS profile' : 'a GCP project'} first`
            : 'Run a full account assessment'
        }
      >
        {isRunning ? 'Assessment running...' : 'Re-run Full Assessment'}
      </button>
    );
  }

  return (
    <section className="quick-assess-card" aria-labelledby="quick-assess-heading">
      <div className="quick-assess-card__inner">
        <div className="quick-assess-card__lead">
          <span className="quick-assess-card__eyebrow">
            {provider === 'aws' ? 'AWS account' : 'GCP project'}
          </span>
          <h2 id="quick-assess-heading" className="quick-assess-card__title">
            See the health of your whole {provider === 'aws' ? 'account' : 'project'} in one click.
          </h2>
          <p className="quick-assess-card__subtitle">
            We&rsquo;ll discover your active services, scan resources, and analyze cost,
            security, and compliance — no setup, no per-page wandering.
          </p>

          <div className="quick-assess-card__actions">
            <button
              type="button"
              className="btn btn-primary btn-lg quick-assess-card__cta"
              onClick={handleClick}
              disabled={disabled}
            >
              {isRunning ? 'Running assessment…' : 'Assess my account fully'}
            </button>
            <Link to="/assessment" className="quick-assess-card__secondary">
              Customize instead →
            </Link>
          </div>

          {identityMissing && (
            <p className="quick-assess-card__hint">
              Select {provider === 'aws' ? 'an AWS profile' : 'a GCP project'} from the
              top bar to enable this.
            </p>
          )}
        </div>

        <ul className="quick-assess-card__pillars">
          {PILLARS.map((pillar) => (
            <li key={pillar.key} className="quick-assess-card__pillar">
              <span className="quick-assess-card__pillar-glyph" aria-hidden="true">
                {pillar.glyph}
              </span>
              <div>
                <div className="quick-assess-card__pillar-title">{pillar.title}</div>
                <div className="quick-assess-card__pillar-desc">{pillar.description}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default QuickAssessCard;
