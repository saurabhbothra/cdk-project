import { Repository } from '@aws-cdk/aws-codecommit';
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { App, Stack, StackProps, CfnOutput } from '@aws-cdk/core';
import { ServicePrincipal } from '@aws-cdk/aws-iam';
import {
    CodeCommitSourceAction,
    CloudFormationCreateUpdateStackAction,
    CodeBuildAction
} from '@aws-cdk/aws-codepipeline-actions';
import { IAction } from '@aws-cdk/aws-codepipeline';
import {LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";

export class BuildStack extends Stack {
    constructor(parent: App, name: string, props?: StackProps) {
        super(parent, name, props);
        const region = 'us-east-1'
        const stage = 'gamma'

        const repo = new Repository(this, 'CassowaryBitbucketAppDescriptorRepo', {repositoryName: 'CassowaryBitbucketAppDescriptor1'});

        const pipeline = new Pipeline(this, 'Pipeline', {
            pipelineName: 'CassowaryBitbucketAppDescriptor'
        });

        pipeline.addToRolePolicy(new PolicyStatement({
            actions: ["iam:PassRole"],
            resources: ["*"]
        }));

        // Allow the pipeline to execute CFN changes
        pipeline.addToRolePolicy(new PolicyStatement({
            actions: [
                "cloudFormation:Describe*",
                "cloudFormation:Get*",
                "cloudFormation:List*",
                "cloudFormation:Validate*",
                "cloudformation:CreateChangeSet",
                "cloudformation:ExecuteChangeSet",
                "cloudformation:DeleteChangeSet"
            ],
            resources: ["*"]
        }));

        // Allows the pipeline to execute the gated garden upload script. Don't remove!
        pipeline.artifactBucket.addToResourcePolicy(new PolicyStatement({
            actions: ["s3:GetObject*"],
            resources: [pipeline.artifactBucket.arnForObjects("*")],
            principals: [new ServicePrincipal("gatedgarden.aws.internal")]
        }));

        const sourceOutput = new Artifact();
        const buildOutput = new Artifact('BuildOutput');

        pipeline.addStage({
            stageName: 'Source',
            actions: [
                new CodeCommitSourceAction({
                    actionName: 'CodeCommit_Source',
                    repository: repo,
                    branch: 'main',
                    output: sourceOutput,
                })
            ]
        });

        const cdkBuild = new PipelineProject(this, 'CassowaryBitbucketAppDescriptorBuildProject', {
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
            },
        });

        cdkBuild.addToRolePolicy(new PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [
                'arn:aws:s3:::codeartifact/*',
                'arn:aws:s3:::gatedgarden-cortado-codebuild-tracking-script-vending-prod/*'
            ]
        }));

        cdkBuild.addToRolePolicy(new PolicyStatement({
            actions: [
                "codeartifact:GetAuthorizationToken",
                "codeartifact:GetRepositoryEndpoint",
                "codeartifact:ReadFromRepository",
                "sts:GetServiceBearerToken"
            ],
            resources: ['*']
        }));

        cdkBuild.addToRolePolicy(new PolicyStatement({
            actions: ['licensetooling:AreVersionsApproved'],
            resources: ['*']
        }));

        cdkBuild.addToRolePolicy(new PolicyStatement({
            actions: ['s3:PutObject'],
            resources: [`arn:aws:s3:::do-not-delete-gatedgarden-audit-${this.account}/*`]
        }));

        pipeline.addStage({
            stageName: "Build",
            actions: [
                new CodeBuildAction({
                    actionName: "Build",
                    project: cdkBuild,
                    input: sourceOutput,
                    outputs: [buildOutput],
                }),
            ],
        });

        const actions: IAction[] = [];
        var runOrder = 1;
        actions.push(new CloudFormationCreateUpdateStackAction({
            actionName: `Deploy`,
            templatePath: sourceOutput.atPath('cdk.out/CdkProjectStack.template.json'),
            stackName: 'CdkProjectStack',
            adminPermissions: true,
            parameterOverrides: {
                stage: stage, // Pass stage parameter dynamically
                region: region, // Pass region parameter dynamically
            },
            region: 'us-east-1',
            runOrder: runOrder
        }))

        pipeline.addStage({
            stageName: `Deploy`,
            actions: actions
        });

        new CfnOutput(this, "CodeCommitRepoArn", {
            value: repo.repositoryArn
        });
    }
}
