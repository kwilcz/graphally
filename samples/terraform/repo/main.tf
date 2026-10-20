# Fabrikam logistics platform: AKS behind Application Gateway, hub-and-spoke network.
terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}

provider "azurerm" {
  features {}
}

variable "env" { default = "prod" }

locals {
  prefix   = "fab-${var.env}"
  location = "northeurope"
}

resource "azurerm_resource_group" "hub" {
  name     = "rg-${local.prefix}-hub"
  location = local.location
}

resource "azurerm_resource_group" "workload" {
  name     = "rg-${local.prefix}-logistics"
  location = local.location
}

resource "azurerm_virtual_network" "hub" {
  name                = "vnet-${local.prefix}-hub"
  location            = local.location
  resource_group_name = azurerm_resource_group.hub.name
  address_space       = ["10.100.0.0/16"]
}

resource "azurerm_subnet" "gateway" {
  name                 = "GatewaySubnet"
  resource_group_name  = azurerm_resource_group.hub.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.100.0.0/27"]
}

resource "azurerm_public_ip" "vpn" {
  name                = "pip-${local.prefix}-vpn"
  location            = local.location
  resource_group_name = azurerm_resource_group.hub.name
  allocation_method   = "Static"
}

resource "azurerm_virtual_network_gateway" "vpn" {
  name                = "vgw-${local.prefix}"
  location            = local.location
  resource_group_name = azurerm_resource_group.hub.name
  type                = "Vpn"
  sku                 = "VpnGw2"

  ip_configuration {
    subnet_id            = azurerm_subnet.gateway.id
    public_ip_address_id = azurerm_public_ip.vpn.id
  }
}

resource "azurerm_container_registry" "acr" {
  name                = "acrfab${var.env}"
  resource_group_name = azurerm_resource_group.hub.name
  location            = local.location
  sku                 = "Premium"
}

module "spoke" {
  source              = "./modules/spoke"
  prefix              = local.prefix
  location            = local.location
  resource_group_name = azurerm_resource_group.workload.name
  hub_vnet_id         = azurerm_virtual_network.hub.id
  hub_vnet_name       = azurerm_virtual_network.hub.name
  hub_rg              = azurerm_resource_group.hub.name
  acr_id              = azurerm_container_registry.acr.id
}
