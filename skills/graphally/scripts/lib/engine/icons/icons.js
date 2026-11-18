// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Icon resolution. Authors write what they mean ("app service", "lambda", "kv", "user");
// we find the icon. Azure and AWS names come from the vendors' official packs (downloaded
// by scripts/fetch-icons.mjs); generic concepts that have no vendor icon (people, devices,
// external APIs) use a small built-in outline set. "aws:" or "azure:" picks a pack.

const packs = new Map();

// Common abbreviations and everyday names for Azure services.
const AZURE_ALIASES = {
  'app service': 'app-services', 'web app': 'app-services', webapp: 'app-services', 'app services': 'app-services',
  slot: 'web-slots', slots: 'web-slots', 'deployment slot': 'web-slots', 'deployment slots': 'web-slots',
  'app service plan': 'app-service-plans', asp: 'app-service-plans',
  function: 'function-apps', functions: 'function-apps', func: 'function-apps', 'function app': 'function-apps', 'azure functions': 'function-apps',
  aks: 'kubernetes-services', kubernetes: 'kubernetes-services', k8s: 'kubernetes-services',
  aca: 'container-app-environments', 'container apps': 'container-app-environments', 'container app environment': 'container-app-environments',
  'container app': 'worker-container-app', container: 'worker-container-app',
  aci: 'container-instances', acr: 'container-registries', registry: 'container-registries', 'container registry': 'container-registries',
  vm: 'virtual-machine', 'virtual machine': 'virtual-machine', vms: 'virtual-machine', vmss: 'vm-scale-sets',
  'service bus': 'service-bus', sb: 'service-bus', queue: 'service-bus', topic: 'service-bus',
  'event hub': 'event-hubs', 'event hubs': 'event-hubs', eh: 'event-hubs', 'event grid': 'event-grid-topics', eg: 'event-grid-topics',
  apim: 'api-management-services', 'api management': 'api-management-services', 'logic app': 'logic-apps', 'logic apps': 'logic-apps',
  afd: 'front-doors', 'front door': 'front-doors', frontdoor: 'front-doors', cdn: 'cdn-profiles',
  appgw: 'application-gateways', 'app gateway': 'application-gateways', 'application gateway': 'application-gateways', waf: 'web-application-firewall-policies-waf',
  fw: 'firewalls', firewall: 'firewalls', 'azure firewall': 'firewalls', bastion: 'bastions', lb: 'load-balancers', 'load balancer': 'load-balancers',
  vnet: 'virtual-networks', 'virtual network': 'virtual-networks', subnet: 'subnet', nsg: 'network-security-groups',
  'route table': 'route-tables', udr: 'route-tables', 'private endpoint': 'private-endpoint', pe: 'private-endpoint', 'private link': 'private-link',
  'private dns': 'dns-zones', dns: 'dns-zones', 'dns zone': 'dns-zones', 'dns resolver': 'dns-private-resolver', nat: 'nat', 'nat gateway': 'nat',
  vpn: 'virtual-network-gateways', 'vpn gateway': 'virtual-network-gateways', 'virtual network gateway': 'virtual-network-gateways',
  expressroute: 'expressroute-circuits', er: 'expressroute-circuits', 'public ip': 'public-ip-addresses', pip: 'public-ip-addresses',
  'ddos': 'ddos-protection-plans', 'local network gateway': 'local-network-gateways', peering: 'peerings',
  entra: 'entra-identity', 'entra id': 'entra-identity', aad: 'azure-active-directory', 'azure ad': 'azure-active-directory', 'active directory': 'azure-active-directory',
  b2c: 'azure-ad-b2c', 'external id': 'external-id', 'managed identity': 'managed-identities', mi: 'managed-identities',
  'app registration': 'app-registrations', 'enterprise app': 'enterprise-applications',
  kv: 'key-vaults', 'key vault': 'key-vaults', keyvault: 'key-vaults', defender: 'azure-defender', sentinel: 'azure-sentinel',
  sql: 'sql-database', 'azure sql': 'sql-database', 'sql database': 'sql-database', 'sql server': 'sql-server', 'sql mi': 'sql-managed-instance',
  cosmos: 'azure-cosmos-db', cosmosdb: 'azure-cosmos-db', 'cosmos db': 'azure-cosmos-db', redis: 'cache-redis', cache: 'cache-redis',
  postgres: 'azure-database-postgresql-server', postgresql: 'azure-database-postgresql-server', mysql: 'azure-database-mysql-server',
  storage: 'storage-accounts', 'storage account': 'storage-accounts', blob: 'storage-accounts', 'blob storage': 'storage-accounts',
  'file share': 'azure-fileshare', adls: 'data-lake-storage-gen1', 'data factory': 'data-factory', adf: 'data-factory', synapse: 'azure-synapse-analytics',
  databricks: 'azure-databricks', 'app insights': 'application-insights', appi: 'application-insights', 'application insights': 'application-insights',
  'log analytics': 'log-analytics-workspaces', law: 'log-analytics-workspaces', monitor: 'monitor', 'azure monitor': 'monitor',
  'management group': 'management-groups', mg: 'management-groups', subscription: 'subscriptions', sub: 'subscriptions',
  'resource group': 'resource-groups', rg: 'resource-groups', policy: 'policy', devops: 'azure-devops', 'azure devops': 'azure-devops',
  signalr: 'signalr', openai: 'azure-openai', 'azure openai': 'azure-openai', search: 'search-services', 'ai search': 'search-services',
};

