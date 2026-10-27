# Brief: telemetry ingestion on AWS

Architecture diagram for our telemetry ingestion platform on AWS, for the engineering wiki.
Devices send data over MQTT to AWS IoT Core; a rule forwards it to Kinesis Data Streams. A
Lambda function validates and enriches the records and writes them to S3 (a raw bucket and a
curated bucket) and to Timestream, which feeds live Grafana dashboards. Glue crawls the
curated bucket, Athena serves ad-hoc queries, and QuickSight reports on Athena. Everything
runs across two availability zones in eu-west-1. Records that fail validation go to an SQS
dead-letter queue with a CloudWatch alarm.

Deliverable: diagram.svg.
