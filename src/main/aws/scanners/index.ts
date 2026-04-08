// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { ServiceType } from '../../../shared/types';
import { BaseScanner, type ScannerConfig } from './base-scanner';
import { EC2Scanner } from './ec2-scanner';
import { LambdaScanner } from './lambda-scanner';
import { S3Scanner } from './s3-scanner';
import { RDSScanner } from './rds-scanner';
import { ALBScanner } from './alb-scanner';
import { CloudFormationScanner } from './cloudformation-scanner';
import { ECSScanner } from './ecs-scanner';
import { EKSScanner } from './eks-scanner';
import { DynamoDBScanner } from './dynamodb-scanner';
import { ElastiCacheScanner } from './elasticache-scanner';
import { SNSScanner } from './sns-scanner';
import { SQSScanner } from './sqs-scanner';
import { GlueScanner } from './glue-scanner';
import { AthenaScanner } from './athena-scanner';
import { StepFunctionsScanner } from './stepfunctions-scanner';
import { RedshiftScanner } from './redshift-scanner';
import { MWAAScanner } from './mwaa-scanner';
import { APIGatewayScanner } from './apigateway-scanner';
import { SecretsManagerScanner } from './secretsmanager-scanner';
import { KMSScanner } from './kms-scanner';
import { EventBridgeScanner } from './eventbridge-scanner';
import { CloudWatchScanner } from './cloudwatch-scanner';
// Phase 1A: Previously broken UI services
import { CloudFrontScanner } from './cloudfront-scanner';
import { EFSScanner } from './efs-scanner';
import { Route53Scanner } from './route53-scanner';
// Phase 1B: SDK already installed
import { IAMScanner } from './iam-scanner';
import { AutoScalingScanner } from './autoscaling-scanner';
import { CloudTrailScanner } from './cloudtrail-scanner';
import { GuardDutyScanner } from './guardduty-scanner';
import { AccessAnalyzerScanner } from './accessanalyzer-scanner';
import { InspectorScanner } from './inspector-scanner';
// Phase 2: Core services
import { ECRScanner } from './ecr-scanner';
import { ACMScanner } from './acm-scanner';
import { SSMScanner } from './ssm-scanner';
import { WAFV2Scanner } from './wafv2-scanner';
import { CognitoScanner } from './cognito-scanner';
import { ConfigScanner } from './config-scanner';
import { BackupScanner } from './backup-scanner';
import { CodePipelineScanner } from './codepipeline-scanner';
import { CodeBuildScanner } from './codebuild-scanner';
import { OpenSearchScanner } from './opensearch-scanner';
// Phase 3: Analytics, ML, Streaming
import { KinesisScanner } from './kinesis-scanner';
import { FirehoseScanner } from './firehose-scanner';
import { SESScanner } from './ses-scanner';
import { AppSyncScanner } from './appsync-scanner';
import { MSKScanner } from './msk-scanner';
import { EMRScanner } from './emr-scanner';
import { SageMakerScanner } from './sagemaker-scanner';
import { TransferScanner } from './transfer-scanner';
// Phase 4: Database & Networking
import { NeptuneScanner } from './neptune-scanner';
import { DocumentDBScanner } from './documentdb-scanner';
import { MemoryDBScanner } from './memorydb-scanner';
import { TimestreamScanner } from './timestream-scanner';
import { KeyspacesScanner } from './keyspaces-scanner';
import { TransitGatewayScanner } from './transitgateway-scanner';
import { GlobalAcceleratorScanner } from './globalaccelerator-scanner';
import { DirectConnectScanner } from './directconnect-scanner';
import { NetworkFirewallScanner } from './networkfirewall-scanner';
import { MQScanner } from './mq-scanner';

