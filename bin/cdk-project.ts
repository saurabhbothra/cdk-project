#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import {BuildStack} from "../lib/build-stack";
import {CdkProjectStack} from "../lib/cdk-project-stack";

const app = new App();
new BuildStack(app, 'CassowaryBitbucketAppDescriptorBuildStack', {
    env: {
        account: "653351866406",
        region: "us-east-1"
    }
});
new CdkProjectStack(app, 'CdkProjectStack');