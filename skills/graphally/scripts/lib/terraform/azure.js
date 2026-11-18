// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What the draft knows about Azure resources, by type without the azurerm_ prefix.

export const isAzure = resource => resource.type.startsWith('azurerm_');
export const azureType = resource => resource.type.replace(/^azurerm_/, '');

// type -> [kind shown to readers, icon, short id prefix]
export const KIND = {
  resource_group: ['Resource group', 'rg', 'rg'],
  virtual_network: ['Virtual network', 'vnet', 'vnet'],
  subnet: ['Subnet', 'subnet', 'snet'],
  linux_web_app: ['App Service', 'app service', 'app'],
  windows_web_app: ['App Service', 'app service', 'app'],
  app_service: ['App Service', 'app service', 'app'],
  linux_web_app_slot: ['Deployment slot', 'slots', 'slot'],
  windows_web_app_slot: ['Deployment slot', 'slots', 'slot'],
  linux_function_app: ['Function App', 'functions', 'func'],
  windows_function_app: ['Function App', 'functions', 'func'],
  function_app: ['Function App', 'functions', 'func'],
  service_plan: ['App Service plan', 'app service plan', 'plan'],
  app_service_plan: ['App Service plan', 'app service plan', 'plan'],
  static_web_app: ['Static Web App', 'static apps', 'swa'],
  key_vault: ['Key Vault', 'kv', 'kv'],
  log_analytics_workspace: ['Log Analytics', 'log analytics', 'log'],
  application_insights: ['Application Insights', 'app insights', 'appi'],
  storage_account: ['Storage account', 'storage', 'st'],
  mssql_server: ['Azure SQL', 'sql', 'sql'],
  sql_server: ['Azure SQL', 'sql', 'sql'],
  mssql_managed_instance: ['SQL Managed Instance', 'sql mi', 'sqlmi'],
  cosmosdb_account: ['Cosmos DB', 'cosmos', 'cosmos'],
  postgresql_flexible_server: ['PostgreSQL', 'postgres', 'psql'],
  mysql_flexible_server: ['MySQL', 'mysql', 'mysql'],
  redis_cache: ['Azure Cache for Redis', 'redis', 'redis'],
  firewall: ['Azure Firewall', 'firewall', 'afw'],
  firewall_policy: ['Firewall policy', 'firewall', 'afwp'],
  bastion_host: ['Azure Bastion', 'bastion', 'bas'],
  public_ip: ['Public IP', 'public ip', 'pip'],
  network_security_group: ['NSG', 'nsg', 'nsg'],
  route_table: ['Route table', 'route table', 'rt'],
  private_endpoint: ['Private endpoint', 'private endpoint', 'pe'],
  private_dns_zone: ['Private DNS zone', 'private dns', 'pdns'],
  dns_zone: ['DNS zone', 'dns', 'dns'],
  private_dns_resolver: ['DNS Private Resolver', 'dns resolver', 'dnspr'],
  virtual_network_gateway: ['VPN gateway', 'vpn gateway', 'vgw'],
  nat_gateway: ['NAT gateway', 'nat', 'ng'],
  express_route_circuit: ['ExpressRoute', 'expressroute', 'erc'],
  lb: ['Load balancer', 'lb', 'lb'],
  application_gateway: ['Application Gateway', 'app gateway', 'agw'],
  cdn_frontdoor_profile: ['Front Door', 'front door', 'afd'],
  frontdoor: ['Front Door', 'front door', 'afd'],
  api_management: ['API Management', 'apim', 'apim'],
  servicebus_namespace: ['Service Bus', 'service bus', 'sb'],
  eventhub_namespace: ['Event Hubs', 'event hubs', 'evh'],
  eventgrid_topic: ['Event Grid topic', 'event grid', 'egt'],
  eventgrid_system_topic: ['Event Grid system topic', 'event grid', 'egst'],
  container_registry: ['Container Registry', 'acr', 'acr'],
  kubernetes_cluster: ['AKS', 'aks', 'aks'],
  container_app_environment: ['Container Apps environment', 'aca', 'cae'],
  container_app: ['Container App', 'container app', 'ca'],
  container_group: ['Container Instances', 'aci', 'aci'],
  user_assigned_identity: ['Managed identity', 'managed identity', 'id'],
  linux_virtual_machine: ['Virtual machine', 'vm', 'vm'],
  windows_virtual_machine: ['Virtual machine', 'vm', 'vm'],
  linux_virtual_machine_scale_set: ['VM scale set', 'vmss', 'vmss'],
  windows_virtual_machine_scale_set: ['VM scale set', 'vmss', 'vmss'],
  search_service: ['AI Search', 'search', 'srch'],
  cognitive_account: ['Azure AI services', 'cognitive services', 'ai'],
  data_factory: ['Data Factory', 'data factory', 'adf'],
  databricks_workspace: ['Databricks', 'databricks', 'dbw'],
  logic_app_workflow: ['Logic App', 'logic app', 'logic'],
  signalr_service: ['SignalR', 'signalr', 'sigr'],
  communication_service: ['Communication Services', 'communication services', 'acs'],
};