// The same for AWS.
const AWS_ALIASES = {
  lambda: 'aws-lambda', 'aws lambda': 'aws-lambda', s3: 'amazon-simple-storage-service', 'amazon s3': 'amazon-simple-storage-service', bucket: 'amazon-simple-storage-service',
  glacier: 'amazon-simple-storage-service-glacier', dynamodb: 'amazon-dynamo-db', dynamo: 'amazon-dynamo-db', 'api gateway': 'amazon-api-gateway', apigw: 'amazon-api-gateway',
  cloudfront: 'amazon-cloud-front', cognito: 'amazon-cognito', vpc: 'amazon-virtual-private-cloud', route53: 'amazon-route53', 'route 53': 'amazon-route53',
  elb: 'elastic-load-balancing', alb: 'elastic-load-balancing-application-load-balancer', nlb: 'elastic-load-balancing-network-load-balancer',
  'load balancer': 'elastic-load-balancing', 'application load balancer': 'elastic-load-balancing-application-load-balancer',
  ec2: 'amazon-ec2', 'auto scaling': 'amazon-ec2-auto-scaling', 'auto scaling group': 'auto-scalinggroup', ecs: 'amazon-elastic-container-service', eks: 'amazon-elastic-kubernetes-service',
  ecr: 'amazon-elastic-container-registry', fargate: 'aws-fargate', rds: 'amazon-rds', aurora: 'amazon-aurora', sqs: 'amazon-simple-queue-service',
  sns: 'amazon-simple-notification-service', ses: 'amazon-simple-email-service', eventbridge: 'amazon-event-bridge', 'event bridge': 'amazon-event-bridge',
  'step functions': 'aws-step-functions', cloudwatch: 'amazon-cloud-watch', kms: 'aws-key-management-service', 'secrets manager': 'aws-secrets-manager',
  waf: 'aws-waf', shield: 'aws-shield', elasticache: 'amazon-elasti-cache', kinesis: 'amazon-kinesis', iam: 'aws-identityand-access-management',
  'identity center': 'aws-iam-identity-center', sso: 'aws-iam-identity-center', cloudtrail: 'aws-cloud-trail', cloudformation: 'aws-cloud-formation',
  sagemaker: 'amazon-sage-maker', bedrock: 'amazon-bedrock', athena: 'amazon-athena', glue: 'aws-glue', redshift: 'amazon-redshift', ebs: 'amazon-elastic-block-store',
  efs: 'amazon-efs', opensearch: 'amazon-open-search-service', appsync: 'aws-app-sync', amplify: 'aws-amplify', 'app runner': 'aws-app-runner',
  'elastic beanstalk': 'aws-elastic-beanstalk', beanstalk: 'aws-elastic-beanstalk', 'transit gateway': 'aws-transit-gateway', 'direct connect': 'aws-direct-connect',
  'nat gateway': 'amazon-vpc-nat-gateway', 'internet gateway': 'amazon-vpc-internet-gateway', 'systems manager': 'aws-systems-manager', organizations: 'aws-organizations',
  'control tower': 'aws-control-tower', guardduty: 'amazon-guard-duty', 'certificate manager': 'aws-certificate-manager', acm: 'aws-certificate-manager', xray: 'aws-x-ray',
  'x ray': 'aws-x-ray', 'aws cloud': 'aws-cloud', 'aws account': 'aws-account', account: 'aws-account', region: 'region', 'private subnet': 'privatesubnet',
  'public subnet': 'publicsubnet', 'corporate data center': 'corporatedatacenter', 'data center': 'corporatedatacenter', 'code pipeline': 'aws-code-pipeline',
  codepipeline: 'aws-code-pipeline', codebuild: 'aws-code-build', backup: 'aws-backup', mq: 'amazon-mq', msk: 'amazon-managed-streaming-for-apache-kafka',
};
const ALIASES = { azure: AZURE_ALIASES, aws: AWS_ALIASES };

