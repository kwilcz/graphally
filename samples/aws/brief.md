# Brief: serverless photo sharing on AWS

An architecture diagram for the team wiki of a photo-sharing app that runs on AWS in
eu-west-1.

Customers use a mobile app and a web app. Static content and the API are both served
through CloudFront, which has AWS WAF attached. Customers sign in with Amazon Cognito. The
REST API runs on API Gateway with Lambda functions behind it: an upload function writes
photos to an S3 bucket and their metadata to DynamoDB, and a feed function reads the
metadata. When a photo lands in S3, an event goes to an SQS queue; a thumbnail Lambda
reads the queue, writes thumbnails back to S3, and publishes a "photo ready" message to
SNS, which sends push notifications. Every function writes logs and metrics to
CloudWatch and reads secrets from Secrets Manager.

Show the request path, the asynchronous processing path, and the shared services.
Deliverable: diagram.svg.
