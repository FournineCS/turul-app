// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useScanStore } from '../stores/scanStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { ServiceType, GCPServiceType, CostDiscoveryResponse, GCPServiceDiscoveryResult } from '../../shared/types';
import { GCP_SERVICE_CATEGORIES, GCP_SERVICE_NAMES } from '../../shared/types';
import { CostDiscoveryPanel } from '../components/scan/CostDiscoveryPanel';
import { GCPSmartSelectionPanel } from '../components/scan/GCPSmartSelectionPanel';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1', 'ap-east-1', 'ap-south-1', 'ap-south-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ca-central-1', 'eu-central-1', 'eu-central-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-south-1', 'eu-south-2', 'eu-north-1',
  'me-south-1', 'me-central-1', 'sa-east-1',
];

interface ServiceInfo {
  id: ServiceType;
  name: string;
  description: string;
}

interface ServiceCategory {
  name: string;
  services: ServiceInfo[];
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    name: 'Compute',
    services: [
      { id: 'ec2', name: 'EC2', description: 'Instances, Volumes, Snapshots, VPCs, Subnets, Security Groups' },
      { id: 'lambda', name: 'Lambda', description: 'Functions' },
      { id: 'ecs', name: 'ECS', description: 'Clusters, Services, Tasks' },
      { id: 'eks', name: 'EKS', description: 'Kubernetes Clusters, Node Groups' },
      { id: 'autoscaling', name: 'Auto Scaling', description: 'Auto Scaling Groups, Policies' },
      { id: 'elasticbeanstalk', name: 'Elastic Beanstalk', description: 'Applications and environments' },
      { id: 'apprunner', name: 'App Runner', description: 'Container services' },
      { id: 'batch', name: 'Batch', description: 'Compute environments, job queues' },
    ],
  },
  {
    name: 'Storage',
    services: [
      { id: 's3', name: 'S3', description: 'Buckets' },
      { id: 'efs', name: 'EFS', description: 'File Systems, Mount Targets' },
      { id: 'ecr', name: 'ECR', description: 'Container image repositories' },
      { id: 'backup', name: 'Backup', description: 'Backup plans and vaults' },
      { id: 'fsx', name: 'FSx', description: 'File systems (Lustre, Windows, ONTAP, OpenZFS)' },
      { id: 'storagegateway', name: 'Storage Gateway', description: 'Hybrid storage gateways' },
    ],
  },
  {
    name: 'Database',
    services: [
      { id: 'rds', name: 'RDS', description: 'Database instances and clusters' },
      { id: 'dynamodb', name: 'DynamoDB', description: 'Tables' },
      { id: 'elasticache', name: 'ElastiCache', description: 'Cache clusters, Replication groups' },
      { id: 'redshift', name: 'Redshift', description: 'Data warehouse clusters' },
      { id: 'opensearch', name: 'OpenSearch', description: 'Search domains' },
      { id: 'neptune', name: 'Neptune', description: 'Graph database clusters' },
      { id: 'documentdb', name: 'DocumentDB', description: 'MongoDB-compatible clusters' },
      { id: 'memorydb', name: 'MemoryDB', description: 'Redis-compatible clusters' },
      { id: 'timestream', name: 'Timestream', description: 'Time series databases and tables' },
      { id: 'keyspaces', name: 'Keyspaces', description: 'Cassandra-compatible tables' },
    ],
  },
  {
    name: 'Networking',
    services: [
      { id: 'alb', name: 'ALB/NLB', description: 'Load balancers and target groups' },
      { id: 'cloudfront', name: 'CloudFront', description: 'CDN distributions' },
      { id: 'route53', name: 'Route 53', description: 'DNS hosted zones' },
      { id: 'wafv2', name: 'WAF', description: 'Web ACLs and rules' },
      { id: 'transitgateway', name: 'Transit Gateway', description: 'Transit gateways and attachments' },
      { id: 'globalaccelerator', name: 'Global Accelerator', description: 'Accelerators and endpoints' },
      { id: 'directconnect', name: 'Direct Connect', description: 'Connections and virtual interfaces' },
      { id: 'networkfirewall', name: 'Network Firewall', description: 'Firewalls, policies, rule groups' },
      { id: 'verifiedaccess', name: 'Verified Access', description: 'Instances, endpoints, groups' },
      { id: 'vpclattice', name: 'VPC Lattice', description: 'Services and target groups' },
    ],
  },
  {
    name: 'Integration',
    services: [
      { id: 'sns', name: 'SNS', description: 'Topics and subscriptions' },
      { id: 'sqs', name: 'SQS', description: 'Queues' },
      { id: 'stepfunctions', name: 'Step Functions', description: 'State machines' },
      { id: 'eventbridge', name: 'EventBridge', description: 'Event buses and rules' },
      { id: 'apigateway', name: 'API Gateway', description: 'REST and HTTP APIs' },
      { id: 'appsync', name: 'AppSync', description: 'GraphQL APIs' },
      { id: 'ses', name: 'SES', description: 'Email identities' },
      { id: 'mq', name: 'Amazon MQ', description: 'Message brokers' },
      { id: 'appflow', name: 'AppFlow', description: 'Data integration flows' },
    ],
  },
  {
    name: 'Migration',
    services: [
      { id: 'dms', name: 'DMS', description: 'Replication instances, tasks, endpoints' },
      { id: 'datasync', name: 'DataSync', description: 'Transfer tasks and locations' },
      { id: 'drs', name: 'DRS', description: 'Disaster recovery servers' },
    ],
  },
  {
    name: 'Management',
    services: [
      { id: 'cloudformation', name: 'CloudFormation', description: 'Stacks and resources' },
      { id: 'cloudwatch', name: 'CloudWatch', description: 'Alarms and log groups' },
      { id: 'cloudtrail', name: 'CloudTrail', description: 'Trails and logging' },
      { id: 'config', name: 'AWS Config', description: 'Config rules and recorders' },
      { id: 'ssm', name: 'SSM', description: 'Parameters' },
    ],
  },
  {
    name: 'Governance',
    services: [
      { id: 'ram', name: 'RAM', description: 'Resource shares' },
      { id: 'organizations', name: 'Organizations', description: 'Accounts and OUs' },
      { id: 'trustedadvisor', name: 'Trusted Advisor', description: 'Recommendations and checks' },
      { id: 'servicecatalog', name: 'Service Catalog', description: 'Portfolios and products' },
      { id: 'licensemanager', name: 'License Manager', description: 'License configurations' },
      { id: 'computeoptimizer', name: 'Compute Optimizer', description: 'Resource recommendations' },
      { id: 'imagebuilder', name: 'Image Builder', description: 'Image pipelines and recipes' },
    ],
  },
  {
    name: 'Analytics',
    services: [
      { id: 'glue', name: 'Glue', description: 'Databases, Tables, Jobs, Crawlers' },
      { id: 'athena', name: 'Athena', description: 'Workgroups, Data catalogs' },
      { id: 'kinesis', name: 'Kinesis', description: 'Data streams' },
      { id: 'firehose', name: 'Firehose', description: 'Delivery streams' },
      { id: 'msk', name: 'MSK', description: 'Kafka clusters' },
      { id: 'emr', name: 'EMR', description: 'MapReduce clusters' },
      { id: 'lakeformation', name: 'Lake Formation', description: 'Data lake resources and permissions' },
      { id: 'flink', name: 'Managed Flink', description: 'Stream processing applications' },
      { id: 'quicksight', name: 'QuickSight', description: 'Dashboards, datasets, data sources' },
      { id: 'cloudsearch', name: 'CloudSearch', description: 'Search domains' },
    ],
  },
  {
    name: 'Security',
    services: [
      { id: 'secretsmanager', name: 'Secrets Manager', description: 'Secrets' },
      { id: 'kms', name: 'KMS', description: 'Keys and aliases' },
      { id: 'iam', name: 'IAM', description: 'Users, Roles, Policies, Groups' },
      { id: 'guardduty', name: 'GuardDuty', description: 'Threat detection' },
      { id: 'accessanalyzer', name: 'Access Analyzer', description: 'IAM analyzers' },
      { id: 'inspector', name: 'Inspector', description: 'Vulnerability scanning coverage' },
      { id: 'acm', name: 'ACM', description: 'SSL/TLS certificates' },
      { id: 'macie', name: 'Macie', description: 'Data classification jobs' },
      { id: 'cloudhsm', name: 'CloudHSM', description: 'Hardware security modules' },
      { id: 'directoryservice', name: 'Directory Service', description: 'Managed directories' },
      { id: 'detective', name: 'Detective', description: 'Security investigation graphs' },
      { id: 'auditmanager', name: 'Audit Manager', description: 'Compliance assessments' },
      { id: 'shield', name: 'Shield', description: 'DDoS protections' },
      { id: 'fms', name: 'Firewall Manager', description: 'Security policies' },
    ],
  },
  {
    name: 'Identity',
    services: [
      { id: 'cognito', name: 'Cognito', description: 'User pools' },
    ],
  },
  {
    name: 'Developer Tools',
    services: [
      { id: 'codepipeline', name: 'CodePipeline', description: 'CI/CD pipelines' },
      { id: 'codebuild', name: 'CodeBuild', description: 'Build projects' },
      { id: 'codedeploy', name: 'CodeDeploy', description: 'Deployment applications' },
      { id: 'codeartifact', name: 'CodeArtifact', description: 'Package repositories' },
      { id: 'xray', name: 'X-Ray', description: 'Tracing groups and sampling rules' },
      { id: 'fis', name: 'FIS', description: 'Fault injection experiments' },
    ],
  },
  {
    name: 'ML & AI',
    services: [
      { id: 'sagemaker', name: 'SageMaker', description: 'Endpoints, Models, Notebooks' },
      { id: 'bedrock', name: 'Bedrock', description: 'Custom models, guardrails, knowledge bases' },
      { id: 'comprehend', name: 'Comprehend', description: 'NLP endpoints and entity recognizers' },
      { id: 'rekognition', name: 'Rekognition', description: 'Image collections and projects' },
      { id: 'textract', name: 'Textract', description: 'Document analysis adapters' },
      { id: 'transcribe', name: 'Transcribe', description: 'Custom vocabularies and language models' },
      { id: 'lex', name: 'Lex', description: 'Chatbots and conversational AI' },
      { id: 'kendra', name: 'Kendra', description: 'Search indexes and data sources' },
      { id: 'forecast', name: 'Forecast', description: 'Predictors and datasets' },
      { id: 'personalize', name: 'Personalize', description: 'Campaigns, solutions, datasets' },
      { id: 'frauddetector', name: 'Fraud Detector', description: 'Detectors and models' },
      { id: 'healthlake', name: 'HealthLake', description: 'FHIR datastores' },
    ],
  },
  {
    name: 'Frontend & Mobile',
    services: [
      { id: 'amplify', name: 'Amplify', description: 'Apps, branches, domains' },
      { id: 'location', name: 'Location Service', description: 'Maps, trackers, geofence collections' },
      { id: 'lightsail', name: 'Lightsail', description: 'Instances, databases, load balancers' },
      { id: 'pinpoint', name: 'Pinpoint', description: 'Messaging applications' },
    ],
  },
  {
    name: 'Business Apps',
    services: [
      { id: 'connect', name: 'Connect', description: 'Contact center instances' },
    ],
  },
  {
    name: 'Media',
    services: [
      { id: 'ivs', name: 'IVS', description: 'Interactive video channels' },
      { id: 'mediaconvert', name: 'MediaConvert', description: 'Job templates and queues' },
      { id: 'medialive', name: 'MediaLive', description: 'Channels and inputs' },
      { id: 'elastictranscoder', name: 'Elastic Transcoder', description: 'Pipelines and presets' },
      { id: 'kinesisvideo', name: 'Kinesis Video', description: 'Video streams' },
    ],
  },
  {
    name: 'IoT',
    services: [
      { id: 'iot', name: 'IoT Core', description: 'Things, policies, certificates' },
    ],
  },
  {
    name: 'End User Computing',
    services: [
      { id: 'workspaces', name: 'WorkSpaces', description: 'Virtual desktops and directories' },
    ],
  },
  {
    name: 'Data Pipeline',
    services: [
      { id: 'mwaa', name: 'MWAA', description: 'Airflow environments' },
      { id: 'transfer', name: 'Transfer Family', description: 'SFTP/FTPS servers' },
    ],
  },
];

