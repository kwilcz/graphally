// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Terraform to graphally: read a Terraform configuration (root module plus local modules)
// and write a draft diagram of what it deploys. Resource groups become boxes, VNets and
// subnets nest inside them, resources sit in the subnet they are deployed into, and
// references between resources become links. Plumbing resources (associations,
// peerings, role assignments, diagnostic settings, child objects) fold into the links
// and labels they stand for, so the draft shows the architecture, not the HCL.
//
// Only what can be read without running Terraform is used: literal names, references,
// module inputs and outputs. for_each and count show as one node marked "×N" or "each".
import fs from 'node:fs';
import path from 'node:path';

// ---------- HCL (the subset configurations use) ----------

export function parseHcl(src) {
  let i = 0;
  const n = src.length;
  const skipSpace = nl => {
    for (;;) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || (nl && c === '\n')) { i++; continue; }
      if (c === '#' || (c === '/' && src[i + 1] === '/')) { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      return;
    }
  };
  const ident = () => {
    const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i, i + 256));
    if (!m) return null;
    i += m[0].length;
    return m[0];
  };
  const string = () => {
    let out = '';
    i++;
    while (i < n && src[i] !== '"') {
      if (src[i] === '\\') { out += src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { const s = i; interp(); out += src.slice(s, i); continue; }
      out += src[i++];
    }
    i++;
    return out;
  };
  const interp = () => {
    i += 2;
    let depth = 1;
    while (i < n && depth) {
      const c = src[i];
      if (c === '"') { string(); continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
  };
  const heredoc = () => {
    const m = /^<<-?([A-Za-z_]+)[^\n]*\n/.exec(src.slice(i, i + 64));
    if (!m) { i += 2; return; }
    const end = new RegExp(`\\n\\s*${m[1]}\\s*(\\n|$)`).exec(src.slice(i + m[0].length - 1));
    i = end ? i + m[0].length - 1 + end.index + end[0].length - 1 : n;
  };
  const expr = () => {
    const s = i;
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '"') { string(); continue; }
      if (c === '<' && src[i + 1] === '<') { heredoc(); continue; }
      if (c === '#' || (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*'))) {
        if (!depth) break;
        skipSpace(true);
        continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (!depth) break; depth--; }
      else if (c === '\n' && !depth) break;
      i++;
    }
    return src.slice(s, i).trim();
  };
  const body = () => {
    const node = { attrs: {}, blocks: [] };
    for (;;) {
      skipSpace(true);
      if (i >= n) return node;
      if (src[i] === '}') { i++; return node; }
      const key = ident();
      if (!key) { i++; continue; }
      skipSpace(false);
      if (src[i] === '=' && src[i + 1] !== '=') { i++; skipSpace(false); node.attrs[key] = expr(); continue; }
      const labels = [];
      while (i < n && src[i] !== '{' && src[i] !== '\n') {
        if (src[i] === '"') labels.push(string());
        else if (!ident()) i++;
        skipSpace(false);
      }
      if (src[i] !== '{') continue;
      i++;
      const b = body();
      b.type = key; b.labels = labels;
      node.blocks.push(b);
    }
  };
  return body();
}

// ---------- modules and references ----------

const RES_REF = /\b(data\.)?([a-z][a-z0-9]*_[a-z0-9_]+)\.([A-Za-z_][\w-]*)(?:\[\s*"([^"]*)"\s*\])?/g;

function loadConfig(root) {
  const resources = new Map();            // address -> resource
  const modules = [];
  const load = (dir, prefix, args, parentScope, name) => {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.tf')).sort() : [];
    const scope = { prefix, args, parent: parentScope, locals: {}, outputs: {}, vars: {}, dir, name };
    modules.push(scope);
    const calls = [], blocks = [];
    for (const f of files) {
      const top = parseHcl(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const b of top.blocks) {
        if (b.type === 'resource' || b.type === 'data') blocks.push([b, f]);
        else if (b.type === 'locals') Object.assign(scope.locals, b.attrs);
        else if (b.type === 'variable') scope.vars[b.labels[0]] = b.attrs;
        else if (b.type === 'output') scope.outputs[b.labels[0]] = b.attrs.value || '';
        else if (b.type === 'module') calls.push(b);
      }
    }
    // for_each over a literal map or set: one resource per key ("snet-aks", "snet-db"…).
    for (const [b, f] of blocks) {
      const [type, nm] = b.labels;
      const base = `${prefix}${b.type === 'data' ? 'data.' : ''}${type}.${nm}`;
      const r = { addr: base, type, name: nm, data: b.type === 'data', body: b, scope, file: path.join(dir, f) };
      const keys = b.attrs.for_each ? collection(b.attrs.for_each, scope) : null;
      if (keys?.length) {
        resources.expanded ||= new Map();
        resources.expanded.set(base, keys.map(k => `${base}["${k.key}"]`));
        for (const k of keys) resources.set(`${base}["${k.key}"]`, { ...r, addr: `${base}["${k.key}"]`, name: `${nm}_${k.key}`, each: k });
      } else resources.set(base, r);
    }
    for (const c of calls) {
      const src = literal(c.attrs.source);
      const nm = c.labels[0];
      if (src && (src.startsWith('./') || src.startsWith('../'))) load(path.resolve(dir, src), `${prefix}module.${nm}.`, c.attrs, scope, nm);
      else resources.set(`${prefix}module.${nm}`, { addr: `${prefix}module.${nm}`, type: 'module', name: nm, remote: src, body: c, scope, file: '' });
    }
  };
  load(path.resolve(root), '', {}, null, '');
  return { resources, modules };
}

// Every resource an expression points at, following var., local. and module outputs.
function resolveRefs(raw, scope, resources, seen = new Set()) {
  const out = new Set();
  if (!raw || seen.size > 40) return out;
  const key = scope.prefix + '|' + raw;
  if (seen.has(key)) return out;
  seen.add(key);
  for (const m of raw.matchAll(RES_REF)) {
    const addr = `${scope.prefix}${m[1] || ''}${m[2]}.${m[3]}`;
    if (resources.has(addr)) out.add(addr);
    const inst = resources.expanded?.get(addr);
    if (inst) (m[4] !== undefined && resources.has(`${addr}["${m[4]}"]`) ? [`${addr}["${m[4]}"]`] : inst).forEach(a => out.add(a));
  }
  for (const m of raw.matchAll(/\bvar\.([\w-]+)/g)) {
    if (scope.args[m[1]] !== undefined && scope.parent) resolveRefs(scope.args[m[1]], scope.parent, resources, seen).forEach(a => out.add(a));
  }
  for (const m of raw.matchAll(/\blocal\.([\w-]+)/g)) {
    if (scope.locals[m[1]] !== undefined) resolveRefs(scope.locals[m[1]], scope, resources, seen).forEach(a => out.add(a));
  }
  for (const m of raw.matchAll(/\bmodule\.([\w-]+)\.([\w-]+)/g)) {
    const child = scopeOf(`${scope.prefix}module.${m[1]}.`);
    if (child && child.outputs[m[2]] !== undefined) resolveRefs(child.outputs[m[2]], child, resources, seen).forEach(a => out.add(a));
    else if (resources.has(`${scope.prefix}module.${m[1]}`)) out.add(`${scope.prefix}module.${m[1]}`);
  }
  return out;
  function scopeOf(prefix) { return resolveRefs.modules.find(s => s.prefix === prefix); }
}

// The value of a string expression as far as it can be known without running Terraform:
// variables (caller's argument or default), locals and each.key/each.value are filled in;
// anything else shows as {name}: "kv-${var.env}" -> "kv-prod", or "kv-{env}".
function literal(raw, scope, each, depth = 0) {
  if (!raw || depth > 8) return '';
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\$\{([^}]*)\}/g, (_, e) => literal(e, scope, each, depth + 1) || `{${(/([\w-]+)\s*$/.exec(e) || [, '…'])[1]}}`);
  }
  if (t === 'each.key') return each?.key ?? '';
  if (t === 'each.value') return each ? literal(each.value, scope, null, depth + 1) : '';
  const ev = /^each\.value\.([\w-]+)$/.exec(t);
  if (ev) return each ? literal(field(each.value, ev[1]), scope, null, depth + 1) : '';
  const v = /^var\.([\w-]+)$/.exec(t);
  if (v) {
    if (scope?.args?.[v[1]] !== undefined && scope.parent) return literal(scope.args[v[1]], scope.parent, null, depth + 1);
    if (scope?.vars?.[v[1]]?.default !== undefined) return literal(scope.vars[v[1]].default, scope, null, depth + 1);
    return '';
  }
  const l = /^local\.([\w-]+)$/.exec(t);
  if (l && scope?.locals?.[l[1]] !== undefined) return literal(scope.locals[l[1]], scope, each, depth + 1);
  return '';
}