// Built-in outline icons (24×24, stroke = currentColor). Two-tone with a soft fill.
const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const F = 'style="fill: var(--icon-soft, #dbe6f6)"';
const GENERIC = {
  user: `<circle cx="12" cy="8" r="4" ${F}/><circle cx="12" cy="8" r="4" ${S}/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" ${F}/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" ${S}/>`,
  users: `<circle cx="9" cy="8" r="3.5" ${F}/><circle cx="9" cy="8" r="3.5" ${S}/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6" ${S}/><circle cx="16.5" cy="7.5" r="3" ${S}/><path d="M17 13.5c2.8.3 4.8 2.3 4.8 5.5" ${S}/>`,
  browser: `<rect x="2.5" y="4" width="19" height="16" rx="2" ${F}/><rect x="2.5" y="4" width="19" height="16" rx="2" ${S}/><path d="M2.5 8.5h19M5.5 6.3h.01M8 6.3h.01" ${S}/>`,
  mobile: `<rect x="6.5" y="2.5" width="11" height="19" rx="2.2" ${F}/><rect x="6.5" y="2.5" width="11" height="19" rx="2.2" ${S}/><path d="M10.5 18.5h3" ${S}/>`,
  laptop: `<rect x="4" y="5" width="16" height="11" rx="1.5" ${F}/><rect x="4" y="5" width="16" height="11" rx="1.5" ${S}/><path d="M2 19h20" ${S}/>`,
  server: `<rect x="4" y="3.5" width="16" height="7" rx="1.5" ${F}/><rect x="4" y="13.5" width="16" height="7" rx="1.5" ${F}/><rect x="4" y="3.5" width="16" height="7" rx="1.5" ${S}/><rect x="4" y="13.5" width="16" height="7" rx="1.5" ${S}/><path d="M7.5 7h.01M7.5 17h.01" ${S}/>`,
  database: `<ellipse cx="12" cy="5.5" rx="7.5" ry="3" ${F}/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" ${F}/><ellipse cx="12" cy="5.5" rx="7.5" ry="3" ${S}/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" ${S}/>`,
  api: `<rect x="2.5" y="5" width="19" height="14" rx="3" ${F}/><rect x="2.5" y="5" width="19" height="14" rx="3" ${S}/><path d="M8.5 9.5 6 12l2.5 2.5M15.5 9.5 18 12l-2.5 2.5M13 9l-2 6" ${S}/>`,
  globe: `<circle cx="12" cy="12" r="9" ${F}/><circle cx="12" cy="12" r="9" ${S}/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" ${S}/>`,
  building: `<path d="M4 21V5.5L12 3v18M12 8.5l8 2.5V21" ${F}/><path d="M3 21h18M4 21V5.5L12 3v18M12 8.5l8 2.5V21M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2" ${S}/>`,
  cloud: `<path d="M7 18.5h10.5a4 4 0 0 0 .6-8A6 6 0 0 0 6.6 9.2 4.7 4.7 0 0 0 7 18.5z" ${F}/><path d="M7 18.5h10.5a4 4 0 0 0 .6-8A6 6 0 0 0 6.6 9.2 4.7 4.7 0 0 0 7 18.5z" ${S}/>`,
  key: `<circle cx="8" cy="15" r="4.5" ${F}/><circle cx="8" cy="15" r="4.5" ${S}/><path d="m11.3 11.7 8.2-8.2M16.5 6.5l2.5 2.5M14 9l2 2" ${S}/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2" ${F}/><rect x="5" y="10.5" width="14" height="10" rx="2" ${S}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ${S}/>`,
  shield: `<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z" ${F}/><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z" ${S}/>`,
  file: `<path d="M6 2.5h8l4.5 4.5v14.5H6z" ${F}/><path d="M6 2.5h8l4.5 4.5v14.5H6zM14 2.5V7h4.5" ${S}/>`,
  gear: `<circle cx="12" cy="12" r="3" ${S}/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" ${S}/>`,
  mail: `<rect x="3" y="5.5" width="18" height="13" rx="2" ${F}/><rect x="3" y="5.5" width="18" height="13" rx="2" ${S}/><path d="m3.5 6.5 8.5 6.5 8.5-6.5" ${S}/>`,
  message: `<path d="M4 5h16v11H9l-5 4z" ${F}/><path d="M4 5h16v11H9l-5 4z" ${S}/>`,
  timer: `<circle cx="12" cy="13" r="8" ${F}/><circle cx="12" cy="13" r="8" ${S}/><path d="M12 9v4l2.5 2M10 2.5h4" ${S}/>`,
  code: `<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5" ${S}/>`,
  repo: `<path d="M5 4.5A2 2 0 0 1 7 2.5h12v15H7a2 2 0 0 0-2 2z" ${F}/><path d="M5 19.5v-15A2 2 0 0 1 7 2.5h12v15H7a2 2 0 0 0 0 4h12" ${S}/>`,
  person: null, people: null, phone: null, app: null, web: null, external: null, partner: null, onprem: null, 'on-premises': null, datacenter: null, internet: null, saas: null, terraform: null,
};
const GENERIC_ALIASES = { person: 'user', people: 'users', phone: 'mobile', app: 'mobile', web: 'browser', external: 'api', partner: 'building', onprem: 'building', 'on-premises': 'building', datacenter: 'building', internet: 'globe', saas: 'cloud', terraform: 'code' };