// Flatten for easy access
const AVAILABLE_SERVICES: ServiceInfo[] = SERVICE_CATEGORIES.flatMap((cat) => cat.services);

const POPULAR_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'ap-southeast-1',
];

const ScanPage: React.FC = () => {
  const navigate = useNavigate();
  const { profiles, selectedProfile, selectedProfileName, isLoading: profileLoading, loadProfiles, validateProfile, validatedAccountId, error: profileError } = useProfileStore();
  const [ssoReauthInProgress, setSsoReauthInProgress] = useState(false);
  const [ssoReauthResult, setSsoReauthResult] = useState<{ success: boolean; message: string } | null>(null);
  const { selectedProvider } = useProviderStore();
  const { selectedProjectId, billingConfig } = useGCPProjectStore();
  const { startScan, startGCPScan, isScanning, scanProgress, error: scanError } = useScanStore();
  const settings = useSettingsStore((s) => s.settings);
  const defaultsApplied = useRef(false);

  const [selectedRegions, setSelectedRegions] = useState<string[]>(['us-east-1']);
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(['ec2']);
  const [showAllRegions, setShowAllRegions] = useState(false);

  // GCP-specific state
  const [selectedGCPServices, setSelectedGCPServices] = useState<GCPServiceType[]>([
    'gce', 'vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router', 'cloud-nat', 'cloud-address',
  ]);

  // Cost discovery state (AWS)
  const [costData, setCostData] = useState<CostDiscoveryResponse | null>(null);
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);

  // GCP smart selection state
  const [gcpDiscoveryData, setGcpDiscoveryData] = useState<GCPServiceDiscoveryResult | null>(null);
  const [isDiscoveringGCP, setIsDiscoveringGCP] = useState(false);
  const [gcpDiscoveryError, setGcpDiscoveryError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Apply saved defaults from Settings once
  useEffect(() => {
    if (defaultsApplied.current) return;
    if (settings.defaultRegions.length > 0) {
      setSelectedRegions(settings.defaultRegions);
    }
    if (settings.defaultServices.length > 0) {
      setSelectedServices(settings.defaultServices as ServiceType[]);
    }
    defaultsApplied.current = true;
  }, [settings]);

  // Auto-validate when global profile changes
  useEffect(() => {
    if (selectedProfileName && !validatedAccountId) {
      validateProfile(selectedProfileName);
    }
  }, [selectedProfileName, validatedAccountId, validateProfile]);

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const toggleService = (service: ServiceType) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const selectAllRegions = () => {
    setSelectedRegions([...AWS_REGIONS]);
  };

  const clearAllRegions = () => {
    setSelectedRegions([]);
  };

  const selectAllServices = () => {
    setSelectedServices(AVAILABLE_SERVICES.map((s) => s.id));
  };

  const clearAllServices = () => {
    setSelectedServices([]);
  };

  const toggleCategory = (category: ServiceCategory) => {
    const categoryIds = category.services.map((s) => s.id);
    const allSelected = categoryIds.every((id) => selectedServices.includes(id));
    if (allSelected) {
      // Deselect all in this category
      setSelectedServices((prev) => prev.filter((id) => !categoryIds.includes(id)));
    } else {
      // Select all in this category
      setSelectedServices((prev) => [...new Set([...prev, ...categoryIds])]);
    }
  };

  const handleDiscoverByCost = async () => {
    if (!selectedProfile) return;

    setIsLoadingCosts(true);
    setCostError(null);
    setCostData(null);

    try {
      const response = await window.electronAPI.aws.discoverServicesByCost(selectedProfile.name, 30);

      if (response.success && response.data) {
        setCostData(response.data);
        // Auto-select services that have usage
        if (response.data.activeServices.length > 0) {
          setSelectedServices(response.data.activeServices);
        }
      } else {
        setCostError(response.error || 'Failed to fetch cost data');
      }
    } catch (error) {
      setCostError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }

    setIsLoadingCosts(false);
  };

  const handleCostServiceSelect = (services: ServiceType[]) => {
    setSelectedServices(services);
  };

  // GCP smart selection — discover services via BigQuery billing data
  const handleGCPDiscoverServices = async () => {
    if (!selectedProjectId || !billingConfig?.bqProject) return;

    setIsDiscoveringGCP(true);
    setGcpDiscoveryError(null);
    setGcpDiscoveryData(null);

    try {
      const response = await window.electronAPI.gcp.scan.discoverServices(
        selectedProjectId,
        30,
        billingConfig.bqProject,
        billingConfig.bqDataset || undefined,
        billingConfig.bqRegion || undefined
      );

      if (response.success && response.data) {
        setGcpDiscoveryData(response.data);
        if (response.data.activeServices.length > 0) {
          setSelectedGCPServices(response.data.activeServices);
        }
      } else {
        setGcpDiscoveryError(response.error || 'Failed to discover services');
      }
    } catch (error) {
      setGcpDiscoveryError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }

    setIsDiscoveringGCP(false);
  };

  const handleGCPSmartSelect = (services: GCPServiceType[]) => {
    setSelectedGCPServices(services);
  };

  // GCP service toggle helpers
  const toggleGCPService = (service: GCPServiceType) => {
    setSelectedGCPServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const toggleGCPCategory = (categoryKey: string) => {
    const category = GCP_SERVICE_CATEGORIES[categoryKey];
    if (!category) return;
    const allSelected = category.services.every((s) => selectedGCPServices.includes(s));
    if (allSelected) {
      setSelectedGCPServices((prev) => prev.filter((s) => !category.services.includes(s)));
    } else {
      setSelectedGCPServices((prev) => [...new Set([...prev, ...category.services])]);
    }
  };

  const selectAllGCPServices = () => {
    const all = Object.values(GCP_SERVICE_CATEGORIES).flatMap((c) => c.services);
    setSelectedGCPServices(all);
  };

  const clearAllGCPServices = () => {
    setSelectedGCPServices([]);
  };

  const selectArchitectureEssentials = () => {
    setSelectedGCPServices([
      // Compute
      'gce', 'gke', 'cloud-run', 'cloud-functions',
      // Networking
      'vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router', 'cloud-nat', 'cloud-address',
      // Load Balancing
      'gclb', 'gclb-url-maps',
      // Data
      'cloud-sql', 'gcs',
    ]);
  };

  const handleStartScan = async () => {
    if (selectedProvider === 'gcp') {
      // GCP scan — go through the scan store for proper state tracking
      if (!selectedProjectId || selectedGCPServices.length === 0) return;

      const scanId = await startGCPScan({
        projectId: selectedProjectId,
        services: selectedGCPServices,
      });

      if (scanId) {
        navigate('/dashboard');
      }
      return;
    }

    // AWS scan
    if (!selectedProfile || selectedRegions.length === 0 || selectedServices.length === 0) {
      return;
    }

    const scanId = await startScan({
      profileName: selectedProfile.name,
      regions: selectedRegions,
      services: selectedServices,
      includeGlobal: true,
    });

    if (scanId) {
      navigate('/dashboard');
    }
  };

  const displayedRegions = showAllRegions ? AWS_REGIONS : POPULAR_REGIONS;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">New Scan</h1>
      </header>

      <div className="page-content">
        {/* Scan Progress */}
        {isScanning && scanProgress && (
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Scan in Progress</h3>
              <span className="badge badge-info">Running</span>
            </div>
            <div>
              <p>
                Region: <strong>{scanProgress.currentRegion}</strong> (
                {scanProgress.completedRegions}/{scanProgress.totalRegions})
              </p>
              <p>
                Service: <strong>{scanProgress.currentService}</strong>
              </p>
              <p>Resources Found: <strong>{scanProgress.resourcesFound}</strong></p>
            </div>
            <div className="progress-bar mt-4">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(scanProgress.completedRegions / scanProgress.totalRegions) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Profile / Project Display */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">{selectedProvider === 'aws' ? 'AWS Profile' : 'GCP Project'}</h3>

          {selectedProvider === 'aws' ? (
            <>
              {profileLoading ? (
                <div className="loading-overlay">
                  <div className="spinner" />
                  <p>Validating profile...</p>
                </div>
              ) : !selectedProfileName ? (
                <div className="empty-state">
                  <p>Select an AWS profile from the top bar to start scanning.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{selectedProfileName}</span>
                    {selectedProfile && validatedAccountId && (
                      <span className="badge badge-success">
                        Account: {validatedAccountId}
                      </span>
                    )}
                  </div>
                  {profileError && (
                    <div style={{ marginTop: 8 }}>
                      <div className="badge badge-error">{profileError}</div>
                      {/token is expired|sso/i.test(profileError) && selectedProfileName && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={ssoReauthInProgress}
                            onClick={async () => {
                              setSsoReauthInProgress(true);
                              setSsoReauthResult(null);
                              try {
                                const resp = await window.electronAPI.profiles.ssoLogin(selectedProfileName);
                                if (resp.success) {
                                  setSsoReauthResult({ success: true, message: 'SSO re-authenticated. Validating...' });
                                  validateProfile(selectedProfileName);
                                } else {
                                  setSsoReauthResult({ success: false, message: resp.error || 'SSO login failed' });
                                }
                              } catch (err) {
                                setSsoReauthResult({ success: false, message: err instanceof Error ? err.message : 'SSO login failed' });
                              }
                              setSsoReauthInProgress(false);
                            }}
                          >
                            {ssoReauthInProgress ? 'Re-authenticating...' : 'Re-authenticate SSO'}
                          </button>
                          {ssoReauthResult && (
                            <span style={{ fontSize: 12, color: ssoReauthResult.success ? 'var(--color-success)' : 'var(--color-error)' }}>
                              {ssoReauthResult.message}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {!selectedProjectId ? (
                <div className="empty-state">
                  <p>Select a GCP project from the top bar to start scanning.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{selectedProjectId}</span>
                  <span className="badge badge-success">Ready</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* GCP Smart Selection */}
        {selectedProvider === 'gcp' && selectedProjectId && (
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Smart Selection
                <span
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-info))',
                    color: 'var(--color-bg)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                  }}
                >
                  Beta
                </span>
              </h3>
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Auto-detect active services from your BigQuery billing export — only scan what's running.
            </p>

            {!billingConfig?.bqProject ? (
              <div
                style={{
                  padding: 16,
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Billing BigQuery configuration required. Set it up in{' '}
                  <strong style={{ color: 'var(--color-text)' }}>Costs</strong> page &rarr; Billing Config.
                </p>
              </div>
            ) : (
              <>
                {!gcpDiscoveryData && !isDiscoveringGCP && !gcpDiscoveryError && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleGCPDiscoverServices}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M8 1v2M8 13v2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M1 8h2M13 8h2M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Discover Active Services (Last 30 Days)
                  </button>
                )}

                {isDiscoveringGCP && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="spinner" style={{ width: 20, height: 20 }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Querying billing data for <strong style={{ color: 'var(--color-text)' }}>{selectedProjectId}</strong>...
                    </span>
                  </div>
                )}

                {gcpDiscoveryError && (
                  <div
                    style={{
                      padding: 14,
                      backgroundColor: 'var(--color-error-glow)',
                      border: '1px solid var(--color-error)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <p style={{ margin: 0, color: 'var(--color-error)', fontSize: 13 }}>
                      {gcpDiscoveryError}
                    </p>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={handleGCPDiscoverServices}
                      style={{ marginTop: 10 }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {gcpDiscoveryData && (
                  <>
                    <GCPSmartSelectionPanel
                      data={gcpDiscoveryData}
                      selectedServices={selectedGCPServices}
                      onSelectServices={handleGCPSmartSelect}
                    />
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setGcpDiscoveryData(null);
                        setGcpDiscoveryError(null);
                      }}
                      style={{ marginTop: 8 }}
                    >
                      Clear Discovery Data
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* GCP Service Selection */}
        {selectedProvider === 'gcp' && selectedProjectId && (
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">GCP Services</h3>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={selectArchitectureEssentials} title="Select compute, networking, load balancing, and data services for architecture diagrams">
                  Architecture Essentials
                </button>
                <button className="btn btn-sm btn-secondary" onClick={selectAllGCPServices}>
                  Select All
                </button>
                <button className="btn btn-sm btn-secondary" onClick={clearAllGCPServices}>
                  Clear
                </button>
              </div>
            </div>

            {Object.entries(GCP_SERVICE_CATEGORIES).map(([key, category]) => {
              const selectedCount = category.services.filter((s) => selectedGCPServices.includes(s)).length;
              const allSelected = selectedCount === category.services.length;
              const someSelected = selectedCount > 0 && !allSelected;

              return (
                <div key={key} style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={() => toggleGCPCategory(key)}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                      {category.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.7 }}>
                      ({selectedCount}/{category.services.length})
                    </span>
                  </label>
                  <div className="checkbox-group">
                    {category.services.map((service) => (
                      <label
                        key={service}
                        className={`checkbox-item ${selectedGCPServices.includes(service) ? 'selected' : ''}`}
                        style={{ minWidth: '200px' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGCPServices.includes(service)}
                          onChange={() => toggleGCPService(service)}
                        />
                        <div>
                          <strong>{GCP_SERVICE_NAMES[service]}</strong>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <p className="text-secondary text-sm mt-4">
              {selectedGCPServices.length} service(s) selected
            </p>
          </div>
        )}

        {/* Smart Scan Section (AWS only) */}
        {selectedProvider === 'aws' && selectedProfile && validatedAccountId && (
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Smart Scan
                <span
                  style={{
                    backgroundColor: 'var(--color-info)',
                    color: 'var(--color-bg)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 'normal',
                  }}
                >
                  Beta
                </span>
              </h3>
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Automatically discover which AWS services have usage in your account based on Cost Explorer data.
            </p>

            {!costData && !isLoadingCosts && (
              <button
                className="btn btn-secondary"
                onClick={handleDiscoverByCost}
                disabled={isLoadingCosts}
              >
                Discover Services by Cost (Last 30 Days)
              </button>
            )}

            {isLoadingCosts && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <span>Analyzing cost data...</span>
              </div>
            )}

            {costError && (
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--color-error-glow)',
                  border: '1px solid var(--color-error)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 12,
                }}
              >
                <p style={{ margin: 0, color: 'var(--color-error)', fontSize: 13 }}>
                  {costError}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Ensure your AWS profile has Cost Explorer access (ce:GetCostAndUsage permission).
                </p>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleDiscoverByCost}
                  style={{ marginTop: 12 }}
                >
                  Retry
                </button>
              </div>
            )}

            {costData && (
              <>
                <CostDiscoveryPanel
                  data={costData}
                  onSelectServices={handleCostServiceSelect}
                  selectedServices={selectedServices}
                />
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setCostData(null);
                    setCostError(null);
                  }}
                  style={{ marginTop: 8 }}
                >
                  Clear Cost Data
                </button>
              </>
            )}
          </div>
        )}

        {/* Region Selection (AWS only) */}
        {selectedProvider === 'aws' && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Regions</h3>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-secondary" onClick={selectAllRegions}>
                Select All
              </button>
              <button className="btn btn-sm btn-secondary" onClick={clearAllRegions}>
                Clear
              </button>
            </div>
          </div>

          <div className="checkbox-group">
            {displayedRegions.map((region) => (
              <label
                key={region}
                className={`checkbox-item ${selectedRegions.includes(region) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleRegion(region)}
                />
                {region}
              </label>
            ))}
          </div>

          {!showAllRegions && (
            <button
              className="btn btn-sm btn-secondary mt-4"
              onClick={() => setShowAllRegions(true)}
            >
              Show All Regions ({AWS_REGIONS.length})
            </button>
          )}

          {showAllRegions && (
            <button
              className="btn btn-sm btn-secondary mt-4"
              onClick={() => setShowAllRegions(false)}
            >
              Show Popular Regions Only
            </button>
          )}

          <p className="text-secondary text-sm mt-4">
            {selectedRegions.length} region(s) selected
          </p>
        </div>
        )}

        {/* Service Selection (AWS only) */}
        {selectedProvider === 'aws' && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Services</h3>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-secondary" onClick={selectAllServices}>
                Select All
              </button>
              <button className="btn btn-sm btn-secondary" onClick={clearAllServices}>
                Clear
              </button>
            </div>
          </div>

          {SERVICE_CATEGORIES.map((category) => {
            const categoryIds = category.services.map((s) => s.id);
            const selectedCount = categoryIds.filter((id) => selectedServices.includes(id)).length;
            const allSelected = selectedCount === categoryIds.length;
            const someSelected = selectedCount > 0 && !allSelected;

            return (
            <div key={category.name} style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={() => toggleCategory(category)}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                  {category.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.7 }}>
                  ({selectedCount}/{categoryIds.length})
                </span>
              </label>
              <div className="checkbox-group">
                {category.services.map((service) => (
                  <label
                    key={service.id}
                    className={`checkbox-item ${selectedServices.includes(service.id) ? 'selected' : ''}`}
                    style={{ minWidth: '200px' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                    />
                    <div>
                      <strong>{service.name}</strong>
                      <div className="text-secondary text-sm">{service.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            );
          })}

          <p className="text-secondary text-sm mt-4">
            {selectedServices.length} service(s) selected
          </p>
        </div>
        )}

        {/* Error display */}
        {scanError && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <p style={{ color: 'var(--color-error)' }}>{scanError}</p>
          </div>
        )}

        {/* Start Scan Button */}
        <div className="flex gap-4">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStartScan}
            disabled={
              selectedProvider === 'aws'
                ? (!selectedProfile || !validatedAccountId || selectedRegions.length === 0 || selectedServices.length === 0 || isScanning)
                : (!selectedProjectId || selectedGCPServices.length === 0 || isScanning)
            }
          >
            {isScanning ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Scanning...
              </>
            ) : (
              'Start Scan'
            )}
          </button>

          <div className="text-secondary" style={{ alignSelf: 'center' }}>
            {selectedProvider === 'aws'
              ? `Will scan ${selectedServices.length} service(s) across ${selectedRegions.length} region(s)`
              : `Will scan ${selectedGCPServices.length} GCP service(s) in project ${selectedProjectId || '...'}`}
          </div>
        </div>
      </div>
    </>
  );
};

export default ScanPage;