// What a reference to a resource of this type usually means, as a link label.
export const USE = {
  key_vault: 'secrets', application_insights: 'telemetry', log_analytics_workspace: 'logs',
  storage_account: 'storage', mssql_server: 'SQL', sql_server: 'SQL', cosmosdb_account: 'data',
  redis_cache: 'cache', servicebus_namespace: 'messages', eventhub_namespace: 'events',
  container_registry: 'images', postgresql_flexible_server: 'SQL', mysql_flexible_server: 'SQL',
  search_service: 'queries', cognitive_account: 'inference', user_assigned_identity: 'identity',
};

// Children that fold into their parent's subtitle: type -> the attribute that names the parent,
// and the word for one of them ("Azure SQL · 2 databases").
export const CHILD = {
  mssql_database: 'server_id', sql_database: 'server_name', storage_container: 'storage_account_id',
  storage_queue: 'storage_account_name', storage_share: 'storage_account_id', servicebus_queue: 'namespace_id',
  servicebus_topic: 'namespace_id', eventhub: 'namespace_id', cosmosdb_sql_database: 'account_name',
  key_vault_secret: 'key_vault_id', key_vault_key: 'key_vault_id', key_vault_access_policy: 'key_vault_id',
  container_registry_webhook: 'registry_name', network_interface: null,
  postgresql_flexible_server_database: 'server_id', mysql_flexible_server_database: 'server_id',
  api_management_api: 'api_management_name', kubernetes_cluster_node_pool: 'kubernetes_cluster_id',
  container_app_environment_storage: 'container_app_environment_id',
};
export const CHILD_WORD = {
  mssql_database: 'database', sql_database: 'database', storage_container: 'container', storage_queue: 'queue',
  storage_share: 'share', servicebus_queue: 'queue', servicebus_topic: 'topic', eventhub: 'hub',
  cosmosdb_sql_database: 'database', key_vault_secret: 'secret', key_vault_key: 'key',
  postgresql_flexible_server_database: 'database', mysql_flexible_server_database: 'database',
  api_management_api: 'API', kubernetes_cluster_node_pool: 'node pool',
};

// The attribute of a type's SKU, where the SKU changes what the thing is (plan size, firewall
// tier); sku.tier is the tier of its sku block.
export const SKU_OF = {
  service_plan: 'sku_name', app_service_plan: 'sku_name', firewall: 'sku_tier', application_gateway: 'sku.tier',
  api_management: 'sku_name', redis_cache: 'sku_name', virtual_network_gateway: 'sku',
};

// Never drawn: configuration, not architecture.
const IGNORED = [
  'management_lock', 'resource_group_template_deployment', 'monitor_action_group', 'monitor_metric_alert',
  'key_vault_access_policy', 'role_definition', 'policy_.*', 'subscription_.*', 'resource_provider_registration',
  'private_dns_a_record', 'dns_a_record', 'dns_cname_record', 'app_service_custom_hostname_binding',
  'app_service_certificate.*',
  'cdn_frontdoor_(origin|origin_group|route|endpoint|rule.*|custom_domain.*|security_policy)',
  'firewall_policy_rule_collection_group', 'network_watcher.*', 'backup_.*',
];
export const IGNORE = new RegExp(`^(${IGNORED.join('|')})$`);

// Plumbing: drawn as the links and labels it stands for (links.js), not as a box.
const PLUMBING_TYPES = [
  '_association$', '_peering$', '_virtual_network_link$', '^role_assignment$',
  '^monitor_diagnostic_setting$', '_swift_connection$',
];
export const PLUMBING = new RegExp(PLUMBING_TYPES.join('|'));
