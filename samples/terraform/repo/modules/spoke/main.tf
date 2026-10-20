variable "prefix" {}
variable "location" {}
variable "resource_group_name" {}
variable "hub_vnet_id" {}
variable "hub_vnet_name" {}
variable "hub_rg" {}
variable "acr_id" {}

locals {
  subnets = {
    agw   = "10.110.0.0/24"
    aks   = "10.110.4.0/22"
    db    = "10.110.8.0/24"
    pe    = "10.110.9.0/24"
  }
}

resource "azurerm_virtual_network" "spoke" {
  name                = "vnet-${var.prefix}-logistics"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = ["10.110.0.0/16"]
}

resource "azurerm_subnet" "this" {
  for_each             = local.subnets
  name                 = "snet-${each.key}"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.spoke.name
  address_prefixes     = [each.value]
}

resource "azurerm_virtual_network_peering" "to_hub" {
  name                      = "logistics-to-hub"
  resource_group_name       = var.resource_group_name
  virtual_network_name      = azurerm_virtual_network.spoke.name
  remote_virtual_network_id = var.hub_vnet_id
}

resource "azurerm_user_assigned_identity" "aks" {
  name                = "id-${var.prefix}-aks"
  location            = var.location
  resource_group_name = var.resource_group_name
}

resource "azurerm_application_gateway" "ingress" {
  name                = "agw-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name

  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "gw"
    subnet_id = azurerm_subnet.this["agw"].id
  }
}

resource "azurerm_kubernetes_cluster" "main" {
  name                = "aks-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "fab"

  default_node_pool {
    name           = "system"
    vm_size        = "Standard_D4s_v5"
    node_count     = 3
    vnet_subnet_id = azurerm_subnet.this["aks"].id
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  ingress_application_gateway {
    gateway_id = azurerm_application_gateway.ingress.id
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "work" {
  name                  = "work"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = "Standard_D8s_v5"
  node_count            = 4
  vnet_subnet_id        = azurerm_subnet.this["aks"].id
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = var.acr_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
}

resource "azurerm_postgresql_flexible_server" "db" {
  name                = "psql-${var.prefix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  version             = "16"
  delegated_subnet_id = azurerm_subnet.this["db"].id
  sku_name            = "GP_Standard_D2s_v3"
}

resource "azurerm_postgresql_flexible_server_database" "shipments" {
  name      = "shipments"
  server_id = azurerm_postgresql_flexible_server.db.id
}

resource "azurerm_servicebus_namespace" "events" {
  name                = "sb-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Premium"
}

resource "azurerm_servicebus_queue" "shipments" {
  name         = "shipments"
  namespace_id = azurerm_servicebus_namespace.events.id
}

resource "azurerm_servicebus_topic" "tracking" {
  name         = "tracking"
  namespace_id = azurerm_servicebus_namespace.events.id
}

resource "azurerm_private_endpoint" "sb" {
  name                = "pe-${var.prefix}-sb"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = azurerm_subnet.this["pe"].id

  private_service_connection {
    name                           = "sb"
    private_connection_resource_id = azurerm_servicebus_namespace.events.id
    subresource_names              = ["namespace"]
    is_manual_connection           = false
  }
}

resource "azurerm_key_vault" "kv" {
  name                = "kv-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id           = "00000000-0000-0000-0000-000000000000"
  sku_name            = "premium"
}

resource "azurerm_role_assignment" "aks_kv" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
}

resource "azurerm_role_assignment" "aks_sb" {
  scope                = azurerm_servicebus_namespace.events.id
  role_definition_name = "Azure Service Bus Data Owner"
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
}

resource "azurerm_log_analytics_workspace" "law" {
  name                = "log-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
}

resource "azurerm_monitor_diagnostic_setting" "aks" {
  name                       = "diag-aks"
  target_resource_id         = azurerm_kubernetes_cluster.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
}
