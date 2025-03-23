import { Code, Function } from '@aws-cdk/aws-lambda';
import { Runtime } from '@aws-cdk/aws-lambda';
import {App, StackProps, Stack, CfnParameter} from '@aws-cdk/core';

interface LambdaStackProps extends StackProps {
  stage: string;
  region: string
}

export class CdkProjectStack extends Stack {
  constructor(parent: App, name: string, props?: LambdaStackProps) {
    super(parent, name, props);

    // Read parameters from CloudFormation
    const stageParam = new CfnParameter(this, "stage", {
      type: "String",
      description: "Deployment stage",
    });
    const regionParam = new CfnParameter(this, "region", {
      type: "String",
      description: "Deployment region",
    });

    const handlerFunction = new Function(this, 'DescriptorFunctionNew', {
      handler: "lambda/src/index.handler",
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset('lib/lambda'),
      environment: {
        region: regionParam.valueAsString,
        stage: stageParam.valueAsString
      }
    });
  }
}
