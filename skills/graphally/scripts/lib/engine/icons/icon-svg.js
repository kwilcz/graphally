// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Turning a vendor's SVG file into a pack entry. Shared by the icon downloader (Node) and
// the browser viewer, so it uses nothing but strings.

// One icon's SVG reduced to its viewBox and inner markup, with every internal id made
// unique per figure: {{P}} is replaced with a prefix when the icon is drawn.
export function svgEntry(svg) {
  if (/<style|class=/.test(svg)) return null;                 // needs a stylesheet we cannot scope
  const viewBox = (svg.match(/<svg[^>]*\sviewBox="([^"]+)"/) || [])[1]
    || ((m => m && `0 0 ${parseFloat(m[1])} ${parseFloat(m[2])}`)(svg.match(/<svg[^>]*\swidth="([\d.]+)[a-z]*"[^>]*\sheight="([\d.]+)[a-z]*"/)));
  if (!viewBox) return null;
  let body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
    .replace(/<title[\s\S]*?<\/title>/g, '')
    .replace(/\s(inkscape|sodipodi):[\w-]+="[^"]*"/g, '')
    .replace(/xlink:href=/g, 'href=')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n\s*/g, ' ').trim();
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  ids.forEach((id, i) => {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="{{P}}-${i}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#{{P}}-${i})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#{{P}}-${i}"`);
  });
  return { viewBox, body };
}

// "AmazonSimpleStorageService" -> "amazon-simple-storage-service", "AWSIAMIdentityCenter" ->
// "aws-iam-identity-center": known acronyms are split off first, then camel case.
const ACRONYMS = ['AWS', 'IAM', 'VPC', 'NAT', 'EC2', 'ECS', 'EKS', 'ECR', 'EBS', 'EFS', 'RDS', 'SQS', 'SNS', 'SES', 'KMS', 'WAF', 'API', 'SDK', 'CLI', 'IoT', 'HPC', 'VPN', 'DNS', 'MSK', 'MQ', 'EMR', 'ACM', 'HSM', 'SSO', 'S3', 'IDE', 'DB'];
export const kebab = s => s.replace(/\.svg$/i, '').replace(/_/g, '-')
  .replace(new RegExp(`(${ACRONYMS.join('|')})(?=[A-Z])`, 'g'), '$1-')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
  .replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