export { BaseScanner, type ScannerConfig, type ScanResult, type ScanError } from './base-scanner';
export { EC2Scanner } from './ec2-scanner';
export { LambdaScanner } from './lambda-scanner';
export { S3Scanner } from './s3-scanner';
export { RDSScanner } from './rds-scanner';
export { ALBScanner } from './alb-scanner';
export { CloudFormationScanner } from './cloudformation-scanner';
export { ECSScanner } from './ecs-scanner';
export { EKSScanner } from './eks-scanner';
export { DynamoDBScanner } from './dynamodb-scanner';
export { ElastiCacheScanner } from './elasticache-scanner';
export { SNSScanner } from './sns-scanner';
export { SQSScanner } from './sqs-scanner';
export { GlueScanner } from './glue-scanner';
export { AthenaScanner } from './athena-scanner';
export { StepFunctionsScanner } from './stepfunctions-scanner';
export { RedshiftScanner } from './redshift-scanner';
export { MWAAScanner } from './mwaa-scanner';
export { APIGatewayScanner } from './apigateway-scanner';
export { SecretsManagerScanner } from './secretsmanager-scanner';
export { KMSScanner } from './kms-scanner';
export { EventBridgeScanner } from './eventbridge-scanner';
export { CloudWatchScanner } from './cloudwatch-scanner';
export { CloudFrontScanner } from './cloudfront-scanner';
export { EFSScanner } from './efs-scanner';
export { Route53Scanner } from './route53-scanner';
export { IAMScanner } from './iam-scanner';
export { AutoScalingScanner } from './autoscaling-scanner';
export { CloudTrailScanner } from './cloudtrail-scanner';
export { GuardDutyScanner } from './guardduty-scanner';
export { AccessAnalyzerScanner } from './accessanalyzer-scanner';
export { InspectorScanner } from './inspector-scanner';
export { ECRScanner } from './ecr-scanner';
export { ACMScanner } from './acm-scanner';
export { SSMScanner } from './ssm-scanner';
export { WAFV2Scanner } from './wafv2-scanner';
export { CognitoScanner } from './cognito-scanner';
export { ConfigScanner } from './config-scanner';
export { BackupScanner } from './backup-scanner';
export { CodePipelineScanner } from './codepipeline-scanner';
export { CodeBuildScanner } from './codebuild-scanner';
export { OpenSearchScanner } from './opensearch-scanner';
export { KinesisScanner } from './kinesis-scanner';
export { FirehoseScanner } from './firehose-scanner';
export { SESScanner } from './ses-scanner';
export { AppSyncScanner } from './appsync-scanner';
export { MSKScanner } from './msk-scanner';
export { EMRScanner } from './emr-scanner';
export { SageMakerScanner } from './sagemaker-scanner';
export { TransferScanner } from './transfer-scanner';
// Phase 4
export { NeptuneScanner } from './neptune-scanner';
export { DocumentDBScanner } from './documentdb-scanner';
export { MemoryDBScanner } from './memorydb-scanner';
export { TimestreamScanner } from './timestream-scanner';
export { KeyspacesScanner } from './keyspaces-scanner';
export { TransitGatewayScanner } from './transitgateway-scanner';
export { GlobalAcceleratorScanner } from './globalaccelerator-scanner';
export { DirectConnectScanner } from './directconnect-scanner';
export { NetworkFirewallScanner } from './networkfirewall-scanner';
export { MQScanner } from './mq-scanner';
// Phase 5: Storage, Migration & Compute
import { FSxScanner } from './fsx-scanner';
import { StorageGatewayScanner } from './storagegateway-scanner';
import { DMSScanner } from './dms-scanner';
import { DataSyncScanner } from './datasync-scanner';
import { DRSScanner } from './drs-scanner';
import { LakeFormationScanner } from './lakeformation-scanner';
import { ElasticBeanstalkScanner } from './elasticbeanstalk-scanner';
import { AppRunnerScanner } from './apprunner-scanner';
import { BatchScanner } from './batch-scanner';
import { AppFlowScanner } from './appflow-scanner';
export { FSxScanner } from './fsx-scanner';
export { StorageGatewayScanner } from './storagegateway-scanner';
export { DMSScanner } from './dms-scanner';
export { DataSyncScanner } from './datasync-scanner';
export { DRSScanner } from './drs-scanner';
export { LakeFormationScanner } from './lakeformation-scanner';
export { ElasticBeanstalkScanner } from './elasticbeanstalk-scanner';
export { AppRunnerScanner } from './apprunner-scanner';
export { BatchScanner } from './batch-scanner';
export { AppFlowScanner } from './appflow-scanner';