// Keys (and raw values) of a literal map or set, following locals and variables.
function collection(raw, scope, depth = 0) {
  if (!raw || depth > 8) return null;
  let t = raw.trim();
  const ref = /^(var|local)\.([\w-]+)$/.exec(t);
  if (ref) {
    if (ref[1] === 'local') return collection(scope.locals[ref[2]], scope, depth + 1);
    if (scope.args[ref[2]] !== undefined && scope.parent) return collection(scope.args[ref[2]], scope.parent, depth + 1);
    return collection(scope.vars[ref[2]]?.default, scope, depth + 1);
  }
  const fn = /^(?:toset|tomap)\(([\s\S]*)\)$/.exec(t);
  if (fn) t = fn[1].trim();
  if (t.startsWith('[')) return [...t.matchAll(/"([^"]*)"/g)].map(m => ({ key: m[1], value: `"${m[1]}"` }));
  if (!t.startsWith('{')) return null;
  return entries(t.slice(1, -1)).map(([k, v]) => ({ key: k, value: v }));
}

// Top-level `key = value` entries of a map body.
function entries(body) {
  const out = [];
  let depth = 0, cur = '', inStr = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' && body[i - 1] !== '\\') inStr = !inStr;
    if (!inStr) {
      if ('{[('.includes(c)) depth++;
      else if ('}])'.includes(c)) depth--;
      else if ((c === '\n' || c === ',') && !depth) { push(); continue; }
    }
    cur += c;
  }
  push();
  return out;
  function push() {
    const m = /^\s*"?([\w.-]+)"?\s*[=:]\s*([\s\S]+?)\s*$/.exec(cur);
    if (m) out.push([m[1], m[2]]);
    cur = '';
  }
}
const field = (raw, name) => (entries((raw || '').trim().replace(/^\{|\}$/g, '')).find(([k]) => k === name) || [])[1] || '';