export function registerPack(prefix, pack) { packs.set(prefix, pack); }
export const loadedPacks = () => [...packs.keys()];

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stem = w => w.replace(/(ies)$/, 'y').replace(/(ses|xes)$/, (m) => m.slice(0, -2)).replace(/s$/, '');

// Returns { key, kind: 'azure'|'aws'|'generic', def } or { error, suggestions, missing }.
// order: which vendor pack wins for a name both could mean (<diagram icons=aws>).
export function resolveIcon(name, order = ['azure', 'aws']) {
  if (!name) return null;
  const raw = String(name).trim();
  // "aws:lambda", "azure/app-services": one pack only.
  const pre = /^(azure|aws)[:/](.+)$/i.exec(raw);
  const vendors = pre ? [pre[1].toLowerCase()] : [...new Set([...order, 'azure', 'aws'])];
  const n = norm(pre ? pre[2] : raw);
  if (!pre) {
    const g = GENERIC_ALIASES[n] || (GENERIC[n] ? n : null);
    if (g && GENERIC[g]) return { key: `g-${g}`, kind: 'generic', def: { viewBox: '0 0 24 24', body: GENERIC[g] } };
  }
  const dashed = n.replace(/ /g, '-');
  const hit = (v, key) => ({ key: `${v}-${key}`, kind: v, def: packs.get(v)[key] });
  // Exact names and aliases in every pack first, then loose word matches.
  for (const v of vendors) {
    const pack = packs.get(v);
    if (!pack) continue;
    if (pack[dashed]) return hit(v, dashed);
    const alias = ALIASES[v][n];
    if (alias && pack[alias]) return hit(v, alias);
  }
  const want = n.split(' ').map(stem);
  for (const v of vendors) {
    const pack = packs.get(v);
    if (!pack) continue;
    let best = null, bestScore = 0;
    for (const key of Object.keys(pack)) {
      const have = key.split('-').map(stem).filter(w => w !== 'aws' && w !== 'amazon');
      const got = want.filter(w => have.includes(w)).length;
      if (!got) continue;
      const score = got / want.length - (have.length - got) * 0.04;
      if (score > bestScore) { best = key; bestScore = score; }
    }
    if (best && bestScore >= 0.99 - 0.04 * 3) return hit(v, best);
  }
  // A name meant for a pack that is not downloaded yet says so.
  const missing = vendors.filter(v => !packs.get(v) && (pre || ALIASES[v][n]));
  return { error: true, suggestions: suggest(want, vendors), missing };
}

function suggest(want, vendors) {
  return vendors.flatMap(v => Object.keys(packs.get(v) || {}).map(k => ({ k: v === 'azure' ? k : `${v}:${k}`, s: want.filter(w => k.includes(w)).length })))
    .filter(x => x.s).sort((a, b) => b.s - a.s || a.k.length - b.k.length).slice(0, 3).map(x => x.k);
}

// Symbol markup for one figure; internal ids made unique with the figure prefix.
export function symbolFor(resolved, prefix) {
  const id = `${prefix}-${resolved.key}`;
  const body = resolved.kind === 'generic' ? resolved.def.body : resolved.def.body.replaceAll('{{P}}', id);
  return { id, markup: `<symbol id="${id}" viewBox="${resolved.def.viewBox}">${body}</symbol>` };
}
