// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useScanStore } from './stores/scanStore';
import { useAuthStore } from './stores/authStore';
import { useProfileStore } from './stores/profileStore';
import { useProviderStore } from './stores/providerStore';

// Lazy-loaded pages for faster initial load
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const TopologyPage = lazy(() => import('./pages/TopologyPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const CostsPage = lazy(() => import('./pages/CostsPage'));
const AWSOptimizationPage = lazy(() => import('./pages/AWSOptimizationPage'));
const EKSCostsPage = lazy(() => import('./pages/EKSCostsPage'));
const GCPOptimizationPage = lazy(() => import('./pages/GCPOptimizationPage'));
const GKECostsPage = lazy(() => import('./pages/GKECostsPage'));
const CreditsPage = lazy(() => import('./pages/CreditsPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const WellArchitectedPage = lazy(() => import('./pages/WellArchitectedPage'));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));
const TagGovernancePage = lazy(() => import('./pages/TagGovernancePage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const IAMAnalysisPage = lazy(() => import('./pages/IAMAnalysisPage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const NetworkAnalysisPage = lazy(() => import('./pages/NetworkAnalysisPage'));
const ComparisonPage = lazy(() => import('./pages/ComparisonPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
import AuthGuard from './components/auth/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import GlobalLoadingBar from './components/GlobalLoadingBar';
import GlobalProfileSelector from './components/GlobalProfileSelector';
import { useSettingsStore } from './stores/settingsStore';
import ChangePasswordModal from './components/auth/ChangePasswordModal';
import ManageProfilesModal from './components/profiles/ManageProfilesModal';
import './styles/auth.css';
import './styles/profiles.css';
import './styles/chat.css';
import ChatFab from './components/chat/ChatFab';
import ChatPanel from './components/chat/ChatPanel';
import OnboardingTour from './components/OnboardingTour';

// Icons
const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
);

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const ResourcesIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
  </svg>
);

const ArchitectureIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h2v2h-2v2h-2v-2h-2v-2h2v-2h2v2zm0 4h2v4h-4v-2h2v-2z" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
  </svg>
);

const ReportsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
  </svg>
);

const CostsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
  </svg>
);

const SecurityIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
  </svg>
);

const WellArchitectedIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" />
  </svg>
);

const TagsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
  </svg>
);

const ComparisonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 14H2v2h7v3l4-4-4-4v3zm6-1V10h7V8h-7V5l-4 4 4 4z" />
  </svg>
);

const ComplianceIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
  </svg>
);

const IAMIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const ScheduleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </svg>
);

const AssessmentIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
  </svg>
);

const CloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
  </svg>
);

const OptimizationIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" />
  </svg>
);

const ChatBotIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
  </svg>
);

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
  </svg>
);

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
  </svg>
);

import type { CloudProvider } from '../shared/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.FC;
  providers: CloudProvider[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',        label: 'Dashboard',       icon: DashboardIcon,      providers: ['aws', 'gcp'] },
  { path: '/chat',             label: 'AI Chat',         icon: ChatBotIcon,        providers: ['aws', 'gcp'], section: 'AI Assistant' },
  { path: '/scan',             label: 'Scan',            icon: ScanIcon,           providers: ['aws', 'gcp'], section: 'Discovery' },
  { path: '/resources',        label: 'Resources',       icon: ResourcesIcon,      providers: ['aws', 'gcp'] },
  { path: '/topology',         label: 'Architecture',    icon: ArchitectureIcon,   providers: ['aws', 'gcp'] },
  { path: '/history',          label: 'History',         icon: HistoryIcon,        providers: ['aws', 'gcp'] },
  { path: '/comparison',       label: 'Comparison',      icon: ComparisonIcon,     providers: ['aws', 'gcp'] },
  { path: '/costs',            label: 'Costs',           icon: CostsIcon,          providers: ['aws', 'gcp'], section: 'Cost & Optimization' },
  { path: '/aws-optimization', label: 'AWS Optimization', icon: OptimizationIcon,  providers: ['aws'] },
  { path: '/eks-costs',        label: 'EKS Costs',        icon: CostsIcon,         providers: ['aws'] },
  { path: '/gcp-optimization', label: 'GCP Optimization', icon: OptimizationIcon,  providers: ['gcp'] },
  { path: '/gke-costs',        label: 'GKE Costs',         icon: CostsIcon,         providers: ['gcp'] },
  { path: '/credits',          label: 'Credits',          icon: CostsIcon,         providers: ['aws', 'gcp'] },
  { path: '/security',         label: 'Security',        icon: SecurityIcon,       providers: ['aws', 'gcp'], section: 'Security & Compliance' },
  { path: '/well-architected', label: 'Well-Architected', icon: WellArchitectedIcon, providers: ['aws', 'gcp'] },
  { path: '/tags',             label: 'Tag Governance',  icon: TagsIcon,           providers: ['aws', 'gcp'] },
  { path: '/iam-analysis',     label: 'IAM Analysis',    icon: IAMIcon,            providers: ['aws', 'gcp'] },
  { path: '/network-analysis', label: 'Network Analysis', icon: NetworkIcon,        providers: ['gcp'] },
  { path: '/compliance',       label: 'Compliance',      icon: ComplianceIcon,     providers: ['aws', 'gcp'] },
  { path: '/schedule',         label: 'Schedules',       icon: ScheduleIcon,       providers: ['aws', 'gcp'] },
  { path: '/assessment',       label: 'Assessment',      icon: AssessmentIcon,     providers: ['aws', 'gcp'], section: 'Assessment & Reports' },
  { path: '/reports',          label: 'Reports',         icon: ReportsIcon,        providers: ['aws', 'gcp'] },
];