// Every attribute of a block, nested blocks flattened to dotted keys.
function flatAttrs(body, prefix = '', out = []) {
  for (const [k, v] of Object.entries(body.attrs)) out.push([prefix + k, v]);
  for (const b of body.blocks) flatAttrs(b, `${prefix}${b.type}.`, out);
  return out;
}

// ---------- Azure knowledge ----------

// type (without azurerm_) -> [kind shown to readers, icon, short id prefix]
const KIND = {
  resource_group: ['Resource group', 'rg', 'rg'],
  virtual_network: ['Virtual network', 'vnet', 'vnet'], subnet: ['Subnet', 'subnet', 'snet'],
  linux_web_app: ['App Service', 'app service', 'app'], windows_web_app: ['App Service', 'app service', 'app'], app_service: ['App Service', 'app service', 'app'],
  linux_web_app_slot: ['Deployment slot', 'slots', 'slot'], windows_web_app_slot: ['Deployment slot', 'slots', 'slot'],
  linux_function_app: ['Function App', 'functions', 'func'], windows_function_app: ['Function App', 'functions', 'func'], function_app: ['Function App', 'functions', 'func'],
  service_plan: ['App Service plan', 'app service plan', 'plan'], app_service_plan: ['App Service plan', 'app service plan', 'plan'],
  static_web_app: ['Static Web App', 'static apps', 'swa'],
  key_vault: ['Key Vault', 'kv', 'kv'], log_analytics_workspace: ['Log Analytics', 'log analytics', 'log'],
  application_insights: ['Application Insights', 'app insights', 'appi'],
  storage_account: ['Storage account', 'storage', 'st'], mssql_server: ['Azure SQL', 'sql', 'sql'], sql_server: ['Azure SQL', 'sql', 'sql'],
  mssql_managed_instance: ['SQL Managed Instance', 'sql mi', 'sqlmi'],
  cosmosdb_account: ['Cosmos DB', 'cosmos', 'cosmos'], postgresql_flexible_server: ['PostgreSQL', 'postgres', 'psql'],
  mysql_flexible_server: ['MySQL', 'mysql', 'mysql'], redis_cache: ['Azure Cache for Redis', 'redis', 'redis'],
  firewall: ['Azure Firewall', 'firewall', 'afw'], firewall_policy: ['Firewall policy', 'firewall', 'afwp'], bastion_host: ['Azure Bastion', 'bastion', 'bas'],
  public_ip: ['Public IP', 'public ip', 'pip'], network_security_group: ['NSG', 'nsg', 'nsg'], route_table: ['Route table', 'route table', 'rt'],
  private_endpoint: ['Private endpoint', 'private endpoint', 'pe'], private_dns_zone: ['Private DNS zone', 'private dns', 'pdns'],
  dns_zone: ['DNS zone', 'dns', 'dns'], private_dns_resolver: ['DNS Private Resolver', 'dns resolver', 'dnspr'],
  virtual_network_gateway: ['VPN gateway', 'vpn gateway', 'vgw'], nat_gateway: ['NAT gateway', 'nat', 'ng'],
  express_route_circuit: ['ExpressRoute', 'expressroute', 'erc'], lb: ['Load balancer', 'lb', 'lb'],
  application_gateway: ['Application Gateway', 'app gateway', 'agw'], cdn_frontdoor_profile: ['Front Door', 'front door', 'afd'],
  frontdoor: ['Front Door', 'front door', 'afd'], api_management: ['API Management', 'apim', 'apim'],
  servicebus_namespace: ['Service Bus', 'service bus', 'sb'], eventhub_namespace: ['Event Hubs', 'event hubs', 'evh'],
  eventgrid_topic: ['Event Grid topic', 'event grid', 'egt'], eventgrid_system_topic: ['Event Grid system topic', 'event grid', 'egst'],
  container_registry: ['Container Registry', 'acr', 'acr'], kubernetes_cluster: ['AKS', 'aks', 'aks'],
  container_app_environment: ['Container Apps environment', 'aca', 'cae'], container_app: ['Container App', 'container app', 'ca'],
  container_group: ['Container Instances', 'aci', 'aci'], user_assigned_identity: ['Managed identity', 'managed identity', 'id'],
  linux_virtual_machine: ['Virtual machine', 'vm', 'vm'], windows_virtual_machine: ['Virtual machine', 'vm', 'vm'],
  linux_virtual_machine_scale_set: ['VM scale set', 'vmss', 'vmss'], windows_virtual_machine_scale_set: ['VM scale set', 'vmss', 'vmss'],
  search_service: ['AI Search', 'search', 'srch'], cognitive_account: ['Azure AI services', 'cognitive services', 'ai'],
  data_factory: ['Data Factory', 'data factory', 'adf'], databricks_workspace: ['Databricks', 'databricks', 'dbw'],
  logic_app_workflow: ['Logic App', 'logic app', 'logic'], signalr_service: ['SignalR', 'signalr', 'sigr'],
  communication_service: ['Communication Services', 'communication services', 'acs'],
};

