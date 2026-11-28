# Icons

An icon helps a reader find and tell apart the items of a figure; it names nothing by itself, so
its label stays beside it (icons with labels are learned and recalled better than icons alone:
Wiedenbeck, *Behaviour & Information Technology*, 1999).

## Contents

- [Choosing a set](#choosing-a-set): one style per figure
- [Cloud services](#cloud-services): Azure and AWS
- [Generic icons](#generic-icons): people, devices, places
- [Line icons](#line-icons): Phosphor, for every other idea
- [Your own set](#your-own-set): a company's icons from a folder or a sprite
- [One picture](#one-picture): a logo, a drawing of your own
- [Size and colour](#size-and-colour)
- [Problems](#problems)

## Choosing a set

Keep one style in a figure: icons from different sets differ in stroke, corners and detail, and
side by side they look assembled rather than designed.

- **The client's own set**, when they have one: their readers know it, and it carries the brand.
- **Cloud service icons** where the figure is about those services (an architecture, a network).
  They are the vendors' official artwork, in full colour.
- **Line icons** for ideas, steps and roles (a proposal, a process, an infographic), in one weight.
- **The generic set** for the people, devices and places around a cloud architecture.

## Cloud services

`<icon name="app service">` draws the Azure icon. Loose names work for every service in both
packs (`elasticache`, `glue`, `purview`); a few of the many:

- Azure: `app service`, `functions`, `aks`, `container app`, `acr`, `service bus`,
  `event hubs`, `apim`, `front door`, `app gateway`, `firewall`, `vnet`, `subnet`, `nsg`,
  `private endpoint`, `vpn gateway`, `expressroute` (the circuit), `expressroute gateway`,
  `bastion`, `dns resolver`, `private dns`, `databricks`, `entra`, `managed identity`, `kv`,
  `sql`, `cosmos`, `redis`, `storage`, `app insights`, `log analytics`, `mg`, `subscription`.
- AWS: `lambda`, `s3`, `dynamodb`, `api gateway`, `cloudfront`, `cognito`, `ec2`, `ecs`,
  `eks`, `fargate`, `rds`, `aurora`, `sqs`, `sns`, `eventbridge`, `step functions`, `vpc`,
  `alb`, `nat gateway`, `route 53`, `cloudwatch`, `iam`, `kms`, `secrets manager`, `waf`.

A name both clouds have (`load balancer`, `waf`) means Azure's; `icons=aws` on `<diagram>`
makes AWS win, and a prefix picks one icon's pack: `aws:waf`, `azure:firewall`. The first render
downloads both packs into the skill (once, a few seconds).

## Generic icons

`user`, `users`, `browser`, `mobile`, `laptop`, `server`, `database`, `api`, `globe`,
`building`, `cloud`, `key`, `lock`, `shield`, `file`, `gear`, `mail`, `message`, `timer`,
`code`, `repo`, and words that mean one of them (`person`, `internet`, `on-premises`, `partner`).
They are two-tone outlines: the line in the icon's colour, a soft fill from `--icon-soft`.

## Line icons

Phosphor's 1,500 line icons (MIT licence) cover any idea: `<icon name="ph:rocket-launch">`.
Names are Phosphor's own, as listed on phosphoricons.com; a wrong one is reported with the
nearest names, so a good guess (`ph:handshake`, `ph:shield-check`, `ph:chart-line-up`) gets you
there. Each comes in six weights, written after the name: `ph:rocket-launch` (regular), `-thin`,
`-light`, `-bold`, `-fill`, `-duotone`. Keep one weight in a figure; `-fill` or `-bold` may mark
the one item that matters. The first render downloads the pack with the cloud packs (once).

## Your own set

A company's icon set is named on `<diagram>` under a prefix of your choosing, and drawn by it:

```html
<diagram icon-sets="acme: ../brand/icons; flags: ../brand/flags.svg">
  …
  <icon name="acme:shield-check"></icon>
```

- **A folder** of SVG files, one icon per file, its subfolders included: the icon's name is the
  file's, in lower case with dashes (`ShieldCheck.svg` and `shield_check.svg` are
  `acme:shield-check`).
- **A sprite**, one SVG file of `<symbol id="…" viewBox="…">`: the name is the symbol's id.
- **Paths** are relative to the diagram file and may leave its folder, so one brand folder serves
  every diagram in a repository. Several sets go in one attribute, separated by `;`.
- **Colour**: an icon drawn in one colour (a line or a glyph set, whatever colour its files use)
  paints in the CSS `color` of its `<icon>`, as line icons do. An icon of several colours (a
  logo, an illustration) keeps them.
- **Files exported from design tools** work as they come: class styles (`.cls-1 { fill: … }`)
  are applied, and editor metadata is dropped.
- **A wrong name** is reported with the set's nearest names; a set that cannot be read makes its
  icons report `no icon set "acme"` with the path to check.

The browser viewer (a diagram opened in a page) cannot list a folder, so it asks for the file by
name, in the spellings above, from the folder itself; keep the icons there rather than in
subfolders, or use a sprite. A diagram opened from disk cannot read files at all: render it, or
serve the page. The canvas of the GitHub Copilot app reads files inside the diagram's own folder
only, so a set in a folder above it shows in the render but not on the canvas.

## One picture

- A logo or a single image: `<img src="logo.svg">`, a path relative to the diagram file; the SVG
  holds the image, so it travels with it.
- A drawing of your own, once: an inline `<svg>` sized with CSS; it paints in the CSS `color` of
  its element where it uses `currentColor`.

## Size and colour

An icon is sized and coloured with CSS like any element: `icon { width: 28px; height: 28px;
color: var(--woad) }`, or `size=32` on the element. Line icons, the generic set and one-colour
icons of your own take the `color`; vendor and multi-colour icons keep theirs. In the drawing
script, `icon(p, 'ph:pulse', { size: 30, color: 'rust' })` (a theme colour's name, or any CSS
colour).

## Problems

| The render says | Do this |
|---|---|
| `unknown-icon` with suggestions | use one of the suggested names |
| `unknown-icon` (no icon set "…") | name the set with `icon-sets` on `<diagram>`, and check its path from the diagram file |
| `unknown-icon` (pack not downloaded) | render once online, or run `scripts/fetch-icons.mjs` |