// Phase 6: Security & Compliance
import { MacieScanner } from './macie-scanner';
import { FMSScanner } from './fms-scanner';
import { ShieldScanner } from './shield-scanner';
import { CloudHSMScanner } from './cloudhsm-scanner';
import { DirectoryServiceScanner } from './directoryservice-scanner';
import { DetectiveScanner } from './detective-scanner';
import { AuditManagerScanner } from './auditmanager-scanner';
import { RAMScanner } from './ram-scanner';
import { OrganizationsScanner } from './organizations-scanner';
import { TrustedAdvisorScanner } from './trustedadvisor-scanner';
export { MacieScanner } from './macie-scanner';
export { FMSScanner } from './fms-scanner';
export { ShieldScanner } from './shield-scanner';
export { CloudHSMScanner } from './cloudhsm-scanner';
export { DirectoryServiceScanner } from './directoryservice-scanner';
export { DetectiveScanner } from './detective-scanner';
export { AuditManagerScanner } from './auditmanager-scanner';
export { RAMScanner } from './ram-scanner';
export { OrganizationsScanner } from './organizations-scanner';
export { TrustedAdvisorScanner } from './trustedadvisor-scanner';
// Phase 7: Developer Tools & Management
import { CodeDeployScanner } from './codedeploy-scanner';
import { CodeArtifactScanner } from './codeartifact-scanner';
import { XRayScanner } from './xray-scanner';
import { FISScanner } from './fis-scanner';
import { ImageBuilderScanner } from './imagebuilder-scanner';
import { ServiceCatalogScanner } from './servicecatalog-scanner';
import { LicenseManagerScanner } from './licensemanager-scanner';
import { ComputeOptimizerScanner } from './computeoptimizer-scanner';
export { CodeDeployScanner } from './codedeploy-scanner';
export { CodeArtifactScanner } from './codeartifact-scanner';
export { XRayScanner } from './xray-scanner';
export { FISScanner } from './fis-scanner';
export { ImageBuilderScanner } from './imagebuilder-scanner';
export { ServiceCatalogScanner } from './servicecatalog-scanner';
export { LicenseManagerScanner } from './licensemanager-scanner';
export { ComputeOptimizerScanner } from './computeoptimizer-scanner';
// Phase 8: AI/ML & Frontend
import { BedrockScanner } from './bedrock-scanner';
import { ComprehendScanner } from './comprehend-scanner';
import { RekognitionScanner } from './rekognition-scanner';
import { TextractScanner } from './textract-scanner';
import { TranscribeScanner } from './transcribe-scanner';
import { LexScanner } from './lex-scanner';
import { KendraScanner } from './kendra-scanner';
import { AmplifyScanner } from './amplify-scanner';
import { LocationScanner } from './location-scanner';
import { LightsailScanner } from './lightsail-scanner';
export { BedrockScanner } from './bedrock-scanner';
export { ComprehendScanner } from './comprehend-scanner';
export { RekognitionScanner } from './rekognition-scanner';
export { TextractScanner } from './textract-scanner';
export { TranscribeScanner } from './transcribe-scanner';
export { LexScanner } from './lex-scanner';
export { KendraScanner } from './kendra-scanner';
export { AmplifyScanner } from './amplify-scanner';
export { LocationScanner } from './location-scanner';
export { LightsailScanner } from './lightsail-scanner';
// Phase 9: Streaming, Analytics & Communication
import { KinesisVideoScanner } from './kinesisvideo-scanner';
import { FlinkScanner } from './flink-scanner';
import { QuickSightScanner } from './quicksight-scanner';
import { PinpointScanner } from './pinpoint-scanner';
import { ConnectScanner } from './connect-scanner';
import { IVSScanner } from './ivs-scanner';
import { MediaConvertScanner } from './mediaconvert-scanner';
import { MediaLiveScanner } from './medialive-scanner';
export { KinesisVideoScanner } from './kinesisvideo-scanner';
export { FlinkScanner } from './flink-scanner';
export { QuickSightScanner } from './quicksight-scanner';
export { PinpointScanner } from './pinpoint-scanner';
export { ConnectScanner } from './connect-scanner';
export { IVSScanner } from './ivs-scanner';
export { MediaConvertScanner } from './mediaconvert-scanner';
export { MediaLiveScanner } from './medialive-scanner';
// Phase 10: IoT, Niche & Remaining
import { IoTScanner } from './iot-scanner';
import { ForecastScanner } from './forecast-scanner';
import { PersonalizeScanner } from './personalize-scanner';
import { FraudDetectorScanner } from './frauddetector-scanner';
import { WorkSpacesScanner } from './workspaces-scanner';
import { VerifiedAccessScanner } from './verifiedaccess-scanner';
import { VPCLatticeScanner } from './vpclattice-scanner';
import { ElasticTranscoderScanner } from './elastictranscoder-scanner';
import { CloudSearchScanner } from './cloudsearch-scanner';
import { HealthLakeScanner } from './healthlake-scanner';
export { IoTScanner } from './iot-scanner';
export { ForecastScanner } from './forecast-scanner';
export { PersonalizeScanner } from './personalize-scanner';
export { FraudDetectorScanner } from './frauddetector-scanner';
export { WorkSpacesScanner } from './workspaces-scanner';
export { VerifiedAccessScanner } from './verifiedaccess-scanner';
export { VPCLatticeScanner } from './vpclattice-scanner';
export { ElasticTranscoderScanner } from './elastictranscoder-scanner';
export { CloudSearchScanner } from './cloudsearch-scanner';
export { HealthLakeScanner } from './healthlake-scanner';