// What a reference to a resource of this kind usually means, as a link label.
const USE = {
  key_vault: 'secrets', application_insights: 'telemetry', log_analytics_workspace: 'logs', storage_account: 'storage',
  mssql_server: 'SQL', sql_server: 'SQL', cosmosdb_account: 'data', redis_cache: 'cache', servicebus_namespace: 'messages',
  eventhub_namespace: 'events', container_registry: 'images', postgresql_flexible_server: 'SQL', mysql_flexible_server: 'SQL',
  search_service: 'queries', cognitive_account: 'inference', user_assigned_identity: 'identity',
};

// Children that fold into a parent's subtitle: type -> attribute that names the parent.
const CHILD = {
  mssql_database: 'server_id', sql_database: 'server_name', storage_container: 'storage_account_id', storage_queue: 'storage_account_name',
  storage_share: 'storage_account_id', servicebus_queue: 'namespace_id', servicebus_topic: 'namespace_id',
  eventhub: 'namespace_id', cosmosdb_sql_database: 'account_name', key_vault_secret: 'key_vault_id', key_vault_key: 'key_vault_id',
  key_vault_access_policy: 'key_vault_id', container_registry_webhook: 'registry_name', network_interface: null,
  postgresql_flexible_server_database: 'server_id', mysql_flexible_server_database: 'server_id', api_management_api: 'api_management_name',
  kubernetes_cluster_node_pool: 'kubernetes_cluster_id', container_app_environment_storage: 'container_app_environment_id',
};
const CHILD_WORD = { mssql_database: 'database', sql_database: 'database', storage_container: 'container', storage_queue: 'queue', storage_share: 'share',
  servicebus_queue: 'queue', servicebus_topic: 'topic', eventhub: 'hub', cosmosdb_sql_database: 'database', key_vault_secret: 'secret', key_vault_key: 'key',
  postgresql_flexible_server_database: 'database', mysql_flexible_server_database: 'database', api_management_api: 'API',
  kubernetes_cluster_node_pool: 'node pool' };

// Never drawn: configuration, not architecture.
const IGNORE = /^(management_lock|resource_group_template_deployment|monitor_action_group|monitor_metric_alert|key_vault_access_policy|role_definition|policy_.*|subscription_.*|resource_provider_registration|private_dns_a_record|dns_a_record|dns_cname_record|app_service_custom_hostname_binding|app_service_certificate.*|cdn_frontdoor_(origin|origin_group|route|endpoint|rule.*|custom_domain.*|security_policy)|firewall_policy_rule_collection_group|network_watcher.*|backup_.*)$/;

// ---------- the draft ----------

