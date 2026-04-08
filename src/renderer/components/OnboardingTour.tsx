// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '.sidebar-provider-toggle',
    title: 'Cloud Provider',
    description: 'Switch between AWS and GCP. The sidebar, top bar, and all pages adapt to your selected provider.',
    placement: 'right',
  },
  {
    target: '.global-profile-selector',
    title: 'Profile / Project Selector',
    description: 'Select your AWS profile or GCP project here. All pages use this selection as the active context.',
    placement: 'bottom',
  },
  {
    target: '.nav-section-label',
    title: 'Navigation Sections',
    description: 'Features are organized into Discovery, Cost & Optimization, Security & Compliance, Assessment & Reports, and AI Assistant.',
    placement: 'right',
  },
  {
    target: '[href="/scan"]',
    title: 'Scan Resources',
    description: 'Start here — scan your cloud accounts to discover resources. Select regions and services, then run a scan.',
    placement: 'right',
  },
  {
    target: '[href="/costs"]',
    title: 'Cost Analysis',
    description: 'Analyze spending by service, region, and time period. AWS uses Cost Explorer; GCP uses BigQuery billing data.',
    placement: 'right',
  },
  {
    target: '[href="/security"]',
    title: 'Security & Compliance',
    description: 'Run security scans, best practice checks, and compliance assessments. View findings by severity with remediation guidance.',
    placement: 'right',
  },
  {
    target: '[href="/assessment"]',
    title: 'Assessment',
    description: 'Get an overall grade (A–F) across Cost, Security, Reliability, Compliance, and IAM. Results appear on the Dashboard.',
    placement: 'right',
  },
  {
    target: '[href="/topology"]',
    title: 'Architecture Diagrams',
    description: 'Visualize your infrastructure with Network, Application, Data, and Full Topology views after running a scan.',
    placement: 'right',
  },
  {
    target: '.sidebar-footer',
    title: 'Settings & Account',
    description: 'Configure app settings, manage AWS profiles, change your password, or lock the app from here.',
    placement: 'right',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardingTour: React.FC<Props> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    } else {
      setSpotlightRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [isOpen, currentStep, updateSpotlight]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    setCurrentStep(0);
    onClose();
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') handleFinish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, currentStep]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  // Calculate tooltip position
  const pad = 12;
  const tooltipStyle: React.CSSProperties = { position: 'fixed', zIndex: 10002 };

  if (spotlightRect) {
    switch (step.placement) {
      case 'right':
        tooltipStyle.left = spotlightRect.right + pad;
        tooltipStyle.top = spotlightRect.top + spotlightRect.height / 2;
        tooltipStyle.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        tooltipStyle.left = spotlightRect.left + spotlightRect.width / 2;
        tooltipStyle.top = spotlightRect.bottom + pad;
        tooltipStyle.transform = 'translateX(-50%)';
        break;
      case 'left':
        tooltipStyle.right = window.innerWidth - spotlightRect.left + pad;
        tooltipStyle.top = spotlightRect.top + spotlightRect.height / 2;
        tooltipStyle.transform = 'translateY(-50%)';
        break;
      case 'top':
        tooltipStyle.left = spotlightRect.left + spotlightRect.width / 2;
        tooltipStyle.bottom = window.innerHeight - spotlightRect.top + pad;
        tooltipStyle.transform = 'translateX(-50%)';
        break;
    }
  } else {
    // Fallback: center on screen
    tooltipStyle.left = '50%';
    tooltipStyle.top = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <>
      {/* Overlay */}
      <div className="tour-overlay" onClick={handleFinish} />

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlightRect.top - 6,
            left: spotlightRect.left - 6,
            width: spotlightRect.width + 12,
            height: spotlightRect.height + 12,
          }}
        />
      )}

      {/* Tooltip */}
      <div ref={tooltipRef} className="tour-tooltip" style={tooltipStyle}>
        <div className="tour-tooltip-header">
          <span className="tour-step-badge">
            {currentStep + 1} / {TOUR_STEPS.length}
          </span>
          <button className="tour-close-btn" onClick={handleFinish} title="Close tour">
            &times;
          </button>
        </div>
        <h3 className="tour-tooltip-title">{step.title}</h3>
        <p className="tour-tooltip-desc">{step.description}</p>
        <div className="tour-tooltip-actions">
          {currentStep > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handlePrev}>
              Back
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleNext}>
            {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
        {/* Progress dots */}
        <div className="tour-dots">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`tour-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;
