# Hierarchy diagrams

`<diagram layout=tree>` turns nesting into a tree: a `<node>` inside a `<node>` is its
child. Children sit side by side under their parent with bus connectors.

```html
<diagram layout=tree node-style=icon stack=leaves title="Management groups">
  <level depth="0-1" label="Tenant root group"></level>
  <level depth="2" label="Management groups"></level>
  <level depth="3" label="Subscriptions"></level>
  <node id=root icon=mg>Tenant Root
    <node id=org icon=mg>Contoso
      <node id=platform icon=mg>Platform
        <node icon=subscription>Connectivity</node>
        <node icon=subscription>Identity</node>
      </node>
      <node id=lz icon=mg>Landing zones
        <node icon=subscription>Corp</node>
        <node icon=subscription>Online</node>
      </node>
    </node>
  </node>
</diagram>
```

- `node-style=icon` draws icons with labels below (good for Azure hierarchies);
  `card` (default) draws boxes.
- `stack=leaves` lists two or more leaf children vertically on a spine, which keeps wide
  trees narrow. Put `stack` on one node to do it only there.
- `<level depth="a-b" label=…>` draws a labelled band across depths a to b (0 is the root).
  Levels must not overlap.
- `leaves=bottom` on `<diagram>` puts every leaf on the deepest row, so all subscriptions
  share one band even when their parents sit at different depths. Give a leaf that is not
  a subscription (an empty management group) `depth=N` to keep it on its own row.
- `<links>` can add extra relations between any nodes (drawn routed, not as tree lines).
- `arrows` on `<diagram>` adds arrowheads to tree lines.