export function terraformToDiagram(root, { title, icons } = {}) {
  const { resources, modules } = loadConfig(root);
  resolveRefs.modules = modules;
  const notes = { folded: {}, skipped: [] };
  const fold = (what) => { notes.folded[what] = (notes.folded[what] || 0) + 1; };
  const az = r => r.type.replace(/^azurerm_/, '');
  const isAz = r => r.type.startsWith('azurerm_');

  // Per resource: its references by attribute.
  for (const r of resources.values()) {
    r.refs = [];
    if (r.type === 'module') continue;
    for (const [k, v] of flatAttrs(r.body)) for (const a of resolveRefs(v, r.scope, resources)) if (a !== r.addr) r.refs.push({ key: k, to: a, raw: v });
  }
  const refsOf = (r, re) => r.refs.filter(x => re.test(x.key)).map(x => resources.get(x.to));

  // Items: resources drawn as nodes or groups.
  const items = new Map();
  const ids = new Set();
  const idFor = (r) => {
    const short = (KIND[az(r)]?.[2]) || az(r).split('_').map(w => w[0]).join('');
    let id = `${short}_${r.name}`.replace(/[^\w-]/g, '_');
    if (ids.has(id)) id = `${r.scope.name || 'root'}_${id}`;
    while (ids.has(id)) id += '_';
    ids.add(id);
    return id;
  };
  const label = r => literal(r.body.attrs.name, r.scope, r.each) || r.name.replace(/_/g, '-');
  const many = r => (r.body.attrs.count ? (Number(r.body.attrs.count) || 'N') : r.body.attrs.for_each ? 'each' : null);

  for (const r of resources.values()) {
    if (r.data) continue;
    if (r.type === 'module') { items.set(r.addr, { r, id: idFor(r), label: r.name, kind: `module ${r.remote || ''}`.trim(), icon: 'repo', subs: [] }); continue; }
    if (!isAz(r)) { items.set(r.addr, { r, id: idFor(r), label: label(r), kind: r.type.replace(/_/g, ' '), icon: '', subs: [] }); continue; }
    const t = az(r);
    if (IGNORE.test(t) || t in CHILD || /_association$|_peering$|_virtual_network_link$|^role_assignment$|^monitor_diagnostic_setting$|_swift_connection$/.test(t)) continue;
    const k = KIND[t];
    // A SKU only where it changes what the thing is (plan size, firewall tier).
    const skuKey = { service_plan: 'sku_name', app_service_plan: 'sku_name', firewall: 'sku_tier', application_gateway: 'sku.tier', api_management: 'sku_name', redis_cache: 'sku_name', virtual_network_gateway: 'sku' }[t];
    const skuRaw = skuKey?.includes('.') ? r.body.blocks.find(b => b.type === 'sku')?.attrs.tier : r.body.attrs[skuKey];
    const sku = skuKey ? literal(skuRaw || '', r.scope) : '';
    items.set(r.addr, { r, id: idFor(r), label: label(r), kind: k ? k[0] : t.replace(/_/g, ' '), icon: k ? k[1] : '', sku: sku.length <= 10 ? sku : '', subs: [], many: many(r) });
  }
  const item = addr => items.get(addr);

  // Children fold into their parent's subtitle: "Azure SQL · 2 databases".
  const childCount = new Map();
  for (const r of resources.values()) {
    const t = az(r);
    if (!(t in CHILD) || r.data) continue;
    const key = CHILD[t];
    const parent = key ? refsOf(r, new RegExp(`^${key}$`))[0] : null;
    if (parent && item(parent.addr)) {
      const word = CHILD_WORD[t] || t.replace(/_/g, ' ');
      const m = childCount.get(parent.addr) || new Map();
      m.set(word, [...(m.get(word) || []), label(r)]);
      childCount.set(parent.addr, m);
      fold(word + 's');
    }
  }
  // One child is named ("sqldb-orders", "work node pool"); several are counted.
  const named = (n, word) => (n.toLowerCase().includes(word.split(' ')[0]) || /db|database/i.test(n) ? n : `${n} ${word}`);
  for (const [addr, m] of childCount) for (const [word, names] of m) item(addr).subs.push(names.length === 1 ? named(names[0], word) : `${names.length} ${word}s`);

  // Public IPs and NICs fold into whatever uses them.
  for (const it of [...items.values()]) {
    const t = az(it.r);
    if (t !== 'public_ip') continue;
    const users = [...items.values()].filter(o => o.r.refs.some(x => x.to === it.r.addr));
    if (users.length) { users.forEach(u => u.subs.push('public IP')); items.delete(it.r.addr); fold('public IPs'); }
  }

  // Containment: VNet > subnet > what is deployed into it; plan > apps; else resource group.
  const parentOf = new Map();
  const groupy = new Set();
  for (const it of items.values()) {
    const r = it.r, t = az(r);
    let p = null;
    if (t === 'subnet') p = refsOf(r, /^virtual_network_name$|^virtual_network_id$/)[0];
    if (!p) p = refsOf(r, /(^|\.)(subnet_id|vnet_subnet_id|infrastructure_subnet_id|delegated_subnet_id)$/).filter(x => x && az(x) === 'subnet')[0];
    if (!p && /web_app|function_app/.test(t)) p = refsOf(r, /^service_plan_id$|^app_service_plan_id$/)[0];
    if (!p && /_slot$/.test(t)) p = refsOf(r, /^app_service_id$/)[0];
    if (!p) p = refsOf(r, /^resource_group_name$/).find(x => x && az(x) === 'resource_group');
    if (p && items.has(p.addr)) { parentOf.set(r.addr, p.addr); groupy.add(p.addr); }
    else if (!p && t !== 'resource_group') {
      // A literal resource group name: a box of its own.
      const rg = literal(r.body.attrs.resource_group_name, r.scope);
      if (rg) {
        const key = `rg:${rg}`;
        if (!items.has(key)) items.set(key, { r: { addr: key, type: 'azurerm_resource_group', refs: [], body: { attrs: {} }, scope: r.scope }, id: idFor({ type: 'azurerm_resource_group', name: rg, scope: r.scope }), label: rg, kind: 'Resource group', icon: 'rg', subs: [] });
        parentOf.set(r.addr, key); groupy.add(key);
      }
    }
  }
  // Subnets and VNets are always boxes, even when empty; so are resource groups.
  for (const it of items.values()) if (['subnet', 'virtual_network', 'resource_group'].includes(az(it.r))) groupy.add(it.r.addr);

  // Subnet extras from associations: NSG, route table.
  const links = [];
  const link = (from, to, lbl, op = '->') => {
    if (!from || !to || from === to) return;
    const a = item(from), b = item(to);
    if (!a || !b) return;
    const same = links.find(l => (l.from === from && l.to === to) || (op === '<->' && l.from === to && l.to === from));
    if (same) { if (lbl && (!same.label || same.weak)) { same.label = lbl; same.weak = false; } return; }
    links.push({ from, to, label: lbl, op });
  };
  const nsgUsed = new Set();
  for (const r of resources.values()) {
    if (!isAz(r) || r.data) continue;
    const t = az(r);
    if (t === 'subnet_network_security_group_association') {
      const [s] = refsOf(r, /^subnet_id$/), [g] = refsOf(r, /^network_security_group_id$/);
      if (s && item(s.addr)) item(s.addr).subs.push('NSG');
      if (g) nsgUsed.add(g.addr);
      fold('NSG associations');
    } else if (t === 'subnet_route_table_association') {
      const [s] = refsOf(r, /^subnet_id$/), [rt] = refsOf(r, /^route_table_id$/);
      if (s && rt) {
        // Draw the route itself: subnet to the next hop, if the route table names one.
        const hop = rt.refs.find(x => /next_hop/.test(x.key));
        const prefix = literal(rt.body.blocks.find(b => b.type === 'route')?.attrs.address_prefix);
        if (hop && item(hop.to)) { link(s.addr, hop.to, `UDR ${prefix || ''}`.trim()); items.delete(rt.addr); }
        else link(s.addr, rt.addr, 'routes');
      }
      fold('route table associations');
    } else if (t === 'virtual_network_peering') {
      const [a] = refsOf(r, /^virtual_network_name$/), [b] = refsOf(r, /^remote_virtual_network_id$/);
      if (a && b) link(a.addr, b.addr, 'peering', '<->');
      fold('peerings');
    } else if (t === 'private_dns_zone_virtual_network_link') {
      const [z] = refsOf(r, /^private_dns_zone_name$/), [v] = refsOf(r, /^virtual_network_id$/);
      if (z && v) link(z.addr, v.addr, 'VNet link', '--');
      fold('DNS zone links');
    } else if (t === 'role_assignment') {
      const [p] = refsOf(r, /^principal_id$/), [s] = refsOf(r, /^scope$/);
      // "Key Vault Secrets User" on a link into a Key Vault reads "Secrets User".
      const kind = KIND[az(s || r)]?.[0] || '';
      const role = literal(r.body.attrs.role_definition_name, r.scope).replace(/^Azure\s+/, '').replace(new RegExp(`^${kind.replace(/^Azure /, '')} +`, 'i'), '');
      if (p && s) link(p.addr, s.addr, role || 'role');
      fold('role assignments');
    } else if (t === 'monitor_diagnostic_setting') {
      const [s] = refsOf(r, /^target_resource_id$/), [w] = refsOf(r, /^log_analytics_workspace_id$|^storage_account_id$|^eventhub_authorization_rule_id$/);
      if (s && w) link(s.addr, w.addr, 'diagnostics', '~>');
      fold('diagnostic settings');
    } else if (/_swift_connection$/.test(t)) {
      const [a] = refsOf(r, /^app_service_id$/), [s] = refsOf(r, /^subnet_id$/);
      if (a && s) link(a.addr, s.addr, 'VNet integration');
      fold('VNet integrations');
    }
  }
  // An NSG shown as "NSG" on its subnets needs no box of its own.
  for (const a of nsgUsed) if (![...items.values()].some(o => o.r.refs.some(x => x.to === a))) items.delete(a);

  // Remaining references become links, except those already shown by containment.
  const CONTAIN = /(^|\.)(resource_group_name|location|virtual_network_name|service_plan_id|app_service_plan_id|tenant_id|subnet_id|vnet_subnet_id|infrastructure_subnet_id|delegated_subnet_id|app_service_id|server_id|private_dns_zone_ids|public_ip_address_id|network_interface_ids|name)$/;
  for (const it of [...items.values()]) {
    const r = it.r;
    for (const x of r.refs) {
      if (!items.has(x.to) || parentOf.get(r.addr) === x.to) continue;
      const to = resources.get(x.to);
      if (/(^|\.)virtual_network_subnet_id$/.test(x.key)) { link(r.addr, x.to, 'VNet integration'); continue; }
      if (/private_connection_resource_id$/.test(x.key)) { link(r.addr, x.to, 'private link'); continue; }
      if (/^ingress_application_gateway\.gateway_id$/.test(x.key)) { link(x.to, r.addr, 'ingress'); continue; }
      if (CONTAIN.test(x.key)) continue;
      if (/next_hop/.test(x.key)) { link(r.addr, x.to, 'next hop'); continue; }
      if (/^workspace_id$/.test(x.key)) { link(r.addr, x.to, 'workspace'); continue; }
      const lbl = USE[to ? az(to) : ''] || x.key.split('.').pop().replace(/_(id|name|ids|uri|url)$/, '').replace(/_/g, ' ');
      link(r.addr, x.to, lbl);
      const l = links.at(-1);
      if (l && !USE[to ? az(to) : '']) l.weak = true;
    }
  }

  // ---------- emit ----------
  const kids = new Map();
  for (const it of items.values()) {
    const p = parentOf.get(it.r.addr);
    const k = p && items.has(p) ? p : '__root';
    (kids.get(k) || kids.set(k, []).get(k)).push(it);
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const iconAttr = name => (name && (!icons || icons(name)) ? ` icon="${esc(name)}"` : '');
  // Inside a box, what uses comes before what is used (apps, then Key Vault and App
  // Insights, then Log Analytics), so links run one way down the stack.
  const under = new Map();
  const collect = addr => { const out = new Set([addr]); for (const k of kids.get(addr) || []) collect(k.r.addr).forEach(a => out.add(a)); return out; };
  const flowRank = new Map();
  for (const [parent, list] of kids) {
    const sets = new Map(list.map(c => [c.r.addr, collect(c.r.addr)]));
    const owner = a => list.find(c => sets.get(c.r.addr).has(a))?.r.addr;
    const preds = new Map(list.map(c => [c.r.addr, new Set()]));
    for (const l of links) { const a = owner(l.from), b = owner(l.to); if (a && b && a !== b && l.op !== '<->') preds.get(b).add(a); }
    const memo = new Map(), busy = new Set();
    const rank = a => { if (memo.has(a)) return memo.get(a); if (busy.has(a)) return 0; busy.add(a); const r = Math.max(0, ...[...preds.get(a)].map(p => rank(p) + 1)); busy.delete(a); memo.set(a, r); return r; };
    list.forEach(c => flowRank.set(c.r.addr, rank(c.r.addr)));
    under.set(parent, true);
  }
  const position = new Map([...items.keys()].map((a, i) => [a, i]));
  // Network boxes keep source order (subnets in address order, as written).
  const net = it => ['resource_group', 'virtual_network', 'subnet'].includes(az(it.r));
  const order = it => ({ resource_group: 0, virtual_network: 1, subnet: 2 }[az(it.r)] ?? 3) * 1e6 + (net(it) ? 0 : (flowRank.get(it.r.addr) || 0) * 1e3) + position.get(it.r.addr);
  const lines = [];
  const emit = (it, depth) => {
    const pad = '  '.repeat(depth);
    const t = az(it.r);
    const children = (kids.get(it.r.addr) || []).sort((a, b) => order(a) - order(b));
    const sub = [it.sku, ...it.subs].filter(Boolean).join(' · ');
    if (groupy.has(it.r.addr)) {
      let style = '', gsub = sub;
      if (t === 'virtual_network') { style = ' style=vnet'; gsub = [cidr(it.r.body.attrs.address_space, it.r), sub].filter(Boolean).join(' · '); }
      else if (t === 'subnet') { style = ' style=subnet'; it.icon = ''; gsub = [cidr(it.r.body.attrs.address_prefixes || it.r.body.attrs.address_prefix, it.r), ...it.subs].filter(Boolean).join(' · '); }
      else if (t !== 'resource_group') gsub = [it.kind, sub].filter(Boolean).join(' · ');
      const vnets = children.filter(c => az(c.r) === 'virtual_network');
      const loose = children.filter(c => !groupy.has(c.r.addr));
      // A resource group with VNets: the VNets side by side, then its other resources in a
      // column to their right, next to what they connect to.
      const column = t === 'resource_group' && vnets.length && loose.length > 1;
      const layout = vnets.length > 1 || (t === 'resource_group' && vnets.length && children.length > 1) ? ' layout=row' : children.length > 5 && t === 'resource_group' ? ' layout=grid cols=2' : '';
      lines.push(`${pad}<group id=${it.id} label="${esc(it.label)}"${gsub ? ` sub="${esc(gsub)}"` : ''}${style}${iconAttr(it.icon)}${layout}>`);
      children.filter(c => !column || !loose.includes(c)).forEach(c => emit(c, depth + 1));
      if (column) {
        lines.push(`${pad}  <group id=${it.id}_services style=plain>`);
        loose.forEach(c => emit(c, depth + 2));
        lines.push(`${pad}  </group>`);
      }
      lines.push(`${pad}</group>`);
    } else {
      const count = Number.isFinite(it.many) ? ` count=${Math.min(it.many, 3)}` : '';
      const kind = it.many === 'each' || it.many === 'N' ? `${it.kind} ×N` : Number.isFinite(it.many) ? `${it.kind} ×${it.many}` : it.kind;
      lines.push(`${pad}<node id=${it.id}${iconAttr(it.icon)}${count}${it.r.type === 'module' ? ' external' : ''}>${esc(it.label)} | ${esc([kind, sub].filter(Boolean).join(' · '))}</node>`);
    }
  };
  // Top-level boxes: the first in the flow on the left, the boxes it reaches stacked on
  // the right, so links from it to each are short (app | network / app | data).
  const top = (kids.get('__root') || []).sort((a, b) => order(a) - order(b));
  const firsts = top.filter(t => (flowRank.get(t.r.addr) || 0) === 0);
  if (top.length >= 3 && top.length <= 5 && firsts.length === 1 && top.every(t => groupy.has(t.r.addr))) {
    const rest = top.filter(t => t !== firsts[0]);
    lines.push('<layout>', ...rest.map(t => `${firsts[0].id} ${t.id}`), '</layout>');
  } else if (top.length === 2 && top.every(t => groupy.has(t.r.addr))) {
    // Two resource groups: one above the other, the hub (gateways, firewall) on top, so
    // peering runs straight down instead of across the other group's services.
    const hubby = t => [...collect(t.r.addr)].some(a => /GatewaySubnet|AzureFirewallSubnet|AzureBastionSubnet/.test(items.get(a)?.label || '') || /firewall$|virtual_network_gateway$|bastion_host$/.test(items.get(a)?.r.type || ''));
    const [a, b] = hubby(top[1]) && !hubby(top[0]) ? [top[1], top[0]] : top;
    lines.push('<layout>', a.id, b.id, '</layout>');
  }
  for (const it of top) emit(it, 0);
  const name = title || path.basename(path.resolve(root));
  const nRes = [...resources.values()].filter(r => !r.data && r.type !== 'module').length;
  const nMod = modules.length - 1;
  // Links with the same target, label and kind become one statement: drawn as a bundle
  // with one label ("app, func -> appi : telemetry").
  const merged = new Map();
  for (const l of links) {
    const k = `${l.to}|${l.label}|${l.op}`;
    (merged.get(k) || merged.set(k, { ...l, froms: [] }).get(k)).froms.push(l.from);
  }
  const linkLines = [...merged.values()].map(l => `${l.froms.map(f => item(f).id).join(', ')} ${l.op} ${item(l.to).id}${l.label ? ` : ${l.label}` : ''}`);
  const html = `<diagram title="${esc(name)}" subtitle="${esc(`From Terraform: ${nRes} resources${nMod ? ` in ${nMod + 1} modules` : ''}`)}">\n${lines.join('\n')}\n<links>\n${linkLines.join('\n')}\n</links>\n</diagram>\n`;
  for (const r of resources.values()) if (r.data && !/client_config|subscription|tenant|role_definition/.test(r.type)) notes.skipped.push(r.addr);
  const groups = [...items.values()].filter(it => groupy.has(it.r.addr));
  return {
    html,
    summary: {
      groups: groups.length, nodes: items.size - groups.length, links: links.length, resources: nRes, modules: nMod,
      folded: notes.folded, skipped: notes.skipped,
    },
  };
}

function cidr(raw, r) {
  if (!raw) return '';
  // [each.value], [var.cidr], local.ranges…: each element through literal().
  const inner = raw.trim().replace(/^\[|\]$/g, '');
  return entriesOfList(inner).map(e => (/^"/.test(e) ? e.slice(1, -1) : literal(e, r.scope, r.each))).filter(v => /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(v)).join(', ');
}
const entriesOfList = s => s.split(',').map(x => x.trim()).filter(Boolean);