// Scanner factory
export function createScanner(
  service: ServiceType,
  config: ScannerConfig
): BaseScanner | null {
  switch (service) {
    // Compute
    case 'ec2':
    case 'vpc':
    case 'subnet':
    case 'securityGroup':
      return new EC2Scanner(config);
    case 'lambda':
      return new LambdaScanner(config);
    case 'ecs':
      return new ECSScanner(config);
    case 'eks':
      return new EKSScanner(config);
    case 'autoscaling':
      return new AutoScalingScanner(config);

    // Storage
    case 's3':
      return new S3Scanner(config);
    case 'efs':
      return new EFSScanner(config);
    case 'ecr':
      return new ECRScanner(config);
    case 'backup':
      return new BackupScanner(config);

    // Database
    case 'rds':
      return new RDSScanner(config);
    case 'dynamodb':
      return new DynamoDBScanner(config);
    case 'elasticache':
      return new ElastiCacheScanner(config);
    case 'redshift':
      return new RedshiftScanner(config);
    case 'opensearch':
      return new OpenSearchScanner(config);

    // Networking
    case 'alb':
      return new ALBScanner(config);
    case 'cloudfront':
      return new CloudFrontScanner(config);
    case 'route53':
      return new Route53Scanner(config);
    case 'wafv2':
      return new WAFV2Scanner(config);

    // Management
    case 'cloudformation':
      return new CloudFormationScanner(config);
    case 'cloudwatch':
      return new CloudWatchScanner(config);
    case 'cloudtrail':
      return new CloudTrailScanner(config);
    case 'config':
      return new ConfigScanner(config);
    case 'ssm':
      return new SSMScanner(config);

    // Analytics
    case 'glue':
      return new GlueScanner(config);
    case 'athena':
      return new AthenaScanner(config);
    case 'kinesis':
      return new KinesisScanner(config);
    case 'firehose':
      return new FirehoseScanner(config);
    case 'msk':
      return new MSKScanner(config);
    case 'emr':
      return new EMRScanner(config);

    // Integration
    case 'sns':
      return new SNSScanner(config);
    case 'sqs':
      return new SQSScanner(config);
    case 'stepfunctions':
      return new StepFunctionsScanner(config);
    case 'eventbridge':
      return new EventBridgeScanner(config);
    case 'apigateway':
      return new APIGatewayScanner(config);
    case 'appsync':
      return new AppSyncScanner(config);
    case 'ses':
      return new SESScanner(config);

    // Security
    case 'secretsmanager':
      return new SecretsManagerScanner(config);
    case 'kms':
      return new KMSScanner(config);
    case 'iam':
      return new IAMScanner(config);
    case 'guardduty':
      return new GuardDutyScanner(config);
    case 'accessanalyzer':
      return new AccessAnalyzerScanner(config);
    case 'inspector':
      return new InspectorScanner(config);
    case 'acm':
      return new ACMScanner(config);

    // Identity
    case 'cognito':
      return new CognitoScanner(config);

    // Developer Tools
    case 'codepipeline':
      return new CodePipelineScanner(config);
    case 'codebuild':
      return new CodeBuildScanner(config);

    // ML & AI
    case 'sagemaker':
      return new SageMakerScanner(config);

    // Data Pipeline
    case 'mwaa':
      return new MWAAScanner(config);
    case 'transfer':
      return new TransferScanner(config);

    // Phase 4: Database & Networking
    case 'neptune':
      return new NeptuneScanner(config);
    case 'documentdb':
      return new DocumentDBScanner(config);
    case 'memorydb':
      return new MemoryDBScanner(config);
    case 'timestream':
      return new TimestreamScanner(config);
    case 'keyspaces':
      return new KeyspacesScanner(config);
    case 'transitgateway':
      return new TransitGatewayScanner(config);
    case 'globalaccelerator':
      return new GlobalAcceleratorScanner(config);
    case 'directconnect':
      return new DirectConnectScanner(config);
    case 'networkfirewall':
      return new NetworkFirewallScanner(config);
    case 'mq':
      return new MQScanner(config);

    // Phase 5: Storage, Migration & Compute
    case 'fsx':
      return new FSxScanner(config);
    case 'storagegateway':
      return new StorageGatewayScanner(config);
    case 'dms':
      return new DMSScanner(config);
    case 'datasync':
      return new DataSyncScanner(config);
    case 'drs':
      return new DRSScanner(config);
    case 'lakeformation':
      return new LakeFormationScanner(config);
    case 'elasticbeanstalk':
      return new ElasticBeanstalkScanner(config);
    case 'apprunner':
      return new AppRunnerScanner(config);
    case 'batch':
      return new BatchScanner(config);
    case 'appflow':
      return new AppFlowScanner(config);

    // Phase 6: Security & Compliance
    case 'macie':
      return new MacieScanner(config);
    case 'fms':
      return new FMSScanner(config);
    case 'shield':
      return new ShieldScanner(config);
    case 'cloudhsm':
      return new CloudHSMScanner(config);
    case 'directoryservice':
      return new DirectoryServiceScanner(config);
    case 'detective':
      return new DetectiveScanner(config);
    case 'auditmanager':
      return new AuditManagerScanner(config);
    case 'ram':
      return new RAMScanner(config);
    case 'organizations':
      return new OrganizationsScanner(config);
    case 'trustedadvisor':
      return new TrustedAdvisorScanner(config);

    // Phase 7: Developer Tools & Management
    case 'codedeploy':
      return new CodeDeployScanner(config);
    case 'codeartifact':
      return new CodeArtifactScanner(config);
    case 'xray':
      return new XRayScanner(config);
    case 'fis':
      return new FISScanner(config);
    case 'imagebuilder':
      return new ImageBuilderScanner(config);
    case 'servicecatalog':
      return new ServiceCatalogScanner(config);
    case 'licensemanager':
      return new LicenseManagerScanner(config);
    case 'computeoptimizer':
      return new ComputeOptimizerScanner(config);

    // Phase 8: AI/ML & Frontend
    case 'bedrock':
      return new BedrockScanner(config);
    case 'comprehend':
      return new ComprehendScanner(config);
    case 'rekognition':
      return new RekognitionScanner(config);
    case 'textract':
      return new TextractScanner(config);
    case 'transcribe':
      return new TranscribeScanner(config);
    case 'lex':
      return new LexScanner(config);
    case 'kendra':
      return new KendraScanner(config);
    case 'amplify':
      return new AmplifyScanner(config);
    case 'location':
      return new LocationScanner(config);
    case 'lightsail':
      return new LightsailScanner(config);

    // Phase 9: Streaming, Analytics & Communication
    case 'kinesisvideo':
      return new KinesisVideoScanner(config);
    case 'flink':
      return new FlinkScanner(config);
    case 'quicksight':
      return new QuickSightScanner(config);
    case 'pinpoint':
      return new PinpointScanner(config);
    case 'connect':
      return new ConnectScanner(config);
    case 'ivs':
      return new IVSScanner(config);
    case 'mediaconvert':
      return new MediaConvertScanner(config);
    case 'medialive':
      return new MediaLiveScanner(config);

    // Phase 10: IoT, Niche & Remaining
    case 'iot':
      return new IoTScanner(config);
    case 'forecast':
      return new ForecastScanner(config);
    case 'personalize':
      return new PersonalizeScanner(config);
    case 'frauddetector':
      return new FraudDetectorScanner(config);
    case 'workspaces':
      return new WorkSpacesScanner(config);
    case 'verifiedaccess':
      return new VerifiedAccessScanner(config);
    case 'vpclattice':
      return new VPCLatticeScanner(config);
    case 'elastictranscoder':
      return new ElasticTranscoderScanner(config);
    case 'cloudsearch':
      return new CloudSearchScanner(config);
    case 'healthlake':
      return new HealthLakeScanner(config);

    default:
      console.warn(`No scanner available for service: ${service}`);
      return null;
  }
}