const AWS_ONLY_PATHS = new Set(
  NAV_ITEMS.filter(item => !item.providers.includes('gcp')).map(item => item.path)
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
  </svg>
);

const SystemThemeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h12v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z" />
  </svg>
);

const ThemeToggleButton: React.FC = () => {
  const theme = useSettingsStore((s) => s.settings.theme);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);

  const icon = theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <SystemThemeIcon />;
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';

  return (
    <button
      className="theme-toggle-btn"
      onClick={cycleTheme}
      title={`Theme: ${label} (click to cycle)`}
    >
      {icon}
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
};

const AppContent: React.FC = () => {
  const { updateProgress } = useScanStore();
  const { logout } = useAuthStore();
  const { profiles, selectedProfileName, setSelectedProfileName, loadProfiles } = useProfileStore();
  const { selectedProvider, setProvider } = useProviderStore();
  const isAws = selectedProvider === 'aws';
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isManageProfilesOpen, setIsManageProfilesOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (window.electronAPI?.scan?.onProgress) {
      const unsubscribe = window.electronAPI.scan.onProgress(updateProgress);
      return () => unsubscribe();
    }
  }, [updateProgress]);

  useEffect(() => {
    loadProfiles();
    // Load settings on startup (applies saved theme)
    useSettingsStore.getState().loadSettings();
    // Restore persisted provider selection
    window.electronAPI?.settings?.get('selectedProvider').then((result) => {
      if (result?.success && (result.data === 'gcp' || result.data === 'aws')) {
        useProviderStore.getState().setProvider(result.data as CloudProvider);
      }
    }).catch(() => {});
  }, [loadProfiles]);

  // Auto-select global profile on startup after profiles load
  useEffect(() => {
    if (profiles.length === 0 || selectedProfileName) return;
    const settings = useSettingsStore.getState().settings;
    const defaultName = settings.defaultProfile;
    if (defaultName && profiles.some((p) => p.name === defaultName)) {
      setSelectedProfileName(defaultName);
    } else {
      setSelectedProfileName(profiles[0].name);
    }
  }, [profiles, selectedProfileName, setSelectedProfileName]);

  // Auto-launch onboarding tour for first-time users
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    window.electronAPI?.settings?.get('onboardingCompleted').then((result) => {
      if (!result?.success || !result.data) {
        // Short delay to let the UI render before showing tour
        timer = setTimeout(() => setIsTourOpen(true), 800);
      }
    }).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  const handleTourClose = useCallback(() => {
    setIsTourOpen(false);
    window.electronAPI?.settings?.set('onboardingCompleted', 'true').catch(() => {});
  }, []);

  // Redirect to dashboard when switching to GCP while on an AWS-only page
  useEffect(() => {
    if (selectedProvider !== 'aws' && AWS_ONLY_PATHS.has(location.pathname)) {
      navigate('/dashboard', { replace: true });
    }
  }, [selectedProvider, location.pathname, navigate]);

  const handleProfilesChanged = useCallback(() => {
    loadProfiles();
  }, [loadProfiles]);

  const awsOnly = (element: React.ReactElement) =>
    selectedProvider === 'aws' ? element : <Navigate to="/dashboard" replace />;

  // Build filtered nav items with section labels
  const filteredItems = NAV_ITEMS.filter(item => item.providers.includes(selectedProvider));
  const emittedSections = new Set<string>();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <CloudIcon />
            <div>
              <span>Turul</span>
              <div className="sidebar-subtitle">Cloud Resource Analyzer</div>
            </div>
          </div>
        </div>
        <div className="sidebar-provider-toggle">
          <button
            className={`sidebar-provider-btn ${isAws ? 'active' : ''}`}
            onClick={() => setProvider('aws')}
          >
            AWS
          </button>
          <button
            className={`sidebar-provider-btn ${!isAws ? 'active' : ''}`}
            onClick={() => setProvider('gcp')}
          >
            GCP
          </button>
        </div>
        <nav className="sidebar-nav">
          {filteredItems.map((item) => {
            // Determine the section for this item by scanning all NAV_ITEMS up to (and including) this one
            let currentSection: string | undefined;
            for (const ni of NAV_ITEMS) {
              if (ni.section) currentSection = ni.section;
              if (ni.path === item.path) break;
            }
            let sectionLabel: string | null = null;
            if (currentSection && !emittedSections.has(currentSection)) {
              emittedSections.add(currentSection);
              sectionLabel = currentSection;
            }
            const isCollapsed = currentSection ? collapsedSections.has(currentSection) : false;
            // Dashboard (no section) is never collapsed
            const isTopLevel = !currentSection;
            const Icon = item.icon;
            return (
              <React.Fragment key={item.path}>
                {sectionLabel && (
                  <button
                    className="nav-section-label nav-section-toggle"
                    onClick={() => toggleSection(sectionLabel!)}
                  >
                    <span>{sectionLabel}</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      width="12"
                      height="12"
                      className={`nav-section-chevron ${isCollapsed ? 'collapsed' : ''}`}
                    >
                      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                    </svg>
                  </button>
                )}
                {(isTopLevel || !isCollapsed) && (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </NavLink>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-footer-btn ${isActive ? 'active' : ''}`}
            title="App Settings"
          >
            <SettingsIcon />
            <span>Settings</span>
          </NavLink>
          {isAws && (
            <button
              className="sidebar-footer-btn"
              onClick={() => setIsManageProfilesOpen(true)}
              title="Manage AWS Profiles"
            >
              <SettingsIcon />
              <span>Manage Profiles</span>
            </button>
          )}
          <button
            className="sidebar-footer-btn"
            onClick={() => setIsChangePasswordOpen(true)}
            title="Change Password"
          >
            <SecurityIcon />
            <span>Change Password</span>
          </button>
          <button
            className="sidebar-footer-btn"
            onClick={logout}
            title="Lock App"
          >
            <LogoutIcon />
            <span>Lock</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <GlobalProfileSelector />
          <div className="top-bar-actions">
            <ThemeToggleButton />
            <button
              className="top-bar-icon-btn"
              onClick={() => window.electronAPI?.shell?.openExternal?.('https://github.com/FournineCS/turul-app/issues/new/choose') || window.open('https://github.com/FournineCS/turul-app/issues/new/choose', '_blank')}
              title="Report a bug or request a feature"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" />
              </svg>
            </button>
            <button
              className="top-bar-icon-btn"
              onClick={() => setIsTourOpen(true)}
              title="Start guided tour"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </button>
            <button
              className="top-bar-icon-btn"
              onClick={() => navigate('/help')}
              title="Help & User Guide"
            >
              <HelpIcon />
            </button>
          </div>
        </div>
        <div className="main-content-body">
        <ErrorBoundary>
        <Suspense fallback={<div className="loading-overlay"><div className="spinner" /><p>Loading...</p></div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/resources/:scanId" element={<ResourcesPage />} />
          <Route path="/topology" element={<TopologyPage />} />
          <Route path="/topology/:scanId" element={<TopologyPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/costs" element={<CostsPage />} />
          <Route path="/aws-optimization" element={<AWSOptimizationPage />} />
          <Route path="/eks-costs" element={<EKSCostsPage />} />
          <Route path="/gcp-optimization" element={<GCPOptimizationPage />} />
          <Route path="/gke-costs" element={<GKECostsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/well-architected" element={<WellArchitectedPage />} />
          <Route path="/tags" element={<TagGovernancePage />} />
          <Route path="/iam-analysis" element={<IAMAnalysisPage />} />
          <Route path="/network-analysis" element={<NetworkAnalysisPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        </div>
      </main>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <ManageProfilesModal
        isOpen={isManageProfilesOpen}
        onClose={() => setIsManageProfilesOpen(false)}
        allProfiles={profiles}
        onProfilesChanged={handleProfilesChanged}
      />
      {location.pathname !== '/chat' && <ChatFab />}
      {location.pathname !== '/chat' && <ChatPanel />}
      <ToastContainer />
      <GlobalLoadingBar />
      <OnboardingTour isOpen={isTourOpen} onClose={handleTourClose} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  );
};

export default App;