// Get all supported services
export function getSupportedServices(): ServiceType[] {
  return [
    // Compute
    'ec2', 'vpc', 'subnet', 'securityGroup', 'lambda', 'ecs', 'eks', 'autoscaling',
    // Storage
    's3', 'efs', 'ecr', 'backup',
    // Database
    'rds', 'dynamodb', 'elasticache', 'redshift', 'opensearch',
    // Networking
    'alb', 'cloudfront', 'route53', 'wafv2',
    // Management
    'cloudformation', 'cloudwatch', 'cloudtrail', 'config', 'ssm',
    // Analytics
    'glue', 'athena', 'kinesis', 'firehose', 'msk', 'emr',
    // Integration
    'sns', 'sqs', 'stepfunctions', 'eventbridge', 'apigateway', 'appsync', 'ses',
    // Security
    'secretsmanager', 'kms', 'iam', 'guardduty', 'accessanalyzer', 'inspector', 'acm',
    // Identity
    'cognito',
    // Developer Tools
    'codepipeline', 'codebuild',
    // ML & AI
    'sagemaker',
    // Data Pipeline
    'mwaa', 'transfer',
    // Phase 4: Database & Networking
    'neptune', 'documentdb', 'memorydb', 'timestream', 'keyspaces',
    'transitgateway', 'globalaccelerator', 'directconnect', 'networkfirewall', 'mq',
    // Phase 5: Storage, Migration & Compute
    'fsx', 'storagegateway', 'dms', 'datasync', 'drs',
    'lakeformation', 'elasticbeanstalk', 'apprunner', 'batch', 'appflow',
    // Phase 6: Security & Compliance
    'macie', 'fms', 'shield', 'cloudhsm', 'directoryservice',
    'detective', 'auditmanager', 'ram', 'organizations', 'trustedadvisor',
    // Phase 7: Developer Tools & Management
    'codedeploy', 'codeartifact', 'xray', 'fis', 'imagebuilder',
    'servicecatalog', 'licensemanager', 'computeoptimizer',
    // Phase 8: AI/ML & Frontend
    'bedrock', 'comprehend', 'rekognition', 'textract', 'transcribe',
    'lex', 'kendra', 'amplify', 'location', 'lightsail',
    // Phase 9: Streaming, Analytics & Communication
    'kinesisvideo', 'flink', 'quicksight', 'pinpoint', 'connect',
    'ivs', 'mediaconvert', 'medialive',
    // Phase 10: IoT, Niche & Remaining
    'iot', 'forecast', 'personalize', 'frauddetector', 'workspaces',
    'verifiedaccess', 'vpclattice', 'elastictranscoder', 'cloudsearch', 'healthlake',
  ];
}
